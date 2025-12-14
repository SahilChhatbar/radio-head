import React, { useRef, useEffect, useState, useCallback } from "react";
import { Button, Dialog, Text } from "@radix-ui/themes";
import { Maximize2, X } from "lucide-react";
import { useRadioStore } from "@/store/useRadiostore";

// Global audio context management
let globalAudioContext: AudioContext | null = null;
let globalAnalyser: AnalyserNode | null = null;
let globalSourceNode: AudioNode | null = null;
const mediaElementSourceMap = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

const createAnalyserForContext = (ctx: AudioContext) => {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048; // Doubled from 1024
  analyser.smoothingTimeConstant = 0.75; // Slightly more smoothing for transitions
  analyser.minDecibels = -100;
  analyser.maxDecibels = -20;
  return analyser;
};

/**
 * VisualizerCanvas: Dots that transform into bars based on audio
 */
const VisualizerCanvas: React.FC<{
  isActive: boolean;
  streamType: "hls" | "tone" | null;
  audioRefObject?: React.RefObject<HTMLAudioElement | null>;
  stationName?: string;
}> = ({ isActive, streamType, audioRefObject, stationName }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const ensureAnalyser = useCallback((ctx: AudioContext) => {
    if (!globalAnalyser || globalAudioContext !== ctx) {
      if (globalAnalyser) {
        try {
          globalAnalyser.disconnect();
        } catch (_) {}
      }
      globalAudioContext = ctx;
      globalAnalyser = createAnalyserForContext(ctx);
    }
    return globalAnalyser!;
  }, []);

  // Probe for audio element
  useEffect(() => {
    if (!isActive) return;
    let mounted = true;
    let attempts = 0;
    const maxAttempts = 15;
    const probe = () => {
      if (!mounted) return;
      attempts++;
      const el = audioRefObject?.current ?? document.querySelector<HTMLAudioElement>("audio");
      if (el) setAudioElement(el);
      if (attempts >= maxAttempts) clearInterval(interval);
    };
    probe();
    const interval = window.setInterval(probe, 400);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isActive, audioRefObject]);

  // Connect audio source
  const connectAudioSource = useCallback((): boolean => {
    try {
      const attachAnalyserTo = (sourceNode: AudioNode, ctx: AudioContext) => {
        const analyser = ensureAnalyser(ctx);
        if (globalSourceNode && globalSourceNode !== sourceNode) {
          try {
            globalSourceNode.disconnect();
          } catch (_) {}
        }
        try {
          sourceNode.connect(analyser);
        } catch (_) {}
        try {
          analyser.connect(ctx.destination);
        } catch (_) {}
        globalSourceNode = sourceNode;
        return true;
      };

      if (streamType === "hls" && audioElement) {
        const ctx = globalAudioContext ?? new (window.AudioContext || (window as any).webkitAudioContext)();
        globalAudioContext = ctx;
        let sourceNode = mediaElementSourceMap.get(audioElement);
        if (!sourceNode) {
          try {
            sourceNode = ctx.createMediaElementSource(audioElement);
            mediaElementSourceMap.set(audioElement, sourceNode);
          } catch (err) {
            return false;
          }
        }
        attachAnalyserTo(sourceNode, ctx);
        return true;
      }

      if (streamType === "tone" && (window as any).Tone) {
        try {
          const Tone = (window as any).Tone;
          const toneCtx: AudioContext | undefined = Tone.context || Tone.getContext?.();
          if (!toneCtx) return false;
          globalAudioContext = toneCtx;
          const analyser = ensureAnalyser(toneCtx);
          const dest = Tone.getDestination ? Tone.getDestination() : Tone.Destination || Tone.destination;
          const destNode = dest?.input || dest?.node || dest;
          if (destNode && typeof destNode.connect === "function") {
            try {
              try { (destNode as any).disconnect(analyser); } catch (_) {}
              (destNode as any).connect(analyser);
              analyser.connect(toneCtx.destination);
              globalSourceNode = destNode as any;
              return true;
            } catch (err) {
              return false;
            }
          }
          return false;
        } catch (err) {
          return false;
        }
      }
      return false;
    } catch (err) {
      return false;
    }
  }, [audioElement, streamType, ensureAnalyser]);

  useEffect(() => {
    if (!isActive) return;
    let attempts = 0;
    const maxAttempts = 12;
    let timer: number | undefined;
    const tryAttach = () => {
      attempts++;
      const ok = connectAudioSource();
      if (!ok && attempts < maxAttempts) {
        timer = window.setTimeout(tryAttach, 600);
      }
    };
    tryAttach();
    return () => { if (timer) clearTimeout(timer); };
  }, [isActive, audioElement, streamType, connectAudioSource]);

  // Main drawing logic - dots transform to bars
  useEffect(() => {
    if (!isActive || !globalAnalyser) return;
    const analyser = globalAnalyser;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Total elements around the circle - reduced for more spacing
    const TOTAL_ELEMENTS = 100;
    const BAR_THRESHOLD = 45; // When dots start transitioning to bars
    const FULL_BAR_THRESHOLD = 80; // When fully transformed to bar

    function draw() {
      analyser.getByteFrequencyData(dataArray);

      const WIDTH = window.innerWidth;
      const HEIGHT = window.innerHeight;
      const centerX = WIDTH / 2;
      const centerY = HEIGHT / 2;

      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const circleRadius = Math.min(WIDTH, HEIGHT) * 0.28;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Draw all elements around the circle
      for (let i = 0; i < TOTAL_ELEMENTS; i++) {
        const angle = (i / TOTAL_ELEMENTS) * Math.PI * 2 - Math.PI / 2;
        const index = Math.floor((i / TOTAL_ELEMENTS) * bufferLength);
        const value = dataArray[index] || 0;

        const x = circleRadius * Math.cos(angle);
        const y = circleRadius * Math.sin(angle);

        // Smooth transition from dot to bar based on value
        if (value > BAR_THRESHOLD) {
          // Calculate transition progress (0 to 1)
          const transitionProgress = Math.min(1, (value - BAR_THRESHOLD) / (FULL_BAR_THRESHOLD - BAR_THRESHOLD));
          
          // Smoothly interpolate bar length
          const maxBarLength = 70;
          const barLength = (value / 255) * maxBarLength * (0.3 + transitionProgress * 0.7);
          const halfBar = barLength / 2;
          
          // Bar extends both inward and outward from circle line
          const innerX = (circleRadius - halfBar) * Math.cos(angle);
          const innerY = (circleRadius - halfBar) * Math.sin(angle);
          const outerX = (circleRadius + halfBar) * Math.cos(angle);
          const outerY = (circleRadius + halfBar) * Math.sin(angle);

          ctx.beginPath();
          ctx.moveTo(innerX, innerY);
          ctx.lineTo(outerX, outerY);
          
          // Smooth color and glow transitions
          const glowIntensity = (value / 255) * transitionProgress;
          
          // Get CSS theme colors
          const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
          const fgColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim();
          const accentDark = getComputedStyle(document.documentElement).getPropertyValue('--accent-dark')?.trim() || '#a44a1f';
          
          if (value > 200) {
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 2.5 + transitionProgress * 1.5;
            ctx.shadowBlur = 10 + glowIntensity * 8;
            ctx.shadowColor = accentColor;
          } else if (value > 150) {
            ctx.strokeStyle = fgColor;
            ctx.lineWidth = 2 + transitionProgress * 1.5;
            ctx.shadowBlur = 6 + glowIntensity * 6;
            ctx.shadowColor = `rgba(250, 249, 246, 0.6)`;
          } else {
            // Blend between dot and bar appearance
            const alpha = 0.6 + (value / 255) * 0.4;
            ctx.strokeStyle = `rgba(250, 249, 246, ${alpha})`;
            ctx.lineWidth = 1.5 + transitionProgress * 1.5;
            ctx.shadowBlur = 4 + glowIntensity * 4;
            ctx.shadowColor = `rgba(250, 249, 246, ${0.3 * transitionProgress})`;
          }
          
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          // Draw as dot when audio is low
          const dotSize = 2.5 + (value / 255) * 2;
          
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          
          // Dots with subtle glow - fade in as value increases
          const alpha = 0.3 + (value / 255) * 0.5;
          const fgColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim();
          ctx.fillStyle = fgColor;
          ctx.globalAlpha = alpha;
          ctx.shadowBlur = 3 + (value / 50);
          ctx.shadowColor = `rgba(250, 249, 246, ${alpha * 0.4})`;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();

      // Draw center text
      const bgDark = getComputedStyle(document.documentElement).getPropertyValue('--secondary-dark').trim();
      ctx.fillStyle = bgDark;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      if (stationName) {
        ctx.font = "bold 32px Arial";
        ctx.fillText(stationName, centerX, centerY);
      }
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      ctx.fillStyle = bgDark;
      ctx.globalAlpha = 0.7;
      ctx.font = "20px Arial";
      ctx.fillText(timeStr, centerX, centerY + 45);
      ctx.globalAlpha = 1;

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isActive, stationName]);

  return (
    <canvas
      ref={canvasRef}
      className="vz-canvas"
    />
  );
};

/**
 * ImmersiveVisualizer: Full-screen wrapper
 */
const ImmersiveVisualizer: React.FC<{
  currentStation: number | string;
  streamType?: "hls" | "tone" | null;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
}> = ({ currentStation, streamType, audioRef }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { stations } = useRadioStore();
  const currentStationData = stations[currentStation as any];

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
              <VisualizerCanvas
                isActive={isOpen}
                streamType={streamType ?? null}
                audioRefObject={audioRef}
                stationName={currentStationData?.name}
              />
            </div>

            <Button
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="vz-close-button"
            >
              <X size={28} color="#FF914D" />
            </Button>

            <div className="vz-info-overlay">
              <Text size="2" className="vz-help-text">
                Press ESC or click X to exit immersive mode
              </Text>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
};

export default ImmersiveVisualizer;