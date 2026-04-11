# User Authentication

## Overview

The extension manages user authentication via the ConnectZ backend. It uses cookie-based sessions for authentication and stores login state in Chrome storage.

## Authentication Flow

### Initial Login Check

1. Extension starts (on install or browser start)
2. Background script calls `checkLogin()`
3. `checkLogin()` calls backend `/api/auth/status`
4. Backend checks session cookie
5. Returns `logged_in: true/false`
6. Extension stores result in `chrome.storage.local`

### Periodic Verification

The extension checks login status periodically:

```javascript
// background/main.js:24-32
chrome.alarms.create("checkLogin", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkLogin") {
        checkLogin();
    }
});
```

- Check frequency: Every 1 minute
- Also runs on extension startup

## Implementation

### `checkLogin()`

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

### `getBaseUrl()`

Auto-detects backend URL (dev vs production):

```javascript
// background/auth.js:9-33
export async function getBaseUrl() {
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

## Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `logged_in` | boolean | User authentication status |
| `base_url` | string | Backend URL |
| `last_view` | string | Last opened popup view |

## Badge States

| State | Badge Text | Badge Color |
|------|-----------|------------|
| Logged in | "✓" | Green (#4CAF50) |
| Not logged in | (empty) | (no badge) |
| Error | (empty) | (no badge) |

## UI States

### Popup Login State

```javascript
// popup/main.js:27-71
if (logged_in) {
    featuresContainer.classList.remove('hidden');
    featuresContainer.classList.add('display');
} else {
    loginContainer.classList.remove('hidden');
    loginContainer.classList.add('display');
}
```

### LinkedIn Context Warning

If user is logged in but NOT on LinkedIn:

```html
<div id="linkedinWarning" class="hidden">
    You need to open LinkedIn to use ConnectZ
</div>
<button id="openLinkedInBtn" class="hidden">
    Open LinkedIn
</button>
```

## Backend Auth Endpoint

- **URL**: `GET /api/auth/status`
- **Credentials**: Cookie-based (session)
- **Response**:
```json
{
  "logged_in": true
}
```

Backend implementation:
- `connectz/app/controllers/api/auth_controller.rb`

## Protected Features

These features require login:

- Generate Post
- Generate Comment
- Rephrase Comment
- View Analytics
- View Badges

### Unauthenticated Handling

When not logged in:
1. Popup shows "Login Now" button instead of features
2. Clicking login button opens backend sign-in page
3. Content script toasts may show prompts
4. Floating button still appears but shows login prompt

## Key Files

| File | Purpose |
|------|---------|
| `background/auth.js` | Auth utilities |
| `background/main.js` | Background message handling |
| `popup/main.js` | Popup login UI |

## Security

- Uses `credentials: "include"` for cross-origin requests
- Session cookies from backend
- No token storage (cookie-based)

## Error Handling

| Error | Behavior |
|-------|---------|
| Network error | Assume not logged in |
| 401/403 response | Clear login state |
| Backend down | Show login prompt |