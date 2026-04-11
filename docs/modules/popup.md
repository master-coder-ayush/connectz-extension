# Popup

## Overview

The browser action popup provides a standalone interface for content generation without visiting LinkedIn. It includes navigation, generation logic, and analytics views.

## Files

### `popup/main.js`

Entry point for the popup. Handles initialization and login status display.

**Key Functions:**

#### `updateStatus()`
```javascript
// popup/main.js:27-71
async function updateStatus() {
    const currentTab = await getCurrentTab();
    const isOnLinkedIn = isLinkedInUrl(currentTab?.url);

    chrome.storage.local.get("logged_in", async ({ logged_in }) => {
        if (logged_in) {
            featuresContainer.classList.remove('hidden');
            
            // Show LinkedIn warning if not on LinkedIn
            if (!isOnLinkedIn) {
                linkedinWarning.classList.remove('hidden');
                openLinkedInBtn.classList.remove('hidden');
            }
        } else {
            loginContainer.classList.remove('hidden');
            loginBtn.onclick = () => {
                chrome.tabs.create({ url: baseUrl });
            };
        }
    });
}
```

#### `isLinkedInUrl()`
```javascript
// popup/main.js:8-16
function isLinkedInUrl(url) {
    if (!url) return false;
    try {
        const urlObj = new URL(url);
        return urlObj.hostname === 'www.linkedin.com' || urlObj.hostname === 'linkedin.com';
    } catch (e) {
        return false;
    }
}
```

### `popup/navigation.js`

View navigation within the popup.

**Key Functions:**

#### `switchView()`
```javascript
// popup/navigation.js:13-37
export function switchView(viewName) {
    // Hide all views
    mainMenu.classList.add('hidden');
    generatePostView.classList.add('hidden');
    generateCommentView.classList.add('hidden');
    analyticsView.classList.add('hidden');

    // Show requested view
    if (viewName === 'generatePostView') {
        generatePostView.classList.remove('hidden');
    } else if (viewName === 'generateCommentView') {
        generateCommentView.classList.remove('hidden');
    } else if (viewName === 'analyticsView') {
        analyticsView.classList.remove('hidden');
    } else {
        mainMenu.classList.remove('hidden');
    }

    // Save state
    chrome.storage.local.set({ last_view: viewName });

    // Dispatch event for other modules
    document.dispatchEvent(new CustomEvent('viewChanged', { detail: { viewName } }));
}
```

#### `initNavigation()`
```javascript
// popup/navigation.js:42-79
export function initNavigation() {
    document.getElementById('goToGeneratePostBtn').addEventListener('click', () => {
        switchView('generatePostView');
    });

    document.getElementById('goToGenerateCommentBtn').addEventListener('click', () => {
        switchView('generateCommentView');
    });

    document.getElementById('goToAnalyticsBtn').addEventListener('click', () => {
        switchView('analyticsView');
    });

    // Back buttons
    document.getElementById('backFromPostBtn').addEventListener('click', () => switchView('mainMenu'));
    document.getElementById('backFromCommentBtn').addEventListener('click', () => switchView('mainMenu'));
    document.getElementById('backFromAnalyticsBtn').addEventListener('click', () => switchView('mainMenu'));

    // Restore last view
    chrome.storage.local.get(['last_view'], (result) => {
        if (validViews.includes(result.last_view)) {
            switchView(result.last_view);
        }
    });
}
```

### `popup/logic.js`

Generation logic for popup views.

**Key Functions:**

#### Post Generation
```javascript
// popup/logic.js:14-50
generatePostBtn.addEventListener('click', () => {
    const content = roughPostContent.value.trim();
    if (!content) {
        alert('Please enter a rough outline first.');
        return;
    }

    generatePostBtn.disabled = true;
    generatePostBtn.textContent = 'Generating...';

    chrome.runtime.sendMessage(
        { action: 'generatePost', roughPostContent: content },
        (response) => {
            generatePostBtn.disabled = false;
            generatePostBtn.textContent = 'Generate Post';

            if (response && response.success) {
                generatedPostOutput.textContent = response.post;
                postResultContainer.classList.remove('hidden');
            } else {
                alert('Error: ' + (response?.error || 'Unknown error'));
            }
        }
    );
});
```

#### Comment Generation
```javascript
// popup/logic.js:60-95
generateCommentBtn.addEventListener('click', () => {
    const postContent = postContentForComment.value.trim();
    const existingComment = optionalComment.value.trim();

    let action = 'generateComment';
    let payload = { postContent };

    // If optional comment provided, use rephrase
    if (existingComment) {
        action = 'rephraseComment';
        payload = { postContent, existingComment };
    }

    chrome.runtime.sendMessage(
        { action, ...payload },
        (response) => {
            if (response && response.success) {
                generatedCommentOutput.textContent = response.comment;
                commentResultContainer.classList.remove('hidden');
            }
        }
    );
});
```

