# Post Generation

## Overview

Post generation allows users to create polished LinkedIn posts from rough outlines. The AI transforms rough ideas into professional, engagement-optimized content.

## User Flow

### Via Content Script (on LinkedIn)

1. User navigates to LinkedIn's post composer
2. User types rough post content in the editor
3. A yellow **+** button appears in the editor toolbar
4. User clicks the **+** button
5. Extension extracts rough content and sends to backend
6. Generated post appears in a toast notification
7. User can:
   - **Copy** - Copy to clipboard
   - **Paste** - Insert directly into editor

### Via Popup

1. User clicks the ConnectZ extension icon
2. User navigates to "Generate Post" view
3. User enters rough outline in textarea
4. User clicks "Generate Post"
5. Generated post appears in result area
6. User clicks "Copy Text" to copy

### Via Floating Button

1. User sees floating button on right side of LinkedIn feed
2. User clicks the floating button
3. Sidebar opens with "Generate New Post" section
4. User enters rough outline
5. User clicks "Generate Post"
6. Result appears in the sidebar

## Implementation Details

### Content Script Detection

The extension detects the post composer using:

```javascript
// content/dom.js:12-34
const container = editor.closest('.share-box-v2__modal') ||
    editor.closest('.share-box') ||
    editor.closest('.share-creation-state__text-editor') ||
    editor.closest('[data-test-id="share-box"]') ||
    editor.closest('.feed-share-update-v2');

const isInComment = editor.closest('[componentkey^="commentBox-"]');

return container && !isInComment;
```

### API Call

```javascript
// background/api.js:176-202
export async function generatePostResponse(roughPostContent) {
    return await runGenerationRequest({
        postEndpoint: `${rootUrl}/api/posts/generate`,
        postBody: { rough_post_content: roughPostContent },
        pollUrlFactory: (id) => `${rootUrl}/api/posts/${id}`,
        completionKeys: ['generated_post', 'post', 'post_text', 'result', 'data'],
        backCompatKeys: ['post', 'generated_post', 'post_text', 'result', 'data'],
    });
}
```

### Backend Endpoint

- **URL**: `POST /api/posts/generate`
- **Request Body**:
```json
{
  "rough_post_content": "My thoughts on remote work..."
}
```

### Response (Sync)
```json
{
  "post": "Polished LinkedIn post text..."
}
```

### Response (Async - 202)
```json
{
  "id": "123",
  "status": "pending"
}
```

Backend implementation: `connectz/app/controllers/api/posts_controller.rb`

## Key Files

| File | Purpose |
|------|---------|
| `content/ui.js` | Plus button UI and click handling |
| `content/dom.js` | Editor detection and content extraction |
| `background/api.js` | API request to backend |
| `content/floating_button.js` | Sidebar post generation |
| `popup/logic.js` | Popup post generation |

## Tone Selection

Users can select their preferred tone from:
- Short + Punchy
- Formal + Polished
- Friendly + Casual
- Insightful + Deep
- Bold + Blunt
- Motivational

The selected tone is stored via `updateUserTone()` and affects AI generation.

## Error Handling

| Error | Message |
|-------|---------|
| Empty content | "No content found. Please write some rough post content first." |
| API failure | "Post generation failed. Something went wrong. Please try again." |
| Timeout | "Request timed out. Please try again." |
| Network error | "Unable to generate post. Please try again later." |