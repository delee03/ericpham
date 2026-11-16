#!/usr/bin/env node
// Generates public/saigon/lights.bin: street-light points for central Ho Chi Minh City,
// sampled along the real OpenStreetMap road network, plus coarse density + water grids.
// Usage: node scripts/generate-saigon-lights.mjs [cacheDir]
//   cacheDir (optional) keeps the raw Overpass responses (r1.json arterial roads, r2.json
//   minor roads, r3.json water) so re-runs do not hit the API again.
// Map data (c) OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright
//
// Binary layout (little endian):
//   0   u32  magic 'SGL1'
//   4   u32  point count N
//   8   f32  west, south, east, north (degrees)
//   24  u16  grid size G
//   26  u16  reserved
//   28  N * { u16 x, u16 y (0..65535 across the bbox, y up), u8 brightness, u8 white }
//   ..  G*G u8 density grid (row 0 = south), then G*G u8 water grid
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BBOX = { s: 10.69, w: 106.608, n: 10.87, e: 106.792 };
const LAT0 = (BBOX.s + BBOX.n) / 2;
const MX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const MY = 110574;
const W_M = (BBOX.e - BBOX.w) * MX;
const H_M = (BBOX.n - BBOX.s) * MY;
const TARGET = 56000;
const G = 128;
const RS = 1024; // working water raster
const UA = "journey-map-sampler/1.0";
const bb = `(${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e})`;
const QUERIES = {
    "r1.json": `[out:json][timeout:240];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link)$"]${bb};out geom qt;`,
    "r2.json": `[out:json][timeout:240];way["highway"~"^(residential|unclassified|living_street)$"]${bb};out geom qt;`,
    "r3.json": `[out:json][timeout:240];(way["waterway"~"^(river|canal)$"]${bb};way["natural"="water"]${bb};relation["natural"="water"]${bb};);out geom qt;`,
};

const here = dirname(fileURLToPath(import.meta.url));
const cache = process.argv[2];
if (cache) mkdirSync(cache, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function load(name) {
    const file = cache && join(cache, name);
    if (file && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
    for (let a = 0; a < 5; a++) {
        try {
            const res = await fetch("https://overpass-api.de/api/interpreter", {
                method: "POST",
                headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
                body: "data=" + encodeURIComponent(QUERIES[name]),
            });
            const text = await res.text();
            if (res.ok && text.startsWith("{")) {
                if (file) writeFileSync(file, text);
                return JSON.parse(text);
            }
        } catch {
            /* retry */
        }
        await sleep(30000 * (a + 1));
    }
    throw new Error("Overpass unavailable for " + name);
}

let seed = 20240607;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const proj = (p) => [(p.lon - BBOX.w) * MX, (p.lat - BBOX.s) * MY];

// ---------------------------------------------------------------- water ----
const water = new Uint8Array(RS * RS);
const cellX = RS / W_M;
const cellY = RS / H_M;
const same = (a, b) => Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) < 0.5;
function fillPoly(ring) {
    const pts = ring.map(([x, y]) => [x * cellX, y * cellY]);
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
        y0 = Math.min(y0, p[1]);
        y1 = Math.max(y1, p[1]);
    }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(RS - 1, Math.ceil(y1)); y++) {
        const yy = y + 0.5;
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            if (a[1] <= yy !== b[1] <= yy) xs.push(a[0] + ((yy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
        xs.sort((p, q) => p - q);
        for (let i = 0; i + 1 < xs.length; i += 2)
            for (let x = Math.max(0, Math.floor(xs[i])); x <= Math.min(RS - 1, Math.floor(xs[i + 1])); x++) water[y * RS + x] = 1;
    }
}
function strokeLine(pts, radiusM) {
    const r = Math.max(1, Math.round(radiusM * cellX));
    for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const len = Math.hypot(bx - ax, by - ay);
        const n = Math.max(1, Math.ceil(len * cellX));
        for (let k = 0; k <= n; k++) {
            const cx = ((ax + ((bx - ax) * k) / n) * cellX) | 0;
            const cy = ((ay + ((by - ay) * k) / n) * cellY) | 0;
            for (let dy = -r; dy <= r; dy++)
                for (let dx = -r; dx <= r; dx++) {
                    const x = cx + dx;
                    const y = cy + dy;
                    if (dx * dx + dy * dy <= r * r && x >= 0 && y >= 0 && x < RS && y < RS) water[y * RS + x] = 1;
                }
        }
    }
}
function stitch(segs) {
    const rings = [];
    const rest = segs.map((s) => s.slice());
    while (rest.length) {
        let cur = rest.pop();
        let grew = true;
        while (grew && !same(cur[0], cur[cur.length - 1])) {
            grew = false;
            for (let i = 0; i < rest.length; i++) {
                const s = rest[i];
                const end = cur[cur.length - 1];
                if (same(s[0], end)) cur = cur.concat(s.slice(1));
                else if (same(s[s.length - 1], end)) cur = cur.concat(s.slice().reverse().slice(1));
                else continue;
                rest.splice(i, 1);
                grew = true;
                break;
            }
        }
        rings.push(cur);
    }
    return rings;
}

const wdata = await load("r3.json");
for (const el of wdata.elements) {
    if (el.type === "way" && el.geometry) {
        const pts = el.geometry.map(proj);
        if (el.tags?.waterway) strokeLine(pts, el.tags.waterway === "river" ? 110 : 18);
        else if (pts.length > 3 && same(pts[0], pts[pts.length - 1])) fillPoly(pts);
    } else if (el.type === "relation") {
        const outers = el.members.filter((m) => m.type === "way" && m.role !== "inner" && m.geometry).map((m) => m.geometry.map(proj));
        for (const ring of stitch(outers)) if (ring.length > 3 && same(ring[0], ring[ring.length - 1])) fillPoly(ring);
    }
}
const isWater = (x, y) => {
    const ix = (x * cellX) | 0;
    const iy = (y * cellY) | 0;
    return ix >= 0 && iy >= 0 && ix < RS && iy < RS && water[iy * RS + ix] === 1;
};

// ---------------------------------------------------------------- roads ----
// [brightness, spacing in metres]
const CLASS = {
    motorway: [1, 42], trunk: [0.95, 42], primary: [0.82, 44], secondary: [0.68, 50], tertiary: [0.55, 58],
    motorway_link: [0.7, 46], trunk_link: [0.7, 46], primary_link: [0.6, 48],
    residential: [0.34, 38], unclassified: [0.32, 40], living_street: [0.3, 42],
};
// District 1, Cholon, Thu Thiem / Binh Thanh, Phu My Hung: [lat, lon, radius m]
const CORES = [[10.7769, 106.7009, 2600], [10.7525, 106.6602, 1900], [10.801, 106.715, 1100], [10.73, 106.722, 1100]];
const cores = CORES.map(([la, lo, r]) => [(lo - BBOX.w) * MX, (la - BBOX.s) * MY, r]);
const centre = cores[0];
const coreK = (x, y) => {
    let k = 0;
    for (const [cx, cy, r] of cores) k = Math.max(k, Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * (r * 0.6) ** 2)));
    return k;
};

