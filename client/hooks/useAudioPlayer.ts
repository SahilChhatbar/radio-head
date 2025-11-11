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

export const useEnhancedAudioPlayer = (
  options: UseEnhancedAudioPlayerOptions = {}
): UseEnhancedAudioPlayerReturn => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );

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

      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: options.preferredLatency === "low" ? 5 : 10,
        maxBufferLength: options.preferredLatency === "low" ? 10 : 30,
        maxMaxBufferLength: options.preferredLatency === "low" ? 15 : 60,
        fragLoadingTimeOut: 10000, // Increased for better compatibility
        manifestLoadingTimeOut: 10000, // Increased for better compatibility
        levelLoadingTimeOut: 10000, // Increased for better compatibility
        fragLoadingMaxRetry: 3,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        startLevel: -1, // Auto quality selection
        enableWorker: true,
        enableSoftwareAES: true,
        xhrSetup: (xhr) => {
          // Add custom headers for better compatibility
          xhr.setRequestHeader("User-Agent", "RadioVerse/1.0");
        },
        debug: process.env.NODE_ENV === "development",
      });

      hlsRef.current = hls;

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

          // Attempt to recover or fallback
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
              console.warn(
                "❌ Fatal HLS error, will need manual retry or next station"
              );
              // Cleanup HLS
              if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
              }
              setIsLoading(false);
              setIsPlaying(false);
              break;
          }
        }
      });

      hls.loadSource(url);
      hls.attachMedia(audioRef.current);

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

        if (tonePlayerRef.current) {
          tonePlayerRef.current.dispose();
        }

        const player = new Tone.Player({
          url,
          autostart: false,
          loop: false,
          fadeIn: 0,
          fadeOut: 0.1,
        });

        player.volume.value = Tone.gainToDb(options.volume || 0.7);
        player.toDestination();

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

  const setupHowlerPlayer = useCallback(
    async (url: string, station: RadioStation) => {
      try {
        console.log(`🎵 Setting up Howler player for ${station.name}`);

        if (howlRef.current) {
          howlRef.current.unload();
          howlRef.current = null;
        }

        const howlOptions: any = {
          src: [url],
          html5: true,
          preload: false,
          volume: options.volume || 0.7,
          mute: options.muted || false,
          pool: 1,
          autoplay: false,
          loop: false,

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
      detectStreamType,
      setupHLSPlayer,
      setupTonePlayer,
      setupHowlerPlayer,
      options,
    ]
  );

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

  const play = useCallback(
    async (station?: RadioStation): Promise<void> => {
      try {
        if (
          station &&
          station.stationuuid !== currentStationRef.current?.stationuuid
        ) {
          if (streamType && isPlaying) {
            pause();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          await load(station);
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

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

  useEffect(() => {
    if (audioRef.current && audioRef.current !== audioElement) {
      setAudioElement(audioRef.current);
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

  useEffect(() => {
    return () => {
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
