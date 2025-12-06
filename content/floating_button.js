
/**
 * Floating button module for Connect Z
 */

/**
 * Get the visible post content from the viewport.
 * If multiple posts are visible, returns the one closest to the top.
 * @returns {string|null} The extracted post content or null.
 */
function getVisiblePostContent() {
    // Select all post containers
    const posts = document.querySelectorAll('.feed-shared-update-v2');

    let closestPost = null;
    let minDistance = Infinity;

    posts.forEach(post => {
        const rect = post.getBoundingClientRect();

        const isVisible = (
            rect.top < window.innerHeight &&
            rect.bottom > 0
        );

        if (isVisible) {
            const distance = Math.abs(rect.top);

            if (distance < minDistance) {
                minDistance = distance;
                closestPost = post;
            }
        }
    });

    if (!closestPost) return null;

    // Extract content from the closest post
    const postTextElement = closestPost.querySelector('.update-components-text') ||
        closestPost.querySelector('.update-components-update-v2__commentary');

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

    return text;
}

/**
 * Send message to background script
 */
function sendMessage(action, data) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action, ...data }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            if (!response || !response.success) {
                reject(new Error(response?.error || "Unknown error"));
                return;
            }
            resolve(response);
        });
    });
}

/**
 * Show the extracted content in a sidebar slider with generation tools.
 * @param {string} content 
 */
