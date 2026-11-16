"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Glow, markerPos, seeded, useSceneFrame } from "./shared";

// Level 6: the cosmic web at 93 billion light years. Galaxies are particles
// scattered around curved filaments that join at bright warm nodes, with dark
// voids in between; a faint haze runs along the filaments. Two draw calls (main
// particles + haze). The centre band, where the one big text line sits, is
// dimmed in the shader so the copy stays readable. `meta.origin` is the node
// our own galaxy lives in (kept off the text band).
export const meta = { origin: [0.66, 0.27], originMobile: [0.5, 0.2] };

const DESKTOP_POINTS = 120000;
const MOBILE_POINTS = 50000;
const HAZE_DESKTOP = 5000;
const HAZE_MOBILE = 2200;

const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

const INDIGO = [0.26, 0.2, 0.74];
const VIOLET = [0.5, 0.3, 0.84];
const WARM = [1.0, 0.7, 0.44];
const HOT = [1.0, 0.86, 0.66];
const colorForHeat = (h, out) => {
    // 0 = faint indigo, ~0.45 = violet, 1 = warm node core
    const a = smooth(0, 0.5, h);
    const b = smooth(0.45, 0.85, h);
    const c = smooth(0.85, 1.0, h);
    for (let i = 0; i < 3; i++) {
        let v = INDIGO[i] + (VIOLET[i] - INDIGO[i]) * a;
        v += (WARM[i] - v) * b;
        v += (HOT[i] - v) * c * 0.5;
        out[i] = v;
    }
};

