// background/api.js
import { getBaseUrl } from './auth.js';

// ---------------------------------------------------------------------------
// Async generation polling config
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 60000; // ~60s per plan

// ---------------------------------------------------------------------------
// Small utility helpers
// ---------------------------------------------------------------------------
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseJsonSafe(response) {
    try {
        return await response.json();
    } catch (err) {
        return null;
    }
}

function extractErrorMessage(data, fallback) {
    const message =
        data?.error_message ||
        data?.error ||
        data?.message ||
        fallback;
    return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}

function readGeneratedText(data, keys) {
    if (!data) return null;
    for (const key of keys) {
        const value = data[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return null;
}

async function ensureOkOrThrow(response, fallbackMessage) {
    if (response.ok) return;
    const errorData = await parseJsonSafe(response);
    throw new Error(extractErrorMessage(errorData, fallbackMessage));
}

// ---------------------------------------------------------------------------
// Polling flow for new async contract:
// GET /api/comments/:id or GET /api/posts/:id until completed/failed/timeout
// ---------------------------------------------------------------------------
async function pollJobUntilFinished(pollUrl, completionKeys) {
    const startedAt = Date.now();
    while (true) {
        const response = await fetch(pollUrl, {
            method: "GET",
            credentials: "include",
        });

        await ensureOkOrThrow(response, `HTTP request failed with status ${response.status}`);
        const data = await parseJsonSafe(response);
        if (!data) {
            throw new Error("Unable to parse polling API response.");
        }

        const status = data?.status;
        if (status === 'completed') {
            const generatedText = readGeneratedText(data, [
                'generated_content',
                ...completionKeys,
            ]);
            if (!generatedText) {
                throw new Error("API did not return generated content.");
            }
            return generatedText;
        }

        if (status === 'failed') {
            throw new Error(extractErrorMessage(data, "Generation failed."));
        }

        // pending (or unknown in-progress state) => keep polling until timeout
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            throw new Error("Request timed out. Please try again.");
        }
        await sleep(POLL_INTERVAL_MS);
    }
}

// ---------------------------------------------------------------------------
// One shared entry for all 3 generation APIs
// 1) POST request
// 2) If 202 => read id and poll
// 3) Else keep backward compatibility with old sync response bodies
// ---------------------------------------------------------------------------
async function runGenerationRequest({
    postEndpoint,
    postBody,
    pollUrlFactory,
    completionKeys = [],
    backCompatKeys,
    defaultErrorMessage,
}) {
    const response = await fetch(postEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(postBody),
    });

    // New async backend contract: POST returns 202 + { id, status: "pending" }
    if (response.status === 202) {
        const acceptedData = await parseJsonSafe(response);
        const jobId = acceptedData?.id;
        if (!jobId) {
            throw new Error("Async job id missing from response.");
        }
        const pollUrl = pollUrlFactory(jobId);
        return await pollJobUntilFinished(pollUrl, completionKeys);
    }

    // Backward compatibility for old synchronous API behavior
    await ensureOkOrThrow(response, defaultErrorMessage);
    const syncData = await parseJsonSafe(response);
    const generatedText = readGeneratedText(syncData, backCompatKeys);

    if (!generatedText) {
        throw new Error("API did not return generated content.");
    }
    return generatedText;
}

/**
 * Generate a comment based on post content.
 * @param {string} postContent - The content of the LinkedIn post.
 * @returns {Promise<string>} The generated comment.
 */
export async function generateCommentResponse(postContent) {
    if (!postContent || !postContent.trim()) {
        throw new Error("Post content is empty.");
    }

    const rootUrl = (await getBaseUrl()).replace(/\/$/, "");
    return await runGenerationRequest({
        postEndpoint: `${rootUrl}/api/comments/generate`,
        postBody: { linkedin_post_content: postContent },
        pollUrlFactory: (id) => `${rootUrl}/api/comments/${id}`,
        completionKeys: [
            'generated_comment',
            'comment',
            'comment_text',
            'result',
            'data',
        ],
        backCompatKeys: [
            'comment',
            'generated_comment',
            'comment_text',
            'result',
            'data',
        ],
        defaultErrorMessage: "Unable to generate comment. Please try again later.",
    });
}

/**
 * Generate a post based on a rough outline.
 * @param {string} roughPostContent - The rough outline or topic.
 * @returns {Promise<string>} The generated post.
 */
