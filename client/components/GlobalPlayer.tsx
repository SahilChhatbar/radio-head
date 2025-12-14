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
  Disc3,
  Unplug,
  Clock,
} from "lucide-react";
import * as Slider from "@radix-ui/react-slider";
import { useHotkeys } from "react-hotkeys-hook";

import { useRadioStore } from "@/store/useRadiostore";
import { useEnhancedAudioPlayer } from "@/hooks/useAudioPlayer";
import AudioVisualizer, { AudioVisualizerHandle } from "./AudioVisualizer";
import ImmersiveVisualizer from "./ImmersiveMode";

const ORANGE = "#FF914D";

const GlobalPlayer: React.FC = () => {
  const visualizerRef = React.useRef<AudioVisualizerHandle>(null);
  const isChangingStationRef = React.useRef(false);
  const isInitializedRef = React.useRef(false);

  const {
    stations,
    currentStation,
    currentStationIndex,
    isPlaying,
    isLoading: storeIsLoading,
    volume,
    isMuted,
    showPlayer,
    play,
    nextStation,
    previousStation,
    updateVolume,
    updateMuted,
    setAudioControls,
    setIsPlaying,
    setIsLoading,
    setError,
    setStreamType,
  } = useRadioStore();

  // Use hook BUT do NOT rely on hook's isLoading/isPlaying for UI state.
  // Store is the single source of truth for UI.
  const {
    audioRef,
    play: playAudio,
    pause: pauseAudio,
    error: hookError,
    streamType,
    latency,
  } = useEnhancedAudioPlayer({
    volume,
    muted: isMuted,
    onPlay: () => {
      setIsPlaying(true);
      visualizerRef.current?.resume();
    },
    onPause: () => {
      setIsPlaying(false);
      visualizerRef.current?.pause();
    },
    onLoadStart: () => {
      setIsLoading(true);
      visualizerRef.current?.reset();
    },
    onCanPlay: () => setIsLoading(false),
    onError: (err) => {
      setError(err);
      setIsPlaying(false);
      visualizerRef.current?.pause();
    },
  });

  // Register audio controls ONCE
  React.useEffect(() => {
    if (isInitializedRef.current) return;

    setAudioControls({
      play: playAudio,
      pause: pauseAudio,
      setVolume: () => {}, // store is owner
      setMuted: () => {}, // store is owner
    });

    isInitializedRef.current = true;
  }, [setAudioControls, playAudio, pauseAudio]);

  React.useEffect(() => {
    // reflect hook streamType into store
    setStreamType(streamType);
  }, [streamType, setStreamType]);

  // Ignore hotkeys when typing in inputs
  const ignoreIfFormElement = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return false;
    const tag = target.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      (target as HTMLElement).isContentEditable
    );
  };

  /* -----------------------------
     CONTROLS
  ----------------------------- */

  const handlePlayPause = async () => {
    if (storeIsLoading || isChangingStationRef.current) return;

    if (isPlaying) {
      pauseAudio();
      return;
    }

    const station = currentStation ?? stations[currentStationIndex];
    if (!station) return;

    visualizerRef.current?.reset();
    play(station);
  };

  const handleNext = async () => {
    if (storeIsLoading || isChangingStationRef.current) return;
    isChangingStationRef.current = true;

    try {
      pauseAudio();
      nextStation();
      const { stations: s, currentStationIndex: i } = useRadioStore.getState();
      const station = s[i];
      if (station) await playAudio(station);
    } finally {
      isChangingStationRef.current = false;
    }
  };

  const handlePrevious = async () => {
    if (storeIsLoading || isChangingStationRef.current) return;
    isChangingStationRef.current = true;

    try {
      pauseAudio();
      previousStation();
      const { stations: s, currentStationIndex: i } = useRadioStore.getState();
      const station = s[i];
      if (station) await playAudio(station);
    } finally {
      isChangingStationRef.current = false;
    }
  };

  /* -----------------------------
     HOTKEYS (prevent default to stop scrolling)
  ----------------------------- */

  const isDesktop =
    typeof window !== "undefined" && !("ontouchstart" in window);

  useHotkeys(
    "space",
    (e: KeyboardEvent) => {
      if (ignoreIfFormElement(e)) return;
      e.preventDefault();
      handlePlayPause();
    },
    { enabled: isDesktop },
    [handlePlayPause]
  );

  useHotkeys(
    "left",
    (e: KeyboardEvent) => {
      if (ignoreIfFormElement(e)) return;
      e.preventDefault();
      handlePrevious();
    },
    { enabled: isDesktop },
    [handlePrevious]
  );

  useHotkeys(
    "right",
    (e: KeyboardEvent) => {
      if (ignoreIfFormElement(e)) return;
      e.preventDefault();
      handleNext();
    },
    { enabled: isDesktop },
    [handleNext]
  );

  useHotkeys(
    "up",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event)) return;
      event.preventDefault();
      updateVolume(Math.min(1, +(volume + 0.1).toFixed(2)));
    },
    { enabled: isDesktop },
    [volume, updateVolume]
  );

  useHotkeys(
    "down",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event)) return;
      event.preventDefault();
      updateVolume(Math.max(0, +(volume - 0.1).toFixed(2)));
    },
    { enabled: isDesktop },
    [volume, updateVolume]
  );

  useHotkeys(
    "m",
    (e: KeyboardEvent) => {
      if (ignoreIfFormElement(e)) return;
      e.preventDefault();
      updateMuted(!isMuted);
    },
    { enabled: isDesktop },
    [isMuted, updateMuted]
  );

  if (!showPlayer || stations.length === 0) return null;

  // Display volume: visual should show 0 when muted (familiar UX)
  const displayVolume = isMuted ? 0 : volume;

  return (
    <>
      {/* Hidden audio */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        style={{ display: "none" }}
      />

      <Box className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-700/50 bg-[#0C1521]/95">
        <Container size="4" className="py-3">
          <Flex align="center" justify="between" gap="4">
            {/* LEFT */}
            <Flex align="center" gap="3" className="flex-1 min-w-0">
              <div className="w-12 h-12 bg-[#FF914D]/20 rounded-lg flex items-center justify-center">
                {storeIsLoading ? (
                  <div className="w-6 h-6 border-2 border-[#FF914D] border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Disc3 size={26} className="text-[#FF914D] animate-spin" />
                ) : (
                  <Unplug size={26} className="text-[#FF914D]" />
                )}
              </div>

              <Flex direction="column" gap="1" className="min-w-0">
                <Text size="3" weight="medium" className="truncate">
                  {currentStation?.name ?? "No Station"}
                </Text>
                <Flex gap="2" align="center" className="text-xs text-slate-400">
                  {latency > 0 && (
                    <>
                      <Clock size={12} />
                      <span>
                        {latency < 1
                          ? `${Math.round(latency * 1000)}ms`
                          : `${latency.toFixed(1)}s`}
                      </span>
                    </>
                  )}
                </Flex>
              </Flex>
            </Flex>

            {/* CENTER */}
            <Flex align="center" gap="2">
              <Button onClick={handlePrevious}>
                <SkipBack size={18} />
              </Button>

              <Button
                size="3"
                onClick={handlePlayPause}
                className="w-12 h-12 rounded-full bg-[#FF914D] hover:bg-[#FF914D]/90 text-white"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </Button>

              <Button onClick={handleNext}>
                <SkipForward size={18} />
              </Button>
            </Flex>

            {/* RIGHT — OLD VOLUME UI */}
            <Flex align="center" gap="3">
              <Button
                variant="ghost"
                onClick={() => updateMuted(!isMuted)}
                className="hover:bg-[#FF914D]/10"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={20} color={ORANGE} />
                ) : (
                  <Volume2 size={20} color={ORANGE} />
                )}
              </Button>

              <div className="w-20 hidden md:block">
                <Slider.Root
                  min={0}
                  max={1}
                  step={0.01}
                  value={[displayVolume]}
                  onValueChange={(v) => updateVolume(+v[0].toFixed(2))}
                  className="relative flex items-center w-full h-5"
                >
                  <Slider.Track className="relative w-full h-1 bg-slate-700 rounded-lg">
                    <Slider.Range
                      className="absolute h-full rounded-lg"
                      style={{ background: ORANGE }}
                    />
                  </Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded-full shadow" />
                </Slider.Root>
              </div>
              <Text size="1" className="text-[#FF914D] min-w-8 hidden lg:block">
                {Math.round(displayVolume * 100)}%
              </Text>
              <AudioVisualizer
                ref={visualizerRef}
                barCount={12}
                barWidth={6}
                barSpacing={2}
                maxHeight={40}
                decay={0.88}
                isLoading={storeIsLoading}
                isPaused={!isPlaying || storeIsLoading}
              />
              <ImmersiveVisualizer
                currentStation={currentStationIndex}
                streamType={streamType}
                audioRef={audioRef}
              />
            </Flex>
          </Flex>
        </Container>
      </Box>
    </>
  );
};

export default GlobalPlayer;
