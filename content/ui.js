// content/ui.js
import {
    isPostComposer,
    extractRoughPostContent,
    extractPostContent,
    saveCursorPosition,
    clearEditorContent,
    insertAtCursor
} from './dom.js';
import { showToast } from './toast.js';

/**
 * Request a generated comment from the background script.
 * @param {string} postContent 
 * @returns {Promise<string>}
 */
function requestGeneratedComment(postContent) {
    return new Promise((resolve, reject) => {
        if (!postContent || !postContent.trim()) {
            reject(new Error("Post content is empty."));
            return;
        }

        chrome.runtime.sendMessage(
            {
                action: "generateComment",
                postContent,
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (!response || !response.success) {
                    reject(
                        new Error(
                            response?.error ||
                            "Unable to generate comment. Please try again later."
                        )
                    );
                    return;
                }

                resolve(response.comment);
            }
        );
    });
}

/**
 * Request a rephrased comment from the background script.
 * @param {string} postContent 
 * @param {string} existingComment 
 * @returns {Promise<string>}
 */
function requestRephraseComment(postContent, existingComment) {
    return new Promise((resolve, reject) => {
        if (!postContent || !postContent.trim()) {
            reject(new Error("Post content is empty."));
            return;
        }

        if (!existingComment || !existingComment.trim()) {
            reject(new Error("Existing comment is empty."));
            return;
        }

        chrome.runtime.sendMessage(
            {
                action: "rephraseComment",
                postContent,
                existingComment,
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (!response || !response.success) {
                    reject(
                        new Error(
                            response?.error ||
                            "Unable to rephrase comment. Please try again later."
                        )
                    );
                    return;
                }

                resolve(response.comment);
            }
        );
    });
}

/**
 * Request a generated post from the background script.
 * @param {string} roughPostContent 
 * @returns {Promise<string>}
 */
function requestGeneratedPost(roughPostContent) {
    return new Promise((resolve, reject) => {
        if (!roughPostContent || !roughPostContent.trim()) {
            reject(new Error("Rough post content is empty."));
            return;
        }

        chrome.runtime.sendMessage(
            {
                action: "generatePost",
                roughPostContent,
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (!response || !response.success) {
                    reject(
                        new Error(
                            response?.error ||
                            "Unable to generate post. Please try again later."
                        )
                    );
                    return;
                }

                resolve(response.post);
            }
        );
    });
}

/**
 * Create and add the "+" button to the editor.
 * @param {HTMLElement} editor 
 */
