import { useRef, useEffect, useCallback, useState } from "react";
import { RadioStation } from "@/types/index";
import * as Tone from "tone";
import Hls from "hls.js";
import { Howl } from "howler";

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
  streamType: "hls" | "tone" | "howler" | null;
  latency: number;
  play: (station?: RadioStation) => Promise<void>;
  pause: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  load: (station: RadioStation) => void;
}

export type StreamType = "hls" | "tone" | "howler";

const HLS_INDICATORS = [
  ".m3u8",
  "m3u8",
  "/hls/",
  "/hls-",
  "hls.",
  "apple",
  "manifest.m3u",
  "playlist.m3u",
  "/live/",
  "stream.m3u",
];
const HIGH_QUALITY_INDICATORS = ["320", "256", "flac", "wav"];
const HOWLER_FORMATS = [
  "mp3",
  "mpeg",
  "opus",
  "ogg",
  "oga",
  "wav",
  "aac",
  "m4a",
  "mp4",
  "weba",
  "webm",
  "flac",
];
const STREAM_FORMATS = ["icecast", "shoutcast", "pls", "stream"];

// Global state to ensure only one audio stream plays at a time
let globalAudioInstance: {
  howl: Howl | null;
  hls: Hls | null;
  tone: Tone.Player | null;
  audio: HTMLAudioElement | null;
} = {
  howl: null,
  hls: null,
  tone: null,
  audio: null,
};

