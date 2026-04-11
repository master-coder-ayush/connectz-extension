# Comment Generation

## Overview

Comment generation creates AI-powered comments on LinkedIn posts. Users can generate comments from scratch or provide their own outline to refine.

## User Flow

### Via Content Script (on LinkedIn)

1. User scrolls to a LinkedIn post
2. User clicks the comment box below the post
3. A yellow **+** button appears in the comment toolbar
4. User clicks **+** to generate a comment
5. Extension extracts post content from above the editor
6. API generates a comment based on the post
7. Result appears in toast with Copy/Paste actions

### Via Popup

1. User opens extension popup
2. User clicks "Generate Comment"
3. User pastes post content in textarea
4. User clicks "Generate Comment"
5. Result displays with copy option

### Via Floating Button Sidebar

1. User clicks floating button on LinkedIn feed
2. Sidebar shows current post context
3. User enters optional comment outline
4. User clicks "Generate Comment"
5. AI generates or rephrases based on context

## Implementation Details

### Post Content Extraction

```javascript
// content/dom.js:96-200
export function extractPostContent(editor) {
    // Strategy 1: Geometric lookup
    // Find text nodes closest and above the editor
    const textNodes = document.querySelectorAll(
        '.update-components-text, ' +
        '.update-components-update-v2__commentary, ' +
        '.feed-shared-text'
    ).filter(node => !node.closest('[componentkey^="replaceableComment_"]'));

    // Get editor position
    const editorRect = editor.getBoundingClientRect();

    // Find closest node that's above the editor
    let closestTextNode = null;
    let closestDistance = Infinity;

    textNodes.forEach(node => {
        const rect = node.getBoundingClientRect();
        if (rect.bottom <= editorRect.bottom) {
            const distance = editorRect.top - rect.bottom;
            if (distance < closestDistance) {
                closestDistance = distance;
                closestTextNode = node;
            }
        }
    });

    // Fallback: Hierarchical DOM lookup
    if (!closestTextNode) {
        const postContainer = editor.closest('div[role="listitem"]') ||
            editor.closest('.feed-shared-update-v2') ||
            editor.closest('article');
        closestTextNode = postContainer?.querySelector('.update-components-text');
    }

    // Extract text
    const textSpan = closestTextNode?.querySelector('span.break-words') || closestTextNode;
    return textSpan?.textContent?.trim();
}
```

### API Call

```javascript
// background/api.js:143-169
export async function generateCommentResponse(postContent) {
    return await runGenerationRequest({
        postEndpoint: `${rootUrl}/api/comments/generate`,
        postBody: { linkedin_post_content: postContent },
        pollUrlFactory: (id) => `${rootUrl}/api/comments/${id}`,
        completionKeys: ['generated_comment', 'comment', 'comment_text', 'result', 'data'],
        backCompatKeys: ['comment', 'generated_comment', 'comment_text', 'result', 'data'],
    });
}
```

### Backend Endpoint

- **URL**: `POST /api/comments/generate`
- **Request Body**:
```json
{
  "linkedin_post_content": "The post text we're commenting on..."
}
```

### Response (Sync)
```json
{
  "comment": "AI-generated comment..."
}
```

### Response (Async - 202)
```json
{
  "id": "456",
  "status": "pending"
}
```

Backend implementation: `connectz/app/controllers/api/comments_controller.rb`

## Key Files

| File | Purpose |
|------|---------|
| `content/ui.js` | Plus button for comments |
| `content/dom.js` | Post content extraction |
| `content/floating_button.js` | Sidebar generation |
| `background/api.js` | API requests |
| `popup/logic.js` | Popup comment generation |

## UI Elements

### Plus Button

- Yellow gradient button (`#fbbf24` to `#f59e0b`)
- Appears in editor toolbar
- Label: "Generate comment from post"
- Shows loading state during generation

### Toast Notification

- Success: Green checkmark, comment preview
- Actions: Copy, Paste
- Auto-dismiss after 20 seconds

### Floating Sidebar

- "Current Post Context" section
- "Generate Comment" textarea
- "Generate Comment" button
- Result with copy functionality

## Best Practices Tips

The extension includes pro tips in the floating sidebar:

- "Comment in the first 60 minutes for maximum reach."
- "8-15 word comments perform better than long ones."
- "End comments with a question to boost replies."
- "Early comments help posts re-enter the feed."
- "Consistent commenting beats posting once in a while."
- "Strong first line = higher comment visibility."

## Error Handling

| Error | Message |
|-------|---------|
| No post found | "Cannot find post. Unable to extract post content from LinkedIn." |
| Empty response | "Unable to generate comment. Please try again later." |
| API failure | "Comment generation failed. Something went wrong. Please try again." |

## Usage Tracking

Each generation increments usage counters via the backend, tracked for:
- Daily comment generation limits
- Subscription plan limits
- Leaderboards
- Analytics display