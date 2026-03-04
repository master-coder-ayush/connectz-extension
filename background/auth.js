// background/auth.js

/**
 * Get or detect the base URL (dev or production).
 * Checks chrome.storage.local first, then tries to ping the dev server.
 * Fallbacks to production URL if dev server is unreachable.
 * @returns {Promise<string>} The base URL.
 */
export async function getBaseUrl() {
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
    const prodUrl = "http://16.171.166.83";
    await chrome.storage.local.set({ base_url: prodUrl });
    return prodUrl;
}

/**
 * Check login status against the backend API.
 * Updates the extension badge and local storage based on the result.
 */
export async function checkLogin() {
    try {
        const baseUrl = await getBaseUrl();
        const res = await fetch(`${baseUrl}/api/auth/status`, {
            credentials: "include"
        });

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();

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
