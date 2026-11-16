"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useSceneFrame } from "./shared";

// Level 3: planet flyby at ~9 AU. PLACEHOLDER: Saturn (ringed sphere), a
// banded gas giant, Mars and the Moon that drift past while `d` changes.
export const meta = { origin: [0.5, 0.5], originMobile: [0.5, 0.62] };

export default function Planets({ progress }) {
    const f = useSceneFrame(progress);
    const rig = useRef();
    const saturn = useRef();
    const r = f.r;
    useFrame(() => {
        const { d, time } = progress.current;
        if (rig.current) rig.current.position.x = f.cx - d * 3.5 + Math.sin(time * 0.2) * 0.1;
        if (saturn.current) saturn.current.rotation.y = time * 0.05;
    });
    return (
        <>
            <ambientLight intensity={0.25} />
            <directionalLight position={[-6, 4, 6]} intensity={2.4} color="#fff0d8" />
            <group ref={rig} position={[f.cx, f.cy, 0]}>
                <group position={[0, r * 0.35, 0]} rotation={[0.35, 0, -0.2]}>
                    <mesh ref={saturn}>
                        <sphereGeometry args={[r * 0.6, 48, 32]} />
                        <meshStandardMaterial color="#d3ae6f" roughness={0.8} />
                    </mesh>
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[r * 0.82, r * 1.4, 96]} />
                        <meshBasicMaterial color="#e8d2a0" transparent opacity={0.55} side={2} />
                    </mesh>
                </group>
                <mesh position={[-r * 1.5, -r * 0.8, 1]}>
                    <sphereGeometry args={[r * 0.26, 32, 24]} />
                    <meshStandardMaterial color="#b97a4e" roughness={0.9} />
                </mesh>
                <mesh position={[r * 1.2, -r * 0.95, 1.5]}>
                    <sphereGeometry args={[r * 0.12, 24, 16]} />
                    <meshStandardMaterial color="#c9c4bd" roughness={1} />
                </mesh>
                <mesh position={[-r * 0.2, -r * 1.25, -1]}>
                    <sphereGeometry args={[r * 0.4, 32, 24]} />
                    <meshStandardMaterial color="#a8794d" roughness={0.8} />
                </mesh>
            </group>
        </>
    );
}
