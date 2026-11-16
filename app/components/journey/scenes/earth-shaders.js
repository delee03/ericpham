// Shaders for the Earth scene (earth.jsx). Output is linear, no tone mapping.

export const GLOBE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNw;
varying vec3 vNo;
varying vec3 vPw;
void main() {
    vUv = uv;
    vNo = normal;
    vNw = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPw = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const GLOBE_FRAG = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uCloud;
uniform vec3 uL;    // world-space direction to the sun
uniform vec3 uLo;   // same, in the globe's object space
uniform float uTime;
varying vec2 vUv;
varying vec3 vNw;
varying vec3 vNo;
varying vec3 vPw;
const float PI = 3.14159265;

void main() {
    vec3 N = normalize(vNw);
    vec3 V = normalize(cameraPosition - vPw);
    vec3 L = normalize(uL);
    float ndl = dot(N, L);

    // clouds drift a little faster than the ground
    vec2 cuv = vUv + vec2(uTime * 0.00055, 0.0);
    vec3 no = normalize(vNo);
    vec3 east = vec3(no.z, 0.0, -no.x);
    east /= max(length(east), 1e-3);
    vec3 north = cross(no, east);
    float cosLat = max(sqrt(max(0.0, 1.0 - no.y * no.y)), 0.25);
    vec2 so = vec2(dot(uLo, east) / (cosLat * 2.0 * PI), dot(uLo, north) / PI) * 0.014;
    float cl = smoothstep(0.1, 0.92, texture2D(uCloud, cuv).r);
    float shadow = smoothstep(0.1, 0.92, texture2D(uCloud, cuv + so).r);

    vec3 dc = texture2D(uDay, vUv).rgb;
    float lit = pow(clamp((ndl + 0.05) / 1.05, 0.0, 1.0), 0.85);
    float tw = exp(-pow((ndl - 0.02) / 0.14, 2.0));
    vec3 warm = mix(vec3(1.0), vec3(1.0, 0.5, 0.26), tw * 0.9);
    vec3 sunCol = vec3(1.0, 0.94, 0.84) * 1.6;

    vec3 surf = dc * (1.0 - 0.45 * shadow);
    vec3 dayCol = surf * sunCol * lit * warm;

    // ocean glint
    float ocean = smoothstep(0.02, 0.16, dc.b - dc.r);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 260.0) * ocean * (1.0 - cl) * smoothstep(0.0, 0.2, ndl);
    dayCol += vec3(1.0, 0.82, 0.6) * spec * 1.2;

    // lit cloud deck
    vec3 cloudCol = sunCol * lit * mix(vec3(1.0), vec3(1.0, 0.58, 0.38), tw * 0.9) * 0.92;
    dayCol = mix(dayCol, cloudCol, cl * 0.9);

    // night side: moon-less blue ambient + city lights (dimmed under cloud)
    vec3 nm = texture2D(uNight, vUv).rgb;
    float nightAmt = 1.0 - smoothstep(-0.12, 0.06, ndl);
    vec3 lights = nm * vec3(1.0, 0.74, 0.42) * 2.6 * (1.0 - cl * 0.7) * nightAmt;
    vec3 ambient = (dc * 0.5 + vec3(0.03)) * vec3(0.05, 0.09, 0.2) * 0.22 + cl * vec3(0.012, 0.018, 0.03);
    vec3 col = dayCol + ambient + lights;

    // thin atmospheric haze across the disc, strongest toward the limb
    float fr = 1.0 - max(dot(N, V), 0.0);
    float haze = pow(fr, 3.2);
    float sunSide = smoothstep(-0.3, 0.5, ndl);
    vec3 atm = mix(vec3(0.2, 0.45, 1.0), vec3(1.0, 0.6, 0.3), tw * 0.55);
    col += atm * haze * (0.95 * sunSide + 0.03);

    gl_FragColor = vec4(col, 1.0);
}
`;

// Back-side shell: the bright thin blue limb with a golden arc near the sun.
export const ATMO_VERT = /* glsl */ `
varying vec3 vPw;
void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPw = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const ATMO_FRAG = /* glsl */ `
uniform vec3 uC;     // globe centre, world
uniform float uR;    // planet radius, world
uniform float uRs;   // shell radius / planet radius
uniform vec3 uL;
varying vec3 vPw;

void main() {
    vec3 rd = normalize(vPw - cameraPosition);
    vec3 toC = uC - cameraPosition;
    float tc = dot(toC, rd);
    vec3 p = cameraPosition + rd * tc;
    vec3 off = p - uC;
    float b = length(off) / uR;
    float t = clamp((b - 1.0) / (uRs - 1.0), 0.0, 1.0);
    vec3 nt = off / max(length(off), 1e-4);
    vec3 L = normalize(uL);
    float s = dot(nt, L);

    float k = pow(1.0 - t, 2.8) + 2.2 * pow(1.0 - t, 14.0);
    float lit = smoothstep(-0.3, 0.35, s);
    float g = smoothstep(0.5, 0.97, s);
    vec3 blue = vec3(0.2, 0.44, 1.0);
    vec3 gold = vec3(1.0, 0.62, 0.26);
    vec3 col = mix(blue, gold, g * 0.9) * k * (lit * 1.5 + 0.025) * (1.0 + 1.6 * g);
    gl_FragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
}
`;

// Sun: compact HDR core (depth tested, so the planet can hide it) and a
// halo + restrained horizontal streak (not depth tested, like lens bloom).
export const SUN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SUN_FRAG = /* glsl */ `
uniform float uI;
uniform float uMode;   // 0 = core, 1 = halo and streak
uniform vec2 uSize;    // half size of the quad in screen units
varying vec2 vUv;

void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    vec2 u = p * uSize;
    float r = length(u);
    vec3 col;
    if (uMode < 0.5) {
        float core = exp(-pow(r / 0.16, 2.0)) * 9.0 + exp(-r * 5.0) * 1.2;
        col = vec3(1.0, 0.95, 0.84) * core;
    } else {
        float halo = exp(-r * 1.5) * 0.85 + exp(-r * 0.5) * 0.11;
        float streak = exp(-abs(u.y) * 8.0) * exp(-abs(u.x) * 0.5) * 0.42;
        col = vec3(1.0, 0.7, 0.4) * halo + vec3(1.0, 0.8, 0.58) * streak;
    }
    float edge = smoothstep(1.0, 0.65, abs(p.x)) * smoothstep(1.0, 0.65, abs(p.y));
    col *= uI * edge;
    gl_FragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
}
`;
