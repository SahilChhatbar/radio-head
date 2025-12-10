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
  Disc3,
  Unplug,
  RadioTower,
} from "lucide-react";
import { useRadioStore } from "@/store/useRadiostore";
import * as Slider from "@radix-ui/react-slider";
import { useHotkeys } from "react-hotkeys-hook";
import AudioVisualizer, {
  AudioVisualizerHandle,
} from "./AudioVisualizer";
import { useEnhancedAudioPlayer } from "@/hooks/useAudioPlayer";
import { getStationQualityInfo } from "@/services/StationFilter";
import ImmersiveVisualizer from "./ImmersiveMode";

const GlobalPlayer: React.FC = () => {
  const visualizerRef = React.useRef<AudioVisualizerHandle>(null);
  const isChangingStationRef = React.useRef(false);
  const isInitializedRef = React.useRef(false);

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
    setError,
    setIsLoading,
    setIsPlaying,
    setAudioControls,
    updateVolume,
    updateMuted,
    setStreamType: setStoreStreamType,
  } = useRadioStore();

  const {
    audioRef,
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
      visualizerRef.current?.resume();
    },
    onPause: () => {
      setIsPlaying(false);
      visualizerRef.current?.pause();
    },
    onError: (error) => {
      setError(error);
      setIsPlaying(false);
      visualizerRef.current?.pause();
      console.error("🚨 Audio playback error:", error);
    },
    onLoadStart: () => {
      setIsLoading(true);
      visualizerRef.current?.reset();
    },
    onCanPlay: () => {
      setIsLoading(false);
    },
  });

  // Register audio controls with the store (only once)
  React.useEffect(() => {
    if (!isInitializedRef.current) {
      console.log("🎮 Registering audio controls with store");
      setAudioControls({
        play: playAudio,
        pause: pauseAudio,
        setVolume: setAudioVolume,
        setMuted: setAudioMuted,
      });
      isInitializedRef.current = true;
    }
  }, [setAudioControls, playAudio, pauseAudio, setAudioVolume, setAudioMuted]);

  // Sync loading state
  React.useEffect(() => {
    setIsLoading(audioLoading);
  }, [audioLoading, setIsLoading]);

  // Sync error state
  React.useEffect(() => {
    if (audioError) {
      setError(audioError);
    }
  }, [audioError, setError]);

  // Sync stream type to store
  React.useEffect(() => {
    console.log(`🎵 Stream type changed: ${streamType}`);
    setStoreStreamType(streamType);
  }, [streamType, setStoreStreamType]);

  // Handle volume change - use store's centralized control
  const handleVolumeChange = React.useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    console.log(`🔊 handleVolumeChange: ${clampedVolume}`);
    updateVolume(clampedVolume);
  }, [updateVolume]);

  // Handle mute toggle - use store's centralized control
  const handleMuteToggle = React.useCallback(() => {
    console.log(`🔇 handleMuteToggle: current muted = ${isMuted}`);
    updateMuted(!isMuted);
  }, [isMuted, updateMuted]);

  // Handle next station
  const handleNextStation = React.useCallback(async () => {
    if (isChangingStationRef.current || audioLoading) {
      console.log("⏭️ Station change already in progress or loading, skipping...");
      return;
    }

    try {
      isChangingStationRef.current = true;
      console.log("⏭️ Switching to next station...");

      // Pause current audio immediately
      pauseAudio();
      visualizerRef.current?.pause();

      // Update store state
      nextStation();

      // Get the next station (after store update)
      const { stations: currentStations, currentStationIndex: currentIdx } = useRadioStore.getState();
      const nextIdx = (currentIdx) % currentStations.length;
      const nextStationData = currentStations[nextIdx];

      if (nextStationData) {
        console.log(`⏭️ Loading next station: ${nextStationData.name}`);

        // Reset visualizer
        visualizerRef.current?.reset();

        // Small delay to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 100));

        // Load and play the new station
        await playAudio(nextStationData);

        // Resume visualizer
        visualizerRef.current?.resume();
      }
    } catch (error) {
      console.error("Failed to switch to next station:", error);
      setError("Failed to switch station");
      visualizerRef.current?.resume();
    } finally {
      isChangingStationRef.current = false;
    }
  }, [audioLoading, nextStation, pauseAudio, playAudio, setError]);

  // Handle previous station
  const handlePreviousStation = React.useCallback(async () => {
    if (isChangingStationRef.current || audioLoading) {
      console.log("⏮️ Station change already in progress or loading, skipping...");
      return;
    }

    try {
      isChangingStationRef.current = true;
      console.log("⏮️ Switching to previous station...");

      // Pause current audio immediately
      pauseAudio();
      visualizerRef.current?.pause();

      // Update store state
      previousStation();

      // Get the previous station (after store update)
      const { stations: currentStations, currentStationIndex: currentIdx } = useRadioStore.getState();
      const prevStationData = currentStations[currentIdx];

      if (prevStationData) {
        console.log(`⏮️ Loading previous station: ${prevStationData.name}`);

        // Reset visualizer
        visualizerRef.current?.reset();

        // Small delay to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 100));

        // Load and play the new station
        await playAudio(prevStationData);

        // Resume visualizer
        visualizerRef.current?.resume();
      }
    } catch (error) {
      console.error("Failed to switch to previous station:", error);
      setError("Failed to switch station");
      visualizerRef.current?.resume();
    } finally {
      isChangingStationRef.current = false;
    }
  }, [audioLoading, previousStation, pauseAudio, playAudio, setError]);

  const handlePlayPause = React.useCallback(async () => {
    if (audioLoading || isChangingStationRef.current) {
      return;
    }
    try {
      if (isPlaying) {
        console.log(`⏸️ Pausing: ${currentStation?.name || 'audio'}`);
        pauseAudio();
      } else {
        let stationToPlay = currentStation;
        if (!stationToPlay && stations.length > 0) {
          stationToPlay = stations[currentStationIndex];
        }
        if (stationToPlay) {
          console.log(`▶️ Starting/Resuming playback: ${stationToPlay.name}`);
          visualizerRef.current?.reset();
          play(stationToPlay);
        } else {
          console.warn("Cannot play, no station available.");
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
    stations,
    currentStationIndex,
    play,
    isPlaying,
    pauseAudio,
    setError,
    handleNextStation,
    audioLoading,
  ]);

  React.useEffect(() => {
    if (currentStation) {
      console.log(`🎨 Station changed to: ${currentStation.name}`);
      visualizerRef.current?.reset();
    }
  }, [currentStation?.stationuuid]);

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

  // Keyboard shortcuts
  useHotkeys(
    "space",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event) || audioLoading || isChangingStationRef.current) return;
      event.preventDefault();
      handlePlayPause();
    },
    { enabled: isDesktop },
    [handlePlayPause, audioLoading]
  );

  useHotkeys(
    "left",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event) || audioLoading || isChangingStationRef.current) return;
      event.preventDefault();
      handlePreviousStation();
    },
    { enabled: isDesktop },
    [handlePreviousStation, audioLoading]
  );

  useHotkeys(
    "right",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event) || audioLoading || isChangingStationRef.current) return;
      event.preventDefault();
      handleNextStation();
    },
    { enabled: isDesktop },
    [handleNextStation, audioLoading]
  );

  useHotkeys(
    "up",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event) || audioLoading || isChangingStationRef.current) return;
      event.preventDefault();
      const newVol = Math.min(1, Math.round((volume + 0.1) * 100) / 100);
      handleVolumeChange(newVol);
    },
    { enabled: isDesktop },
    [volume, handleVolumeChange, audioLoading]
  );

  useHotkeys(
    "down",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event) || audioLoading || isChangingStationRef.current) return;
      event.preventDefault();
      const newVol = Math.max(0, Math.round((volume - 0.1) * 100) / 100);
      handleVolumeChange(newVol);
    },
    { enabled: isDesktop },
    [volume, handleVolumeChange, audioLoading]
  );

  useHotkeys(
    "m",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event) || audioLoading || isChangingStationRef.current) return;
      event.preventDefault();
      handleMuteToggle();
    },
    { enabled: isDesktop },
    [handleMuteToggle, audioLoading]
  );

  // Stream type info
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
  const displayVolume = isMuted ? 0 : volume;

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
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

                  {/* Loading Icon */}
                  <div
                    className={`
      absolute inset-0 flex items-center justify-center
      transition-opacity duration-300 ease-in-out
      ${audioLoading ? "opacity-100 scale-100" : "opacity-0 scale-90"}
    `}
                  >
                    <div className="w-6 h-6 border-2 border-[#FF914D] border-t-transparent rounded-full animate-spin" />
                  </div>

                  {/* Playing Icon */}
                  <div
                    className={`
      absolute inset-0 flex items-center justify-center
      transition-opacity duration-300 ease-in-out
      ${!audioLoading && isPlaying ? "opacity-100 scale-100" : "opacity-0 scale-90"}
    `}
                  >
                    <Disc3 size={28} className="text-[#FF914D] animate-spin" />
                  </div>

                  {/* Paused / Stopped Icon */}
                  <div
                    className={`
      absolute inset-0 flex items-center justify-center
      transition-opacity duration-300 ease-in-out
      ${!audioLoading && !isPlaying ? "opacity-100 scale-100" : "opacity-0 scale-90"}
    `}
                  >
                    <Unplug size={28} className="text-[#FF914D] animate-pulse" />
                  </div>

                </div>


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
                    className={`absolute -bottom-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${stationQuality.quality === "excellent"
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
                  {stationQuality && (
                    <Flex gap="1" align="center" className="text-foreground">
                      <RadioTower size={14} className="" />
                      <span
                        className={`font-medium ${stationQuality.quality === "excellent"
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
                    </Flex>)}

                  {latency > 0 && (
                    <Flex gap="1" align="center" className="text-foreground">
                      <Clock size={12} />
                      <span>{formatLatency(latency)}</span>
                    </Flex>
                  )}
                </Flex>
              </Flex>
            </Flex>

            {/* Center: Playback Controls */}
            <Flex align="center" gap="2">
              <Button
                size="2"
                onClick={handlePreviousStation}
                disabled={stations.length <= 1 || audioLoading || isChangingStationRef.current}
                title="Previous Station (← key)"
                className="hover:bg-[#FF914D]/10"
              >
                <SkipBack size={18} />
              </Button>

              <Button
                size="3"
                onClick={handlePlayPause}
                disabled={stations.length === 0 || audioLoading || isChangingStationRef.current}
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
                disabled={stations.length <= 1 || audioLoading || isChangingStationRef.current}
                title="Next Station (→ key)"
                className="hover:bg-[#FF914D]/10"
              >
                <SkipForward size={18} />
              </Button>
            </Flex>

            {/* Right: Volume Controls */}
            <Flex align="center" gap="3" className="flex-shrink-0">
              <Button
                variant="ghost"
                size="2"
                onClick={handleMuteToggle}
                disabled={!currentStation || audioLoading || isChangingStationRef.current}
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
                  disabled={audioLoading || isChangingStationRef.current}
                  min={0}
                  max={1}
                  step={0.01}
                  value={[displayVolume]}
                  onValueChange={(val) => {
                    const newVolume = Math.round(val[0] * 100) / 100;
                    handleVolumeChange(newVolume);
                  }}
                  title="Volume Control (↑↓ keys)"
                >
                  <Slider.Track className="relative w-full h-1 rounded-lg bg-slate-700">
                    <Slider.Range
                      className="absolute h-full rounded-lg"
                      style={{
                        background: `linear-gradient(to right, #FF914D 0%, #FF914D 100%)`,
                      }}
                    />
                  </Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded-full focus:outline-none shadow-md hover:bg-gray-100 transition-colors" />
                </Slider.Root>
              </div>
              <Text size="1" className="text-[#FF914D] min-w-8 hidden lg:block">
                {Math.round(displayVolume * 100)}%
              </Text>

              {/* Audio visualizer */}
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
              <ImmersiveVisualizer currentStation={currentStationIndex} />
            </Flex>
          </Flex>

          {/* Error display */}
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
          {/* Quality warnings */}
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
        </Container>
      </Box>
    </>
  );
};

export default GlobalPlayer;
