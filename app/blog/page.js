import BlogCard from "@/app/components/site/blog-card";
import SiteFooter from "@/app/components/site/site-footer";
import SiteHeader from "@/app/components/site/site-header";
import { devToProfileUrl, getBlogs } from "@/utils/blog";

export const metadata = {
    title: "Writing - Thuận Phát (Eric)",
    description: "Articles by Thuận Phát (Eric) on cloud, AI agents and software engineering, from dev.to.",
};

export default async function BlogPage() {
    const { blogs, failed } = await getBlogs();

    return (
        <div className="site-stars min-h-screen">
            <SiteHeader current="writing" />
            <main className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-20">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky">Transmissions</p>
                <h1 className="mt-3 font-display text-3xl font-light text-gold sm:text-5xl">Writing</h1>
                <p className="mt-3 max-w-2xl text-muted">
                    Notes on cloud, AI agents and engineering, published on dev.to.
                </p>

                <div className="mt-10">
                    {blogs.length > 0 ? (
                        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {blogs.map((blog) => (
                                <li key={blog.id ?? blog.url}>
                                    <BlogCard blog={blog} />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-soft">
                            {failed ? "The articles could not be loaded right now. " : "No articles yet. "}
                            <a
                                href={devToProfileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-[44px] items-center text-sky underline"
                            >
                                {failed ? "Read them on dev.to" : "Visit dev.to"}
                            </a>
                            .
                        </p>
                    )}
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
