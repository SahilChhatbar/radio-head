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
  audioRef: React.RefObject<HTMLAudioElement>;
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

type StreamType = "hls" | "tone" | "howler";

// Audio format detection utilities
const HLS_INDICATORS = [".m3u8", "hls", "apple", "manifest"];
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
];

export const useEnhancedAudioPlayer = (
  options: UseEnhancedAudioPlayerOptions = {}
): UseEnhancedAudioPlayerReturn => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );

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
  const howlRef = useRef<Howl | null>(null);
  const currentStationRef = useRef<RadioStation | null>(null);
  const loadStartTimeRef = useRef<number>(0);

  // Detect stream type from URL and codec
  const detectStreamType = useCallback((station: RadioStation): StreamType => {
    const url = (station.url_resolved || station.url).toLowerCase();
    const codec = station.codec?.toLowerCase() || "";

    // Check for HLS streams
    if (HLS_INDICATORS.some((indicator) => url.includes(indicator))) {
      return "hls";
    }

    // Check for high-quality streams that benefit from Web Audio API (Tone.js)
    if (
      HIGH_QUALITY_INDICATORS.some((indicator) => url.includes(indicator)) &&
      (codec === "flac" || codec === "wav" || url.includes("stream"))
    ) {
      return "tone";
    }

    // Check for Howler-supported formats (most common for radio streaming)
    if (
      HOWLER_FORMATS.some((format) => url.includes(format)) ||
      HOWLER_FORMATS.includes(codec) ||
      station.bitrate > 0
    ) {
      // Most radio streams are MP3/AAC
      return "howler";
    }

    // Default fallback for unknown formats
    return "howler";
  }, []);

  // HLS Player Implementation (unchanged)
  const setupHLSPlayer = useCallback(
    async (url: string) => {
      if (!audioRef.current || !Hls.isSupported()) {
        throw new Error("HLS not supported");
      }

      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: options.preferredLatency === "low" ? 5 : 10,
        maxBufferLength: options.preferredLatency === "low" ? 10 : 30,
        maxMaxBufferLength: options.preferredLatency === "low" ? 15 : 60,

        fragLoadingTimeOut: 5000,
        manifestLoadingTimeOut: 5000,
        levelLoadingTimeOut: 5000,

        startLevel: -1,
        enableWorker: true,
        enableSoftwareAES: true,
        debug: process.env.NODE_ENV === "development",
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const loadTime = Date.now() - loadStartTimeRef.current;
        setLatency(loadTime / 1000);
        setIsLoading(false);
        options.onCanPlay?.();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS Error:", data);
        if (data.fatal) {
          setError(`HLS Error: ${data.type} - ${data.details}`);
          options.onError?.(`HLS Error: ${data.type}`);
        }
      });

      hls.loadSource(url);
      hls.attachMedia(audioRef.current);

      setStreamType("hls");
    },
    [options]
  );

  // Tone.js Player Implementation (unchanged)
  const setupTonePlayer = useCallback(
    async (url: string) => {
      try {
        if (Tone.context.state === "suspended") {
          await Tone.start();
        }

        if (tonePlayerRef.current) {
          tonePlayerRef.current.dispose();
        }

        const player = new Tone.Player({
          url,
          autostart: false,
          loop: false,
          fadeIn: 0,
          fadeOut: 0.1,
        }).toDestination();

        player.volume.value = Tone.gainToDb(options.volume || 0.7);

        await Tone.loaded();

        const loadTime = Date.now() - loadStartTimeRef.current;
        setLatency(loadTime / 1000);

        tonePlayerRef.current = player;
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

  // NEW: Howler Player Implementation for MP3 and radio streams
  const setupHowlerPlayer = useCallback(
    async (url: string, station: RadioStation) => {
      try {
        console.log(`🎵 Setting up Howler player for ${station.name}`);

        // Cleanup previous instance
        if (howlRef.current) {
          howlRef.current.unload();
          howlRef.current = null;
        }

        // Configure Howler for radio streaming
        const howlOptions: any = {
          src: [url],
          html5: true, // Use HTML5 Audio for streaming
          preload: false, // Don't preload for live streams
          volume: options.volume || 0.7,
          mute: options.muted || false,

          // Optimizations for radio streaming
          pool: 1, // Only one instance needed
          autoplay: false,
          loop: false,

          // Event handlers
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
            // For radio streams, this shouldn't happen unless there's an error
            console.log("Howler stream ended unexpectedly");
            options.onEnded?.();
          },
        };

        // Add format hint if we can determine it
        const codec = station.codec?.toLowerCase();
        if (codec && HOWLER_FORMATS.includes(codec)) {
          howlOptions.format = [codec];
        }

        const howl = new Howl(howlOptions);
        howlRef.current = howl;

        // Start loading
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

  // Enhanced smart player selection
  const load = useCallback(
    async (station: RadioStation) => {
      if (!station) return;

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
            }
          // Fallback to howler for HLS if not supported

          case "tone":
            try {
              await setupTonePlayer(audioUrl);
              break;
            } catch (toneError) {
              console.warn(
                "Tone.js failed, falling back to Howler:",
                toneError
              );
              // Fallback to howler
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
      detectStreamType,
      setupHLSPlayer,
      setupTonePlayer,
      setupHowlerPlayer,
      options,
    ]
  );

  // Enhanced pause method
  const pause = useCallback(() => {
    try {
      switch (streamType) {
        case "hls":
          if (audioRef.current) {
            audioRef.current.pause();
          }
          break;

        case "tone":
          if (tonePlayerRef.current) {
            tonePlayerRef.current.stop();
          }
          break;

        case "howler":
          if (howlRef.current) {
            howlRef.current.pause();
          }
          break;
      }

      setIsPlaying(false);
      options.onPause?.();
    } catch (error) {
      console.error("Error pausing audio:", error);
    }
  }, [streamType, options]);

  // Enhanced play method with better station switching
  const play = useCallback(
    async (station?: RadioStation): Promise<void> => {
      try {
        // If new station provided, load it first
        if (
          station &&
          station.stationuuid !== currentStationRef.current?.stationuuid
        ) {
          // Stop current playback before switching
          if (streamType && isPlaying) {
            pause();
            await new Promise((resolve) => setTimeout(resolve, 100)); // Brief pause for cleanup
          }

          await load(station);
          // Wait a bit longer for the stream to be ready
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // Play based on current stream type
        switch (streamType) {
          case "hls":
            if (audioRef.current) {
              await audioRef.current.play();
            }
            break;

          case "tone":
            if (tonePlayerRef.current) {
              tonePlayerRef.current.start();
            }
            break;

          case "howler":
            if (howlRef.current) {
              howlRef.current.play();
            }
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
    [streamType, load, isPlaying, pause, options]
  );

  // Enhanced stop method
  const stop = useCallback(() => {
    try {
      switch (streamType) {
        case "hls":
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          break;

        case "tone":
          if (tonePlayerRef.current) {
            tonePlayerRef.current.stop();
          }
          break;

        case "howler":
          if (howlRef.current) {
            howlRef.current.stop();
          }
          break;
      }

      setIsPlaying(false);
      setCurrentTime(0);
    } catch (error) {
      console.error("Error stopping audio:", error);
    }
  }, [streamType]);

  // Enhanced volume control
  const setVolume = useCallback(
    (volume: number) => {
      const clampedVolume = Math.max(0, Math.min(1, volume));

      try {
        switch (streamType) {
          case "hls":
            if (audioRef.current) {
              audioRef.current.volume = clampedVolume;
            }
            break;

          case "tone":
            if (tonePlayerRef.current) {
              tonePlayerRef.current.volume.value = Tone.gainToDb(clampedVolume);
            }
            break;

          case "howler":
            if (howlRef.current) {
              howlRef.current.volume(clampedVolume);
            }
            break;
        }
      } catch (error) {
        console.error("Error setting volume:", error);
      }
    },
    [streamType]
  );

  // Enhanced mute control
  const setMuted = useCallback(
    (muted: boolean) => {
      try {
        switch (streamType) {
          case "hls":
            if (audioRef.current) {
              audioRef.current.muted = muted;
            }
            break;

          case "tone":
            if (tonePlayerRef.current) {
              tonePlayerRef.current.mute = muted;
            }
            break;

          case "howler":
            if (howlRef.current) {
              howlRef.current.mute(muted);
            }
            break;
        }
      } catch (error) {
        console.error("Error setting mute:", error);
      }
    },
    [streamType]
  );

  // Setup audio element reference
  useEffect(() => {
    if (audioRef.current && audioRef.current !== audioElement) {
      setAudioElement(audioRef.current);
    }
  }, [audioElement]);

  // HLS audio event listeners (only for HLS streams)
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
      // Cleanup all player instances
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
    audioElement: streamType === "hls" ? audioRef.current : null, // Only expose for HLS
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
