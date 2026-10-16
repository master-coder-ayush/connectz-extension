// content/dom.js

// Store editor reference and cursor position
export let activeEditorRef = null;
export let savedRange = null;

/**
 * Check if the editor is a post composer (not a comment box).
 * @param {HTMLElement} editor - The editor element.
 * @returns {boolean} True if it's a post composer.
 */
export function isPostComposer(editor) {
    // Check for post composer containers - including the modal
    const container = editor.closest('.share-box-v2__modal') ||
        editor.closest('.share-box') ||
        editor.closest('.share-box-feed') ||
        editor.closest('.share-creation-state__text-editor') ||
        editor.closest('.share-creation-state') ||
        editor.closest('[data-test-id="share-box"]') ||
        editor.closest('.share-creation-box') ||
        editor.closest('.share-creation-textarea') ||
        editor.closest('.feed-share-update-v2') ||
        editor.closest('.share-box__text-area') ||
        editor.closest('.editor-container');

    // Also check if it's NOT in a comment container
    const isInComment = editor.closest('[componentkey^="commentBox-"]') ||
        editor.closest('[data-testid*="-text-editor-wrapper"]') ||
        editor.closest('.comments-comment-box') ||
        editor.closest('.comments-comment-box-comment__text-editor') ||
        editor.closest('.comments-comment-box__text-editor');

    return container && !isInComment;
}

/**
 * Extract rough post content from the editor itself.
 * @param {HTMLElement} editor - The editor element.
 * @returns {string|null} The extracted text or null.
 */
export function extractRoughPostContent(editor) {
    try {
        // Get the text content directly from the editor
        const text = editor.textContent || editor.innerText || '';

        // Clean up the text
        return text.trim();
    } catch (error) {
        console.error('Error extracting rough post content:', error);
        return null;
    }
}

/**
 * Save the current cursor position in the editor.
 * @param {HTMLElement} editor - The editor element.
 */
export function saveCursorPosition(editor) {
    activeEditorRef = editor;
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0).cloneRange();
    }
}

/**
 * Restore the saved cursor position in the editor.
 * @param {HTMLElement} editor - The editor element.
 */
