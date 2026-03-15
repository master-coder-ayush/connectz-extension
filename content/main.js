// content/main.js
import { processEditors } from './ui.js';
import { initFloatingButton } from './floating_button.js';
import { injectToastStyles } from './toast.js';

let observedBody = null;
const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;

    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            shouldProcess = true;
            break;
        }
    }

    if (shouldProcess) {
        safeProcessEditors();
    }
});

function ensureObserver() {
    if (!document.body) return;
    if (observedBody === document.body) return;
    try {
        observer.disconnect();
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        observedBody = document.body;
    } catch (error) {
        console.warn('Connect Z observer attach failed:', error);
    }
}

function safeProcessEditors() {
    try {
        processEditors();
    } catch (error) {
        console.error('Connect Z processEditors error:', error);
    }
}

function bootstrap(reason = 'init') {
    try {
        injectToastStyles();
    } catch (error) {
        console.warn('Connect Z toast style inject failed:', error);
    }

    try {
        initFloatingButton();
    } catch (error) {
        console.warn('Connect Z floating button init failed:', error);
    }

    ensureObserver();
    safeProcessEditors();
}

// Initial processing
bootstrap('initial');

// Also check periodically just in case
setInterval(() => {
    ensureObserver();
    if (!document.getElementById('connectz-floating-btn')) {
        initFloatingButton();
    }
    if (!document.getElementById('connectz-toast-styles')) {
        injectToastStyles();
    }
    safeProcessEditors();
}, 2000);

/**
 * Handle LinkedIn's soft navigations (pushState / popstate).
 * LinkedIn is a SPA � clicking "New posts" or navigating between pages
 * does NOT trigger a full page reload. We re-initialize on each navigation.
 */
function onSoftNavigation() {
    // Give LinkedIn's React a moment to render the new content
    setTimeout(() => {
        // Reset processed state on all old editors so they get re-attached
        document.querySelectorAll('[data-connectz-processed]').forEach(el => {
            delete el.dataset.connectzProcessed;
        });
        bootstrap('soft-navigation');
    }, 500);
}

// Patch history.pushState to detect programmatic navigation
const _originalPushState = history.pushState.bind(history);
history.pushState = function (...args) {
    _originalPushState(...args);
    onSoftNavigation();
};

// Patch history.replaceState too (LinkedIn uses it in some flows)
const _originalReplaceState = history.replaceState.bind(history);
history.replaceState = function (...args) {
    _originalReplaceState(...args);
    onSoftNavigation();
};

// Also handle browser back/forward
window.addEventListener('popstate', onSoftNavigation);

// Fallback: watch URL changes that do not trigger push/replace/pop
let lastUrl = location.href;
setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        onSoftNavigation();
    }
}, 800);

// If the tab was backgrounded, re-bootstrap when visible again
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        bootstrap('visibility');
    }
});
