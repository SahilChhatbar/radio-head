// File: components/ImmersiveVisualizer.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button, Dialog, Flex, Text } from '@radix-ui/themes';
import { Maximize2, X } from 'lucide-react';
import { useRadioStore } from '@/store/useRadiostore';

// Global caches to avoid duplicate source creation
let globalAudioContext: AudioContext | null = null;
let globalAnalyser: AnalyserNode | null = null;
let globalSourceNode: AudioNode | null = null;
const mediaElementSourceMap = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

const createAnalyserForContext = (ctx: AudioContext) => {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  analyser.minDecibels = -90;
  analyser.maxDecibels = -10;
  return analyser;
};

const VisualizerCanvas: React.FC<{
  isActive: boolean;
  streamType: 'hls' | 'tone' | null;
  audioRefObject?: React.RefObject<HTMLAudioElement | null>;
}> = ({ isActive, streamType, audioRefObject }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const [audioStatus, setAudioStatus] = useState('Initializing...');
  const [displayStreamType, setDisplayStreamType] = useState('unknown');
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const ensureAnalyser = useCallback((ctx: AudioContext) => {
    if (!globalAnalyser || globalAudioContext !== ctx) {
      try {
        if (globalAnalyser) {
          try { globalAnalyser.disconnect(); } catch (_) {}
        }
      } catch (e) {}
      globalAudioContext = ctx;
      globalAnalyser = createAnalyserForContext(ctx);
    }
    return globalAnalyser!;
  }, []);

  useEffect(() => {
    if (!isActive) return;
    let mounted = true;
    let attempts = 0;
    const maxAttempts = 12;

    const probe = () => {
      if (!mounted) return;
      attempts++;
      const el = audioRefObject?.current ?? document.querySelector<HTMLAudioElement>('audio');
      if (el) {
        setAudioElement(el);
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    };

    probe();
    const interval = window.setInterval(probe, 500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isActive, audioRefObject]);

  const connectAudioSource = useCallback((): boolean => {
    try {
      const attachAnalyserTo = (sourceNode: AudioNode, ctx: AudioContext) => {
        const analyser = ensureAnalyser(ctx);
        if (globalSourceNode && globalSourceNode !== sourceNode) {
          try { globalSourceNode.disconnect(); } catch (_) {}
        }
        try {
          sourceNode.connect(analyser);
        } catch (err) {}
        try {
          analyser.connect(ctx.destination);
        } catch (err) {}
        globalSourceNode = sourceNode;
        return true;
      };

      // HTMLMediaElement case (HLS/native)
      if (streamType === 'hls' && audioElement) {
        setDisplayStreamType('HTMLAudio');
        setAudioStatus('Attempting HTMLMediaElement tap...');
        const ctx = globalAudioContext ?? new (window.AudioContext || (window as any).webkitAudioContext)();
        globalAudioContext = ctx;

        let sourceNode = mediaElementSourceMap.get(audioElement);
        if (!sourceNode) {
          try {
            sourceNode = ctx.createMediaElementSource(audioElement);
            mediaElementSourceMap.set(audioElement, sourceNode);
            console.log('Visualizer: created MediaElementSource for audio element');
          } catch (err) {
            console.warn('Visualizer: createMediaElementSource failed', err);
            setAudioStatus('❌ Could not create media source');
            return false;
          }
        } else {
          console.log('Visualizer: reusing existing MediaElementSource');
        }

        attachAnalyserTo(sourceNode, ctx);
        setAudioStatus('✅ Connected (MediaElement)');
        return true;
      }

      // Tone.js case
      if (streamType === 'tone' && (window as any).Tone) {
        try {
          const Tone = (window as any).Tone;
          const toneCtx: AudioContext | undefined = Tone.context || Tone.getContext?.();
          if (!toneCtx) {
            setAudioStatus('⚠️ Tone context missing');
            return false;
          }
          globalAudioContext = toneCtx;
          const analyser = ensureAnalyser(toneCtx);

          const dest = Tone.getDestination ? Tone.getDestination() : Tone.Destination || Tone.destination;
          const destNode = dest?.input || dest?.node || dest;
          if (destNode && typeof destNode.connect === 'function') {
            try {
              try { (destNode as any).disconnect(analyser); } catch (_) {}
              (destNode as any).connect(analyser);
              analyser.connect(toneCtx.destination);
              globalSourceNode = destNode as any;
              setAudioStatus('✅ Connected (Tone.js)');
              setDisplayStreamType('Tone.js');
              return true;
            } catch (err) {
              console.warn('Visualizer: Tone attach failed', err);
            }
          }
          setAudioStatus('⚠️ Tone: destination not tappable');
          return false;
        } catch (err) {
          console.warn('Visualizer: Tone connection error', err);
          setAudioStatus('❌ Tone connect failed');
          return false;
        }
      }

      setAudioStatus('⚠️ No audio source matched yet');
      return false;
    } catch (err) {
      console.error('Visualizer: connectAudioSource exception', err);
      setAudioStatus('❌ Connection error');
      return false;
    }
  }, [audioElement, streamType, ensureAnalyser]);

  useEffect(() => {
    if (!isActive) return;
    let attempts = 0;
    const maxAttempts = 10;
    let timer: number | undefined;

    const tryAttach = () => {
      attempts++;
      const ok = connectAudioSource();
      if (!ok && attempts < maxAttempts) {
        timer = window.setTimeout(tryAttach, 600);
      }
    };

    tryAttach();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isActive, audioElement, streamType, connectAudioSource]);

  useEffect(() => {
    if (!isActive || !globalAnalyser) return;
    const analyser = globalAnalyser;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isActive) return;
      const WIDTH = window.innerWidth;
      const HEIGHT = window.innerHeight;
      const centerX = WIDTH / 2;
      const centerY = HEIGHT / 2;

      analyser.getByteFrequencyData(dataArray);

      // Background gradient
      const bgGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, Math.max(WIDTH, HEIGHT) / 2
      );
      bgGradient.addColorStop(0, '#16283a');
      bgGradient.addColorStop(1, '#0c1521');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const RADIUS = Math.min(WIDTH, HEIGHT) * 0.25;
      const BARS = 180;
      ctx.save();
      ctx.translate(centerX, centerY);

      const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
      const pulse = 1 + (avg / 255) * 0.2;

      ctx.beginPath();
      ctx.arc(0, 0, RADIUS * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 145, 77, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      for (let i = 0; i < BARS; i++) {
        const index = Math.floor((i / BARS) * bufferLength);
        const value = dataArray[index] || 0;
        const percent = value / 255;
        const barHeight = percent * RADIUS * 1.5 * pulse;
        const innerR = RADIUS * pulse;
        const outerR = innerR + barHeight;
        const angle = (i / BARS) * (Math.PI * 2);

        const x1 = innerR * Math.cos(angle);
        const y1 = innerR * Math.sin(angle);
        const x2 = outerR * Math.cos(angle);
        const y2 = outerR * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        if (value > 200) {
          ctx.strokeStyle = '#ff914d';
          ctx.lineWidth = 3;
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#ff914d';
        } else if (value > 150) {
          ctx.strokeStyle = '#ff9d5c';
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#ff914d';
        } else {
          ctx.strokeStyle = `rgba(255, 145, 77, ${0.4 + percent * 0.6})`;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.restore();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: '#16283a',
        }}
      />
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: '#ff914d',
        fontSize: '12px',
        fontFamily: 'monospace',
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '10px 15px',
        borderRadius: '6px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 145, 77, 0.3)',
      }}>
        <div><strong>Status:</strong> {audioStatus}</div>
        <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>
          <strong>Type:</strong> {displayStreamType}
        </div>
      </div>
    </>
  );
};

