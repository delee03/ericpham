"use client";

import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Glow, useSceneFrame } from "./shared";

// Level 3: an authored, not-to-scale flyby of four bodies (Moon, Mars, Jupiter,
// Saturn) at ~9 AU. Arriving (d -1 -> 0) the camera passes them in order and
// comes to rest on Saturn; leaving (d 0 -> 1) the whole system contracts toward
// the middle of the subject area so the shrinking frame reads as a point.
// Textures: Solar System Scope, CC BY 4.0 (see public/textures).
export const meta = { origin: [0.775, 0.83], originMobile: [0.54, 0.59] };

const TEXTURES = ["/textures/moon.webp", "/textures/mars.webp", "/textures/jupiter.webp", "/textures/saturn.webp", "/textures/saturn_ring_alpha.webp"];

const RING_IN = 1.3;
const RING_OUT = 2.3;

// Warm sun from upper-left and slightly behind the camera: soft terminator on
// the right limb of each body.
const SUN = new THREE.Vector3(-0.88, 0.36, 0.3).normalize();
const SUN_COLOR = new THREE.Color(1.0, 0.93, 0.82);

const planetVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
    vUv = uv;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
}`;

const planetFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
uniform sampler2D uMap;
uniform sampler2D uRingMap;
uniform vec3 uL;
uniform vec3 uSun;
uniform float uGain;
uniform float uContrast;
uniform float uLimb;
uniform vec3 uAtmo;
uniform float uHasRing;
uniform vec3 uRingC;
uniform vec3 uRingN;
uniform float uRingR;
void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    float nl = dot(N, uL);
    float lit = smoothstep(-0.06, 0.62, nl);
    float mu = clamp(dot(N, V), 0.0, 1.0);
    vec3 alb = texture2D(uMap, vUv).rgb;
    alb = pow(max(alb, vec3(0.0)), vec3(uContrast));
    float sh = 1.0;
    if (uHasRing > 0.5) {
        float den = dot(uL, uRingN);
        if (abs(den) > 0.001) {
            float t = dot(uRingC - vW, uRingN) / den;
            if (t > 0.0) {
                vec3 q = vW + uL * t;
                float rr = length(q - uRingC) / uRingR;
                float u = (rr - ${RING_IN.toFixed(2)}) / ${(RING_OUT - RING_IN).toFixed(2)};
                if (u > 0.0 && u < 1.0) {
                    float a = texture2D(uRingMap, vec2(u, 0.5)).a;
                    sh = 1.0 - 0.82 * a;
                }
            }
        }
    }
    vec3 col = alb * uSun * uGain * lit * sh;
    col *= mix(1.0 - uLimb, 1.0, pow(mu, 0.55));
    col += uAtmo * pow(1.0 - mu, 3.0) * lit * sh;
    col += alb * 0.012; // faint earthshine / starlight so the night side is not a hole
    gl_FragColor = vec4(col, 1.0);
}`;

const ringVertex = /* glsl */ `
varying vec2 vP;
varying vec3 vW;
void main() {
    vP = position.xy;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
}`;

const ringFragment = /* glsl */ `
precision highp float;
varying vec2 vP;
varying vec3 vW;
uniform sampler2D uRingMap;
uniform vec3 uL;
uniform vec3 uSun;
uniform vec3 uRingC;
uniform float uRingR;
void main() {
    float rr = length(vP);
    float u = (rr - ${RING_IN.toFixed(2)}) / ${(RING_OUT - RING_IN).toFixed(2)};
    if (u <= 0.0 || u >= 1.0) discard;
    vec4 t = texture2D(uRingMap, vec2(u, 0.5));
    // planet's shadow across the rings
    vec3 rel = uRingC - vW;
    float s = dot(rel, uL);
    float dist = length(rel - uL * s);
    float sh = 1.0;
    if (s > 0.0) sh = smoothstep(uRingR * 0.97, uRingR * 1.04, dist);
    sh = mix(0.06, 1.0, sh);
    vec3 col = t.rgb * uSun * 1.25 * sh;
    float a = t.a * 0.96;
    gl_FragColor = vec4(col, a);
}`;

