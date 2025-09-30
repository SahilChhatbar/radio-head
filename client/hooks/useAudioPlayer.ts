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
  analyserNode: AnalyserNode | null; // Exposed analyser for visualizer
  audioContext: AudioContext | null; // Exposed audio context
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
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

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

  // Universal audio context and analyser
  const universalContextRef = useRef<AudioContext | null>(null);
  const universalAnalyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const streamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sourceConnectedRef = useRef<boolean>(false);

  // Initialize universal audio context
  const initializeAudioContext = useCallback(() => {
    if (!universalContextRef.current) {
      const AudioCtor =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtor) {
        universalContextRef.current = new AudioCtor();
        setAudioContext(universalContextRef.current);

        // Create analyser node
        const analyser = universalContextRef.current.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.7;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        universalAnalyserRef.current = analyser;
        setAnalyserNode(analyser);

        console.log("🎛️ Universal audio context initialized");
      }
    }
    return universalContextRef.current;
  }, []);

  const detectStreamType = useCallback((station: RadioStation): StreamType => {
    const url = (station.url_resolved || station.url).toLowerCase();
    const codec = station.codec?.toLowerCase() || "";

    if (HLS_INDICATORS.some((indicator) => url.includes(indicator))) {
      return "hls";
    }

    if (
      HIGH_QUALITY_INDICATORS.some((indicator) => url.includes(indicator)) &&
      (codec === "flac" || codec === "wav" || url.includes("stream"))
    ) {
      return "tone";
    }

    if (
      HOWLER_FORMATS.some((format) => url.includes(format)) ||
      HOWLER_FORMATS.includes(codec) ||
      station.bitrate > 0
    ) {
      return "howler";
    }

    return "howler";
  }, []);

  const connectToAnalyser = useCallback((source: AudioNode) => {
    if (
      universalAnalyserRef.current &&
      universalContextRef.current &&
      !sourceConnectedRef.current
    ) {
      try {
        // Disconnect any previous connections
        try {
          source.disconnect();
        } catch {}

        // Connect: source -> analyser -> destination
        source.connect(universalAnalyserRef.current);
        universalAnalyserRef.current.connect(
          universalContextRef.current.destination
        );
        sourceConnectedRef.current = true;
        console.log("✅ Connected audio source to analyser");
      } catch (err) {
        console.error("Failed to connect to analyser:", err);
      }
    }
  }, []);

  const setupHLSPlayer = useCallback(
    async (url: string) => {
      if (!audioRef.current || !Hls.isSupported()) {
        throw new Error("HLS not supported");
      }

      // Initialize audio context
      const ctx = initializeAudioContext();
      if (!ctx) {
        throw new Error("Could not initialize audio context");
      }

      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      // Reset connection state
      sourceConnectedRef.current = false;
      if (mediaSourceRef.current) {
        try {
          mediaSourceRef.current.disconnect();
        } catch {}
        mediaSourceRef.current = null;
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

      hls.on(Hls.Events.MANIFEST_PARSED, async () => {
        const loadTime = Date.now() - loadStartTimeRef.current;
        setLatency(loadTime / 1000);
        setIsLoading(false);
        options.onCanPlay?.();

        // Connect audio element to analyser after a short delay to ensure audio is ready
        setTimeout(() => {
          if (ctx && universalAnalyserRef.current && audioRef.current) {
            try {
              if (!mediaSourceRef.current && !sourceConnectedRef.current) {
                console.log("🔌 Connecting HLS audio to analyser...");
                mediaSourceRef.current = ctx.createMediaElementSource(
                  audioRef.current
                );
                connectToAnalyser(mediaSourceRef.current);
              }
            } catch (err) {
              console.warn("Could not connect HLS to analyser:", err);
            }
          }
        }, 100);
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
      setAudioElement(audioRef.current);
    },
    [options, initializeAudioContext, connectToAnalyser]
  );

  const setupTonePlayer = useCallback(
    async (url: string) => {
      try {
        // Initialize audio context first
        const ctx = initializeAudioContext();
        if (!ctx) {
          throw new Error("Could not initialize audio context");
        }

        // Reset connection state
        sourceConnectedRef.current = false;

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

        // Connect Tone.js player to our universal analyser
        if (universalAnalyserRef.current && ctx) {
          try {
            // Get Tone's native audio context
            const toneCtx = Tone.getContext().rawContext as AudioContext;

            // If contexts match, we can connect directly
            if (toneCtx === ctx) {
              // Connect player to our analyser
              const nativeNode = player.toDestination();

              // Tone.js uses a different context, so we need to bridge it
              // We'll connect Tone's output to our analyser
              player.connect(universalAnalyserRef.current as any);
              sourceConnectedRef.current = true;
              console.log("✅ Connected Tone.js to analyser");
            } else {
              // Fallback: just connect to destination
              player.toDestination();
              console.warn(
                "⚠️ Tone.js context mismatch, visualizer may not work"
              );
            }
          } catch (err) {
            console.warn("Could not connect Tone.js to analyser:", err);
            player.toDestination();
          }
        } else {
          player.toDestination();
        }

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
    [options, initializeAudioContext]
  );

  const setupHowlerPlayer = useCallback(
    async (url: string, station: RadioStation) => {
      try {
        console.log(`🎵 Setting up Howler player for ${station.name}`);

        // Initialize audio context
        const ctx = initializeAudioContext();
        if (!ctx) {
          throw new Error("Could not initialize audio context");
        }

        // Reset connection state
        sourceConnectedRef.current = false;
        if (mediaSourceRef.current) {
          try {
            mediaSourceRef.current.disconnect();
          } catch {}
          mediaSourceRef.current = null;
        }

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

            // Connect Howler to analyser after load
            setTimeout(() => {
              if (
                ctx &&
                universalAnalyserRef.current &&
                howlRef.current &&
                !sourceConnectedRef.current
              ) {
                try {
                  const howl = howlRef.current as any;

                  // Access Howler's internal audio nodes
                  if (howl._sounds && howl._sounds.length > 0) {
                    const sound = howl._sounds[0];

                    // For HTML5 audio (which Howler uses for streams)
                    if (sound._node) {
                      const audioElement = sound._node as HTMLAudioElement;

                      if (audioElement && audioElement.src) {
                        console.log(
                          "🔌 Connecting Howler HTML5 audio to analyser..."
                        );
                        mediaSourceRef.current =
                          ctx.createMediaElementSource(audioElement);
                        connectToAnalyser(mediaSourceRef.current);
                      }
                    }
                  }
                } catch (err) {
                  console.warn("Could not connect Howler to analyser:", err);
                }
              }
            }, 150);
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
    [options, initializeAudioContext, connectToAnalyser]
  );

  const load = useCallback(
    async (station: RadioStation) => {
      if (!station) return;

      setError(null);
      setIsLoading(true);
      loadStartTimeRef.current = Date.now();
      currentStationRef.current = station;

      // Clean up previous sources and reset connection state
      sourceConnectedRef.current = false;

      if (mediaSourceRef.current) {
        try {
          mediaSourceRef.current.disconnect();
        } catch {}
        mediaSourceRef.current = null;
      }
      if (streamSourceRef.current) {
        try {
          streamSourceRef.current.disconnect();
        } catch {}
        streamSourceRef.current = null;
      }

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
          case "tone":
            try {
              await setupTonePlayer(audioUrl);
              break;
            } catch (toneError) {
              console.warn(
                "Tone.js failed, falling back to Howler:",
                toneError
              );
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

        // Resume audio context if suspended
        if (universalContextRef.current?.state === "suspended") {
          await universalContextRef.current.resume();
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
      if (mediaSourceRef.current) {
        try {
          mediaSourceRef.current.disconnect();
        } catch {}
      }
      if (streamSourceRef.current) {
        try {
          streamSourceRef.current.disconnect();
        } catch {}
      }
      if (universalContextRef.current) {
        universalContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    audioRef,
    audioElement: streamType === "hls" ? audioRef.current : null,
    analyserNode: universalAnalyserRef.current, // Expose the analyser
    audioContext: universalContextRef.current, // Expose the context
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
