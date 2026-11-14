import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AsciiEffect } from "three/examples/jsm/effects/AsciiEffect.js";
import { PALETTE } from "../../theme";
import { StatusTag, type TagStatus } from "../term";
import { StaticAstronaut } from "./StaticAstronaut";
import { PARTS, type PartId, type PartStatuses } from "./parts";

const TINT: Record<TagStatus, string> = {
  ok: PALETTE.green,
  warn: PALETTE.amber,
  fail: PALETTE.red,
  info: PALETTE.fg,
  off: "#8a918a",
};
const SPIN_RAD_PER_S = (10 * Math.PI) / 180;

type Props = {
  parts?: PartStatuses;
  onSelect?: (part: PartId) => void;
  selected?: PartId | null;
  height?: number;
  detail?: "low" | "high"; // high = more characters, for the full-screen body view
  showList?: boolean; // accessible text list of parts under the figure
};

/** Original suited astronaut from three.js primitives. Each mesh carries userData.part. */
function buildAstronaut(): THREE.Group {
  const fig = new THREE.Group();
  const mat = () => new THREE.MeshLambertMaterial({ color: PALETTE.fg });
  const add = (
    part: PartId,
    geo: THREE.BufferGeometry,
    pos: [number, number, number],
    opts: { rot?: [number, number, number]; scale?: [number, number, number] } = {},
  ) => {
    const m = new THREE.Mesh(geo, mat());
    m.position.set(...pos);
    if (opts.rot) m.rotation.set(...opts.rot);
    if (opts.scale) m.scale.set(...opts.scale);
    m.userData.part = part;
    fig.add(m);
  };
  const both = (fn: (s: 1 | -1) => void) => [1, -1].forEach((s) => fn(s as 1 | -1));
  const HALF_PI = Math.PI / 2;

  // helmet: shell, neck ring, visor and its frame, lamps, antenna
  add("helmet", new THREE.SphereGeometry(0.55, 32, 24), [0, 1.8, 0]);
  add("helmet", new THREE.TorusGeometry(0.38, 0.07, 10, 32), [0, 1.32, 0], { rot: [HALF_PI, 0, 0] });
  add("helmet", new THREE.SphereGeometry(0.44, 32, 24), [0, 1.78, 0.3], { scale: [1, 0.72, 0.5] });
  add("helmet", new THREE.TorusGeometry(0.42, 0.035, 8, 32), [0, 1.78, 0.36], { scale: [1, 0.75, 1] });
  both((s) => add("helmet", new THREE.BoxGeometry(0.12, 0.08, 0.1), [0.32 * s, 2.12, 0.28]));
  add("helmet", new THREE.CylinderGeometry(0.015, 0.015, 0.38, 6), [0.3, 2.42, -0.12]);
  add("helmet", new THREE.SphereGeometry(0.04, 8, 6), [0.3, 2.62, -0.12]);
  // ears: comms pods on the helmet sides (inner ear, balance)
  both((s) => add("ears", new THREE.CylinderGeometry(0.14, 0.14, 0.12, 20), [0.57 * s, 1.8, 0], { rot: [0, 0, HALF_PI] }));
  // chest: upper torso, shoulder joints, chest control unit with three dials
  add("chest", new THREE.CapsuleGeometry(0.52, 0.3, 8, 24), [0, 0.98, 0]);
  both((s) => add("chest", new THREE.SphereGeometry(0.21, 20, 14), [0.62 * s, 1.18, 0]));
  add("chest", new THREE.BoxGeometry(0.5, 0.32, 0.18), [0, 0.95, 0.5]);
  [-0.14, 0, 0.14].forEach((x) =>
    add("chest", new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10), [x, 0.95, 0.61], { rot: [HALF_PI, 0, 0] }),
  );
  // abdomen: lower torso and belt
  add("abdomen", new THREE.CapsuleGeometry(0.47, 0.15, 8, 24), [0, 0.38, 0]);
  add("abdomen", new THREE.TorusGeometry(0.47, 0.06, 10, 32), [0, 0.18, 0], { rot: [HALF_PI, 0, 0] });
  // backpack: life support box, top unit, two tanks, hose to the chest unit
  add("backpack", new THREE.BoxGeometry(0.95, 1.15, 0.42), [0, 0.95, -0.58]);
  add("backpack", new THREE.BoxGeometry(0.7, 0.2, 0.35), [0, 1.6, -0.58]);
  both((s) => add("backpack", new THREE.CylinderGeometry(0.11, 0.11, 1.0, 16), [0.27 * s, 0.9, -0.9]));
  add("backpack", new THREE.TorusGeometry(0.32, 0.04, 8, 20, Math.PI), [0.5, 0.95, -0.05], { rot: [0, HALF_PI, 0] });
  // hands: upper arm, elbow, forearm, wrist ring, glove
  both((s) => {
    add("hands", new THREE.CapsuleGeometry(0.16, 0.45, 6, 16), [0.8 * s, 0.82, 0], { rot: [0, 0, 0.18 * s] });
    add("hands", new THREE.SphereGeometry(0.17, 16, 12), [0.86 * s, 0.48, 0.04]);
    add("hands", new THREE.CapsuleGeometry(0.15, 0.4, 6, 16), [0.9 * s, 0.14, 0.1], { rot: [-0.15, 0, 0] });
    add("hands", new THREE.TorusGeometry(0.15, 0.04, 8, 20), [0.92 * s, -0.16, 0.14], { rot: [HALF_PI, 0, 0] });
    add("hands", new THREE.SphereGeometry(0.16, 16, 12), [0.93 * s, -0.34, 0.16], { scale: [1, 1.25, 0.8] });
  });
  // legs: thigh, knee, shin, boot and sole
  both((s) => {
    add("legs", new THREE.CapsuleGeometry(0.2, 0.45, 6, 16), [0.25 * s, -0.35, 0]);
    add("legs", new THREE.SphereGeometry(0.2, 16, 12), [0.25 * s, -0.72, 0.04]);
    add("legs", new THREE.CapsuleGeometry(0.18, 0.45, 6, 16), [0.25 * s, -1.08, 0]);
    add("legs", new THREE.BoxGeometry(0.34, 0.24, 0.55), [0.25 * s, -1.5, 0.08]);
    add("legs", new THREE.BoxGeometry(0.37, 0.06, 0.6), [0.25 * s, -1.64, 0.08]);
  });
  fig.position.y = -0.45;
  return fig;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function paint(fig: THREE.Group, parts: PartStatuses, selected: PartId | null | undefined) {
  fig.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = o.userData.part as PartId;
    const m = o.material as THREE.MeshLambertMaterial;
    m.color.set(TINT[parts[p] ?? "off"]);
    m.emissive.set(p === selected ? 0x333333 : 0x000000);
  });
}

