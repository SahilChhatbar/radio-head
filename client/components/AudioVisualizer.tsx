import React, { useRef, useEffect, useState, useCallback } from "react";

interface AudioVisualizerProps {
  audioElement: HTMLMediaElement | null;
  className?: string;
  barCount?: number;
  barWidth?: number;
  barSpacing?: number;
  maxHeight?: number;
  minHeight?: number;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioElement,
  className = "",
  barCount = 24,
  barWidth = 3,
  barSpacing = 2,
  maxHeight = 32,
  minHeight = 4,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const attachedElementRef = useRef<HTMLMediaElement | null>(null);

  const [isActive, setIsActive] = useState(false);

  const attachToElement = useCallback(
    (el: HTMLMediaElement | null) => {
      if (!el) return;

      try {
        if (!el.crossOrigin) {
          // @ts-ignore
          el.crossOrigin = "anonymous";
        }
      } catch {}

      const AudioCtx = (window.AudioContext ||
        (window as any).webkitAudioContext) as typeof AudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }

      if (attachedElementRef.current === el && analyserRef.current) {
        return;
      }

      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {}
        sourceRef.current = null;
      }

      if (!analyserRef.current) {
        const analyser = audioCtxRef.current.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        analyserRef.current = analyser;
      }

      try {
        const source = audioCtxRef.current.createMediaElementSource(el);
        source.connect(analyserRef.current!);
        sourceRef.current = source;
        dataArrayRef.current = new Uint8Array(
          analyserRef.current.frequencyBinCount
        );
        attachedElementRef.current = el;
        setIsActive(true);
      } catch (err) {
        console.warn("AudioVisualizer: could not create source node", err);
        setIsActive(false);
      }
    },
    []
  );

    const animate = useCallback(() => {
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    const canvas = canvasRef.current;

    if (!analyser || !dataArray || !canvas) {
      return;
    }

    const audioCtx = audioCtxRef.current;
    if (!audioCtx || audioCtx.state !== "running") {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    analyser.getByteFrequencyData(dataArray);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;
    const totalBarWidth = barWidth + barSpacing;
    const totalWidth = barCount * totalBarWidth - barSpacing;
    const startX = (logicalWidth - totalWidth) / 2;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * dataArray.length);
      const amplitude = dataArray[dataIndex] / 255;
      const smoothed = Math.pow(amplitude, 0.7);
      const barHeight =
        Math.max(minHeight, minHeight + (maxHeight - minHeight) * smoothed) |
        0;
      const x = startX + i * totalBarWidth;
      const y = logicalHeight - barHeight;
      const gradient = ctx.createLinearGradient(
        x * dpr,
        y * dpr,
        x * dpr,
        logicalHeight * dpr
      );
      gradient.addColorStop(0, "#FF914D");
      gradient.addColorStop(0.6, "#FF914D");
      gradient.addColorStop(1, "rgba(255, 145, 77, 0.6)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    animationRef.current = requestAnimationFrame(animate);
  }, [barCount, barWidth, barSpacing, maxHeight, minHeight]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = barCount * (barWidth + barSpacing) - barSpacing + 20;
    const logicalHeight = maxHeight + 8;

    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    canvas.width = Math.round(logicalWidth * dpr);
    canvas.height = Math.round(logicalHeight * dpr);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr); 
    }
  }, [barCount, barWidth, barSpacing, maxHeight]);

  useEffect(() => {
    if (audioElement) {
      attachToElement(audioElement);
    } else {
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {}
        sourceRef.current = null;
      }
      attachedElementRef.current = null;
      setIsActive(false);
    }
  }, [audioElement, attachToElement]);

  useEffect(() => {
    const el = attachedElementRef.current;
    if (!el) return;

    const onPlay = async () => {
      try {
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === "suspended") {
          await ctx.resume();
        }
      } catch {}
      if (analyserRef.current && dataArrayRef.current) {
        if (!animationRef.current) {
          animationRef.current = requestAnimationFrame(animate);
        }
      }
    };

    const onPause = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const logicalWidth = canvas.clientWidth;
          const totalBarWidth = barWidth + barSpacing;
          const totalWidth = barCount * totalBarWidth - barSpacing;
          const startX = (logicalWidth - totalWidth) / 2;
          for (let i = 0; i < barCount; i++) {
            const x = startX + i * totalBarWidth;
            const y = canvas.clientHeight - minHeight;
            ctx.fillStyle = "rgba(255, 145, 77, 0.3)";
            ctx.fillRect(x, y, barWidth, minHeight);
          }
        }
      }
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);

    if (!el.paused) {
      onPlay();
    } else {
      onPause();
    }

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause);
    };
  }, [animate, barCount, barWidth, barSpacing, maxHeight, minHeight]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [resizeCanvas]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      try {
        if (sourceRef.current) {
          sourceRef.current.disconnect();
          sourceRef.current = null;
        }
        if (analyserRef.current) {
          analyserRef.current.disconnect();
          analyserRef.current = null;
        }
        if (audioCtxRef.current) {
          audioCtxRef.current.close().catch(() => {});
          audioCtxRef.current = null;
        }
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!isActive && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const logicalWidth = canvas.clientWidth;
        const totalBarWidth = barWidth + barSpacing;
        const totalWidth = barCount * totalBarWidth - barSpacing;
        const startX = (logicalWidth - totalWidth) / 2;
        for (let i = 0; i < barCount; i++) {
          const x = startX + i * totalBarWidth;
          const y = canvas.clientHeight - minHeight;
          ctx.fillStyle = "rgba(255, 145, 77, 0.3)";
          ctx.fillRect(x, y, barWidth, minHeight);
        }
      }
    }
  }, [isActive, barCount, barWidth, barSpacing, minHeight]);

  const canvasWidth = barCount * (barWidth + barSpacing) - barSpacing + 20;
  const canvasHeight = maxHeight + 8;

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={Math.round(canvasWidth * (window.devicePixelRatio || 1))}
        height={Math.round(canvasHeight * (window.devicePixelRatio || 1))}
        className="block"
        style={{
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))",
        }}
      />
    </div>
  );
};

export default AudioVisualizer;
