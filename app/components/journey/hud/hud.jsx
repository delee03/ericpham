"use client";

import { useCallback, useRef } from "react";
import { journeyLevels } from "@/utils/data/journey";
import { engine } from "../journey-engine";
import { logAt, superscript } from "../journey-store";
import { useFrameEffect, useUi } from "../use-ui";

const pad = (n) => String(n).padStart(2, "0");
const total = journeyLevels.length;

// Bottom-left: "0N / 08 · NAME" and the big live scale value.
export function Readout() {
    const { level } = useUi();
    const lv = journeyLevels[level];
    const numRef = useRef(null);
    const unitRef = useRef(null);
    const last = useRef({ num: "", unit: "" });

    const update = useCallback((j) => {
        const settled = Math.abs(j.p - Math.round(j.p)) < 0.012;
        const l = journeyLevels[Math.max(0, Math.min(total - 1, Math.round(j.p)))];
        const num = settled ? l.exp : `10${superscript(Math.round(logAt(j.p)))} m`;
        const unit = settled ? l.unit : "";
        if (num !== last.current.num && numRef.current) {
            numRef.current.textContent = num;
            last.current.num = num;
        }
        if (unit !== last.current.unit && unitRef.current) {
            unitRef.current.textContent = unit;
            last.current.unit = unit;
        }
    }, []);
    useFrameEffect(update);

    return (
        <div className="fixed bottom-[calc(22px+env(safe-area-inset-bottom))] left-5 z-30 flex flex-col gap-0.5 md:bottom-11 md:left-[88px] md:gap-1">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim md:text-xs md:tracking-[0.18em]">
                {pad(level + 1)} / {pad(total)} · {lv.name}
            </div>
            <div className="flex items-baseline gap-2.5 md:gap-4" aria-hidden="true">
                <span ref={numRef} className="font-mono text-[26px] font-medium text-ink md:text-[40px]">
                    10⁰ m
                </span>
                <span ref={unitRef} className="font-mono text-[13px] text-sky md:text-base">
                    1 m
                </span>
            </div>
            <p className="sr-only" aria-live="polite">
                {lv.name}, {lv.unit}
            </p>
        </div>
    );
}

const chevron = (d) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d={d} />
    </svg>
);

// Prev / hint / next. Desktop: bottom centre. Mobile: bottom right.
export function Controls() {
    const { level } = useUi();
    const btn =
        "flex h-11 w-11 items-center justify-center rounded-full border bg-panel/60 text-ink transition-colors hover:border-sky disabled:opacity-30 disabled:hover:border-ink/30";
    return (
        <div className="fixed bottom-[calc(22px+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-2 md:bottom-10 md:left-1/2 md:right-auto md:-translate-x-1/2 md:gap-3.5">
            <button
                type="button"
                aria-label="Zoom in one level"
                disabled={level === 0}
                onClick={() => engine.prev()}
                className={`${btn} border-ink/30`}
            >
                {chevron("m18 15-6-6-6 6")}
            </button>
            <span className="hidden min-w-[150px] text-center text-[13px] tracking-[0.08em] text-muted md:inline">
                {journeyLevels[level].hint}
            </span>
            <button
                type="button"
                aria-label="Zoom out one level"
                disabled={level === total - 1}
                onClick={() => engine.next()}
                className={`${btn} border-gold/60 text-gold md:border-ink/30 md:text-ink`}
            >
                {chevron("m6 9 6 6 6-6")}
            </button>
        </div>
    );
}

function dotClass(i, level) {
    if (i === level) return "h-3.5 w-3.5 bg-gold shadow-[0_0_12px_rgba(255,208,138,0.7)]";
    return `h-[7px] w-[7px] ${i < level ? "bg-sky" : "bg-[#4A5478]"}`;
}

// Desktop: vertical scale bar on the right edge. Mobile: row of dots above the readout.
export function ScaleBar() {
    const { level } = useUi();
    return (
        <>
            <nav aria-label="Scale" className="fixed right-9 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-1.5 md:flex">
                {journeyLevels.map((l, i) => (
                    <button
                        key={l.id}
                        type="button"
                        onClick={() => engine.goTo(i)}
                        aria-label={`Go to ${l.name.toLowerCase()}, ${l.unit}`}
                        aria-current={i === level ? "step" : undefined}
                        className="flex min-h-[40px] items-center justify-end gap-3"
                    >
                        <span
                            className={`font-mono transition-all duration-300 ${
                                i === level ? "text-sm text-ink" : "text-xs text-dim"
                            }`}
                        >
                            {l.exp}
                        </span>
                        <span className="flex h-4 w-4 items-center justify-center">
                            <span className={`block rounded-full transition-all duration-300 ${dotClass(i, level)}`} />
                        </span>
                    </button>
                ))}
            </nav>
            <nav
                aria-label="Scale"
                className="fixed inset-x-5 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 flex md:hidden"
            >
                {journeyLevels.map((l, i) => (
                    <button
                        key={l.id}
                        type="button"
                        onClick={() => engine.goTo(i)}
                        aria-label={`Go to ${l.name.toLowerCase()}, ${l.unit}`}
                        aria-current={i === level ? "step" : undefined}
                        className="flex h-8 min-w-0 flex-1 items-center justify-center"
                    >
                        <span className={`block rounded-full transition-all duration-300 ${dotClass(i, level)}`} />
                    </button>
                ))}
            </nav>
        </>
    );
}