### `popup/analytics.js`

Analytics display and data loading.

**Key Functions:**

#### `loadAnalyticsData()`
```javascript
// popup/analytics.js:20-58
async function loadAnalyticsData() {
    const [weeklyStatsRes, badgesStatsRes] = await Promise.all([
        new Promise(resolve => chrome.runtime.sendMessage({ action: 'getWeeklyStats' }, resolve)),
        new Promise(resolve => chrome.runtime.sendMessage({ action: 'getBadgesStats' }, resolve))
    ]);

    if (weeklyStatsRes?.success) {
        updateSummaryCards(weeklyStatsRes.data);
        renderWeeklyChart(weeklyStatsRes.data.daily_breakdown);
    }

    if (badgesStatsRes?.success) {
        renderBadges(badgesStatsRes.data.earned_badges);
        updateProgress(badgesStatsRes.data.progress_to_next_badge);
    }
}
```

#### `renderWeeklyChart()`
```javascript
// popup/analytics.js:67-101
function renderWeeklyChart(breakdown) {
    const maxVal = Math.max(...breakdown.map(d => d.count)) || 1;

    breakdown.forEach(day => {
        const barHeight = (day.count / maxVal) * 100;
        
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = `${Math.max(barHeight, 5)}%`;
        bar.title = `${day.date}: ${day.count}`;

        const label = document.createElement('div');
        label.className = 'chart-label';
        label.textContent = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
    });
}
```

### `popup/utils.js`

Utility functions.

#### `getBaseUrl()`
```javascript
// popup/utils.js:1-26
export function getBaseUrl() {
    return new Promise((resolve) => {
        chrome.storage.local.get("base_url", ({ base_url }) => {
            if (base_url) {
                resolve(base_url);
            } else {
                fetch("http://127.0.0.1:3000/api/auth/status", { credentials: "include" })
                    .then(() => {
                        chrome.storage.local.set({ base_url: "http://127.0.0.1:3000" });
                        resolve("http://127.0.0.1:3000");
                    })
                    .catch(() => {
                        chrome.storage.local.set({ base_url: "https://connectz.one" });
                        resolve("https://connectz.one");
                    });
            }
        });
    });
}
```

## Popup Views

### Main Menu (`#mainMenu`)
- Login warning when not authenticated
- Feature grid with navigation buttons
- Dashboard link

### Generate Post (`#generatePostView`)
- Textarea for rough post outline
- Generate button
- Result display with copy functionality

### Generate Comment (`#generateCommentView`)
- Post content textarea
- Optional existing comment textarea (for rephrasing)
- Generate button
- Result display with copy functionality

### Analytics (`#analyticsView`)
- Summary cards: Today, Week, Streak
- Weekly activity bar chart
- Badges grid
- Progress to next badge

## HTML Structure

```html
<!-- index.html -->
<div id="mainMenu">
    <div id="loginContainer" class="hidden">Login prompt</div>
    <div id="featuresContainer" class="hidden">
        <button id="goToGeneratePostBtn">Generate Post</button>
        <button id="goToGenerateCommentBtn">Generate Comment</button>
        <button id="goToAnalyticsBtn">Stats</button>
        <button id="visitDashboardBtn">Visit Dashboard</button>
    </div>
</div>

<div id="generatePostView" class="hidden">
    <textarea id="roughPostContent"></textarea>
    <button id="generatePostBtn">Generate Post</button>
    <div id="postResultContainer" class="hidden">
        <div id="generatedPostOutput"></div>
        <button id="copyPostBtn">Copy Text</button>
    </div>
</div>

<div id="generateCommentView" class="hidden">
    <textarea id="postContentForComment"></textarea>
    <textarea id="optionalComment"></textarea>
    <button id="generateCommentBtn">Generate Comment</button>
    <div id="commentResultContainer" class="hidden">
        <div id="generatedCommentOutput"></div>
        <button id="copyCommentBtn">Copy Text</button>
    </div>
</div>

<div id="analyticsView" class="hidden">
    <div class="stats-row">
        <div class="stat-card"><div id="statToday">0</div></div>
        <div class="stat-card"><div id="statWeekly">0</div></div>
        <div class="stat-card"><div id="statStreak">0</div></div>
    </div>
    <div id="weeklyChart"></div>
    <div id="badgesGrid"></div>
    <div class="progress-container">
        <div id="nextBadgeProgress"></div>
    </div>
</div>
```