export function addPlusButton(editor) {
    if (editor.dataset.connectzPlusInit) return;
    editor.dataset.connectzPlusInit = 'true';

    if (!editor._connectzActionWrapper) {
        editor._connectzActionWrapper = document.createElement('div');
        editor._connectzActionWrapper.className = 'connectz-action-wrapper';
    }

    // Create + button (one per editor)
    const plusBtn = document.createElement('button');
    plusBtn.className = 'connectz-plus-btn';
    plusBtn.type = 'button';
    plusBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

    // Set title based on editor type
    const isPost = isPostComposer(editor);
    plusBtn.title = isPost ? 'Generate post from rough content' : 'Generate comment from post';

    plusBtn.style.cssText = `
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      color: white;
      border: none;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 0;
      box-shadow: 0 1px 3px rgba(245, 158, 11, 0.3);
      transition: all 0.2s ease;
      flex-shrink: 0;
    `;

    // Hover effect
    plusBtn.addEventListener('mouseenter', () => {
        plusBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
        plusBtn.style.boxShadow = '0 2px 6px rgba(245, 158, 11, 0.45)';
        plusBtn.style.transform = 'scale(1.08)';
    });
    plusBtn.addEventListener('mouseleave', () => {
        plusBtn.style.background = 'linear-gradient(135deg, #fbbf24, #f59e0b)';
        plusBtn.style.boxShadow = '0 1px 3px rgba(245, 158, 11, 0.3)';
        plusBtn.style.transform = 'scale(1)';
    });

    // Track if button should stay visible
    let buttonShouldStayVisible = false;

    // Click handler - insert text at cursor
    plusBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Save editor reference and cursor position before click
        saveCursorPosition(editor);
    });

    plusBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        buttonShouldStayVisible = true;
        const originalHTML = plusBtn.innerHTML;
        plusBtn.textContent = '…';
        plusBtn.disabled = true;

        // Check if this is a post composer or comment box
        const isPost = isPostComposer(editor);

        // Capture references NOW before the user scrolls away
        const postContainer = editor.closest('div[role="listitem"]') ||
            editor.closest('[data-urn]') ||
            editor.closest('.feed-shared-update-v2') ||
            editor.closest('article') ||
            editor.closest('[componentkey^="commentBox-"]');
        const editorRef = editor;

        // Quick validation
        if (isPost) {
            const roughPostContent = extractRoughPostContent(editor);
            if (!roughPostContent) {
                showToast({
                    type: 'error',
                    title: 'No content found',
                    message: 'Please write some rough post content first.',
                    duration: 5000
                });
                plusBtn.innerHTML = originalHTML;
                plusBtn.disabled = false;
                buttonShouldStayVisible = false;
                return;
            }
        } else {
            const postContent = extractPostContent(editor);
            if (!postContent) {
                showToast({
                    type: 'error',
                    title: 'Cannot find post',
                    message: 'Unable to extract post content from LinkedIn.',
                    duration: 5000
                });
                plusBtn.innerHTML = originalHTML;
                plusBtn.disabled = false;
                buttonShouldStayVisible = false;
                return;
            }
        }

        // Show brief loading indication then restore button
        setTimeout(() => {
            plusBtn.innerHTML = originalHTML;
            plusBtn.disabled = false;
            buttonShouldStayVisible = false;
        }, 600);

        // Show a "generating" toast while waiting
        const loadingToast = showToast({
            type: 'generating',
            title: isPost ? 'Generating post…' : 'Generating comment…',
            message: 'You can keep scrolling — we\'ll notify you when it\'s ready.',
            duration: 0  // No auto-dismiss — we'll dismiss manually
        });

        // Fire API call in the background (non-blocking)
        try {
            let generatedText;

            if (isPost) {
                const roughPostContent = extractRoughPostContent(editorRef);
                generatedText = await requestGeneratedPost(roughPostContent);
            } else {
                const postContent = extractPostContent(editorRef);
                generatedText = await requestGeneratedComment(postContent);
            }

            // Dismiss loading toast
            loadingToast.dismiss();

            // Build action buttons for the success toast
            const actions = [];

            // 1. Scroll to Post
            if (postContainer && postContainer.isConnected) {
                actions.push({
                    label: 'Scroll to Post',
                    icon: '📍',
                    onClick: () => {
                        postContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }

            // 2. Copy to Clipboard
            actions.push({
                label: 'Copy',
                icon: '📋',
                onClick: () => {
                    navigator.clipboard.writeText(generatedText).catch(() => {
                        // Fallback for clipboard API failure
                        const textarea = document.createElement('textarea');
                        textarea.value = generatedText;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        textarea.remove();
                    });
                }
            });

            // 3. Paste into Editor (primary action)
            if (editorRef && editorRef.isConnected) {
                actions.push({
                    label: 'Paste',
                    icon: '✏️',
                    primary: true,
                    onClick: () => {
                        // Scroll to the post first so user sees the editor
                        if (postContainer && postContainer.isConnected) {
                            postContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                        setTimeout(() => {
                            editorRef.focus();
                            clearEditorContent(editorRef);
                            insertAtCursor(generatedText, editorRef);
                        }, 400);
                    }
                });
            }

            // Show success toast with preview and actions
            const previewText = generatedText.length > 120
                ? generatedText.substring(0, 120) + '…'
                : generatedText;

            showToast({
                type: 'success',
                title: isPost ? '✨ Post generated!' : '✨ Comment generated!',
                message: previewText,
                duration: 20000,
                actions
            });

        } catch (error) {
            // Dismiss loading toast
            loadingToast.dismiss();

            console.error("Error generating content:", error);
            showToast({
                type: 'error',
                title: isPost ? 'Post generation failed' : 'Comment generation failed',
                message: error?.message || 'Something went wrong. Please try again.',
                duration: 8000
            });
        }
    });

    // Insert button into the connectz action wrapper
    editor._connectzActionWrapper.appendChild(plusBtn);

    // The + button should always be visible by default
    plusBtn.style.display = 'inline-flex';
    editor._connectzActionWrapper.style.display = 'inline-flex';

    // Give it a click listener to refocus the editor after clicking
    plusBtn.addEventListener('mouseup', () => {
        setTimeout(() => {
            editor.focus();
        }, 100);
    });

    // Track cursor position when the editor is interacted with
    editor.addEventListener('focus', () => {
        saveCursorPosition(editor);
    });

    editor.addEventListener('click', () => {
        saveCursorPosition(editor);
    });

    // Also track on generic focus changes within the editor
    document.addEventListener('focusin', (e) => {
        if (e.target === editor || editor.contains(e.target)) {
            saveCursorPosition(editor);
        }
    });
}

/**
 * Create and add the rotate button to the editor.
 * @param {HTMLElement} editor 
 */
export function addRotateButton(editor) {
    if (editor.dataset.connectzRotateInit) return;
    editor.dataset.connectzRotateInit = 'true';

    if (!editor._connectzActionWrapper) {
        editor._connectzActionWrapper = document.createElement('div');
        editor._connectzActionWrapper.className = 'connectz-action-wrapper';
    }

    // Create rotate button (one per editor)
    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'connectz-rotate-btn';
    rotateBtn.type = 'button';
    rotateBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 5.5A4.5 4.5 0 0 0 3 4m0 0V1.5M3 4h2.5M2.5 8.5A4.5 4.5 0 0 0 11 10m0 0v2.5M11 10H8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    // Set title 
    rotateBtn.title = 'Rephrase existing comment';

    rotateBtn.style.cssText = `
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      color: white;
      border: none;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 0;
      box-shadow: 0 1px 3px rgba(245, 158, 11, 0.3);
      transition: all 0.2s ease;
      flex-shrink: 0;
    `;

    // Hover effect
    rotateBtn.addEventListener('mouseenter', () => {
        rotateBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
        rotateBtn.style.boxShadow = '0 2px 6px rgba(245, 158, 11, 0.45)';
        rotateBtn.style.transform = 'scale(1.08)';
    });
    rotateBtn.addEventListener('mouseleave', () => {
        rotateBtn.style.background = 'linear-gradient(135deg, #fbbf24, #f59e0b)';
        rotateBtn.style.boxShadow = '0 1px 3px rgba(245, 158, 11, 0.3)';
        rotateBtn.style.transform = 'scale(1)';
    });

    // Track if button should stay visible
    let buttonShouldStayVisible = false;

    // Click handler - insert text at cursor
    rotateBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Save editor reference and cursor position before click
        saveCursorPosition(editor);
    });

    rotateBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        buttonShouldStayVisible = true;
        const originalHTML = rotateBtn.innerHTML;
        rotateBtn.textContent = '…';
        rotateBtn.disabled = true;

        // Check if this is a post composer
        const isPost = isPostComposer(editor);

        if (isPost) {
            showToast({
                type: 'error',
                title: 'Not available',
                message: 'Rephrase is only available for comments.',
                duration: 5000
            });
            rotateBtn.innerHTML = originalHTML;
            rotateBtn.disabled = false;
            buttonShouldStayVisible = false;
            return;
        }

        // Get existing comment from editor
        const existingComment = editor.textContent || editor.innerText || '';

        if (!existingComment.trim()) {
            showToast({
                type: 'error',
                title: 'No comment found',
                message: 'Please write a comment first.',
                duration: 5000
            });
            rotateBtn.innerHTML = originalHTML;
            rotateBtn.disabled = false;
            buttonShouldStayVisible = false;
            return;
        }

        // Extract post content
        const postContent = extractPostContent(editor);
        if (!postContent) {
            showToast({
                type: 'error',
                title: 'Cannot find post',
                message: 'Unable to extract post content from LinkedIn.',
                duration: 5000
            });
            rotateBtn.innerHTML = originalHTML;
            rotateBtn.disabled = false;
            buttonShouldStayVisible = false;
            return;
        }

        // Capture references NOW before user scrolls
        const postContainer = editor.closest('div[role="listitem"]') ||
            editor.closest('[data-urn]') ||
            editor.closest('.feed-shared-update-v2') ||
            editor.closest('article') ||
            editor.closest('[componentkey^="commentBox-"]');
        const editorRef = editor;

        // Restore button quickly
        setTimeout(() => {
            rotateBtn.innerHTML = originalHTML;
            rotateBtn.disabled = false;
            buttonShouldStayVisible = false;
        }, 600);

        // Show generating toast
        const loadingToast = showToast({
            type: 'generating',
            title: 'Rephrasing comment…',
            message: 'You can keep scrolling — we\'ll notify you when it\'s ready.',
            duration: 0
        });

        // Fire API in background
        try {
            const rephrasedComment = await requestRephraseComment(postContent, existingComment);

            loadingToast.dismiss();

            // Build actions
            const actions = [];

            if (postContainer && postContainer.isConnected) {
                actions.push({
                    label: 'Scroll to Post',
                    icon: '📍',
                    onClick: () => {
                        postContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }

            actions.push({
                label: 'Copy',
                icon: '📋',
                onClick: () => {
                    navigator.clipboard.writeText(rephrasedComment).catch(() => {
                        const textarea = document.createElement('textarea');
                        textarea.value = rephrasedComment;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        textarea.remove();
                    });
                }
            });

            if (editorRef && editorRef.isConnected) {
                actions.push({
                    label: 'Paste',
                    icon: '✏️',
                    primary: true,
                    onClick: () => {
                        if (postContainer && postContainer.isConnected) {
                            postContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                        setTimeout(() => {
                            editorRef.focus();
                            clearEditorContent(editorRef);
                            insertAtCursor(rephrasedComment, editorRef);
                        }, 400);
                    }
                });
            }

            const previewText = rephrasedComment.length > 120
                ? rephrasedComment.substring(0, 120) + '…'
                : rephrasedComment;

            showToast({
                type: 'success',
                title: '✨ Comment rephrased!',
                message: previewText,
                duration: 20000,
                actions
            });

        } catch (error) {
            loadingToast.dismiss();

            console.error("Error rephrasing comment:", error);
            showToast({
                type: 'error',
                title: 'Rephrase failed',
                message: error?.message || 'Something went wrong. Please try again.',
                duration: 8000
            });
        }
    });

    // Insert button into the connectz action wrapper
    editor._connectzActionWrapper.appendChild(rotateBtn);

    // Show/hide button based on content
    function updateButtonVisibility() {
        // Rich text editors commonly leave zero-width spaces (\u200B, \uFEFF) even when visually empty.
        const cleanText = (editor.textContent || editor.innerText || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        const hasContent = cleanText !== '';
        const wrapper = editor._connectzActionWrapper;

        // Show if editor has content, and is not a post composer
        if (hasContent && !isPostComposer(editor)) {
            rotateBtn.style.display = 'inline-flex';
            if (wrapper) wrapper.style.display = 'inline-flex';
        } else {
            rotateBtn.style.display = 'none';
            // Also softly hide the wrapper if the plusBtn isn't actively displayed. 
            if (wrapper && !wrapper.querySelector('.connectz-plus-btn')) { // Simplify check
                wrapper.style.display = 'none';
            }
        }
    }

    // Give it a click listener to refocus the editor after clicking
    rotateBtn.addEventListener('mouseup', () => {
        setTimeout(() => {
            editor.focus();
        }, 100);
    });

    // Update visibility on text changes
    editor.addEventListener('input', updateButtonVisibility);
    editor.addEventListener('keyup', updateButtonVisibility); // Catch backspace/delete events that sometimes bypass input

    // Track cursor position when the editor is interacted with
    editor.addEventListener('focus', () => {
        saveCursorPosition(editor);
        updateButtonVisibility();
    });

    editor.addEventListener('click', () => {
        saveCursorPosition(editor);
        updateButtonVisibility();
    });

    // Also track on generic focus changes within the editor
    document.addEventListener('focusin', (e) => {
        if (e.target === editor || editor.contains(e.target)) {
            saveCursorPosition(editor);
        }
    });

    // Initial check
    updateButtonVisibility();
}

/**
 * Process all editors on the page to add buttons.
 * Uses stable selectors that work across LinkedIn DOM versions.
 */
export function processEditors() {
    // Build a set of editors from the emoji picker button siblings
    // Use closest() to reliably find the actual contenteditable, not just parentElement
    const editorsFromButton = [];
    const emojiButtons = document.querySelectorAll(
        'button[data-view-name="comment-emoji-picker"], ' +
        'button.comments-comment-box__emoji-picker-trigger, ' +
        'button[aria-label="Show Emoji Picker"], ' +
        'button[aria-label="Add an emoji"], ' +
        '.emoji-hoverable-trigger'
    );
    emojiButtons.forEach(button => {
        // Walk up to find the nearest contenteditable editor
        let editor = null;
        let current = button.parentElement;
        for (let i = 0; i < 15; i++) {
            if (!current) break;
            if (current.tagName === 'ARTICLE' || current.classList.contains('feed-shared-update-v2')) break;
            editor = current.querySelector('[contenteditable="true"][role="textbox"], .ql-editor');
            if (editor) break;
            current = current.parentElement;
        }
        if (editor) editorsFromButton.push(editor);
    });

    // Primary: use conteneditable="true" — stable across LinkedIn DOM versions.
    // DO NOT use `.ql-editor` alone — LinkedIn no longer uses Quill everywhere.
    const quillEditors = Array.from(document.querySelectorAll('.ql-editor'));
    const contentEditableEditors = Array.from(
        document.querySelectorAll('div[contenteditable="true"][role="textbox"]')
    );

    // Merge all sources, deduplicate by element reference
    const allEditors = [
        ...new Set([...quillEditors, ...contentEditableEditors, ...editorsFromButton])
    ];

    allEditors.forEach(editor => {
        if (!editor || !editor.isConnected) return; // skip detached nodes

        // Add + button initialization
        addPlusButton(editor);

        // Add rotate button initialization
        addRotateButton(editor);
        
        // Assert placement reliably on every tick
        if (editor._connectzActionWrapper) {
            let toolsContainer = null;
            let current = editor.parentElement;
            for (let i = 0; i < 15; i++) {
                if (!current) break;
                if (current.tagName === 'ARTICLE' || current.classList.contains('feed-shared-update-v2')) break;
                const emojiBtn = current.querySelector('button[aria-label="Show Emoji Picker"], button[aria-label="Share photo"], button[aria-label="Add an emoji"], button.comments-comment-box__emoji-picker-trigger');
                if (emojiBtn) {
                    toolsContainer = emojiBtn.parentElement;
                    break;
                }
                current = current.parentElement;
            }

            const editorWrapper =
                editor.closest('[data-testid="ui-core-tiptap-text-editor-wrapper"]') ||
                editor.closest('.comments-comment-box-comment__text-editor') ||
                editor.closest('.comments-comment-box__editor') ||
                editor.closest('.ql-container') ||
                editor.closest('form') ||
                editor.parentElement;

            const buttonContainer = toolsContainer || editorWrapper;
            const isNativePlacement = Boolean(toolsContainer);

            if (buttonContainer && !buttonContainer.contains(editor._connectzActionWrapper)) {
                if (editorWrapper && !isNativePlacement && getComputedStyle(editorWrapper).position === 'static') {
                    editorWrapper.style.position = 'relative';
                }
                
                editor._connectzActionWrapper.style.cssText = `
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 0;
                    margin-left: 8px;
                    ${isNativePlacement ? '' : 'position: absolute; right: 8px; top: 8px; z-index: 1000;'}
                `;
                buttonContainer.appendChild(editor._connectzActionWrapper);
            }
        }
    });
}
