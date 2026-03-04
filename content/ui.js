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
    // Find key containers — use stable selectors that work across LinkedIn DOM versions
    const editorWrapper =
        editor.closest('.comments-comment-box-comment__text-editor') ||
        editor.closest('.comments-comment-box__editor') ||
        editor.closest('.ql-container') ||
        editor.closest('form') ||
        editor.parentElement;
    const flexContainer = editor.closest('.display-flex.flex-wrap');
    const buttonContainer = flexContainer || editorWrapper;
    const isFlexPlacement = Boolean(flexContainer);

    // Ensure the wrapper has relative positioning so absolute buttons render correctly
    if (editorWrapper && getComputedStyle(editorWrapper).position === 'static') {
        editorWrapper.style.position = 'relative';
    }

    if (!buttonContainer) return;

    // Create + button (one per editor)
    const plusBtn = document.createElement('button');
    plusBtn.className = 'connectz-plus-btn';
    plusBtn.type = 'button';
    plusBtn.innerHTML = '+';

    // Set title based on editor type
    const isPost = isPostComposer(editor);
    plusBtn.title = isPost ? 'Generate post from rough content' : 'Generate comment from post';

    const baseStyles = `
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: #0077b5;
    color: white;
    border: none;
    cursor: pointer;
    font-size: 18px;
    font-weight: bold;
    display: none;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: background-color 0.2s;
  `;

    plusBtn.style.cssText = isFlexPlacement
        ? `
      ${baseStyles}
      position: static;
      margin: 5px 8px;
      align-self: flex-start;
    `
        : `
      ${baseStyles}
      position: absolute;
      right: 10px;
      top: 10px;
      z-index: 1000;
    `;

    // Hover effect
    plusBtn.addEventListener('mouseenter', () => {
        plusBtn.style.backgroundColor = '#005885';
    });
    plusBtn.addEventListener('mouseleave', () => {
        plusBtn.style.backgroundColor = '#0077b5';
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
        const originalLabel = plusBtn.textContent;
        plusBtn.textContent = '…';
        plusBtn.disabled = true;

        // Check if this is a post composer or comment box
        const isPost = isPostComposer(editor);

        // Capture references NOW before the user scrolls away
        const postContainer = editor.closest('[data-urn]') ||
            editor.closest('.feed-shared-update-v2') ||
            editor.closest('article');
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
                plusBtn.textContent = originalLabel || '+';
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
                plusBtn.textContent = originalLabel || '+';
                plusBtn.disabled = false;
                buttonShouldStayVisible = false;
                return;
            }
        }

        // Show brief loading indication then restore button
        setTimeout(() => {
            plusBtn.textContent = originalLabel || '+';
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

    // Insert button into chosen container
    buttonContainer.appendChild(plusBtn);

    // Show/hide button based on focus
    function updateButtonVisibility() {
        const isFocused = document.activeElement === editor ||
            editor.contains(document.activeElement);

        // Show if editor is focused or button should stay visible
        if (isFocused || buttonShouldStayVisible) {
            plusBtn.style.display = isFlexPlacement ? 'inline-flex' : 'flex';
        } else {
            plusBtn.style.display = 'none';
        }
    }

    // Listen for focus events
    editor.addEventListener('focus', () => {
        saveCursorPosition(editor);
        buttonShouldStayVisible = false;
        updateButtonVisibility();
    });

    editor.addEventListener('blur', (e) => {
        // Don't hide immediately - allow time for button click
        setTimeout(() => {
            if (document.activeElement !== plusBtn &&
                document.activeElement !== editor &&
                !buttonShouldStayVisible) {
                updateButtonVisibility();
            }
        }, 200);
    });

    editor.addEventListener('click', () => {
        saveCursorPosition(editor);
        buttonShouldStayVisible = false;
        updateButtonVisibility();
    });

    // Keep button visible when interacting with it
    plusBtn.addEventListener('mouseenter', () => {
        buttonShouldStayVisible = true;
        plusBtn.style.display = 'flex';
    });

    plusBtn.addEventListener('mouseleave', () => {
        buttonShouldStayVisible = false;
        // Only hide if editor is not focused
        if (document.activeElement !== editor &&
            !editor.contains(document.activeElement)) {
            updateButtonVisibility();
        }
    });

    // Keep visible during click
    plusBtn.addEventListener('mousedown', () => {
        buttonShouldStayVisible = true;
    });

    plusBtn.addEventListener('mouseup', () => {
        // After click, refocus editor to keep button visible
        setTimeout(() => {
            editor.focus();
            buttonShouldStayVisible = false;
        }, 100);
    });

    // Initial check
    updateButtonVisibility();

    // Also check on any focus change
    document.addEventListener('focusin', (e) => {
        if (e.target === editor || editor.contains(e.target)) {
            saveCursorPosition(editor);
            buttonShouldStayVisible = false;
            updateButtonVisibility();
        }
    });
}

/**
 * Create and add the rotate button to the editor.
 * @param {HTMLElement} editor 
 */
export function addRotateButton(editor) {
    // Find key containers — use stable selectors that work across LinkedIn DOM versions
    const editorWrapper =
        editor.closest('.comments-comment-box-comment__text-editor') ||
        editor.closest('.comments-comment-box__editor') ||
        editor.closest('.ql-container') ||
        editor.closest('form') ||
        editor.parentElement;
    const flexContainer = editor.closest('.display-flex.flex-wrap');
    const buttonContainer = flexContainer || editorWrapper;
    const isFlexPlacement = Boolean(flexContainer);

    // Ensure the wrapper has relative positioning so absolute buttons render correctly
    if (editorWrapper && getComputedStyle(editorWrapper).position === 'static') {
        editorWrapper.style.position = 'relative';
    }

    if (!buttonContainer) return;

    // Create rotate button (one per editor)
    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'connectz-rotate-btn';
    rotateBtn.type = 'button';
    rotateBtn.innerHTML = '↻';

    // Set title 
    rotateBtn.title = 'Rephrase existing comment';

    const baseStyles = `
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: #0077b5;
    color: white;
    border: none;
    cursor: pointer;
    font-size: 18px;
    font-weight: bold;
    display: none;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: background-color 0.2s;
  `;

    rotateBtn.style.cssText = isFlexPlacement
        ? `
      ${baseStyles}
      position: static;
      margin: 5px 8px;
      align-self: flex-start;
    `
        : `
      ${baseStyles}
      position: absolute;
      right: 50px;
      top: 10px;
      z-index: 1000;
    `;

    // Hover effect
    rotateBtn.addEventListener('mouseenter', () => {
        rotateBtn.style.backgroundColor = '#005885';
    });
    rotateBtn.addEventListener('mouseleave', () => {
        rotateBtn.style.backgroundColor = '#0077b5';
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
        const originalLabel = rotateBtn.textContent;
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
            rotateBtn.textContent = originalLabel || '↻';
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
            rotateBtn.textContent = originalLabel || '↻';
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
            rotateBtn.textContent = originalLabel || '↻';
            rotateBtn.disabled = false;
            buttonShouldStayVisible = false;
            return;
        }

        // Capture references NOW before user scrolls
        const postContainer = editor.closest('[data-urn]') ||
            editor.closest('.feed-shared-update-v2') ||
            editor.closest('article');
        const editorRef = editor;

        // Restore button quickly
        setTimeout(() => {
            rotateBtn.textContent = originalLabel || '↻';
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

    // Insert button into chosen container
    buttonContainer.appendChild(rotateBtn);

    // Show/hide button based on focus and content
    function updateButtonVisibility() {
        const isFocused = document.activeElement === editor ||
            editor.contains(document.activeElement);
        const hasContent = (editor.textContent || editor.innerText || '').trim() !== '';

        // Show if editor is focused, has content, and is not a post composer
        if ((isFocused || buttonShouldStayVisible) && hasContent && !isPostComposer(editor)) {
            rotateBtn.style.display = isFlexPlacement ? 'inline-flex' : 'flex';
        } else {
            rotateBtn.style.display = 'none';
        }
    }

    // Listen for focus and input events
    editor.addEventListener('focus', () => {
        saveCursorPosition(editor);
        buttonShouldStayVisible = false;
        updateButtonVisibility();
    });

    editor.addEventListener('blur', (e) => {
        // Don't hide immediately - allow time for button click
        setTimeout(() => {
            if (document.activeElement !== rotateBtn &&
                document.activeElement !== editor &&
                !buttonShouldStayVisible) {
                updateButtonVisibility();
            }
        }, 200);
    });

    editor.addEventListener('input', updateButtonVisibility);

    editor.addEventListener('click', () => {
        saveCursorPosition(editor);
        buttonShouldStayVisible = false;
        updateButtonVisibility();
    });

    // Keep button visible when interacting with it
    rotateBtn.addEventListener('mouseenter', () => {
        buttonShouldStayVisible = true;
        rotateBtn.style.display = 'flex';
    });

    rotateBtn.addEventListener('mouseleave', () => {
        buttonShouldStayVisible = false;
        // Only hide if editor is not focused
        if (document.activeElement !== editor &&
            !editor.contains(document.activeElement)) {
            updateButtonVisibility();
        }
    });

    // Keep visible during click
    rotateBtn.addEventListener('mousedown', () => {
        buttonShouldStayVisible = true;
    });

    rotateBtn.addEventListener('mouseup', () => {
        // After click, refocus editor to keep button visible
        setTimeout(() => {
            editor.focus();
            buttonShouldStayVisible = false;
        }, 100);
    });

    // Initial check
    updateButtonVisibility();

    // Also check on any focus change
    document.addEventListener('focusin', (e) => {
        if (e.target === editor || editor.contains(e.target)) {
            saveCursorPosition(editor);
            buttonShouldStayVisible = false;
            updateButtonVisibility();
        }
    });
}

/**
 * Process all editors on the page to add buttons.
 * Uses stable selectors that work across LinkedIn DOM versions.
 */
export function processEditors() {
    // Build a set of editors from the emoji picker button siblings
    // Use closest() to reliably find the actual contenteditable, not just parentElement
    const editorsFromButton = [];
    const emojiButtons = document.querySelectorAll('button[data-view-name="comment-emoji-picker"]');
    emojiButtons.forEach(button => {
        // Walk up to find the nearest contenteditable editor
        const editor =
            button.closest('[contenteditable="true"]') ||
            button.closest('.comments-comment-box')?.querySelector('[contenteditable="true"]') ||
            button.parentElement?.querySelector('[contenteditable="true"]');
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

        // Check if we've already processed this editor
        if (editor.dataset.connectzProcessed) return;

        // Mark as processed
        editor.dataset.connectzProcessed = 'true';

        // Add + button
        addPlusButton(editor);

        // Add rotate button
        addRotateButton(editor);
    });
}
