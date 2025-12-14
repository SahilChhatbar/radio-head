import { useRef, useEffect, useCallback, useState } from "react";
import { RadioStation } from "@/types/index";
import * as Tone from "tone";
import Hls from "hls.js";

interface UseEnhancedAudioPlayerOptions {
  volume?: number;
  muted?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
  preferredLatency?: "low" | "normal" | "high";
}

interface UseEnhancedAudioPlayerReturn {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  audioElement: HTMLAudioElement | null;
  isLoading: boolean;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  error: string | null;
  streamType: "hls" | "tone" | null;
  latency: number;
  play: (station?: RadioStation) => Promise<void>;
  pause: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  load: (station: RadioStation) => Promise<"hls" | "tone">;
}

export type StreamType = "hls" | "tone";

const HLS_INDICATORS = [
  ".m3u8", "m3u8", "/hls/", "/hls-", "hls.", "apple",
  "manifest.m3u", "playlist.m3u", "/live/", "stream.m3u",
];
const HIGH_QUALITY_INDICATORS = ["320", "256", "flac", "wav"];

let globalAudioInstance: {
  hls: Hls | null;
  tone: Tone.Player | null;
  audio: HTMLAudioElement | null;
} = {
  hls: null,
  tone: null,
  audio: null,
};

const stopAllGlobalAudio = (): void => {
  if (globalAudioInstance.hls) {
    try {
      globalAudioInstance.hls.destroy();
    } catch {
      // HLS instance may already be destroyed during cleanup
    }
    globalAudioInstance.hls = null;
  }

  if (globalAudioInstance.tone) {
    try {
      globalAudioInstance.tone.stop();
      globalAudioInstance.tone.dispose();
    } catch {
      // Tone player may already be disposed during cleanup
    }
    globalAudioInstance.tone = null;
  }

  if (globalAudioInstance.audio) {
    try {
      globalAudioInstance.audio.pause();
      globalAudioInstance.audio.currentTime = 0;
      globalAudioInstance.audio.src = "";
      globalAudioInstance.audio.load();
    } catch {
      // Audio element may be unmounted during cleanup
    }
    globalAudioInstance.audio = null;
  }
};

