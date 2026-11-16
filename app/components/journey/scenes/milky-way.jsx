"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Glow, markerPos, seeded, useSceneFrame } from "./shared";

// Level 5: the Milky Way at 100,000 light years. A single GPU particle galaxy
// (one draw call): barred spiral, 2 major + 2 minor logarithmic arms, warm
// bulge and bar, blue-white young stars and sparse HII specks on the arms, dust
// lanes carved into the inner edge of every arm, a faint halo, and differential
// rotation evaluated in the vertex shader. The "you are here" ring sits in a
// minor arm at ~55% of the disc radius and is `meta.origin`.
export const meta = { origin: [0.72, 0.6], originMobile: [0.5, 0.74] };

const DESKTOP_COUNT = 200000;
const MOBILE_COUNT = 80000;

// Spiral geometry (local units, disc radius = 1).
const PITCH_K = 3.6; // theta = K * ln(r / R0) + phase
const R0 = 0.24;
const BAR_HALF = 0.3;
const SUN_R = 0.55;
const TAU = Math.PI * 2;
const MAJOR = [0, Math.PI];
const MINOR = [Math.PI / 2, Math.PI * 1.5];
const armTheta = (r, phase) => PITCH_K * Math.log(r / R0) + phase;
// Sun: on the second minor arm.
const SUN_THETA = armTheta(SUN_R, MINOR[1]);
const SUN_LOCAL = [SUN_R * Math.cos(SUN_THETA), SUN_R * Math.sin(SUN_THETA), 0];

const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

