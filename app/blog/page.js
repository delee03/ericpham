// @flow strict

import { personalData } from "@/utils/data/personal-data";
import BlogCard from "../components/homepage/blog/blog-card";

async function getBlogs() {
    try {
        const res = await fetch(
            `https://dev.to/api/articles?username=${personalData.devUserName}`,
            { next: { revalidate: 3600 } }
        );
        if (!res.ok) {
            return { blogs: [], failed: true };
        }
        const data = await res.json();
        return { blogs: Array.isArray(data) ? data : [], failed: false };
    } catch (error) {
        console.error("Failed to fetch dev.to articles:", error.message);
        return { blogs: [], failed: true };
    }
}

async function page() {
    const { blogs, failed } = await getBlogs();
    const devUrl = `https://dev.to/${personalData.devUserName}`;

    return (
        <div className="py-8">
            <div className="flex justify-center my-5 lg:py-8">
                <div className="flex  items-center">
                    <span className="w-24 h-[2px] bg-[#1a1443]"></span>
                    <span className="bg-[#1a1443] w-fit text-white p-2 px-5 text-2xl rounded-md">
                        All Blog
                    </span>
                    <span className="w-24 h-[2px] bg-[#1a1443]"></span>
                </div>
            </div>

            {blogs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-5 lg:gap-8 xl:gap-10">
                    {blogs.map((blog) => (
                        <BlogCard blog={blog} key={blog.id ?? blog.url} />
                    ))}
                </div>
            ) : (
                <p className="text-center text-[#d3d8e8]">
                    {failed
                        ? "Couldn't load articles, "
                        : "No articles yet. "}
                    <a
                        className="text-[#16f2b3] underline"
                        href={devUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {failed ? "read them on dev.to" : "Visit dev.to"}
                    </a>
                    .
                </p>
            )}
        </div>
    );
}

export default page;
