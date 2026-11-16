"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded, useSceneFrame } from "./shared";

// Level 0 and 7: a developer's desk at night, 1 m. A warm lamp pool, a laptop whose screen
// throws a cool glow, a mug with a wisp of steam, a notebook. Built from rounded primitives,
// a procedural wood canvas and two small shaders; no heavy textures.
// Leaving (d 0 -> 1) the "camera" rises: the room shrinks, tilts top-down and is cut to a small
// soft circle around the lamp pool so the compositor's shrink reads as one lit window.
// Arriving (d -1 -> 0, level 7) is the same motion in reverse.
export const meta = { origin: [0.715, 0.43], originMobile: [0.5, 0.7] };

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const TILT = 0.95;

const additive = {
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
};

// ------------------------------------------------------------- textures ----
function makeWood() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d");
    const rnd = seeded(9);
    g.fillStyle = "#3b2616";
    g.fillRect(0, 0, 512, 256);
    for (let p = 0; p < 4; p++) {
        g.fillStyle = `rgba(${p % 2 ? 255 : 0},${p % 2 ? 190 : 0},${p % 2 ? 120 : 0},${p % 2 ? 0.035 : 0.12})`;
        g.fillRect(0, p * 64, 512, 64);
    }
    for (let i = 0; i < 520; i++) {
        const y = rnd() * 256;
        const amp = 1 + rnd() * 4;
        const f = 0.01 + rnd() * 0.03;
        const ph = rnd() * 6;
        const dark = rnd() < 0.62;
        g.strokeStyle = dark ? `rgba(18,9,4,${0.06 + rnd() * 0.22})` : `rgba(150,98,56,${0.04 + rnd() * 0.12})`;
        g.lineWidth = 0.4 + rnd() * 1.6;
        g.beginPath();
        for (let x = 0; x <= 512; x += 8) {
            const yy = y + Math.sin(x * f + ph) * amp;
            if (x === 0) g.moveTo(x, yy);
            else g.lineTo(x, yy);
        }
        g.stroke();
    }
    g.fillStyle = "rgba(8,4,2,0.55)";
    for (let p = 0; p < 4; p++) g.fillRect(0, p * 64, 512, 1.5);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(7.5, 5);
    t.anisotropy = 4;
    return t;
}

function makeBlob() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grd.addColorStop(0, "rgba(0,0,0,0.85)");
    grd.addColorStop(0.55, "rgba(0,0,0,0.38)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}

// --------------------------------------------------------------- shaders ----
const plainVert = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }";

const screenFrag = `
varying vec2 vUv;
uniform float uTime;
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  vec3 bg = vec3(0.012, 0.026, 0.06) * (0.8 + 0.5 * (1.0 - length(uv - 0.5)));
  vec3 col = bg;
  float rows = 24.0;
  float y = (1.0 - uv.y) * rows + uTime * 0.07;
  float ri = floor(y);
  float fy = fract(y);
  float body = step(0.16, uv.x) * step(uv.x, 0.97) * step(0.07, 1.0 - uv.y);
  // side bar and title bar
  col += vec3(0.01, 0.018, 0.035) * (1.0 - step(0.16, uv.x));
  col += vec3(0.014, 0.026, 0.05) * (1.0 - step(0.07, 1.0 - uv.y));
  float line = smoothstep(0.22, 0.34, fy) * (1.0 - smoothstep(0.62, 0.74, fy));
  float vis = step(0.2, h1(ri + 3.0));
  float indent = floor(h1(ri + 11.0) * 4.0) * 0.045;
  float x0 = 0.2 + indent;
  float acc = 0.0;
  vec3 tok = vec3(0.0);
  for (int t = 0; t < 6; t++) {
    float ft = float(t);
    float w = 0.035 + 0.11 * h1(ri * 7.0 + ft * 3.1);
    float on = step(x0, uv.x) * step(uv.x, x0 + w - 0.012);
    float cls = h1(ri * 3.0 + ft * 5.7);
    vec3 c = cls < 0.4 ? vec3(0.22, 0.46, 0.92) : (cls < 0.7 ? vec3(0.16, 0.66, 0.62) : (cls < 0.88 ? vec3(0.52, 0.58, 0.7) : vec3(0.86, 0.6, 0.3)));
    tok += c * on;
    acc += on;
    x0 += w + 0.012 + 0.01 * h1(ri + ft);
    if (h1(ri * 13.0 + ft * 2.3) < 0.18) break;
  }
  col += tok * line * vis * body * 0.62;
  // gutter numbers
  float gut = step(0.1, uv.x) * step(uv.x, 0.145) * line * vis * 0.5;
  col += vec3(0.1, 0.16, 0.28) * gut * step(0.07, 1.0 - uv.y) * step(h1(ri + 1.7), 0.8);
  // soft caret
  float cr = step(abs(ri - 9.0), 0.5) * step(0.52, uv.x) * step(uv.x, 0.535) * line;
  col += vec3(0.5, 0.72, 1.0) * cr * (0.45 + 0.35 * sin(uTime * 2.4));
  col *= 0.9 + 0.1 * smoothstep(0.0, 0.2, uv.y);
  gl_FragColor = vec4(col, 1.0);
}
`;

