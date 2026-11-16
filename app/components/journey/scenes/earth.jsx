"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Glow, useSceneFrame } from "./shared";

// Level 2: sunrise over Earth at 10,000 km. PLACEHOLDER: a lit sphere whose
// limb crosses the lower part of the frame, a rim glow and a rising sun.
export const meta = { origin: [0.5, 0.5], originMobile: [0.5, 0.62] };

const R = 14;

const rimMaterial = () =>
    new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        vertexShader:
            "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
        fragmentShader:
            "varying vec3 vN; varying vec3 vV; void main(){ float k = pow(max(0.0, 0.62 - dot(-vN, vV)), 3.0) * 6.0; gl_FragColor = vec4(vec3(0.35,0.62,1.0) * k, k); }",
    });

export default function Earth({ progress }) {
    const f = useSceneFrame(progress);
    const sun = useRef();
    const planet = useRef();
    const rim = useMemo(rimMaterial, []);
    const limbY = f.mobile ? -1.2 : -3.0;

    useFrame(() => {
        const { hold, time, d } = progress.current;
        if (planet.current) planet.current.rotation.y = time * 0.02;
        if (sun.current) {
            // the sun climbs while the level settles
            sun.current.position.y = limbY - 0.2 + hold * 0.6 - Math.max(0, d) * 1.5;
        }
    });

    return (
        <>
            <ambientLight intensity={0.12} color="#4a78c8" />
            <directionalLight position={[8, 3, 6]} intensity={2.2} color="#ffe4b8" />
            <group position={[0, limbY - R, -3]}>
                <mesh ref={planet}>
                    <sphereGeometry args={[R, 96, 64]} />
                    <meshStandardMaterial color="#1d56a0" roughness={0.85} />
                </mesh>
                <mesh scale={1.025} material={rim}>
                    <sphereGeometry args={[R, 64, 48]} />
                </mesh>
            </group>
            <group ref={sun} position={[f.w * 0.2, limbY, -2]}>
                <Glow size={f.mobile ? 4.5 : 7.5} color="#ffd9a0" power={1.6} scaleY={0.6} />
                <Glow size={f.mobile ? 1.6 : 2.2} color="#fff6e2" power={1.2} />
            </group>
        </>
    );
}
