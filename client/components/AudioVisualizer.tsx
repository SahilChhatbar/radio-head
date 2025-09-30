"use client";
import React, { useRef, useEffect, useCallback, useState } from "react";

interface HTMLMediaElement {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
}

interface AudioVisualizerProps {
  audioElement?: HTMLMediaElement | null;
  analyserNode?: AnalyserNode | null; // Direct analyser node (optional)
  audioContext?: AudioContext | null; // External audio context (optional)
  className?: string;
  barCount?: number;
  barWidth?: number;
  barSpacing?: number;
  maxHeight?: number;
  minHeight?: number;
  sensitivity?: number;
  decay?: number;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioElement,
  analyserNode,
  audioContext,
  className = "",
  barCount = 8,
  barWidth = 2,
  barSpacing = 3,
  maxHeight = 24,
  minHeight = 2,
  sensitivity = 1.0,
  decay = 0.88,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Local fallback analyser reference (points to external analyser)
  const localAnalyserRef = useRef<AnalyserNode | null>(null);

  const sourceRef = useRef<AudioNode | null>(null);
  const attachedElementRef = useRef<HTMLMediaElement | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const animRef = useRef<number | null>(null);
  const prevAmpsRef = useRef<number[]>(Array(barCount).fill(0));
  const [error, setError] = useState<string | null>(null);
  const [_isActive, setIsActive] = useState(false);

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

  /**
   * Ensure there's an analyser available to read data from.
   * Priority:
   * 1) analyserNode prop (use as-is)
   * 2) audioContext prop (should already have analyser connected)
   *
   * NOTE: We no longer create our own AudioContext to avoid conflicts
   */
  const ensureAnalyser = useCallback(async () => {
    // If external analyser node provided, use that
    if (analyserNode) {
      localAnalyserRef.current = analyserNode;
      try {
        dataRef.current = new Uint8Array(analyserNode.frequencyBinCount);
      } catch {
        // defensive: if frequencyBinCount not present for some reason
        dataRef.current = new Uint8Array(2048);
      }
      setIsActive(true);
      console.log("🎛️ AudioVisualizer: using provided analyser node");
      return;
    }

    console.warn(
      "⚠️ AudioVisualizer: No analyser provided, visualizer will show idle animation"
    );
  }, [analyserNode]);

  /**
   * Convert frequency bins into per-bar amplitude values [0..~1] adjusted by sensitivity.
   */
  const computeBarAmps = useCallback(
    (raw: Uint8Array) => {
      const bins = raw.length;
      const result: number[] = new Array(barCount).fill(0);
      const binsPerBar = Math.max(1, Math.floor(bins / barCount));

      for (let i = 0; i < barCount; i++) {
        const start = i * binsPerBar;
        const end = Math.min(start + binsPerBar, bins);
        let sum = 0;
        for (let j = start; j < end; j++) sum += raw[j];
        const avg = sum / (end - start || 1);
        // Normalize 0..255 then apply sensitivity
        result[i] = (avg / 255) * sensitivity;
      }

      return result;
    },
    [barCount, sensitivity]
  );

  /**
   * Try to attach via captureStream fallback (useful on some browsers or cross-origin media).
   * Will create a MediaStreamSource from element.captureStream() and connect to analyser.
   * NOTE: This is now simplified since we rely on the external audio context
   */
  const tryCaptureStreamSource = useCallback(
    (el: HTMLMediaElement | null) => {
      if (!el || !audioContext || !analyserNode) {
        console.warn(
          "AudioVisualizer: Cannot use captureStream without external context/analyser"
        );
        return false;
      }

      try {
        const captureFn =
          (el as any).captureStream || (el as any).mozCaptureStream;
        if (!captureFn) {
          console.warn(
            "AudioVisualizer: captureStream not available on element"
          );
          return false;
        }
        const stream: MediaStream = captureFn.call(el);
        if (!stream) {
          console.warn("AudioVisualizer: captureStream returned null");
          return false;
        }

        try {
          const msSource = audioContext.createMediaStreamSource(stream);
          sourceRef.current = msSource;
          try {
            // connect to analyser if possible
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - connect typings can be finicky for older lib targets
            msSource.connect(analyserNode);
          } catch (e) {
            console.warn("AudioVisualizer: msSource.connect threw", e);
          }
          attachedElementRef.current = el;
          console.log("AudioVisualizer: attached via captureStream fallback");
          return true;
        } catch (e) {
          console.warn("AudioVisualizer: createMediaStreamSource failed", e);
          return false;
        }
      } catch (e) {
        console.warn("AudioVisualizer: captureStream error", e);
        return false;
      }
    },
    [audioContext, analyserNode]
  );

