// Content script for LinkedIn - adds + button to comment boxes

// Store editor reference and cursor position
let activeEditorRef = null;
let savedRange = null;

function requestGeneratedComment(postContent) {
  return new Promise((resolve, reject) => {
    if (!postContent || !postContent.trim()) {
      reject(new Error("Post content is empty."));
      return;
    }

    chrome.runtime.sendMessage(
      {
        action: "generateComment",
        postContent,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response || !response.success) {
          reject(
            new Error(
              response?.error ||
                "Unable to generate comment. Please try again later."
            )
          );
          return;
        }

        resolve(response.comment);
      }
    );
  });
}

function requestGeneratedPost(roughPostContent) {
  return new Promise((resolve, reject) => {
    if (!roughPostContent || !roughPostContent.trim()) {
      reject(new Error("Rough post content is empty."));
      return;
    }

    chrome.runtime.sendMessage(
      {
        action: "generatePost",
        roughPostContent,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response || !response.success) {
          reject(
            new Error(
              response?.error ||
                "Unable to generate post. Please try again later."
            )
          );
          return;
        }

        resolve(response.post);
      }
    );
  });
}

// Function to check if editor is a post composer (not a comment box)
function isPostComposer(editor) {
  // Check for post composer containers - including the modal
  const container = editor.closest('.share-box-v2__modal') ||
                   editor.closest('.share-box') ||
                   editor.closest('.share-box-feed') ||
                   editor.closest('.share-creation-state__text-editor') ||
                   editor.closest('.share-creation-state') ||
                   editor.closest('[data-test-id="share-box"]') ||
                   editor.closest('.share-creation-box') ||
                   editor.closest('.share-creation-textarea') ||
                   editor.closest('.feed-share-update-v2') ||
                   editor.closest('.share-box__text-area') ||
                   editor.closest('.editor-container');
  
  // Also check if it's NOT in a comment container
  const isInComment = editor.closest('.comments-comment-box') ||
                      editor.closest('.comments-comment-box-comment__text-editor') ||
                      editor.closest('.comments-comment-box__text-editor');
  
  return container && !isInComment;
}

// Function to extract rough post content from the editor itself
function extractRoughPostContent(editor) {
  try {
    // Get the text content directly from the editor
    const text = editor.textContent || editor.innerText || '';
    
    // Clean up the text
    return text.trim();
  } catch (error) {
    console.error('Error extracting rough post content:', error);
    return null;
  }
}

// Function to save cursor position
function saveCursorPosition(editor) {
  activeEditorRef = editor;
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    savedRange = sel.getRangeAt(0).cloneRange();
  }
}

