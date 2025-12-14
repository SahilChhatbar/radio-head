"use client";
import React, {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";

interface AudioVisualizerProps {
  className?: string;
  barCount?: number;
  barWidth?: number;
  barSpacing?: number;
  maxHeight?: number;
  minHeight?: number;
  decay?: number;
  isLoading?: boolean;
  isPaused?: boolean;
}

export interface AudioVisualizerHandle {
  reset: () => void;
  pause: () => void;
  resume: () => void;
}

const AudioVisualizer = forwardRef<AudioVisualizerHandle, AudioVisualizerProps>(
  (
    {
      className = "",
      barCount = 8,
      barWidth = 2,
      barSpacing = 3,
      maxHeight = 24,
      minHeight = 2,
      decay = 0.88,
      isLoading = false,
      isPaused = false,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animRef = useRef<number | null>(null);
    const prevAmpsRef = useRef<number[]>(Array(barCount).fill(0));
    const phaseOffsetRef = useRef<number>(0); // Random phase for variety
    const startTimeRef = useRef<number>(Date.now());
    const isPausedRef = useRef<boolean>(false);

    // Expose reset, pause, resume methods via ref
    useImperativeHandle(ref, () => ({
      reset: () => {
        // Reset animation state with new random phase
        prevAmpsRef.current = new Array(barCount).fill(0);
        phaseOffsetRef.current = Math.random() * Math.PI * 2;
        startTimeRef.current = Date.now();
        isPausedRef.current = false;
      },
      pause: () => {
        isPausedRef.current = true;
      },
      resume: () => {
        isPausedRef.current = false;
        startTimeRef.current = Date.now();
      },
    }));

    // Keep prevAmps in sync if barCount changes
    useEffect(() => {
      prevAmpsRef.current = new Array(barCount).fill(0);
    }, [barCount]);

    const setupCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;

      const parent = canvas.parentElement;
      const baseWidth = barCount * (barWidth + barSpacing) + 20;
      const width = Math.max(parent?.clientWidth ?? baseWidth, baseWidth);
      const height = maxHeight + 8;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }, [barCount, barWidth, barSpacing, maxHeight]);

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const prev = prevAmpsRef.current;

      if (!canvas || !ctx) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const styleWidth = parseFloat(canvas.style.width || `${canvas.width}px`);
      const styleHeight = parseFloat(
        canvas.style.height || `${canvas.height}px`
      );

      ctx.clearRect(0, 0, styleWidth, styleHeight);

      // Generate realistic animation with more natural variation
      const amps: number[] = new Array(barCount).fill(0);
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const t = elapsed * 1.2; // Base time scale
      const phase = phaseOffsetRef.current;

      // Check if paused or loading - show ghost animation
      const showGhostAnimation = isPausedRef.current || isLoading || isPaused;

      // Create frequency-dependent characteristics
      for (let i = 0; i < barCount; i++) {
        const freqRatio = i / barCount; // 0 = low freq (bass), 1 = high freq (treble)

        if (showGhostAnimation) {
          // Ghost animation: minimal, slow pulsing
          const ghostPulse = Math.sin(t * 0.3 + i * 0.5) * 0.15;
          amps[i] = Math.max(0.05, 0.1 + ghostPulse);
        } else {
          // Bass frequencies (0-3): stronger, slower movement
          // Mid frequencies (4-7): moderate, balanced
          // High frequencies (8+): faster, more subtle

          // Primary rhythm wave - varies by frequency
          const rhythmSpeed = 0.8 + freqRatio * 1.2; // Bass slower, treble faster
          const rhythm = Math.sin(t * rhythmSpeed + phase + i * 0.3);

          // Secondary harmonics for realism
          const harmonic1 = Math.sin(t * 1.6 + phase * 0.7 + i * 0.5) * 0.6;
          const harmonic2 = Math.sin(t * 2.3 + phase * 1.3 - i * 0.4) * 0.3;
          const harmonic3 = Math.sin(t * 3.1 + phase * 0.5 + i * 0.7) * 0.2;

          // Bass boost - lower frequencies have more energy
          const bassBoost = Math.pow(1 - freqRatio, 2) * 0.4;
          const bassPulse = Math.sin(t * 0.5 + phase) * bassBoost;

          // Treble variation - higher frequencies more erratic
          const trebleVariation = freqRatio * Math.sin(t * 4 + i) * 0.15;

          // Add some "randomness" through higher frequency noise
          const noise =
            Math.sin(t * 7.3 + i * 2.1) * 0.08 +
            Math.sin(t * 11.7 - i * 1.3) * 0.05;

          // Combine all components with frequency-dependent weighting
          const midEnergy = Math.sin(freqRatio * Math.PI) * 0.15; // Peak at middle frequencies

          const combined =
            rhythm * 0.35 +
            harmonic1 * 0.2 +
            harmonic2 * 0.15 +
            harmonic3 * 0.1 +
            bassPulse +
            trebleVariation +
            midEnergy +
            noise;

          // Base level + combined waves, scaled by frequency characteristics
          const baseLevel = 0.15 + (1 - freqRatio) * 0.1; // Bass bars slightly taller baseline
          amps[i] = Math.max(0.05, Math.min(0.9, baseLevel + combined * 0.5));
        }
      }

      const totalWidth = barCount * (barWidth + barSpacing) - barSpacing;
      const startX = Math.max(0, (styleWidth - totalWidth) / 2);

      for (let i = 0; i < barCount; i++) {
        const target = Math.max(minHeight / maxHeight, amps[i]);
        let p = prev[i] ?? 0;
        if (target >= p) {
          p = target;
        } else {
          // decay mixing (smoothed fall)
          p = p * decay + target * (1 - decay);
        }
        prev[i] = p;
        const amp = Math.min(1, p);
        const barH = Math.max(minHeight, amp * maxHeight);
        const x = startX + i * (barWidth + barSpacing);
        const y = styleHeight - barH;

        const gradient = ctx.createLinearGradient(0, y, 0, styleHeight);
        const active = amp > 0.03;

        if (showGhostAnimation) {
          // Ghost mode: dimmed, pulsing gray/orange
          gradient.addColorStop(0, "rgba(255,145,77,0.25)");
          gradient.addColorStop(1, "rgba(255,145,77,0.08)");
          ctx.shadowBlur = 2;
          ctx.shadowColor = "rgba(255,145,77,0.1)";
        } else if (active) {
          gradient.addColorStop(0, "#FF914D");
          gradient.addColorStop(0.6, "#FF914D");
          gradient.addColorStop(1, "rgba(255,145,77,0.6)");
          ctx.shadowBlur = 6;
          ctx.shadowColor = "rgba(255,145,77,0.25)";
        } else {
          gradient.addColorStop(0, "rgba(255,145,77,0.35)");
          gradient.addColorStop(1, "rgba(255,145,77,0.12)");
          ctx.shadowBlur = 0;
          ctx.shadowColor = "transparent";
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(Math.round(x), Math.round(y), barWidth, Math.round(barH));
      }

      animRef.current = requestAnimationFrame(draw);
    }, [
      barCount,
      barWidth,
      barSpacing,
      maxHeight,
      minHeight,
      decay,
      isLoading,
      isPaused,
    ]);

    // Initialize canvas + animation frame
    useEffect(() => {
      setupCanvas();
      if (!animRef.current) animRef.current = requestAnimationFrame(draw);
      const onResize = () => setupCanvas();
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
        if (animRef.current) {
          cancelAnimationFrame(animRef.current);
          animRef.current = null;
        }
      };
    }, [setupCanvas, draw]);

    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ minWidth: 0 }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden={true}
          style={{
            display: "block",
            width: "100%",
            height: `${maxHeight + 12}px`,
            minWidth: `${barCount * (barWidth + barSpacing) + 40}px`,
            maxWidth: `${barCount * (barWidth + barSpacing) + 80}px`,
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
          }}
        />
      </div>
    );
  }
);

AudioVisualizer.displayName = "AudioVisualizer";

export default AudioVisualizer;
