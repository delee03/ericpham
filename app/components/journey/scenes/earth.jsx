"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ATMO_FRAG, ATMO_VERT, GLOBE_FRAG, GLOBE_VERT, SUN_FRAG, SUN_VERT } from "./earth-shaders";
import { SCENE_CAMERA, useSceneFrame } from "./shared";

// Level 2: sunrise over Earth at 10,000 km. A real-time textured globe seen from
// orbit at dawn: day/night blend with warm twilight, city lights, drifting cloud
// deck that shades the ground, a thin atmosphere and a sun cresting the limb.
// The origin sits on the night side near Vietnam, where Saigon (level 1) lives.
export const meta = { origin: [0.4, 0.7], originMobile: [0.4, 0.9] };

const CAM_Z = SCENE_CAMERA.position[2];
const RS = 1.022; // atmosphere shell radius / planet radius
const VIETNAM = { lat: 10.8, lon: 106.7 };
const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Hold geometry: the sphere centre such that its silhouette tops out at screen
// height `limbY` (world units at z = 0, centre column) as seen from the camera.
function holdGeometry(mobile) {
    const R = mobile ? 8 : 14;
    const D = mobile ? 17 : 28;
    const limbY = mobile ? -3.3 : -1.7;
    const alpha = Math.atan(-limbY / CAM_Z);
    const beta = alpha + Math.asin(R / D);
    const C = new THREE.Vector3(0, -D * Math.sin(beta), CAM_Z - D * Math.cos(beta));
    return { R, D, C };
}

// Screen height (world units at z = 0) of the silhouette at screen column x.
function limbAt(x, C, R) {
    const cam = new THREE.Vector3(0, 0, CAM_Z);
    const toC = C.clone().sub(cam);
    const hit = (y) => {
        const rd = new THREE.Vector3(x, y, -CAM_Z).normalize();
        const tc = toC.dot(rd);
        return toC.lengthSq() - tc * tc <= R * R;
    };
    let hi = 6;
    let lo = -8;
    for (let i = 0; i < 30; i++) {
        const mid = (hi + lo) / 2;
        if (hit(mid)) lo = mid;
        else hi = mid;
    }
    return lo;
}

// World point on the sphere hit by the ray through screen fraction (ox, oy).
function surfaceNormalAt(origin, f, C, R) {
    const rd = new THREE.Vector3((origin[0] - 0.5) * f.w, (0.5 - origin[1]) * f.h, -CAM_Z).normalize();
    const cam = new THREE.Vector3(0, 0, CAM_Z);
    const oc = cam.clone().sub(C);
    const b = oc.dot(rd);
    const disc = b * b - (oc.lengthSq() - R * R);
    const t = -b - Math.sqrt(Math.max(0, disc));
    return cam.addScaledVector(rd, t).sub(C).normalize();
}

// Quaternion that puts (lat, lon) of the texture at world direction n, north up.
function orientation(lat, lon, n, roll = 0) {
    const la = THREE.MathUtils.degToRad(lat);
    const lo = THREE.MathUtils.degToRad(lon);
    const v = new THREE.Vector3(Math.cos(lo) * Math.cos(la), Math.sin(la), -Math.sin(lo) * Math.cos(la));
    const basis = (out, up) => {
        const u = up.clone().addScaledVector(out, -up.dot(out)).normalize();
        const r = new THREE.Vector3().crossVectors(u, out);
        return new THREE.Matrix4().makeBasis(r, u, out);
    };
    const Bo = basis(v, new THREE.Vector3(0, 1, 0));
    const Bw = basis(n, new THREE.Vector3(Math.sin(roll), Math.cos(roll), 0));
    const m = Bw.multiply(Bo.transpose());
    return new THREE.Quaternion().setFromRotationMatrix(m);
}

