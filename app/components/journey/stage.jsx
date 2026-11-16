"use client";

// The scene stage: one R3F Canvas. Each ACTIVE scene (current level, plus the
// one being travelled to) is rendered into its own offscreen render target
// through a portal with its own THREE.Scene and camera. A fullscreen shader then
// composites the two targets and reproduces the prototype's zoom in screen
// space (outgoing scales down and fades, incoming starts big and settles), with
// speed-proportional zoom blur over a persistent procedural starfield.
// Scene authors never deal with opacity or scaling; see scenes/README.md.
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clamp, smoothstep } from "./easing";
import { journey } from "./journey-store";
import { SCENE_CAMERA } from "./scenes/shared";
import { loadScene, preloadAround, scenes } from "./scenes";

const LAST = scenes.length - 1;
const DEFAULT_META = { origin: [0.5, 0.5] };

// ---------------------------------------------------------------- shader ----
const vertexShader = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = `
varying vec2 vUv;
uniform sampler2D tA;
uniform sampler2D tB;
uniform vec4 uA; // scale, originX, originY (uv, y up), opacity
uniform vec4 uB;
uniform float uSwap;
uniform float uBlur;
uniform float uTime;
uniform float uAspect;
uniform float uP;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 stars(vec2 uv) {
  vec3 c = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    float density = 52.0 + fl * 70.0;
    vec2 g = vec2(uv.x * uAspect, uv.y - uP * 0.012 * (fl + 1.0)) * density;
    vec2 id = floor(g);
    vec2 fr = fract(g) - 0.5;
    float r = hash(id + fl * 17.0);
    if (r > 0.955) {
      vec2 off = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6;
      float d = length(fr - off);
      float tw = 0.65 + 0.35 * sin(uTime * (0.6 + r * 2.0) + r * 60.0);
      float s = smoothstep(0.12 - fl * 0.04, 0.0, d) * (0.35 + 0.65 * hash(id + 1.3)) * tw;
      c += mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.92, 0.8), hash(id + 9.9)) * s * (0.75 - fl * 0.2);
    }
  }
  return c;
}

vec4 layer(sampler2D t, vec4 par) {
  if (par.w < 0.003) return vec4(0.0);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 5; i++) {
    float k = (float(i) - 2.0) / 2.0;
    float s = par.x * (1.0 + uBlur * k);
    vec2 q = par.yz + (vUv - par.yz) / s;
    float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
    acc += texture2D(t, q) * inside;
  }
  return acc / 5.0 * par.w;
}

void main() {
  vec3 col = vec3(0.0008, 0.001, 0.0022) + stars(vUv);
  vec4 a = layer(tA, uA);
  vec4 b = layer(tB, uB);
  if (uSwap < 0.5) {
    col = col * (1.0 - b.a) + b.rgb;
    col = col * (1.0 - a.a) + a.rgb;
  } else {
    col = col * (1.0 - a.a) + a.rgb;
    col = col * (1.0 - b.a) + b.rgb;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

// ------------------------------------------------------------- utilities ----
function disposeScene(scene) {
    scene.traverse((o) => {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => {
            Object.values(m).forEach((v) => v?.isTexture && v.dispose());
            m.dispose?.();
        });
    });
}

class SceneBoundary extends Component {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch(error) {
        console.error("Journey scene failed:", error);
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}

// One mounted scene: its own THREE.Scene + camera, registered with the compositor.
function SceneSlot({ index, registry, mobile }) {
    const [mod, setMod] = useState(null);
    const scene = useMemo(() => new THREE.Scene(), []);
    const camera = useMemo(() => {
        const c = new THREE.PerspectiveCamera(SCENE_CAMERA.fov, 1, SCENE_CAMERA.near, SCENE_CAMERA.far);
        c.position.set(...SCENE_CAMERA.position);
        c.lookAt(0, 0, 0);
        return c;
    }, []);
    const progress = useRef({ d: 0, hold: 1, time: 0, mobile, aspect: 1, speed: 0 });

    useEffect(() => {
        let alive = true;
        loadScene(index)
            .then((m) => alive && setMod(m))
            .catch((e) => console.error(e));
        return () => {
            alive = false;
        };
    }, [index]);

    useEffect(() => {
        registry.set(index, { scene, camera, progress, meta: mod?.meta ?? DEFAULT_META, ready: !!mod });
        return () => {
            registry.delete(index);
        };
    }, [index, registry, scene, camera, mod]);

    useEffect(() => () => disposeScene(scene), [scene]);

    const Scene = mod?.Component;
    return createPortal(
        <SceneBoundary>
            <Suspense fallback={null}>{Scene ? <Scene progress={progress} /> : null}</Suspense>
        </SceneBoundary>,
        scene,
        { camera }
    );
}

const makeTarget = (mobile) =>
    new THREE.WebGLRenderTarget(4, 4, {
        type: THREE.HalfFloatType,
        samples: mobile ? 0 : 4,
        depthBuffer: true,
    });

// Renders the active scenes into targets and composites them.
function Compositor({ mobile }) {
    const gl = useThree((s) => s.gl);
    const size = useThree((s) => s.size);
    const registry = useMemo(() => new Map(), []);
    const [active, setActive] = useState([0]);
    const activeKey = useRef("0");
    const tmp = useMemo(() => new THREE.Vector2(), []);
    const targets = useMemo(() => [makeTarget(mobile), makeTarget(mobile)], [mobile]);

    const comp = useMemo(() => {
        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            depthTest: false,
            depthWrite: false,
            uniforms: {
                tA: { value: null },
                tB: { value: null },
                uA: { value: new THREE.Vector4(1, 0.5, 0.5, 0) },
                uB: { value: new THREE.Vector4(1, 0.5, 0.5, 0) },
                uSwap: { value: 0 },
                uBlur: { value: 0 },
                uTime: { value: 0 },
                uAspect: { value: 1 },
                uP: { value: 0 },
            },
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        mesh.frustumCulled = false;
        const scene = new THREE.Scene();
        scene.add(mesh);
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        return { scene, camera, material, mesh };
    }, []);

    useEffect(
        () => () => {
            targets.forEach((t) => t.dispose());
            comp.material.dispose();
            comp.mesh.geometry.dispose();
        },
        [targets, comp]
    );

    useFrame((state) => {
        const p = journey.p;
        const a = clamp(Math.floor(p), 0, LAST);
        const f = p - a;
        const needed = f > 0.0005 && a < LAST ? [a, a + 1] : [clamp(Math.round(p), 0, LAST)];
        const key = needed.join(",");
        if (key !== activeKey.current) {
            activeKey.current = key;
            setActive(needed);
            preloadAround(needed[needed.length - 1]);
        }

        // Keep targets matched to the drawing buffer.
        gl.getDrawingBufferSize(tmp);
        const bw = Math.max(2, Math.min(2560, tmp.x));
        const bh = Math.max(2, Math.round(bw * (tmp.y / Math.max(1, tmp.x))));
        if (targets[0].width !== bw || targets[0].height !== bh) targets.forEach((t) => t.setSize(bw, bh));

        const aspect = size.width / Math.max(1, size.height);
        const prevTarget = gl.getRenderTarget();
        const prevAlpha = gl.getClearAlpha();
        gl.setClearColor(0x000000, 0);

        const drawn = {};
        for (const idx of needed) {
            const entry = registry.get(idx);
            if (!entry || !entry.ready) continue;
            const pr = entry.progress.current;
            const d = clamp(p - idx, -1, 1);
            pr.d = d;
            pr.hold = 1 - smoothstep(0, 0.5, Math.abs(d));
            pr.time = state.clock.elapsedTime;
            pr.mobile = mobile;
            pr.aspect = aspect;
            pr.speed = journey.velocity;
            if (Math.abs(entry.camera.aspect - aspect) > 1e-4) {
                entry.camera.aspect = aspect;
                entry.camera.updateProjectionMatrix();
            }
            const target = targets[idx % 2];
            gl.setRenderTarget(target);
            gl.clear();
            gl.render(entry.scene, entry.camera);
            drawn[idx] = target.texture;
        }

        gl.setRenderTarget(prevTarget);
        gl.setClearColor(0x000000, prevAlpha);

        // Zoom parameters (see the prototype's anim()).
        const u = comp.material.uniforms;
        u.uA.value.set(1, 0.5, 0.5, 0);
        u.uB.value.set(1, 0.5, 0.5, 0);
        u.tA.value = targets[0].texture;
        u.tB.value = targets[1].texture;
        u.uSwap.value = 0;

        const setLayer = (idx, scale, ox, oy, alpha) => {
            const uni = idx % 2 === 0 ? u.uA : u.uB;
            uni.value.set(scale, ox, oy, alpha);
        };
        if (needed.length === 1) {
            if (drawn[needed[0]]) setLayer(needed[0], 1, 0.5, 0.5, 1);
        } else {
            const [out, inn] = needed;
            const meta = registry.get(inn)?.meta ?? DEFAULT_META;
            const o = (mobile && meta.originMobile) || meta.origin;
            const ox = o[0];
            const oy = 1 - o[1];
            if (out === LAST - 1) {
                // snap back: the cosmic web rushes in and away, the desk grows in
                if (drawn[out]) setLayer(out, Math.pow(30, f), ox, oy, 1 - smoothstep(0.1, 0.75, f));
                if (drawn[inn]) setLayer(inn, Math.pow(0.03, 1 - f), ox, oy, smoothstep(0, 0.65, f));
                u.uSwap.value = inn % 2 === 0 ? 0 : 1; // incoming on top
            } else {
                if (drawn[out]) setLayer(out, Math.pow(0.03, f), ox, oy, 1 - smoothstep(0.05, 0.8, f));
                if (drawn[inn]) setLayer(inn, Math.pow(7, 1 - f), ox, oy, smoothstep(0.2, 0.95, f));
                u.uSwap.value = out % 2 === 0 ? 0 : 1; // outgoing on top
            }
        }
        u.uBlur.value = clamp(Math.abs(journey.velocity) * 0.04, 0, 0.16);
        u.uTime.value = state.clock.elapsedTime;
        u.uAspect.value = aspect;
        u.uP.value = p;

        gl.render(comp.scene, comp.camera);
    }, 1);

    return (
        <>
            {active.map((idx) => (
                <SceneSlot key={idx} index={idx} registry={registry} mobile={mobile} />
            ))}
        </>
    );
}

// ----------------------------------------------------------------- canvas ----
export default function JourneyStage() {
    const mobile = useMemo(
        () => window.matchMedia("(max-width: 767px), (pointer: coarse)").matches,
        []
    );
    const maxDpr = mobile ? 1.5 : 2;
    const [dpr, setDpr] = useState(Math.min(maxDpr, window.devicePixelRatio || 1));
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const onVis = () => setVisible(document.visibilityState === "visible");
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, []);

    return (
        <Canvas
            aria-hidden="true"
            style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
            frameloop={visible ? "always" : "never"}
            dpr={dpr}
            flat
            gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
            camera={{ position: [0, 0, 5] }}
        >
            <PerformanceMonitor
                flipflops={3}
                onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
                onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))}
                onFallback={() => setDpr(1)}
            />
            <Compositor mobile={mobile} />
        </Canvas>
    );
}