const steamFrag = `
varying vec2 vUv;
uniform float uTime;
float hs(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  float y = vUv.y;
  float wob = sin(y * 5.0 - uTime * 0.7) * 0.1 * y + sin(y * 9.0 - uTime * 0.45) * 0.04 * y;
  float x = vUv.x - 0.5 - wob;
  float n = vn(vec2(x * 4.0, y * 3.0 - uTime * 0.3)) * 0.65 + vn(vec2(x * 9.0 + 3.0, y * 6.0 - uTime * 0.5)) * 0.35;
  float m = smoothstep(0.42, 0.0, abs(x)) * pow(1.0 - y, 1.4) * smoothstep(0.0, 0.1, y);
  float a = m * smoothstep(0.3, 0.9, n) * 0.3;
  vec3 c = vec3(1.0, 0.86, 0.68) * a;
  gl_FragColor = vec4(c, a);
}
`;

const glowFrag = `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uA;
uniform float uPow;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - d), uPow) * uA;
  gl_FragColor = vec4(uColor * a, a);
}
`;

const maskVert = "varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xy; gl_Position = projectionMatrix * viewMatrix * w; }";
const maskFrag = `
varying vec2 vW;
uniform vec2 uC;
uniform vec2 uR;
uniform float uMode;
uniform float uCut;
void main() {
  if (uMode < 0.5) {
    float v = smoothstep(0.4, 1.2, length((vW - uC) / uR));
    gl_FragColor = vec4(0.0, 0.0, 0.0, v * 0.985);
  } else {
    float m = smoothstep(uCut * 0.5, uCut, length(vW - uC));
    gl_FragColor = vec4(0.0, 0.0, 0.0, m);
  }
}
`;

// ------------------------------------------------------------- helpers ----
const _up = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();
function Rod({ a, b, radius = 0.05, material }) {
    const { pos, quat, len } = useMemo(() => {
        const va = new THREE.Vector3(...a);
        const vb = new THREE.Vector3(...b);
        _d.subVectors(vb, va);
        const l = _d.length();
        return {
            pos: va.clone().add(vb).multiplyScalar(0.5).toArray(),
            quat: new THREE.Quaternion().setFromUnitVectors(_up, _d.normalize()),
            len: l,
        };
    }, [a, b]);
    return (
        <mesh position={pos} quaternion={quat} material={material}>
            <cylinderGeometry args={[radius, radius, len, 10]} />
        </mesh>
    );
}

const KEY_ROWS = [
    { y: 0.86, n: 14, w: 0.19 },
    { y: 0.62, n: 14, w: 0.19 },
    { y: 0.39, n: 13, w: 0.19 },
    { y: 0.16, n: 12, w: 0.19 },
    { y: -0.07, n: 11, w: 0.19 },
];

const LAMP_BASE = [2.75, 1.45, 0];
const LAMP_ELBOW = [2.55, 1.85, 2.15];
const LAMP_HEAD = [1.95, 1.2, 3.35];
const POOL = [1.0, -0.15, 0];

