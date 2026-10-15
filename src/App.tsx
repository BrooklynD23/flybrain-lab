import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Canvas } from "@react-three/fiber";

import { AskPanel } from "./components/AskPanel";
import { AttributionPanel } from "./components/AttributionPanel";
import { BehaviorPicker } from "./components/BehaviorPicker";
import { NarrationPanel } from "./components/NarrationPanel";
import { QualityToggle } from "./components/QualityToggle";
import { Timeline } from "./components/Timeline";
import { BehaviorIdSchema, type BehaviorId } from "./contracts/manifest";
import type { NarrationScript } from "./contracts/narration";
import { frameAt, loadActivity, type Activity } from "./data/activity";
import { useClock } from "./data/clock";
import { loadManifest, type LoadedManifest } from "./data/loadManifest";
import { createFpsMeter } from "./fps";
import { askLive } from "./narration/live";
import {
  answerReplay,
  cueAt,
  loadScript,
  suggestedQuestions,
} from "./narration/replay";
import { BodyView } from "./scene/BodyView";
import { BrainView } from "./scene/BrainView";
import { topActive } from "./scene/brainColors";

interface BehaviorData {
  readonly id: BehaviorId;
  readonly activity: Activity;
  readonly script: NarrationScript;
}

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong.";

function initialQuality(params: URLSearchParams): boolean {
  const q = params.get("quality");
  if (q === "low") return true;
  if (q === "high") return false;
  if (navigator.hardwareConcurrency <= 4) return true;
  const mq = (query: string) => window.matchMedia?.(query).matches ?? false;
  return mq("(pointer: coarse)") && mq("(max-width: 700px)");
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const debug = params.get("debug") === "1";
  const live = import.meta.env.VITE_NARRATION_MODE === "live";

  const clock = useClock();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [behavior, setBehavior] = useState<BehaviorId | null>(() => {
    const p = BehaviorIdSchema.safeParse(params.get("behavior"));
    return p.success ? p.data : "feeding";
  });
  const [data, setData] = useState<BehaviorData | null>(null);
  const [lowQuality, setLowQuality] = useState(() => initialQuality(params));
  const [selected, setSelected] = useState<string | undefined>();
  const fpsRef = useRef<HTMLSpanElement>(null);

  // One rAF loop drives the shared clock (and the optional fps readout).
  useEffect(() => {
    const meter = createFpsMeter();
    let raf = requestAnimationFrame(function loop(now) {
      clock.tick(now);
      const fps = meter.tick(now);
      if (fpsRef.current) fpsRef.current.textContent = `${fps} fps`;
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, [clock]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadManifest().then(
      (m) => {
        if (cancelled) return;
        setLoaded(m);
        // Fall back to the first behavior if ?behavior= is not in the manifest.
        setBehavior((b) =>
          m.manifest.behaviors.some((x) => x.id === b)
            ? b
            : m.manifest.behaviors[0]!.id,
        );
      },
      (e: unknown) => !cancelled && setError(errorText(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    const info = loaded?.manifest.behaviors.find((b) => b.id === behavior);
    if (!loaded || !info) return;
    let cancelled = false;
    Promise.all([
      loadActivity(info.activity, loaded.base),
      loadScript(info.narrationUrl),
    ]).then(
      ([activity, script]) => {
        if (cancelled) return;
        setData({ id: info.id, activity, script });
        clock.setDuration(info.durationMs);
        clock.seek(0);
        clock.play();
      },
      (e: unknown) => !cancelled && setError(errorText(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [loaded, behavior, clock, attempt]);

  // Re-renders only when the active cue changes (cueAt returns stable refs).
  const cue = useSyncExternalStore(clock.subscribe, () =>
    data ? cueAt(data.script, clock.tMs) : null,
  );

  const ask = useCallback(
    async (question: string) => {
      if (!data) throw new Error("Data is still loading.");
      const replay = () => answerReplay(data.script, question);
      if (!live) return replay();
      const { activity } = data;
      const active = topActive(
        frameAt(activity, clock.tMs),
        activity.info.channels,
        10,
      );
      try {
        return await askLive({
          behavior: data.id,
          tMs: Math.round(clock.tMs),
          question,
          active,
        });
      } catch (e) {
        return `${errorText(e)} Showing the replay answer instead: ${replay()}`;
      }
    },
    [data, live, clock],
  );

  const info = loaded?.manifest.behaviors.find((b) => b.id === data?.id);
  const quality = lowQuality ? "low" : "high";
  const canvasProps = {
    dpr: lowQuality ? 1 : ([1, 2] as [number, number]),
    gl: { antialias: !lowQuality },
  };

  return (
    <main className="fbl-app">
      <header className="fbl-header">
        <h1>FlyBrain Lab</h1>
        <QualityToggle lowQuality={lowQuality} onChange={setLowQuality} />
        {debug && <span ref={fpsRef} data-testid="fps" />}
      </header>

      {error !== null && (
        <div role="alert" className="fbl-error">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            Retry
          </button>
        </div>
      )}
      {error === null && !loaded && <p role="status">Loading…</p>}

      {loaded && (
        <>
          <BehaviorPicker
            behaviors={loaded.manifest.behaviors}
            selected={behavior ?? loaded.manifest.behaviors[0]!.id}
            onSelect={setBehavior}
          />
          {data && info && (
            <>
              <div className="fbl-panes">
                <div className="fbl-pane">
                  <Canvas {...canvasProps}>
                    <Suspense fallback={null}>
                      <BrainView
                        neuropilsUrl={`${loaded.base}/${loaded.manifest.brain.neuropils.url}`}
                        neuronsUrl={`${loaded.base}/${loaded.manifest.brain.neurons.url}`}
                        channels={data.activity.info.channels}
                        getFrame={() => frameAt(data.activity, clock.tMs)}
                        maxHz={data.activity.info.maxHz}
                        quality={quality}
                        selected={selected}
                        onSelect={setSelected}
                      />
                    </Suspense>
                  </Canvas>
                </div>
                <div className="fbl-pane">
                  <Canvas {...canvasProps}>
                    <Suspense fallback={null}>
                      <BodyView
                        url={`${loaded.base}/${loaded.manifest.body.url}`}
                        behavior={data.id}
                        clipSource={info.clipSource}
                        getTimeMs={() => clock.tMs}
                        timelineMs={info.durationMs}
                        quality={quality}
                      />
                    </Suspense>
                  </Canvas>
                </div>
              </div>
              <Timeline
                clock={clock}
                cueTimesMs={data.script.cues.map((c) => c.tMs)}
              />
              <NarrationPanel
                cue={cue}
                dataSource={loaded.manifest.dataSource}
              />
              <AskPanel
                ask={ask}
                suggestions={suggestedQuestions(data.script)}
                mode={live ? "live" : "replay"}
              />
            </>
          )}
          <AttributionPanel attribution={loaded.manifest.attribution} />
        </>
      )}
    </main>
  );
}
