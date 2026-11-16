"use client";

import Link from "next/link";
import { engine } from "../journey-engine";
import { useUi } from "../use-ui";

const iconProps = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
};

function SoundButton() {
    const { playing } = useUi();
    const label = playing ? "Stop the journey" : "Play the journey with sound";
    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={playing}
            title={label}
            onClick={() => engine.toggleAutoplay()}
            className={`flex h-11 w-11 items-center justify-center rounded-full border bg-panel/70 text-ink transition-colors hover:border-sky ${
                playing ? "border-gold/70" : "border-sky/30"
            }`}
        >
            {playing ? (
                <svg {...iconProps}>
                    <path d="M11 5 6 9H2v6h4l5 4V5z" />
                    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                    <path d="M19 5a10 10 0 0 1 0 14" />
                </svg>
            ) : (
                <svg {...iconProps}>
                    <path d="M11 5 6 9H2v6h4l5 4V5z" />
                    <path d="m22 9-6 6" />
                    <path d="m16 9 6 6" />
                </svg>
            )}
        </button>
    );
}

export default function Header() {
    return (
        <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between pl-5 pr-4 pt-[env(safe-area-inset-top)] md:h-[76px] md:px-10">
            <button
                type="button"
                onClick={() => engine.goTo(0)}
                className="min-h-[44px] font-mono text-[13px] tracking-[0.2em] text-ink md:text-sm md:tracking-[0.22em]"
            >
                THUẬN PHÁT
            </button>
            <nav aria-label="Primary" className="flex items-center gap-1 md:gap-5">
                <Link
                    href="/blog"
                    className="hidden min-h-[44px] items-center px-1 text-[13px] text-dim transition-colors hover:text-ink md:flex"
                >
                    Writing
                </Link>
                <Link
                    href="/plain"
                    aria-label="Skip the journey"
                    className="flex min-h-[44px] items-center px-2 text-[13px] text-muted transition-colors hover:text-ink md:px-1 md:text-sm"
                >
                    <span className="md:hidden" aria-hidden="true">
                        Skip
                    </span>
                    <span className="hidden md:inline">Skip the journey</span>
                </Link>
                <SoundButton />
                <a
                    href="#contact"
                    onClick={(e) => {
                        e.preventDefault();
                        engine.goTo(7);
                    }}
                    className="ml-1 flex min-h-[44px] items-center rounded-full border border-gold/60 px-4 text-sm text-gold transition-colors hover:bg-gold/10 md:px-5"
                >
                    Contact
                </a>
            </nav>
        </header>
    );
}