function buildGalaxy(count) {
    const rnd = seeded(41);
    const gauss = () => {
        const u = Math.max(1e-6, rnd());
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd());
    };
    const polar = new Float32Array(count * 3);
    const color = new Float32Array(count * 3);
    const misc = new Float32Array(count * 4); // size, alpha, rigid, unused
    let n = 0;

    const push = (x, y, z, rgb, k, size, alpha, rigid) => {
        if (n >= count) return;
        const r = Math.hypot(x, y);
        polar[n * 3] = r;
        polar[n * 3 + 1] = Math.atan2(y, x);
        polar[n * 3 + 2] = z;
        color[n * 3] = rgb[0] * k;
        color[n * 3 + 1] = rgb[1] * k;
        color[n * 3 + 2] = rgb[2] * k;
        misc[n * 4] = size;
        misc[n * 4 + 1] = alpha;
        misc[n * 4 + 2] = rigid;
        n++;
    };
    // heavy-tailed brightness: most stars faint, a few bright
    const lum = () => 0.35 + Math.pow(rnd(), 3.2) * 1.5;

    const cream = [1.0, 0.8, 0.52];
    const gold = [1.0, 0.7, 0.38];
    const yellowish = [1.0, 0.86, 0.62];
    const blue = [0.62, 0.74, 1.0];
    const pink = [1.0, 0.45, 0.6];

    const nBulge = Math.floor(count * 0.2);
    const nBar = Math.floor(count * 0.16);
    const nHalo = Math.floor(count * 0.05);
    const nDisc = Math.floor(count * 0.24);

    // Bulge: two nested gaussians, slightly flattened.
    for (let i = 0; i < nBulge; i++) {
        const s = rnd() < 0.55 ? 0.04 : 0.1;
        const mix = rnd();
        const c = [cream[0] * (1 - mix * 0.1) + gold[0] * mix * 0.1, cream[1] * (1 - mix) + gold[1] * mix, cream[2] * (1 - mix) + gold[2] * mix];
        push(gauss() * s, gauss() * s, gauss() * s * 0.7, c, lum(), 0.011, 0.05, 0);
    }
    // Bar: elongated along +x, rotates rigidly.
    for (let i = 0; i < nBar; i++) {
        const t = (rnd() + rnd() + rnd() - 1.5) / 1.5; // -1..1, centre heavy
        const x = t * BAR_HALF;
        const y = gauss() * (0.036 + 0.014 * Math.abs(t));
        push(x, y, gauss() * 0.02, gold, lum(), 0.01, 0.1, 1);
    }
    // Faint spherical halo.
    for (let i = 0; i < nHalo; i++) {
        const r = 0.15 + Math.pow(rnd(), 0.8) * 0.95;
        const u = rnd() * 2 - 1;
        const a = rnd() * TAU;
        const s = Math.sqrt(1 - u * u);
        push(r * s * Math.cos(a), r * s * Math.sin(a), r * u * 0.8, [0.9, 0.82, 0.72], 0.4 + rnd() * 0.5, 0.008, 0.05, 0);
    }
    // Smooth inter-arm disc.
    for (let i = 0; i < nDisc; i++) {
        let r;
        do r = 0.04 + rnd() * 1.0;
        while (rnd() > Math.exp(-(r - 0.04) / 0.3));
        const a = rnd() * TAU;
        push(r * Math.cos(a), r * Math.sin(a), gauss() * 0.012, yellowish, lum() * 0.8, 0.0075, 0.09, 0);
    }
    // Arms (the rest).
    const armW = [1, 1, 0.42, 0.42];
    const armPhase = [MAJOR[0], MAJOR[1], MINOR[0], MINOR[1]];
    const armSum = armW.reduce((a, b) => a + b, 0);
    let guard = 0;
    while (n < count && guard++ < count * 40) {
        let pick = rnd() * armSum;
        let ai = 0;
        while (pick > armW[ai]) pick -= armW[ai++];
        const minor = ai >= 2;
        // radius: exponential falloff, arms begin at the bar end (minor arms further out)
        const rMin = minor ? 0.36 : 0.26;
        const r = rMin + rnd() * (1.02 - rMin);
        if (rnd() > Math.exp(-(r - 0.2) / 0.42) * smooth(0.24, 0.42, r)) continue;
        const t = armTheta(r, armPhase[ai]);
        // clumpiness along the arm
        const clump = 0.5 + 0.5 * Math.sin(6.5 * t + 2.2 * Math.sin(2.7 * t + ai));
        if (rnd() > 0.35 + 0.65 * clump) continue;
        // taper minor arms in and out
        if (minor && rnd() > smooth(0.36, 0.5, r) * (1 - smooth(0.85, 1.02, r) * 0.6)) continue;
        const sigma = 0.1 + 0.1 * r; // angular
        const g = gauss();
        const s = g * sigma; // + = inner edge (smaller radius at fixed r)
        // dust lane on the inner edge
        const lane = Math.exp(-Math.pow((g - 0.95) / 0.38, 2));
        if (rnd() < lane * 0.6) continue;
        const dust = Math.min(1, lane * 1.3 + (g > 0.4 ? 0.12 : 0));
        const th = t + s;
        const x = r * Math.cos(th);
        const y = r * Math.sin(th);
        const z = gauss() * (0.008 + 0.006 * (1 - r));
        // colour: young blue on and outside the arm centre, older warm inward / near the centre
        const youth = Math.min(1, Math.max(0, 0.45 + 0.4 * (r - 0.3) - g * 0.28 + (rnd() - 0.5) * 0.4));
        const roll = rnd();
        let c;
        let size = 0.0062 + rnd() * 0.002;
        let alpha = 0.16;
        let k = lum();
        if (roll < 0.014 && g < 0.5 && g > -1.0 && r > 0.3) {
            c = pink;
            size = 0.011;
            alpha = 0.22;
            k = 0.9 + rnd() * 0.5;
        } else {
            c = [
                yellowish[0] + (blue[0] - yellowish[0]) * youth,
                yellowish[1] + (blue[1] - yellowish[1]) * youth,
                yellowish[2] + (blue[2] - yellowish[2]) * youth,
            ];
        }
        k *= 1 - dust * 0.6;
        push(x, y, z, c, k, size, alpha * (0.65 + 0.35 * clump), 0);
    }
    // any remainder (rejection can run out) falls back to the smooth disc
    while (n < count) {
        const r = 0.2 + rnd() * 0.8;
        const a = rnd() * TAU;
        push(r * Math.cos(a), r * Math.sin(a), gauss() * 0.01, yellowish, 0.4, 0.007, 0.08, 0);
    }
    return { polar, color, misc };
}

const vertexShader = /* glsl */ `
    attribute vec3 aPolar;
    attribute vec3 aColor;
    attribute vec4 aMisc;
    uniform float uTime;
    uniform float uUnit;
    uniform float uScale;
    uniform float uGain;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
        float r = aPolar.x;
        float om = aMisc.z > 0.5 ? -0.02 : -0.008 / (0.2 + max(r, 0.2));
        float th = aPolar.y + om * uTime;
        vec3 p = vec3(r * cos(th), r * sin(th), aPolar.z);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float raw = aMisc.x * uUnit * uScale / max(0.5, -mv.z);
        float px = max(raw, 1.4);
        gl_PointSize = px;
        gl_Position = projectionMatrix * mv;
        float comp = min(1.0, (raw * raw) / (1.4 * 1.4));
        vColor = aColor;
        vAlpha = aMisc.y * uGain * (0.25 + 0.75 * comp);
    }
`;

const fragmentShader = /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d2 = dot(c, c) * 4.0;
        if (d2 > 1.0) discard;
        float a = exp(-d2 * 3.2) * (1.0 - d2);
        float w = vAlpha * a;
        gl_FragColor = vec4(vColor * w, w * 0.7);
    }
