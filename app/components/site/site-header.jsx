import Link from "next/link";

const links = [
    { key: "journey", href: "/", label: "Journey", hideOnMobile: true },
    { key: "work", href: "/plain#projects", label: "Work" },
    { key: "writing", href: "/blog", label: "Writing" },
];

const linkBase =
    "inline-flex min-h-[44px] items-center px-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink focus-visible:text-ink sm:px-3 sm:text-xs";

// Sticky site chrome shared by /plain and /blog. `current` is one of
// "work" | "writing" | "contact" | undefined and sets aria-current.
export default function SiteHeader({ current }) {
    return (
        <header className="sticky top-0 z-40 border-b border-line bg-void/80 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 sm:px-8">
                <Link
                    href="/"
                    aria-label="Thuận Phát, back to the journey"
                    className="inline-flex min-h-[44px] items-center font-mono text-xs font-medium uppercase tracking-[0.2em] text-ink"
                >
                    Thuận Phát
                </Link>
                <nav aria-label="Primary" className="flex items-center">
                    {links.map((l) => (
                        <Link
                            key={l.key}
                            href={l.href}
                            aria-current={current === l.key ? "page" : undefined}
                            className={`${linkBase} ${l.hideOnMobile ? "hidden sm:inline-flex" : ""} ${
                                current === l.key ? "!text-ink" : ""
                            }`}
                        >
                            {l.label}
                        </Link>
                    ))}
                    <Link
                        href="/plain#contact"
                        aria-current={current === "contact" ? "page" : undefined}
                        className="ml-1 inline-flex min-h-[44px] items-center rounded-full border border-gold px-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold hover:text-void sm:text-xs"
                    >
                        Contact
                    </Link>
                </nav>
            </div>
        </header>
    );
}