const makePlanetMaterial = (map, ringMap, o) =>
    new THREE.ShaderMaterial({
        vertexShader: planetVertex,
        fragmentShader: planetFragment,
        uniforms: {
            uMap: { value: map },
            uRingMap: { value: ringMap },
            uL: { value: SUN },
            uSun: { value: SUN_COLOR },
            uGain: { value: o.gain ?? 1.2 },
            uContrast: { value: o.contrast ?? 1 },
            uLimb: { value: o.limb ?? 0.35 },
            uAtmo: { value: new THREE.Color(o.atmo ?? "#000000") },
            uHasRing: { value: o.ring ? 1 : 0 },
            uRingC: { value: new THREE.Vector3() },
            uRingN: { value: new THREE.Vector3(0, 1, 0) },
            uRingR: { value: 1 },
        },
    });

const ease = (x) => x * x * (3 - 2 * x);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Rest layouts, in world units at z = 0 (before perspective). `u` is the base radius.
function layout(f) {
    const { w, h } = f;
    if (f.mobile) {
        const u = Math.min(w * 0.2, 1.0);
        return {
            center: [0.05, -3.0],
            earth: [0.2, -0.9],
            bodies: [
                { p: [1.6, -1.95, 1], r: u * 0.2 },
                { p: [-1.35, -1.6, 0], r: u * 0.3 },
                { p: [1.1, -0.75, -2], r: u * 0.52 },
                { p: [0.1, -3.0, 0], r: u * 0.9 },
            ],
        };
    }
    const u = Math.min(h * 0.18, w * 0.11);
    return {
        center: [w * 0.22, 0],
        earth: [w * 0.275, -h * 0.33],
        bodies: [
            { p: [w * 0.15, -h * 0.34, 1.2], r: u * 0.17 },
            { p: [w * 0.375, h * 0.33, 0], r: u * 0.3 },
            { p: [w * 0.115, h * 0.3, -2.5], r: u * 0.58 },
            { p: [w * 0.235, -h * 0.03, 0], r: u * 0.94 },
        ],
    };
}

// Per-body animation: [arrive start, arrive end], entry offset, spin rate, axial tilt.
const BODY = [
    { win: [0.0, 0.5], off: [13, 1.0, 4], spin: 0.02, tilt: [0.1, 0, 0.1] },
    { win: [0.14, 0.62], off: [15, -1.2, 4], spin: 0.03, tilt: [0.2, 0, -0.3] },
    { win: [0.28, 0.8], off: [17, 1.4, 4], spin: 0.09, tilt: [0.05, 0, 0.05] },
    { win: [0.4, 1.0], off: [20, -0.8, 3], spin: 0.045, tilt: [0.5, 0, -0.42] },
];
const SATURN_TILT = [0.5, 0, -0.42];

const _q = new THREE.Quaternion();
const _n = new THREE.Vector3();

