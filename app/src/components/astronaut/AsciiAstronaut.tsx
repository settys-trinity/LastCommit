import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AsciiEffect } from "three/examples/jsm/effects/AsciiEffect.js";
import { PALETTE } from "../../theme";
import { StatusTag, type TagStatus } from "../term";
import { StaticAstronaut } from "./StaticAstronaut";
import { hint, PARTS, type PartId, type PartStatuses } from "./parts";

const TINT: Record<TagStatus, string> = {
  ok: PALETTE.green,
  warn: PALETTE.amber,
  fail: PALETTE.red,
  info: PALETTE.fg,
  off: "#8a918a",
};
// Hotspot border/text colour per status, so a marker reads its part's state at a glance (plus the detail tag).
const SPOT: Record<TagStatus, string> = {
  ok: "border-ok text-ok",
  warn: "border-warn text-warn",
  fail: "border-fail text-fail",
  info: "border-fg text-fg",
  off: "border-dim text-dim",
};
const SPIN_RAD_PER_S = (10 * Math.PI) / 180;

type Props = {
  parts?: PartStatuses;
  onSelect?: (part: PartId) => void;
  selected?: PartId | null;
  height?: number;
  detail?: "low" | "high"; // high = more characters, for the full-screen body view
  showList?: boolean; // accessible text list of parts under the figure
  hotspots?: boolean; // clickable markers at each part instead of whole-mesh picking, with a hover hint
  look?: "ascii" | "wire" | "solid"; // solid = plain white shaded figure (body page); wire = hologram; ascii = text figure
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
  add("visor", new THREE.SphereGeometry(0.44, 32, 24), [0, 1.78, 0.3], { scale: [1, 0.72, 0.5] });
  add("visor", new THREE.TorusGeometry(0.42, 0.035, 8, 32), [0, 1.78, 0.36], { scale: [1, 0.75, 1] });
  both((s) => add("helmet", new THREE.BoxGeometry(0.12, 0.08, 0.1), [0.32 * s, 2.12, 0.28]));
  add("helmet", new THREE.CylinderGeometry(0.015, 0.015, 0.38, 6), [0.3, 2.42, -0.12]);
  add("helmet", new THREE.SphereGeometry(0.04, 8, 6), [0.3, 2.62, -0.12]);
  // comms pods on the helmet sides (part of the helmet)
  both((s) => add("helmet", new THREE.CylinderGeometry(0.14, 0.14, 0.12, 20), [0.57 * s, 1.8, 0], { rot: [0, 0, HALF_PI] }));
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

/** Hologram look: each mesh becomes a faint see-through fill plus its edges as lines (same part tag). */
function toWire(fig: THREE.Group) {
  fig.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.wired) return;
    (o.material as THREE.Material).dispose();
    o.material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.08, depthWrite: false });
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 1), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 }));
    lines.userData.part = o.userData.part;
    o.add(lines);
    o.userData.wired = true;
  });
}

/** Solid look: plain white, softly shaded, smooth. */
const SOLID_WHITE = "#e9ece9";
function toSolid(fig: THREE.Group) {
  fig.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.solid) return;
    (o.material as THREE.Material).dispose();
    o.material = new THREE.MeshStandardMaterial({ color: SOLID_WHITE, roughness: 0.55, metalness: 0.05 });
    o.userData.solid = true;
  });
}

function paint(fig: THREE.Group, parts: PartStatuses, selected: PartId | null | undefined) {
  fig.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
      // Solid look: everything white; only the selected part takes its status colour.
      const p = o.userData.part as PartId;
      o.material.color.set(p === selected ? TINT[parts[p] ?? "off"] : SOLID_WHITE);
      return;
    }
    if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.LineSegments)) return;
    const p = o.userData.part as PartId;
    const m = o.material as THREE.MeshLambertMaterial | THREE.MeshBasicMaterial | THREE.LineBasicMaterial;
    m.color.set(TINT[parts[p] ?? "off"]);
    if (m instanceof THREE.MeshLambertMaterial) m.emissive.set(p === selected ? 0x333333 : 0x000000);
    else if (m instanceof THREE.MeshBasicMaterial) m.opacity = p === selected ? 0.35 : 0.08;
  });
}

