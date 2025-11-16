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
