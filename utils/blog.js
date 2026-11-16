import { personalData } from "@/utils/data/personal-data";

export const devToProfileUrl = `https://dev.to/${personalData.devUserName}`;

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

// dev.to returns some text HTML-escaped; React escapes again, so decode first.
function decodeEntities(text) {
    return typeof text === "string"
        ? text.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m])
        : text;
}

// Fetch the dev.to articles (server-side, cached for an hour).
// Never throws: returns { blogs, failed } so pages can render a fallback.
export async function getBlogs() {
    try {
        const res = await fetch(
            `https://dev.to/api/articles?username=${personalData.devUserName}`,
            { next: { revalidate: 3600 } }
        );
        if (!res.ok) return { blogs: [], failed: true };
        const data = await res.json();
        const blogs = (Array.isArray(data) ? data : []).map((blog) => ({
            ...blog,
            title: decodeEntities(blog.title),
            description: decodeEntities(blog.description),
        }));
        return { blogs, failed: false };
    } catch (error) {
        console.error("Failed to fetch dev.to articles:", error.message);
        return { blogs: [], failed: true };
    }
}
