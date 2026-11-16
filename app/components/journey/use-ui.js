"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getUi, onFrame, subscribeUi } from "./journey-store";

// The only React-visible slice of the journey: { level, playing }.
export function useUi() {
    return useSyncExternalStore(subscribeUi, getUi, getUi);
}

// Run `fn(journey)` on every engine frame (for DOM-ref updates, not React state).
export function useFrameEffect(fn) {
    useEffect(() => onFrame(fn), [fn]);
}
