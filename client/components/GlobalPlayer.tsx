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
  FlameIcon,
} from "lucide-react";
import * as Slider from "@radix-ui/react-slider";
import { useHotkeys } from "react-hotkeys-hook";

import { useRadioStore } from "@/store/useRadiostore";
import { useEnhancedAudioPlayer } from "@/hooks/useAudioPlayer";
import AudioVisualizer, { AudioVisualizerHandle } from "./AudioVisualizer";
import ImmersiveVisualizer from "./ImmersiveMode";
import { formatVotes } from "@/utils/formatting";

const ORANGE = "#FF914D";

const iconSize = "clamp(16px, 2vw, 2.5rem)";
const buttonSize = "clamp(2.5rem, 3vw, 3.5rem)";

const StationIcon = memo(
  ({ isLoading, isPlaying }: { isLoading: boolean; isPlaying: boolean }) => {
    if (isLoading) {
      return (
        <div
          className="border-2 border-[#FF914D] border-t-transparent rounded-full animate-spin"
          style={{
            width: iconSize,
            height: iconSize,
          }}
        />
      );
    }
    if (isPlaying) {
      return (
        <Disc3
          className="text-[#FF914D] animate-spin"
          style={{ width: iconSize, height: iconSize }}
        />
      );
    }
    return (
      <Unplug
        className="text-[#FF914D]"
        style={{ width: iconSize, height: iconSize }}
      />
    );
  }
);
StationIcon.displayName = "StationIcon";

const StationInfo = memo(
  ({
    name,
    latency,
    votes,
  }: {
    name: string;
    latency: number;
    votes?: number;
  }) => (
    <Flex
      direction="column"
      gap="1"
      className="min-w-0"
      style={{ gap: "var(--spacing-xs)" }}
    >
      <Text size="3" weight="medium" className="truncate">
        {name}
      </Text>
      {latency > 0 && (
        <Flex
          gap="2"
          align="center"
          style={{ fontSize: "var(--font-size-xs)", gap: "var(--spacing-xs)" }}
        >
          <Clock className="text-[#FF914D]" />
          <Text size="2" className="text-[#FF914D]">
            {latency < 1
              ? `${Math.round(latency * 1000)} ms`
              : `${latency.toFixed(1)}s`}
          </Text>
          <FlameIcon className="text-[#FF914D]" />
          <Text size="2" className="text-[#FF914D]">
            {formatVotes(votes)}
          </Text>
        </Flex>
      )}
    </Flex>
  )
);
StationInfo.displayName = "StationInfo";

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
        style={{ padding: "var(--spacing-xs)" }}
      >
        {isMuted || volume === 0 ? (
          <VolumeX
            color={ORANGE}
            style={{ width: iconSize, height: iconSize }}
          />
        ) : (
          <Volume2
            color={ORANGE}
            style={{ width: iconSize, height: iconSize }}
          />
        )}
      </Button>

      <div
        className="hidden md:block"
        style={{ width: "clamp(60px, 10vw, 100px)" }}
      >
        <Slider.Root
          min={0}
          max={1}
          step={0.01}
          value={[displayVolume]}
          onValueChange={onVolumeChange}
          className="relative flex items-center w-full"
          style={{ height: "clamp(1rem, 1.5vw, 1.5rem)" }}
        >
          <Slider.Track
            className="relative w-full bg-slate-700 rounded-lg"
            style={{ height: "clamp(3px, 0.5vw, 5px)" }}
          >
            <Slider.Range
              className="absolute h-full rounded-lg"
              style={{ background: ORANGE }}
            />
          </Slider.Track>
          <Slider.Thumb
            className="block bg-white rounded-full shadow"
            style={{
              width: "clamp(12px, 2vw, 18px)",
              height: "clamp(12px, 2vw, 18px)",
            }}
          />
        </Slider.Root>
      </div>

      <Text
        size="1"
        className="text-[#FF914D] hidden lg:block"
        style={{ minWidth: "clamp(1.5rem, 3vw, 2.5rem)" }}
      >
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

  const handleVolumeChange = useCallback(
    (v: number[]) => {
      updateVolume(+v[0].toFixed(2));
    },
    [updateVolume]
  );

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

      <Box
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-700/50 bg-[#0C1521]/95"
        style={{
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <Container
          size="4"
          style={{ padding: "var(--spacing-md) var(--container-padding-x)" }}
        >
          <Flex
            align="center"
            justify="between"
            gap="4"
            style={{ gap: "var(--spacing-md)" }}
          >
            <Flex
              align="center"
              gap="3"
              className="flex-1 min-w-0"
              style={{ gap: "var(--spacing-sm)" }}
            >
              <div
                className="bg-[#FF914D]/20 rounded-lg flex items-center justify-center"
                style={{
                  width: buttonSize,
                  height: buttonSize,
                  borderRadius: "var(--radius-md)",
                }}
              >
                <StationIcon isLoading={storeIsLoading} isPlaying={isPlaying} />
              </div>

              <StationInfo
                name={currentStation?.name ?? "No Station"}
                latency={latency}
                votes={currentStation?.votes}
              />
            </Flex>

            <Flex align="center" gap="2" style={{ gap: "var(--spacing-xs)" }}>
              <Button
                onClick={handlePrevious}
                style={{ padding: "var(--spacing-xs)" }}
              >
                <SkipBack />
              </Button>

              <Button
                size="3"
                onClick={handlePlayPause}
                className="rounded-full bg-[#FF914D] hover:bg-[#FF914D]/90 text-white"
                style={{
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isPlaying ? <Pause /> : <Play />}
              </Button>

              <Button
                onClick={handleNext}
                style={{ padding: "var(--spacing-xs)" }}
              >
                <SkipForward />
              </Button>
            </Flex>

            <Flex align="center" gap="3" style={{ gap: "var(--spacing-sm)" }}>
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