export default function Planets({ progress }) {
    const f = useSceneFrame(progress);
    const [moonT, marsT, jupT, satT, ringT] = useTexture(TEXTURES);
    const rig = useRef();
    const bodies = useRef([]);
    const spins = useRef([]);
    const earth = useRef();
    const satTilt = useRef();
    const ringMesh = useRef();
    const L = useMemo(() => layout(f), [f]);

    useEffect(() => {
        [moonT, marsT, jupT, satT, ringT].forEach((t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 8;
            t.needsUpdate = true;
        });
        ringT.wrapS = ringT.wrapT = THREE.ClampToEdgeWrapping;
    }, [moonT, marsT, jupT, satT, ringT]);

    const mats = useMemo(
        () => [
            makePlanetMaterial(moonT, ringT, { gain: 1.55, contrast: 1.05, limb: 0.18 }),
            makePlanetMaterial(marsT, ringT, { gain: 1.3, contrast: 1.05, limb: 0.3, atmo: "#3a1c10" }),
            makePlanetMaterial(jupT, ringT, { gain: 1.25, contrast: 1.18, limb: 0.42, atmo: "#2a2018" }),
            makePlanetMaterial(satT, ringT, { gain: 1.3, contrast: 1.08, limb: 0.38, atmo: "#241c10", ring: true }),
        ],
        [moonT, marsT, jupT, satT, ringT]
    );
    const ringMat = useMemo(
        () =>
            new THREE.ShaderMaterial({
                vertexShader: ringVertex,
                fragmentShader: ringFragment,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
                uniforms: {
                    uRingMap: { value: ringT },
                    uL: { value: SUN },
                    uSun: { value: SUN_COLOR },
                    uRingC: { value: mats[3].uniforms.uRingC.value },
                    uRingR: { value: 1 },
                },
            }),
        [ringT, mats]
    );
    const sphere = useMemo(() => new THREE.SphereGeometry(1, f.mobile ? 48 : 96, f.mobile ? 32 : 64), [f.mobile]);
    const ringGeo = useMemo(() => new THREE.PlaneGeometry(RING_OUT * 2, RING_OUT * 2, 1, 1), []);

    useEffect(
        () => () => {
            mats.forEach((m) => m.dispose());
            ringMat.dispose();
            sphere.dispose();
            ringGeo.dispose();
        },
        [mats, ringMat, sphere, ringGeo]
    );

    useFrame(() => {
        const { d, time } = progress.current;
        const s = d < 0 ? clamp01(d + 1) : 1;
        const leave = ease(clamp01(d));
        const c = 1 - 0.72 * leave;
        const rg = rig.current;
        if (!rg) return;
        rg.position.set(L.center[0], L.center[1], 0);
        rg.scale.setScalar(c);

        for (let i = 0; i < 4; i++) {
            const g = bodies.current[i];
            const b = L.bodies[i];
            const cfg = BODY[i];
            const u = easeOut(clamp01((s - cfg.win[0]) / (cfg.win[1] - cfg.win[0])));
            const k = 1 - u;
            const drift = Math.sin(time * 0.25 + i * 1.7) * 0.04;
            g.position.set(
                b.p[0] - L.center[0] + cfg.off[0] * k * (f.mobile ? 0.45 : 1),
                b.p[1] - L.center[1] + cfg.off[1] * k + drift,
                b.p[2] + cfg.off[2] * k
            );
            const sc = b.r * (1 + 0.15 * k);
            g.scale.setScalar(sc);
            spins.current[i].rotation.y = time * cfg.spin + i * 2.1;
        }

        // Ring uniforms (world space), from the Saturn tilt group.
        rg.updateMatrixWorld(true);
        const st = satTilt.current;
        const m = mats[3].uniforms;
        st.getWorldPosition(m.uRingC.value);
        st.getWorldQuaternion(_q);
        _n.set(0, 1, 0).applyQuaternion(_q);
        m.uRingN.value.copy(_n);
        const R = L.bodies[3].r * (1 + 0.15 * (1 - easeOut(clamp01((s - BODY[3].win[0]) / (BODY[3].win[1] - BODY[3].win[0]))))) * c;
        m.uRingR.value = R;
        ringMat.uniforms.uRingR.value = R;

        if (earth.current) earth.current.scale.setScalar(1 - leave);
    });

    return (
        <>
            <group ref={rig}>
                {[0, 1, 2, 3].map((i) => (
                    <group key={i} ref={(el) => (bodies.current[i] = el)}>
                        <group
                            ref={i === 3 ? satTilt : undefined}
                            rotation={i === 3 ? SATURN_TILT : BODY[i].tilt}
                        >
                            <mesh ref={(el) => (spins.current[i] = el)} geometry={sphere} material={mats[i]} />
                            {i === 3 && <mesh ref={ringMesh} rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeo} material={ringMat} renderOrder={2} />}
                        </group>
                    </group>
                ))}
            </group>
            {/* Earth, ~9 AU away: a faint pale-blue point, where the previous level shrinks to */}
            <group ref={earth} position={[L.earth[0], L.earth[1], 0]}>
                <Glow size={0.45} color="#6f9fe0" power={2.6} />
                <Glow size={0.2} color="#bcd8ff" power={1.4} />
            </group>
        </>
    );
}
