"use client";

import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

// The camera every scene is rendered with (see README.md): vertical fov 45
// degrees at z = 12.07 looking at the origin, so the visible HEIGHT at z = 0 is
// exactly 10 world units. Width = 10 * aspect.
export const SCENE_CAMERA = { fov: 45, position: [0, 0, 12.07], near: 0.1, far: 2000 };

// Framing helper for scene authors. The HTML content sits on the left ~45% on
// desktop and in the upper half on mobile, so the "subject" lives on the
// right (desktop) or in the lower half (mobile).
//   w, h      visible size in world units at z = 0
//   cx, cy    centre of the free (subject) area in world units
//   r         comfortable subject radius
export function useSceneFrame(progress) {
    const size = useThree((s) => s.size);
    const mobile = !!progress?.current?.mobile;
    return useMemo(() => {
        const h = 10;
        const w = h * (size.width / Math.max(1, size.height));
        if (mobile) return { w, h, mobile, aspect: w / h, cx: 0, cy: -2.4, r: Math.min(w * 0.42, 2.6) };
        return { w, h, mobile, aspect: w / h, cx: w * 0.225, cy: 0, r: Math.min(h * 0.32, w * 0.2) };
    }, [size.width, size.height, mobile]);
}

// Deterministic random numbers so scenes look the same on every visit.
export function seeded(seed = 7) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

const glowMaterial = (color, power) =>
    new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
            "varying vec2 vUv; uniform vec3 uColor; uniform float uPower; void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), uPower); gl_FragColor = vec4(uColor * a, a); }",
    });

// Soft radial glow billboard (additive, no textures). `size` is the diameter.
export function Glow({ position = [0, 0, 0], size = 4, color = "#ffc070", power = 2.2, scaleY = 1, rotation = [0, 0, 0] }) {
    const material = useMemo(() => glowMaterial(color, power), [color, power]);
    return (
        <mesh position={position} rotation={rotation} scale={[size, size * scaleY, 1]} material={material}>
            <planeGeometry args={[1, 1]} />
        </mesh>
    );
}

// World position (z = 0) of a screen-space focal point (0..1, y from top).
export const markerPos = (origin, frame) => [(origin[0] - 0.5) * frame.w, (0.5 - origin[1]) * frame.h, 0];
