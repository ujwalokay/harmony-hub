import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows, useGLTF, OrbitControls } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { SIZE, neighbors, rc, type Cell } from "@/lib/baghchal";
import { useIsMobile } from "@/hooks/use-mobile";

const lionAsset = { url: "/models/lion.glb" };

const SPACING = 1.15;

export function nodePosition(i: number): [number, number, number] {
  const [r, c] = rc(i);
  return [(c - 2) * SPACING, 0.41, (r - 2) * SPACING];
}

function BoardLines() {
  const segments = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ a: number; b: number }> = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      for (const n of neighbors(i)) {
        const key = i < n ? `${i}-${n}` : `${n}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ a: i, b: n });
      }
    }
    return out;
  }, []);

  return (
    <group>
      {segments.map(({ a, b }, k) => {
        const pa = new THREE.Vector3(...nodePosition(a));
        const pb = new THREE.Vector3(...nodePosition(b));
        const mid = pa.clone().add(pb).multiplyScalar(0.5);
        const len = pa.distanceTo(pb);
        const angle = Math.atan2(pb.z - pa.z, pb.x - pa.x);
        return (
          <mesh key={k} position={[mid.x, 0.402, mid.z]} rotation={[0, -angle, 0]}>
            <boxGeometry args={[len, 0.008, 0.03]} />
            <meshStandardMaterial color="#4a2c12" roughness={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Smoothly eases a piece to its node and adds a gentle idle bob when selected. */
function PieceBase({
  position,
  selected,
  children,
}: {
  position: [number, number, number];
  selected: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(...position), [position]);
  const started = useRef(false);

  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    if (!started.current) {
      g.position.copy(target);
      g.position.y += 1.2;
      g.scale.setScalar(0.4);
      started.current = true;
    }
    const lift = selected ? 0.14 + Math.sin(state.clock.elapsedTime * 3) * 0.03 : 0;
    const k = 1 - Math.pow(0.001, dt);
    g.position.lerp(new THREE.Vector3(target.x, target.y + lift, target.z), k);
    const s = selected ? 1.08 : 1;
    g.scale.lerp(new THREE.Vector3(s, s, s), k);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, selected ? 0.5 : 0, k * 0.6);
  });

  return <group ref={ref}>{children}</group>;
}

/** Round wooden plinth every piece stands on, as in the reference art. */
function Plinth() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.235, 0.245, 0.06, 24]} />
        <meshStandardMaterial color="#3d2110" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.065, 0]}>
        <cylinderGeometry args={[0.205, 0.205, 0.02, 24]} />
        <meshStandardMaterial color="#5c3215" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Lion piece rendered from the GLB, keeping its original materials. */
function LionModel({ selected }: { selected: boolean }) {
  const { scene } = useGLTF(lionAsset.url);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const swayRef = useRef<THREE.Group>(null);
  const breathRef = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as THREE.Object3D;
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    // Normalize: sit on the plinth, face +Z, consistent height.
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = 0.62 / Math.max(size.y, 0.0001);

    const wrapper = new THREE.Group();
    clone.position.set(-center.x, -box.min.y, -center.z);
    wrapper.scale.setScalar(scale);
    wrapper.add(clone);

    const outer = new THREE.Group();
    outer.add(wrapper);
    outer.rotation.y = -Math.PI / 2;
    return outer;
  }, [scene]);

  useFrame((state) => {
    const t = state.clock.elapsedTime + phase;
    const intensity = selected ? 1 : 0.45;

    if (swayRef.current) {
      swayRef.current.rotation.y = Math.sin(t * 0.5) * 0.16 * intensity;
      swayRef.current.rotation.z = Math.sin(t * 0.9 + 1.1) * 0.02 * intensity;
      swayRef.current.position.y = Math.sin(t * (selected ? 2.4 : 1.3)) * 0.012 * intensity;
    }
    if (breathRef.current) {
      const b = 1 + Math.sin(t * (selected ? 2.6 : 1.5)) * 0.022 * intensity;
      breathRef.current.scale.set(b, 1 + (b - 1) * 0.6, b);
    }
  });

  return (
    <group position={[0, 0.075, 0]}>
      <group ref={swayRef}>
        <group ref={breathRef}>
          <primitive object={model} />
        </group>
      </group>
      {selected && (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.24, 0.3, 32]} />
          <meshStandardMaterial
            color="#facc15"
            emissive="#f59e0b"
            emissiveIntensity={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}
    </group>
  );
}


useGLTF.preload(lionAsset.url);

function Tiger({ position, selected }: { position: [number, number, number]; selected: boolean }) {
  return (
    <PieceBase position={position} selected={selected}>
      <Plinth />
      <LionModel selected={selected} />
    </PieceBase>
  );
}


function Goat({ position, selected }: { position: [number, number, number]; selected: boolean }) {
  const coat = selected ? "#e6f9b8" : "#f6f5f2";
  const shade = selected ? "#cbe89a" : "#dedbd4";
  return (
    <PieceBase position={position} selected={selected}>
      <Plinth />
      {/* torso */}
      <mesh castShadow position={[0, 0.28, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.12, 0.24, 6, 12]} />
        <meshStandardMaterial color={coat} roughness={0.6} />
      </mesh>
      {/* legs */}
      {[
        [-0.075, 0.1],
        [0.075, 0.1],
        [-0.075, -0.12],
        [0.075, -0.12],
      ].map(([x, z], k) => (
        <mesh key={`l${k}`} castShadow position={[x!, 0.16, z!]}>
          <cylinderGeometry args={[0.032, 0.038, 0.22, 8]} />
          <meshStandardMaterial color={shade} roughness={0.65} />
        </mesh>
      ))}
      {/* neck + head */}
      <mesh castShadow position={[0, 0.38, 0.12]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.16, 10]} />
        <meshStandardMaterial color={coat} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 0.46, 0.2]}>
        <sphereGeometry args={[0.085, 14, 10]} />
        <meshStandardMaterial color={coat} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.43, 0.28]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshStandardMaterial color={coat} roughness={0.55} />
      </mesh>
      {/* eyes */}
      {[-0.04, 0.04].map((x) => (
        <mesh key={`e${x}`} position={[x, 0.48, 0.26]}>
          <sphereGeometry args={[0.014, 8, 8]} />
          <meshStandardMaterial color="#3f2d18" />
        </mesh>
      ))}
      {/* ears */}
      {[-0.085, 0.085].map((x) => (
        <mesh key={`ear${x}`} position={[x, 0.5, 0.17]} rotation={[0, 0, x > 0 ? -0.9 : 0.9]}>
          <capsuleGeometry args={[0.018, 0.06, 3, 8]} />
          <meshStandardMaterial color={shade} roughness={0.6} />
        </mesh>
      ))}
      {/* swept horns */}
      {[-0.04, 0.04].map((x) => (
        <mesh
          key={`h${x}`}
          castShadow
          position={[x, 0.56, 0.14]}
          rotation={[-0.9, 0, x > 0 ? -0.2 : 0.2]}
        >
          <capsuleGeometry args={[0.017, 0.13, 3, 8]} />
          <meshStandardMaterial color="#5a4632" roughness={0.5} />
        </mesh>
      ))}
      {/* beard */}
      <mesh position={[0, 0.38, 0.25]}>
        <coneGeometry args={[0.028, 0.08, 6]} />
        <meshStandardMaterial color={shade} roughness={0.7} />
      </mesh>
      {/* tail */}
      <mesh position={[0, 0.36, -0.18]} rotation={[0.6, 0, 0]}>
        <coneGeometry args={[0.03, 0.08, 6]} />
        <meshStandardMaterial color={coat} roughness={0.6} />
      </mesh>
    </PieceBase>
  );
}

function Node({
  i,
  highlighted,
  onClick,
}: {
  i: number;
  highlighted: boolean;
  onClick: (i: number) => void;
}) {
  const [hover, setHover] = useState(false);
  const pos = nodePosition(i);
  const ring = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ring.current) return;
    const pulse = highlighted ? 1 + Math.sin(state.clock.elapsedTime * 3.4) * 0.08 : 1;
    ring.current.scale.setScalar(pulse);
  });

  return (
    <group>
      <mesh position={[pos[0], 0.404, pos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.085, 20]} />
        <meshStandardMaterial color="#3f2412" roughness={0.9} />
      </mesh>
      <mesh
        ref={ring}
        position={[pos[0], 0.408, pos[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={highlighted}
        onClick={(e) => {
          e.stopPropagation();
          onClick(i);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        <ringGeometry args={[0.13, 0.2, 28]} />
        <meshStandardMaterial
          color={hover ? "#fde047" : "#84cc16"}
          emissive={hover ? "#facc15" : "#4d7c0f"}
          emissiveIntensity={hover ? 0.7 : 0.3}
          transparent
          opacity={0.95}
        />
      </mesh>
      {/* invisible click pad so empty nodes stay clickable */}
      <mesh
        position={[pos[0], 0.403, pos[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          onClick(i);
        }}
      >
        <circleGeometry args={[0.24, 12]} />
      </mesh>
    </group>
  );
}

export interface BoardSceneProps {
  board: Cell[];
  selected: number | null;
  targets: number[];
  onNodeClick: (i: number) => void;
}

const ALIGN_DEFAULTS = {
  bx: -0.1,
  by: -0.4,
  bz: 0.3,
  bs: 1,
  rot: 52,
  cy: 13,
  cz: 10.1,
  fov: 34,
};

const ALIGN_DEFAULTS_MOBILE = {
  bx: -0.1,
  by: -0.4,
  bz: 0.3,
  bs: 1,
  rot: 52,
  cy: 13,
  cz: 10.1,
  fov: 34,
};

type AlignValues = typeof ALIGN_DEFAULTS;
const ALIGN_KEY = "board-align";
// Bump when baked defaults change so stale localStorage is discarded.
const ALIGN_VERSION = 8;

function defaultsFor(isMobile: boolean) {
  return isMobile ? { ...ALIGN_DEFAULTS_MOBILE } : { ...ALIGN_DEFAULTS };
}

function storageKey(isMobile: boolean) {
  return `${ALIGN_KEY}-${isMobile ? "mobile" : "desktop"}`;
}

function tune(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const v = new URLSearchParams(window.location.search).get(key);
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function loadAlign(): AlignValues {
  const base = { ...ALIGN_DEFAULTS };
  if (typeof window === "undefined") return base;
  try {
    const stored = window.localStorage.getItem(ALIGN_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only honor saved tuning if it was written under the current bake version.
      if (parsed && parsed.__v === ALIGN_VERSION) {
        Object.assign(base, parsed);
      } else {
        window.localStorage.removeItem(ALIGN_KEY);
      }
    }
  } catch {
    /* ignore */
  }
  (Object.keys(base) as (keyof AlignValues)[]).forEach((k) => {
    base[k] = tune(k, base[k]);
  });
  return base;
}

function Scene({
  board,
  selected,
  targets,
  onNodeClick,
  align,
  groupRef,
}: BoardSceneProps & { align: AlignValues; groupRef: React.RefObject<THREE.Group | null> }) {
  return (
    <group
      ref={groupRef}
      position={[align.bx, align.by, align.bz]}
      rotation={[0, (align.rot * Math.PI) / 180, 0]}
      scale={align.bs}
    >

      {/* Backdrop artwork provides the arena; only a shadow catcher here. */}
      <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial transparent opacity={0.22} />
      </mesh>

      <BoardLines />


      {board.map((_, i) => (
        <Node key={`n${i}`} i={i} highlighted={targets.includes(i)} onClick={onNodeClick} />
      ))}

      {board.map((cell, i) => {
        if (cell === "empty") return null;
        const p = nodePosition(i);
        return (
          <group
            key={`p${i}`}
            onClick={(e) => {
              e.stopPropagation();
              onNodeClick(i);
            }}
          >
            {cell === "tiger" ? (
              <Tiger position={p} selected={selected === i} />
            ) : (
              <Goat position={p} selected={selected === i} />
            )}
          </group>
        );
      })}

      <ContactShadows position={[0, 0.41, 0]} opacity={0.3} scale={8} blur={2.2} far={2} />
    </group>
  );
}

/**
 * Auto alignment: fits the board inside the "safe" area of the viewport, i.e.
 * the region left over once the HUD overlays (turn pill, side cards, bottom
 * bar) are excluded. Keeps the tuned camera angle, only adapts distance and
 * framing so the grid is always centered and never overlapped or cropped.
 */
function safeInsets(w: number, h: number) {
  // Baseline padding, then grow it from the real HUD overlays measured in the
  // DOM ([data-hud]) so the grid never sits under a card, pill or button bar.
  const pad = Math.max(12, Math.min(w, h) * 0.03);
  const inset = { top: pad, bottom: pad, left: pad, right: pad };
  if (typeof document === "undefined") return inset;

  document.querySelectorAll<HTMLElement>("[data-hud]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const wide = r.width > w * 0.6;
    if (wide || r.bottom < h * 0.35 || r.top > h * 0.65) {
      // Full-width bars and anything near the top/bottom edge eat vertical room.
      if (r.top + r.height / 2 < h / 2) inset.top = Math.max(inset.top, r.bottom + pad);
      else inset.bottom = Math.max(inset.bottom, h - r.top + pad);
    } else if (r.left + r.width / 2 < w / 2) {
      inset.left = Math.max(inset.left, r.right + pad);
    } else {
      inset.right = Math.max(inset.right, w - r.left + pad);
    }
  });

  // Never let the HUD squeeze the stage below a usable size.
  inset.top = Math.min(inset.top, h * 0.3);
  inset.bottom = Math.min(inset.bottom, h * 0.3);
  inset.left = Math.min(inset.left, w * 0.28);
  inset.right = Math.min(inset.right, w * 0.28);
  return inset;
}


function AutoFit({
  groupRef,
  align,
  enabled,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  align: AlignValues;
  enabled: boolean;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as
    | (THREE.EventDispatcher & {
        target: THREE.Vector3;
        update: () => void;
        minDistance?: number;
        maxDistance?: number;
      })
    | null;

  useEffect(() => {
    if (!enabled) return;
    const group = groupRef.current;
    if (!group || size.width === 0 || size.height === 0) return;

    const raf = requestAnimationFrame(() => {
      group.updateWorldMatrix(true, true);
      // Bounding sphere of the playable grid only (the huge shadow-catcher
      // plane is ignored), padded for piece height and base radius.
      const half = 2 * SPACING + 0.55;
      const scale = group.getWorldScale(new THREE.Vector3()).x;
      const radius = Math.hypot(half, half, 0.55) * scale;
      const sphere = new THREE.Sphere(
        group.localToWorld(new THREE.Vector3(0, 0.75, 0)),
        radius,
      );



      const inset = safeInsets(size.width, size.height);
      const usableW = Math.max(size.width - inset.left - inset.right, 120);
      const usableH = Math.max(size.height - inset.top - inset.bottom, 120);

      camera.fov = align.fov;
      camera.aspect = size.width / size.height;
      camera.updateProjectionMatrix();

      const vFov = (camera.fov * Math.PI) / 180;
      // Effective apertures of the safe region only.
      const regionV = 2 * Math.atan(Math.tan(vFov / 2) * (usableH / size.height));
      const regionH =
        2 * Math.atan(Math.tan(vFov / 2) * camera.aspect * (usableW / size.width));
      const dist =
        Math.max(radius / Math.sin(regionV / 2), radius / Math.sin(regionH / 2)) * 1.04;

      // Preserve the tuned viewing angle.
      const baseLen = Math.hypot(align.cy, align.cz) || 1;
      const dir = new THREE.Vector3(0, align.cy / baseLen, align.cz / baseLen);

      camera.position.copy(sphere.center).addScaledVector(dir, dist);
      camera.lookAt(sphere.center);
      camera.updateMatrixWorld();

      // Re-center the board inside the safe region (not the raw viewport).
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const worldPerPx = (2 * dist * Math.tan(vFov / 2)) / size.height;
      const dx = inset.left + usableW / 2 - size.width / 2;
      const dy = inset.top + usableH / 2 - size.height / 2;
      const shift = right
        .clone()
        .multiplyScalar(-dx * worldPerPx)
        .add(up.clone().multiplyScalar(dy * worldPerPx));

      const target = sphere.center.clone().add(shift);
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target);
      camera.updateProjectionMatrix();

      if (controls) {
        controls.minDistance = Math.min(controls.minDistance ?? dist, dist * 0.5);
        controls.maxDistance = Math.max(controls.maxDistance ?? dist, dist * 2);
        controls.target.copy(target);
        controls.update();
      }
      (window as unknown as Record<string, unknown>)["__fit"] = {
        radius,
        dist,
        center: sphere.center.toArray(),
        pos: camera.position.toArray(),
        far: camera.far,
      };
    });

    return () => cancelAnimationFrame(raf);
  }, [
    enabled,
    camera,
    controls,
    groupRef,
    size.width,
    size.height,
    align.fov,
    align.cy,
    align.cz,
    align.bs,
    align.bx,
    align.by,
    align.bz,
    align.rot,
  ]);

  return null;
}


function CameraRig({ align, onCameraChange }: { align: AlignValues; onCameraChange: (v: Partial<AlignValues>) => void }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as
    | (THREE.EventDispatcher & {
        target: THREE.Vector3;
        update: () => void;
        minDistance?: number;
        maxDistance?: number;
        addEventListener: (t: string, fn: () => void) => void;
        removeEventListener: (t: string, fn: () => void) => void;
      })
    | null;
  // Set when the user drags/zooms, so we don't snap the camera back on the
  // state update that the drag itself produced.
  const fromUser = useRef(false);

  useEffect(() => {
    if (fromUser.current) {
      fromUser.current = false;
      return;
    }
    const dist = Math.hypot(align.cy, align.cz);
    // Widen orbit clamps so the tuned camera distance is never clipped.
    if (controls) {
      controls.minDistance = Math.min(controls.minDistance ?? dist, dist - 0.01);
      controls.maxDistance = Math.max(controls.maxDistance ?? dist, dist + 0.01);
      controls.target.set(0, 0, 0);
    }
    camera.position.set(0, align.cy, align.cz);
    camera.fov = align.fov;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    controls?.update();
  }, [camera, controls, align.cy, align.cz, align.fov]);

  // Keep the panel readouts in sync with manual orbit / zoom.
  useEffect(() => {
    if (!controls) return;
    const handler = () => {
      const cy = Math.round(camera.position.y * 10) / 10;
      const cz = Math.round(Math.hypot(camera.position.x, camera.position.z) * 10) / 10;
      fromUser.current = true;
      onCameraChange({ cy, cz });
    };
    controls.addEventListener("end", handler);
    return () => controls.removeEventListener("end", handler);
  }, [camera, controls, onCameraChange]);

  return null;
}



const SLIDERS: { key: keyof AlignValues; label: string; min: number; max: number; step: number }[] = [
  { key: "bx", label: "Move X", min: -6, max: 6, step: 0.05 },
  { key: "by", label: "Move Y", min: -4, max: 4, step: 0.05 },
  { key: "bz", label: "Move Z", min: -6, max: 6, step: 0.05 },
  { key: "bs", label: "Scale", min: 0.3, max: 2, step: 0.01 },
  { key: "rot", label: "Rotate", min: 0, max: 360, step: 1 },
  { key: "cy", label: "Cam height", min: 2, max: 20, step: 0.1 },
  { key: "cz", label: "Cam distance", min: 2, max: 24, step: 0.1 },
  { key: "fov", label: "Zoom (fov)", min: 15, max: 70, step: 0.5 },
];

function AlignPanel({
  align,
  setAlign,
  onClose,
}: {
  align: AlignValues;
  setAlign: (v: AlignValues) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-3 top-3 z-50 w-64 rounded-lg border border-border bg-background/90 p-3 text-xs shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">Board alignment</span>
        <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
          ✕
        </button>
      </div>
      {SLIDERS.map((s) => (
        <label key={s.key} className="mb-1.5 block">
          <span className="flex items-center justify-between gap-2">
            <span>{s.label}</span>
            <input
              type="number"
              className="w-16 rounded border border-border bg-background px-1 py-0.5 text-right tabular-nums"
              min={s.min}
              max={s.max}
              step={s.step}
              value={align[s.key]}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setAlign({ ...align, [s.key]: n });
              }}
            />
          </span>
          <input
            type="range"
            className="w-full"
            min={s.min}
            max={s.max}
            step={s.step}
            value={align[s.key]}
            onChange={(e) => setAlign({ ...align, [s.key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <div className="mt-2 flex gap-2">
        <button
          className="flex-1 rounded border border-border px-2 py-1 hover:bg-muted"
          onClick={() => navigator.clipboard?.writeText(JSON.stringify(align))}
        >
          Copy
        </button>
        <button
          className="flex-1 rounded border border-border px-2 py-1 hover:bg-muted"
          onClick={async () => {
            try {
              const text = await navigator.clipboard?.readText();
              const parsed = JSON.parse(text ?? "");
              const next = { ...align };
              (Object.keys(ALIGN_DEFAULTS) as (keyof AlignValues)[]).forEach((k) => {
                if (Number.isFinite(Number(parsed[k]))) next[k] = Number(parsed[k]);
              });
              setAlign(next);
            } catch {
              /* ignore invalid clipboard */
            }
          }}
        >
          Paste
        </button>
        <button
          className="flex-1 rounded border border-border px-2 py-1 hover:bg-muted"
          onClick={() => setAlign({ ...ALIGN_DEFAULTS })}
        >
          Reset
        </button>
      </div>

      <p className="mt-2 text-[10px] leading-tight text-muted-foreground">
        Saved automatically. Send me the copied values to bake them in permanently.
      </p>
    </div>
  );
}

export default function BoardScene(props: BoardSceneProps) {
  const [align, setAlignState] = useState<AlignValues>(ALIGN_DEFAULTS);
  const [panel, setPanel] = useState(false);
  const boardRef = useRef<THREE.Group | null>(null);


  useEffect(() => {
    setAlignState(loadAlign());
    setPanel(new URLSearchParams(window.location.search).has("align"));
  }, []);

  const patchAlign = useCallback((p: Partial<AlignValues>) => {
    setAlignState((prev) => {
      const next = { ...prev, ...p };
      try {
        window.localStorage.setItem(ALIGN_KEY, JSON.stringify({ ...next, __v: ALIGN_VERSION }));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setAlign = (v: AlignValues) => {
    setAlignState(v);
    try {
      window.localStorage.setItem(ALIGN_KEY, JSON.stringify({ ...v, __v: ALIGN_VERSION }));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows="soft"
        gl={{ alpha: true, antialias: true, toneMappingExposure: 0.95 }}
        camera={{ position: [0, align.cy, align.cz], fov: align.fov }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
        dpr={[1, 2]}
      >
        {panel ? <CameraRig align={align} onCameraChange={patchAlign} /> : null}
        <AutoFit groupRef={boardRef} align={align} enabled={!panel} />
        <ambientLight intensity={0.42} color="#fff0d6" />
        <hemisphereLight args={["#d4eeff", "#5a8a3a", 0.85]} />
        {/* warm key sun — stronger for deeper shadows */}
        <directionalLight
          position={[6, 14, 6]}
          intensity={2.8}
          color="#ffe6b8"
          castShadow
          shadow-bias={-0.0006}
          shadow-normalBias={0.02}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-16}
          shadow-camera-right={16}
          shadow-camera-top={16}
          shadow-camera-bottom={-16}
        />
        {/* cool bounce fill */}
        <directionalLight position={[-8, 5, -6]} intensity={0.35} color="#a8c8ff" />
        {/* warm rim to lift silhouettes */}
        <directionalLight position={[0, 3, -10]} intensity={0.25} color="#ffcc88" />
        <Scene {...props} align={align} groupRef={boardRef} />
        <OrbitControls
          makeDefault
          target={[0, 0, 0]}
          enablePan
          enableZoom
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          zoomSpeed={0.7}
          panSpeed={0.6}
          minDistance={4}
          maxDistance={40}
          minPolarAngle={Math.PI * 0.12}
          maxPolarAngle={Math.PI * 0.48}
          mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        />
        <Environment preset="park" />
      </Canvas>
      {panel ? (
        <AlignPanel align={align} setAlign={setAlign} onClose={() => setPanel(false)} />
      ) : (
        <button
          className="absolute right-3 top-3 z-50 rounded border border-border bg-background/80 px-2 py-1 text-xs backdrop-blur hover:bg-muted"
          onClick={() => setPanel(true)}
        >
          Align
        </button>
      )}
    </div>
  );
}

