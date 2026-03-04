// popup/main.js
import { initNavigation } from './navigation.js';
import { initLogic } from './logic.js';
import { initAnalytics } from './analytics.js';
import { getBaseUrl } from './utils.js';

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
        const loginContainer = document.getElementById("loginContainer");
        const featuresContainer = document.getElementById("featuresContainer");
        const loginBtn = document.getElementById("loginBtn");

        // Items within features container
        const linkedinWarning = document.getElementById("linkedinWarning");
        const openLinkedInBtn = document.getElementById("openLinkedInBtn");

        // Reset display states (using classes now)
        loginContainer.classList.add("hidden");
        featuresContainer.classList.add("hidden");
        linkedinWarning.classList.add("hidden");
        openLinkedInBtn.classList.add("hidden");

        if (logged_in) {
            // User IS Logged In -> Show Features
            featuresContainer.classList.remove("hidden");

            // Check LinkedIn context
            if (!isOnLinkedIn) {
                linkedinWarning.classList.remove("hidden");
                openLinkedInBtn.classList.remove("hidden");

                // Set up LinkedIn button
                openLinkedInBtn.onclick = () => {
                    chrome.tabs.create({ url: "https://www.linkedin.com/" });
                };
            }
        } else {
            // User is NOT Logged In -> Show Login Prompt
            loginContainer.classList.remove("hidden");

            // Set the login URL
            const baseUrl = await getBaseUrl();
            loginBtn.onclick = () => {
                chrome.tabs.create({ url: baseUrl });
            };
        }
    });
}

// Initialize
updateStatus();
initNavigation();
initLogic();
initAnalytics();

// Dashboard button handler
document.getElementById('visitDashboardBtn').addEventListener('click', async () => {
    const baseUrl = await getBaseUrl();
    chrome.tabs.create({ url: `${baseUrl}/dashboard` });
});

// Removed manual refresh button as per requirements
// Status updates rely on initialization and storage changes

// Listen for storage changes to update status in real-time
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.logged_in) {
        updateStatus();
    }
});
