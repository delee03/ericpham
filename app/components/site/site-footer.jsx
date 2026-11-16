import { imageCredits } from "@/utils/data/journey";
import Link from "next/link";

export default function SiteFooter() {
    return (
        <footer className="border-t border-line">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                    <p>© {new Date().getFullYear()} Thuận Phát (Eric)</p>
                    <Link
                        href="/"
                        className="inline-flex min-h-[44px] items-center font-mono text-xs uppercase tracking-[0.14em] text-sky hover:underline"
                    >
                        Take the journey
                    </Link>
                </div>
                {imageCredits.length > 0 && (
                    <p id="credits" className="scroll-mt-24 text-xs text-dim">
                        Image credits:{" "}
                        {imageCredits.map((c, i) => (
                            <span key={c.href}>
                                {i > 0 && ", "}
                                <a
                                    href={c.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted underline hover:text-ink"
                                >
                                    {c.label}
                                </a>
                            </span>
                        ))}
                    </p>
                )}
            </div>
        </footer>
    );
}
