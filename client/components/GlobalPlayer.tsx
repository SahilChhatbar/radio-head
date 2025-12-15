"use client";

import React, { useMemo, useCallback, memo } from "react";
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

// Memoized icon component - prevents re-render on volume change
const StationIcon = memo(
  ({ isLoading, isPlaying }: { isLoading: boolean; isPlaying: boolean }) => {
    if (isLoading) {
      return (
        <div className="w-6 h-6 border-2 border-[#FF914D] border-t-transparent rounded-full animate-spin" />
      );
    }
    if (isPlaying) {
      return <Disc3 size={26} className="text-[#FF914D] animate-spin" />;
    }
    return <Unplug size={26} className="text-[#FF914D]" />;
  }
);
StationIcon.displayName = "StationIcon";

// Memoized station info - prevents re-render on volume change
const StationInfo = memo(
  ({ name, latency }: { name: string; latency: number }) => (
    <Flex direction="column" gap="1" className="min-w-0">
      <Text size="3" weight="medium" className="truncate">
        {name}
      </Text>
      {latency > 0 && (
        <Flex gap="2" align="center" className="text-xs text-slate-400">
          <Clock size={12} />
          <span>
            {latency < 1
              ? `${Math.round(latency * 1000)}ms`
              : `${latency.toFixed(1)}s`}
          </span>
        </Flex>
      )}
    </Flex>
  )
);
StationInfo.displayName = "StationInfo";

// Memoized volume control - only this re-renders on volume change
const VolumeControl = memo(
  ({
    isMuted,
    volume,
    displayVolume,
    onMuteToggle,
    onVolumeChange,
  }: {
    isMuted: boolean;
    volume: number;
    displayVolume: number;
    onMuteToggle: () => void;
    onVolumeChange: (v: number[]) => void;
  }) => (
    <>
      <Button
        variant="ghost"
        onClick={onMuteToggle}
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
          onValueChange={onVolumeChange}
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
    </>
  )
);
VolumeControl.displayName = "VolumeControl";

const GlobalPlayer: React.FC = () => {
  const visualizerRef = React.useRef<AudioVisualizerHandle>(null);
  const isChangingStationRef = React.useRef(false);
  const isInitializedRef = React.useRef(false);

  // Granular subscriptions - only subscribe to what we need
  const stations = useRadioStore((state) => state.stations);
  const currentStation = useRadioStore((state) => state.currentStation);
  const currentStationIndex = useRadioStore(
    (state) => state.currentStationIndex
  );
  const isPlaying = useRadioStore((state) => state.isPlaying);
  const storeIsLoading = useRadioStore((state) => state.isLoading);
  const volume = useRadioStore((state) => state.volume);
  const isMuted = useRadioStore((state) => state.isMuted);
  const showPlayer = useRadioStore((state) => state.showPlayer);

  // Get actions from store (these don't cause re-renders)
  const play = useRadioStore((state) => state.play);
  const nextStation = useRadioStore((state) => state.nextStation);
  const previousStation = useRadioStore((state) => state.previousStation);
  const updateVolume = useRadioStore((state) => state.updateVolume);
  const updateMuted = useRadioStore((state) => state.updateMuted);
  const setAudioControls = useRadioStore((state) => state.setAudioControls);
  const setIsPlaying = useRadioStore((state) => state.setIsPlaying);
  const setIsLoading = useRadioStore((state) => state.setIsLoading);
  const setError = useRadioStore((state) => state.setError);
  const setStreamType = useRadioStore((state) => state.setStreamType);

  const {
    audioRef,
    play: playAudio,
    pause: pauseAudio,
    streamType,
    latency,
  } = useEnhancedAudioPlayer({
    volume,
    muted: isMuted,
    onPlay: useCallback(() => {
      setIsPlaying(true);
      visualizerRef.current?.resume();
    }, [setIsPlaying]),
    onPause: useCallback(() => {
      setIsPlaying(false);
      visualizerRef.current?.pause();
    }, [setIsPlaying]),
    onLoadStart: useCallback(() => {
      setIsLoading(true);
      visualizerRef.current?.reset();
    }, [setIsLoading]),
    onCanPlay: useCallback(() => setIsLoading(false), [setIsLoading]),
    onError: useCallback(
      (err: string) => {
        setError(err);
        setIsPlaying(false);
        visualizerRef.current?.pause();
      },
      [setError, setIsPlaying]
    ),
  });

  React.useEffect(() => {
    if (isInitializedRef.current) return;

    setAudioControls({
      play: playAudio,
      pause: pauseAudio,
      setVolume: () => {},
      setMuted: () => {},
    });

    isInitializedRef.current = true;
  }, [setAudioControls, playAudio, pauseAudio]);

  React.useEffect(() => {
    setStreamType(streamType);
  }, [streamType, setStreamType]);

  const ignoreIfFormElement = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return false;
    const tag = target.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      (target as HTMLElement).isContentEditable
    );
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (storeIsLoading || isChangingStationRef.current) return;

    if (isPlaying) {
      pauseAudio();
      return;
    }

    const station = currentStation ?? stations[currentStationIndex];
    if (!station) return;

    visualizerRef.current?.reset();
    play(station);
  }, [
    storeIsLoading,
    isPlaying,
    currentStation,
    stations,
    currentStationIndex,
    pauseAudio,
    play,
  ]);

  const handleNext = useCallback(async () => {
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
  }, [storeIsLoading, pauseAudio, nextStation, playAudio]);

  const handlePrevious = useCallback(async () => {
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
  }, [storeIsLoading, pauseAudio, previousStation, playAudio]);

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

  const displayVolume = useMemo(
    () => (isMuted ? 0 : volume),
    [isMuted, volume]
  );

  const visualizerState = useMemo(
    () => ({
      isLoading: storeIsLoading,
      isPaused: !isPlaying || storeIsLoading,
    }),
    [storeIsLoading, isPlaying]
  );

  // Memoize volume change handler to prevent recreation
  const handleVolumeChange = useCallback(
    (v: number[]) => {
      updateVolume(+v[0].toFixed(2));
    },
    [updateVolume]
  );

  // Memoize mute toggle
  const handleMuteToggle = useCallback(() => {
    updateMuted(!isMuted);
  }, [isMuted, updateMuted]);

  if (!showPlayer || stations.length === 0) return null;

  return (
    <>
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        style={{ display: "none" }}
      />

      <Box className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-700/50 bg-[#0C1521]/95">
        <Container size="4" className="py-3">
          <Flex align="center" justify="between" gap="4">
            <Flex align="center" gap="3" className="flex-1 min-w-0">
              <div className="w-12 h-12 bg-[#FF914D]/20 rounded-lg flex items-center justify-center">
                <StationIcon isLoading={storeIsLoading} isPlaying={isPlaying} />
              </div>

              <StationInfo
                name={currentStation?.name ?? "No Station"}
                latency={latency}
              />
            </Flex>

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

            <Flex align="center" gap="3">
              <VolumeControl
                isMuted={isMuted}
                volume={volume}
                displayVolume={displayVolume}
                onMuteToggle={handleMuteToggle}
                onVolumeChange={handleVolumeChange}
              />
              <AudioVisualizer
                ref={visualizerRef}
                isLoading={visualizerState.isLoading}
                isPaused={visualizerState.isPaused}
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

export default memo(GlobalPlayer);
