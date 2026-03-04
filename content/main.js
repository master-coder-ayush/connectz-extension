// content/main.js
import { processEditors } from './ui.js';
import { initFloatingButton } from './floating_button.js';
import { injectToastStyles } from './toast.js';

// Initial processing
processEditors();
initFloatingButton();
injectToastStyles();

// Set up observer to handle dynamic content loading (e.g. new comments appearing)
const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;

    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            shouldProcess = true;
            break;
        }
    }

    if (shouldProcess) {
        processEditors();
    }
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Also check periodically just in case
setInterval(processEditors, 2000);

/**
 * Handle LinkedIn's soft navigations (pushState / popstate).
 * LinkedIn is a SPA — clicking "New posts" or navigating between pages
 * does NOT trigger a full page reload. We re-initialize on each navigation.
 */
function onSoftNavigation() {
    // Give LinkedIn's React a moment to render the new content
    setTimeout(() => {
        // Reset processed state on all old editors so they get re-attached
        document.querySelectorAll('[data-connectz-processed]').forEach(el => {
            delete el.dataset.connectzProcessed;
        });
        processEditors();
    }, 500);
}

// Patch history.pushState to detect programmatic navigation
const _originalPushState = history.pushState.bind(history);
history.pushState = function (...args) {
    _originalPushState(...args);
    onSoftNavigation();
};

// Also handle browser back/forward
window.addEventListener('popstate', onSoftNavigation);

