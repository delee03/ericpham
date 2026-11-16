import Link from "next/link";

export const metadata = { title: "Lost in space - Thuận Phát" };

export default function NotFound() {
    return (
        <main className="site-stars flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky">404 · Signal lost</p>
            <h1 className="font-display text-4xl font-light text-gold sm:text-5xl">
                There is nothing at these coordinates.
            </h1>
            <p className="max-w-md text-muted">The page you are looking for does not exist or has moved.</p>
            <Link
                href="/"
                className="mt-2 inline-flex min-h-[44px] items-center rounded-full border border-gold/60 px-6 text-sm text-gold transition-colors hover:bg-gold/10"
            >
                Back to the start
            </Link>
        </main>
    );
}
