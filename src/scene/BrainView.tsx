/**
 * BrainView — FlyWire neuropils plus curated neurons, colored by the
 * simulated activity frame (WAVE-04 T04.1).
 *
 * Render-only: it fetches nothing and owns no global state. glTF node
 * names are channel ids — neuropil ids like "GNG" in the neuropils glb,
 * neuron root ids in the neurons glb. On load, each paintable node's
 * material is cloned once; `useFrame` then writes color/opacity straight
 * into those materials from `getFrame()`, so React never re-renders per
 * frame. `kind: "points"` neuropils arrive from the loader as
 * THREE.Points and are painted the same way. All color math lives in
 * `./brainColors.ts`.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  Html,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
} from "@react-three/drei";

import { NEUROPILS } from "../content/neuropils.ts";
import { hzToColor, hzToOpacity } from "./brainColors.ts";

export interface BrainViewProps {
  /** Neuropils .glb URL (manifest.brain.neuropils.url). */
  neuropilsUrl: string;
  /** Curated neurons .glb URL (manifest.brain.neurons.url). */
  neuronsUrl: string;
  /** Activity channels: neuropil ids, then neuron root ids. */
  channels: readonly string[];
  /** Per-frame Hz getter — called inside useFrame, never per React render. */
  getFrame: () => Float32Array;
  /** Per-channel max Hz, aligned with `channels`. */
  maxHz: readonly number[];
  /** "low" hides the neuron overlay entirely. */
  quality: "high" | "low";
  /** Currently selected channel id (neuropil or neuron), if any. */
  selected?: string;
  /** Called with the neuropil id when the user clicks/taps a region. */
  onSelect: (id: string) => void;
}

/** Any three material carrying a writable color (mesh/line/points). */
type PaintableMaterial = THREE.Material & { color: THREE.Color };

function hasColor(material: THREE.Material): material is PaintableMaterial {
  return (
    "color" in material &&
    (material as PaintableMaterial).color instanceof THREE.Color
  );
}

interface Paintable {
  /** Channel id this node renders. */
  id: string;
  /** Index into channels / getFrame() / maxHz. */
  channel: number;
  /** The scene object (for label anchoring). */
  object: THREE.Object3D;
  /** Cloned material updated each frame. */
  material: PaintableMaterial;
  /** Neuron nodes also get opacity; neuropil surfaces stay opaque. */
  neuron: boolean;
}

/**
 * Walk up from a hit/child object to the nearest ancestor (or self) whose
 * name is a channel id. Multi-primitive glTF nodes become Groups named
 * after the node with unnamed-ish children, so a plain name check on the
 * hit object is not enough.
 */
function channelIdFor(
  object: THREE.Object3D,
  channelIndex: ReadonlyMap<string, number>,
): string | null {
  let node: THREE.Object3D | null = object;
  while (node) {
    if (channelIndex.has(node.name)) return node.name;
    node = node.parent;
  }
  return null;
}

/**
 * Clone every material on `object` (once — callers memoize) and return
 * the clones that carry a color. Array materials keep their order so
 * geometry groups still line up.
 */
function cloneMaterials(object: THREE.Object3D): PaintableMaterial[] {
  const holder = object as THREE.Mesh;
  const current = holder.material;
  if (current === undefined) return [];
  const clones = (Array.isArray(current) ? current : [current]).map((m) =>
    m.clone(),
  );
  holder.material = Array.isArray(current) ? clones : clones[0]!;
  return clones.filter(hasColor);
}

/**
 * Find every renderable node in `root` whose name maps to a channel,
 * clone its materials in place, and list what needs per-frame painting.
 */
function collectPaintables(
  root: THREE.Object3D,
  channelIndex: ReadonlyMap<string, number>,
  neuron: boolean,
): Paintable[] {
  const found: Paintable[] = [];
  root.traverse((object) => {
    const materials = cloneMaterials(object);
    if (materials.length === 0) return;
    const id = channelIdFor(object, channelIndex);
    if (id === null) return;
    const channel = channelIndex.get(id)!;
    for (const material of materials) {
      if (neuron) material.transparent = true; // opacity driven per frame
      found.push({ id, channel, object, material, neuron });
    }
  });
  return found;
}

