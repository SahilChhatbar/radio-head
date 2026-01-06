import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  Suspense,
} from "react";
import { Button, Dialog } from "@radix-ui/themes";
import { Maximize2, X } from "lucide-react";
import { useRadioStore } from "@/store/useRadiostore";
import Loader from "@/components/Loader";

let globalAudioContext: AudioContext | null = null;
let globalAnalyser: AnalyserNode | null = null;
let globalSourceNode: AudioNode | null = null;
const mediaElementSourceMap = new WeakMap<
  HTMLMediaElement,
  MediaElementAudioSourceNode
>();

const createAnalyserForContext = (ctx: AudioContext) => {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.75;
  analyser.minDecibels = -100;
  analyser.maxDecibels = -20;
  return analyser;
};

interface VisualizerCanvasProps {
  isActive: boolean;
  streamType: "hls" | "tone" | null;
  audioRefObject?: React.RefObject<HTMLAudioElement | null>;
  stationName?: string;
}

const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  isActive,
  streamType,
  audioRefObject,
  stationName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isInitialized, setIsInitialized] = useState(false);

  const ensureAnalyser = useCallback((ctx: AudioContext) => {
    if (!globalAnalyser || globalAudioContext !== ctx) {
      if (globalAnalyser) {
        try {
          globalAnalyser.disconnect();
        } catch {
          // ignore disconnect errors
        }
      }
      globalAudioContext = ctx;
      globalAnalyser = createAnalyserForContext(ctx);
    }
    return globalAnalyser;
  }, []);

  useEffect(() => {
    if (!isActive) return;
    let mounted = true;
    let attempts = 0;
    const maxAttempts = 20;

    const probe = () => {
      if (!mounted) return;
      attempts++;

      const el =
        audioRefObject?.current ??
        document.querySelector<HTMLAudioElement>("audio") ??
        Array.from(document.querySelectorAll("audio")).find((a) => !a.paused);

      if (el) {
        setAudioElement(el);
        setIsInitialized(true);
      }

      if (attempts >= maxAttempts) {
        window.clearInterval(interval);
      }
    };

    const interval = window.setInterval(probe, 300);
    probe();

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [isActive, audioRefObject]);

  const connectAudioSource = useCallback((): boolean => {
    try {
      const attachAnalyserTo = (sourceNode: AudioNode, ctx: AudioContext) => {
        const analyser = ensureAnalyser(ctx);
        if (globalSourceNode && globalSourceNode !== sourceNode) {
          try {
            globalSourceNode.disconnect();
          } catch {
            // Ignore disconnect errors
          }
        }
        try {
          sourceNode.connect(analyser);
        } catch {
          // ignore
        }
        try {
          analyser.connect(ctx.destination);
        } catch {
          // ignore
        }
        globalSourceNode = sourceNode;
        return true;
      };

      if (streamType === "hls" && audioElement) {
        const AudioCtor = //eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtor && !globalAudioContext) {
          return false;
        }
        const ctx =
          globalAudioContext ?? new (AudioCtor as new () => AudioContext)();
        globalAudioContext = ctx;

        let sourceNode = mediaElementSourceMap.get(audioElement);
        if (!sourceNode) {
          try {
            sourceNode = ctx.createMediaElementSource(audioElement);
            mediaElementSourceMap.set(audioElement, sourceNode);
          } catch {
            return false;
          }
        }
        return attachAnalyserTo(sourceNode, ctx);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (streamType === "tone" && (window as any).Tone) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const Tone = (window as any).Tone as any;
          const toneCtx: AudioContext | undefined =
            Tone.context ??
            (typeof Tone.getContext === "function" && Tone.getContext()) ??
            undefined;

          if (!toneCtx) return false;
          globalAudioContext = toneCtx;
          const analyser = ensureAnalyser(toneCtx);

          const dest =
            (typeof Tone.getDestination === "function" &&
              Tone.getDestination()) ??
            Tone.Destination ??
            Tone.destination ??
            null;

          const destNode = (dest && (dest.input || dest.node || dest)) ?? null;

          if (destNode && typeof destNode.connect === "function") {
            try {
              try {
                (destNode as AudioNode).disconnect(analyser);
              } catch {
                // ignore
              }
              (destNode as AudioNode).connect(analyser);
              analyser.connect(toneCtx.destination);
              globalSourceNode = destNode as AudioNode;
              return true;
            } catch {
              return false;
            }
          }
          return false;
        } catch {
          return false;
        }
      }

      return false;
    } catch {
      return false;
    }
  }, [audioElement, streamType, ensureAnalyser]);

  useEffect(() => {
    if (!isActive || !audioElement) return;

    let attempts = 0;
    const maxAttempts = 15;
    let timer: number | undefined;

    const tryAttach = () => {
      attempts++;
      const ok = connectAudioSource();
      if (!ok && attempts < maxAttempts) {
        timer = window.setTimeout(tryAttach, 500) as unknown as number;
      }
    };

    tryAttach();

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isActive, audioElement, streamType, connectAudioSource]);

  useEffect(() => {
    if (!isActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const setSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      if (typeof ctx.setTransform === "function") {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else if (typeof ctx.resetTransform === "function") {
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
      } else {
        ctx.scale(dpr, dpr);
      }
    };

    setSize();
    const onResize = () => setSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      if (typeof ctx.setTransform === "function") {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    window.addEventListener("resize", resize);

    let bufferLength = globalAnalyser?.frequencyBinCount ?? 1024;
    let dataArray = new Uint8Array(bufferLength);

    const TOTAL_ELEMENTS = 80;
    const BAR_THRESHOLD = 40;
    const FULL_BAR_THRESHOLD = 70;

    function draw() {
      if (!ctx) return;
      const currentBufferLength = globalAnalyser?.frequencyBinCount ?? 1024;
      if (currentBufferLength !== bufferLength) {
        bufferLength = currentBufferLength;
        dataArray = new Uint8Array(bufferLength);
      }

      if (globalAnalyser) {
        globalAnalyser.getByteFrequencyData(dataArray);
      }

      const WIDTH = window.innerWidth;
      const HEIGHT = window.innerHeight;
      const centerX = WIDTH / 2;
      const centerY = HEIGHT / 2;

      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const circleRadius = Math.min(WIDTH, HEIGHT) * 0.28;

      ctx.save();
      ctx.translate(centerX, centerY);

      for (let i = 0; i < TOTAL_ELEMENTS; i++) {
        const angle = (i / TOTAL_ELEMENTS) * Math.PI * 2 - Math.PI / 2;
        const index = Math.floor((i / TOTAL_ELEMENTS) * bufferLength);
        const value = dataArray[index] ?? 0;

        const x = circleRadius * Math.cos(angle);
        const y = circleRadius * Math.sin(angle);

        if (value > BAR_THRESHOLD) {
          const transitionProgress = Math.min(
            1,
            (value - BAR_THRESHOLD) / (FULL_BAR_THRESHOLD - BAR_THRESHOLD)
          );

          const maxBarLength = 70;
          const barLength =
            (value / 255) * maxBarLength * (0.3 + transitionProgress * 0.7);
          const halfBar = barLength / 2;

          const innerX = (circleRadius - halfBar) * Math.cos(angle);
          const innerY = (circleRadius - halfBar) * Math.sin(angle);
          const outerX = (circleRadius + halfBar) * Math.cos(angle);
          const outerY = (circleRadius + halfBar) * Math.sin(angle);

          ctx.beginPath();
          ctx.moveTo(innerX, innerY);
          ctx.lineTo(outerX, outerY);

          const glowIntensity = (value / 255) * transitionProgress;

          const accentColor = getComputedStyle(document.documentElement)
            .getPropertyValue("--accent")
            .trim();
          const fgColor = getComputedStyle(document.documentElement)
            .getPropertyValue("--foreground")
            .trim();

          if (value > 200) {
            ctx.strokeStyle = accentColor || "#FF914D";
            ctx.lineWidth = 2.5 + transitionProgress * 1.5;
            ctx.shadowBlur = 10 + glowIntensity * 4;
            ctx.shadowColor = accentColor || "#FF914D";
          } else if (value > 150) {
            ctx.strokeStyle = fgColor || "#FAF9F6";
            ctx.lineWidth = 2 + transitionProgress * 1.5;
            ctx.shadowBlur = 6 + glowIntensity * 6;
            ctx.shadowColor = `rgba(250, 249, 246, 0.6)`;
          } else {
            const alpha = 0.6 + (value / 255) * 0.4;
            ctx.strokeStyle = `rgba(250, 249, 246, ${alpha})`;
            ctx.lineWidth = 1.5 + transitionProgress * 1.5;
            ctx.shadowBlur = 4 + glowIntensity * 4;
            ctx.shadowColor = `rgba(250, 249, 246, ${
              0.3 * transitionProgress
            })`;
          }

          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          const dotSize = 2.5 + (value / 255) * 2;

          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);

          const alpha = 0.3 + (value / 255) * 0.5;
          const fgColor = getComputedStyle(document.documentElement)
            .getPropertyValue("--foreground")
            .trim();
          ctx.fillStyle = fgColor || "#FAF9F6";
          ctx.globalAlpha = alpha;
          ctx.shadowBlur = 3 + value / 50;
          ctx.shadowColor = `rgba(250, 249, 246, ${alpha * 0.4})`;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();

      const fgColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--foreground")
        .trim();
      ctx.fillStyle = fgColor || "#FAF9F6";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (stationName) {
        ctx.font = "bold clamp(24px, 3vw, 40px) Arial";
        ctx.fillText(stationName, centerX, centerY);
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      ctx.fillStyle = fgColor || "#FAF9F6";
      ctx.globalAlpha = 0.7;
      ctx.font = "clamp(16px, 2vw, 24px) Arial";
      ctx.fillText(timeStr, centerX, centerY + 45);
      ctx.globalAlpha = 1;

      animRef.current = window.requestAnimationFrame(draw);
    }

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (animRef.current !== null) {
        window.cancelAnimationFrame(animRef.current);
      }
    };
  }, [isActive, stationName]);

  return <canvas ref={canvasRef} className="vz-canvas" />;
};

interface ImmersiveVisualizerProps {
  currentStation: number;
  streamType?: "hls" | "tone" | null;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
}

const ImmersiveVisualizer: React.FC<ImmersiveVisualizerProps> = ({
  currentStation,
  streamType = null,
  audioRef,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { stations } = useRadioStore() as {
    stations: Array<{ name?: string }>;
  };
  const currentStationData = stations?.[currentStation];

  useEffect(() => {
    if (!isOpen) {
      globalSourceNode = null;
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <Button
        variant="ghost"
        size="2"
        onClick={() => setIsOpen(true)}
        className="hover:bg-[#FF914D]/10"
        title="Immersive Mode"
      >
        <Maximize2 size={20} color="#FF914D" />
      </Button>
      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Content
          className="vz-fullscreen-dialog"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            padding: 0,
            margin: 0,
            maxWidth: "100vw",
            maxHeight: "100vh",
            overflow: "hidden",
            border: "none",
            borderRadius: 0,
          }}
        >
          <div className="vz-wrapper">
            <div className="vz-wrapper -canvas">
              <Suspense
                fallback={
                  <div
                    style={{
                      position: "fixed",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      zIndex: 1001,
                    }}
                  >
                    <Loader loadingText="Brace Yourself!" />
                  </div>
                }
              >
                {isOpen && (
                  <VisualizerCanvas
                    isActive={isOpen}
                    streamType={streamType ?? null}
                    audioRefObject={audioRef}
                    stationName={currentStationData?.name ?? ""}
                  />
                )}
              </Suspense>
            </div>
            <Button
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="vz-close-button"
            >
              <X size={28} color="#FAF9F6" />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
};

export default ImmersiveVisualizer;
