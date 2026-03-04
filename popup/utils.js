export function getBaseUrl() {
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
                        const prodUrl = "http://16.171.166.83";
                        chrome.storage.local.set({ base_url: prodUrl });
                        resolve(prodUrl);
                    });
            }
        });
    });
}