// ASCII-rendered three.js astronaut. Status colours: each part's material is tinted and AsciiEffect's colour
// mode gives every character its pixel's colour (one pass). The text list is the accessible version.
export default function AsciiAstronaut({ parts = {}, onSelect, selected = null, height = 360, detail = "low", showList = true, hotspots = false, look = "ascii" }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const figRef = useRef<THREE.Group | null>(null);
  const redraw = useRef<() => void>(() => {});
  const [hover, setHover] = useState<PartId | null>(null);
  const [noGl] = useState(() => !webglAvailable());
  const spotRefs = useRef<Partial<Record<PartId, HTMLButtonElement | null>>>({});
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
    const wire = look === "wire";
    const canvas = look !== "ascii";
    const frameMs = canvas ? 33 : high ? 80 : 50; // canvas ~30 fps; ASCII ~12 fps big view (more characters), ~20 fps otherwise

    const renderer = new THREE.WebGLRenderer({ antialias: canvas, alpha: canvas });
    renderer.setClearColor(PALETTE.bg, canvas ? 0 : 1);
    // One view object either way: the ASCII effect, or the plain canvas for the hologram.
    let effect: { domElement: HTMLElement; render: (s: THREE.Scene, c: THREE.Camera) => void };
    if (canvas) {
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(width, height);
      effect = { domElement: renderer.domElement, render: (s, c) => renderer.render(s, c) };
    } else {
      const ascii = new AsciiEffect(renderer, " .:-=+*#%@", { resolution: high ? 0.28 : 0.18, color: true });
      ascii.setSize(width, height);
      ascii.domElement.style.background = PALETTE.bg;
      effect = ascii;
    }
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
    if (look === "solid") {
      toSolid(fig);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x3a403a, 1.1)); // soft sky/ground fill so shadows stay grey, not black
      const rim = new THREE.DirectionalLight(0xffffff, 0.8);
      rim.position.set(-4, 3, -4);
      scene.add(rim);
    }
    if (wire) {
      toWire(fig);
      // Scanner base: two rings under the boots.
      [1.15, 0.8].forEach((r, i) => {
        const ring = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.CircleGeometry(r, 64)),
          new THREE.LineBasicMaterial({ color: PALETTE.green, transparent: true, opacity: i ? 0.25 : 0.5 }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -2.15;
        scene.add(ring);
      });
    }
    scene.add(fig);
    figRef.current = fig;
    paint(fig, parts, selected);

    // Hotspots: project each part's anchor through the moving figure and pin its button there.
    const v = new THREE.Vector3();
    const placeSpots = () => {
      fig.updateMatrixWorld();
      const box = effect.domElement.getBoundingClientRect();
      const base = el.getBoundingClientRect();
      for (const p of PARTS) {
        const b = spotRefs.current[p.id];
        if (!b) continue;
        v.set(...p.anchor).applyMatrix4(fig.matrixWorld).project(camera);
        b.style.left = `${box.left - base.left + ((v.x + 1) / 2) * box.width}px`;
        b.style.top = `${box.top - base.top + ((1 - v.y) / 2) * box.height}px`;
      }
    };

    const fixed = look === "solid"; // the white figure stands still, facing the viewer
    const still = fixed || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      fig.rotation.y = fixed ? 0 : still ? 0.35 : Math.sin(t * SPIN_RAD_PER_S) * 0.9; // slow sway, front stays readable
      fig.position.y = -0.45 + (still ? 0 : Math.sin(t * 1.2) * 0.05);
      effect.render(scene, camera);
      if (hotspots) placeSpots();
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
    if (!hotspots) {
      effect.domElement.addEventListener("pointermove", onMove);
      effect.domElement.addEventListener("pointerleave", onLeave);
      effect.domElement.addEventListener("pointerup", onClick);
    }

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", resume);
      effect.domElement.removeEventListener("pointermove", onMove);
      effect.domElement.removeEventListener("pointerleave", onLeave);
      effect.domElement.removeEventListener("pointerup", onClick);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      figRef.current = null;
      redraw.current = () => {};
      el.replaceChildren();
    };
  }, [height, detail, noGl, hotspots, look]); // eslint-disable-line react-hooks/exhaustive-deps

  const canvas = look !== "ascii";
  const label = (id: PartId) => PARTS.find((p) => p.id === id)!.label;
  return (
    <div>
      {noGl ? (
        <StaticAstronaut />
      ) : hotspots ? (
        <div className="relative inline-block">
          <div ref={host} aria-hidden="true" />
          {PARTS.map((p) => {
            const st = parts[p.id] ?? "off";
            const on = p.id === selected;
            return (
              <button
                key={p.id}
                ref={(b) => {
                  spotRefs.current[p.id] = b;
                }}
                type="button"
                onClick={() => onSelect?.(p.id)}
                onPointerEnter={() => setHover(p.id)}
                onPointerLeave={() => setHover((h) => (h === p.id ? null : h))}
                onFocus={() => setHover(p.id)}
                onBlur={() => setHover((h) => (h === p.id ? null : h))}
                aria-label={hint(p.id)}
                aria-pressed={on}
                className={`group absolute z-10 hover:z-30 focus:z-30 -translate-x-1/2 border font-bold leading-none ${canvas ? "px-2 py-1 text-lg" : "px-1"} ${SPOT[st]} ${on ? "bg-fg text-bg" : "bg-bg hover:bg-fg hover:text-bg"}`}
              >
                <span className={on ? "" : "animate-pulse"}>{on ? "[x]" : "[+]"}</span>
                {hover === p.id && (
                  <span
                    role="tooltip"
                                        className="absolute top-1/2 left-full ml-3 w-max max-w-[34ch] -translate-y-1/2 border border-fg bg-bg px-3 py-2 text-left text-base leading-snug font-normal whitespace-normal text-fg"
                  >
                    {hint(p.id)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div ref={host} className={onSelect ? "cursor-pointer" : ""} aria-hidden="true" />
      )}
      {onSelect && !hotspots && <div className="h-[1.5em] text-dim">{hover ? `> ${hover}: ${label(hover)}` : ""}</div>}
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
