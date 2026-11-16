// The journey engine: turns scroll, keys, swipes, HUD clicks and auto-play into
// one continuous position `journey.p` (0..7). Runs its own rAF loop, never
// touches React state per frame, and writes into journey-store.js.
//
// Modes (journey.mode):
//   scroll   p follows the (Lenis-smoothed) page scroll through scroll-map.js
//   tween    p is animated to a level by goTo/next/prev/soft-snap
//   autoplay p is driven by audio.currentTime through AUTOPLAY_KEYS
// In tween/autoplay the native scroll position is kept in step so that handing
// control back to the user is seamless.
import Lenis from "lenis";
import { AUTOPLAY_FADE_MS, AUTOPLAY_KEYS, TRACK_SECONDS } from "./autoplay-timeline";
import { clamp, easeSnap, easeTravel, lerp, smoothstep } from "./easing";
import { emitFrame, journey, setUi } from "./journey-store";
import { LEVEL_MAX, UNIT_VH, pToScroll, scrollToP } from "./scroll-map";

const AUDIO_SRC = "/audio/ambient.m4a";
const SNAP_IDLE_MS = 170;

const state = {
    mounted: false,
    touch: false,
    lenis: null,
    spacer: null,
    unit: 800,
    raf: 0,
    last: 0,
    tween: null,
    lastMoveAt: 0,
    audio: null,
    silent: false,
    autoStart: null, // { startP, t0 }
    cleanups: [],
};

function timelineP(t) {
    const keys = AUTOPLAY_KEYS;
    if (t <= keys[0][0]) return keys[0][1];
    for (let k = 0; k < keys.length - 1; k++) {
        const [t0, p0] = keys[k];
        const [t1, p1] = keys[k + 1];
        if (t >= t0 && t < t1) {
            if (p0 === p1) return p0;
            const ease = p0 === 6 && p1 === 7 ? easeSnap : easeTravel;
            return lerp(p0, p1, ease((t - t0) / (t1 - t0)));
        }
    }
    return keys[keys.length - 1][1];
}

function syncScroll(p) {
    if (!state.lenis) return;
    state.lenis.scrollTo(pToScroll(p) * state.unit, { immediate: true, force: true });
}

function layout() {
    state.unit = Math.max(300, window.innerHeight * UNIT_VH);
    if (state.spacer) {
        state.spacer.style.height = state.touch
            ? "100svh"
            : `${window.innerHeight + LEVEL_MAX * state.unit}px`;
    }
    if (state.lenis) {
        state.lenis.resize();
        syncScroll(journey.p);
    }
}

function setLevel(p) {
    const lv = clamp(Math.round(p), 0, LEVEL_MAX);
    if (lv !== journey.level) {
        journey.level = lv;
        setUi({ level: lv });
    }
}

function finishAutoplay(fade) {
    const audio = state.audio;
    state.audio = null;
    state.autoStart = null;
    if (journey.mode === "autoplay") journey.mode = "scroll";
    journey.playing = false;
    setUi({ playing: false });
    syncScroll(journey.p);
    state.lastMoveAt = performance.now();
    if (!audio) return;
    if (!fade) {
        audio.pause();
        return;
    }
    const v0 = audio.volume;
    const t0 = performance.now();
    const step = () => {
        const u = (performance.now() - t0) / AUTOPLAY_FADE_MS;
        if (u >= 1) {
            audio.pause();
            return;
        }
        audio.volume = Math.max(0, v0 * (1 - u));
        requestAnimationFrame(step);
    };
    step();
}

