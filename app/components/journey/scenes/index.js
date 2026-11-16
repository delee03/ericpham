// Scene registry: ONE entry per journey level, in order. To swap a scene,
// change the `load` line of that level (and keep the scene contract in
// README.md). Level 7 ("back to you") deliberately reuses the desk.
//
// Modules are loaded lazily and cached; `loadScene(level)` returns a promise of
// { Component, meta }.
export const scenes = [
    { id: "desk", load: () => import("./desk") },
    { id: "saigon", load: () => import("./saigon") },
    { id: "earth", load: () => import("./earth") },
    { id: "planets", load: () => import("./planets") },
    { id: "pale-blue-dot", load: () => import("./pale-blue-dot") },
    { id: "milky-way", load: () => import("./milky-way") },
    { id: "cosmic-web", load: () => import("./cosmic-web") },
    { id: "desk-return", load: () => import("./desk") },
];

const cache = new Map();

export function loadScene(level) {
    const entry = scenes[level];
    if (!entry) return Promise.reject(new Error(`No scene for level ${level}`));
    if (!cache.has(level)) {
        cache.set(
            level,
            entry.load().then((mod) => ({
                Component: mod.default,
                meta: mod.meta ?? { origin: [0.5, 0.5] },
            }))
        );
    }
    return cache.get(level);
}

// Warm the module cache (not the GPU) for a level and its neighbours.
export function preloadAround(level) {
    [level - 1, level, level + 1].forEach((l) => {
        if (l >= 0 && l < scenes.length) loadScene(l).catch(() => {});
    });
}