function buildWeb({ w, h, mobile, nodeWorld }) {
    const rnd = seeded(77);
    const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-6, rnd()))) * Math.cos(Math.PI * 2 * rnd());
    const total = mobile ? MOBILE_POINTS : DESKTOP_POINTS;
    const hazeTotal = mobile ? HAZE_MOBILE : HAZE_DESKTOP;
    const NODES = mobile ? 44 : 72;

    // Nodes in frame-filling coordinates (they fill the view at every depth).
    const nodes = [];
    const fit = (u, v, z) => {
        const hh = Math.tan(Math.PI / 8) * (12.07 - z);
        return [u * hh * (w / h) * 1.18, v * hh * 1.18, z];
    };
    const first = [nodeWorld[0], nodeWorld[1], 0];
    nodes.push({ p: first, m: 2.4 });
    const minSep = mobile ? 1.15 : 1.5;
    let tries = 0;
    while (nodes.length < NODES && tries++ < 4000) {
        const z = -11 + Math.pow(rnd(), 1.15) * 15;
        const p = fit(rnd() * 2 - 1, rnd() * 2 - 1, z);
        let ok = true;
        for (const n of nodes) {
            const dx = n.p[0] - p[0];
            const dy = n.p[1] - p[1];
            const dz = (n.p[2] - p[2]) * 0.5;
            if (dx * dx + dy * dy + dz * dz < minSep * minSep) {
                ok = false;
                break;
            }
        }
        if (ok) nodes.push({ p, m: 0.5 + Math.pow(rnd(), 2.2) * 1.3 });
    }

    // Filaments: each node links to its nearest neighbours.
    const edgeKey = new Set();
    const edges = [];
    const maxLen = mobile ? 5.5 : 7.5;
    nodes.forEach((a, i) => {
        const near = nodes
            .map((b, j) => ({ j, d: Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], (a.p[2] - b.p[2]) * 0.7) }))
            .filter((o) => o.j !== i && o.d < maxLen * (i === 0 ? 1.4 : 1))
            .sort((x, y) => x.d - y.d)
            .slice(0, i === 0 ? 4 : 3);
        near.forEach((o, rank) => {
            if (rank >= 2 && rnd() < 0.4) return;
            const key = i < o.j ? `${i}-${o.j}` : `${o.j}-${i}`;
            if (edgeKey.has(key)) return;
            edgeKey.add(key);
            edges.push({ a: i, b: o.j, len: o.d });
        });
    });

    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const misc = new Float32Array(total * 2); // size, alpha
    const hazePos = new Float32Array(hazeTotal * 3);
    const hazeCol = new Float32Array(hazeTotal * 3);
    const hazeMisc = new Float32Array(hazeTotal * 2);
    let n = 0;
    let hn = 0;
    const c = [0, 0, 0];
    const addStar = (x, y, z, heat, bright, size, alpha) => {
        if (n >= total) return;
        colorForHeat(Math.min(1, Math.max(0, heat)), c);
        pos[n * 3] = x - nodeWorld[0];
        pos[n * 3 + 1] = y - nodeWorld[1];
        pos[n * 3 + 2] = z;
        col[n * 3] = c[0] * bright;
        col[n * 3 + 1] = c[1] * bright;
        col[n * 3 + 2] = c[2] * bright;
        misc[n * 2] = size;
        misc[n * 2 + 1] = alpha;
        n++;
    };
    const addHaze = (x, y, z, heat, k) => {
        if (hn >= hazeTotal) return;
        colorForHeat(Math.min(1, Math.max(0, heat)), c);
        hazePos[hn * 3] = x - nodeWorld[0];
        hazePos[hn * 3 + 1] = y - nodeWorld[1];
        hazePos[hn * 3 + 2] = z;
        hazeCol[hn * 3] = c[0];
        hazeCol[hn * 3 + 1] = c[1];
        hazeCol[hn * 3 + 2] = c[2];
        hazeMisc[hn * 2] = 0.7 + rnd() * 0.7;
        hazeMisc[hn * 2 + 1] = 0.007 * k;
        hn++;
    };
    const lum = () => 0.4 + Math.pow(rnd(), 2.6) * 1.6;

    // budget split
    const nodeMassSum = nodes.reduce((s, q) => s + Math.pow(q.m, 1.5), 0);
    const edgeWeights = edges.map((e) => e.len * (nodes[e.a].m + nodes[e.b].m) * 0.5);
    const edgeSum = edgeWeights.reduce((s, q) => s + q, 0) || 1;
    const nodeBudget = total * 0.3;
    const edgeBudget = total * 0.55;

    // node clusters
    nodes.forEach((q) => {
        const cnt = Math.floor((nodeBudget * Math.pow(q.m, 1.5)) / nodeMassSum);
        const sg = 0.22 + 0.2 * q.m;
        for (let i = 0; i < cnt; i++) {
            const g1 = gauss();
            const g2 = gauss();
            const g3 = gauss();
            const rr = Math.hypot(g1, g2, g3);
            const k = sg * (0.55 + 0.45 * Math.min(1.2, rr));
            const heat = 1 - Math.min(1, rr / 2.6) * 0.75;
            addStar(q.p[0] + g1 * k, q.p[1] + g2 * k, q.p[2] + g3 * k, heat, lum(), 0.036, 0.13);
        }
        for (let i = 0; i < 6; i++) addHaze(q.p[0] + gauss() * sg, q.p[1] + gauss() * sg, q.p[2] + gauss() * sg, 0.8, q.m * 2.2);
    });

    // filaments
    const perp = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const rv = new THREE.Vector3();
    edges.forEach((e, idx) => {
        const A = nodes[e.a].p;
        const B = nodes[e.b].p;
        dir.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
        const len = dir.length();
        dir.normalize();
        rv.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
        perp.crossVectors(dir, rv).normalize();
        const bend = (rnd() - 0.5) * 2 * 0.24 * len;
        const C = [(A[0] + B[0]) / 2 + perp.x * bend, (A[1] + B[1]) / 2 + perp.y * bend, (A[2] + B[2]) / 2 + perp.z * bend];
        const at = (t, o) => {
            const u = 1 - t;
            o[0] = u * u * A[0] + 2 * u * t * C[0] + t * t * B[0];
            o[1] = u * u * A[1] + 2 * u * t * C[1] + t * t * B[1];
            o[2] = u * u * A[2] + 2 * u * t * C[2] + t * t * B[2];
        };
        const cnt = Math.floor((edgeBudget * edgeWeights[idx]) / edgeSum);
        const clumpN = Math.max(2, Math.round(len / 0.8));
        const clumps = [];
        for (let i = 0; i < clumpN; i++) clumps.push(0.1 + rnd() * 0.8);
        const thick = 0.03 + 0.03 * Math.min(nodes[e.a].m, nodes[e.b].m);
        const q = [0, 0, 0];
        for (let i = 0; i < cnt; i++) {
            let t;
            let heat;
            let sg = thick;
            if (rnd() < 0.42) {
                t = clumps[(rnd() * clumpN) | 0] + gauss() * 0.025;
                sg = thick * 1.8;
                heat = 0.5;
            } else {
                t = rnd();
                heat = 0.3;
            }
            t = Math.min(1, Math.max(0, t));
            at(t, q);
            // thicker and warmer near the nodes
            const near = 1 - Math.min(t, 1 - t) * 2; // 0 at ends .. wait, 1 at ends
            const endness = Math.pow(1 - Math.min(1, Math.min(t, 1 - t) * 4), 1.5);
            const s = sg * (1 + endness * 1.6 + near * 0);
            heat += endness * 0.35;
            addStar(q[0] + gauss() * s, q[1] + gauss() * s, q[2] + gauss() * s, heat, lum(), 0.03, 0.13);
        }
        const hz = Math.floor(hazeTotal * 0.8 * (edgeWeights[idx] / edgeSum));
        for (let i = 0; i < hz; i++) {
            at(rnd(), q);
            addHaze(q[0] + gauss() * thick * 2, q[1] + gauss() * thick * 2, q[2] + gauss() * thick * 2, 0.25, 1);
        }
    });

    // sparse field galaxies (voids stay mostly dark)
    while (n < total) {
        const p = fit(rnd() * 2 - 1, rnd() * 2 - 1, -11 + rnd() * 15);
        addStar(p[0], p[1], p[2], 0.05, 0.3 + rnd() * 0.5, 0.02, 0.07);
    }
    return { pos, col, misc, hazePos, hazeCol, hazeMisc, hn, nodes, edges };
}

