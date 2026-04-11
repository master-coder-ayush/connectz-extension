# Comment Rephrase

## Overview

Comment rephrasing allows users to improve existing comments with AI. Unlike generation from scratch, rephrasing takes a user-written comment and transforms it into a more engaging version.

## User Flow

### Via Content Script (on LinkedIn)

1. User has an existing comment in the editor
2. A rotate (refresh) button appears next to the comment box
3. User clicks the rotate button
4. Extension extracts:
   - The post content (from above)
   - The existing comment (from editor)
5. API rephrases based on both inputs
6. Result appears in toast with Copy/Paste options

### Via Popup

1. User opens extension popup
2. User navigates to "Generate Comment"
3. User enters:
   - Post content (required)
   - Existing comment to rephrase (optional)
4. User clicks "Generate Comment"
5. If optional comment provided, uses rephrase endpoint
6. Result displays with copy option

### Via Floating Sidebar

1. User opens floating sidebar
2. In "Generate Comment" section
3. User enters outline in textarea
4. Extension treats it as a rephrase if text provided
5. Result appears in sidebar

## Implementation Details

### Detection

The rotate button appears when:
1. Editor has content (not empty)
2. Editor is NOT a post composer (is a comment)

```javascript
// content/ui.js:615-632
function updateButtonVisibility() {
    const cleanText = (editor.textContent || editor.innerText || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim();
    const hasContent = cleanText !== '';

    if (hasContent && !isPostComposer(editor)) {
        rotateBtn.style.display = 'inline-flex';
    } else {
        rotateBtn.style.display = 'none';
    }
}

editor.addEventListener('input', updateButtonVisibility);
editor.addEventListener('focus', updateButtonVisibility);
```

### API Call

```javascript
// background/api.js:210-243
export async function generateRephraseCommentResponse(postContent, existingComment) {
    return await runGenerationRequest({
        postEndpoint: `${rootUrl}/api/comments/rephrase`,
        postBody: {
            linkedin_post_content: postContent,
            existing_comment: existingComment
        },
        pollUrlFactory: (id) => `${rootUrl}/api/comments/${id}`,
        completionKeys: [
            'generated_comment',
            'rephrased_comment',
            'comment',
            'comment_text',
            'result',
            'data'
        ],
        backCompatKeys: [
            'rephrased_comment',
            'comment',
            'result',
            'data'
        ],
    });
}
```

### Backend Endpoint

- **URL**: `POST /api/comments/rephrase`
- **Request Body**:
```json
{
  "linkedin_post_content": "The original post we're on...",
  "existing_comment": "Our comment that needs improvement..."
}
```

### Response (Sync)
```json
{
  "rephrased_comment": "Improved comment text..."
}
```

### Response (Async - 202)
```json
{
  "id": "789",
  "status": "pending"
}
```

Backend implementation: `connectz/app/controllers/api/comments_controller.rb`

## UI Elements

### Rotate Button

- Yellow gradient button
- Icon: Refresh/rotate arrow
- Appears next to comment editor (not post composer)
- Visible only when editor has content

```javascript
// content/ui.js:405-409
const rotateBtn = document.createElement('button');
rotateBtn.className = 'connectz-rotate-btn';
rotateBtn.innerHTML = `<svg width="14" height="14" ...><path d="M11.5 5.5A4.5 4.5 0 0 0 3 4..."/></svg>`;
rotateBtn.title = 'Rephrase existing comment';
```

### Toast Notification

- Type: success
- Title: "Comment rephrased!"
- Preview: First 120 characters
- Actions: Scroll to Post, Copy, Paste

### Content Extraction

The rephrasing flow extracts:

1. **Post content** - From above the comment (same as generation)
2. **Existing comment** - From editor textContent

```javascript
// content/ui.js:479
const existingComment = editor.textContent || editor.innerText || '';
```

## Distinction from Generation

| Aspect | Generation | Rephrase |
|--------|------------|---------|
| Input | Post content only | Post content + existing comment |
| Use case | New comments | Improving drafted comments |
| API endpoint | `/api/comments/generate` | `/api/comments/rephrase` |
| Button | Yellow + button | Yellow rotate button |
| Trigger | Empty editor | Editor has content |

## Key Files

| File | Purpose |
|------|---------|
| `content/ui.js` | Rotate button UI, click handling |
| `content/dom.js` | Content extraction |
| `background/api.js` | Rephrase API endpoint |
| `popup/logic.js` | Popup rephrase logic |

## Error Handling

| Error | Message |
|-------|---------|
| No post content | "Cannot find post. Unable to extract post content from LinkedIn." |
| No comment | "No comment found. Please write a comment first." |
| API failure | "Rephrase failed. Something went wrong. Please try again." |

## Flow Diagram

```
User writes comment ──▶ Editor has content
         │
         ▼
Rotate button appears (visible in toolbar)
         │
         ▼
User clicks rotate ──▶ extractPostContent(editor)
         │         │
         │         ▼
         └──▶ extractExistingComment(editor)
         │
         ▼
chrome.runtime.sendMessage({
     action: "rephraseComment",
     postContent,
     existingComment
 })
         │
         ▼
background/api.js:generateRephraseCommentResponse()
         │
         ▼
POST /api/comments/rephrase
         │
         ▼
Response ──▶ Toast notification
         │
    ┌────┴────┐
    ▼         ▼
 Copy     Paste
```