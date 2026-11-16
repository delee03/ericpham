"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Glow, useSceneFrame } from "./shared";

// Level 4: Pale Blue Dot at ~6 billion km. PLACEHOLDER: one tiny blue point in
// a faint band of light, with a thin ring to draw the eye.
export const meta = { origin: [0.5, 0.5], originMobile: [0.5, 0.5] };

const POINT = new Float32Array([0, 0, 0]);

export default function PaleBlueDot({ progress }) {
    const f = useSceneFrame(progress);
    const ring = useRef();
    const y = f.mobile ? 0.4 : 0.9;
    useFrame(() => {
        const { time, d } = progress.current;
        if (ring.current) ring.current.scale.setScalar(1 + Math.sin(time * 1.5) * 0.08 - Math.abs(d) * 0.2);
    });
    return (
        <>
            <Glow position={[0, y - 0.4, -1]} size={f.w * 1.6} scaleY={0.06} rotation={[0, 0, -0.12]} color="#8a6a48" power={1.1} />
            <points position={[0, y, 0]}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[POINT, 3]} />
                </bufferGeometry>
                <pointsMaterial color="#9CC8FF" size={5} sizeAttenuation={false} />
            </points>
            <mesh ref={ring} position={[0, y, 0]}>
                <ringGeometry args={[0.28, 0.3, 48]} />
                <meshBasicMaterial color="#8EC5FF" transparent opacity={0.6} />
            </mesh>
        </>
    );
}
