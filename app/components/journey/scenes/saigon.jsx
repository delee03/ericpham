"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { seeded, useSceneFrame } from "./shared";

// Level 1: Saigon at night at 10 km. Tens of thousands of warm light points laid out on the
// real OpenStreetMap street network (public/saigon/lights.bin, built by
// scripts/generate-saigon-lights.mjs), a dark river as an absence of light, and a faint haze
// over the dense districts. Map data (c) OpenStreetMap contributors (ODbL).
// The ring marks the one light the desk shrinks into.
export const meta = { origin: [0.73, 0.48], originMobile: [0.52, 0.68] };

const DATA_URL = "/saigon/lights.bin";
const MARK = [0.045, 0.06]; // local city coordinates (-1..1) of "our" light

// ------------------------------------------------------------------ data ----
let loadPromise = null;
function loadLights() {
    if (!loadPromise) {
        loadPromise = fetch(DATA_URL)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("lights.bin " + r.status))))
            .then((buf) => {
                const dv = new DataView(buf);
                if (dv.getUint32(0, true) !== 0x314c4753) throw new Error("bad lights.bin");
                const n = dv.getUint32(4, true);
                const g = dv.getUint16(24, true);
                const rec = new Uint16Array(buf, 28, n * 3);
                const grids = new Uint8Array(buf, 28 + n * 6, g * g * 2);
                return { n, g, rec, grids };
            })
            .catch((e) => {
                loadPromise = null;
                throw e;
            });
    }
    return loadPromise;
}

// Cheap stand-in until the real data arrives: radial avenues, rings and scatter.
function fallbackLights() {
    const rnd = seeded(5);
    const out = [];
    for (let a = 0; a < 14; a++) {
        const ang = (a / 14) * Math.PI * 2 + rnd() * 0.3;
        for (let i = 0; i < 160; i++) {
            const r = Math.pow(i / 160, 0.8) * 0.9;
            out.push([Math.cos(ang) * r, Math.sin(ang) * r, 0.7 + rnd() * 0.3, 0.2]);
        }
    }
    for (let i = 0; i < 4200; i++) {
        const r = Math.pow(rnd(), 1.7) * 0.95;
        const a = rnd() * Math.PI * 2;
        out.push([Math.cos(a) * r, Math.sin(a) * r, 0.25 + rnd() * 0.3, r < 0.25 ? 0.7 : 0.1]);
    }
    return out;
}

