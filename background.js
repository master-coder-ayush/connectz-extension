// Background service worker to check login status periodically

// Get or detect the base URL (dev or production)
async function getBaseUrl() {
  const stored = await chrome.storage.local.get("base_url");
  if (stored.base_url) {
    return stored.base_url;
  }
  
  // Try dev first
  try {
    const res = await fetch("http://127.0.0.1:3000/api/auth/status", {
      credentials: "include"
    });
    if (res.ok) {
      const devUrl = "http://127.0.0.1:3000";
      await chrome.storage.local.set({ base_url: devUrl });
      return devUrl;
    }
  } catch (error) {
    // Dev server not reachable, use production
  }
  
  // Fallback to production
  const prodUrl = "https://connectz.site";
  await chrome.storage.local.set({ base_url: prodUrl });
  return prodUrl;
}

async function checkLogin() {
  try {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/status`, {
      credentials: "include"
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    console.log("Login status:", data.logged_in);
    
    // Store login status in chrome storage
    await chrome.storage.local.set({ logged_in: data.logged_in });
    
    // Update badge to show status
    if (data.logged_in) {
      chrome.action.setBadgeText({ text: "✓" });
      chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (error) {
    console.error("Error checking login:", error);
    // On error, assume not logged in
    await chrome.storage.local.set({ logged_in: false });
    chrome.action.setBadgeText({ text: "" });
  }
}

async function generateCommentResponse(postContent) {
  if (!postContent || !postContent.trim()) {
    throw new Error("Post content is empty.");
  }

  const baseUrl = await getBaseUrl();
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/comments/generate`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      linkedin_post_content: postContent,
    }),
  });

  if (!res.ok) {
    throw new Error("Unable to generate comment. Please try again later.");
  }

  let data = {};
  try {
    data = await res.json();
  } catch (error) {
    throw new Error("Unable to parse API response.");
  }

  const comment =
    data.comment ||
    data.generated_comment ||
    data.comment_text ||
    data.result ||
    data.data ||
    null;

  if (!comment || !comment.trim()) {
    throw new Error("API did not return a comment.");
  }

  return comment.trim();
}

async function generatePostResponse(roughPostContent) {
  if (!roughPostContent || !roughPostContent.trim()) {
    throw new Error("Rough post content is empty.");
  }

  const baseUrl = await getBaseUrl();
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/posts/generate`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      rough_post_content: roughPostContent,
    }),
  });

  if (!res.ok) {
    throw new Error("Unable to generate post. Please try again later.");
  }

  let data = {};
  try {
    data = await res.json();
  } catch (error) {
    throw new Error("Unable to parse API response.");
  }

  const post =
    data.post ||
    data.generated_post ||
    data.post_text ||
    data.result ||
    data.data ||
    null;

  if (!post || !post.trim()) {
    throw new Error("API did not return a post.");
  }

  return post.trim();
}

async function generateRephraseCommentResponse(postContent, existingComment) {
  if (!postContent || !postContent.trim()) {
    throw new Error("Post content is empty.");
  }

  if (!existingComment || !existingComment.trim()) {
    throw new Error("Existing comment is empty.");
  }

  const baseUrl = await getBaseUrl();
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/comments/rephrase`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      linkedin_post_content: postContent,
      existing_comment: existingComment
    }),
  });

  if (!res.ok) {
    throw new Error("Unable to rephrase comment. Please try again later.");
  }

  let data = {};
  try {
    data = await res.json();
  } catch (error) {
    throw new Error("Unable to parse API response.");
  }

  const rephraseComment =
    data.rephrased_comment ||
    data.comment ||
    data.result ||
    data.data ||
    null;

  if (!rephraseComment || !rephraseComment.trim()) {
    throw new Error("API did not return a rephrased comment.");
  }

  return rephraseComment.trim();
}

// Check login status immediately when extension starts
checkLogin();

// Set up alarm to check login status every 10 seconds (0.166 minutes)
chrome.alarms.create("checkLogin", { periodInMinutes: 0.166 });

// Listen for alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkLogin") {
    checkLogin();
  }
});

// Handle messages from popup to refresh login status
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkLogin") {
    checkLogin().then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep the message channel open for async response
  } else if (request.action === "generateComment") {
    generateCommentResponse(request.postContent)
      .then((comment) => {
        sendResponse({ success: true, comment });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message || "Unknown error" });
      });
    return true;
  } else if (request.action === "generatePost") {
    generatePostResponse(request.roughPostContent)
      .then((post) => {
        sendResponse({ success: true, post });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message || "Unknown error" });
      });
    return true;
  } else if (request.action === "rephraseComment") {
    generateRephraseCommentResponse(request.postContent, request.existingComment)
      .then((rephraseComment) => {
        sendResponse({ success: true, comment: rephraseComment });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message || "Unknown error" });
      });
    return true;
  }
});
