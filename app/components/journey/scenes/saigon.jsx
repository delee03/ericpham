"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { markerPos, seeded, useSceneFrame } from "./shared";

// Level 1: Saigon at night at 10 km. PLACEHOLDER: a field of warm points.
export const meta = { origin: [0.57, 0.43], originMobile: [0.5, 0.62] };

const COUNT = 2600;

export default function Saigon({ progress }) {
    const f = useSceneFrame(progress);
    const group = useRef();
    const marker = useRef();
    const { positions, colors } = useMemo(() => {
        const rnd = seeded(11);
        const positions = new Float32Array(COUNT * 3);
        const colors = new Float32Array(COUNT * 3);
        const warm = new THREE.Color("#FFC070");
        const pale = new THREE.Color("#FFE6B8");
        for (let i = 0; i < COUNT; i++) {
            const rad = Math.pow(rnd(), 0.6);
            const a = rnd() * Math.PI * 2;
            positions[i * 3] = Math.cos(a) * rad * 1.5;
            positions[i * 3 + 1] = Math.sin(a) * rad * 0.9;
            positions[i * 3 + 2] = (rnd() - 0.5) * 0.05;
            const c = rnd() < 0.3 ? pale : warm;
            const k = 0.5 + rnd() * 0.5;
            colors.set([c.r * k, c.g * k, c.b * k], i * 3);
        }
        return { positions, colors };
    }, []);

    useFrame(() => {
        const { time, d } = progress.current;
        if (group.current) {
            const s = f.r * 1.7;
            group.current.scale.setScalar(s * (1 + d * 0.04));
            group.current.rotation.z = Math.sin(time * 0.1) * 0.02;
        }
        if (marker.current) marker.current.scale.setScalar(1 + Math.sin(time * 2) * 0.15);
    });

    return (
        <>
            <group ref={group} position={[f.cx, f.cy, 0]} rotation={[-0.35, 0, 0.1]}>
                <points>
                    <bufferGeometry>
                        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
                    </bufferGeometry>
                    <pointsMaterial size={2.5} sizeAttenuation={false} vertexColors transparent depthWrite={false} />
                </points>
            </group>
            {/* the small light where the desk lives */}
            <mesh ref={marker} position={markerPos(f.mobile ? meta.originMobile : meta.origin, f)}>
                <ringGeometry args={[0.16, 0.2, 32]} />
                <meshBasicMaterial color="#FFD08A" />
            </mesh>
        </>
    );
}