// Function to restore cursor position
function restoreCursorPosition(editor) {
  if (!editor || !savedRange) return;
  
  const sel = window.getSelection();
  try {
    // Check if range is still valid
    if (savedRange.startContainer.parentNode && editor.contains(savedRange.startContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  } catch (e) {
    // Range might be invalid, try to set cursor at end
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

// Function to extract post content from the DOM
function extractPostContent(editor) {
  try {
    // Find the comment box container
    const editorContainer = editor.closest('.ql-container') || 
                           editor.closest('.comments-comment-box') ||
                           editor.parentElement;
    if (!editorContainer) return null;

    // Find the post container - traverse up the DOM to find the feed update
    let postContainer = editorContainer.closest('.feed-shared-update-v2');
    
    // If not found, try alternative selectors
    if (!postContainer) {
      postContainer = editorContainer.closest('[data-urn]') || 
                     editorContainer.closest('article') ||
                     editorContainer.closest('.feed-shared-update-v2__commentary')?.closest('.feed-shared-update-v2');
    }
    
    if (!postContainer) {
      // Last resort: look for the nearest update-components-text element
      const allPosts = document.querySelectorAll('.update-components-text');
      let closestPost = null;
      let closestDistance = Infinity;
      
      allPosts.forEach(post => {
        const rect = post.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        const distance = Math.abs(rect.top - editorRect.top);
        
        if (distance < closestDistance && rect.top < editorRect.top) {
          closestDistance = distance;
          closestPost = post;
        }
      });
      
      if (closestPost) {
        postContainer = closestPost.closest('.feed-shared-update-v2') || closestPost;
      }
    }
    
    if (!postContainer) return null;
    
    // Find the post text element
    const postTextElement = postContainer.querySelector('.update-components-text') ||
                           postContainer.querySelector('.update-components-update-v2__commentary');
    
    if (!postTextElement) return null;
    
    // Extract text from the inner span with dir="ltr"
    const textSpan = postTextElement.querySelector('span[dir="ltr"]') || 
                    postTextElement.querySelector('span.break-words') ||
                    postTextElement;
    
    if (!textSpan) return null;
    
    // Get text content - replace <br> tags with line breaks
    let text = textSpan.innerHTML || textSpan.innerText || textSpan.textContent;
    
    // Replace <br> and <br/> tags with line breaks
    text = text.replace(/<br\s*\/?>/gi, '\n\n');
    
    // Remove HTML tags but keep text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    text = tempDiv.textContent || tempDiv.innerText || text;
    
    // Clean up the text
    text = text.replace(/\n{3,}/g, '\n\n')  // Replace 3+ line breaks with double
               .replace(/[ \t]+/g, ' ')       // Replace multiple spaces with single
               .replace(/\n /g, '\n')          // Remove spaces after line breaks
               .replace(/ \n/g, '\n')          // Remove spaces before line breaks
               .trim();
    
    return text || null;
  } catch (error) {
    console.error('Error extracting post content:', error);
    return null;
  }
}

// Function to insert text at cursor position in Quill editor
function insertAtCursor(text, editor) {
  // Use provided editor or try to find active one
  const targetEditor = editor || document.activeElement.closest('.ql-editor');
  if (!targetEditor) return;

  // Focus the editor first
  targetEditor.focus();

  const sel = window.getSelection();
  
  // If we have a saved range, use it; otherwise try to get current selection
  let range;
  if (savedRange && targetEditor.contains(savedRange.startContainer)) {
    try {
      range = savedRange.cloneRange();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {
      // Fallback to current selection
      if (sel.rangeCount > 0) {
        range = sel.getRangeAt(0);
      } else {
        // Create range at end of editor
        range = document.createRange();
        range.selectNodeContents(targetEditor);
        range.collapse(false);
      }
    }
  } else {
    if (sel.rangeCount > 0) {
      range = sel.getRangeAt(0);
    } else {
      // Create range at end of editor
      range = document.createRange();
      range.selectNodeContents(targetEditor);
      range.collapse(false);
    }
  }

  // Create a text node for the insertion
  const newNode = document.createTextNode(text);

  // Insert text at cursor
  range.insertNode(newNode);

  // Move cursor after inserted text
  range.setStartAfter(newNode);
  range.setEndAfter(newNode);
  sel.removeAllRanges();
  sel.addRange(range);

  // Update saved range
  savedRange = range.cloneRange();

  // Trigger Ember/Quill update
  targetEditor.dispatchEvent(new Event('input', { bubbles: true }));
  targetEditor.dispatchEvent(new Event('change', { bubbles: true }));
}

// Function to clear editor content before inserting new text
function clearEditorContent(editor) {
  if (!editor) return;

  editor.innerHTML = '';

  const paragraph = document.createElement('p');
  const br = document.createElement('br');
  paragraph.appendChild(br);
  editor.appendChild(paragraph);

  editor.dispatchEvent(new Event('input', { bubbles: true }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));
}

// Function to create and add + button next to editor
function addPlusButton(editor) {
  // Find key containers
  const editorWrapper = editor.closest('.comments-comment-box-comment__text-editor') ||
                        editor.closest('.ql-container') ||
                        editor.parentElement;
  const flexContainer = editor.closest('.display-flex.flex-wrap');
  const buttonContainer = flexContainer || editorWrapper;
  const isFlexPlacement = Boolean(flexContainer);

  if (!buttonContainer) return;

  // Create + button (one per editor)
  const plusBtn = document.createElement('button');
  plusBtn.className = 'connectz-plus-btn';
  plusBtn.type = 'button';
  plusBtn.innerHTML = '+';
  
  // Set title based on editor type
  const isPost = isPostComposer(editor);
  plusBtn.title = isPost ? 'Generate post from rough content' : 'Generate comment from post';

  const baseStyles = `
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: #0077b5;
    color: white;
    border: none;
    cursor: pointer;
    font-size: 18px;
    font-weight: bold;
    display: none;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: background-color 0.2s;
  `;

  plusBtn.style.cssText = isFlexPlacement
    ? `
      ${baseStyles}
      position: static;
      margin: 5px 8px;
      align-self: flex-start;
    `
    : `
      ${baseStyles}
      position: absolute;
      right: 10px;
      top: 10px;
      z-index: 1000;
    `;

  // Hover effect
  plusBtn.addEventListener('mouseenter', () => {
    plusBtn.style.backgroundColor = '#005885';
  });
  plusBtn.addEventListener('mouseleave', () => {
    plusBtn.style.backgroundColor = '#0077b5';
  });

  // Track if button should stay visible
  let buttonShouldStayVisible = false;

  // Click handler - insert text at cursor
  plusBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Save editor reference and cursor position before click
    saveCursorPosition(editor);
  });

  plusBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    buttonShouldStayVisible = true;
    const originalLabel = plusBtn.textContent;
    plusBtn.textContent = '…';
    plusBtn.disabled = true;

    try {
      // Check if this is a post composer or comment box
      const isPost = isPostComposer(editor);
      
      if (isPost) {
        // For post composers: extract rough post content from the editor itself
        const roughPostContent = extractRoughPostContent(editor);
        
        if (!roughPostContent) {
          throw new Error("Please write some rough post content first.");
        }

        const generatedPost = await requestGeneratedPost(roughPostContent);

        // Small delay to ensure editor is ready
        setTimeout(() => {
          clearEditorContent(editor);
          insertAtCursor(generatedPost, editor);
          // Keep button visible by refocusing editor
          editor.focus();
        }, 50);
      } else {
        // For comment boxes: extract post content from the DOM
        const postContent = extractPostContent(editor);

        if (!postContent) {
          throw new Error("Unable to extract post content from LinkedIn.");
        }

        const generatedComment = await requestGeneratedComment(postContent);

        // Small delay to ensure editor is ready
        setTimeout(() => {
          clearEditorContent(editor);
          insertAtCursor(generatedComment, editor);
          // Keep button visible by refocusing editor
          editor.focus();
        }, 50);
      }
    } catch (error) {
      console.error("Error generating content:", error);
      const fallbackMessage =
        error?.message ||
        "Unable to generate content. Please try again in a moment.";
      setTimeout(() => {
        clearEditorContent(editor);
        insertAtCursor(fallbackMessage, editor);
        editor.focus();
      }, 50);
    } finally {
      plusBtn.textContent = originalLabel || '+';
      plusBtn.disabled = false;
      // Restore button state
      buttonShouldStayVisible = false;
    }
  });

  // Make editor container relative positioned if we fall back to absolute placement
  if (!isFlexPlacement && editorWrapper && getComputedStyle(editorWrapper).position === 'static') {
    editorWrapper.style.position = 'relative';
  }

  // Insert button into chosen container
  buttonContainer.appendChild(plusBtn);

  // Show/hide button based on focus
  function updateButtonVisibility() {
    const isFocused = document.activeElement === editor || 
                     editor.contains(document.activeElement);
    
    // Show if editor is focused or button should stay visible
    if (isFocused || buttonShouldStayVisible) {
      plusBtn.style.display = isFlexPlacement ? 'inline-flex' : 'flex';
    } else {
      plusBtn.style.display = 'none';
    }
  }

  // Listen for focus events
  editor.addEventListener('focus', () => {
    saveCursorPosition(editor);
    buttonShouldStayVisible = false;
    updateButtonVisibility();
  });
  
  editor.addEventListener('blur', (e) => {
    // Don't hide immediately - allow time for button click
    setTimeout(() => {
      if (document.activeElement !== plusBtn && 
          document.activeElement !== editor &&
          !buttonShouldStayVisible) {
        updateButtonVisibility();
      }
    }, 200);
  });
  
  editor.addEventListener('click', () => {
    saveCursorPosition(editor);
    buttonShouldStayVisible = false;
    updateButtonVisibility();
  });
  
  // Keep button visible when interacting with it
  plusBtn.addEventListener('mouseenter', () => {
    buttonShouldStayVisible = true;
    plusBtn.style.display = 'flex';
  });
  
  plusBtn.addEventListener('mouseleave', () => {
    buttonShouldStayVisible = false;
    // Only hide if editor is not focused
    if (document.activeElement !== editor && 
        !editor.contains(document.activeElement)) {
      updateButtonVisibility();
    }
  });
  
  // Keep visible during click
  plusBtn.addEventListener('mousedown', () => {
    buttonShouldStayVisible = true;
  });
  
  plusBtn.addEventListener('mouseup', () => {
    // After click, refocus editor to keep button visible
    setTimeout(() => {
      editor.focus();
      buttonShouldStayVisible = false;
    }, 100);
  });
  
  // Initial check
  updateButtonVisibility();
  
  // Also check on any focus change
  document.addEventListener('focusin', (e) => {
    if (e.target === editor || editor.contains(e.target)) {
      saveCursorPosition(editor);
      buttonShouldStayVisible = false;
      updateButtonVisibility();
    }
  });
}

// Function to find and process all Quill editors on the page
function processEditors() {
  // Find all Quill editors
  const editors = document.querySelectorAll('.ql-editor');
  
  editors.forEach(editor => {
    // Check if we've already processed this editor
    if (editor.dataset.connectzProcessed) return;
    
    // Mark as processed
    editor.dataset.connectzProcessed = 'true';
    
    // Add + button (pass the editor element directly)
    addPlusButton(editor);
  });
}

// Initial processing
processEditors();

// Watch for new editors added dynamically (LinkedIn uses dynamic content)
const observer = new MutationObserver((mutations) => {
  let shouldProcess = false;
  
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          // Check if it's a Quill editor or contains one
          if (node.classList?.contains('ql-editor') || 
              node.querySelector?.('.ql-editor')) {
            shouldProcess = true;
          }
        }
      });
    }
  });
  
  if (shouldProcess) {
    // Debounce processing
    setTimeout(processEditors, 100);
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Also process when page becomes visible (for single-page app navigation)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    setTimeout(processEditors, 500);
  }
});