export default function Desk({ progress }) {
    const f = useSceneFrame(progress);
    const mobile = f.mobile;
    const pool = useRef();
    const group = useRef();
    const spot = useRef();
    const fill = useRef();
    const lampHeadGlow = useRef();
    const keys = useRef();

    const wood = useMemo(makeWood, []);
    const blob = useMemo(makeBlob, []);
    useEffect(
        () => () => {
            wood.dispose();
            blob.dispose();
        },
        [wood, blob]
    );

    const mats = useMemo(() => {
        const shared = { time: { value: 0 } };
        const std = (color, roughness, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
        const glow = (color, power) =>
            new THREE.ShaderMaterial({
                ...additive,
                uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: 1 }, uPow: { value: power } },
                vertexShader: plainVert,
                fragmentShader: glowFrag,
            });
        const mask = (mode) =>
            new THREE.ShaderMaterial({
                transparent: true,
                depthTest: false,
                depthWrite: false,
                blending: THREE.CustomBlending,
                blendEquation: THREE.AddEquation,
                blendSrc: mode ? THREE.ZeroFactor : THREE.OneFactor,
                blendDst: THREE.OneMinusSrcAlphaFactor,
                blendSrcAlpha: THREE.ZeroFactor,
                blendDstAlpha: mode ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
                uniforms: { uC: { value: new THREE.Vector2() }, uR: { value: new THREE.Vector2(8, 6) }, uMode: { value: mode }, uCut: { value: 100 } },
                vertexShader: maskVert,
                fragmentShader: maskFrag,
            });
        return {
            time: shared.time,
            desk: std("#ffe6d0", 0.6, 0, { map: wood }),
            alu: std("#34373e", 0.42, 0.55),
            lid: std("#17191d", 0.35, 0.5),
            key: std("#0c0e12", 0.5, 0.1),
            pad: std("#22252b", 0.35, 0.3),
            ceramic: std("#c8baa0", 0.35),
            coffee: std("#1a0d06", 0.18),
            cover: std("#26352f", 0.82),
            paper: std("#d9cdb2", 0.9),
            band: std("#14110f", 0.6),
            pen: std("#16181c", 0.3, 0.6),
            brass: std("#9a7640", 0.35, 0.8),
            lampMetal: std("#2a2622", 0.45, 0.55),
            bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.05, 0.6) }),
            shadeIn: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.55, 0.24), side: THREE.BackSide }),
            shadow: new THREE.MeshBasicMaterial({ map: blob, color: "#000000", transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
            screen: new THREE.ShaderMaterial({ uniforms: { uTime: shared.time }, vertexShader: plainVert, fragmentShader: screenFrag }),
            steam: new THREE.ShaderMaterial({ ...additive, depthTest: true, uniforms: { uTime: shared.time }, vertexShader: plainVert, fragmentShader: steamFrag }),
            blue: glow("#4f78d8", 2.6),
            warm: glow("#ffa65a", 2.4),
            hot: glow("#ffc680", 2.2),
            vig: mask(0),
            cut: mask(1),
        };
    }, [wood, blob]);
    useEffect(
        () => () => {
            Object.values(mats).forEach((m) => m?.dispose?.());
        },
        [mats]
    );

    // keyboard instances
    useLayoutEffect(() => {
        const m = keys.current;
        if (!m) return;
        const dummy = new THREE.Object3D();
        let i = 0;
        for (const row of KEY_ROWS) {
            const pitch = 0.236;
            const x0 = -((row.n - 1) * pitch) / 2;
            for (let k = 0; k < row.n; k++) {
                dummy.position.set(x0 + k * pitch, row.y, 0.165);
                dummy.scale.set(row.w / 0.19, 1, 1);
                dummy.updateMatrix();
                m.setMatrixAt(i++, dummy.matrix);
            }
        }
        dummy.position.set(0.05, -0.3, 0.165);
        dummy.scale.set(4.2, 1, 1);
        dummy.updateMatrix();
        m.setMatrixAt(i++, dummy.matrix);
        m.count = i;
        m.instanceMatrix.needsUpdate = true;
    }, []);

    const lampQuat = useMemo(() => {
        const dir = new THREE.Vector3(...POOL).sub(new THREE.Vector3(...LAMP_HEAD)).normalize();
        return new THREE.Quaternion().setFromUnitVectors(_up, dir.clone().negate());
    }, []);

    const spotLight = useMemo(() => {
        const s = new THREE.SpotLight("#ffb56a", 1, 0, 0.62, 1, 2);
        s.position.set(...LAMP_HEAD);
        s.target.position.set(...POOL);
        return s;
    }, []);
    useEffect(() => () => spotLight.dispose?.(), [spotLight]);

    const scaleBase = mobile ? 0.5 : Math.min(0.96, f.r / 3.3);
    const base = mobile ? [0, f.cy - 0.1] : [f.cx - 0.2, f.cy - 0.35];
    const R = mobile ? [f.w * 0.62, f.h * 0.36] : [f.w * 0.42, f.h * 0.62];
    const maxDim = Math.max(f.w, f.h) * 1.7;

    useFrame(() => {
        const { d, time } = progress.current;
        const k = ease(clamp01(Math.abs(d) / 0.8));
        mats.time.value = time;
        const s = scaleBase * (1 - 0.6 * k);
        const g = group.current;
        if (g) {
            g.position.set(base[0] * (1 - k), base[1] * (1 - k), 0);
            g.scale.set(s, s, s);
            g.rotation.set(-(TILT - 0.72 * k + Math.sin(time * 0.11) * 0.012), 0, 0.02 * Math.sin(time * 0.07) - 0.25 * k);
        }
        const breathe = 1 + Math.sin(time * 0.55) * 0.035;
        spotLight.intensity = 340 * breathe * s * s * (1 + 0.5 * k);
        if (fill.current) fill.current.intensity = 10 * s * s * (1 - 0.7 * k);
        if (lampHeadGlow.current) mats.hot.uniforms.uA.value = (0.25 + 0.7 * k) * breathe;
        if (pool.current) pool.current.scale.setScalar(5.5 * (0.9 + 0.1 * breathe) * (1 + 0.8 * k));
        mats.vig.uniforms.uC.value.set(base[0] * (1 - k), base[1] * (1 - k));
        mats.vig.uniforms.uR.value.set(R[0] * (1 - 0.35 * k), R[1] * (1 - 0.35 * k));
        mats.cut.uniforms.uC.value.set(base[0] * (1 - k) + 0.2 * k, base[1] * (1 - k) - 0.2 * k);
        mats.cut.uniforms.uCut.value = 1.7 + (maxDim - 1.7) * Math.pow(1 - k, 2.2);
    });

    const maskScale = [maxDim * 2, maxDim * 2, 1];

    return (
        <>
            <group ref={group}>
                <hemisphereLight args={["#2a3550", "#120b07", 0.55]} />
                <primitive object={spotLight} />
                <primitive object={spotLight.target} />
                <pointLight ref={fill} position={[0, -0.7, 1.5]} color="#7fa6ff" intensity={10} decay={2} />

                {/* desk surface and soft pools */}
                <mesh material={mats.desk} position={[0, 0, -0.01]}>
                    <planeGeometry args={[90, 70]} />
                </mesh>
                <mesh material={mats.warm} position={[POOL[0], POOL[1], 0.012]} ref={pool} scale={5.5}>
                    <planeGeometry args={[1, 1]} />
                </mesh>
                <mesh material={mats.blue} position={[0, -1.7, 0.015]} scale={[3.4, 2.0, 1]}>
                    <planeGeometry args={[1, 1]} />
                </mesh>

                {/* laptop */}
                <group position={[0, 0, 0]}>
                    <mesh material={mats.shadow} position={[0.1, -0.1, 0.004]} scale={[4.6, 3.3, 1]}>
                        <planeGeometry args={[1, 1]} />
                    </mesh>
                    <RoundedBox args={[3.4, 2.25, 0.14]} radius={0.06} smoothness={3} position={[0, 0, 0.07]} material={mats.alu} />
                    <mesh material={mats.key} position={[0, 0.38, 0.142]}>
                        <boxGeometry args={[3.12, 1.4, 0.012]} />
                    </mesh>
                    <instancedMesh ref={keys} args={[null, null, 70]} material={mats.key}>
                        <boxGeometry args={[0.19, 0.19, 0.05]} />
                    </instancedMesh>
                    <RoundedBox args={[1.15, 0.72, 0.012]} radius={0.04} smoothness={3} position={[0, -0.78, 0.147]} material={mats.pad} />
                    {/* lid hinged along the back edge, leaning back past vertical */}
                    <group position={[0, 1.08, 0.15]} rotation={[1.4, 0, 0]}>
                        <RoundedBox args={[3.4, 2.2, 0.075]} radius={0.05} smoothness={3} position={[0, 1.1, 0]} material={mats.lid} />
                        <mesh material={mats.screen} position={[0, 1.1, 0.0395]}>
                            <planeGeometry args={[3.14, 1.94]} />
                        </mesh>
                    </group>
                </group>

                {/* mug with steam */}
                <group position={[2.05, -1.95, 0]} rotation={[0, 0, 0.5]}>
                    <mesh material={mats.shadow} position={[0.12, -0.08, 0.004]} scale={[1.7, 1.5, 1]}>
                        <planeGeometry args={[1, 1]} />
                    </mesh>
                    <MugBody mats={mats} />
                    <mesh material={mats.steam} position={[0, 0.0, 1.35]} rotation={[Math.PI / 2, 0, -0.5]} scale={[0.9, 1.7, 1]}>
                        <planeGeometry args={[1, 1]} />
                    </mesh>
                </group>

                {/* notebook and pen */}
                <group position={[-3.1, -0.9, 0]} rotation={[0, 0, 0.22]}>
                    <mesh material={mats.shadow} position={[0.1, -0.1, 0.004]} scale={[3.0, 3.6, 1]}>
                        <planeGeometry args={[1, 1]} />
                    </mesh>
                    <RoundedBox args={[1.75, 2.35, 0.1]} radius={0.02} smoothness={2} position={[0.02, 0, 0.05]} material={mats.paper} />
                    <RoundedBox args={[1.8, 2.4, 0.07]} radius={0.05} smoothness={3} position={[0, 0, 0.15]} material={mats.cover} />
                    <mesh material={mats.band} position={[0.55, 0, 0.19]}>
                        <boxGeometry args={[0.07, 2.4, 0.02]} />
                    </mesh>
                    <group position={[-0.1, -0.1, 0.22]} rotation={[0, 0, 1.05]}>
                        <mesh material={mats.pen} rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0.05]}>
                            <cylinderGeometry args={[0.045, 0.045, 1.55, 10]} />
                        </mesh>
                        <mesh material={mats.brass} position={[0.35, 0, 0.1]}>
                            <boxGeometry args={[0.5, 0.025, 0.02]} />
                        </mesh>
                    </group>
                </group>

                {/* lamp */}
                <group>
                    <mesh material={mats.shadow} position={[LAMP_BASE[0] + 0.15, LAMP_BASE[1] - 0.1, 0.004]} scale={[2.0, 2.0, 1]}>
                        <planeGeometry args={[1, 1]} />
                    </mesh>
                    <mesh material={mats.lampMetal} position={[LAMP_BASE[0], LAMP_BASE[1], 0.06]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.5, 0.56, 0.12, 28]} />
                    </mesh>
                    <Rod a={[LAMP_BASE[0], LAMP_BASE[1], 0.1]} b={LAMP_ELBOW} radius={0.045} material={mats.lampMetal} />
                    <Rod a={LAMP_ELBOW} b={LAMP_HEAD} radius={0.04} material={mats.lampMetal} />
                    <mesh material={mats.brass} position={LAMP_ELBOW}>
                        <sphereGeometry args={[0.085, 14, 10]} />
                    </mesh>
                    <group position={LAMP_HEAD} quaternion={lampQuat}>
                        <mesh material={mats.lampMetal} position={[0, 0, 0]}>
                            <cylinderGeometry args={[0.2, 0.74, 0.7, 28, 1, true]} />
                        </mesh>
                        <mesh material={mats.shadeIn} position={[0, 0, 0]}>
                            <cylinderGeometry args={[0.19, 0.725, 0.69, 28, 1, true]} />
                        </mesh>
                        <mesh material={mats.bulb} position={[0, -0.18, 0]}>
                            <sphereGeometry args={[0.16, 14, 10]} />
                        </mesh>
                        <mesh ref={lampHeadGlow} material={mats.hot} position={[0, -0.25, 0]} scale={2.4} rotation={[0, 0, 0]} renderOrder={5}>
                            <planeGeometry args={[1, 1]} />
                        </mesh>
                    </group>
                </group>
            </group>

            {/* vignette (darkens, keeps alpha) then the shrinking window (cuts alpha) */}
            <mesh material={mats.vig} renderOrder={20} scale={maskScale} frustumCulled={false}>
                <planeGeometry args={[1, 1]} />
            </mesh>
            <mesh material={mats.cut} renderOrder={21} scale={maskScale} frustumCulled={false}>
                <planeGeometry args={[1, 1]} />
            </mesh>
        </>
    );
}

function MugBody({ mats }) {
    const lathe = useMemo(() => {
        const pts = [
            [0.001, 0], [0.33, 0], [0.375, 0.04], [0.385, 0.52], [0.365, 0.55], [0.34, 0.52], [0.335, 0.07], [0.001, 0.07],
        ].map(([x, y]) => new THREE.Vector2(x, y));
        const g = new THREE.LatheGeometry(pts, 28);
        g.rotateX(Math.PI / 2);
        return g;
    }, []);
    useEffect(() => () => lathe.dispose(), [lathe]);
    return (
        <>
            <mesh geometry={lathe} material={mats.ceramic} />
            <mesh material={mats.coffee} position={[0, 0, 0.44]}>
                <circleGeometry args={[0.335, 24]} />
            </mesh>
            <mesh material={mats.ceramic} position={[0.42, 0, 0.3]} rotation={[Math.PI / 2, 0, -Math.PI / 2]}>
                <torusGeometry args={[0.16, 0.04, 8, 16, Math.PI]} />
            </mesh>
        </>
    );
}
