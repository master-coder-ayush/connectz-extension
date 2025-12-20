// popup/navigation.js

// Navigation Elements
const mainMenu = document.getElementById('mainMenu');
const generatePostView = document.getElementById('generatePostView');
const generateCommentView = document.getElementById('generateCommentView');

/**
 * Switch the current view and save the state.
 * @param {string} viewName - The ID of the view to show.
 */
export function switchView(viewName) {
    // Hide all views first
    mainMenu.classList.add('hidden');
    generatePostView.classList.add('hidden');
    generateCommentView.classList.add('hidden');

    // Show requested view
    if (viewName === 'generatePostView') {
        generatePostView.classList.remove('hidden');
    } else if (viewName === 'generateCommentView') {
        generateCommentView.classList.remove('hidden');
    } else {
        mainMenu.classList.remove('hidden');
    }

    // Save state
    chrome.storage.local.set({ last_view: viewName });
}

/**
 * Initialize navigation event listeners.
 */
export function initNavigation() {
    // Navigation Buttons
    document.getElementById('goToGeneratePostBtn').addEventListener('click', () => {
        switchView('generatePostView');
    });

    document.getElementById('goToGenerateCommentBtn').addEventListener('click', () => {
        switchView('generateCommentView');
    });

    document.getElementById('backFromPostBtn').addEventListener('click', () => {
        switchView('mainMenu');
    });

    document.getElementById('backFromCommentBtn').addEventListener('click', () => {
        switchView('mainMenu');
    });

    // Restore last view on load
    chrome.storage.local.get(['last_view'], (result) => {
        if (result.last_view) {
            switchView(result.last_view);
        } else {
            // Default to main menu
            switchView('mainMenu');
        }
    });
}