const vertexShader = /* glsl */ `
    attribute vec3 aCol;
    attribute vec2 aMisc;
    uniform float uScale;
    uniform float uGain;
    uniform float uBandH;
    uniform float uBandDim;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vSoft;
    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dist = max(0.5, -mv.z);
        vec4 clip = projectionMatrix * mv;
        gl_Position = clip;
        float raw = aMisc.x * uScale / dist;
        gl_PointSize = clamp(raw, 1.3, 64.0);
        float comp = min(1.0, (raw * raw) / (1.3 * 1.3));
        vSoft = smoothstep(14.0, 4.0, dist);
        vec2 ndc = clip.xy / clip.w;
        float band = exp(-pow(ndc.y / uBandH, 2.0)) * (1.0 - smoothstep(0.7, 1.05, abs(ndc.x)));
        float dim = 1.0 - uBandDim * band;
        float vig = 1.0 - 0.3 * smoothstep(0.6, 1.5, length(ndc));
        float far = mix(0.45, 1.0, smoothstep(34.0, 12.0, dist));
        vColor = aCol;
        vAlpha = aMisc.y * uGain * dim * vig * far * (0.3 + 0.7 * comp) * (1.0 - 0.45 * vSoft);
    }
`;

const fragmentShader = /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;
    varying float vSoft;
    void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d2 = dot(c, c) * 4.0;
        if (d2 > 1.0) discard;
        float a = exp(-d2 * mix(3.6, 1.8, vSoft)) * (1.0 - d2);
        float w = vAlpha * a;
        gl_FragColor = vec4(vColor * w, w * 0.7);
    }
`;

const makeMaterial = () =>
    new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        uniforms: {
            uScale: { value: 1000 },
            uGain: { value: 1 },
            uBandH: { value: 0.26 },
            uBandDim: { value: 0.85 },
        },
    });

export default function CosmicWeb({ progress }) {
    const f = useSceneFrame(progress);
    const gl = useThree((s) => s.gl);
    const rig = useRef();
    const { w, h, mobile } = f;
    const origin = mobile ? meta.originMobile : meta.origin;
    const nodeWorld = markerPos(origin, f);
    const nx = nodeWorld[0];
    const ny = nodeWorld[1];

    const data = useMemo(() => buildWeb({ w, h, mobile, nodeWorld: [nx, ny] }), [w, h, mobile, nx, ny]);

    const { geometry, hazeGeometry, material, hazeMaterial } = useMemo(() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(data.pos, 3));
        g.setAttribute("aCol", new THREE.BufferAttribute(data.col, 3));
        g.setAttribute("aMisc", new THREE.BufferAttribute(data.misc, 2));
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
        const hg = new THREE.BufferGeometry();
        hg.setAttribute("position", new THREE.BufferAttribute(data.hazePos.subarray(0, data.hn * 3), 3));
        hg.setAttribute("aCol", new THREE.BufferAttribute(data.hazeCol.subarray(0, data.hn * 3), 3));
        hg.setAttribute("aMisc", new THREE.BufferAttribute(data.hazeMisc.subarray(0, data.hn * 2), 2));
        hg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
        return { geometry: g, hazeGeometry: hg, material: makeMaterial(), hazeMaterial: makeMaterial() };
    }, [data]);
    useEffect(
        () => () => {
            geometry.dispose();
            hazeGeometry.dispose();
            material.dispose();
            hazeMaterial.dispose();
        },
        [geometry, hazeGeometry, material, hazeMaterial]
    );

    const bufSize = useMemo(() => new THREE.Vector2(), []);

    useFrame(() => {
        const p = progress.current;
        const { time, d } = p;
        const leave = smooth(0, 1, Math.max(0, d));
        const arrive = smooth(0, 1, Math.max(0, -d));
        const r = rig.current;
        if (r) {
            r.position.set(nx, ny, 3.2 * leave * leave);
            r.rotation.set(0.04 * Math.sin(time * 0.031) + 0.03 * arrive, 0.07 * Math.sin(time * 0.023) - d * 0.05, 0.02 * Math.sin(time * 0.017));
            r.scale.setScalar(1 + 0.3 * leave * leave);
        }
        gl.getDrawingBufferSize(bufSize);
        const bw = Math.min(2560, bufSize.x);
        const bh = bw * (bufSize.y / Math.max(1, bufSize.x));
        const bell = 4 * leave * (1 - leave);
        const gain = (0.85 + 0.15 * p.hold) * (1 + 0.45 * bell);
        for (const m of [material, hazeMaterial]) {
            m.uniforms.uScale.value = bh * 1.2071;
            m.uniforms.uGain.value = gain;
            m.uniforms.uBandH.value = mobile ? 0.42 : 0.27;
            m.uniforms.uBandDim.value = 0.86;
        }
    });

    return (
        <group ref={rig}>
            <points geometry={hazeGeometry} material={hazeMaterial} frustumCulled={false} renderOrder={0} />
            <points geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />
            {/* the node our galaxy lives in */}
            <Glow size={1.8} color="#4a2c14" power={2.4} position={[0, 0, 0]} />
        </group>
    );
}
