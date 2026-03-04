// content/toast.js

let stylesInjected = false;
let toastCounter = 0;
const MAX_TOASTS = 3;

/**
 * Inject toast CSS styles into the page (once).
 */
export function injectToastStyles() {
    if (stylesInjected) return;
    stylesInjected = true;

    const style = document.createElement('style');
    style.id = 'connectz-toast-styles';
    style.textContent = `
        /* ─── Toast Container ─── */
        #connectz-toast-container {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 10010;
            display: flex;
            flex-direction: column-reverse;
            gap: 12px;
            pointer-events: none;
            max-width: 400px;
            font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        }

        /* ─── Individual Toast ─── */
        .connectz-toast {
            pointer-events: auto;
            background: #1a1a2e;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.15);
            overflow: hidden;
            transform: translateX(120%);
            opacity: 0;
            transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease;
            border: 1px solid rgba(255,255,255,0.08);
            min-width: 340px;
            max-width: 400px;
        }

        .connectz-toast.connectz-toast--visible {
            transform: translateX(0);
            opacity: 1;
        }

        .connectz-toast.connectz-toast--dismissing {
            transform: translateX(120%);
            opacity: 0;
            transition: transform 0.35s cubic-bezier(0.55, 0, 1, 0.45), opacity 0.3s ease;
        }

        /* ─── Toast Header ─── */
        .connectz-toast__header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 14px 8px 14px;
        }

        .connectz-toast__icon {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            flex-shrink: 0;
        }

        .connectz-toast--success .connectz-toast__icon {
            background: rgba(16, 185, 129, 0.18);
            color: #34d399;
        }

        .connectz-toast--error .connectz-toast__icon {
            background: rgba(239, 68, 68, 0.18);
            color: #f87171;
        }

        .connectz-toast--info .connectz-toast__icon {
            background: rgba(251, 191, 36, 0.18);
            color: #fbbf24;
        }

        .connectz-toast__title {
            flex: 1;
            font-size: 13px;
            font-weight: 600;
            color: #f1f5f9;
            line-height: 1.3;
        }

        .connectz-toast__close {
            background: none;
            border: none;
            color: #64748b;
            font-size: 18px;
            cursor: pointer;
            padding: 0 2px;
            line-height: 1;
            transition: color 0.2s;
            flex-shrink: 0;
        }

        .connectz-toast__close:hover {
            color: #f1f5f9;
        }

        /* ─── Toast Body ─── */
        .connectz-toast__body {
            padding: 0 14px 10px 14px;
        }

        .connectz-toast__message {
            font-size: 12px;
            color: #94a3b8;
            line-height: 1.5;
            max-height: 80px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .connectz-toast__message::-webkit-scrollbar {
            width: 4px;
        }

        .connectz-toast__message::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.12);
            border-radius: 2px;
        }

        /* ─── Toast Actions ─── */
        .connectz-toast__actions {
            display: flex;
            gap: 6px;
            padding: 0 14px 12px 14px;
            flex-wrap: wrap;
        }

        .connectz-toast__action-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 6px 12px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.06);
            color: #e2e8f0;
            font-size: 11.5px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s, transform 0.15s;
            white-space: nowrap;
        }

        .connectz-toast__action-btn:hover {
            background: rgba(255,255,255,0.12);
            border-color: rgba(255,255,255,0.2);
            transform: translateY(-1px);
        }

        .connectz-toast__action-btn:active {
            transform: translateY(0);
        }

        .connectz-toast__action-btn--primary {
            background: rgba(251, 191, 36, 0.15);
            border-color: rgba(251, 191, 36, 0.3);
            color: #fbbf24;
        }

        .connectz-toast__action-btn--primary:hover {
            background: rgba(251, 191, 36, 0.25);
            border-color: rgba(251, 191, 36, 0.5);
        }

        .connectz-toast__action-btn .connectz-toast__action-icon {
            font-size: 13px;
            line-height: 1;
        }

        /* ─── Progress Bar ─── */
        .connectz-toast__progress {
            height: 3px;
            background: rgba(255,255,255,0.06);
            overflow: hidden;
        }

        .connectz-toast__progress-bar {
            height: 100%;
            width: 100%;
            transform-origin: left;
            transition: transform linear;
        }

        .connectz-toast--success .connectz-toast__progress-bar {
            background: linear-gradient(90deg, #34d399, #10b981);
        }

        .connectz-toast--error .connectz-toast__progress-bar {
            background: linear-gradient(90deg, #f87171, #ef4444);
        }

        .connectz-toast--info .connectz-toast__progress-bar {
            background: linear-gradient(90deg, #fbbf24, #f59e0b);
        }

        .connectz-toast--paused .connectz-toast__progress-bar {
            transition: none !important;
        }

        /* ─── Generating spinner toast (inline) ─── */
        .connectz-toast--generating .connectz-toast__icon {
            animation: connectz-spin 1s linear infinite;
            background: rgba(251, 191, 36, 0.18);
            color: #fbbf24;
        }

        @keyframes connectz-spin {
            to { transform: rotate(360deg); }
        }
    `;

    document.head.appendChild(style);
}

/**
 * Get or create the toast container element.
 * @returns {HTMLElement}
 */