function frame(now) {
    state.raf = requestAnimationFrame(frame);
    const dt = clamp((now - state.last) / 1000, 0.001, 0.05);
    state.last = now;
    const prevP = journey.p;
    let p = prevP;

    if (journey.locked) {
        // Drawer open: p is frozen.
    } else if (journey.mode === "autoplay" && state.autoStart) {
        const audio = state.audio;
        const fallback = state.silent || audio?.error;
        const t = fallback
            ? (now - state.autoStart.t0) / 1000
            : audio
              ? audio.currentTime
              : 0;
        p = lerp(state.autoStart.startP, timelineP(t), smoothstep(0, 0.8, t));
        if (audio?.ended || t >= TRACK_SECONDS - 0.02) {
            p = LEVEL_MAX;
            journey.p = p;
            finishAutoplay(false);
        } else {
            syncScroll(p);
        }
    } else if (journey.mode === "tween" && state.tween) {
        const tw = state.tween;
        const u = clamp((now - tw.t0) / tw.dur);
        p = lerp(tw.from, tw.to, tw.ease(u));
        if (u >= 1) {
            p = tw.to;
            state.tween = null;
            journey.mode = "scroll";
            syncScroll(p);
            state.lastMoveAt = now;
        } else {
            syncScroll(p);
        }
    } else if (state.lenis) {
        p = scrollToP(state.lenis.animatedScroll / state.unit);
    }

    if (state.lenis) state.lenis.raf(now);

    journey.p = p;
    const v = (p - prevP) / dt;
    journey.velocity += (v - journey.velocity) * Math.min(1, dt * 12);
    if (Math.abs(journey.velocity) < 1e-4) journey.velocity = 0;
    setLevel(p);

    // Soft-snap: scrolling stopped while between two levels.
    if (journey.mode === "scroll" && !journey.locked) {
        if (Math.abs(p - prevP) > 1e-4) state.lastMoveAt = now;
        const off = Math.abs(p - Math.round(p));
        if (off > 0.002 && now - state.lastMoveAt > SNAP_IDLE_MS && !state.lenis?.isScrolling) {
            tweenTo(Math.round(p), 0.5 + off * 0.8);
        }
    }

    emitFrame();
}

function tweenTo(target, seconds) {
    const to = clamp(target, 0, LEVEL_MAX);
    const from = journey.p;
    if (Math.abs(to - from) < 1e-4) {
        journey.mode = "scroll";
        state.tween = null;
        return;
    }
    const n = Math.abs(to - from);
    const snap = to === LEVEL_MAX && from >= 6 && to > from;
    const dur = (seconds ?? (snap ? 1.6 : Math.min(2.4, 1.1 + 0.28 * (n - 1)))) * 1000;
    state.tween = { from, to, t0: performance.now(), dur, ease: snap ? easeSnap : easeTravel };
    journey.mode = "tween";
}

// Any manual input: stop auto-play (fading the audio) and any running tween.
function userInput() {
    if (journey.mode === "autoplay") finishAutoplay(true);
    else if (journey.mode === "tween") {
        state.tween = null;
        journey.mode = "scroll";
        state.lastMoveAt = performance.now();
    }
}

const isTypingTarget = (el) =>
    !!el?.closest?.("input, textarea, select, [contenteditable='true'], [role='dialog']");

