import { useRef, useEffect, useCallback, useState } from 'react';
import { RadioStation } from '@/types/index';
import * as Tone from 'tone';
import Hls from 'hls.js';

interface UseEnhancedAudioPlayerOptions {
  volume?: number;
  muted?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
  preferredLatency?: 'low' | 'normal' | 'high'; // New option
}

interface UseEnhancedAudioPlayerReturn {
  audioRef: React.RefObject<HTMLAudioElement>;
  audioElement: HTMLAudioElement | null;
  isLoading: boolean;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  error: string | null;
  streamType: 'hls' | 'tone' | 'html5' | null;
  latency: number; // Estimated latency in seconds
  play: (station?: RadioStation) => Promise<void>;
  pause: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  load: (station: RadioStation) => void;
}

type StreamType = 'hls' | 'tone' | 'html5';

export const useEnhancedAudioPlayer = (
  options: UseEnhancedAudioPlayerOptions = {}
): UseEnhancedAudioPlayerReturn => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  // Enhanced state
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<StreamType | null>(null);
  const [latency, setLatency] = useState(0);
  
  // Player instances
  const hlsRef = useRef<Hls | null>(null);
  const tonePlayerRef = useRef<Tone.Player | null>(null);
  const currentStationRef = useRef<RadioStation | null>(null);
  const loadStartTimeRef = useRef<number>(0);

  // Detect stream type from URL
  const detectStreamType = useCallback((url: string): StreamType => {
    const urlLower = url.toLowerCase();
    
    // Check for HLS streams
    if (urlLower.includes('.m3u8') || urlLower.includes('hls')) {
      return 'hls';
    }
    
    // Check for high-quality streams that benefit from Web Audio API
    if (urlLower.includes('stream') && 
        (urlLower.includes('320') || urlLower.includes('256'))) {
      return 'tone';
    }
    
    // Default to HTML5
    return 'html5';
  }, []);

  // HLS Player Implementation
  const setupHLSPlayer = useCallback(async (url: string) => {
    if (!audioRef.current || !Hls.isSupported()) {
      throw new Error('HLS not supported');
    }

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    const hls = new Hls({
      // Low latency configuration
      lowLatencyMode: true,
      backBufferLength: options.preferredLatency === 'low' ? 5 : 10,
      maxBufferLength: options.preferredLatency === 'low' ? 10 : 30,
      maxMaxBufferLength: options.preferredLatency === 'low' ? 15 : 60,
      
      // Fragment loading optimization
      fragLoadingTimeOut: 5000,
      manifestLoadingTimeOut: 5000,
      levelLoadingTimeOut: 5000,
      
      // Start level (quality)
      startLevel: -1, // Auto
      
      // Advanced settings
      enableWorker: true,
      enableSoftwareAES: true,
      
      // Debug (remove in production)
      debug: process.env.NODE_ENV === 'development',
    });

    hlsRef.current = hls;

    // HLS event handlers
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const loadTime = Date.now() - loadStartTimeRef.current;
      setLatency(loadTime / 1000);
      setIsLoading(false);
      options.onCanPlay?.();
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      console.error('HLS Error:', data);
      if (data.fatal) {
        setError(`HLS Error: ${data.type} - ${data.details}`);
        options.onError?.(`HLS Error: ${data.type}`);
      }
    });

    hls.loadSource(url);
    hls.attachMedia(audioRef.current);
    
    setStreamType('hls');
  }, [options]);

  // Tone.js Player Implementation
  const setupTonePlayer = useCallback(async (url: string) => {
    try {
      // Ensure Tone.js is ready
      if (Tone.context.state === 'suspended') {
        await Tone.start();
      }

      // Cleanup previous instance
      if (tonePlayerRef.current) {
        tonePlayerRef.current.dispose();
      }

      const player = new Tone.Player({
        url,
        autostart: false,
        loop: false,
        // Minimize buffer for lower latency
        fadeIn: 0,
        fadeOut: 0.1,
      }).toDestination();

      // Set volume
      player.volume.value = Tone.gainToDb(options.volume || 0.7);

      // Wait for buffer to load
      await Tone.loaded();
      
      const loadTime = Date.now() - loadStartTimeRef.current;
      setLatency(loadTime / 1000);
      
      tonePlayerRef.current = player;
      setStreamType('tone');
      setIsLoading(false);
      options.onCanPlay?.();
      
    } catch (error) {
      console.error('Tone Player Error:', error);
      throw new Error('Failed to setup Tone.js player');
    }
  }, [options]);

  // Enhanced HTML5 setup with optimizations
  const setupHTML5Player = useCallback((url: string) => {
    const audio = audioRef.current;
    if (!audio) throw new Error('Audio element not available');

    // Optimize for live streaming
    audio.preload = 'none'; // Don't preload for live streams
    audio.crossOrigin = 'anonymous';
    
    // Low latency attributes (if supported)
    if ('mozAudioChannelType' in audio) {
      (audio as any).mozAudioChannelType = 'content';
    }
    
    // Set source
    if (audio.src !== url) {
      audio.src = url;
      audio.load();
    }

    setStreamType('html5');
  }, []);

  // Smart player selection and setup
  const load = useCallback(async (station: RadioStation) => {
    if (!audioRef.current) return;

    setError(null);
    setIsLoading(true);
    loadStartTimeRef.current = Date.now();
    currentStationRef.current = station;
    
    const audioUrl = station.url_resolved || station.url;
    const preferredType = detectStreamType(audioUrl);
    
    console.log(`🎵 Loading ${station.name} as ${preferredType} stream`);
    
    try {
      switch (preferredType) {
        case 'hls':
          if (Hls.isSupported()) {
            await setupHLSPlayer(audioUrl);
            break;
          }
          // Fall through to tone if HLS not supported
          
        case 'tone':
          try {
            await setupTonePlayer(audioUrl);
            break;
          } catch (toneError) {
            console.warn('Tone.js failed, falling back to HTML5:', toneError);
            // Fall through to HTML5
          }
          
        case 'html5':
        default:
          setupHTML5Player(audioUrl);
          // For HTML5, we need to wait for canplay event
          const audio = audioRef.current;
          if (audio) {
            const handleCanPlay = () => {
              const loadTime = Date.now() - loadStartTimeRef.current;
              setLatency(loadTime / 1000);
              setIsLoading(false);
              options.onCanPlay?.();
              audio.removeEventListener('canplay', handleCanPlay);
            };
            audio.addEventListener('canplay', handleCanPlay);
          }
          break;
      }
    } catch (error) {
      console.error('Failed to load audio:', error);
      setError(error instanceof Error ? error.message : 'Failed to load audio');
      setIsLoading(false);
      options.onError?.(error instanceof Error ? error.message : 'Failed to load audio');
    }
  }, [detectStreamType, setupHLSPlayer, setupTonePlayer, setupHTML5Player, options]);

  // Enhanced play method
  const play = useCallback(async (station?: RadioStation): Promise<void> => {
    if (station) {
      await load(station);
      // Wait a bit for the stream to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      switch (streamType) {
        case 'hls':
        case 'html5':
          if (audioRef.current) {
            await audioRef.current.play();
          }
          break;
          
        case 'tone':
          if (tonePlayerRef.current) {
            tonePlayerRef.current.start();
          }
          break;
      }
      
      setIsPlaying(true);
      options.onPlay?.();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to play audio';
      setError(errorMessage);
      options.onError?.(errorMessage);
      throw error;
    }
  }, [streamType, load, options]);

  // Enhanced pause method
  const pause = useCallback(() => {
    switch (streamType) {
      case 'hls':
      case 'html5':
        if (audioRef.current) {
          audioRef.current.pause();
        }
        break;
        
      case 'tone':
        if (tonePlayerRef.current) {
          tonePlayerRef.current.stop();
        }
        break;
    }
    
    setIsPlaying(false);
    options.onPause?.();
  }, [streamType, options]);

  // Enhanced stop method
  const stop = useCallback(() => {
    switch (streamType) {
      case 'hls':
      case 'html5':
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        break;
        
      case 'tone':
        if (tonePlayerRef.current) {
          tonePlayerRef.current.stop();
        }
        break;
    }
    
    setIsPlaying(false);
    setCurrentTime(0);
  }, [streamType]);

  // Enhanced volume control
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    
    switch (streamType) {
      case 'hls':
      case 'html5':
        if (audioRef.current) {
          audioRef.current.volume = clampedVolume;
        }
        break;
        
      case 'tone':
        if (tonePlayerRef.current) {
          tonePlayerRef.current.volume.value = Tone.gainToDb(clampedVolume);
        }
        break;
    }
  }, [streamType]);

  // Enhanced mute control
  const setMuted = useCallback((muted: boolean) => {
    switch (streamType) {
      case 'hls':
      case 'html5':
        if (audioRef.current) {
          audioRef.current.muted = muted;
        }
        break;
        
      case 'tone':
        if (tonePlayerRef.current) {
          tonePlayerRef.current.mute = muted;
        }
        break;
    }
  }, [streamType]);

  // Setup audio element reference
  useEffect(() => {
    if (audioRef.current && audioRef.current !== audioElement) {
      setAudioElement(audioRef.current);
    }
  }, [audioElement]);

  // Enhanced audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      setIsPlaying(true);
      options.onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      options.onPause?.();
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      loadStartTimeRef.current = Date.now();
      options.onLoadStart?.();
    };

    const handleError = (event: Event) => {
      const target = event.target as HTMLAudioElement;
      let errorMessage = 'Audio playback error';
      
      if (target?.error) {
        switch (target.error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error - check internet connection';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Audio format not supported';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Stream source not available';
            break;
          default:
            errorMessage = 'Unknown audio error';
        }
      }

      setError(errorMessage);
      setIsLoading(false);
      setIsPlaying(false);
      options.onError?.(errorMessage);
    };

    // Add all event listeners
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('error', handleError);
    };
  }, [options]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      if (tonePlayerRef.current) {
        tonePlayerRef.current.dispose();
      }
    };
  }, []);

  return {
    audioRef,
    audioElement,
    isLoading,
    isPlaying,
    duration,
    currentTime,
    error,
    streamType,
    latency,
    play,
    pause,
    stop,
    setVolume,
    setMuted,
    load,
  };
};