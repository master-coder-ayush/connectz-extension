# Content Scripts

## Overview

Content scripts are injected into LinkedIn pages and handle DOM manipulation, UI elements, and user interactions.

## Files

### `content/main.js`

Entry point for content scripts. Handles initialization and LinkedIn's soft navigation.

**Key Functions:**

#### Bootstrap
```javascript
// content/main.js:45-60
function bootstrap(reason = 'init') {
    try {
        injectToastStyles();
    } catch (error) { console.warn('Toast style inject failed:', error); }

    try {
        initFloatingButton();
    } catch (error) { console.warn('Floating button init failed:', error); }

    ensureObserver();
    safeProcessEditors();
}
```

#### Soft Navigation Detection
```javascript
// content/main.js:82-117
function onSoftNavigation() {
    setTimeout(() => {
        // Reset processed state
        document.querySelectorAll('[data-connectz-processed]').forEach(el => {
            delete el.dataset.connectzProcessed;
        });
        bootstrap('soft-navigation');
    }, 500);
}

// Patch history.pushState
const _originalPushState = history.pushState.bind(history);
history.pushState = function (...args) {
    _originalPushState(...args);
    onSoftNavigation();
};

// Patch history.replaceState
const _originalReplaceState = history.replaceState.bind(history);
history.replaceState = function (...args) {
    _originalReplaceState(...args);
    onSoftNavigation();
};

// Handle browser back/forward
window.addEventListener('popstate', onSoftNavigation);

// Fallback: URL change detection
setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        onSoftNavigation();
    }
}, 800);
```

### `content/ui.js`

Handles editor detection and button UI injection.

**Key Functions:**

#### `addPlusButton()`
Adds a yellow gradient + button to editors for generating content.