function showContentSidebar(content) {
    const floatingBtn = document.getElementById('connectz-floating-btn');
    if (floatingBtn) floatingBtn.style.display = 'none';

    // Check if sidebar already exists
    let sidebar = document.getElementById('connectz-content-sidebar');

    // If it exists, remove it to rebuild (easier than updating complex state)
    if (sidebar) {
        sidebar.remove();
    }

    // Create sidebar container
    sidebar = document.createElement('div');
    sidebar.id = 'connectz-content-sidebar';
    sidebar.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 400px;
        height: 100vh;
        background-color: white;
        box-shadow: -5px 0 15px rgba(0,0,0,0.1);
        z-index: 9998;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.3s ease-in-out;
        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Fira Sans", Ubuntu, Oxygen, "Oxygen Sans", Cantarell, "Droid Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Lucida Grande", Helvetica, Arial, sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 16px 20px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #f9fafb;
        flex-shrink: 0;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Connect Z Tools';
    title.style.cssText = `
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6b7280;
        padding: 0;
        line-height: 1;
    `;

    closeBtn.onclick = () => {
        sidebar.style.transform = 'translateX(100%)';
        setTimeout(() => {
            sidebar.remove();
            if (floatingBtn) floatingBtn.style.display = 'flex';
        }, 300);
    };

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Main Content Body (Scrollable)
    const body = document.createElement('div');
    body.className = 'connectz-sidebar-body';
    body.style.cssText = `
        padding: 20px;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 24px;
    `;

    // --- Section 1: Extracted Post Content ---
    const postSection = document.createElement('div');
    postSection.innerHTML = `
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #374151;">Current Post Context</h4>
        <div style="
            background-color: #f3f4f6; 
            padding: 12px; 
            border-radius: 8px; 
            font-size: 13px; 
            color: #4b5563; 
            max-height: 150px; 
            overflow-y: auto;
            white-space: pre-wrap;
            border: 1px solid #e5e7eb;
        ">${content}</div>
    `;
    body.appendChild(postSection);

    // --- Section 2: Generate Comment ---
    const commentSection = document.createElement('div');
    commentSection.innerHTML = `
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #374151;">Generate Comment</h4>
        <textarea id="connectz-comment-outline" placeholder="Optional: Enter comment outline or context..." style="
            width: 100%;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            margin-bottom: 10px;
            resize: vertical;
            min-height: 60px;
            box-sizing: border-box;
            font-family: inherit;
        "></textarea>
        <button id="connectz-gen-comment-btn" style="
            width: 100%;
            padding: 8px 16px;
            background-color: #0a66c2;
            color: white;
            border: none;
            border-radius: 20px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s;
            font-size: 14px;
        ">Generate Comment</button>
        <div id="connectz-comment-result" style="display: none; margin-top: 12px;">
            <div class="result-content" style="
                background-color: #f0fdf4;
                border: 1px solid #bbf7d0;
                padding: 12px;
                border-radius: 8px;
                font-size: 14px;
                color: #166534;
                white-space: pre-wrap;
                margin-bottom: 8px;
            "></div>
            <button class="copy-btn" style="
                padding: 6px 12px;
                background-color: white;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                color: #374151;
            ">Copy to Clipboard</button>
        </div>
    `;
    body.appendChild(commentSection);

    // --- Section 3: Generate Post ---
    const generatePostSection = document.createElement('div');
    generatePostSection.innerHTML = `
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #374151;">Generate New Post</h4>
        <textarea id="connectz-post-outline" placeholder="Enter rough post outline..." style="
            width: 100%;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            margin-bottom: 10px;
            resize: vertical;
            min-height: 80px;
            box-sizing: border-box;
            font-family: inherit;
        "></textarea>
        <button id="connectz-gen-post-btn" style="
            width: 100%;
            padding: 8px 16px;
            background-color: #0a66c2;
            color: white;
            border: none;
            border-radius: 20px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s;
            font-size: 14px;
        ">Generate Post</button>
        <div id="connectz-post-result" style="display: none; margin-top: 12px;">
            <div class="result-content" style="
                background-color: #eff6ff;
                border: 1px solid #bfdbfe;
                padding: 12px;
                border-radius: 8px;
                font-size: 14px;
                color: #1e40af;
                white-space: pre-wrap;
                margin-bottom: 8px;
            "></div>
            <button class="copy-btn" style="
                padding: 6px 12px;
                background-color: white;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                color: #374151;
            ">Copy to Clipboard</button>
        </div>
    `;
    body.appendChild(generatePostSection);

    sidebar.appendChild(header);
    sidebar.appendChild(body);
    document.body.appendChild(sidebar);

    // --- Event Listeners ---

    // Generate Comment Logic
    const genCommentBtn = sidebar.querySelector('#connectz-gen-comment-btn');
    const commentInput = sidebar.querySelector('#connectz-comment-outline');
    const commentResult = sidebar.querySelector('#connectz-comment-result');
    const commentResultContent = commentResult.querySelector('.result-content');
    const commentCopyBtn = commentResult.querySelector('.copy-btn');

    genCommentBtn.onclick = async () => {
        const outline = commentInput.value.trim();
        const originalBtnText = genCommentBtn.textContent;
        genCommentBtn.textContent = 'Generating...';
        genCommentBtn.disabled = true;
        commentResult.style.display = 'none';

        try {
            let result;
            if (outline) {
                // Rephrase logic
                const response = await sendMessage('rephraseComment', {
                    postContent: content,
                    existingComment: outline
                });
                result = response.comment;
            } else {
                // Generate logic
                const response = await sendMessage('generateComment', {
                    postContent: content
                });
                result = response.comment;
            }

            commentResultContent.textContent = result;
            commentResult.style.display = 'block';
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            genCommentBtn.textContent = originalBtnText;
            genCommentBtn.disabled = false;
        }
    };

    commentCopyBtn.onclick = () => {
        navigator.clipboard.writeText(commentResultContent.textContent).then(() => {
            const originalText = commentCopyBtn.textContent;
            commentCopyBtn.textContent = 'Copied!';
            setTimeout(() => commentCopyBtn.textContent = originalText, 2000);
        });
    };

    // Generate Post Logic
    const genPostBtn = sidebar.querySelector('#connectz-gen-post-btn');
    const postInput = sidebar.querySelector('#connectz-post-outline');
    const postResult = sidebar.querySelector('#connectz-post-result');
    const postResultContent = postResult.querySelector('.result-content');
    const postCopyBtn = postResult.querySelector('.copy-btn');

    genPostBtn.onclick = async () => {
        const roughContent = postInput.value.trim();
        if (!roughContent) {
            alert('Please enter a rough post outline.');
            return;
        }

        const originalBtnText = genPostBtn.textContent;
        genPostBtn.textContent = 'Generating...';
        genPostBtn.disabled = true;
        postResult.style.display = 'none';

        try {
            const response = await sendMessage('generatePost', {
                roughPostContent: roughContent
            });

            postResultContent.textContent = response.post;
            postResult.style.display = 'block';
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            genPostBtn.textContent = originalBtnText;
            genPostBtn.disabled = false;
        }
    };

    postCopyBtn.onclick = () => {
        navigator.clipboard.writeText(postResultContent.textContent).then(() => {
            const originalText = postCopyBtn.textContent;
            postCopyBtn.textContent = 'Copied!';
            setTimeout(() => postCopyBtn.textContent = originalText, 2000);
        });
    };

    // Trigger slide in animation
    requestAnimationFrame(() => {
        sidebar.style.transform = 'translateX(0)';
    });
}

/**
 * Initialize the floating button.
 */
export function initFloatingButton() {
    // Check if button already exists
    if (document.getElementById('connectz-floating-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'connectz-floating-btn';
    btn.textContent = 'cz';
    btn.title = 'Show Connect Z Tools';

    // Styles
    btn.style.cssText = `
        position: fixed;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background-color: black;
        color: #fbbf24; /* Yellow-ish color */
        border: 2px solid #fbbf24;
        font-weight: bold;
        font-size: 18px;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: sans-serif;
    `;

    // Hover effects
    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-50%) scale(1.1)';
        btn.style.boxShadow = '0 6px 8px rgba(0,0,0,0.4)';
    });

    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(-50%) scale(1)';
        btn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    });

    // Click handler
    btn.addEventListener('click', () => {
        const content = getVisiblePostContent();
        if (content) {
            showContentSidebar(content);
        } else {
            // Show a small toast or alert if no content found
            const toast = document.createElement('div');
            toast.textContent = 'No post content found in view';
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: #333;
                color: white;
                padding: 10px 20px;
                border-radius: 4px;
                z-index: 10002;
                font-size: 14px;
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    });

    document.body.appendChild(btn);
}
