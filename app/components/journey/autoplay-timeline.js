// Auto-play timeline. Keyframes are [seconds, p]; between two keyframes with
// different p the engine eases (heavier curve for the 6 -> 7 snap), equal p
// means "hold". Tuned to public/audio/ambient.m4a (42 s): soft 0-24 s, swell
// 24-32 s, sudden drop at 32 s, sparse bells afterwards. Tune by ear here.
export const TRACK_SECONDS = 42;

export const AUTOPLAY_KEYS = [
    [0, 0],
    [3, 0], // hold You
    [6, 1], // -> Saigon
    [9, 1],
    [12, 2], // -> Earth
    [16, 2],
    [19, 3], // -> planets
    [23.5, 3],
    [28, 4], // -> Pale Blue Dot, slow and quiet
    [28.8, 4],
    [30, 5], // -> Milky Way, with the swell
    [30.4, 5],
    [31.5, 6], // -> Cosmic web
    [32, 6],
    [33.5, 7], // snap back on the drop
    [TRACK_SECONDS, 7],
];

export const AUTOPLAY_FADE_MS = 600;
