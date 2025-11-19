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

// Function to create and add + button next to editor
function addPlusButton(editor) {
  // Find the editor wrapper (usually .ql-container or similar)
  const editorWrapper = editor.closest('.ql-container') || 
                       editor.closest('[class*="comment"]') ||
                       editor.parentElement;

  if (!editorWrapper) return;

  // Check if button already exists
  let plusBtn = editorWrapper.querySelector('.connectz-plus-btn');
  
  if (!plusBtn) {
    // Create + button
    plusBtn = document.createElement('button');
    plusBtn.className = 'connectz-plus-btn';
    plusBtn.innerHTML = '+';
    plusBtn.title = 'Insert text at cursor';
    plusBtn.style.cssText = `
      position: absolute;
      right: 10px;
      top: 10px;
      width: 28px;
      height: 28px;
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
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: background-color 0.2s;
    `;

    // Hover effect
    plusBtn.addEventListener('mouseenter', () => {
      plusBtn.style.backgroundColor = '#005885';
    });
    plusBtn.addEventListener('mouseleave', () => {
      plusBtn.style.backgroundColor = '#0077b5';
    });

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
        // Extract post content from the DOM
        const postContent = extractPostContent(editor);

        if (!postContent) {
          throw new Error("Unable to extract post content from LinkedIn.");
        }

        const generatedComment = await requestGeneratedComment(postContent);

        // Small delay to ensure editor is ready
        setTimeout(() => {
          insertAtCursor(generatedComment, editor);
          // Keep button visible by refocusing editor
          editor.focus();
        }, 50);
      } catch (error) {
        console.error("Error generating comment:", error);
        const fallbackMessage =
          error?.message ||
          "Unable to generate comment. Please try again in a moment.";
        setTimeout(() => {
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

    // Make editor container relative positioned if not already
    if (getComputedStyle(editorWrapper).position === 'static') {
      editorWrapper.style.position = 'relative';
    }

    // Insert button into editor wrapper
    editorWrapper.appendChild(plusBtn);
  }

  // Track if button should stay visible
  let buttonShouldStayVisible = false;

  // Show/hide button based on focus
  function updateButtonVisibility() {
    const isFocused = document.activeElement === editor || 
                     editor.contains(document.activeElement);
    
    // Show if editor is focused or button should stay visible
    if (isFocused || buttonShouldStayVisible) {
      plusBtn.style.display = 'flex';
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