`;

export default function MilkyWay({ progress }) {
    const f = useSceneFrame(progress);
    const gl = useThree((s) => s.gl);
    const group = useRef();
    const ring = useRef();
    const ringMat = useRef();
    const dotMat = useRef();
    const mobile = f.mobile;

    const geometry = useMemo(() => {
        const { polar, color, misc } = buildGalaxy(mobile ? MOBILE_COUNT : DESKTOP_COUNT);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(polar.length), 3)); // unused, keeps count
        g.setAttribute("aPolar", new THREE.BufferAttribute(polar, 3));
        g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
        g.setAttribute("aMisc", new THREE.BufferAttribute(misc, 4));
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
        return g;
    }, [mobile]);

    const material = useMemo(
        () =>
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
                    uTime: { value: 0 },
                    uUnit: { value: 4 },
                    uScale: { value: 1000 },
                    uGain: { value: 1 },
                },
            }),
        []
    );
    useEffect(
        () => () => {
            geometry.dispose();
            material.dispose();
        },
        [geometry, material]
    );

    // preallocated temporaries
    const tmp = useMemo(
        () => ({ v: new THREE.Vector3(), e: new THREE.Euler(0, 0, 0, "ZXY"), size: new THREE.Vector2() }),
        []
    );

    const baseR = mobile ? Math.min(f.w * 0.5, 2.5) : Math.min(f.h * 0.46, f.w * 0.26);
    const origin = mobile ? meta.originMobile : meta.origin;
    const target = markerPos(origin, f);
    const centreEnd = mobile ? [0, -1.4] : [0, 0];

    useFrame(() => {
        const g = group.current;
        if (!g) return;
        const p = progress.current;
        const d = p.d;
        const arrive = smooth(0, 1, Math.max(0, -d));
        const leave = smooth(0, 1, Math.max(0, d));
        const hold = p.hold;

        // Tilt (angle from face-on). Arriving: nearer to edge-on, as if inside the disc.
        // Leaving: opens towards face-on so the whole galaxy reads as one object.
        const tilt = 1.1 + 0.3 * arrive - 0.66 * leave;
        const roll = -0.28 + 0.16 * leave;
        const s = baseR * (1 + 0.3 * arrive) * (1 - 0.3 * leave);
        g.rotation.set(tilt, 0, roll, "ZXY");
        g.scale.setScalar(s);

        // Pin the Sun marker on the origin point, then drift the whole disc to the
        // centre of the free area while leaving so nothing clips.
        tmp.v.set(SUN_LOCAL[0] * s, SUN_LOCAL[1] * s, 0).applyEuler(g.rotation);
        const mix = leave;
        g.position.x = target[0] - tmp.v.x + (centreEnd[0] - (target[0] - tmp.v.x)) * mix;
        g.position.y = target[1] - tmp.v.y + (centreEnd[1] - (target[1] - tmp.v.y)) * mix;
        g.position.z = 0;

        gl.getDrawingBufferSize(tmp.size);
        const bw = Math.min(2560, tmp.size.x);
        const bh = bw * (tmp.size.y / Math.max(1, tmp.size.x));
        const u = material.uniforms;
        u.uTime.value = p.time;
        u.uUnit.value = s;
        u.uScale.value = bh * 1.2071;
        // brightness settles in on arrival, softens as the frame shrinks
        u.uGain.value = (mobile ? 1.15 : 1) * (0.8 + 0.2 * hold);

        const markerOn = smooth(0.5, 1, hold) * (1 - smooth(0, 0.5, d));
        if (ringMat.current) ringMat.current.opacity = markerOn * 0.85;
        if (dotMat.current) dotMat.current.opacity = markerOn * 0.9;
        if (ring.current) ring.current.scale.setScalar(1 + 0.07 * Math.sin(p.time * 1.4) + (1 - markerOn) * 0.6);
    });

    return (
        <group ref={group}>
            <Glow size={2.5} scaleY={2.5} color="#3a2c1e" power={1.5} position={[0, 0, -0.01]} />
            <Glow size={0.8} scaleY={0.8} color="#4a3622" power={2.2} position={[0, 0, 0]} />
            <points geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />
            {/* "you are here" marker, in the disc plane at the Sun's position */}
            <group position={SUN_LOCAL}>
                <mesh ref={ring} renderOrder={2}>
                    <ringGeometry args={[0.03, 0.036, 56]} />
                    <meshBasicMaterial ref={ringMat} color="#cfe6ff" transparent opacity={0} depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} />
                </mesh>
                <mesh renderOrder={2}>
                    <circleGeometry args={[0.005, 20]} />
                    <meshBasicMaterial ref={dotMat} color="#ffffff" transparent opacity={0} depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} />
                </mesh>
            </group>
        </group>
    );
}
