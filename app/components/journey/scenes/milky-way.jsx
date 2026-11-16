"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Glow, seeded, useSceneFrame } from "./shared";

// Level 5: the Milky Way at 100,000 light years. PLACEHOLDER: a few thousand
// points on a two-arm spiral, tilted like the prototype's galaxy.
export const meta = { origin: [0.5, 0.5], originMobile: [0.5, 0.64] };

const COUNT = 6000;

export default function MilkyWay({ progress }) {
    const f = useSceneFrame(progress);
    const disc = useRef();
    const { positions, colors } = useMemo(() => {
        const rnd = seeded(5);
        const positions = new Float32Array(COUNT * 3);
        const colors = new Float32Array(COUNT * 3);
        const core = new THREE.Color("#FFF4DE");
        const arm = new THREE.Color("#8F9BE0");
        const c = new THREE.Color();
        for (let i = 0; i < COUNT; i++) {
            const rad = Math.pow(rnd(), 0.75);
            const armIdx = i % 2;
            const a = rad * 5.2 + armIdx * Math.PI + (rnd() - 0.5) * (0.5 + (1 - rad));
            positions[i * 3] = Math.cos(a) * rad;
            positions[i * 3 + 1] = Math.sin(a) * rad;
            positions[i * 3 + 2] = (rnd() - 0.5) * 0.06 * (1 - rad);
            c.copy(core).lerp(arm, Math.min(1, rad * 1.3));
            const k = 0.45 + rnd() * 0.55;
            colors.set([c.r * k, c.g * k, c.b * k], i * 3);
        }
        return { positions, colors };
    }, []);

    useFrame(() => {
        const { time, d } = progress.current;
        if (disc.current) disc.current.rotation.z = time * 0.03 + d * 0.2;
    });

    const size = f.mobile ? f.w * 1.05 : f.h * 0.9;
    const cx = f.mobile ? 0 : f.w * 0.08;
    const cy = f.mobile ? -2.2 : 0;
    return (
        <group position={[cx, cy, 0]} rotation={[-0.95, 0, -0.28]}>
            <Glow size={size * 0.7} color="#ffdcaa" power={1.8} position={[0, 0, 0]} />
            <group ref={disc} scale={size}>
                <points>
                    <bufferGeometry>
                        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
                    </bufferGeometry>
                    <pointsMaterial size={2.2} sizeAttenuation={false} vertexColors transparent depthWrite={false} />
                </points>
            </group>
            {/* "you are here" marker */}
            <mesh position={[size * 0.55, size * 0.1, 0]}>
                <ringGeometry args={[0.14, 0.18, 32]} />
                <meshBasicMaterial color="#8EC5FF" />
            </mesh>
        </group>
    );
}
