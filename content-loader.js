// content-loader.js
/**
 * Content Script Loader
 * 
 * ISSUE: Chrome extensions do not natively support ES modules (import/export syntax) 
 * directly in content scripts defined in manifest.json. Using "type": "module" in 
 * content_scripts is not yet fully supported or stable across all contexts.
 * 
 * SOLUTION: This loader script serves as a bridge. It runs as a standard script 
 * and uses dynamic import() to load the actual entry point ('content/main.js') 
 * as a module. This allows us to organize our content script code into modular 
 * files (dom.js, ui.js, etc.) while ensuring it loads correctly in the browser.
 * 
 * Note: The imported files must be exposed via 'web_accessible_resources' in manifest.json.
 */
(async () => {
    const src = chrome.runtime.getURL('content/main.js');
    const contentMain = await import(src);
})();