```javascript
// content/ui.js:140-389
export function addPlusButton(editor) {
    const plusBtn = document.createElement('button');
    plusBtn.className = 'connectz-plus-btn';
    plusBtn.innerHTML = `<svg width="14" height="14" ...><path d="M7 1v12M1 7h12" .../></svg>`;
    
    plusBtn.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        color: white;
        border: none;
        cursor: pointer;
    `;

    plusBtn.addEventListener('click', async (e) => {
        const isPost = isPostComposer(editor);
        
        if (isPost) {
            const roughPostContent = extractRoughPostContent(editor);
            if (!roughPostContent) {
                showToast({ type: 'error', title: 'No content found' });
                return;
            }
            generatedText = await requestGeneratedPost(roughPostContent);
        } else {
            const postContent = extractPostContent(editor);
            generatedText = await requestGeneratedComment(postContent);
        }

        // Show success toast with actions
        showToast({
            type: 'success',
            title: isPost ? '✨ Post generated!' : '✨ Comment generated!',
            message: previewText,
            duration: 20000,
            actions: [
                { label: 'Copy', icon: '📋', onClick: () => navigator.clipboard.writeText(generatedText) },
                { label: 'Paste', icon: '✏️', primary: true, onClick: () => { insertAtCursor(generatedText, editorRef); } }
            ]
        });
    });
}
```

#### `addRotateButton()`
Adds a rotate/rephrase button for existing comments.

```javascript
// content/ui.js:395-665
export function addRotateButton(editor) {
    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'connectz-rotate-btn';
    rotateBtn.title = 'Rephrase existing comment';
    
    rotateBtn.addEventListener('click', async (e) => {
        const existingComment = editor.textContent;
        const postContent = extractPostContent(editor);
        
        const rephrasedComment = await requestRephraseComment(postContent, existingComment);
        
        showToast({
            type: 'success',
            title: '✨ Comment rephrased!',
            message: previewText,
            actions: [
                { label: 'Copy', icon: '📋', onClick: () => navigator.clipboard.writeText(rephrasedComment) },
                { label: 'Paste', icon: '✏️', primary: true, onClick: () => { insertAtCursor(rephrasedComment, editorRef); } }
            ]
        });
    });

    // Visibility toggle based on content
    function updateButtonVisibility() {
        const cleanText = (editor.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        const hasContent = cleanText !== '';
        
        if (hasContent && !isPostComposer(editor)) {
            rotateBtn.style.display = 'inline-flex';
        } else {
            rotateBtn.style.display = 'none';
        }
    }

    editor.addEventListener('input', updateButtonVisibility);
    editor.addEventListener('focus', updateButtonVisibility);
}
```

#### `processEditors()`
Finds all editors on the page and attaches buttons.

```javascript
// content/ui.js:671-798
export function processEditors() {
    // Find editors from emoji button siblings
    const emojiButtons = document.querySelectorAll(
        'button[data-view-name="comment-emoji-picker"], ' +
        'button.comments-comment-box__emoji-picker-trigger, ' +
        'button[aria-label="Show Emoji Picker"], ' +
        'button[aria-label="Add an emoji"]'
    );

    // Also find contenteditable and Quill editors
    const contentEditableEditors = document.querySelectorAll(
        'div[contenteditable="true"][role="textbox"]'
    );
    const quillEditors = document.querySelectorAll('.ql-editor');

    const allEditors = [...new Set([...quillEditors, ...contentEditableEditors])];

    allEditors.forEach(editor => {
        // Skip messaging and reply boxes
        const isMessageEditor = window.location.pathname.startsWith('/messaging') || 
                                editor.closest('.msg-form');
        
        if (!isReplyToComment && !isMessageEditor) {
            addPlusButton(editor);
            addRotateButton(editor);
        }
    });
}
```

### `content/dom.js`

DOM manipulation utilities for editors.

**Key Functions:**

#### `isPostComposer()`
```javascript
// content/dom.js:12-34
export function isPostComposer(editor) {
    const container = editor.closest('.share-box-v2__modal') ||
        editor.closest('.share-box') ||
        editor.closest('.share-creation-state__text-editor') ||
        editor.closest('[data-test-id="share-box"]') ||
        editor.closest('.feed-share-update-v2');

    const isInComment = editor.closest('[componentkey^="commentBox-"]') ||
        editor.closest('.comments-comment-box');

    return container && !isInComment;
}
```

#### `extractRoughPostContent()`
```javascript
// content/dom.js:41-52
export function extractRoughPostContent(editor) {
    try {
        const text = editor.textContent || editor.innerText || '';
        return text.trim();
    } catch (error) {
        console.error('Error extracting rough post content:', error);
        return null;
    }
}
```

#### `extractPostContent()`
```javascript
// content/dom.js:96-200
export function extractPostContent(editor) {
    // Strategy: Geometric lookup for closest post above editor
    const textNodes = Array.from(document.querySelectorAll(
        '.update-components-text, ' +
        '.update-components-update-v2__commentary, ' +
        '.feed-shared-text'
    )).filter(node => !node.closest('[componentkey^="replaceableComment_"]'));

    // Find closest node above the editor
    // ... (geometrical calculation)
    
    // Fallback: Hierarchical lookup via DOM traversal
    const postContainer = editor.closest('div[role="listitem"]') ||
        editor.closest('.feed-shared-update-v2') ||
        editor.closest('article');
    
    const closestTextNode = postContainer.querySelector(
        '[data-testid="expandable-text-box"]' ||
        '.update-components-text'
    );
    
    return text || null;
}
```

#### `insertAtCursor()`
```javascript
// content/dom.js:207-264
export function insertAtCursor(text, editor) {
    const targetEditor = editor || document.activeElement.closest('.ql-editor');
    targetEditor.focus();

    const sel = window.getSelection();
    let range = savedRange?.cloneRange() || sel.getRangeAt(0);

    const newNode = document.createTextNode(text);
    range.insertNode(newNode);

    // Move cursor after inserted text
    range.setStartAfter(newNode);
    range.setEndAfter(newNode);
    sel.removeAllRanges();
    sel.addRange(range);

    // Trigger editor updates
    targetEditor.dispatchEvent(new Event('input', { bubbles: true }));
    targetEditor.dispatchEvent(new Event('change', { bubbles: true }));
}
```

### `content/floating_button.js`

Floating button and sidebar UI.

**Key Functions:**

#### `initFloatingButton()`
```javascript
// content/floating_button.js:826-903
export function initFloatingButton() {
    if (window.top !== window.self) return; // Only main frame
    if (!isLikelyFeedContext()) return;

    const btn = document.createElement('button');
    btn.id = 'connectz-floating-btn';
    
    btn.style.cssText = `
        position: fixed;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background-color: black;
        border: 2px solid #fbbf24;
        z-index: 9999;
    `;

    btn.addEventListener('click', () => {
        const content = getVisiblePostContent();
        if (content) {
            showContentSidebar(content);
        }
    });

    document.body.appendChild(btn);
}
```

#### `getVisiblePostContent()`
```javascript
// content/floating_button.js:20-102
function getVisiblePostContent() {
    const validTextNodes = Array.from(document.querySelectorAll(
        '.update-components-text, ' +
        '.update-components-update-v2__commentary, ' +
        '.feed-shared-text'
    )).filter(node => !node.closest('.comments-comment-item'));

    // Sort by position and find most visible
    validTextNodes.sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    
    // Find node with max visible height
    let bestNode = null;
    let maxVisibleHeight = 0;

    // Extract and clean text
    const textSpan = bestNode.querySelector('span.break-words') || bestNode;
    let fullText = textSpan.innerHTML || textSpan.innerText;
    
    // Clean formatting
    return fullText.replace(/<br\s*\/?>/gi, '\n\n')
        .replace(/\r\n|\r/g, '\n')
        .replace(/[\u00A0\u200B]/g, '')
        .trim();
}
```

### `content/toast.js`

Toast notification system.

**Key Functions:**

#### `showToast()`
```javascript
// content/toast.js:294-442
export function showToast({ type = 'info', title, message = '', duration = 15000, actions = [] }) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    
    const iconMap = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
        generating: '⟳'
    };

    toast.className = `connectz-toast connectz-toast--${type}`;
    toast.innerHTML = `
        <div class="connectz-toast__header">
            <div class="connectz-toast__icon">${iconMap[type]}</div>
            <div class="connectz-toast__title">${escapeHTML(title)}</div>
            <button class="connectz-toast__close">&times;</button>
        </div>
        <div class="connectz-toast__body">
            <div class="connectz-toast__message">${escapeHTML(message)}</div>
        </div>
    `;

    // Auto-dismiss with progress bar
    // Hover to pause
    // Action buttons
    
    return { dismiss: () => dismissToast(toast), element: toast };
}
```