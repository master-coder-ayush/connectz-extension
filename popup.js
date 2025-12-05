// Popup script to display login status

// Get the base URL (dev or production)
function getBaseUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get("base_url", ({ base_url }) => {
      if (base_url) {
        resolve(base_url);
      } else {
        // Try to detect environment - check if dev server is reachable
        fetch("http://127.0.0.1:3000/api/auth/status", {
          credentials: "include"
        })
          .then(() => {
            // Dev server is reachable
            const devUrl = "http://127.0.0.1:3000";
            chrome.storage.local.set({ base_url: devUrl });
            resolve(devUrl);
          })
          .catch(() => {
            // Dev server not reachable, use production
            const prodUrl = "https://connectz.site";
            chrome.storage.local.set({ base_url: prodUrl });
            resolve(prodUrl);
          });
      }
    });
  });
}

// Check if current tab is on LinkedIn
function isLinkedInUrl(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'www.linkedin.com' || urlObj.hostname === 'linkedin.com';
  } catch (e) {
    return false;
  }
}

// Get current active tab
function getCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
}

async function updateStatus() {
  const currentTab = await getCurrentTab();
  const isOnLinkedIn = isLinkedInUrl(currentTab?.url);

  chrome.storage.local.get("logged_in", async ({ logged_in }) => {
    const statusElement = document.getElementById("status");
    const loginBtn = document.getElementById("loginBtn");
    const linkedinWarning = document.getElementById("linkedinWarning");
    const openLinkedInBtn = document.getElementById("openLinkedInBtn");

    // Hide all buttons and warnings initially
    loginBtn.style.display = "none";
    linkedinWarning.style.display = "none";
    openLinkedInBtn.style.display = "none";

    if (logged_in === undefined) {
      // Status not yet checked
      statusElement.textContent = "Checking...";
      statusElement.className = "checking";
    } else if (logged_in) {
      statusElement.textContent = "User is Logged In";
      statusElement.className = "logged-in";

      // If logged in but not on LinkedIn, show warning and button
      if (!isOnLinkedIn) {
        linkedinWarning.style.display = "block";
        openLinkedInBtn.style.display = "block";

        // Set up LinkedIn button
        openLinkedInBtn.onclick = () => {
          chrome.tabs.create({ url: "https://www.linkedin.com/" });
        };
      }
    } else {
      statusElement.textContent = "User is NOT Logged In";
      statusElement.className = "logged-out";
      loginBtn.style.display = "block";

      // Set the login URL
      const baseUrl = await getBaseUrl();
      loginBtn.onclick = () => {
        chrome.tabs.create({ url: baseUrl });
      };
    }
  });
}

// Update status when popup opens
updateStatus();

// Refresh button handler
document.getElementById("refreshBtn").addEventListener("click", () => {
  // Trigger background script to check login
  chrome.runtime.sendMessage({ action: "checkLogin" });

  // Update status after a short delay (this will also re-check current tab)
  setTimeout(updateStatus, 500);
});

// Listen for storage changes to update status in real-time
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.logged_in) {
    updateStatus();
  }
});

// --- New Features Logic ---

// Navigation Elements
const mainMenu = document.getElementById('mainMenu');
const generatePostView = document.getElementById('generatePostView');
const generateCommentView = document.getElementById('generateCommentView');

// Function to switch view and save state
function switchView(viewName) {
  // Hide all views first
  mainMenu.style.display = 'none';
  generatePostView.style.display = 'none';
  generateCommentView.style.display = 'none';

  // Show requested view
  if (viewName === 'generatePostView') {
    generatePostView.style.display = 'block';
  } else if (viewName === 'generateCommentView') {
    generateCommentView.style.display = 'block';
  } else {
    mainMenu.style.display = 'block';
  }

  // Save state
  chrome.storage.local.set({ last_view: viewName });
}

// Restore last view on load
chrome.storage.local.get(['last_view'], (result) => {
  if (result.last_view) {
    switchView(result.last_view);
  } else {
    // Default to main menu
    switchView('mainMenu');
  }
});

// Navigation Buttons
document.getElementById('goToGeneratePostBtn').addEventListener('click', () => {
  switchView('generatePostView');
});

document.getElementById('goToGenerateCommentBtn').addEventListener('click', () => {
  switchView('generateCommentView');
});

document.getElementById('backFromPostBtn').addEventListener('click', () => {
  switchView('mainMenu');
});

document.getElementById('backFromCommentBtn').addEventListener('click', () => {
  switchView('mainMenu');
});

// Generate Post Logic
const generatePostBtn = document.getElementById('generatePostBtn');
const roughPostContent = document.getElementById('roughPostContent');
const postResultContainer = document.getElementById('postResultContainer');
const generatedPostOutput = document.getElementById('generatedPostOutput');
const copyPostBtn = document.getElementById('copyPostBtn');

generatePostBtn.addEventListener('click', () => {
  const content = roughPostContent.value.trim();
  if (!content) {
    alert('Please enter a rough outline first.');
    return;
  }

  generatePostBtn.disabled = true;
  generatePostBtn.textContent = 'Generating...';
  postResultContainer.style.display = 'none';

  chrome.runtime.sendMessage(
    { action: 'generatePost', roughPostContent: content },
    (response) => {
      generatePostBtn.disabled = false;
      generatePostBtn.textContent = 'Generate Post';

      if (response && response.success) {
        generatedPostOutput.textContent = response.post;
        postResultContainer.style.display = 'block';
      } else {
        alert('Error: ' + (response?.error || 'Unknown error occurred'));
      }
    }
  );
});

copyPostBtn.addEventListener('click', () => {
  const text = generatedPostOutput.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const originalText = copyPostBtn.textContent;
    copyPostBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyPostBtn.textContent = originalText;
    }, 2000);
  });
});

// Generate Comment Logic
const generateCommentBtn = document.getElementById('generateCommentBtn');
const postContentForComment = document.getElementById('postContentForComment');
const optionalComment = document.getElementById('optionalComment');
const commentResultContainer = document.getElementById('commentResultContainer');
const generatedCommentOutput = document.getElementById('generatedCommentOutput');
const copyCommentBtn = document.getElementById('copyCommentBtn');

generateCommentBtn.addEventListener('click', () => {
  const postContent = postContentForComment.value.trim();
  const existingComment = optionalComment.value.trim();

  if (!postContent) {
    alert('Please enter the post content.');
    return;
  }

  generateCommentBtn.disabled = true;
  generateCommentBtn.textContent = 'Generating...';
  commentResultContainer.style.display = 'none';

  let action = 'generateComment';
  let payload = { postContent };

  if (existingComment) {
    action = 'rephraseComment';
    payload = { postContent, existingComment };
  }

  chrome.runtime.sendMessage(
    { action, ...payload },
    (response) => {
      generateCommentBtn.disabled = false;
      generateCommentBtn.textContent = 'Generate Comment';

      if (response && response.success) {
        generatedCommentOutput.textContent = response.comment;
        commentResultContainer.style.display = 'block';
      } else {
        alert('Error: ' + (response?.error || 'Unknown error occurred'));
      }
    }
  );
});

copyCommentBtn.addEventListener('click', () => {
  const text = generatedCommentOutput.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const originalText = copyCommentBtn.textContent;
    copyCommentBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyCommentBtn.textContent = originalText;
    }, 2000);
  });
});
