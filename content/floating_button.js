
/**
 * Floating button module for Connect Z
 */

/**
 * Get the visible post content from the viewport.
 * If multiple posts are visible, returns the one closest to the top.
 * @returns {string|null} The extracted post content or null.
 */
function getVisiblePostContent() {
    // 1. Find all valid post text nodes
    const validTextNodes = Array.from(document.querySelectorAll(
        '.update-components-text, ' +
        '.update-components-update-v2__commentary, ' +
        '.feed-shared-text, ' +
        '[data-testid="expandable-text-box"]'
    )).filter(node => {
        // Exclude nodes that are inside a comment thread. 
        return !node.closest('[componentkey^="replaceableComment_"]') &&
               !node.closest('[componentkey*="urn:li:comment"]') &&
               !node.closest('.comments-comment-item');
    });

    if (validTextNodes.length === 0) return null;

    // 2. Sort geometrically by their top position to determine the vertical "domain" of each post
    validTextNodes.sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    let bestNode = null;
    let maxVisibleHeight = 0;

    for (let i = 0; i < validTextNodes.length; i++) {
        const node = validTextNodes[i];
        const nextNode = validTextNodes[i+1];
        
        const top = node.getBoundingClientRect().top;
        // Inferred domain of the post spans from its text node down to the next post's text node
        const bottom = nextNode ? Math.max(nextNode.getBoundingClientRect().top - 20, top + 10) : (top + 4000);
        
        const visibleTop = Math.max(top, 0);
        const visibleBottom = Math.min(bottom, window.innerHeight);
        const visibleHeight = visibleBottom - visibleTop;

        if (visibleHeight > maxVisibleHeight && visibleHeight > 0) {
            maxVisibleHeight = visibleHeight;
            bestNode = node;
        }
    }

    if (!bestNode) return null;

    // 3. Extract text from the single best matching node
    // Direct node extraction prevents the logic from traversing too far up the DOM and grouping 
    // multiple posts together on heavily minified LinkedIn feed iterations.
    const textSpan =
        bestNode.querySelector('span.break-words') ||
        bestNode.querySelector('span[dir="ltr"]') ||
        bestNode;

    if (!textSpan) return null;

    let fullText = textSpan.innerHTML || textSpan.innerText || textSpan.textContent;
    
    // Replace <br> tags with structural line breaks
    fullText = fullText.replace(/<br\s*\/?>/gi, '\n\n');
    
    // Parse through DOM to strip remaining HTML tags safely
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = fullText;
    fullText = tempDiv.textContent || tempDiv.innerText || fullText;

    if (!fullText.trim()) return null;

    // 4. Clean up formatting
    let text = fullText
        .replace(/\r\n|\r/g, '\n')     // normalize newlines
        .replace(/[\u00A0\u200B]/g, '') // remove invisible spaces
        .replace(/\n{3,}/g, '\n\n')  // Replace 3+ line breaks with double
        .replace(/\n\s+\n/g, '\n\n')
        .replace(/[ \t]+/g, ' ')       // Replace multiple spaces with single
        .replace(/\n /g, '\n')          // Remove spaces after line breaks
        .replace(/ \n/g, '\n')          // Remove spaces before line breaks
        .replace(/… more/g, "")
        .replace(/hashtag/g, '')
        .replace(/(#\w+)\n\s*\n(?=#\w+)/g, '$1\n')
        .replace(/([•👉])([^\n]+)\n\s*\n(?=[•👉])/g, '$1$2\n')
        .trim();
    return text || null;
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
        gap: 12px;
    `;

    // Icon
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icon.png');
    icon.style.cssText = `
        width: 40px;
        height: 40px;
        flex-shrink: 0;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Connect Z Tools';
    title.style.cssText = `
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
        flex: 1;
    `;

    // Close button
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
        flex-shrink: 0;
    `;

    closeBtn.onclick = () => {
        sidebar.style.transform = 'translateX(100%)';
        setTimeout(() => {
            sidebar.remove();
            if (floatingBtn) floatingBtn.style.display = 'flex';
        }, 300);
    };

    header.appendChild(icon);
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
            background-color: #1a1a2e;
            color: #FFD700;
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
            background-color: #1a1a2e;
            color: #FFD700;
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

    // --- Section 4: Sliding Tips ---
    const tipsData = [
        'Comment in the first 60 minutes for maximum reach.',
        '8–15 word comments perform better than long ones.',
        'End comments with a question to boost replies.',
        'Early comments help posts re-enter the feed.',
        'Consistent commenting beats posting once in a while.',
        'Strong first line = higher comment visibility.',
        'Treat every comment like micro-content.',
        'Daily engagement grows reach faster than daily posting.',
        'Relevant comments outperform generic praise.',
        'Smart comments build authority, not noise.'
    ];

    const tipsSection = document.createElement('div');
    tipsSection.innerHTML = `
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #374151;">Pro Tips</h4>
        <div id="connectz-tips-container" style="
            background-color: #FFD700;
            color: white;
            padding: 16px;
            border-radius: 8px;
            min-height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 14px;
            font-weight: 500;
            line-height: 1.5;
            position: relative;
            overflow: hidden;
        ">
            <div id="connectz-tip-text" style="transition: opacity 0.3s ease-in-out;"></div>
        </div>
    `;
    body.appendChild(tipsSection);

    // Tips functionality
    let currentTipIndex = 0;
    let tipsAutoScrollInterval = null;
    const tipsContainer = body.querySelector('#connectz-tips-container');
    const tipText = body.querySelector('#connectz-tip-text');

    function updateTipDisplay() {
        tipText.style.opacity = '0';
        setTimeout(() => {
            tipText.textContent = tipsData[currentTipIndex];
            tipText.style.opacity = '1';
        }, 150);
    }

    function startTipsAutoScroll() {
        if (tipsAutoScrollInterval) clearInterval(tipsAutoScrollInterval);
        tipsAutoScrollInterval = setInterval(() => {
            currentTipIndex = (currentTipIndex + 1) % tipsData.length;
            updateTipDisplay();
        }, 5000);
    }

    function stopTipsAutoScroll() {
        if (tipsAutoScrollInterval) clearInterval(tipsAutoScrollInterval);
    }

    tipsContainer.addEventListener('mouseenter', stopTipsAutoScroll);
    tipsContainer.addEventListener('mouseleave', startTipsAutoScroll);

    updateTipDisplay();
    startTipsAutoScroll();

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

    // --- Section 5: Analytics & Progress ---
    const analyticsSection = document.createElement('div');
    analyticsSection.innerHTML = `
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #374151;">Your Progress</h4>
        <div id="connectz-analytics-container" style="min-height: 100px;">
            <div style="text-align: center; color: #6b7280; font-size: 13px; padding: 20px;">Loading stats...</div>
        </div>
    `;
    body.appendChild(analyticsSection);

    // Load and render analytics
    loadSidebarAnalytics(analyticsSection.querySelector('#connectz-analytics-container'));

    // Trigger slide in animation
    requestAnimationFrame(() => {
        sidebar.style.transform = 'translateX(0)';
    });
}

/**
 * Load and render analytics data into the provided container.
 */
async function loadSidebarAnalytics(container) {
    try {
        const [weeklyStatsRes, badgesStatsRes] = await Promise.all([
            sendMessage('getWeeklyStats'),
            sendMessage('getBadgesStats')
        ]);

        if (!weeklyStatsRes.success || !badgesStatsRes.success) {
            throw new Error(weeklyStatsRes.error || badgesStatsRes.error || "Stats fetch failed");
        }

        const weeklyStats = weeklyStatsRes.data;
        const badgesStats = badgesStatsRes.data;

        container.innerHTML = ''; // Clear loading state

        // 1. Stats Row
        if (weeklyStats) {
            const statsRow = document.createElement('div');
            statsRow.style.cssText = `display: flex; gap: 8px; margin-bottom: 12px;`;

            const createStatCard = (label, value, isHighlight) => `
                <div style="
                    flex: 1; 
                    background: ${isHighlight ? '#FFFBEB' : '#F9FAFB'}; 
                    border: 1px solid ${isHighlight ? '#FCD34D' : '#E5E7EB'}; 
                    border-radius: 6px; 
                    padding: 8px; 
                    text-align: center;
                ">
                    <div style="font-size: 16px; font-weight: 700; color: #111827;">${value}</div>
                    <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; margin-top: 2px;">${label}</div>
                </div>
            `;

            statsRow.innerHTML = `
                ${createStatCard('Today', weeklyStats.today_count || 0, false)}
                ${createStatCard('Week', weeklyStats.weekly_total || 0, false)}
                ${createStatCard('Streak', (weeklyStats.streak || 0) + '🔥', true)}
            `;
            container.appendChild(statsRow);
        }

        // 2. Weekly Chart
        if (weeklyStats && weeklyStats.daily_breakdown) {
            const chartContainer = document.createElement('div');
            chartContainer.style.cssText = `
                margin-bottom: 12px; 
                background: #F9FAFB; 
                border: 1px solid #E5E7EB; 
                border-radius: 8px; 
                padding: 12px;
            `;

            const chartLabel = document.createElement('div');
            chartLabel.textContent = 'Weekly Activity';
            chartLabel.style.cssText = `font-size: 11px; font-weight: 600; color: #4B5563; margin-bottom: 8px;`;
            chartContainer.appendChild(chartLabel);

            const barsContainer = document.createElement('div');
            barsContainer.style.cssText = `
                display: flex; 
                align-items: flex-end; 
                justify-content: space-between; 
                height: 60px; 
                gap: 4px;
            `;

            const maxVal = Math.max(...weeklyStats.daily_breakdown.map(d => d.count)) || 1;

            weeklyStats.daily_breakdown.forEach(day => {
                const height = Math.max((day.count / maxVal) * 100, 10); // Min 10% height
                const barWrapper = document.createElement('div');
                barWrapper.style.cssText = `flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end;`;
                const dateObj = new Date(day.date);
                const label = isNaN(dateObj) ? day.date : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                barWrapper.innerHTML = `
                    <div title="${day.date}: ${day.count}" style="
                        width: 70%; 
                        height: ${height}%; 
                        background-color: #FFD700; 
                        border-radius: 3px 3px 0 0;
                        transition: height 0.3s;
                    "></div>
                    <div style="font-size: 8px; color: #9CA3AF; margin-top: 4px;">${label}</div>
                `;
                barsContainer.appendChild(barWrapper);
            });

            chartContainer.appendChild(barsContainer);
            container.appendChild(chartContainer);
        }

        // 3. Badges (Mini)
        if (badgesStats && badgesStats.earned_badges && badgesStats.earned_badges.length > 0) {
            const badgesContainer = document.createElement('div');
            badgesContainer.style.cssText = `margin-bottom: 12px;`;

            const badgesHeader = document.createElement('div');
            badgesHeader.textContent = 'Recent Badges';
            badgesHeader.style.cssText = `font-size: 11px; font-weight: 600; color: #4B5563; margin-bottom: 6px;`;
            badgesContainer.appendChild(badgesHeader);

            const badgesRow = document.createElement('div');
            badgesRow.style.cssText = `display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;`;

            badgesStats.earned_badges.forEach(badge => {
                const badgeEl = document.createElement('div');
                badgeEl.style.cssText = `
                    flex-shrink: 0;
                    background: #F0FDF4; 
                    border: 1px solid #BBF7D0; 
                    border-radius: 6px; 
                    padding: 6px 10px; 
                    font-size: 10px; 
                    display: flex; 
                    align-items: center; 
                    gap: 6px;
                `;
                badgeEl.innerHTML = `<span>${badge.icon || '🏆'}</span> <span>${badge.name}</span>`;
                badgesRow.appendChild(badgeEl);
            });
            badgesContainer.appendChild(badgesRow);
            container.appendChild(badgesContainer);
        }

        // 4. Progress Bar
        if (badgesStats && badgesStats.progress_to_next_badge) {
            const nextBadge = badgesStats.progress_to_next_badge;
            const progressContainer = document.createElement('div');
            progressContainer.style.cssText = `
                background: white; 
                border: 1px solid #E5E7EB; 
                border-radius: 8px; 
                padding: 10px;
            `;

            progressContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                    <span style="color: #4B5563;">Next: <strong>${nextBadge.name}</strong></span>
                    <span style="color: #6B7280;">${nextBadge.percentage}%</span>
                </div>
                <div style="height: 6px; background: #E5E7EB; border-radius: 3px; overflow: hidden;">
                    <div style="width: ${nextBadge.percentage}%; height: 100%; background: #10B981;"></div>
                </div>
            `;
            container.appendChild(progressContainer);
        }

    } catch (e) {
        console.error("Analytics load error:", e);
        container.innerHTML = '';

        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = "color: #EF4444; font-size: 13px; text-align: center; line-height: 1.5; padding: 10px;";

        let errorText = e.message || "Failed to load stats.";
        // Parse URLs into native links
        errorText = errorText.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: #3B82F6; text-decoration: underline;">$1</a>');
        errorMsg.innerHTML = errorText + " <br><br>";

        const retryBtn = document.createElement('button');
        retryBtn.textContent = "Retry";
        retryBtn.style.cssText = "background:none; border:none; color:#6B7280; text-decoration:underline; cursor:pointer;";
        retryBtn.onclick = () => {
            container.innerHTML = '<div style="text-align: center; color: #6b7280; font-size: 13px; padding: 20px;">Loading stats...</div>';
            loadSidebarAnalytics(container);
        };

        errorMsg.appendChild(retryBtn);
        container.appendChild(errorMsg);
    }
}

// Only show the floating button if we detect we're likely in a feed context (where posts are present) - This is added because linkedin sometimes opens the feed page inside iframes. We don't want to show the button twice (in the iframe and the parent)
function isLikelyFeedContext() {
    return Boolean(
        document.querySelector(
            '[data-urn], .feed-shared-update-v2, div[role="listitem"], article[role="article"], div[role="article"], div[contenteditable="true"][role="textbox"], [contenteditable="true"]'
        )
    );
}

/**
 * Initialize the floating button.
 */
export function initFloatingButton() {
    if (!isLikelyFeedContext()) return;

    // Check if button already exists
    if (document.getElementById('connectz-floating-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'connectz-floating-btn';
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icon.png');
    icon.style.width = '24px';
    icon.style.height = '24px';
    icon.style.pointerEvents = 'none'; // Prevent dragging
    btn.appendChild(icon);
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
        border: 2px solid #fbbf24;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
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
            toast.textContent = 'Go to Feed and scroll to a post to use Connect Z tools.';
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
