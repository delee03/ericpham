"use client";

import { useEffect, useId, useRef } from "react";
import { engine } from "../journey-engine";

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The single "More" drawer: a right-hand panel on desktop, a bottom sheet on
// mobile. Focus trap, Esc closes, focus returns to the trigger, the body
// scrolls, and the scroll engine is locked while it is open. The DOM is always
// present (hidden when closed) so the long-form content stays crawlable.
export default function Drawer({ open, onClose, title, children }) {
    const rootRef = useRef(null);
    const returnTo = useRef(null);
    const titleId = useId();

    useEffect(() => {
        if (!open) return undefined;
        returnTo.current = document.activeElement;
        engine.setLocked(true);
        const root = rootRef.current;
        root?.querySelector("[data-drawer-close]")?.focus();

        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                return;
            }
            if (e.key !== "Tab" || !root) return;
            const items = [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
            if (!items.length) return;
            const first = items[0];
            const lastEl = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                lastEl.focus();
            } else if (!e.shiftKey && document.activeElement === lastEl) {
                e.preventDefault();
                first.focus();
            } else if (!root.contains(document.activeElement)) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("keydown", onKey, true);
            engine.setLocked(false);
            const el = returnTo.current;
            if (el && typeof el.focus === "function") el.focus();
        };
    }, [open, onClose]);

    return (
        <div
            className={`fixed inset-0 z-50 ${open ? "flex" : "hidden"} items-end md:items-stretch md:justify-end`}
            inert={!open}
        >
            <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
            <div
                ref={rootRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative z-10 flex max-h-[86svh] w-full flex-col overflow-hidden rounded-t-[20px] border border-sky/20 bg-[#070A14]/95 pb-[env(safe-area-inset-bottom)] shadow-2xl md:max-h-none md:h-full md:w-[560px] md:rounded-none md:rounded-l-[20px] md:border-y-0 md:border-r-0 md:pb-0"
            >
                <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 md:px-7 md:py-4">
                    <h2 id={titleId} className="font-display text-xl font-medium text-ink">
                        {title}
                    </h2>
                    <button
                        type="button"
                        data-drawer-close
                        onClick={onClose}
                        className="flex h-11 min-w-[44px] items-center justify-center rounded-full border border-ink/30 px-4 text-sm text-ink hover:border-sky"
                    >
                        Close
                    </button>
                </div>
                <div data-scroll-panel className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-7 md:py-6">
                    {children}
                </div>
            </div>
        </div>
    );
}
