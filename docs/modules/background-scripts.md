# Background Scripts

## Overview

Background scripts run as a Chrome service worker (Manifest V3). They handle:
- Authentication checking
- API calls to backend
- Message routing from content/popup scripts
- Periodic background tasks via Chrome alarms

## Files

### `background/main.js`

Entry point for the background service worker.

**Key Functions:**

#### Message Handling
```javascript
// background/main.js:35-96
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkLogin") {
        checkLogin().then(() => { sendResponse({ success: true }); });
        return true;
    } else if (request.action === "generateComment") {
        generateCommentResponse(request.postContent)
            .then(comment => sendResponse({ success: true, comment }));
        return true;
    } else if (request.action === "generatePost") {
        generatePostResponse(request.roughPostContent)
            .then(post => sendResponse({ success: true, post }));
        return true;
    } else if (request.action === "getWeeklyStats") {
        getWeeklyStats()
            .then(data => sendResponse({ success: true, data }));
        return true;
    } else if (request.action === "getBadgesStats") {
        getBadgesStats()
            .then(data => sendResponse({ success: true, data }));
        return true;
    } else if (request.action === "getUserTone") {
        getUserTone()
            .then(tone => sendResponse({ success: true, tone }));
        return true;
    } else if (request.action === "updateUserTone") {
        updateUserTone(request.tone)
            .then(tone => sendResponse({ success: true, tone }));
        return true;
    }
});
```

#### Alarm Setup
```javascript
// background/main.js:24-32
chrome.alarms.create("checkLogin", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkLogin") {
        checkLogin();
    }
});
```

### `background/auth.js`

Handles authentication and base URL detection.

**Key Functions:**

#### `getBaseUrl()`
```javascript
// background/auth.js:9-33
export async function getBaseUrl() {
    // Check chrome.storage.local first
    const stored = await chrome.storage.local.get("base_url");
    if (stored.base_url) return stored.base_url;

    // Try dev server first
    try {
        const res = await fetch("http://127.0.0.1:3000/api/auth/status", {
            credentials: "include"
        });
        if (res.ok) {
            await chrome.storage.local.set({ base_url: "http://127.0.0.1:3000" });
            return "http://127.0.0.1:3000";
        }
    } catch (error) { }

    // Fallback to production
    await chrome.storage.local.set({ base_url: "https://connectz.one" });
    return "https://connectz.one";
}
```

#### `checkLogin()`
```javascript
// background/auth.js:39-67
export async function checkLogin() {
    try {
        const baseUrl = await getBaseUrl();
        const res = await fetch(`${baseUrl}/api/auth/status`, {
            credentials: "include"
        });

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();
        await chrome.storage.local.set({ logged_in: data.logged_in });

        // Update badge
        if (data.logged_in) {
            chrome.action.setBadgeText({ text: "✓" });
            chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
        } else {
            chrome.action.setBadgeText({ text: "" });
        }
    } catch (error) {
        await chrome.storage.local.set({ logged_in: false });
        chrome.action.setBadgeText({ text: "" });
    }
}
```

### `background/api.js`

Backend API integration with polling support.

**Key Functions:**

#### `runGenerationRequest()`
```javascript
// background/api.js:99-136
async function runGenerationRequest({
    postEndpoint,
    postBody,
    pollUrlFactory,
    completionKeys = [],
    backCompatKeys,
    defaultErrorMessage,
}) {
    const response = await fetch(postEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(postBody),
    });

    // New async contract: 202 + { id, status: "pending" }
    if (response.status === 202) {
        const acceptedData = await parseJsonSafe(response);
        const jobId = acceptedData?.id;
        const pollUrl = pollUrlFactory(jobId);
        return await pollJobUntilFinished(pollUrl, completionKeys);
    }

    // Backward compatibility with sync responses
    await ensureOkOrThrow(response, defaultErrorMessage);
    const syncData = await parseJsonSafe(response);
    return readGeneratedText(syncData, backCompatKeys);
}
```

#### `generatePostResponse()`
```javascript
// background/api.js:176-202
export async function generatePostResponse(roughPostContent) {
    const rootUrl = (await getBaseUrl()).replace(/\/$/, "");
    return await runGenerationRequest({
        postEndpoint: `${rootUrl}/api/posts/generate`,
        postBody: { rough_post_content: roughPostContent },
        pollUrlFactory: (id) => `${rootUrl}/api/posts/${id}`,
        completionKeys: ['generated_post', 'post', 'post_text', 'result', 'data'],
        backCompatKeys: ['post', 'generated_post', 'post_text', 'result', 'data'],
        defaultErrorMessage: "Unable to generate post. Please try again later.",
    });
}
```

#### `generateCommentResponse()`
```javascript
// background/api.js:143-169
export async function generateCommentResponse(postContent) {
    const rootUrl = (await getBaseUrl()).replace(/\/$/, "");
    return await runGenerationRequest({
        postEndpoint: `${rootUrl}/api/comments/generate`,
        postBody: { linkedin_post_content: postContent },
        pollUrlFactory: (id) => `${rootUrl}/api/comments/${id}`,
        completionKeys: ['generated_comment', 'comment', 'comment_text', 'result', 'data'],
        backCompatKeys: ['comment', 'generated_comment', 'comment_text', 'result', 'data'],
        defaultErrorMessage: "Unable to generate comment. Please try again later.",
    });
}
```

#### `generateRephraseCommentResponse()`
```javascript
// background/api.js:210-243
export async function generateRephraseCommentResponse(postContent, existingComment) {
    const rootUrl = (await getBaseUrl()).replace(/\/$/, "");
    return await runGenerationRequest({
        postEndpoint: `${rootUrl}/api/comments/rephrase`,
        postBody: {
            linkedin_post_content: postContent,
            existing_comment: existingComment
        },
        pollUrlFactory: (id) => `${rootUrl}/api/comments/${id}`,
        completionKeys: ['generated_comment', 'rephrased_comment', 'comment', 'comment_text', 'result', 'data'],
        backCompatKeys: ['rephrased_comment', 'comment', 'result', 'data'],
        defaultErrorMessage: "Unable to rephrase comment. Please try again later.",
    });
}
```

#### `getWeeklyStats()`
```javascript
// background/api.js:249-270
export async function getWeeklyStats() {
    const baseUrl = await getBaseUrl();
    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/stats/weekly`;
    const res = await fetch(endpoint, { method: "GET", credentials: "include" });
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    return await res.json();
}
```

#### `getBadgesStats()`
```javascript
// background/api.js:276-297
export async function getBadgesStats() {
    const baseUrl = await getBaseUrl();
    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/stats/badges`;
    const res = await fetch(endpoint, { method: "GET", credentials: "include" });
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    return await res.json();
}
```

#### `getUserTone()` / `updateUserTone()`
```javascript
// background/api.js:303-362
export async function getUserTone() {
    const baseUrl = await getBaseUrl();
    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/user_preference`;
    const res = await fetch(endpoint, { method: "GET", credentials: "include" });
    const data = await res.json();
    return data.tone || null;
}

export async function updateUserTone(tone) {
    const baseUrl = await getBaseUrl();
    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/user_preference`;
    const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_preference: { tone } }),
    });
    const data = await res.json();
    return data.tone;
}
```

## Polling Configuration

```javascript
// background/api.js:7-8
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 60000; // ~60s timeout
```