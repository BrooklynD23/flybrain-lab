import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, type CSSProperties } from "react";
import { Mesh } from "three";

import type { BehaviorId, ClipSource } from "../contracts/manifest.ts";
import { clipSeconds, sourceLabel } from "./clipTime.ts";

export interface BodyViewProps {
  /** URL of the fly glb; it carries one animation clip per behavior. */
  url: string;
  /** Active behavior — also the name of the clip inside the glb. */
  behavior: BehaviorId;
  /** Where the clip came from; shown on the badge (AGENT.md convention 8). */
  clipSource: ClipSource;
  /** Shared timeline clock. Read inside useFrame — no React re-render. */
  getTimeMs: () => number;
  /** Full timeline length in ms (the behavior's durationMs). */
  timelineMs: number;
  /** "low" skips shadows; dpr/antialias are App's job. */
  quality: "high" | "low";
}

const badgeStyle: CSSProperties = {
  padding: "2px 8px",
  borderRadius: 4,
  background: "rgba(0, 0, 0, 0.6)",
  color: "#fff",
  fontSize: 12,
  whiteSpace: "nowrap",
};

/** Fly body: scrubs the behavior clip from the shared clock. */
export function BodyView({
  url,
  behavior,
  clipSource,
  getTimeMs,
  timelineMs,
  quality,
}: BodyViewProps) {
  const { scene, animations } = useGLTF(url);
  const { actions, mixer } = useAnimations(animations, scene);

  // On behavior change stop every other clip, then play the named action
  // paused — useFrame alone sets action.time from the clock.
  useEffect(() => {
    const action = actions[behavior];
    if (!action) return;
    for (const [name, other] of Object.entries(actions)) {
      if (other && name !== behavior) other.stop();
    }
    action.play();
    // eslint-disable-next-line react-hooks/immutability -- external three.js object, not React state
    action.paused = true;
    return () => {
      action.stop();
    };
  }, [actions, behavior]);

  useFrame(() => {
    const action = actions[behavior];
    if (!action) return;
    // eslint-disable-next-line react-hooks/immutability -- external three.js object, not React state
    action.time = clipSeconds(
      getTimeMs(),
      action.getClip().duration,
      timelineMs,
    );
    // Re-evaluate the paused action at the new time this frame.
    mixer.update(0);
  });

  // Low quality: no cast/receive shadows on the fly meshes.
  useEffect(() => {
    const shadows = quality !== "low";
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = shadows;
        object.receiveShadow = shadows;
      }
    });
  }, [scene, quality]);

  return (
    <>
      <primitive object={scene} />
      <Html
        // Pin the badge to the canvas corner instead of a 3D anchor.
        calculatePosition={() => [8, 8]}
        pointerEvents="none"
      >
        <div className="clip-source-badge" style={badgeStyle}>
          {sourceLabel(clipSource)}
        </div>
      </Html>
    </>
  );
}
