import Image from "next/image";
import Panel from "./panel";

function formatDate(iso) {
    try {
        return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
    } catch {
        return "";
    }
}

export default function BlogCard({ blog }) {
    return (
        <Panel as="article" className="flex h-full flex-col overflow-hidden !p-0">
            {blog.cover_image ? (
                <Image
                    src={blog.cover_image}
                    alt=""
                    width={640}
                    height={320}
                    className="aspect-[2/1] w-full object-cover"
                />
            ) : (
                <div
                    aria-hidden="true"
                    className="flex aspect-[2/1] w-full items-center justify-center border-b border-sky/20 bg-field font-mono text-xs uppercase tracking-[0.2em] text-dim"
                >
                    Transmission
                </div>
            )}
            <div className="flex flex-1 flex-col p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-sky">
                    <time dateTime={blog.published_at}>{formatDate(blog.published_at)}</time>
                    {blog.reading_time_minutes ? ` · ${blog.reading_time_minutes} min read` : ""}
                    {` · ${blog.public_reactions_count ?? 0} reactions`}
                </p>
                <h3 className="mt-3 font-display text-lg font-medium leading-snug">
                    <a
                        href={blog.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-gold focus-visible:text-gold"
                    >
                        {blog.title}
                        <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                </h3>
                {blog.description && <p className="mt-2 line-clamp-3 text-sm text-muted">{blog.description}</p>}
            </div>
        </Panel>
    );
}