export async function generatePostResponse(roughPostContent) {
    if (!roughPostContent || !roughPostContent.trim()) {
        throw new Error("Rough post content is empty.");
    }

    const rootUrl = (await getBaseUrl()).replace(/\/$/, "");
    return await runGenerationRequest({
        postEndpoint: `${rootUrl}/api/posts/generate`,
        postBody: { rough_post_content: roughPostContent },
        pollUrlFactory: (id) => `${rootUrl}/api/posts/${id}`,
        completionKeys: [
            'generated_post',
            'post',
            'post_text',
            'result',
            'data',
        ],
        backCompatKeys: [
            'post',
            'generated_post',
            'post_text',
            'result',
            'data',
        ],
        defaultErrorMessage: "Unable to generate post. Please try again later.",
    });
}

/**
 * Rephrase an existing comment.
 * @param {string} postContent - The content of the LinkedIn post.
 * @param {string} existingComment - The comment to rephrase.
 * @returns {Promise<string>} The rephrased comment.
 */
export async function generateRephraseCommentResponse(postContent, existingComment) {
    if (!postContent || !postContent.trim()) {
        throw new Error("Post content is empty.");
    }

    if (!existingComment || !existingComment.trim()) {
        throw new Error("Existing comment is empty.");
    }

    const rootUrl = (await getBaseUrl()).replace(/\/$/, "");
    return await runGenerationRequest({
        postEndpoint: `${rootUrl}/api/comments/rephrase`,
        postBody: {
            linkedin_post_content: postContent,
            existing_comment: existingComment
        },
        pollUrlFactory: (id) => `${rootUrl}/api/comments/${id}`,
        completionKeys: [
            'generated_comment',
            'rephrased_comment',
            'comment',
            'comment_text',
            'result',
            'data',
        ],
        backCompatKeys: [
            'rephrased_comment',
            'comment',
            'result',
            'data',
        ],
        defaultErrorMessage: "Unable to rephrase comment. Please try again later.",
    });
}

/**
 * Fetch weekly user analytics stats.
 * @returns {Promise<Object>}
 */
export async function getWeeklyStats() {
    try {
        const baseUrl = await getBaseUrl();
        const endpoint = `${baseUrl.replace(/\/$/, "")}/api/stats/weekly`;

        const res = await fetch(endpoint, {
            method: "GET",
            credentials: "include",
        });

        if (!res.ok) {
            let errorData = null;
            try { errorData = await res.json(); } catch (err) { }
            if (errorData && errorData.error) throw new Error(errorData.error);
            throw new Error(`HTTP request failed with status ${res.status}`);
        }
        return await res.json();
    } catch (e) {
        console.warn("Failed to fetch weekly stats:", e);
        throw e;
    }
}

/**
 * Fetch user badges and achievements.
 * @returns {Promise<Object>}
 */
export async function getBadgesStats() {
    try {
        const baseUrl = await getBaseUrl();
        const endpoint = `${baseUrl.replace(/\/$/, "")}/api/stats/badges`;

        const res = await fetch(endpoint, {
            method: "GET",
            credentials: "include",
        });

        if (!res.ok) {
            let errorData = null;
            try { errorData = await res.json(); } catch (err) { }
            if (errorData && errorData.error) throw new Error(errorData.error);
            throw new Error(`HTTP request failed with status ${res.status}`);
        }
        return await res.json();
    } catch (e) {
        console.warn("Failed to fetch badges stats:", e);
        throw e;
    }
}

// Mock data for testing and fallback, CAN BE REMOVED in production
function getMockData(type) {
    if (type === 'weekly') {
        return {
            today_count: 5,
            weekly_total: 42,
            streak: 4,
            daily_breakdown: [
                { date: 'Mon', count: 2 },
                { date: 'Tue', count: 5 },
                { date: 'Wed', count: 8 },
                { date: 'Thu', count: 4 },
                { date: 'Fri', count: 12 },
                { date: 'Sat', count: 6 },
                { date: 'Sun', count: 5 }
            ]
        };
    } else if (type === 'badges') {
        return {
            earned_badges: [
                { name: 'First Post', icon: '📝' },
                { name: 'Week Warrior', icon: '⚔️' }
            ],
            progress_to_next_badge: {
                name: '5-Day Streak',
                percentage: 80,
                description: '4/5 days'
            }
        };
    }
    return null;
}
