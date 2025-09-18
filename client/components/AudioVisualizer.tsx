"use client";
import React, { useRef, useEffect, useCallback, useState } from "react";

interface HTMLMediaElement {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
}

interface AudioVisualizerProps {
  audioElement: HTMLMediaElement | null;
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioNode | null>(null);
  const attachedElementRef = useRef<HTMLMediaElement | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const animRef = useRef<number | null>(null);
  const prevAmpsRef = useRef<number[]>(Array(barCount).fill(0));
  const [error, setError] = useState<string | null>(null);

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

  const ensureAnalyser = useCallback(async () => {
    if (!analyserRef.current) {
      const AudioCtor =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) {
        setError("Web Audio API not supported");
        console.warn("AudioVisualizer: Web Audio API not supported");
        return;
      }
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtor();
        console.log("AudioVisualizer: created AudioContext");
      }
      const audioCtx = audioContextRef.current!;
      const analyser = audioCtx.createAnalyser();
      const fftRequested = Math.max(
        64,
        Math.pow(2, Math.ceil(Math.log2(barCount * 2)))
      );
      analyser.fftSize = Math.min(2048, Math.max(64, fftRequested));
      analyser.smoothingTimeConstant = 0.85;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    }
  }, [barCount]);

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
        result[i] = (avg / 255) * sensitivity;
      }
      return result;
    },
    [barCount, sensitivity]
  );

  const tryCaptureStreamSource = useCallback((el: HTMLMediaElement | null) => {
    if (!el || !audioContextRef.current || !analyserRef.current) return false;
    try {
      const captureFn =
        (el as HTMLMediaElement).captureStream ||
        (el as HTMLMediaElement).mozCaptureStream;
      if (!captureFn) {
        console.warn("AudioVisualizer: captureStream not available on element");
        return false;
      }
      const stream: MediaStream = captureFn.call(el);
      if (!stream) {
        console.warn("AudioVisualizer: captureStream returned null");
        return false;
      }
      const audioCtx = audioContextRef.current!;
      try {
        const msSource = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = msSource;
        try {
          msSource.connect(analyserRef.current!);
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
  }, []);
  const attachSource = useCallback(
    async (el: HTMLMediaElement | null) => {
      if (!el) return;
      try {
        await ensureAnalyser();
        const audioCtx = audioContextRef.current!;
        if (!audioCtx || !analyserRef.current) return;
        if (attachedElementRef.current === el) return;
        if (sourceRef.current) {
          try {
            sourceRef.current.disconnect();
          } catch {}
          sourceRef.current = null;
        }

        let usedCreate = false;
        try {
          const mes = audioCtx.createMediaElementSource(el as any);
          sourceRef.current = mes;
          try {
            mes.connect(analyserRef.current);
            mes.connect(audioCtx.destination);
          } catch (e) {
            console.warn("AudioVisualizer: mes.connect threw", e);
          }
          attachedElementRef.current = el;
          usedCreate = true;
          console.log(
            "AudioVisualizer: attached via createMediaElementSource with destination routing"
          );
        } catch (err: unknown) {
          console.warn(
            "AudioVisualizer: createMediaElementSource failed:",
            err?.message ?? err
          );
        }

        if (audioCtx.state === "suspended") {
          try {
            await audioCtx.resume();
            console.log("AudioVisualizer: resumed AudioContext");
          } catch (e) {
            console.warn("AudioVisualizer: resume failed", e);
          }
        }

        const probe = async () => {
          const data = dataRef.current;
          const analyser = analyserRef.current;
          if (!data || !analyser) return;
          const samples = 3;
          let total = 0;
          for (let s = 0; s < samples; s++) {
            analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            total += sum;
            await new Promise((r) => setTimeout(r, 80));
          }
          const avg = total / samples;
          const threshold = data.length * 2;
          if (avg < threshold) {
            console.warn(
              "AudioVisualizer: probe indicates low audio energy (avg)",
              avg,
              "-> trying captureStream fallback"
            );
            if (tryCaptureStreamSource(el)) {
              return;
            } else {
              console.warn("AudioVisualizer: captureStream fallback failed");
            }
          }
        };

        if (usedCreate) {
          setTimeout(() => {
            probe().catch((e) =>
              console.warn("AudioVisualizer: probe error", e)
            );
          }, 220);
        } else {
          if (!tryCaptureStreamSource(el)) {
            console.warn(
              "AudioVisualizer: both createMediaElementSource and captureStream failed — visualizer will show idle animation"
            );
          }
        }
        setError(null);
      } catch (e) {
        console.error("AudioVisualizer: attachSource error", e);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [ensureAnalyser, tryCaptureStreamSource]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const analyser = analyserRef.current;
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
    if (analyser && data) {
      analyser.getByteFrequencyData(data);
      amps = computeBarAmps(data);
    } else {
      const t = Date.now() / 800;
      for (let i = 0; i < barCount; i++) {
        amps[i] = 0.02 + 0.08 * Math.abs(Math.sin(t + i / 2));
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

  useEffect(() => {
    setupCanvas();
    if (!animRef.current) animRef.current = requestAnimationFrame(draw);
    const onResize = () => setupCanvas();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [setupCanvas, draw]);

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

  useEffect(() => {
    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      try {
        if (sourceRef.current) sourceRef.current.disconnect();
      } catch {}
      try {
        if (analyserRef.current) analyserRef.current.disconnect();
      } catch {}
      try {
        if (audioContextRef.current)
          audioContextRef.current.close().catch(() => {});
      } catch {}
      audioContextRef.current = null;
      analyserRef.current = null;
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
        aria-hidden
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