function getToastContainer() {
    let container = document.getElementById('connectz-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'connectz-toast-container';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Enforce the max toast limit — remove oldest toasts if we exceed MAX_TOASTS.
 */
function enforceMaxToasts() {
    const container = getToastContainer();
    const toasts = container.querySelectorAll('.connectz-toast:not(.connectz-toast--dismissing)');
    if (toasts.length > MAX_TOASTS) {
        // Remove the oldest toasts (they are first in DOM, last visually due to column-reverse)
        const excess = toasts.length - MAX_TOASTS;
        for (let i = 0; i < excess; i++) {
            dismissToast(toasts[i]);
        }
    }
}

/**
 * Dismiss a toast with animation.
 * @param {HTMLElement} toastEl 
 */
function dismissToast(toastEl) {
    if (!toastEl || toastEl.classList.contains('connectz-toast--dismissing')) return;
    toastEl.classList.add('connectz-toast--dismissing');
    toastEl.classList.remove('connectz-toast--visible');

    // Clear any stored timer
    if (toastEl._dismissTimer) {
        clearTimeout(toastEl._dismissTimer);
        toastEl._dismissTimer = null;
    }

    setTimeout(() => {
        toastEl.remove();
    }, 400);
}

/**
 * Show a toast notification.
 *
 * @param {Object} options
 * @param {'success'|'error'|'info'|'generating'} options.type - Toast type
 * @param {string} options.title - Toast title text
 * @param {string} [options.message] - Toast body message (optional)
 * @param {number} [options.duration=15000] - Auto-dismiss duration in ms (0 = no auto-dismiss)
 * @param {Array<{label: string, icon?: string, onClick: Function, primary?: boolean}>} [options.actions] - Action buttons
 * @returns {{ dismiss: Function, element: HTMLElement }} Controller object
 */
export function showToast({ type = 'info', title, message = '', duration = 15000, actions = [] }) {
    injectToastStyles();

    const container = getToastContainer();
    const toastId = `connectz-toast-${++toastCounter}`;

    const iconMap = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
        generating: '⟳'
    };

    // Build the toast element
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `connectz-toast connectz-toast--${type}`;

    // Header
    const headerHTML = `
        <div class="connectz-toast__header">
            <div class="connectz-toast__icon">${iconMap[type] || 'ℹ'}</div>
            <div class="connectz-toast__title">${escapeHTML(title)}</div>
            <button class="connectz-toast__close" title="Dismiss">&times;</button>
        </div>
    `;

    // Body (only if message exists)
    const bodyHTML = message ? `
        <div class="connectz-toast__body">
            <div class="connectz-toast__message">${escapeHTML(message)}</div>
        </div>
    ` : '';

    // Actions
    let actionsHTML = '';
    if (actions.length > 0) {
        actionsHTML = `<div class="connectz-toast__actions">`;
        actions.forEach((action, idx) => {
            const primaryClass = action.primary ? ' connectz-toast__action-btn--primary' : '';
            const iconSpan = action.icon ? `<span class="connectz-toast__action-icon">${action.icon}</span>` : '';
            actionsHTML += `
                <button class="connectz-toast__action-btn${primaryClass}" data-action-index="${idx}">
                    ${iconSpan}${escapeHTML(action.label)}
                </button>
            `;
        });
        actionsHTML += `</div>`;
    }

    // Progress bar (only for auto-dismissing toasts)
    const progressHTML = duration > 0 ? `
        <div class="connectz-toast__progress">
            <div class="connectz-toast__progress-bar"></div>
        </div>
    ` : '';

    toast.innerHTML = headerHTML + bodyHTML + actionsHTML + progressHTML;

    // ─── Event Listeners ───
    // Close button
    toast.querySelector('.connectz-toast__close').addEventListener('click', () => {
        dismissToast(toast);
    });

    // Action buttons
    actions.forEach((action, idx) => {
        const btn = toast.querySelector(`[data-action-index="${idx}"]`);
        if (btn && action.onClick) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                action.onClick(e);

                // Visual feedback
                const originalText = btn.textContent;
                if (action.label === 'Copy') {
                    btn.textContent = '✓ Copied!';
                    setTimeout(() => { btn.textContent = originalText; }, 1500);
                }
            });
        }
    });

    // ─── Auto-dismiss with progress bar ───
    let remainingTime = duration;
    let startTime = null;
    let progressBar = toast.querySelector('.connectz-toast__progress-bar');

    function startTimer() {
        if (duration <= 0 || !progressBar) return;
        startTime = Date.now();
        progressBar.style.transition = `transform ${remainingTime}ms linear`;

        // Force reflow before setting transform
        void progressBar.offsetWidth;
        progressBar.style.transform = 'scaleX(0)';

        toast._dismissTimer = setTimeout(() => {
            dismissToast(toast);
        }, remainingTime);
    }

    function pauseTimer() {
        if (duration <= 0) return;
        if (toast._dismissTimer) {
            clearTimeout(toast._dismissTimer);
            toast._dismissTimer = null;
        }
        if (startTime) {
            remainingTime -= (Date.now() - startTime);
            remainingTime = Math.max(remainingTime, 0);
        }
        toast.classList.add('connectz-toast--paused');

        // Freeze progress bar at current position
        if (progressBar) {
            const computed = getComputedStyle(progressBar);
            progressBar.style.transform = computed.transform;
        }
    }

    function resumeTimer() {
        if (duration <= 0) return;
        toast.classList.remove('connectz-toast--paused');
        startTimer();
    }

    // Hover to pause
    toast.addEventListener('mouseenter', pauseTimer);
    toast.addEventListener('mouseleave', resumeTimer);

    // ─── Insert & Animate ───
    container.appendChild(toast);
    enforceMaxToasts();

    // Trigger slide-in on next frame
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add('connectz-toast--visible');
            startTimer();
        });
    });

    // Return controller
    return {
        dismiss: () => dismissToast(toast),
        element: toast
    };
}

/**
 * Escape HTML to prevent XSS in toast content.
 * @param {string} str 
 * @returns {string}
 */
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
