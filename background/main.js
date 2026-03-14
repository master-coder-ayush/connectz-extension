// background/main.js
import { checkLogin } from './auth.js';
import {
    generateCommentResponse,
    generatePostResponse,
    generateRephraseCommentResponse,
    getWeeklyStats,
    getBadgesStats
} from './api.js';

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        setTimeout(() => {
            chrome.tabs.create({ url: "https://connectz.one/welcome" });
        }, 1200);
    }
});

// Check login status immediately when extension starts
checkLogin();

// Set up alarm to check login status every 10 seconds (0.166 minutes)
chrome.alarms.create("checkLogin", { periodInMinutes: 1 });

// Listen for alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkLogin") {
        checkLogin();
    }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkLogin") {
        checkLogin().then(() => {
            sendResponse({ success: true });
        });
        return true; // Keep the message channel open for async response
    } else if (request.action === "getWeeklyStats") {
        getWeeklyStats()
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === "getBadgesStats") {
        getBadgesStats()
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
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
