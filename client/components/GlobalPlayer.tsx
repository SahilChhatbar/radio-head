"use client";
import React from "react";
import { Button, Flex, Text, Box, Container } from "@radix-ui/themes";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Radio,
  Wifi,
  WifiOff,
  Clock,
  Signal,
  Zap,
} from "lucide-react";
import { useRadioStore } from "@/store/useRadiostore";
import * as Slider from "@radix-ui/react-slider";
import { useHotkeys } from "react-hotkeys-hook";
import { useDebouncedCallback } from "use-debounce";
import AudioVisualizer, {
  AudioVisualizerHandle,
} from "./AudioVisualizer";
import { useEnhancedAudioPlayer } from "@/hooks/useAudioPlayer";
import { getStationQualityInfo } from "@/services/StationFilter";

const GlobalPlayer: React.FC = () => {
  const visualizerRef = React.useRef<AudioVisualizerHandle>(null);
  const isChangingStationRef = React.useRef(false);
  const {
    stations,
    currentStationIndex,
    currentStation,
    isPlaying,
    volume,
    isMuted,
    showPlayer,
    nextStation,
    previousStation,
    play,
    togglePlayPause,
    toggleMute,
    setVolume: setStoreVolume,
    setError,
    setIsLoading,
    setIsPlaying,
  } = useRadioStore();

  const {
    audioRef,
    audioElement,
    isLoading: audioLoading,
    error: audioError,
    streamType,
    latency,
    play: playAudio,
    pause: pauseAudio,
    setVolume: setAudioVolume,
    setMuted: setAudioMuted,
  } = useEnhancedAudioPlayer({
    volume,
    muted: isMuted,
    preferredLatency: "low",
    onPlay: () => {
      setIsPlaying(true);
      setError(null);
    },
    onPause: () => {
      setIsPlaying(false);
    },
    onError: (error) => {
      setError(error);
      setIsPlaying(false);
      console.error("🚨 Audio playback error:", error);
    },
    onLoadStart: () => {
      setIsLoading(true);
    },
    onCanPlay: () => {
      setIsLoading(false);
    },
  });

  React.useEffect(() => {
    setAudioVolume(volume);
  }, [volume, setAudioVolume]);

  React.useEffect(() => {
    setAudioMuted(isMuted);
  }, [isMuted, setAudioMuted]);

  React.useEffect(() => {
    setIsLoading(audioLoading);
  }, [audioLoading, setIsLoading]);

  React.useEffect(() => {
    if (audioError) {
      setError(audioError);
    }
  }, [audioError, setError]);

  const handleNextStation = useDebouncedCallback(
    async () => {
      if (isChangingStationRef.current) {
        console.log("⏭️ Station change already in progress, skipping...");
        return;
      }

      try {
        isChangingStationRef.current = true;

        // Pause current audio immediately
        if (isPlaying) {
          pauseAudio();
          visualizerRef.current?.pause();
        }

        nextStation();
        const nextStationData = stations[currentStationIndex + 1] || stations[0];

        if (nextStationData) {
          console.log(`⏭️ Switching to next station: ${nextStationData.name}`);

          // Reset visualizer and show ghost animation during loading
          visualizerRef.current?.reset();

          // Load and play the new station
          await playAudio(nextStationData);

          // Resume visualizer once loaded
          visualizerRef.current?.resume();
        }
      } catch (error) {
        console.error("Failed to switch to next station:", error);
        setError("Failed to switch station");
        visualizerRef.current?.resume();
      } finally {
        isChangingStationRef.current = false;
      }
    },
    300, // 300ms debounce
    { leading: true, trailing: false }
  );

  const handlePreviousStation = useDebouncedCallback(
    async () => {
      if (isChangingStationRef.current) {
        console.log("⏮️ Station change already in progress, skipping...");
        return;
      }

      try {
        isChangingStationRef.current = true;

        // Pause current audio immediately
        if (isPlaying) {
          pauseAudio();
          visualizerRef.current?.pause();
        }

        previousStation();
        const prevIndex =
          currentStationIndex === 0
            ? stations.length - 1
            : currentStationIndex - 1;
        const prevStationData = stations[prevIndex];

        if (prevStationData) {
          console.log(
            `⏮️ Switching to previous station: ${prevStationData.name}`
          );

          // Reset visualizer and show ghost animation during loading
          visualizerRef.current?.reset();

          // Load and play the new station
          await playAudio(prevStationData);

          // Resume visualizer once loaded
          visualizerRef.current?.resume();
        }
      } catch (error) {
        console.error("Failed to switch to previous station:", error);
        setError("Failed to switch station");
        visualizerRef.current?.resume();
      } finally {
        isChangingStationRef.current = false;
      }
    },
    300, // 300ms debounce
    { leading: true, trailing: false }
  );

  const handlePlayPause = React.useCallback(async () => {
    try {
      if (!currentStation && stations.length > 0) {
        const stationToPlay = stations[currentStationIndex];
        console.log(`▶️ Starting playback: ${stationToPlay.name}`);
        visualizerRef.current?.reset(); // Reset visualizer for new station
        await playAudio(stationToPlay);
        play(stationToPlay);
      } else if (currentStation) {
        if (isPlaying) {
          console.log(`⏸️ Pausing: ${currentStation.name}`);
          pauseAudio();
          togglePlayPause();
        } else {
          console.log(`▶️ Resuming: ${currentStation.name}`);
          await playAudio(currentStation);
          togglePlayPause();
        }
      }
    } catch (error) {
      console.error("Failed to toggle playback:", error);
      setError("Playback failed - trying next station...");

      setTimeout(() => {
        if (stations.length > 1) {
          handleNextStation();
        }
      }, 1000);
    }
  }, [
    currentStation,
    togglePlayPause,
    stations,
    currentStationIndex,
    playAudio,
    play,
    isPlaying,
    pauseAudio,
    setError,
    handleNextStation,
  ]);

  // Reset visualizer whenever station changes
  React.useEffect(() => {
    if (currentStation) {
      console.log(`🎨 Resetting visualizer for: ${currentStation.name}`);
      visualizerRef.current?.reset();
    }
  }, [currentStation?.stationuuid]);

  React.useEffect(() => {
    if (currentStation && isPlaying && streamType && !audioLoading) {
      const needsPlayback =
        streamType === "howler" ||
        (streamType === "hls" && audioElement?.paused) ||
        streamType === "tone";

      if (needsPlayback) {
        playAudio(currentStation).catch((error) => {
          console.error("Auto-playback failed:", error);
        });
      }
    }
  }, [
    currentStation,
    isPlaying,
    audioElement,
    playAudio,
    streamType,
    audioLoading,
  ]);

  const isDesktop =
    typeof window !== "undefined" && !("ontouchstart" in window);

  const ignoreIfFormElement = (event: KeyboardEvent) => {
    const target = event.target as Element | null;
    if (!target) return true;
    const tag = target.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      (target as HTMLElement).isContentEditable
    );
  };

  useHotkeys(
    "space",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event)) return;
      event.preventDefault();
      handlePlayPause();
    },
    { enabled: isDesktop },
    [handlePlayPause]
  );

  useHotkeys(
    "left",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event)) return;
      event.preventDefault();
      handlePreviousStation();
    },
    { enabled: isDesktop },
    [handlePreviousStation]
  );

  useHotkeys(
    "right",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event)) return;
      event.preventDefault();
      handleNextStation();
    },
    { enabled: isDesktop },
    [handleNextStation]
  );

  useHotkeys(
    "up",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event)) return;
      event.preventDefault();
      if (isMuted) toggleMute();
      const newVol = Math.min(1, Math.round((volume + 0.1) * 100) / 100);
      setStoreVolume(newVol);
    },
    { enabled: isDesktop },
    [isMuted, toggleMute, volume, setStoreVolume]
  );

  useHotkeys(
    "down",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event)) return;
      event.preventDefault();
      const newVol = Math.max(0, Math.round((volume - 0.1) * 100) / 100);
      setStoreVolume(newVol);
      if (newVol === 0 && !isMuted) toggleMute();
    },
    { enabled: isDesktop },
    [volume, setStoreVolume, isMuted, toggleMute]
  );

  useHotkeys(
    "m",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event)) return;
      event.preventDefault();
      toggleMute();
    },
    { enabled: isDesktop },
    [toggleMute]
  );

  const getStreamTypeInfo = () => {
    switch (streamType) {
      case "hls":
        return {
          icon: <Wifi size={14} />,
          label: "HLS",
          color: "#10B981",
          desc: "High-quality adaptive stream",
        };
      case "tone":
        return {
          icon: <Zap size={14} />,
          label: "Enhanced",
          color: "#8B5CF6",
          desc: "Web Audio API processing",
        };
      case "howler":
        return {
          icon: <Signal size={14} />,
          label: "Optimized",
          color: "#F59E0B",
          desc: "Howler.js low-latency",
        };
      default:
        return {
          icon: <WifiOff size={14} />,
          label: "Unknown",
          color: "#6B7280",
          desc: "Unknown stream type",
        };
    }
  };

  const stationQuality = currentStation
    ? getStationQualityInfo(currentStation)
    : null;

  const formatLatency = (latency: number) => {
    if (latency < 1) return `${Math.round(latency * 1000)}ms`;
    return `${latency.toFixed(1)}s`;
  };

  if (!showPlayer || stations.length === 0) {
    return null;
  }

  const streamInfo = getStreamTypeInfo();

  return (
    <>
      {/* Hidden Audio Element (for HLS and fallback support) */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        preload="none"
        style={{ display: "none" }}
      />
      <Box className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-700/50 backdrop-blur-md bg-[#0C1521]/95">
        <Container size="4" className="py-3">
          <Flex align="center" justify="between" gap="4">
            {/* Left: Station Info with Quality Indicators */}
            <Flex align="center" gap="3" className="flex-1 min-w-0">
              <div className="w-12 h-12 bg-[#FF914D]/20 rounded-lg flex items-center justify-center flex-shrink-0 relative">
                <Radio size={20} className="text-[#FF914D]" />
                {/* Stream type indicator with quality badge */}
                <div
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs border border-current"
                  style={{
                    backgroundColor: `${streamInfo.color}20`,
                    color: streamInfo.color,
                    borderColor: streamInfo.color,
                  }}
                  title={`${streamInfo.label}: ${streamInfo.desc}`}
                >
                  {streamInfo.icon}
                </div>
                {/* Quality indicator */}
                {stationQuality && (
                  <div
                    className={`absolute -bottom-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                      stationQuality.quality === "excellent"
                        ? "bg-green-500"
                        : stationQuality.quality === "good"
                        ? "bg-blue-500"
                        : stationQuality.quality === "acceptable"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    title={`Quality: ${stationQuality.quality} (${Math.round(
                      stationQuality.score
                    )}/100)`}
                  >
                    <span className="text-white text-xs">
                      {stationQuality.quality === "excellent"
                        ? "A"
                        : stationQuality.quality === "good"
                        ? "B"
                        : stationQuality.quality === "acceptable"
                        ? "C"
                        : "D"}
                    </span>
                  </div>
                )}
              </div>
              <Flex direction="column" gap="1" className="min-w-0 flex-1">
                <Flex gap="2" align="center" className="min-w-0">
                  <Text
                    size="3"
                    weight="medium"
                    className="text-foreground truncate"
                  >
                    {currentStation?.name || "No Station"}
                  </Text>
                  <Text size="2" className="text-slate-400">
                    •
                  </Text>
                  <Text size="2" className="text-slate-400 truncate">
                    {currentStation?.country || "Unknown"}
                  </Text>
                </Flex>

                <Flex gap="3" align="center" className="text-xs">
                  <Flex
                    gap="1"
                    align="center"
                    style={{ color: streamInfo.color }}
                  >
                    {streamInfo.icon}
                    <span>{streamInfo.label}</span>
                  </Flex>

                  {latency > 0 && (
                    <Flex gap="1" align="center" className="text-slate-500">
                      <Clock size={12} />
                      <span>{formatLatency(latency)}</span>
                    </Flex>
                  )}

                  {currentStation?.bitrate && (
                    <span className="text-slate-500">
                      {currentStation.bitrate}kbps
                    </span>
                  )}

                  {currentStation?.codec && (
                    <span className="text-slate-500 uppercase">
                      {currentStation.codec}
                    </span>
                  )}

                  {stationQuality && (
                    <span
                      className={`font-medium ${
                        stationQuality.quality === "excellent"
                          ? "text-green-400"
                          : stationQuality.quality === "good"
                          ? "text-blue-400"
                          : stationQuality.quality === "acceptable"
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                      title={`Quality Score: ${Math.round(
                        stationQuality.score
                      )}/100`}
                    >
                      {stationQuality.quality}
                    </span>
                  )}
                </Flex>
              </Flex>
            </Flex>

            <Flex align="center" gap="2">
              <Button
                size="2"
                onClick={handlePreviousStation}
                disabled={stations.length <= 1 || audioLoading}
                title="Previous Station (← key)"
                className="hover:bg-[#FF914D]/10"
              >
                <SkipBack size={18} />
              </Button>

              <Button
                size="3"
                onClick={handlePlayPause}
                disabled={stations.length === 0}
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                className="w-12 h-12 rounded-full bg-[#FF914D] hover:bg-[#FF914D]/90 text-white"
              >
                {audioLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause size={20} />
                ) : (
                  <Play size={20} />
                )}
              </Button>

              <Button
                size="2"
                onClick={handleNextStation}
                disabled={stations.length <= 1 || audioLoading}
                title="Next Station (→ key)"
                className="hover:bg-[#FF914D]/10"
              >
                <SkipForward size={18} />
              </Button>
            </Flex>

            <Flex align="center" gap="3" className="flex-shrink-0">
              <Button
                variant="ghost"
                size="2"
                onClick={toggleMute}
                disabled={!currentStation}
                title={isMuted ? "Unmute (M key)" : "Mute (M key)"}
                className="hover:bg-[#FF914D]/10"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={20} color="#FF914D" />
                ) : (
                  <Volume2 size={20} color="#FF914D" />
                )}
              </Button>
              <div className="w-20 hidden md:block">
                <Slider.Root
                  className="relative flex items-center w-full h-5 select-none"
                  min={0}
                  max={1}
                  step={0.05}
                  value={[isMuted ? 0 : volume]}
                  onValueChange={(val) => {
                    const newVolume = Math.round(val[0] * 100) / 100;
                    setStoreVolume(newVolume);
                    if (newVolume === 0 && !isMuted) {
                      toggleMute();
                    } else if (newVolume > 0 && isMuted) {
                      toggleMute();
                    }
                  }}
                  title="Volume Control (↑↓ keys)"
                >
                  <Slider.Track className="relative w-full h-1 rounded-lg">
                    <Slider.Range
                      className="absolute h-full rounded-lg"
                      style={{
                        background: `linear-gradient(to right, #FF914D 0%, #FF914D 100%)`,
                      }}
                    />
                  </Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded-full focus:outline-none shadow-md" />
                </Slider.Root>
              </div>
              <Text size="1" className="text-[#FF914D] min-w-8 hidden lg:block">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </Text>

              {/* Audio visualizer with default animation */}
              <AudioVisualizer
                ref={visualizerRef}
                className="hidden lg:flex"
                barCount={12}
                barWidth={6}
                barSpacing={2}
                maxHeight={40}
                decay={0.88}
                isLoading={audioLoading}
                isPaused={!isPlaying}
              />
            </Flex>
          </Flex>

          {audioError && (
            <Flex
              align="center"
              gap="2"
              className="mt-2 p-2 bg-red-500/10 rounded border border-red-500/20"
            >
              <WifiOff size={16} className="text-red-400 flex-shrink-0" />
              <Flex direction="column" gap="1" className="flex-1">
                <Text size="2" className="text-red-400">
                  {audioError}
                </Text>
                {streamType && (
                  <Text size="1" className="text-red-400/70">
                    Stream type: {streamInfo.label} • Station:{" "}
                    {currentStation?.name}
                  </Text>
                )}
              </Flex>
              {stations.length > 1 && (
                <Button
                  size="1"
                  variant="ghost"
                  onClick={handleNextStation}
                  className="text-red-400 hover:bg-red-500/20"
                >
                  Try Next
                </Button>
              )}
            </Flex>
          )}

          {audioLoading && !audioError && (
            <Flex align="center" gap="2" className="mt-2">
              <div className="w-4 h-4 border-2 border-[#FF914D] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <Flex direction="column" gap="0.5">
                <Text size="2" className="text-slate-400">
                  Loading {streamInfo.label.toLowerCase()} stream...
                </Text>
                {currentStation && (
                  <Text size="1" className="text-slate-500">
                    {currentStation.name} • {currentStation.bitrate}kbps{" "}
                    {currentStation.codec?.toUpperCase()}
                  </Text>
                )}
              </Flex>
            </Flex>
          )}

          {stationQuality &&
            (stationQuality.warnings.length > 0 ||
              stationQuality.issues.length > 0) &&
            !audioError &&
            !audioLoading && (
              <Flex
                align="center"
                gap="2"
                className="mt-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/20"
              >
                <div className="w-3 h-3 bg-yellow-400 rounded-full flex-shrink-0" />
                <Flex direction="column" gap="0.5" className="flex-1">
                  {stationQuality.issues.length > 0 && (
                    <Text size="1" className="text-yellow-400">
                      Issues: {stationQuality.issues.join(", ")}
                    </Text>
                  )}
                  {stationQuality.warnings.length > 0 && (
                    <Text size="1" className="text-yellow-400/80">
                      {stationQuality.warnings.join(", ")}
                    </Text>
                  )}
                </Flex>
              </Flex>
            )}

          {process.env.NODE_ENV === "development" &&
            streamType &&
            !audioError &&
            !audioLoading && (
              <Flex
                align="center"
                gap="4"
                className="mt-2 text-xs text-slate-500 border-t border-slate-700/50 pt-2"
              >
                <span>Stream: {streamInfo.label}</span>
                {latency > 0 && <span>Latency: {formatLatency(latency)}</span>}
                {currentStation?.codec && (
                  <span>Codec: {currentStation.codec.toUpperCase()}</span>
                )}
                {stationQuality && (
                  <span>
                    Quality Score: {Math.round(stationQuality.score)}/100
                  </span>
                )}
                {currentStation?.votes !== undefined && (
                  <span>Votes: {currentStation.votes}</span>
                )}
                <span>
                  Index: {currentStationIndex + 1}/{stations.length}
                </span>
              </Flex>
            )}
        </Container>
      </Box>
    </>
  );
};

export default GlobalPlayer;
