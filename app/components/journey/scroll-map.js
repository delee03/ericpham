import { clamp, easeSnap, easeTravel } from "./easing";

// Scroll position s (in "units", 0..LEVEL_MAX) <-> journey position p (0..LEVEL_MAX).
// Every level owns one unit of scroll. Around each integer there is a HOLD zone
// (p stays exactly on the integer so the content is readable); between the holds
// is the TRAVEL zone where p eases to the next level.
export const LEVEL_MAX = 7;
export const HOLD_HALF = 0.25; // hold occupies +-0.25 units around each level
export const UNIT_VH = 0.9; // one unit of scroll = 90% of the viewport height

// The 6 -> 7 "snap back" travels with the heavier curve.
const curveFor = (i) => (i === 6 ? easeSnap : easeTravel);

export function scrollToP(s) {
    const c = clamp(s, 0, LEVEL_MAX);
    if (c >= LEVEL_MAX) return LEVEL_MAX;
    const i = Math.floor(c);
    const u = clamp((c - i - HOLD_HALF) / (1 - 2 * HOLD_HALF));
    return i + curveFor(i)(u);
}

// Inverse of scrollToP, used to keep the native scroll position in step while
// p is driven by a tween or by auto-play (bisection on the monotone curve).
export function pToScroll(p) {
    const c = clamp(p, 0, LEVEL_MAX);
    if (c >= LEVEL_MAX) return LEVEL_MAX;
    const i = Math.floor(c);
    const f = c - i;
    if (f <= 0) return i;
    const curve = curveFor(i);
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 18; k++) {
        const mid = (lo + hi) / 2;
        if (curve(mid) < f) lo = mid;
        else hi = mid;
    }
    return i + HOLD_HALF + ((lo + hi) / 2) * (1 - 2 * HOLD_HALF);
}