const ImmersiveVisualizer: React.FC<{
  currentStation: number | string;
  streamType?: 'hls' | 'tone' | null;
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
          style={{
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: '100vw',
            height: '100vh',
            padding: 0,
            position: 'fixed',
            top: 0,
            left: 0,
            background: '#16283a',
            border: 'none',
            overflow: 'hidden',
          }}
        >
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              zIndex: 1000,
              background: 'rgba(255, 145, 77, 0.2)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <X size={24} color="#FF914D" />
          </Button>

          <VisualizerCanvas
            isActive={isOpen}
            streamType={streamType ?? null}
            audioRefObject={audioRef}
          />

          {currentStationData && (
            <Flex
              direction="column"
              align="center"
              justify="center"
              style={{
                position: 'absolute',
                bottom: '40px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 999,
                background: 'rgba(12, 21, 33, 0.8)',
                backdropFilter: 'blur(10px)',
                padding: '20px 40px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 145, 77, 0.3)',
                minWidth: '300px',
                maxWidth: '600px',
              }}
              gap="2"
            >
              <Text size="5" weight="bold" style={{ color: '#FAF9F6', textAlign: 'center' }}>
                {currentStationData.name || 'Unknown Station'}
              </Text>
              {currentStationData.country && (
                <Text size="3" style={{ color: '#ff914d', opacity: 0.9 }}>
                  {currentStationData.country}
                </Text>
              )}
              <Text size="2" style={{ color: '#ff914d', opacity: 0.7, marginTop: '8px' }}>
                Press ESC or click X to exit
              </Text>
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
};

export default ImmersiveVisualizer;
