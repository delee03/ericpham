"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { seeded, useSceneFrame } from "./shared";

// Level 6: the cosmic web at 93 billion light years. PLACEHOLDER: random nodes
// joined to their near neighbours, dimmed towards the left (text side).
export const meta = { origin: [0.5, 0.5], originMobile: [0.5, 0.64] };

const NODES = 150;

export default function CosmicWeb({ progress }) {
    const f = useSceneFrame(progress);
    const rig = useRef();
    const { w, h, mobile } = f;

    const { nodePos, nodeCol, linePos, lineCol } = useMemo(() => {
        const rnd = seeded(23);
        const pts = [];
        const spanX = w * 1.1;
        const spanY = mobile ? h * 0.55 : h * 1.05;
        const cy = mobile ? -2 : 0;
        for (let i = 0; i < NODES; i++) {
            pts.push([(rnd() - 0.5) * spanX, cy + (rnd() - 0.5) * spanY, (rnd() - 0.5) * 3]);
        }
        const bright = (x) => {
            if (mobile) return 1;
            const t = Math.min(1, Math.max(0, (x + w * 0.3) / (w * 0.4)));
            return 0.3 + 0.7 * t * t * (3 - 2 * t);
        };
        const link = mobile ? 2.2 : 3.2;
        const lines = [];
        const lcols = [];
        for (let i = 0; i < NODES; i++) {
            for (let j = i + 1; j < NODES; j++) {
                const dx = pts[i][0] - pts[j][0];
                const dy = pts[i][1] - pts[j][1];
                const dz = pts[i][2] - pts[j][2];
                if (dx * dx + dy * dy + dz * dz < link * link) {
                    lines.push(...pts[i], ...pts[j]);
                    const a = bright(pts[i][0]) * 0.55;
                    const b = bright(pts[j][0]) * 0.55;
                    lcols.push(0.49 * a, 0.42 * a, 0.84 * a, 0.49 * b, 0.42 * b, 0.84 * b);
                }
            }
        }
        const nodePos = new Float32Array(pts.flat());
        const nodeCol = new Float32Array(pts.flatMap((p) => [0.9 * bright(p[0]), 0.86 * bright(p[0]), 1 * bright(p[0])]));
        return { nodePos, nodeCol, linePos: new Float32Array(lines), lineCol: new Float32Array(lcols) };
    }, [w, h, mobile]);

    useFrame(() => {
        const { time, d } = progress.current;
        if (rig.current) {
            rig.current.rotation.z = Math.sin(time * 0.05) * 0.04;
            rig.current.position.x = -d * 0.8;
        }
    });

    return (
        <group ref={rig}>
            <lineSegments>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[linePos, 3]} />
                    <bufferAttribute attach="attributes-color" args={[lineCol, 3]} />
                </bufferGeometry>
                <lineBasicMaterial vertexColors transparent depthWrite={false} />
            </lineSegments>
            <points>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[nodePos, 3]} />
                    <bufferAttribute attach="attributes-color" args={[nodeCol, 3]} />
                </bufferGeometry>
                <pointsMaterial size={4} sizeAttenuation={false} vertexColors transparent depthWrite={false} />
            </points>
        </group>
    );
}
