import { personalData } from "@/utils/data/personal-data";

export const devToProfileUrl = `https://dev.to/${personalData.devUserName}`;

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
        return { blogs: Array.isArray(data) ? data : [], failed: false };
    } catch (error) {
        console.error("Failed to fetch dev.to articles:", error.message);
        return { blogs: [], failed: true };
    }
}
