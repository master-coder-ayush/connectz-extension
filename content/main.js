// content/main.js
import { processEditors } from './ui.js';
import { initFloatingButton } from './floating_button.js';

// Initial processing
processEditors();
initFloatingButton();

// Set up observer to handle dynamic content loading
const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;

    mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
            shouldProcess = true;
        }
    });

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