export default function Earth({ progress }) {
    const f = useSceneFrame(progress);
    const gl = useThree((s) => s.gl);
    const group = useRef();
    const sun = useRef();

    const textures = useMemo(() => {
        const loader = new THREE.TextureLoader();
        const load = (name, srgb) => {
            const t = loader.load(`/textures/${name}.webp`);
            if (srgb) t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
            t.wrapS = THREE.RepeatWrapping;
            return t;
        };
        return { day: load("earth_daymap", true), night: load("earth_nightmap", true), cloud: load("earth_clouds", false) };
    }, [gl]);
    useEffect(() => () => Object.values(textures).forEach((t) => t.dispose()), [textures]);

    // Everything that depends on the layout (desktop vs mobile), computed once.
    const layout = useMemo(() => {
        const mobile = f.mobile;
        const origin = mobile ? meta.originMobile : meta.origin;
        const { R, C } = holdGeometry(mobile);
        const sunX = f.w * (mobile ? 0.2 : 0.17);
        const limbSun = limbAt(sunX, C, R);
        const n = surfaceNormalAt(origin, f, C, R);
        const qBase = orientation(VIETNAM.lat, VIETNAM.lon, n, -0.1);
        // fully pulled back: the whole globe fits the frame, centred
        const rho = mobile ? Math.min(2.0, f.w * 0.42) : 3.7;
        const dEnd = R / Math.sin(Math.atan(rho / CAM_Z));
        const cEnd = new THREE.Vector3(0, 0, CAM_Z - dEnd);
        // and Asia turns to face us, Vietnam a little left of centre, sunlit side to the right
        const qEnd = orientation(VIETNAM.lat + 8, VIETNAM.lon, new THREE.Vector3(-0.3, 0.2, 0.93).normalize(), -0.12);
        return { R, C, sunX, limbSun, qBase, qEnd, cEnd };
    }, [f]);

    const globeMat = useMemo(
        () =>
            new THREE.ShaderMaterial({
                vertexShader: GLOBE_VERT,
                fragmentShader: GLOBE_FRAG,
                uniforms: {
                    uDay: { value: textures.day },
                    uNight: { value: textures.night },
                    uCloud: { value: textures.cloud },
                    uL: { value: new THREE.Vector3(1, 0, 0) },
                    uLo: { value: new THREE.Vector3(1, 0, 0) },
                    uTime: { value: 0 },
                },
            }),
        [textures],
    );
    const atmoMat = useMemo(
        () =>
            new THREE.ShaderMaterial({
                vertexShader: ATMO_VERT,
                fragmentShader: ATMO_FRAG,
                side: THREE.BackSide,
                transparent: true,
                depthWrite: false,
                blending: THREE.CustomBlending,
                blendSrc: THREE.OneFactor,
                blendDst: THREE.OneFactor,
                blendSrcAlpha: THREE.OneFactor,
                blendDstAlpha: THREE.OneFactor,
                uniforms: {
                    uC: { value: new THREE.Vector3() },
                    uR: { value: 14 },
                    uRs: { value: RS },
                    uL: { value: new THREE.Vector3(1, 0, 0) },
                },
            }),
        [],
    );
    const sunMats = useMemo(() => {
        const make = (mode, depth) =>
            new THREE.ShaderMaterial({
                vertexShader: SUN_VERT,
                fragmentShader: SUN_FRAG,
                transparent: true,
                depthWrite: false,
                depthTest: depth,
                blending: THREE.CustomBlending,
                blendSrc: THREE.OneFactor,
                blendDst: THREE.OneFactor,
                blendSrcAlpha: THREE.OneFactor,
                blendDstAlpha: THREE.OneFactor,
                uniforms: { uI: { value: 1 }, uMode: { value: mode }, uSize: { value: new THREE.Vector2(1, 1) } },
            });
        return { core: make(0, true), halo: make(1, false) };
    }, []);
    useEffect(
        () => () => {
            globeMat.dispose();
            atmoMat.dispose();
            sunMats.core.dispose();
            sunMats.halo.dispose();
        },
        [globeMat, atmoMat, sunMats],
    );

    const tmp = useMemo(
        () => ({
            c: new THREE.Vector3(),
            l: new THREE.Vector3(),
            lh: new THREE.Vector3(),
            lend: new THREE.Vector3(0.78, 0.22, 0.34).normalize(),
            q: new THREE.Quaternion(),
            qs: new THREE.Quaternion(),
            qi: new THREE.Quaternion(),
            up: new THREE.Vector3(0, 1, 0),
            cam: new THREE.Vector3(0, 0, CAM_Z),
            s0: new THREE.Vector3(),
        }),
        [],
    );

    const sphereSegs = f.mobile ? [64, 48] : [128, 96];

    useFrame(() => {
        const { d, hold, time } = progress.current;
        const { R, C, sunX, limbSun, qBase, qEnd, cEnd } = layout;
        const e = smooth(clamp01(d * 4.2)); // leaving: pull back to a whole ball
        const arrive = smooth(clamp01(-d)); // arriving: starts a touch lower and closer
        const g = group.current;
        if (!g) return;

        tmp.c.lerpVectors(C, cEnd, e);
        tmp.c.y -= arrive * 1.1;
        tmp.c.z += arrive * 2.5;
        g.position.copy(tmp.c);
        g.scale.setScalar(R);

        // slow eastward spin; the terminator creeps toward Vietnam
        tmp.qs.setFromAxisAngle(tmp.up, time * 0.011 + d * 0.12);
        tmp.q.slerpQuaternions(qBase, qEnd, e).multiply(tmp.qs);
        g.quaternion.copy(tmp.q);

        // sun direction: side-lit from behind the limb, swinging round to a
        // three-quarter light as the globe pulls back
        const h = clamp01(hold);
        tmp.lh.set(0.85, 0.12 + 0.06 * h, -0.34 + 0.1 * h).normalize();
        tmp.l.lerpVectors(tmp.lh, tmp.lend, e).normalize();
        tmp.qi.copy(tmp.q).invert();
        globeMat.uniforms.uL.value.copy(tmp.l);
        globeMat.uniforms.uLo.value.copy(tmp.l).applyQuaternion(tmp.qi);
        globeMat.uniforms.uTime.value = time;
        atmoMat.uniforms.uC.value.copy(tmp.c);
        atmoMat.uniforms.uR.value = R;
        atmoMat.uniforms.uL.value.copy(tmp.l);

        // the sun: below the limb, cresting it as the level settles
        const s = sun.current;
        if (s) {
            const sy = limbSun - 0.7 + 0.82 * smooth(h) - arrive * 0.5;
            const depth = 60;
            const k = (CAM_Z + depth) / CAM_Z;
            tmp.s0.set(sunX, sy, 0).sub(tmp.cam).multiplyScalar(k).add(tmp.cam);
            tmp.s0.z = -depth;
            s.position.copy(tmp.s0);
            s.scale.setScalar(k);
            const fade = (1 - smooth(clamp01(d * 7))) * (0.35 + 0.65 * h);
            sunMats.core.uniforms.uI.value = fade;
            sunMats.halo.uniforms.uI.value = fade;
        }
    });

    const haloW = f.mobile ? 4.5 : 7.5;
    const haloH = f.mobile ? 3 : 4.6;
    useMemo(() => {
        sunMats.core.uniforms.uSize.value.set(0.9, 0.9);
        sunMats.halo.uniforms.uSize.value.set(haloW, haloH);
    }, [sunMats, haloW, haloH]);

    return (
        <>
            <group ref={group}>
                <mesh material={globeMat}>
                    <sphereGeometry args={[1, sphereSegs[0], sphereSegs[1]]} />
                </mesh>
                <mesh scale={RS} material={atmoMat} renderOrder={1}>
                    <sphereGeometry args={[1, 96, 64]} />
                </mesh>
            </group>
            <group ref={sun}>
                <mesh material={sunMats.core} renderOrder={2} frustumCulled={false} scale={[1.8, 1.8, 1]}>
                    <planeGeometry args={[1, 1]} />
                </mesh>
                <mesh material={sunMats.halo} renderOrder={3} frustumCulled={false} scale={[haloW * 2, haloH * 2, 1]}>
                    <planeGeometry args={[1, 1]} />
                </mesh>
            </group>
        </>
    );
}
