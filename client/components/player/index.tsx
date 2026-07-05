"use client";

import React, { useMemo, useCallback, memo } from "react";
import { Button, Flex, Box, Container } from "@radix-ui/themes";
import { SkipBack, SkipForward, Play, Pause } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";

import { useRadioStore } from "@/store/useRadiostore";
import { useEnhancedAudioPlayer } from "@/hooks/useAudioPlayer";
import AudioVisualizer, {
  AudioVisualizerHandle,
} from "@/components/player/AudioVisualizer";
import ImmersiveVisualizer from "@/components/immersive-mode";
import FavoriteButton from "@/components/favourites/FavoriteButton";

import StationIcon from "./StationIcon";
import StationInfo from "./StationInfo";
import VolumeControl from "./VolumeControl";
import { buttonSize } from "./constants";

const GlobalPlayer: React.FC = () => {
  const visualizerRef = React.useRef<AudioVisualizerHandle>(null);
  const isChangingStationRef = React.useRef(false);
  const isInitializedRef = React.useRef(false);

  const stations = useRadioStore((state) => state.stations);
  const currentStation = useRadioStore((state) => state.currentStation);
  const currentStationIndex = useRadioStore(
    (state) => state.currentStationIndex,
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
      [setError, setIsPlaying],
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
    [handlePlayPause],
  );

  useHotkeys(
    "left",
    (e: KeyboardEvent) => {
      if (ignoreIfFormElement(e)) return;
      e.preventDefault();
      handlePrevious();
    },
    { enabled: isDesktop },
    [handlePrevious],
  );

  useHotkeys(
    "right",
    (e: KeyboardEvent) => {
      if (ignoreIfFormElement(e)) return;
      e.preventDefault();
      handleNext();
    },
    { enabled: isDesktop },
    [handleNext],
  );

  useHotkeys(
    "up",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event)) return;
      event.preventDefault();
      updateVolume(Math.min(1, +(volume + 0.1).toFixed(2)));
    },
    { enabled: isDesktop },
    [volume, updateVolume],
  );

  useHotkeys(
    "down",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event)) return;
      event.preventDefault();
      updateVolume(Math.max(0, +(volume - 0.1).toFixed(2)));
    },
    { enabled: isDesktop },
    [volume, updateVolume],
  );

  useHotkeys(
    "m",
    (e: KeyboardEvent) => {
      if (ignoreIfFormElement(e)) return;
      e.preventDefault();
      updateMuted(!isMuted);
    },
    { enabled: isDesktop },
    [isMuted, updateMuted],
  );

  const displayVolume = useMemo(
    () => (isMuted ? 0 : volume),
    [isMuted, volume],
  );

  const visualizerState = useMemo(
    () => ({
      isLoading: storeIsLoading,
      isPaused: !isPlaying || storeIsLoading,
    }),
    [storeIsLoading, isPlaying],
  );

  const handleVolumeChange = useCallback(
    (v: number[]) => {
      updateVolume(+v[0].toFixed(2));
    },
    [updateVolume],
  );

  const handleMuteToggle = useCallback(() => {
    updateMuted(!isMuted);
  }, [isMuted, updateMuted]);

  // Conditions & Derived UI values extracted for cleaner JSX
  const shouldShowUI = showPlayer && stations.length > 0;
  const PlayPauseIcon = isPlaying ? Pause : Play;
  const stationName = currentStation?.name ?? "No Station";
  const stationVotes = currentStation?.votes;

  return (
    <>
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        style={{ display: "none" }}
      />
      {shouldShowUI && (
        <Box
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-700/50 bg-[#0C1521]/95"
          style={{
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <Container
            size="4"
            style={{ padding: "var(--spacing-xs) var(--container-padding-x)" }}
          >
            <Flex
              align="center"
              justify="between"
              className="flex-wrap sm:flex-nowrap w-full"
              gap="2"
              style={{ gap: "var(--spacing-sm)" }}
            >
              <Flex
                align="center"
                gap="3"
                className="flex-1 min-w-0 order-2 sm:order-1"
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
                  <StationIcon
                    isLoading={storeIsLoading}
                    isPlaying={isPlaying}
                  />
                </div>
                <StationInfo
                  name={stationName}
                  latency={latency}
                  votes={stationVotes}
                />
                <FavoriteButton station={currentStation} />
              </Flex>
              <Flex
                align="center"
                justify="center"
                gap="2"
                className="order-1 w-full sm:order-2 sm:w-auto pt-2 sm:pt-0"
                style={{ gap: "var(--spacing-xs)" }}
              >
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
                  <PlayPauseIcon />
                </Button>

                <Button
                  onClick={handleNext}
                  style={{ padding: "var(--spacing-xs)" }}
                >
                  <SkipForward />
                </Button>
              </Flex>

              <Flex
                align="center"
                justify="end"
                gap="3"
                className="order-2 sm:order-3 sm:flex-1"
                style={{ gap: "var(--spacing-sm)" }}
              >
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
      )}
    </>
  );
};

export default memo(GlobalPlayer);