  /**
   * Attach a media element to the analyser.
   * NOTE: This is simplified - we now rely on the useEnhancedAudioPlayer hook
   * to handle all AudioContext and analyser connections. This function is kept
   * mainly for reference and fallback scenarios.
   */
  const attachSource = useCallback(
    async (el: HTMLMediaElement | null) => {
      if (!el) return;

      try {
        await ensureAnalyser();

        // The audio hook should have already connected everything
        // We just need to make sure we have a reference
        if (analyserNode) {
          console.log(
            "AudioVisualizer: analyser already connected by audio hook"
          );
          setError(null);
          return;
        }

        // Fallback: try captureStream if we have audioContext but no analyser
        if (audioContext && !analyserNode && tryCaptureStreamSource(el)) {
          setError(null);
          return;
        }

        console.warn(
          "AudioVisualizer: No analyser available, showing idle animation"
        );
        setError(null);
      } catch (e) {
        console.error("AudioVisualizer: attachSource error", e);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [ensureAnalyser, audioContext, analyserNode, tryCaptureStreamSource]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const analyser = localAnalyserRef.current;
    const data = dataRef.current;
    const prev = prevAmpsRef.current;

    if (!canvas || !ctx) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    const styleWidth = parseFloat(canvas.style.width || `${canvas.width}px`);
    const styleHeight = parseFloat(canvas.style.height || `${canvas.height}px`);

    ctx.clearRect(0, 0, styleWidth, styleHeight);

    let amps: number[] = new Array(barCount).fill(0);
    let hasRealData = false;

    if (analyser && data) {
      try {
        analyser.getByteFrequencyData(data);
        const sum = data.reduce((a, b) => a + b, 0);
        const avg = sum / data.length;

        // Check if we have real audio data (not all zeros due to CORS)
        if (avg > 0.5) {
          amps = computeBarAmps(data);
          hasRealData = true;
        }
      } catch (e) {
        console.warn("AudioVisualizer: getByteFrequencyData failed", e);
      }
    }

    // Fallback to synthetic animation if no real data
    if (!hasRealData) {
      const t = Date.now() / 600;
      const bass = Math.sin(t * 0.5) * 0.3 + 0.4;

      for (let i = 0; i < barCount; i++) {
        // Create wave pattern with variation
        const wave1 = Math.sin(t + i * 0.8) * 0.25;
        const wave2 = Math.sin(t * 1.5 - i * 0.5) * 0.15;
        const wave3 = Math.sin(t * 2 + i * 0.3) * 0.1;

        // Add bass pulse
        const bassPulse = bass * (1 - (i / barCount) * 0.3);

        // Combine waves for natural look
        amps[i] = Math.max(
          0.08,
          Math.min(0.85, 0.15 + wave1 + wave2 + wave3 + bassPulse)
        );
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
      if (active) {
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
    computeBarAmps,
    decay,
  ]);

  // Initialize canvas + animation frame
  useEffect(() => {
    setupCanvas();
    if (!animRef.current) animRef.current = requestAnimationFrame(draw);
    const onResize = () => setupCanvas();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [setupCanvas, draw]);

  // Watch audioElement changes and attach/detach source
  useEffect(() => {
    (async () => {
      if (audioElement) {
        console.log("AudioVisualizer: audioElement changed - attaching");
        await attachSource(audioElement);
      } else {
        console.log("AudioVisualizer: audioElement is null - detaching");
        if (sourceRef.current) {
          try {
            sourceRef.current.disconnect();
          } catch {}
          sourceRef.current = null;
        }
        attachedElementRef.current = null;
      }
    })();
  }, [audioElement, attachSource]);

  // Watch for analyser node changes and initialize
  useEffect(() => {
    if (analyserNode) {
      localAnalyserRef.current = analyserNode;
      try {
        dataRef.current = new Uint8Array(analyserNode.frequencyBinCount);
        setIsActive(true);
        console.log(
          "🎛️ AudioVisualizer: analyser node updated, visualizer active"
        );
      } catch (e) {
        console.warn("AudioVisualizer: failed to initialize data array", e);
      }
    }
  }, [analyserNode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      try {
        if (sourceRef.current) sourceRef.current.disconnect();
      } catch {}
      // Don't close external contexts/analysers - they're managed by useEnhancedAudioPlayer
      localAnalyserRef.current = null;
      sourceRef.current = null;
      dataRef.current = null;
    };
  }, []);

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
      {error && (
        <div
          className="text-xs text-red-400 mt-1 opacity-70 ml-2"
          title={error}
        >
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;
