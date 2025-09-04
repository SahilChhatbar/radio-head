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
import ReactHowler from "react-howler";
import { useHotkeys } from "react-hotkeys-hook";
import AudioVisualizer from "./AudioVisualizer";
const GlobalPlayer: React.FC = () => {
  const {
    stations,
    currentStationIndex,
    currentStation,
    isPlaying,
    volume,
    isMuted,
    isLoading: playerLoading,
    error: playerError,
    showPlayer,
    nextStation,
    previousStation,
    play,
    togglePlayPause,
    toggleMute,
    setVolume,
    setError,
    setIsLoading,
  } = useRadioStore();
  // howler ref + audio node state
  const howlerRef = React.useRef<any>(null);
  const [audioNode, setAudioNode] = React.useState<HTMLMediaElement | null>(
    null
  );
  // Extract the HTMLAudioElement from ReactHowler when it becomes available
  React.useEffect(() => {
    let mounted = true;
    let attempts = 0;
    const maxAttempts = 10;
    const intervalMs = 250;
    const findNode = () => {
      try {
        const sounds = howlerRef.current?.howler?._sounds ?? [];
        const candidate = sounds?.[0]?._node ?? sounds?.[0]?.node ?? null;
        if (candidate && candidate instanceof HTMLMediaElement) {
          try {
            // ensure CORS for analyser usage
            if (!candidate.crossOrigin) {
              // some browsers block setting crossOrigin if read-only, so ignore errors
              // @ts-ignore
              candidate.crossOrigin = "anonymous";
            }
          } catch {}
          if (mounted) setAudioNode(candidate);
          return true;
        }
        return false;
      } catch (err) {
        return false;
      }
    };
    // try immediately
    if (!findNode()) {
      // retry a few times (Howler may create the node after play is triggered)
      const tid = window.setInterval(() => {
        attempts += 1;
        if (findNode() || attempts >= maxAttempts) {
          window.clearInterval(tid);
        }
      }, intervalMs);
      // clean up
      return () => {
        mounted = false;
        window.clearInterval(tid);
      };
    }
    return () => {
      mounted = false;
    };
  }, [howlerRef.current, currentStation, isPlaying, volume]);
  const handleNextStation = React.useCallback(() => {
    nextStation();
    if (isPlaying && (stations[currentStationIndex + 1] || stations[0])) {
      const nextStationData = stations[currentStationIndex + 1] || stations[0];
      play(nextStationData);
    }
  }, [nextStation, isPlaying, stations, currentStationIndex, play]);
  const handlePreviousStation = React.useCallback(() => {
    previousStation();
    const prevIndex =
      currentStationIndex === 0 ? stations.length - 1 : currentStationIndex - 1;
    if (isPlaying && stations[prevIndex]) {
      play(stations[prevIndex]);
    }
  }, [previousStation, currentStationIndex, stations, isPlaying, play]);
  const handlePlayPause = React.useCallback(() => {
    if (currentStation) {
      togglePlayPause();
    } else if (stations.length > 0) {
      play(stations[currentStationIndex]);
    }
  }, [currentStation, togglePlayPause, stations, currentStationIndex, play]);
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
      {/* Howler Player */}
      {currentStation && (
        <ReactHowler
          ref={howlerRef}
          src={currentStation.url_resolved || currentStation.url}
          playing={isPlaying}
          volume={isMuted ? 0 : volume}
          onLoad={() => setIsLoading(false)}
          onLoadError={(id, error) => {
            console.error("Howler load error:", error);
            setError("Failed to load station");
            setIsLoading(false);
          }}
          onPlayError={(id, error) => {
            console.error("Howler play error:", error);
            setError("Failed to play station");
            setIsLoading(false);
          }}
          onPlay={() => setError(null)}
          format={["mp3", "aac", "ogg", "wav"]}
          html5={true}
        />
      )}
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
              disabled={stations.length === 0 || playerLoading}
              title={isPlaying ? "Pause" : "Play"}
              className="w-12 h-12 rounded-full"
            >
              {playerLoading ? (
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
                audioElement={audioNode}
                className="hidden lg:flex"
                barCount={8}
                barWidth={2}
                barSpacing={3}
                maxHeight={24}
              />
            </Flex>
          </Flex>
          {/* Error Message */}
          {playerError && (
            <Text size="1" className="text-red-400 text-center mt-2">
              {playerError}
            </Text>
          )}
        </Container>
      </Box>
    </>
  );
};
export default GlobalPlayer;