const cand = []; // x, y, brightness, core weight, minor flag
for (const name of ["r1.json", "r2.json"]) {
    const data = await load(name);
    for (const el of data.elements) {
        if (!el.geometry) continue;
        const cl = CLASS[el.tags?.highway];
        if (!cl) continue;
        const bridge = !!el.tags.bridge;
        const isMinor = cl[0] < 0.4;
        const pts = el.geometry.map(proj);
        let carry = rnd() * cl[1];
        for (let i = 0; i + 1 < pts.length; i++) {
            const [ax, ay] = pts[i];
            const [bx, by] = pts[i + 1];
            const len = Math.hypot(bx - ax, by - ay);
            let t = carry;
            while (t < len) {
                const u = t / len;
                const x = ax + (bx - ax) * u + (rnd() - 0.5) * 5;
                const y = ay + (by - ay) * u + (rnd() - 0.5) * 5;
                if (x >= 0 && y >= 0 && x < W_M && y < H_M && (bridge || !isWater(x, y)))
                    cand.push([x, y, cl[0] * (0.75 + rnd() * 0.4) * (bridge ? 1.15 : 1), coreK(x, y), isMinor ? 1 : 0]);
                t += cl[1] * (0.8 + rnd() * 0.4);
            }
            carry = t - len;
        }
    }
}
console.log("candidates", cand.length);

// Keep every arterial point; thin minor-road points by distance to the centre until we hit TARGET.
const major = cand.filter((c) => !c[4]);
const minor = cand.filter((c) => c[4]);
const room = Math.max(0, TARGET - major.length);
const wgt = minor.map((c) => 0.18 + 0.82 * Math.max(coreK(c[0], c[1]), Math.exp(-Math.hypot(c[0] - centre[0], c[1] - centre[1]) / 6500)));
const scale = room / wgt.reduce((a, b) => a + b, 0);
const keep = [...major];
minor.forEach((c, i) => {
    if (rnd() < Math.min(1, wgt[i] * scale)) keep.push(c);
});
console.log("kept", keep.length, "(arterial", major.length + ")");

// -------------------------------------------------------------- encode ----
const N = keep.length;
const head = 28;
const buf = Buffer.alloc(head + N * 6 + G * G * 2);
buf.write("SGL1", 0, "latin1");
buf.writeUInt32LE(N, 4);
[BBOX.w, BBOX.s, BBOX.e, BBOX.n].forEach((v, i) => buf.writeFloatLE(v, 8 + i * 4));
buf.writeUInt16LE(G, 24);
const dens = new Float32Array(G * G);
let o = head;
for (const [x, y, b, k] of keep) {
    buf.writeUInt16LE(Math.min(65535, Math.round((x / W_M) * 65535)), o);
    buf.writeUInt16LE(Math.min(65535, Math.round((y / H_M) * 65535)), o + 2);
    buf[o + 4] = Math.min(255, Math.round(b * 235));
    buf[o + 5] = Math.min(255, Math.round((k * 0.85 + rnd() * 0.15) * 255));
    o += 6;
    dens[Math.min(G - 1, ((y / H_M) * G) | 0) * G + Math.min(G - 1, ((x / W_M) * G) | 0)] += b;
}
const blur = (src) => {
    const dst = new Float32Array(G * G);
    for (let y = 0; y < G; y++)
        for (let x = 0; x < G; x++) {
            let s = 0;
            let c = 0;
            for (let dy = -2; dy <= 2; dy++)
                for (let dx = -2; dx <= 2; dx++) {
                    const xx = x + dx;
                    const yy = y + dy;
                    if (xx >= 0 && yy >= 0 && xx < G && yy < G) {
                        s += src[yy * G + xx];
                        c++;
                    }
                }
            dst[y * G + x] = s / c;
        }
    return dst;
};
const d2 = blur(blur(dens));
let mx = 0;
for (const v of d2) mx = Math.max(mx, v);
for (let i = 0; i < G * G; i++) buf[o + i] = Math.round(Math.pow(d2[i] / mx, 0.6) * 255);
o += G * G;
const f = RS / G;
for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
        let s = 0;
        for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += water[(y * f + dy) * RS + x * f + dx];
        buf[o + y * G + x] = Math.round((s / (f * f)) * 255);
    }
const out = join(here, "..", "public", "saigon", "lights.bin");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
console.log("wrote", out, buf.length, "bytes");