export const engine = {
    mount({ touch, spacer }) {
        if (state.mounted) return;
        state.mounted = true;
        state.touch = touch;
        state.spacer = spacer;
        if ("scrollRestoration" in history) history.scrollRestoration = "manual";
        window.scrollTo(0, 0);
        journey.p = 0;
        journey.level = 0;
        journey.velocity = 0;
        journey.mode = "scroll";
        setUi({ level: 0, playing: false });

        if (!touch) {
            state.lenis = new Lenis({
                autoRaf: false,
                lerp: 0.085,
                smoothWheel: true,
                wheelMultiplier: 0.9,
                // Let panels that really overflow scroll natively.
                prevent: (node) => {
                    const el = node.closest?.("[data-scroll-panel]");
                    return !!el && el.scrollHeight > el.clientHeight + 2;
                },
            });
        }
        layout();

        const on = (target, type, fn, opts) => {
            target.addEventListener(type, fn, opts);
            state.cleanups.push(() => target.removeEventListener(type, fn, opts));
        };

        on(window, "resize", layout);
        on(window, "wheel", () => !journey.locked && userInput(), { passive: true });
        on(document, "visibilitychange", () => {
            state.last = performance.now();
        });

        on(window, "keydown", (e) => {
            if (journey.locked || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
            if (isTypingTarget(e.target)) return;
            const tag = e.target?.tagName;
            const onControl = tag === "BUTTON" || tag === "A" || tag === "SUMMARY";
            let dir = 0;
            let to = null;
            switch (e.key) {
                case "ArrowDown":
                case "PageDown":
                    dir = 1;
                    break;
                case " ":
                    if (onControl) return;
                    dir = e.shiftKey ? -1 : 1;
                    break;
                case "ArrowUp":
                case "PageUp":
                    dir = -1;
                    break;
                case "Home":
                    to = 0;
                    break;
                case "End":
                    to = LEVEL_MAX;
                    break;
                default:
                    return;
            }
            e.preventDefault();
            if (to !== null) engine.goTo(to);
            else if (dir > 0) engine.next();
            else engine.prev();
        });

        if (touch) {
            let sx = 0;
            let sy = 0;
            let ignore = false;
            on(
                window,
                "touchstart",
                (e) => {
                    const t = e.touches[0];
                    sx = t.clientX;
                    sy = t.clientY;
                    const el = e.target;
                    const panel = el?.closest?.("[data-scroll-panel]");
                    ignore =
                        journey.locked ||
                        !!el?.closest?.("input, textarea, select, [role='dialog']") ||
                        (panel && panel.scrollHeight > panel.clientHeight + 2);
                },
                { passive: true }
            );
            on(
                window,
                "touchend",
                (e) => {
                    if (ignore || journey.locked) return;
                    const t = e.changedTouches[0];
                    const dy = sy - t.clientY;
                    const dx = sx - t.clientX;
                    if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx)) return;
                    if (dy > 0) engine.next();
                    else engine.prev();
                },
                { passive: true }
            );
        }

        state.last = performance.now();
        state.raf = requestAnimationFrame(frame);
    },

    unmount() {
        if (!state.mounted) return;
        cancelAnimationFrame(state.raf);
        state.cleanups.forEach((fn) => fn());
        state.cleanups = [];
        if (journey.mode === "autoplay") finishAutoplay(false);
        state.lenis?.destroy();
        state.lenis = null;
        state.tween = null;
        state.mounted = false;
    },

    goTo(level) {
        if (journey.locked) return;
        userInput();
        tweenTo(clamp(Math.round(level), 0, LEVEL_MAX));
    },
    next() {
        if (journey.locked) return;
        const base = state.tween ? state.tween.to : Math.round(journey.p);
        engine.goTo(base + 1);
    },
    prev() {
        if (journey.locked) return;
        const base = state.tween ? state.tween.to : Math.round(journey.p);
        engine.goTo(base - 1);
    },

    // A drawer is open: freeze p, stop Lenis; autoplay is cancelled.
    setLocked(locked) {
        if (locked) {
            userInput();
            journey.mode = "scroll";
            state.tween = null;
            state.lenis?.stop();
        } else {
            state.lenis?.start();
            state.lastMoveAt = performance.now();
        }
        journey.locked = locked;
    },

    // Sound button: starts "Play the journey" from 0, or stops it.
    toggleAutoplay() {
        if (journey.locked) return;
        if (journey.playing) {
            finishAutoplay(true);
            return;
        }
        state.tween = null;
        state.silent = false;
        const audio = new Audio(AUDIO_SRC);
        audio.preload = "auto";
        audio.volume = 0.85;
        state.audio = audio;
        state.autoStart = { startP: journey.p, t0: performance.now() };
        journey.mode = "autoplay";
        journey.playing = true;
        setUi({ playing: true });
        const result = audio.play();
        if (result && typeof result.catch === "function") {
            result.catch(() => {
                // Blocked or unsupported: fall back to a silent, clock-driven run.
                state.autoStart = { startP: journey.p, t0: performance.now() };
                if (state.audio === audio) state.silent = true;
            });
        }
    },
};
