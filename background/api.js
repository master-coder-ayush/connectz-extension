// background/api.js
import { getBaseUrl } from './auth.js';

/**
 * Generate a comment based on post content.
 * @param {string} postContent - The content of the LinkedIn post.
 * @returns {Promise<string>} The generated comment.
 */
export async function generateCommentResponse(postContent) {
    if (!postContent || !postContent.trim()) {
        throw new Error("Post content is empty.");
    }

    const baseUrl = await getBaseUrl();
    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/comments/generate`;

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
            linkedin_post_content: postContent,
        }),
    });

    if (!res.ok) {
        const error = await res.json();
        if (error) {
            throw new Error(error.error);
        }
        throw new Error("Unable to generate comment. Please try again later.");
    }

    let data = {};
    try {
        data = await res.json();
    } catch (error) {
        throw new Error("Unable to parse API response.");
    }

    const comment =
        data.comment ||
        data.generated_comment ||
        data.comment_text ||
        data.result ||
        data.data ||
        null;

    if (!comment || !comment.trim()) {
        throw new Error("API did not return a comment.");
    }

    return comment.trim();
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

    const baseUrl = await getBaseUrl();
    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/posts/generate`;

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
            rough_post_content: roughPostContent,
        }),
    });

    if (!res.ok) {
        const error = await res.json();
        if (error) {
            throw new Error(error.error);
        }
        throw new Error("Unable to generate post. Please try again later.");
    }

    let data = {};
    try {
        data = await res.json();
    } catch (error) {
        throw new Error("Unable to parse API response.");
    }

    const post =
        data.post ||
        data.generated_post ||
        data.post_text ||
        data.result ||
        data.data ||
        null;

    if (!post || !post.trim()) {
        throw new Error("API did not return a post.");
    }

    return post.trim();
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

    const baseUrl = await getBaseUrl();
    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/comments/rephrase`;

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
            linkedin_post_content: postContent,
            existing_comment: existingComment
        }),
    });

    if (!res.ok) {
        const error = await res.json();
        if (error) {
            throw new Error(error.error);
        }
        throw new Error("Unable to rephrase comment. Please try again later.");
    }

    let data = {};
    try {
        data = await res.json();
    } catch (error) {
        throw new Error("Unable to parse API response.");
    }

    const rephraseComment =
        data.rephrased_comment ||
        data.comment ||
        data.result ||
        data.data ||
        null;

    if (!rephraseComment || !rephraseComment.trim()) {
        throw new Error("API did not return a rephrased comment.");
    }

    return rephraseComment.trim();
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

        if (!res.ok) return getMockData('weekly');
        return await res.json();
    } catch (e) {
        console.warn("Failed to fetch weekly stats, using mock data:", e);
        return getMockData('weekly');
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

        if (!res.ok) return getMockData('badges');
        return await res.json();
    } catch (e) {
        console.warn("Failed to fetch badges stats, using mock data:", e);
        return getMockData('badges');
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

