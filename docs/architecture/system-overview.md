# System Overview

## Extension Architecture Summary

Connect Z is a Chrome Extension (Manifest V3) that provides AI-powered LinkedIn content generation. It works in conjunction with the ConnectZ Rails backend.

## High-Level Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   LinkedIn   │────▶│   Content   │────▶│ Background  │
│    Page      │     │   Script    │     │   Script    │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │   ConnectZ   │
                                          │   Backend    │
                                          │  (Rails)     │
                                          └──────────────┘
```

## Component Responsibilities

### Manifest (`manifest.json`)
- Defines extension permissions and configuration
- Manifest Version: 3
- Key permissions: `storage`, `alarms`, `tabs`
- Host permissions: `https://connectz.one/*`, `https://www.linkedin.com/*`

### Background Script (`background/main.js`)
- Service worker that handles API calls
- Manages authentication state
- Periodic login checks via Chrome alarms
- Message routing between content scripts and popup

### Content Scripts (`content/*.js`)
- Injected into LinkedIn pages
- DOM manipulation for UI elements
- Post/comment editor detection
- Toast notifications

### Popup (`popup/*`)
- Browser action popup UI
- Standalone content generation
- Analytics dashboard display

## Storage

The extension uses `chrome.storage.local` for:
- `logged_in` - User authentication status
- `base_url` - Backend URL (dev: `http://127.0.0.1:3000`, prod: `https://connectz.one`)
- `last_view` - Last opened popup view

## Security

1. **Authentication** - Cookie-based sessions via backend API
2. **Credentials** - Uses `credentials: "include"` for cross-origin requests
3. **Content Security Policy** - Inherits from Chrome's MV3 defaults

## File Structure

```
connectz_extension/
├── manifest.json           # Extension manifest
├── index.html              # Popup HTML
├── content-loader.js       # Content script entry point
├── background/
│   ├── main.js            # Service worker entry point
│   ├── auth.js           # Authentication utilities
│   └── api.js            # Backend API integration
├── content/
│   ├── main.js           # Content script entry
│   ├── ui.js             # Editor button UI
│   ├── dom.js            # DOM utilities
│   ├── floating_button.js # Floating tool button
│   └── toast.js          # Toast notifications
└── popup/
    ├── main.js           # Popup entry point
    ├── navigation.js     # View navigation
    ├── logic.js          # Generation logic
    ├── analytics.js      # Stats display
    ├── utils.js          # Utilities
    └── style.css         # Popup styles
```
