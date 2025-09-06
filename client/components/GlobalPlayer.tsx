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
} from "lucide-react";
import { useRadioStore } from "@/store/useRadiostore";
import * as Slider from "@radix-ui/react-slider";
import { useHotkeys } from "react-hotkeys-hook";
import AudioVisualizer from "./AudioVisualizer";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

const GlobalPlayer: React.FC = () => {
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
    setVolume,
    setError,
    setIsLoading,
    setIsPlaying,
  } = useRadioStore();

  // Use our custom audio player hook
  const {
    audioRef,
    audioElement,
    isLoading: audioLoading,
    error: audioError,
    play: playAudio,
    pause: pauseAudio,
    stop: stopAudio,
    setVolume: setAudioVolume,
    setMuted: setAudioMuted,
  } = useAudioPlayer({
    volume,
    muted: isMuted,
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
    },
    onLoadStart: () => {
      setIsLoading(true);
    },
    onCanPlay: () => {
      setIsLoading(false);
    },
  });

  // Sync volume changes
  React.useEffect(() => {
    setAudioVolume(volume);
  }, [volume, setAudioVolume]);

  // Sync mute changes
  React.useEffect(() => {
    setAudioMuted(isMuted);
  }, [isMuted, setAudioMuted]);

  // Update store loading state
  React.useEffect(() => {
    setIsLoading(audioLoading);
  }, [audioLoading, setIsLoading]);

  // Update store error state
  React.useEffect(() => {
    if (audioError) {
      setError(audioError);
    }
  }, [audioError, setError]);

  const handleNextStation = React.useCallback(() => {
    nextStation();
    if (isPlaying && (stations[currentStationIndex + 1] || stations[0])) {
      const nextStationData = stations[currentStationIndex + 1] || stations[0];
      playAudio(nextStationData).catch(console.error);
    }
  }, [nextStation, isPlaying, stations, currentStationIndex, playAudio]);

  const handlePreviousStation = React.useCallback(() => {
    previousStation();
    const prevIndex =
      currentStationIndex === 0 ? stations.length - 1 : currentStationIndex - 1;
    if (isPlaying && stations[prevIndex]) {
      playAudio(stations[prevIndex]).catch(console.error);
    }
  }, [previousStation, currentStationIndex, stations, isPlaying, playAudio]);

  const handlePlayPause = React.useCallback(async () => {
    if (!currentStation && stations.length > 0) {
      // Start playing the current station
      const stationToPlay = stations[currentStationIndex];
      try {
        await playAudio(stationToPlay);
        play(stationToPlay);
      } catch (error) {
        console.error('Failed to play station:', error);
      }
    } else if (currentStation) {
      if (isPlaying) {
        pauseAudio();
        togglePlayPause();
      } else {
        try {
          await playAudio(currentStation);
          togglePlayPause();
        } catch (error) {
          console.error('Failed to resume playback:', error);
        }
      }
    }
  }, [currentStation, togglePlayPause, stations, currentStationIndex, playAudio, play, isPlaying, pauseAudio]);

  // Handle store play action
  React.useEffect(() => {
    if (currentStation && isPlaying && audioElement && audioElement.paused) {
      playAudio(currentStation).catch(console.error);
    }
  }, [currentStation, isPlaying, audioElement, playAudio]);

  // Desktop detection — only enable hotkeys on non-touch devices
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
      if (isMuted) {
        toggleMute();
      }
      const newVol = Math.min(1, Math.round((volume + 0.1) * 100) / 100);
      setVolume(newVol);
    },
    { enabled: isDesktop },
    [isMuted, toggleMute, volume, setVolume]
  );

  useHotkeys(
    "down",
    (event: KeyboardEvent) => {
      if (ignoreIfFormElement(event)) return;
      event.preventDefault();
      const newVol = Math.max(0, Math.round((volume - 0.1) * 100) / 100);
      setVolume(newVol);
      if (newVol === 0 && !isMuted) {
        toggleMute();
      }
    },
    { enabled: isDesktop },
    [volume, setVolume, isMuted, toggleMute]
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

  if (!showPlayer || stations.length === 0) {
    return null;
  }

  return (
    <>
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        preload="none"
        style={{ display: 'none' }}
      />

      {/* Fixed Bottom Player */}
      <Box className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-700/50 backdrop-blur-md bg-[#0C1521]/95">
        <Container size="4" className="py-3">
          <Flex align="center" justify="between" gap="4">
            {/* Left: Station Info */}
            <Flex align="center" gap="3" className="flex-1 min-w-0">
              <div className="w-12 h-12 bg-[#FF914D]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Radio size={20} className="text-[#FF914D]" />
              </div>
              <Flex gap="1" align="center">
                <Text
                  size="3"
                  weight="medium"
                  className="text-foreground truncate"
                >
                  {currentStation?.name || "No Station"} •
                </Text>
                <Text size="2" className="text-slate-400 truncate">
                  {currentStation?.country || "Unknown"}
                </Text>
              </Flex>
            </Flex>

            {/* Center: Playback Controls */}
            <Button
              size="2"
              onClick={handlePreviousStation}
              disabled={stations.length === 0}
              title="Previous Station"
              className="hover:bg-[#FF914D]/10"
            >
              <SkipBack size={18} />
            </Button>

            <Button
              size="3"
              onClick={handlePlayPause}
              disabled={stations.length === 0 || audioLoading}
              title={isPlaying ? "Pause" : "Play"}
              className="w-12 h-12 rounded-full"
            >
              {audioLoading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause size={20} />
              ) : (
                <Play size={20} />
              )}
            </Button>

            <Button
              size="2"
              onClick={handleNextStation}
              disabled={stations.length === 0}
              title="Next Station"
              className="hover:bg-[#FF914D]/10"
            >
              <SkipForward size={18} />
            </Button>

            {/* Right: Volume & Visualizer */}
            <Flex align="center" gap="3" className="flex-shrink-0">
              <Button
                variant="ghost"
                size="2"
                onClick={toggleMute}
                disabled={!currentStation}
                title={isMuted ? "Unmute" : "Mute"}
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
                    setVolume(newVolume);
                    if (newVolume === 0 && !isMuted) {
                      toggleMute();
                    } else if (newVolume > 0 && isMuted) {
                      toggleMute();
                    }
                  }}
                >
                  <Slider.Track className="relative w-full h-1 rounded-lg bg-gray-600">
                    <Slider.Range
                      className="absolute h-full rounded-lg"
                      style={{
                        background: `linear-gradient(to right, #FF914D 0%, #FF914D ${
                          (isMuted ? 0 : volume) * 100
                        }%, #374151 ${
                          (isMuted ? 0 : volume) * 100
                        }%, #374151 100%)`,
                      }}
                    />
                  </Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded-full shadow focus:outline-none" />
                </Slider.Root>
              </div>

              <Text size="1" className="text-[#FF914D] min-w-8 hidden lg:block">
                {Math.round(volume * 100)}%
              </Text>
               <AudioVisualizer
  audioElement={audioRef.current}
  className="hidden lg:flex"
  barCount={12} 
  barWidth={6}
  barSpacing={2}
  maxHeight={40}
  sensitivity={1}
/>
            </Flex>
          </Flex>

          {/* Error Message */}
          {audioError && (
            <Text size="1" className="text-red-400 text-center mt-2">
              {audioError}
            </Text>
          )}
        </Container>
      </Box>
    </>
  );
};

export default GlobalPlayer;