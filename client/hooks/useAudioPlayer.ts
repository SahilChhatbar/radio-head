// File: hooks/useEnhancedAudioPlayer.ts
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

const stopAllGlobalAudio = () => {
  console.log("🛑 Stopping all global audio instances (native/Tone/HLS)...");
  if (globalAudioInstance.hls) {
    try { globalAudioInstance.hls.destroy(); }
    catch (e) { console.warn("Error stopping HLS:", e); }
    globalAudioInstance.hls = null;
  }
  if (globalAudioInstance.tone) {
    try { globalAudioInstance.tone.stop(); globalAudioInstance.tone.dispose(); }
    catch (e) { console.warn("Error stopping Tone:", e); }
    globalAudioInstance.tone = null;
  }
  if (globalAudioInstance.audio) {
    try {
      globalAudioInstance.audio.pause();
      globalAudioInstance.audio.currentTime = 0;
      globalAudioInstance.audio.src = "";
      globalAudioInstance.audio.load();
    } catch (e) { console.warn("Error stopping audio element:", e); }
    globalAudioInstance.audio = null;
  }
};

const exposeToneContext = () => {
  if (typeof window !== 'undefined' && Tone) {
    try {
      (window as any).Tone = Tone;
      console.log('🎵 Tone.js context exposed:', {
        context: !!Tone.context,
        destination: !!Tone.getDestination?.(),
      });
      return true;
    } catch (error) {
      console.warn('Could not expose Tone context:', error);
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

  // -------------------------
  // apply volume/muted to players
  // -------------------------
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    volumeRef.current = clampedVolume;
    console.log(`🔊 setVolume -> ${clampedVolume} (muted=${mutedRef.current})`);
    const effective = mutedRef.current ? 0 : clampedVolume;
    try {
      if (audioRef.current) audioRef.current.volume = effective;
      if (tonePlayerRef.current) tonePlayerRef.current.volume.value = Tone.gainToDb(effective);
    } catch (err) {
      console.warn("Error applying volume:", err);
    }
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    console.log(`🔇 setMuted -> ${muted} (volume=${volumeRef.current})`);
    const effective = muted ? 0 : volumeRef.current;
    try {
      if (audioRef.current) { audioRef.current.muted = muted; audioRef.current.volume = effective; }
      if (tonePlayerRef.current) { tonePlayerRef.current.mute = muted; tonePlayerRef.current.volume.value = Tone.gainToDb(effective); }
    } catch (err) {
      console.warn("Error applying mute:", err);
    }
  }, []);

  // sync incoming options -> apply to players (single source of truth: parent/store)
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
    if (codec === "flac" || codec === "wav" ||
        (HIGH_QUALITY_INDICATORS.some((indicator) => url.includes(indicator)) && (station.bitrate || 0) >= 256)) {
      return "tone";
    }
    return "hls";
  }, []);

  const setupHLSPlayer = useCallback(async (url: string) => {
    if (!audioRef.current || !Hls.isSupported()) throw new Error("HLS not supported");
    const hls = new Hls({ xhrSetup: (xhr) => xhr.setRequestHeader("User-Agent", "RadioVerse/1.0") });
    hlsRef.current = hls;
    globalAudioInstance.hls = hls;
    globalAudioInstance.audio = audioRef.current;

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const loadTime = Date.now() - loadStartTimeRef.current;
      setLatency(loadTime / 1000);
      // don't assume fully playable yet — let media 'canplay'/'playing' finalize it
      options.onCanPlay?.();
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      console.error("HLS Error:", data);
      if (data.fatal) {
        const errorMsg = `HLS Error: ${data.type} - ${data.details}`;
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
  }, [options]);

  const setupNativeAudioPlayer = useCallback(async (url: string) => {
    if (!audioRef.current) throw new Error("No audio element available for native playback");
    const audio = audioRef.current;
    audio.src = url;
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.volume = mutedRef.current ? 0 : volumeRef.current;
    audio.muted = mutedRef.current;

    try {
      // load() is synchronous in API but network fetch happens async; rely on media events
      audio.load();
      streamTypeRef.current = "hls";
      setStreamType("hls");
      setAudioElement(audio);
      globalAudioInstance.audio = audio;
    } catch (err) {
      console.error("Native audio load error:", err);
      throw err;
    }
  }, [options]);

  const setupTonePlayer = useCallback(async (url: string) => {
    try {
      if (Tone.context.state === "suspended") await Tone.start();
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
    } catch (error) {
      console.error("Tone Player Error:", error);
      throw new Error("Failed to setup Tone.js player");
    }
  }, [options]);

  const cleanup = useCallback(async () => {
    if (isCleaningUpRef.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
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
      } catch (e) { console.warn("Audio element cleanup error:", e); }
    }
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); hlsRef.current = null; }
      catch (e) { console.warn("HLS cleanup error:", e); }
    }
    if (tonePlayerRef.current) {
      try { tonePlayerRef.current.stop(); tonePlayerRef.current.dispose(); tonePlayerRef.current = null; }
      catch (e) { console.warn("Tone cleanup error:", e); }
    }
    setIsPlaying(false);
    streamTypeRef.current = null;
    setStreamType(null);
    isCleaningUpRef.current = false;
  }, []);

  const pause = useCallback(() => {
    try {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch (e) { console.warn("Error pausing audio element:", e); }
      }
      if (tonePlayerRef.current) {
        try { tonePlayerRef.current.stop(); } catch (e) { console.warn("Error stopping Tone player:", e); }
      }
      setIsPlaying(false);
      options.onPause?.();
    } catch (error) {
      console.error("Error pausing audio:", error);
      setIsPlaying(false);
      options.onPause?.();
    }
  }, [options]);

  const load = useCallback(
    async (station: RadioStation): Promise<"hls" | "tone"> => {
      if (!station) throw new Error("No station provided");
      await cleanup();
      await new Promise((resolve) => setTimeout(resolve, 160));

      setError(null);
      setIsLoading(true);
      loadStartTimeRef.current = Date.now();
      currentStationRef.current = station;

      const audioUrl = station.url_resolved || station.url;
      const preferredType = detectStreamType(station);

      try {
        if (preferredType === "tone") {
          await setupTonePlayer(audioUrl);
          return "tone";
        } else {
          const isLikelyHls = HLS_INDICATORS.some((i) => (audioUrl || '').toLowerCase().includes(i));
          if (isLikelyHls && Hls.isSupported()) {
            await setupHLSPlayer(audioUrl);
            return "hls";
          } else {
            await setupNativeAudioPlayer(audioUrl);
            return "hls";
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load audio";
        setError(errorMessage);
        setIsLoading(false);
        options.onError?.(errorMessage);
        throw error;
      }
    },
    [cleanup, detectStreamType, setupHLSPlayer, setupNativeAudioPlayer, setupTonePlayer, options]
  );

  const play = useCallback(
    async (station?: RadioStation): Promise<void> => {
      try {
        let currentStreamType = streamTypeRef.current;
        if (station && station.stationuuid !== currentStationRef.current?.stationuuid) {
          currentStreamType = await load(station);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        switch (currentStreamType) {
          case "hls":
            if (audioRef.current) {
              audioRef.current.volume = mutedRef.current ? 0 : volumeRef.current;
              audioRef.current.muted = mutedRef.current;
              // best-effort: call onLoadStart
              setIsLoading(true);
              options.onLoadStart?.();
              await audioRef.current.play();
              // once play() resolves, the media typically is playing or will fire 'playing'
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
            console.warn("No stream type available for playback");
            break;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to play audio";
        setError(errorMessage);
        options.onError?.(errorMessage);
        throw error;
      }
    },
    [load, options]
  );

  const stop = useCallback(() => {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      if (tonePlayerRef.current) tonePlayerRef.current.stop();
      setIsPlaying(false);
      setCurrentTime(0);
    } catch (error) { console.error("Error stopping audio:", error); }
  }, []);

  // Keep audioElement state and global refs in sync
  useEffect(() => {
    if (audioRef.current && audioRef.current !== audioElement) {
      setAudioElement(audioRef.current);
      globalAudioInstance.audio = audioRef.current;
    }
  }, [audioElement]);

  // --- Crucial: media event listeners for HLS/native
  useEffect(() => {
    const audio = audioRef.current;
    // we only care for audio events when using the HTMLMediaElement (HLS/native)
    if (!audio) return;

    const handlePlay = () => {
      // browser 'play' sometimes fires before actual playback starts
      setIsPlaying(true);
      options.onPlay?.();
      // do not set isLoading=false here (wait for 'playing' / 'canplay')
    };
    const handlePlaying = () => {
      // media has started rendering; loading is finished
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
      // buffering
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
          case MediaError.MEDIA_ERR_NETWORK: errorMessage = "Network error - check internet connection"; break;
          case MediaError.MEDIA_ERR_DECODE: errorMessage = "Audio format not supported"; break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMessage = "Stream source not available"; break;
          default: errorMessage = "Unknown audio error";
        }
      }
      setError(errorMessage);
      setIsLoading(false);
      setIsPlaying(false);
      options.onError?.(errorMessage);
    };

    // attach
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
      if (hlsRef.current) hlsRef.current.destroy();
      if (tonePlayerRef.current) tonePlayerRef.current.dispose();
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
