// popup/logic.js

/**
 * Initialize generation logic and event listeners.
 */
export function initLogic() {
    // Generate Post Logic
    const generatePostBtn = document.getElementById('generatePostBtn');
    const roughPostContent = document.getElementById('roughPostContent');
    const postResultContainer = document.getElementById('postResultContainer');
    const generatedPostOutput = document.getElementById('generatedPostOutput');
    const copyPostBtn = document.getElementById('copyPostBtn');

    generatePostBtn.addEventListener('click', () => {
        const content = roughPostContent.value.trim();
        if (!content) {
            alert('Please enter a rough outline first.');
            return;
        }

        generatePostBtn.disabled = true;
        generatePostBtn.textContent = 'Generating...';
        postResultContainer.style.display = 'none';

        chrome.runtime.sendMessage(
            { action: 'generatePost', roughPostContent: content },
            (response) => {
                generatePostBtn.disabled = false;
                generatePostBtn.textContent = 'Generate Post';

                if (response && response.success) {
                    generatedPostOutput.textContent = response.post;
                    postResultContainer.style.display = 'block';
                } else {
                    alert('Error: ' + (response?.error || 'Unknown error occurred'));
                }
            }
        );
    });

    copyPostBtn.addEventListener('click', () => {
        const text = generatedPostOutput.textContent;
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyPostBtn.textContent;
            copyPostBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyPostBtn.textContent = originalText;
            }, 2000);
        });
    });

    // Generate Comment Logic
    const generateCommentBtn = document.getElementById('generateCommentBtn');
    const postContentForComment = document.getElementById('postContentForComment');
    const optionalComment = document.getElementById('optionalComment');
    const commentResultContainer = document.getElementById('commentResultContainer');
    const generatedCommentOutput = document.getElementById('generatedCommentOutput');
    const copyCommentBtn = document.getElementById('copyCommentBtn');

    generateCommentBtn.addEventListener('click', () => {
        const postContent = postContentForComment.value.trim();
        const existingComment = optionalComment.value.trim();

        if (!postContent) {
            alert('Please enter the post content.');
            return;
        }

        generateCommentBtn.disabled = true;
        generateCommentBtn.textContent = 'Generating...';
        commentResultContainer.style.display = 'none';

        let action = 'generateComment';
        let payload = { postContent };

        if (existingComment) {
            action = 'rephraseComment';
            payload = { postContent, existingComment };
        }

        chrome.runtime.sendMessage(
            { action, ...payload },
            (response) => {
                generateCommentBtn.disabled = false;
                generateCommentBtn.textContent = 'Generate Comment';

                if (response && response.success) {
                    generatedCommentOutput.textContent = response.comment;
                    commentResultContainer.style.display = 'block';
                } else {
                    alert('Error: ' + (response?.error || 'Unknown error occurred'));
                }
            }
        );
    });

    copyCommentBtn.addEventListener('click', () => {
        const text = generatedCommentOutput.textContent;
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyCommentBtn.textContent;
            copyCommentBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyCommentBtn.textContent = originalText;
            }, 2000);
        });
    });
}