export function restoreCursorPosition(editor) {
    if (!editor || !savedRange) return;

    const sel = window.getSelection();
    try {
        // Check if range is still valid
        if (savedRange.startContainer.parentNode && editor.contains(savedRange.startContainer)) {
            sel.removeAllRanges();
            sel.addRange(savedRange);
        }
    } catch (e) {
        // Range might be invalid, try to set cursor at end
        editor.focus();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

/**
 * Extract post content from the DOM relative to the comment editor.
 * @param {HTMLElement} editor - The comment editor element.
 * @returns {string|null} The extracted post content or null.
 */
export function extractPostContent(editor) {
    try {
        // Strategy: Geometric lookup for the closest post or comment text above the editor.
        // This is the most resilient across dynamic DOM structure changes like minified classes.
        
        let textNodes = Array.from(document.querySelectorAll(
            '.update-components-text, ' +
            '.update-components-update-v2__commentary, ' +
            '.feed-shared-text, ' +
            '[data-testid="expandable-text-box"]'
        )).filter(node => {
            // Exclude nodes that are inside a comment thread. 
            // We only want to capture the main post content.
            return !node.closest('[componentkey^="replaceableComment_"]') &&
                   !node.closest('[componentkey*="urn:li:comment"]') &&
                   !node.closest('.comments-comment-item');
        });
        
        // Filter only those visible and geometrically above the editor
        const editorRect = editor.getBoundingClientRect();
        
        let closestTextNode = null;
        let closestDistance = Infinity;
        
        textNodes.forEach(node => {
            const rect = node.getBoundingClientRect();
            // Ensure the node is visible and its bottom is above the editor's top
            if (rect.height > 0 && rect.bottom <= editorRect.bottom) {
                // If the text is partially aligned or strictly above, calculate distance
                let distance = editorRect.top - rect.bottom;
                // If distance is negative (meaning overlapping), we consider it 0
                if (distance < 0) distance = 0;
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestTextNode = node;
                }
            }
        });
        
        // Fallback Strategy: Hierarchical lookup if geometric fails or returns nothing
        if (!closestTextNode) {
            let postContainer =
                editor.closest('div[role="listitem"]') ||
                editor.closest('[data-urn]') ||
                editor.closest('.feed-shared-update-v2') ||
                editor.closest('article');

            if (!postContainer) {
                const commentBox =
                    editor.closest('[componentkey^="commentBox-"]') ||
                    editor.closest('.comments-comment-box') ||
                    editor.closest('.comments-comment-box__editor') ||
                    editor.parentElement;

                if (commentBox) {
                    postContainer =
                        commentBox.closest('div[role="listitem"]') ||
                        commentBox.closest('[data-urn]') ||
                        commentBox.closest('.feed-shared-update-v2') ||
                        commentBox.closest('article');
                }
            }

            if (postContainer) {
                closestTextNode =
                    postContainer.querySelector('[data-testid="expandable-text-box"]') ||
                    postContainer.querySelector('.update-components-text') ||
                    postContainer.querySelector('.update-components-update-v2__commentary') ||
                    postContainer.querySelector('.feed-shared-text');
            }
        }

        if (!closestTextNode) return null;

        // Extract text: span.break-words and span[dir="ltr"] are stable in current LinkedIn DOM
        const textSpan =
            closestTextNode.querySelector('span.break-words') ||
            closestTextNode.querySelector('span[dir="ltr"]') ||
            closestTextNode;

        // Replace <br> tags with line breaks before stripping HTML
        let text = textSpan.innerHTML || textSpan.innerText || textSpan.textContent;
        // Retain semantic br tags as newlines
        text = text.replace(/<br\s*\/?>/gi, '\n\n');

        // Strip remaining HTML tags
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        text = tempDiv.textContent || tempDiv.innerText || text;

        // Clean up formatting
        text = text
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n /g, '\n')
            .replace(/ \n/g, '\n')
            .trim();

        return text || null;
    } catch (error) {
        console.error('Error extracting post content:', error);
        return null;
    }
}

/**
 * Insert text at the current cursor position in the editor.
 * @param {string} text - The text to insert.
 * @param {HTMLElement} editor - The editor element.
 */
export function insertAtCursor(text, editor) {
    // Use provided editor or try to find active one
    const targetEditor = editor || document.activeElement.closest('.ql-editor');
    if (!targetEditor) return;

    // Focus the editor first
    targetEditor.focus();

    const sel = window.getSelection();

    // If we have a saved range, use it; otherwise try to get current selection
    let range;
    if (savedRange && targetEditor.contains(savedRange.startContainer)) {
        try {
            range = savedRange.cloneRange();
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) {
            // Fallback to current selection
            if (sel.rangeCount > 0) {
                range = sel.getRangeAt(0);
            } else {
                // Create range at end of editor
                range = document.createRange();
                range.selectNodeContents(targetEditor);
                range.collapse(false);
            }
        }
    } else {
        if (sel.rangeCount > 0) {
            range = sel.getRangeAt(0);
        } else {
            // Create range at end of editor
            range = document.createRange();
            range.selectNodeContents(targetEditor);
            range.collapse(false);
        }
    }

    // Create a text node for the insertion
    const newNode = document.createTextNode(text);

    // Insert text at cursor
    range.insertNode(newNode);

    // Move cursor after inserted text
    range.setStartAfter(newNode);
    range.setEndAfter(newNode);
    sel.removeAllRanges();
    sel.addRange(range);

    // Update saved range
    savedRange = range.cloneRange();

    // Trigger Ember/Quill update
    targetEditor.dispatchEvent(new Event('input', { bubbles: true }));
    targetEditor.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Clear the editor content.
 * This function always clears without adding a placeholder <br> because it is only called
 * right before inserting new content. This avoids leaving an empty trailing line when
 * pasting generated text into the editor.
 * @param {HTMLElement} editor - The editor element.
 */
export function clearEditorContent(editor) {
    if (!editor) return;

    editor.innerHTML = '';

    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
}
