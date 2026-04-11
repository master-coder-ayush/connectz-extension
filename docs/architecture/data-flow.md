# Data Flow

## Overview

This document details how data flows through the ConnectZ extension system.

## Message Flow

### 1. Content Script to Background

```
LinkedIn Page ──chrome.runtime.sendMessage──▶ Background Script ──fetch──▶ Backend API
```

Content scripts communicate with background via message passing:

```javascript
// content/ui.js - Example message sending
chrome.runtime.sendMessage(
    { action: "generateComment", postContent },
    (response) => { /* handle response */ }
);
```

### 2. Popup to Background

```
Popup HTML ──chrome.runtime.sendMessage──▶ Background Script ──fetch──▶ Backend API
```

### 3. Background to Backend

```javascript
// background/api.js - API calls
const response = await fetch(`${baseUrl}/api/posts/generate`, {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ rough_post_content })
});
```

## Async Generation Flow

The extension supports both sync and async backend responses:

### Sync Response (Backwards Compatible)
```
POST /api/posts/generate ──200 OK──▶ { post: "..." }
```

### Async Response (New Contract)
```
POST /api/posts/generate ──202 Accepted──▶ { id: "abc", status: "pending" }
        │                                              │
        └──────── Poll every 1s until ────────────────┘
                   GET /api/posts/:id ──200 OK──▶ { status: "completed", post: "..." }
```

Backend code reference: `connectz/app/controllers/api/posts_controller.rb`

## Storage Flow

```
┌─────────────────┐     ┌──────────────────────┐
│  checkLogin()    │────▶│ chrome.storage.local  │
│  (background)   │     │  { logged_in: true }  │
└─────────────────┘     └──────────────────────┘
         │
         ▼
    ┌─────────────────┐
    │  Badge Update   │
    │  "✓" or ""     │
    └─────────────────┘
```

## Editor Interaction Flow

### Post Generation from Editor

```
User types rough post ──clicks + button──▶ content/ui.js:addPlusButton()
                                              │
                                              ▼
                                    extractRoughPostContent(editor)
                                              │
                                              ▼
                                    chrome.runtime.sendMessage({ action: "generatePost" })
                                              │
                                              ▼
                                    background/main.js handles message
                                              │
                                              ▼
                                    background/api.js:generatePostResponse()
                                              │
                                              ▼
                                    POST /api/posts/generate
                                              │
                                              ▼
                                    Insert result at cursor via insertAtCursor()
```

### Comment Generation from Editor

```
User clicks + on comment box ──▶ content/ui.js:addPlusButton()
                                     │
                                     ▼
                            extractPostContent(editor)
                                     │
                                     ▼
                            chrome.runtime.sendMessage({ action: "generateComment" })
                                     │
                                     ▼
                            Backend API call
                                     │
                                     ▼
                            Show toast with result
```

## Floating Button Flow

```
Page Load ──▶ content/main.js:bootstrap()
                    │
                    ▼
           initFloatingButton() (content/floating_button.js)
                    │
                    ▼
           Floating button appears on right side of screen
                    │
                    ▼
           User clicks ──▶ showContentSidebar()
                                 │
                                 ├─▶ getVisiblePostContent()
                                 ├─▶ Generate Comment section
                                 ├─▶ Generate Post section
                                 ├─▶ Tone Selector
                                 ├─▶ Pro Tips
                                 └─▶ Analytics Display
```

## Popup View Flow

```
Popup Opens ──▶ popup/main.js:updateStatus()
                    │
                    ▼
         Check chrome.storage.local.logged_in
                    │
          ┌────────┴────────┐
          ▼                 ▼
    Not Logged In       Logged In
    Show login        Show features
    prompt           container
```

## Navigation Flow

```javascript
// popup/navigation.js
switchView('generatePostView') ──▶ chrome.storage.local.set({ last_view: 'generatePostView' })
```

Views: `mainMenu` | `generatePostView` | `generateCommentView` | `analyticsView`

## Analytics Data Flow

```
User opens ──▶ popup/analytics.js:initAnalytics()
  Analytics View                      │
         ▼                         ▼
chrome.runtime.sendMessage ──▶ background/main.js
({ action: 'getWeeklyStats' })           │
                                  ▼
                         background/api.js:getWeeklyStats()
                                  │
                                  ▼
                         GET /api/stats/weekly
                                  │
                                  ▼
                         Render weekly chart
```

## Error Handling Flow

```
API Error ──▶ response.ok === false
              │
              ▼
         Parse error from JSON body
              │
              ▼
         Show error toast/message
              │
              ▼
         Log to console (chrome.runtime.lastError)
```