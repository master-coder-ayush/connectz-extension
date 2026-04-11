# Backend Integration

## Overview

The ConnectZ Chrome Extension integrates with the ConnectZ Rails backend for authentication, content generation, and analytics.

## Base URLs

| Environment | URL |
|------------|-----|
| Development | `http://127.0.0.1:3000` |
| Production | `https://connectz.one` |

## Environment Detection

```javascript
// background/auth.js:9-33
// Try dev server first, fallback to production
try {
    const res = await fetch("http://127.0.0.1:3000/api/auth/status", {
        credentials: "include"
    });
    if (res.ok) return "http://127.0.0.1:3000";
} catch (error) { }

return "https://connectz.one";
```

## API Endpoints

### Authentication

#### Check Login Status

```
GET /api/auth/status
```

**Request:**
- Credentials: `include` (cookie-based)

**Response:**
```json
{
  "logged_in": true
}
```

**Used by:** `checkLogin()` in `background/auth.js`

---

### Generate Post

```
POST /api/posts/generate
```

**Request:**
```json
{
  "rough_post_content": "My rough post idea..."
}
```

**Sync Response (200):**
```json
{
  "post": "Polished post content..."
}
```

**Async Response (202):**
```json
{
  "id": "123",
  "status": "pending"
}
```

**Poll Endpoint:**
```
GET /api/posts/:id
```

**Poll Response:**
```json
{
  "status": "completed",
  "generated_post": "Polished content..."
}
```

**Used by:** `generatePostResponse()` in `background/api.js`

---

### Generate Comment

```
POST /api/comments/generate
```

**Request:**
```json
{
  "linkedin_post_content": "Original post we're commenting on..."
}
```

**Sync Response (200):**
```json
{
  "comment": "Generated comment..."
}
```

**Async Response (202):**
```json
{
  "id": "456",
  "status": "pending"
}
```

**Poll Endpoint:**
```
GET /api/comments/:id
```

**Used by:** `generateCommentResponse()` in `background/api.js`

---

### Rephrase Comment

```
POST /api/comments/rephrase
```

**Request:**
```json
{
  "linkedin_post_content": "Original post...",
  "existing_comment": "Our comment to improve..."
}
```

**Sync Response (200):**
```json
{
  "rephrased_comment": "Improved comment..."
}
```

**Async Response (202):**
```json
{
  "id": "789",
  "status": "pending"
}
```

**Poll Endpoint:**
```
GET /api/comments/:id
```

**Used by:** `generateRephraseCommentResponse()` in `background/api.js`

---

### Get Weekly Stats

```
GET /api/stats/weekly
```

**Response:**
```json
{
  "today_count": 5,
  "weekly_total": 42,
  "streak": 4,
  "daily_breakdown": [
    { "date": "Mon", "count": 2 },
    { "date": "Tue", "count": 5 },
    { "date": "Wed", "count": 8 },
    { "date": "Thu", "count": 4 },
    { "date": "Fri", "count": 12 },
    { "date": "Sat", "count": 6 },
    { "date": "Sun", "count": 5 }
  ]
}
```

**Used by:** `getWeeklyStats()` in `background/api.js`

---

### Get Badges

```
GET /api/stats/badges
```

**Response:**
```json
{
  "earned_badges": [
    { "name": "First Post", "icon": "📝" },
    { "name": "Week Warrior", "icon": "⚔���" }
  ],
  "progress_to_next_badge": {
    "name": "5-Day Streak",
    "percentage": 80,
    "description": "4/5 days"
  }
}
```

**Used by:** `getBadgesStats()` in `background/api.js`

---

### Get User Preference

```
GET /api/user_preference
```

**Response:**
```json
{
  "tone": "Insightful + Deep"
}
```

**Used by:** `getUserTone()` in `background/api.js`

---

### Update User Preference

```
PATCH /api/user_preference
```

**Request:**
```json
{
  "user_preference": {
    "tone": "Bold + Blunt"
  }
}
```

**Response:**
```json
{
  "tone": "Bold + Blunt"
}
```

**Used by:** `updateUserTone()` in `background/api.js`

---

## Request Configuration

All API requests use:

```javascript
{
    method: "POST", // or GET/PATCH
    headers: {
        "Content-Type": "application/json"
    },
    credentials: "include", // Required for session cookie
    body: JSON.stringify(data)
}
```

## Error Handling

### Network Errors

```javascript
try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
} catch (error) {
    console.error("Error:", error);
}
```

### JSON Parsing Errors

```javascript
async function parseJsonSafe(response) {
    try {
        return await response.json();
    } catch (err) {
        return null;
    }
}
```

### Error Message Extraction

```javascript
function extractErrorMessage(data, fallback) {
    return data?.error_message || data?.error || data?.message || fallback;
}
```

## Polling Configuration

```javascript
// background/api.js:7-8
const POLL_INTERVAL_MS = 1000;  // Poll every 1 second
const POLL_TIMEOUT_MS = 60000;  // Timeout after 60 seconds
```

### Polling Flow

```javascript
async function pollJobUntilFinished(pollUrl) {
    const startedAt = Date.now();

    while (true) {
        const response = await fetch(pollUrl, { credentials: "include" });
        const data = await response.json();

        if (data.status === 'completed') {
            return data.generated_content;
        }

        if (data.status === 'failed') {
            throw new Error(data.error_message);
        }

        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            throw new Error("Request timed out");
        }

        await sleep(POLL_INTERVAL_MS);
    }
}
```

## CORS Configuration

The backend must allow CORS from extension origins.

Backend configuration: `connectz/config/initializers/cors.rb`

```ruby
# Example (Rails)
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'chrome-extension://...', 'https://connectz.one'
    resource '*',
      headers: :any,
      methods: [:get, :post, :patch, :options],
      credentials: true
  end
end
```

## Rate Limiting

Rate limiting is handled by the backend:
- Per-user limits based on subscription plan
- Backend returns appropriate errors if exceeded

## Response Compatibility

The extension supports both:

1. **Sync Response** - Immediate result in POST response
2. **Async Response** - 202 with job ID, polling required

This ensures backward compatibility with older backend versions.