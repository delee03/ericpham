// Mutable journey state. The per-frame values (p, velocity, ...) live on
// `journey` and are read directly by scenes and HUD numerals; React only
// subscribes to the small `ui` snapshot (current level, auto-play state).
import { journeyLevels } from "@/utils/data/journey";

export const journey = {
    p: 0, // continuous level index in [0, 7]
    level: 0, // round(p)
    velocity: 0, // levels per second (signed)
    playing: false, // auto-play running
    locked: false, // a drawer is open: engine ignores input
    mode: "scroll", // scroll | tween | autoplay
};

let ui = { level: 0, playing: false };
const uiListeners = new Set();
const frameListeners = new Set();

export const getUi = () => ui;

export function subscribeUi(fn) {
    uiListeners.add(fn);
    return () => uiListeners.delete(fn);
}

export function setUi(patch) {
    const next = { ...ui, ...patch };
    if (next.level === ui.level && next.playing === ui.playing) return;
    ui = next;
    uiListeners.forEach((fn) => fn());
}

// Per-frame subscribers (HUD numerals, overlay opacity). Called by the engine.
export function onFrame(fn) {
    frameListeners.add(fn);
    return () => frameListeners.delete(fn);
}
export const emitFrame = () => frameListeners.forEach((fn) => fn(journey));

// log10(metres) at journey position p, interpolated between adjacent levels.
export function logAt(p) {
    const last = journeyLevels.length - 1;
    const c = Math.min(last, Math.max(0, p));
    const i = Math.min(last - 1, Math.floor(c));
    const f = c - i;
    return journeyLevels[i].log + (journeyLevels[i + 1].log - journeyLevels[i].log) * f;
}

const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻" };
export const superscript = (n) =>
    String(n)
        .split("")
        .map((c) => SUP[c] ?? c)
        .join("");
