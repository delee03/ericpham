// Auto-play timeline. Keyframes are [seconds, p]; between two keyframes with
// different p the engine eases (heavier curve for the 6 -> 7 snap), equal p
// means "hold". Tuned to public/audio/ambient.m4a (42 s): soft 0-24 s, swell
// 24-32 s, sudden drop at 32 s, sparse bells afterwards. Tune by ear here.
export const TRACK_SECONDS = 42;

export const AUTOPLAY_KEYS = [
    [0, 0],
    [2.5, 0], // hold You
    [5, 1], // -> Saigon
    [8, 1],
    [10.5, 2], // -> Earth
    [14.5, 2],
    [17, 3], // -> planets
    [21.5, 3],
    [24, 4], // -> Pale Blue Dot, arriving on the sub boom
    [26.5, 4],
    [28.5, 5], // -> Milky Way, inside the swell
    [30, 5],
    [32, 6], // -> Cosmic web, arriving as the music drops away
    [37, 6], // the message holds in the near silence
    [38.6, 7], // snap back under the last bells
    [TRACK_SECONDS, 7],
];

export const AUTOPLAY_FADE_MS = 600;