const exposeToneContext = (): boolean => {
  if (typeof window !== 'undefined' && Tone) {
    try {
      (window as any).Tone = Tone;
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

export const useEnhancedAudioPlayer = (
  options: UseEnhancedAudioPlayerOptions = {}
): UseEnhancedAudioPlayerReturn => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<StreamType | null>(null);
  const [latency, setLatency] = useState(0);

  const hlsRef = useRef<Hls | null>(null);
  const tonePlayerRef = useRef<Tone.Player | null>(null);
  const currentStationRef = useRef<RadioStation | null>(null);
  const loadStartTimeRef = useRef<number>(0);
  const isCleaningUpRef = useRef(false);
  const volumeRef = useRef(options.volume ?? 0.7);
  const mutedRef = useRef(options.muted ?? false);
  const streamTypeRef = useRef<StreamType | null>(null);

  useEffect(() => {
    exposeToneContext();
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    volumeRef.current = clampedVolume;
    const effective = mutedRef.current ? 0 : clampedVolume;

    if (audioRef.current) {
      audioRef.current.volume = effective;
    }
    if (tonePlayerRef.current) {
      tonePlayerRef.current.volume.value = Tone.gainToDb(effective);
    }
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    const effective = muted ? 0 : volumeRef.current;

    if (audioRef.current) {
      audioRef.current.muted = muted;
      audioRef.current.volume = effective;
    }
    if (tonePlayerRef.current) {
      tonePlayerRef.current.mute = muted;
      tonePlayerRef.current.volume.value = Tone.gainToDb(effective);
    }
  }, []);

  useEffect(() => {
    if (typeof options.volume === "number") {
      setVolume(options.volume);
    }
  }, [options.volume, setVolume]);

  useEffect(() => {
    if (typeof options.muted === "boolean") {
      setMuted(options.muted);
    }
  }, [options.muted, setMuted]);

  const detectStreamType = useCallback((station: RadioStation): StreamType => {
    const url = (station.url_resolved || station.url || "").toLowerCase();
    const codec = station.codec?.toLowerCase() || "";

    if (HLS_INDICATORS.some((indicator) => url.includes(indicator))) {
      return "hls";
    }
    if (
      codec === "flac" ||
      codec === "wav" ||
      (HIGH_QUALITY_INDICATORS.some((indicator) => url.includes(indicator)) &&
        (station.bitrate || 0) >= 256)
    ) {
      return "tone";
    }
    return "hls";
  }, []);

  const setupHLSPlayer = useCallback(
    async (url: string): Promise<void> => {
      if (!audioRef.current) {
        throw new Error("Audio element not available");
      }
      if (!Hls.isSupported()) {
        throw new Error("HLS not supported in this browser");
      }

      const hls = new Hls({
        xhrSetup: (xhr) => xhr.setRequestHeader("User-Agent", "RadioVerse/1.0"),
      });

      hlsRef.current = hls;
      globalAudioInstance.hls = hls;
      globalAudioInstance.audio = audioRef.current;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const loadTime = Date.now() - loadStartTimeRef.current;
        setLatency(loadTime / 1000);
        options.onCanPlay?.();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          const errorMsg = `Stream error: ${data.type} - ${data.details}`;
          setError(errorMsg);
          options.onError?.(errorMsg);
        }
      });

      hls.loadSource(url);
      hls.attachMedia(audioRef.current);
      audioRef.current.volume = mutedRef.current ? 0 : volumeRef.current;
      audioRef.current.muted = mutedRef.current;

      streamTypeRef.current = "hls";
      setStreamType("hls");
      setAudioElement(audioRef.current);
    },
    [options]
  );

  const setupNativeAudioPlayer = useCallback(
    async (url: string): Promise<void> => {
      if (!audioRef.current) {
        throw new Error("Audio element not available");
      }

      const audio = audioRef.current;
      audio.src = url;
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      audio.volume = mutedRef.current ? 0 : volumeRef.current;
      audio.muted = mutedRef.current;

      audio.load();
      streamTypeRef.current = "hls";
      setStreamType("hls");
      setAudioElement(audio);
      globalAudioInstance.audio = audio;
    },
    []
  );

  const setupTonePlayer = useCallback(
    async (url: string): Promise<void> => {
      if (Tone.context.state === "suspended") {
        await Tone.start();
      }

      Tone.context.lookAhead = 0.1;
      Tone.context.latencyHint = "playback";

      const player = new Tone.Player({
        url,
        autostart: false,
        loop: false,
        fadeIn: 0,
        fadeOut: 0.05,
        playbackRate: 1,
      });

      const effectiveVolume = mutedRef.current ? 0 : volumeRef.current;
      player.volume.value = Tone.gainToDb(effectiveVolume);
      player.mute = mutedRef.current;
      player.toDestination();

      await Tone.loaded();

      const loadTime = Date.now() - loadStartTimeRef.current;
      setLatency(loadTime / 1000);

      tonePlayerRef.current = player;
      globalAudioInstance.tone = player;
      streamTypeRef.current = "tone";
      setStreamType("tone");

      exposeToneContext();
      setIsLoading(false);
      options.onCanPlay?.();
    },
    [options]
  );

  const cleanup = useCallback(async (): Promise<void> => {
    if (isCleaningUpRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return;
    }

    isCleaningUpRef.current = true;
    stopAllGlobalAudio();

    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = "";
        audioRef.current.load();
        audioRef.current.removeAttribute("src");
      } catch {
        // Audio element may be unmounted during cleanup
      }
    }

    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        // HLS instance may already be destroyed
      }
      hlsRef.current = null;
    }

    if (tonePlayerRef.current) {
      try {
        tonePlayerRef.current.stop();
        tonePlayerRef.current.dispose();
      } catch {
        // Tone player may already be disposed
      }
      tonePlayerRef.current = null;
    }

    setIsPlaying(false);
    streamTypeRef.current = null;
    setStreamType(null);
    isCleaningUpRef.current = false;
  }, []);

  const pause = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (tonePlayerRef.current) {
        tonePlayerRef.current.stop();
      }
      setIsPlaying(false);
      options.onPause?.();
    } catch (error) {
      // Ensure consistent state even if pause fails
      setIsPlaying(false);
      options.onPause?.();
    }
  }, [options]);

  const load = useCallback(
    async (station: RadioStation): Promise<"hls" | "tone"> => {
      if (!station) {
        throw new Error("Station data is required");
      }

      await cleanup();
      await new Promise((resolve) => setTimeout(resolve, 160));

      setError(null);
      setIsLoading(true);
      loadStartTimeRef.current = Date.now();
      currentStationRef.current = station;

      const audioUrl = station.url_resolved || station.url;
      if (!audioUrl) {
        throw new Error("Station URL is not available");
      }

      const preferredType = detectStreamType(station);

      try {
        if (preferredType === "tone") {
          await setupTonePlayer(audioUrl);
          return "tone";
        } else {
          const isLikelyHls = HLS_INDICATORS.some((i) =>
            (audioUrl || "").toLowerCase().includes(i)
          );

          if (isLikelyHls && Hls.isSupported()) {
            await setupHLSPlayer(audioUrl);
            return "hls";
          } else {
            await setupNativeAudioPlayer(audioUrl);
            return "hls";
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load audio stream";
        setError(errorMessage);
        setIsLoading(false);
        options.onError?.(errorMessage);
        throw error;
      }
    },
    [
      cleanup,
      detectStreamType,
      setupHLSPlayer,
      setupNativeAudioPlayer,
      setupTonePlayer,
      options,
    ]
  );

  const play = useCallback(
    async (station?: RadioStation): Promise<void> => {
      try {
        let currentStreamType = streamTypeRef.current;

        if (
          station &&
          station.stationuuid !== currentStationRef.current?.stationuuid
        ) {
          currentStreamType = await load(station);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        switch (currentStreamType) {
          case "hls":
            if (audioRef.current) {
              audioRef.current.volume = mutedRef.current ? 0 : volumeRef.current;
              audioRef.current.muted = mutedRef.current;

              setIsLoading(true);
              options.onLoadStart?.();

              await audioRef.current.play();

              setIsLoading(false);
              setIsPlaying(true);
              options.onPlay?.();
            }
            break;

          case "tone":
            if (tonePlayerRef.current) {
              const effectiveVolume = mutedRef.current ? 0 : volumeRef.current;
              tonePlayerRef.current.volume.value = Tone.gainToDb(effectiveVolume);
              tonePlayerRef.current.mute = mutedRef.current;
              tonePlayerRef.current.start();

              setIsPlaying(true);
              options.onPlay?.();
              exposeToneContext();
            }
            break;

          default:
            throw new Error("No audio stream available for playback");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Playback failed";
        setError(errorMessage);
        setIsLoading(false);
        setIsPlaying(false);
        options.onError?.(errorMessage);
        throw error;
      }
    },
    [load, options]
  );

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (tonePlayerRef.current) {
      tonePlayerRef.current.stop();
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  useEffect(() => {
    if (audioRef.current && audioRef.current !== audioElement) {
      setAudioElement(audioRef.current);
      globalAudioInstance.audio = audioRef.current;
    }
  }, [audioElement]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      setIsPlaying(true);
      options.onPlay?.();
    };

    const handlePlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
      options.onCanPlay?.();
      options.onPlay?.();
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      options.onCanPlay?.();
    };

    const handleWaiting = () => {
      setIsLoading(true);
      options.onLoadStart?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      options.onPause?.();
    };

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);

    const handleDurationChange = () => setDuration(audio.duration || 0);

    const handleEnded = () => {
      setIsPlaying(false);
      options.onEnded?.();
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      loadStartTimeRef.current = Date.now();
      options.onLoadStart?.();
    };

    const handleError = (event: Event) => {
      const target = event.target as HTMLAudioElement;
      let errorMessage = "Audio playback error";

      if (target?.error) {
        switch (target.error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = "Network error - check internet connection";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = "Audio format not supported";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = "Stream source not available";
            break;
          default:
            errorMessage = "Unknown audio error";
        }
      }

      setError(errorMessage);
      setIsLoading(false);
      setIsPlaying(false);
      options.onError?.(errorMessage);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [options]);

  useEffect(() => {
    return () => {
      stopAllGlobalAudio();
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          // Already destroyed during unmount
        }
      }
      if (tonePlayerRef.current) {
        try {
          tonePlayerRef.current.dispose();
        } catch {
          // Already disposed during unmount
        }
      }
    };
  }, []);

  return {
    audioRef,
    audioElement: audioRef.current,
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