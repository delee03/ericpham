"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Glow, useSceneFrame } from "./shared";

// Level 0 and 7: a desk at 1 m. PLACEHOLDER: boxes, a monitor, a warm lamp.
export const meta = { origin: [0.69, 0.5], originMobile: [0.5, 0.68] };

export default function Desk({ progress }) {
    const f = useSceneFrame(progress);
    const group = useRef();
    useFrame(() => {
        const { d, time } = progress.current;
        if (group.current) {
            group.current.rotation.y = Math.sin(time * 0.25) * 0.08 + d * 0.15;
            group.current.position.y = f.cy - d * 0.2;
        }
    });
    const r = f.r;
    return (
        <>
            <ambientLight intensity={0.5} color="#8EC5FF" />
            <pointLight position={[f.cx + r * 1.3, f.cy + r * 0.9, 4]} intensity={160} color="#ffc070" />
            <group ref={group} position={[f.cx, f.cy, 0]}>
                {/* desk slab */}
                <mesh position={[0, -r * 0.55, 0]} rotation={[0.28, 0, 0]}>
                    <boxGeometry args={[r * 2.5, r * 0.14, r * 1.5]} />
                    <meshStandardMaterial color="#2a1f17" roughness={0.9} />
                </mesh>
                {/* monitor */}
                <mesh position={[0, r * 0.15, -r * 0.1]}>
                    <boxGeometry args={[r * 1.15, r * 0.75, r * 0.07]} />
                    <meshStandardMaterial color="#1a2238" roughness={0.6} />
                </mesh>
                <mesh position={[0, r * 0.15, -r * 0.05]}>
                    <planeGeometry args={[r * 1.0, r * 0.6]} />
                    <meshBasicMaterial color="#5f8fd6" />
                </mesh>
                <mesh position={[0, -r * 0.3, -r * 0.1]}>
                    <boxGeometry args={[r * 0.12, r * 0.3, r * 0.1]} />
                    <meshStandardMaterial color="#222a40" />
                </mesh>
                {/* chair seat and mug */}
                <mesh position={[-r * 0.05, -r * 0.85, r * 0.5]}>
                    <cylinderGeometry args={[r * 0.4, r * 0.4, r * 0.1, 24]} />
                    <meshStandardMaterial color="#241f1c" />
                </mesh>
                <mesh position={[r * 0.95, -r * 0.35, r * 0.1]}>
                    <cylinderGeometry args={[r * 0.1, r * 0.1, r * 0.2, 16]} />
                    <meshStandardMaterial color="#c9b79a" />
                </mesh>
                {/* lamp */}
                <mesh position={[r * 1.2, r * 0.55, 0]}>
                    <sphereGeometry args={[r * 0.1, 16, 16]} />
                    <meshBasicMaterial color="#fff2d6" />
                </mesh>
                <Glow position={[r * 1.2, r * 0.55, 0.2]} size={r * 2.6} color="#ffb060" />
            </group>
        </>
    );
}