function buildGeometry(data, mobile) {
    const geo = new THREE.BufferGeometry();
    let pos;
    let info;
    if (data) {
        const step = mobile ? 2 : 1;
        const n = Math.ceil(data.n / step);
        pos = new Float32Array(n * 3);
        info = new Float32Array(n * 4);
        const rnd = seeded(31);
        let k = 0;
        for (let i = 0; i < data.n; i += step) {
            const x = data.rec[i * 3] / 65535;
            const y = data.rec[i * 3 + 1] / 65535;
            const w = data.rec[i * 3 + 2];
            pos[k * 3] = x * 2 - 1;
            pos[k * 3 + 1] = y * 2 - 1;
            info[k * 4] = (w & 255) / 235;
            info[k * 4 + 1] = (w >> 8) / 255;
            info[k * 4 + 2] = rnd();
            info[k * 4 + 3] = step;
            k++;
        }
    } else {
        const pts = fallbackLights();
        const rnd = seeded(77);
        pos = new Float32Array(pts.length * 3);
        info = new Float32Array(pts.length * 4);
        pts.forEach((p, i) => {
            pos.set([p[0], p[1], 0], i * 3);
            info.set([p[2], p[3], rnd(), 1.5], i * 4);
        });
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    return geo;
}

// --------------------------------------------------------------- shaders ----
const common = `
uniform float uTime;
uniform float uFade;
float edgeFade(vec2 p) { return 1.0 - smoothstep(0.66, 0.99, length(p)); }
`;

const pointsVert = `
${common}
uniform float uPx;
attribute vec4 aInfo;
varying vec3 vCol;
varying float vA;
void main() {
  float b = aInfo.x;
  float w = aInfo.y;
  float h = aInfo.z;
  vec3 sodium = vec3(1.0, 0.52, 0.17);
  vec3 warm = vec3(1.0, 0.74, 0.42);
  vec3 cool = vec3(0.95, 0.92, 0.84);
  vec3 c = mix(sodium, warm, smoothstep(0.35, 0.9, b));
  c = mix(c, cool, w * 0.7 * smoothstep(0.2, 0.7, b + w * 0.3));
  float tw = 0.84 + 0.16 * sin(uTime * (0.35 + h * 0.5) + h * 61.0);
  vCol = c * (0.32 + 0.7 * b) * tw * edgeFade(position.xy) * uFade;
  vA = 1.0;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (1.5 + 1.5 * b + 0.7 * w) * (0.9 + 0.3 * h) * sqrt(aInfo.w);
}
`;

const pointsFrag = `
varying vec3 vCol;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float a = exp(-dot(q, q) * 14.0);
  vec3 col = vCol * a * 0.62;
  gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
}
`;

const hazeVert = `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const hazeFrag = `
${common}
uniform sampler2D uGrid;
uniform float uFall;
uniform float uBoost;
varying vec2 vP;
void main() {
  vec2 uv = vP * 0.5 + 0.5;
  vec2 g = texture2D(uGrid, uv).rg;
  float r = length(vP);
  float dens = mix(g.r, exp(-r * r * 4.0), uFall);
  float water = g.g * (1.0 - uFall);
  float e = edgeFade(vP);
  float pulse = 0.94 + 0.06 * sin(uTime * 0.25);
  vec3 glow = (vec3(1.0, 0.48, 0.16) * dens * dens * 0.2 + vec3(0.9, 0.62, 0.38) * pow(dens, 5.0) * 0.16) * (1.0 - water * 0.9) * pulse * uBoost;
  glow += vec3(0.012, 0.02, 0.034) * pow(water, 3.0) * smoothstep(0.1, 0.45, dens) * 0.45;
  float ground = 0.9 * (1.0 - smoothstep(0.78, 1.0, r));
  vec3 rgb = glow * e * uFade;
  gl_FragColor = vec4(rgb, max(ground * uFade, max(rgb.r, max(rgb.g, rgb.b))));
}
`;

const blend = {
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
};

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export default function Saigon({ progress }) {
    const f = useSceneFrame(progress);
    const dpr = useThree((s) => s.viewport.dpr);
    const height = useThree((s) => s.size.height);
    const mobile = f.mobile;
    const [data, setData] = useState(null);
    const group = useRef();
    const ring = useRef();
    const dot = useRef();

    useEffect(() => {
        let alive = true;
        loadLights()
            .then((d) => alive && setData(d))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    const geometry = useMemo(() => buildGeometry(data, mobile), [data, mobile]);
    useEffect(() => () => geometry.dispose(), [geometry]);

    const gridTex = useMemo(() => {
        let tex;
        if (data) {
            const raw = new Uint8Array(data.g * data.g * 2);
            const n = data.g * data.g;
            for (let i = 0; i < n; i++) {
                raw[i * 2] = data.grids[i];
                raw[i * 2 + 1] = data.grids[n + i];
            }
            tex = new THREE.DataTexture(raw, data.g, data.g, THREE.RGFormat, THREE.UnsignedByteType);
        } else {
            tex = new THREE.DataTexture(new Uint8Array(2), 1, 1, THREE.RGFormat, THREE.UnsignedByteType);
        }
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.unpackAlignment = 1;
        tex.needsUpdate = true;
        return tex;
    }, [data]);
    useEffect(() => () => gridTex.dispose(), [gridTex]);

    const uniforms = useMemo(
        () => ({ uTime: { value: 0 }, uFade: { value: 1 }, uPx: { value: 1 }, uFall: { value: 1 }, uBoost: { value: 1 }, uGrid: { value: null } }),
        []
    );
    const pointsMat = useMemo(
        () => new THREE.ShaderMaterial({ ...blend, uniforms, vertexShader: pointsVert, fragmentShader: pointsFrag }),
        [uniforms]
    );
    const hazeMat = useMemo(
        () => new THREE.ShaderMaterial({ ...blend, uniforms, vertexShader: hazeVert, fragmentShader: hazeFrag }),
        [uniforms]
    );
    useEffect(
        () => () => {
            pointsMat.dispose();
            hazeMat.dispose();
        },
        [pointsMat, hazeMat]
    );
    const markerGlow = useMemo(
        () =>
            new THREE.ShaderMaterial({
                ...blend,
                uniforms: { uA: { value: 0 } },
                vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
                fragmentShader:
                    "varying vec2 vUv; uniform float uA; void main(){ float d = length(vUv-0.5)*2.0; float a = pow(max(0.0,1.0-d),2.4)*uA; vec3 c = vec3(1.0,0.78,0.42)*a; gl_FragColor = vec4(c, a); }",
            }),
        []
    );
    const ringMat = useMemo(
        () =>
            new THREE.ShaderMaterial({
                ...blend,
                uniforms: { uA: { value: 0 } },
                vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
                fragmentShader:
                    "varying vec2 vUv; uniform float uA; void main(){ float d = length(vUv-0.5)*2.0; float a = smoothstep(0.84,0.9,d)*(1.0-smoothstep(0.95,1.0,d))*uA*1.3; vec3 c = vec3(1.0,0.74,0.32)*a; gl_FragColor = vec4(c, a); }",
            }),
        []
    );
    useEffect(
        () => () => {
            markerGlow.dispose();
            ringMat.dispose();
        },
        [markerGlow, ringMat]
    );

    useFrame(() => {
        const { d, hold, time } = progress.current;
        const leave = ease(clamp01(d));
        const arrive = clamp01(-d);
        // Radius of the city at hold, in world units; whole patch stays inside the frame while leaving.
        const R = mobile ? Math.min(f.w * 0.42, 2.0) : Math.min(f.h * 0.43, f.w * 0.235);
        const s = R * (1 - 0.6 * leave) * (1 + 0.12 * arrive);
        const tilt = 0.82 - 0.55 * leave + 0.12 * arrive;
        const x = f.cx * (1 - 0.5 * leave);
        const y = (mobile ? f.cy + 0.5 : f.cy) * (1 - 0.4 * leave) - 0.15 * leave;
        const g = group.current;
        if (g) {
            g.position.set(x, y, 0);
            g.scale.set(s, s, s);
            g.rotation.set(-tilt, 0, 0.1 + Math.sin(time * 0.05) * 0.015 - 0.1 * leave);
        }
        uniforms.uTime.value = time;
        uniforms.uFade.value = mobile ? 0.7 : 1;
        uniforms.uPx.value = (dpr * height * (mobile ? 0.8 : 1.0)) / 900 * (1 - 0.25 * leave);
        uniforms.uFall.value = data ? 0 : 1;
        uniforms.uBoost.value = 1 + 2.2 * leave;
        uniforms.uGrid.value = gridTex;
        const ringIn = ease(clamp01((hold - 0.55) / 0.45)) * (1 - ease(clamp01(d * 6)));
        const breathe = 1 + Math.sin(time * 1.1) * 0.03;
        if (ring.current) {
            ring.current.visible = ringIn > 0.001;
            ringMat.uniforms.uA.value = ringIn * 0.9;
            ring.current.scale.setScalar((0.17 + 0.05 * (1 - ringIn)) * breathe);
        }
        if (dot.current) {
            dot.current.visible = ringIn > 0.001;
            markerGlow.uniforms.uA.value = ringIn;
        }
    });

    return (
        <group ref={group}>
            <mesh material={hazeMat} frustumCulled={false} position={[0, 0, -0.002]}>
                <planeGeometry args={[2, 2]} />
            </mesh>
            <points geometry={geometry} material={pointsMat} frustumCulled={false} />
            <mesh ref={dot} material={markerGlow} position={[MARK[0], MARK[1], 0.001]} scale={0.07} frustumCulled={false}>
                <planeGeometry args={[1, 1]} />
            </mesh>
            <mesh ref={ring} material={ringMat} position={[MARK[0], MARK[1], 0.002]} frustumCulled={false}>
                <planeGeometry args={[1, 1]} />
            </mesh>
        </group>
    );
}
