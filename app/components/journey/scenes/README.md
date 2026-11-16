# Journey scene contract

One file per level in this folder, registered in `index.js` (swap a scene by
changing one `load` line). Level 7 ("back to you") reuses `desk.jsx`.

| level | file | scale |
| --- | --- | --- |
| 0 / 7 | `desk.jsx` | 10^0 m |
| 1 | `saigon.jsx` | 10^4 m |
| 2 | `earth.jsx` | 10^7 m |
| 3 | `planets.jsx` | 10^12 m |
| 4 | `pale-blue-dot.jsx` | ~10^13 m |
| 5 | `milky-way.jsx` | 10^21 m |
| 6 | `cosmic-web.jsx` | 10^26 m |

## Exports

```jsx
export const meta = {
    origin: [0.5, 0.5],        // 0..1 screen point (y from TOP) where the previous, smaller level lives inside this scene
    originMobile: [0.5, 0.62], // optional; used when progress.current.mobile
};
export default function MyScene({ progress }) { /* R3F content */ }
```

Prototype origins: desk 0.69/0.5, saigon 0.57/0.43, all others 0.5/0.5.

## What you get

* You are rendered by `stage.jsx` into your OWN offscreen target with your OWN
  `THREE.Scene` and camera (via a portal). Do not create a Canvas, read scroll,
  touch the DOM, or implement opacity/scale/transitions: the compositor scales
  the outgoing scene toward the next level's `origin` and fades it, grows the
  incoming one from 7x (the snap back 6 -> 7 runs the reverse: cosmic web
  rushes in, the desk grows from 0.03x), adds zoom blur and a starfield.
* The target is cleared to TRANSPARENT black. Leave the background empty (or
  paint your own) and the persistent starfield shows through. Output is linear,
  premultiplied by alpha (normal three.js blending); no tone mapping.
* `useThree`/`useFrame` work as usual inside your component (portal state).
  `useFrame` callbacks run before the scene is rendered each frame.
* At most two scenes are mounted at once (current + the one being travelled
  to). Everything you allocate is disposed when you unmount, but prefer
  `useMemo` and let R3F own the objects.

## Camera and framing

* `PerspectiveCamera`, vertical fov 45 deg, at `[0, 0, 12.07]`, looking at the
  origin (`SCENE_CAMERA` in `shared.jsx`). The visible height at z = 0 is
  exactly **10 world units**; width = `10 * aspect` (~17.8 on 16:9, ~4.6 on a
  390x844 phone).
* The HTML content sits on the left ~45% on desktop and in the upper half on
  mobile. Keep that side VISUALLY QUIET: put the subject on the right
  (desktop) or in the lower half (mobile). `useSceneFrame(progress)` returns
  `{ w, h, aspect, mobile, cx, cy, r }`: the visible size, the centre of the
  free area and a comfortable subject radius. Soft glows may leak into the
  quiet side, hard detail may not.
* On mobile the subject should be re-centred (use `frame.cx/cy`) and
  `meta.originMobile` should point at where the previous level shrinks to.

## progress

`progress.current` is mutated in place every frame (do not copy it):

| field | meaning |
| --- | --- |
| `d` | -1..1; 0 at this level's hold, negative while arriving from the previous level, positive while leaving to the next |
| `hold` | 0..1, how settled we are (1 at the hold) |
| `time` | seconds since the stage started (for idle animation) |
| `mobile` | boolean, narrow/touch layout |
| `aspect` | canvas aspect ratio |
| `speed` | signed travel speed in levels per second |

Use `d`/`hold` for internal animation (the planet flyby moving along its path,
the sun rising) and `time` for idle motion.

## Helpers (`shared.jsx`)

`useSceneFrame`, `seeded(seed)` (deterministic RNG), `Glow` (additive radial
billboard, no textures), `markerPos(origin, frame)` (origin -> world position).

## Tips

* Compile cost lands on the first frame of a travel (the scene mounts when
  travel starts). Keep shaders/materials few, or warm them in the component.
* HalfFloat targets: HDR-ish values above 1.0 survive until compositing and are
  clipped at the end.
