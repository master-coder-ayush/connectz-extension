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
    const isInComment = editor.closest('.comments-comment-box') ||
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
        // Find the comment box container
        const editorContainer = editor.closest('.ql-container') ||
            editor.closest('.comments-comment-box') ||
            editor.parentElement;
        if (!editorContainer) return null;

        // Find the post container - traverse up the DOM to find the feed update
        let postContainer = editorContainer.closest('.feed-shared-update-v2');

        // If not found, try alternative selectors
        if (!postContainer) {
            postContainer = editorContainer.closest('[data-urn]') ||
                editorContainer.closest('article') ||
                editorContainer.closest('.feed-shared-update-v2__commentary')?.closest('.feed-shared-update-v2');
        }

        if (!postContainer) {
            // Last resort: look for the nearest update-components-text element
            const allPosts = document.querySelectorAll('.update-components-text');
            let closestPost = null;
            let closestDistance = Infinity;

            allPosts.forEach(post => {
                const rect = post.getBoundingClientRect();
                const editorRect = editor.getBoundingClientRect();
                const distance = Math.abs(rect.top - editorRect.top);

                if (distance < closestDistance && rect.top < editorRect.top) {
                    closestDistance = distance;
                    closestPost = post;
                }
            });

            if (closestPost) {
                postContainer = closestPost.closest('.feed-shared-update-v2') || closestPost;
            }
        }

        if (!postContainer) return null;

        // Find the post text element
        const postTextElement = postContainer.querySelector('.update-components-text') ||
            postContainer.querySelector('.update-components-update-v2__commentary');

        if (!postTextElement) return null;

        // Extract text from the inner span with dir="ltr"
        const textSpan = postTextElement.querySelector('span[dir="ltr"]') ||
            postTextElement.querySelector('span.break-words') ||
            postTextElement;

        if (!textSpan) return null;

        // Get text content - replace <br> tags with line breaks
        let text = textSpan.innerHTML || textSpan.innerText || textSpan.textContent;

        // Replace <br> and <br/> tags with line breaks
        text = text.replace(/<br\s*\/?>/gi, '\n\n');

        // Remove HTML tags but keep text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        text = tempDiv.textContent || tempDiv.innerText || text;

        // Clean up the text
        text = text.replace(/\n{3,}/g, '\n\n')  // Replace 3+ line breaks with double
            .replace(/[ \t]+/g, ' ')       // Replace multiple spaces with single
            .replace(/\n /g, '\n')          // Remove spaces after line breaks
            .replace(/ \n/g, '\n')          // Remove spaces before line breaks
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
 * @param {HTMLElement} editor - The editor element.
 */
export function clearEditorContent(editor) {
    if (!editor) return;

    editor.innerHTML = '';

    const paragraph = document.createElement('p');
    const br = document.createElement('br');
    paragraph.appendChild(br);
    editor.appendChild(paragraph);

    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
}