export function BrainView({
  neuropilsUrl,
  neuronsUrl,
  channels,
  getFrame,
  maxHz,
  quality,
  selected,
  onSelect,
}: BrainViewProps) {
  // Meshopt decoder is bundled via three-stdlib; draco stays off so no
  // decoder binary is fetched from a CDN at runtime.
  const neuropils = useGLTF(neuropilsUrl, false, true);
  const neurons = useGLTF(neuronsUrl, false, true);

  const channelIndex = useMemo(
    () => new Map(channels.map((id, index) => [id, index])),
    [channels],
  );

  // Clone materials once per loaded scene; dispose the clones on unmount.
  const paintables = useMemo(
    () => [
      ...collectPaintables(neuropils.scene, channelIndex, false),
      ...collectPaintables(neurons.scene, channelIndex, true),
    ],
    [neuropils.scene, neurons.scene, channelIndex],
  );
  const paintablesRef = useRef<Paintable[]>([]);
  useEffect(() => {
    paintablesRef.current = paintables;
    return () => {
      for (const p of paintables) p.material.dispose();
    };
  }, [paintables]);

  const selectedTarget = paintables.find((p) => p.id === selected) ?? null;
  const selectedChannel = selected ? channelIndex.get(selected) : undefined;

  // Anchor the label at the top-center of the selected region's bounds.
  const selectedAnchor = useMemo(() => {
    if (!selectedTarget) return null;
    const box = new THREE.Box3().setFromObject(selectedTarget.object);
    if (box.isEmpty()) {
      return selectedTarget.object.getWorldPosition(new THREE.Vector3());
    }
    return new THREE.Vector3(
      (box.min.x + box.max.x) / 2,
      box.max.y,
      (box.min.z + box.max.z) / 2,
    );
  }, [selectedTarget]);

  // Initial Hz text; afterwards the ref is updated inside useFrame.
  const initialHz =
    selectedChannel === undefined ? 0 : (getFrame()[selectedChannel] ?? 0);
  const hzRef = useRef<HTMLSpanElement | null>(null);

  useFrame(() => {
    const frame = getFrame();
    const showNeurons = quality === "high";
    for (const p of paintablesRef.current) {
      if (p.neuron && !showNeurons) continue;
      const hz = frame[p.channel] ?? 0;
      const cap = maxHz[p.channel] ?? 0;
      const [r, g, b] = hzToColor(hz, cap);
      p.material.color.setRGB(r, g, b);
      if (p.neuron) p.material.setValues({ opacity: hzToOpacity(hz, cap) });
    }
    // Live Hz readout in the Html label — DOM write, not React state.
    const span = hzRef.current;
    if (span) {
      const hz =
        selectedChannel === undefined ? 0 : (frame[selectedChannel] ?? 0);
      span.textContent = `${hz.toFixed(1)} Hz`;
    }
  });

  // Fit the camera to the brain bounds once per loaded scene. The fit is
  // computed here and applied declaratively (memoized vectors, so the
  // user's orbiting is never overridden after the first apply).
  const getState = useThree((state) => state.get);
  const fit = useMemo(() => {
    const bounds = new THREE.Box3()
      .setFromObject(neuropils.scene)
      .union(new THREE.Box3().setFromObject(neurons.scene));
    if (bounds.isEmpty()) return null;
    const center = bounds.getCenter(new THREE.Vector3());
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const vFov = THREE.MathUtils.degToRad(50);
    const size = getState().size; // read once per scene, so resizes never reset the orbit
    const aspect = size.height > 0 ? size.width / size.height : 1;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distance = (sphere.radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.1;
    return {
      center,
      position: new THREE.Vector3(
        center.x + distance * 0.35,
        center.y + distance * 0.25,
        center.z + distance,
      ),
      near: Math.max(distance / 1000, 0.01),
      far: distance * 100,
    };
  }, [neuropils.scene, neurons.scene, getState]);

  const handleNeuropilClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const id = channelIdFor(event.object, channelIndex);
    if (id) onSelect(id);
  };

  const labelName = selected ? (NEUROPILS[selected]?.name ?? selected) : "";

  return (
    <group name="brain-view">
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 4]} intensity={1.4} />
      <primitive object={neuropils.scene} onClick={handleNeuropilClick} />
      {quality === "high" && <primitive object={neurons.scene} />}
      {selectedTarget && selectedAnchor && (
        <Html
          position={selectedAnchor}
          center
          zIndexRange={[20, 0]}
          className="brain-region-label"
        >
          <div>
            <strong>{labelName}</strong>
            <br />
            <span ref={hzRef}>{initialHz.toFixed(1)} Hz</span>
            <br />
            <em>simulated</em>
          </div>
        </Html>
      )}
      {fit && (
        <>
          <PerspectiveCamera
            makeDefault
            fov={50}
            near={fit.near}
            far={fit.far}
            position={fit.position}
            onUpdate={(cam) => cam.lookAt(fit.center)}
          />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            target={fit.center}
          />
        </>
      )}
    </group>
  );
}