// ASCII-rendered three.js astronaut. Status colours: each part's material is tinted and AsciiEffect's colour
// mode gives every character its pixel's colour (one pass). The text list is the accessible version.
export default function AsciiAstronaut({ parts = {}, onSelect, selected = null, height = 360, detail = "low", showList = true }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const figRef = useRef<THREE.Group | null>(null);
  const redraw = useRef<() => void>(() => {});
  const [hover, setHover] = useState<PartId | null>(null);
  const [noGl] = useState(() => !webglAvailable());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const key = PARTS.map((p) => parts[p.id] ?? "-").join(",") + `|${selected}`;
  useEffect(() => {
    if (figRef.current) {
      paint(figRef.current, parts, selected);
      redraw.current();
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = host.current;
    if (!el || noGl) return;
    const width = Math.round(height * 0.72);
    const high = detail === "high";
    const frameMs = high ? 80 : 50; // ~12 fps for the big view (more characters), ~20 fps otherwise

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setClearColor(PALETTE.bg);
    const effect = new AsciiEffect(renderer, " .:-=+*#%@", { resolution: high ? 0.28 : 0.18, color: true });
    effect.setSize(width, height);
    effect.domElement.style.background = PALETTE.bg;
    el.replaceChildren(effect.domElement); // exactly one figure per component, even after a remount

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50);
    camera.position.set(0, 0.5, 8.6);
    camera.lookAt(0, 0.35, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(3, 4, 5);
    scene.add(sun);
    const fig = buildAstronaut();
    scene.add(fig);
    figRef.current = fig;
    paint(fig, parts, selected);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      fig.rotation.y = still ? 0.35 : Math.sin(t * SPIN_RAD_PER_S) * 0.9; // slow sway, front stays readable
      fig.position.y = -0.45 + (still ? 0 : Math.sin(t * 1.2) * 0.05);
      effect.render(scene, camera);
    };
    redraw.current = () => draw(performance.now());
    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      if (now - last >= frameMs) {
        last = now;
        draw(now);
      }
      raf = requestAnimationFrame(loop);
    };
    const resume = () => {
      if (!still && !raf && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    draw(performance.now());
    resume();

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      resume();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", resume);

    // Picking: pointer position relative to the ASCII element, raycast against the meshes.
    const ray = new THREE.Raycaster();
    const pick = (e: PointerEvent): PartId | null => {
      const r = effect.domElement.getBoundingClientRect();
      const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p, camera);
      const hit = ray.intersectObjects(fig.children, false)[0];
      return (hit?.object.userData.part as PartId) ?? null;
    };
    const onMove = (e: PointerEvent) => setHover(pick(e));
    const onLeave = () => setHover(null);
    const onClick = (e: PointerEvent) => {
      const p = pick(e);
      if (p) onSelectRef.current?.(p);
    };
    effect.domElement.addEventListener("pointermove", onMove);
    effect.domElement.addEventListener("pointerleave", onLeave);
    effect.domElement.addEventListener("pointerup", onClick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", resume);
      effect.domElement.removeEventListener("pointermove", onMove);
      effect.domElement.removeEventListener("pointerleave", onLeave);
      effect.domElement.removeEventListener("pointerup", onClick);
      fig.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      figRef.current = null;
      redraw.current = () => {};
      el.replaceChildren();
    };
  }, [height, detail, noGl]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = (id: PartId) => PARTS.find((p) => p.id === id)!.label;
  return (
    <div>
      {noGl ? <StaticAstronaut /> : <div ref={host} className={onSelect ? "cursor-pointer" : ""} aria-hidden="true" />}
      {onSelect && <div className="h-[1.5em] text-dim">{hover ? `> ${hover}: ${label(hover)}` : ""}</div>}
      {showList && (
        <ul aria-label="astronaut parts">
          {PARTS.map((p) => {
            const tag = (
              <>
                <StatusTag status={parts[p.id] ?? "off"} /> {p.id} <span className="text-dim">{p.label}</span>
              </>
            );
            return (
              <li key={p.id} className={p.id === selected ? "bg-fg text-bg" : ""}>
                {onSelect ? (
                  <button type="button" onClick={() => onSelect(p.id)} className="text-left hover:bg-fg hover:text-bg focus:bg-fg focus:text-bg">
                    {tag}
                  </button>
                ) : (
                  tag
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
