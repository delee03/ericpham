"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useSceneFrame } from "./shared";

// Level 4: Pale Blue Dot at ~6 billion km. An homage to Voyager 1's frame, drawn
// procedurally: near-black space, faint film grain, soft diagonal bands of
// scattered sunlight (one brighter) and, inside that band, a single pale-blue
// point with a thin ring that fades in at the hold. Everything is one quad.
export const meta = { origin: [0.6, 0.41], originMobile: [0.58, 0.36] };

const DOT_DESKTOP = [0.6, 0.41];
const DOT_MOBILE = [0.58, 0.36];

const vertex = /* glsl */ `
varying vec2 vP;
void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
precision highp float;
varying vec2 vP;
uniform vec2 uDot;      // world position of the dot
uniform float uPx;      // world units per device pixel
uniform float uRays;    // 0..1
uniform float uDotA;    // 0..1
uniform float uRing;    // 0..1
uniform float uH;       // frame height in world units
uniform float uTime;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float band(float k, float c, float wd) {
    float x = (k - c) / wd;
    return exp(-x * x);
}
void main() {
    // Rays run diagonally (upper-left to lower-right), the bright one through the dot.
    const float ang = -0.56;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 nrm = vec2(-dir.y, dir.x);
    vec2 rel = vP - uDot;
    float k = dot(rel, nrm) / uH;      // across the ray, in frame heights
    float l = dot(rel, dir) / uH;      // along the ray

    // scattered light: slow irregularity along each band keeps it from reading as a gradient
    float n1 = 0.65 + 0.55 * vnoise(vec2(l * 1.6 + 3.0, k * 3.0));
    float n2 = 0.6 + 0.6 * vnoise(vec2(l * 2.4 - 7.0, k * 5.0 + 1.0));

    float main = band(k, 0.0, 0.026) * 0.4 + band(k, 0.0, 0.09) * 0.1;
    float e = band(k, -0.34, 0.05) * 0.1 * n2
            + band(k, 0.27, 0.07) * 0.075 * n1
            + band(k, 0.58, 0.035) * 0.06 * n2
            + band(k, -0.72, 0.09) * 0.05 * n1
            + band(k, 0.9, 0.06) * 0.04;
    float haze = band(k, 0.05, 0.6) * 0.022;
    float rays = (main * (0.8 + 0.4 * n1) + e + haze);
    // ends of every band thin out so nothing looks like a straight stripe from edge to edge
    rays *= 0.55 + 0.45 * smoothstep(1.4, 0.0, abs(l - 0.1));
    vec3 warm = vec3(1.0, 0.66, 0.36);
    vec3 col = warm * rays * 0.21 * uRays;

    // the dot: a pixel or two with a soft glow
    float dp = length(rel) / uPx;
    float core = exp(-dp * dp / (2.0 * 0.85 * 0.85));
    float glow = exp(-dp * dp / (2.0 * 3.0 * 3.0)) * 0.22;
    vec3 blue = vec3(0.60, 0.77, 1.0);
    col += blue * (core * 1.0 + glow * 1.4) * uDotA;

    // thin ring, fades in at hold
    float rr = 30.0;
    float ring = smoothstep(1.1, 0.0, abs(dp - rr));
    float ringBreath = 0.82 + 0.18 * sin(uTime * 1.1);
    col += vec3(0.55, 0.7, 0.95) * ring * 0.34 * ringBreath * uRing;

    // fine film grain, static, very low amplitude
    float g = hash(floor(gl_FragCoord.xy)) - 0.5;
    float g2 = hash(floor(gl_FragCoord.xy * 0.5) + 17.0) - 0.5;
    col += vec3(g * 0.013 + g2 * 0.008) * (0.4 + rays * 6.0) * uRays;
    col = max(col, vec3(0.0));

    float a = clamp(max(col.r, max(col.g, col.b)) * 1.05, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
}`;

const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export default function PaleBlueDot({ progress }) {
    const f = useSceneFrame(progress);
    const size = useThree((s) => s.size);
    const dpr = useThree((s) => s.viewport.dpr);
    const mesh = useRef();
    const dotAt = f.mobile ? DOT_MOBILE : DOT_DESKTOP;

    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                vertexShader: vertex,
                fragmentShader: fragment,
                transparent: true,
                depthWrite: false,
                depthTest: false,
                premultipliedAlpha: true,
                uniforms: {
                    uDot: { value: new THREE.Vector2() },
                    uPx: { value: 0.01 },
                    uRays: { value: 0 },
                    uDotA: { value: 1 },
                    uRing: { value: 0 },
                    uH: { value: 10 },
                    uTime: { value: 0 },
                },
            }),
        []
    );
    useEffect(() => () => material.dispose(), [material]);

    useEffect(() => {
        const u = material.uniforms;
        u.uDot.value.set((dotAt[0] - 0.5) * f.w, (0.5 - dotAt[1]) * f.h);
        u.uPx.value = f.h / Math.max(1, size.height * dpr);
        u.uH.value = f.h;
    }, [material, f, dotAt, size.height, dpr]);

    useFrame(() => {
        const { d, hold, time } = progress.current;
        const u = material.uniforms;
        const leave = ease(clamp01(d));
        const arrive = ease(clamp01(1 + d));
        u.uRays.value = (0.25 + 0.75 * arrive) * (1 - clamp01(d / 0.7) * 1);
        u.uDotA.value = 1 - 0.75 * leave;
        u.uRing.value = ease(clamp01((hold - 0.55) / 0.45)) * (1 - clamp01(d / 0.2));
        u.uTime.value = time;
    });

    return (
        <mesh ref={mesh} position={[0, 0, 0]} material={material} frustumCulled={false} renderOrder={1}>
            <planeGeometry args={[f.w * 1.5 + 2, f.h * 1.5]} />
        </mesh>
    );
}
