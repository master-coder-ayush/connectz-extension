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
