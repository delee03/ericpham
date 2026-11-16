// Small easing helpers shared by the scroll map, the tween engine and auto-play.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
    const t = clamp((v - a) / (b - a));
    return t * t * (3 - 2 * t);
};

// CSS-style cubic-bezier(x1, y1, x2, y2): Newton steps with a bisection fallback.
export function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let t = x;
        let ok = false;
        for (let i = 0; i < 6; i++) {
            const err = sx(t) - x;
            if (Math.abs(err) < 1e-5) {
                ok = true;
                break;
            }
            const d = dx(t);
            if (Math.abs(d) < 1e-6) break;
            t -= err / d;
        }
        if (!ok || t < 0 || t > 1) {
            let lo = 0;
            let hi = 1;
            t = x;
            for (let i = 0; i < 20; i++) {
                if (sx(t) < x) lo = t;
                else hi = t;
                t = (lo + hi) / 2;
            }
        }
        return sy(t);
    };
}

// The prototype's two transition curves.
export const easeTravel = cubicBezier(0.65, 0, 0.25, 1); // level to level
export const easeSnap = cubicBezier(0.75, 0, 0.2, 1); // level 6 -> 7 "snap back"
