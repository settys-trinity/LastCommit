import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AsciiEffect } from "three/examples/jsm/effects/AsciiEffect.js";
import { PALETTE } from "../../theme";
import { StatusTag, type TagStatus } from "../term";
import { StaticAstronaut } from "./StaticAstronaut";

export type BodySystem = "brain_behaviour" | "neurovestibular" | "metabolism";
export type SystemStatus = "green" | "amber" | "red";
export const BODY_SYSTEMS: BodySystem[] = ["brain_behaviour", "neurovestibular", "metabolism"];

const TAG: Record<SystemStatus, TagStatus> = { green: "ok", amber: "warn", red: "fail" };
const TINT: Record<SystemStatus, string> = { green: PALETTE.green, amber: PALETTE.amber, red: PALETTE.red };
const FRAME_MS = 50; // about 20 fps
const SPIN_RAD_PER_S = (10 * Math.PI) / 180;

type Props = {
  systems?: Partial<Record<BodySystem, SystemStatus>>;
  onSelect?: (system: BodySystem) => void;
  height?: number;
};

/** Original astronaut from primitives. Meshes carry userData.system for colour and picking. */
function buildAstronaut(): THREE.Group {
  const fig = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, system?: BodySystem, scale?: [number, number, number]) => {
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: PALETTE.fg }));
    mesh.position.set(x, y, z);
    if (scale) mesh.scale.set(...scale);
    mesh.userData.system = system;
    fig.add(mesh);
    return mesh;
  };
  // brain_behaviour: helmet and visor
  add(new THREE.SphereGeometry(0.55, 24, 16), 0, 1.75, 0, "brain_behaviour");
  add(new THREE.SphereGeometry(0.42, 24, 16), 0, 1.72, 0.3, "brain_behaviour", [1, 0.75, 0.45]);
  // neurovestibular: helmet side pods (inner ear) and upper torso
  add(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12), -0.56, 1.75, 0, "neurovestibular").rotation.z = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12), 0.56, 1.75, 0, "neurovestibular").rotation.z = Math.PI / 2;
  add(new THREE.CapsuleGeometry(0.5, 0.35, 6, 16), 0, 0.95, 0, "neurovestibular");
  // metabolism: abdomen
  add(new THREE.CapsuleGeometry(0.45, 0.2, 6, 16), 0, 0.35, 0, "metabolism");
  // neutral: backpack with two tanks, arms, legs, boots
  add(new THREE.BoxGeometry(0.9, 1.1, 0.4), 0, 0.85, -0.55);
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 12), -0.25, 0.85, -0.85);
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 12), 0.25, 0.85, -0.85);
  const armL = add(new THREE.CapsuleGeometry(0.16, 0.8, 4, 12), -0.75, 0.75, 0);
  const armR = add(new THREE.CapsuleGeometry(0.16, 0.8, 4, 12), 0.75, 0.75, 0);
  armL.rotation.z = -0.25;
  armR.rotation.z = 0.25;
  add(new THREE.CapsuleGeometry(0.19, 0.8, 4, 12), -0.25, -0.55, 0);
  add(new THREE.CapsuleGeometry(0.19, 0.8, 4, 12), 0.25, -0.55, 0);
  add(new THREE.BoxGeometry(0.32, 0.2, 0.5), -0.25, -1.15, 0.08);
  add(new THREE.BoxGeometry(0.32, 0.2, 0.5), 0.25, -1.15, 0.08);
  fig.position.y = -0.3;
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

// ASCII-rendered three.js astronaut. Status colours come from the mesh colour via AsciiEffect's
// colour mode (one pass, each character takes its pixel's colour). The text list below is the accessible version.
export default function AsciiAstronaut({ systems = {}, onSelect, height = 360 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const figRef = useRef<THREE.Group | null>(null);
  const [hover, setHover] = useState<BodySystem | null>(null);
  const [noGl] = useState(() => !webglAvailable());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Recolour meshes when statuses change. Unscored systems and limbs stay fg.
  const key = BODY_SYSTEMS.map((s) => systems[s] ?? "-").join(",");
  useEffect(() => {
    figRef.current?.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const s = o.userData.system as BodySystem | undefined;
      const st = s ? systems[s] : undefined;
      (o.material as THREE.MeshLambertMaterial).color.set(st ? TINT[st] : PALETTE.fg);
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = host.current;
    if (!el || noGl) return;
    const width = Math.round(height * 0.75);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setClearColor(PALETTE.bg);
    const effect = new AsciiEffect(renderer, " .:-=+*#%@", { resolution: 0.18, color: true });
    effect.setSize(width, height);
    effect.domElement.style.background = PALETTE.bg;
    effect.domElement.style.fontFamily = "var(--font-mono)";
    el.appendChild(effect.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50);
    camera.position.set(0, 0.4, 7.2);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 4, 5);
    scene.add(sun);
    const fig = buildAstronaut();
    scene.add(fig);
    figRef.current = fig;
    fig.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const s = o.userData.system as BodySystem | undefined;
      const st = s ? systems[s] : undefined;
      (o.material as THREE.MeshLambertMaterial).color.set(st ? TINT[st] : PALETTE.fg);
    });

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      fig.rotation.y = still ? 0.35 : t * SPIN_RAD_PER_S;
      fig.position.y = -0.3 + (still ? 0 : Math.sin(t * 1.2) * 0.06);
      effect.render(scene, camera);
    };
    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return; // paused; resumed by observers
      if (now - last >= FRAME_MS) {
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
    const pick = (e: PointerEvent): BodySystem | null => {
      const r = effect.domElement.getBoundingClientRect();
      const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p, camera);
      const hit = ray.intersectObjects(fig.children, false).find((h) => h.object.userData.system);
      return (hit?.object.userData.system as BodySystem) ?? null;
    };
    const onMove = (e: PointerEvent) => setHover(pick(e));
    const onLeave = () => setHover(null);
    const onClick = (e: PointerEvent) => {
      const s = pick(e);
      if (s) onSelectRef.current?.(s);
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
      el.removeChild(effect.domElement);
    };
  }, [height, noGl]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {noGl ? <StaticAstronaut /> : <div ref={host} className={onSelect ? "cursor-pointer" : ""} aria-hidden="true" />}
      <div className="h-[1.5em] text-dim">{hover ? `> ${hover}` : ""}</div>
      <ul aria-label="body systems">
        {BODY_SYSTEMS.map((s) => {
          const tag = <><StatusTag status={systems[s] ? TAG[systems[s]] : "off"} /> {s}</>;
          return (
            <li key={s}>
              {onSelect ? (
                <button type="button" onClick={() => onSelect(s)} className="hover:bg-fg hover:text-bg focus:bg-fg focus:text-bg">
                  {tag}
                </button>
              ) : (
                tag
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