// Global cleanup function to stop all audio
const stopAllGlobalAudio = () => {
  console.log("🛑 Stopping all global audio instances...");

  if (globalAudioInstance.howl) {
    try {
      globalAudioInstance.howl.stop();
      globalAudioInstance.howl.unload();
    } catch (e) {
      console.warn("Error stopping Howl:", e);
    }
    globalAudioInstance.howl = null;
  }

  if (globalAudioInstance.hls) {
    try {
      globalAudioInstance.hls.destroy();
    } catch (e) {
      console.warn("Error stopping HLS:", e);
    }
    globalAudioInstance.hls = null;
  }

  if (globalAudioInstance.tone) {
    try {
      globalAudioInstance.tone.stop();
      globalAudioInstance.tone.dispose();
    } catch (e) {
      console.warn("Error stopping Tone:", e);
    }
    globalAudioInstance.tone = null;
  }

  if (globalAudioInstance.audio) {
    try {
      globalAudioInstance.audio.pause();
      globalAudioInstance.audio.currentTime = 0;
      globalAudioInstance.audio.src = "";
      globalAudioInstance.audio.load();
    } catch (e) {
      console.warn("Error stopping audio element:", e);
    }
  }
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
  const howlRef = useRef<Howl | null>(null);
  const currentStationRef = useRef<RadioStation | null>(null);
  const loadStartTimeRef = useRef<number>(0);
  const isCleaningUpRef = useRef(false);
  const volumeRef = useRef(options.volume ?? 0.7);
  const mutedRef = useRef(options.muted ?? false);

  // Keep refs in sync with options
  useEffect(() => {
    volumeRef.current = options.volume ?? 0.7;
  }, [options.volume]);

  useEffect(() => {
    mutedRef.current = options.muted ?? false;
  }, [options.muted]);

  const detectStreamType = useCallback((station: RadioStation): StreamType => {
    const url = (station.url_resolved || station.url).toLowerCase();
    const codec = station.codec?.toLowerCase() || "";

    // Check for HLS streams first (most specific)
    if (HLS_INDICATORS.some((indicator) => url.includes(indicator))) {
      console.log(`🎵 Detected HLS stream: ${station.name}`);
      return "hls";
    }

    // Check for high-quality lossless formats (use Tone.js for better quality)
    if (
      codec === "flac" ||
      codec === "wav" ||
      (HIGH_QUALITY_INDICATORS.some((indicator) => url.includes(indicator)) &&
        station.bitrate >= 256)
    ) {
      console.log(`🎵 Detected high-quality stream: ${station.name} (${codec})`);
      return "tone";
    }

    // Check for common streaming formats and codecs
    if (
      HOWLER_FORMATS.some((format) => url.includes(`.${format}`)) ||
      HOWLER_FORMATS.includes(codec) ||
      STREAM_FORMATS.some((format) => url.includes(format)) ||
      station.bitrate > 0
    ) {
      console.log(`🎵 Detected standard stream: ${station.name} (${codec})`);
      return "howler";
    }

    // Default to Howler (most compatible)
    console.log(`🎵 Using default player for: ${station.name}`);
    return "howler";
  }, []);

  const setupHLSPlayer = useCallback(
    async (url: string) => {
      if (!audioRef.current || !Hls.isSupported()) {
        throw new Error("HLS not supported");
      }

      const hls = new Hls({
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 20000,
        levelLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 4,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        startLevel: -1,
        autoStartLoad: true,
        enableWorker: true,
        enableSoftwareAES: true,
        maxLoadingDelay: 4,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 3,
        nudgeMaxRetry: 10,
        xhrSetup: (xhr) => {
          xhr.setRequestHeader("User-Agent", "RadioVerse/1.0");
        },
        debug: process.env.NODE_ENV === "development",
      });

      hlsRef.current = hls;
      globalAudioInstance.hls = hls;
      globalAudioInstance.audio = audioRef.current;

      hls.on(Hls.Events.MANIFEST_PARSED, async () => {
        const loadTime = Date.now() - loadStartTimeRef.current;
        setLatency(loadTime / 1000);
        setIsLoading(false);
        options.onCanPlay?.();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS Error:", data);
        if (data.fatal) {
          const errorMsg = `HLS Error: ${data.type} - ${data.details}`;
          setError(errorMsg);
          options.onError?.(errorMsg);

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("🔄 Network error, attempting HLS recovery...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("🔄 Media error, attempting HLS recovery...");
              hls.recoverMediaError();
              break;
            default:
              console.warn("❌ Fatal HLS error");
              if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
                globalAudioInstance.hls = null;
              }
              setIsLoading(false);
              setIsPlaying(false);
              break;
          }
        }
      });

      hls.loadSource(url);
      hls.attachMedia(audioRef.current);

      // Apply volume and mute settings
      audioRef.current.volume = mutedRef.current ? 0 : volumeRef.current;
      audioRef.current.muted = mutedRef.current;

      setStreamType("hls");
      setAudioElement(audioRef.current);
    },
    [options]
  );

  const setupTonePlayer = useCallback(
    async (url: string) => {
      try {
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
        setStreamType("tone");
        setIsLoading(false);
        options.onCanPlay?.();
      } catch (error) {
        console.error("Tone Player Error:", error);
        throw new Error("Failed to setup Tone.js player");
      }
    },
    [options]
  );

  const setupHowlerPlayer = useCallback(
    async (url: string, station: RadioStation) => {
      try {
        console.log(`🎵 Setting up Howler player for ${station.name}`);

        const effectiveVolume = mutedRef.current ? 0 : volumeRef.current;

        const howlOptions: any = {
          src: [url],
          html5: true,
          preload: true,
          volume: effectiveVolume,
          mute: mutedRef.current,
          pool: 1,
          autoplay: false,
          loop: false,
          xhr: {
            method: "GET",
            headers: {
              "User-Agent": "RadioVerse/1.0",
            },
            withCredentials: false,
          },

          onload: () => {
            const loadTime = Date.now() - loadStartTimeRef.current;
            setLatency(loadTime / 1000);
            setIsLoading(false);
            options.onCanPlay?.();
            console.log(`✅ Howler loaded ${station.name} in ${loadTime}ms`);
          },

          onloaderror: (id: number, error: any) => {
            console.error("Howler Load Error:", error);
            const errorMsg = `Failed to load stream: ${error}`;
            setError(errorMsg);
            setIsLoading(false);
            options.onError?.(errorMsg);
          },

          onplayerror: (id: number, error: any) => {
            console.error("Howler Play Error:", error);
            const errorMsg = `Playback failed: ${error}`;
            setError(errorMsg);
            options.onError?.(errorMsg);
          },

          onplay: () => {
            setIsPlaying(true);
            options.onPlay?.();
            console.log(`▶️ Playing ${station.name} via Howler`);
          },

          onpause: () => {
            setIsPlaying(false);
            options.onPause?.();
          },

          onstop: () => {
            setIsPlaying(false);
            setCurrentTime(0);
          },

          onend: () => {
            console.log("Howler stream ended unexpectedly");
            options.onEnded?.();
          },
        };

        const codec = station.codec?.toLowerCase();
        if (codec && HOWLER_FORMATS.includes(codec)) {
          howlOptions.format = [codec];
        }

        const howl = new Howl(howlOptions);
        howlRef.current = howl;
        globalAudioInstance.howl = howl;
        howl.load();
        setStreamType("howler");
      } catch (error) {
        console.error("Howler Setup Error:", error);
        throw new Error(
          `Failed to setup Howler player: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
    [options]
  );

  const cleanup = useCallback(async () => {
    if (isCleaningUpRef.current) {
      console.log("🔄 Cleanup already in progress, waiting...");
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }

    isCleaningUpRef.current = true;
    console.log("🧹 Cleaning up all audio players...");

    // Stop global audio first
    stopAllGlobalAudio();

    // ALWAYS stop the HTML audio element first (critical for preventing echo)
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = "";
        audioRef.current.load();
        audioRef.current.removeAttribute("src");
      } catch (e) {
        console.warn("Audio element cleanup error:", e);
      }
    }

    // Stop and cleanup HLS
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
        hlsRef.current = null;
      } catch (e) {
        console.warn("HLS cleanup error:", e);
      }
    }

    // Stop and cleanup Tone.js
    if (tonePlayerRef.current) {
      try {
        tonePlayerRef.current.stop();
        tonePlayerRef.current.dispose();
        tonePlayerRef.current = null;
      } catch (e) {
        console.warn("Tone cleanup error:", e);
      }
    }

    // Stop and cleanup Howler
    if (howlRef.current) {
      try {
        howlRef.current.stop();
        howlRef.current.unload();
        howlRef.current = null;
      } catch (e) {
        console.warn("Howler cleanup error:", e);
      }
    }

    setIsPlaying(false);
    setStreamType(null);
    isCleaningUpRef.current = false;
  }, []);

  const pause = useCallback(() => {
    try {
      console.log("⏸️ Pausing audio...");

      // Pause all possible audio sources to prevent echo
      if (audioRef.current) {
        audioRef.current.pause();
      }

      if (tonePlayerRef.current) {
        tonePlayerRef.current.stop();
      }

      if (howlRef.current) {
        howlRef.current.pause();
      }

      setIsPlaying(false);
      options.onPause?.();
    } catch (error) {
      console.error("Error pausing audio:", error);
    }
  }, [options]);

  const load = useCallback(
    async (station: RadioStation) => {
      if (!station) return;

      console.log(`🔄 Loading new station: ${station.name}`);

      // CRITICAL: Stop and cleanup ALL previous audio before loading new station
      await cleanup();

      // Wait for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      setError(null);
      setIsLoading(true);
      loadStartTimeRef.current = Date.now();
      currentStationRef.current = station;

      const audioUrl = station.url_resolved || station.url;
      const preferredType = detectStreamType(station);

      console.log(
        `🎵 Loading ${station.name} as ${preferredType} stream (${station.codec}, ${station.bitrate}kbps)`
      );

      try {
        switch (preferredType) {
          case "hls":
            if (Hls.isSupported()) {
              await setupHLSPlayer(audioUrl);
              break;
            } else {
              console.warn(
                "HLS not supported in this browser, falling back to Howler"
              );
              await setupHowlerPlayer(audioUrl, station);
              break;
            }
          case "tone":
            try {
              await setupTonePlayer(audioUrl);
              break;
            } catch (toneError) {
              console.warn(
                "Tone.js failed, falling back to Howler:",
                toneError
              );
              await setupHowlerPlayer(audioUrl, station);
              break;
            }
          case "howler":
          default:
            await setupHowlerPlayer(audioUrl, station);
            break;
        }
      } catch (error) {
        console.error("Failed to load audio:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load audio";
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
      setupTonePlayer,
      setupHowlerPlayer,
      options,
    ]
  );

  const play = useCallback(
    async (station?: RadioStation): Promise<void> => {
      try {
        // If a new station is provided and different from current, load it first
        if (
          station &&
          station.stationuuid !== currentStationRef.current?.stationuuid
        ) {
          console.log(`▶️ Loading and playing new station: ${station.name}`);
          await load(station);
          // Wait for load to complete
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        console.log(`▶️ Starting playback, streamType: ${streamType}`);

        // Play based on current stream type
        const currentStreamType = streamType;

        switch (currentStreamType) {
          case "hls":
            if (audioRef.current) {
              audioRef.current.volume = mutedRef.current ? 0 : volumeRef.current;
              audioRef.current.muted = mutedRef.current;
              await audioRef.current.play();
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
            }
            break;

          case "howler":
            if (howlRef.current) {
              const effectiveVolume = mutedRef.current ? 0 : volumeRef.current;
              howlRef.current.volume(effectiveVolume);
              howlRef.current.mute(mutedRef.current);
              howlRef.current.play();
              // isPlaying is set in onplay callback
            }
            break;

          default:
            console.warn("No stream type available for playback");
            break;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to play audio";
        setError(errorMessage);
        options.onError?.(errorMessage);
        throw error;
      }
    },
    [streamType, load, options]
  );

  const stop = useCallback(() => {
    try {
      console.log("⏹️ Stopping audio...");

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      if (tonePlayerRef.current) {
        tonePlayerRef.current.stop();
      }

      if (howlRef.current) {
        howlRef.current.stop();
      }

      setIsPlaying(false);
      setCurrentTime(0);
    } catch (error) {
      console.error("Error stopping audio:", error);
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    volumeRef.current = clampedVolume;

    console.log(`🔊 Setting volume to: ${clampedVolume}, muted: ${mutedRef.current}`);

    const effectiveVolume = mutedRef.current ? 0 : clampedVolume;

    try {
      // Apply to all possible audio sources
      if (audioRef.current) {
        audioRef.current.volume = effectiveVolume;
      }

      if (tonePlayerRef.current) {
        tonePlayerRef.current.volume.value = Tone.gainToDb(effectiveVolume);
      }

      if (howlRef.current) {
        howlRef.current.volume(effectiveVolume);
      }
    } catch (error) {
      console.error("Error setting volume:", error);
    }
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;

    console.log(`🔇 Setting muted to: ${muted}, volume: ${volumeRef.current}`);

    const effectiveVolume = muted ? 0 : volumeRef.current;

    try {
      // Apply to all possible audio sources
      if (audioRef.current) {
        audioRef.current.muted = muted;
        audioRef.current.volume = effectiveVolume;
      }

      if (tonePlayerRef.current) {
        tonePlayerRef.current.mute = muted;
        tonePlayerRef.current.volume.value = Tone.gainToDb(effectiveVolume);
      }

      if (howlRef.current) {
        howlRef.current.mute(muted);
        howlRef.current.volume(effectiveVolume);
      }
    } catch (error) {
      console.error("Error setting mute:", error);
    }
  }, []);

  useEffect(() => {
    if (audioRef.current && audioRef.current !== audioElement) {
      setAudioElement(audioRef.current);
      globalAudioInstance.audio = audioRef.current;
    }
  }, [audioElement]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || streamType !== "hls") return;

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
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("error", handleError);
    };
  }, [options, streamType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("🧹 Component unmounting, cleaning up...");
      stopAllGlobalAudio();

      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      if (tonePlayerRef.current) {
        tonePlayerRef.current.dispose();
      }
      if (howlRef.current) {
        howlRef.current.unload();
      }
    };
  }, []);

  return {
    audioRef,
    audioElement: streamType === "hls" ? audioRef.current : null,
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
