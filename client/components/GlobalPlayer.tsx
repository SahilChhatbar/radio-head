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
} from "lucide-react";
import { useRadioStore } from "@/store/useRadiostore";
import * as Slider from "@radix-ui/react-slider";
import { useHotkeys } from "react-hotkeys-hook";
import AudioVisualizer from "./AudioVisualizer";
import { useEnhancedAudioPlayer } from "@/hooks/useAudioPlayer";

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

  // Use our enhanced audio player hook
  const {
    audioRef,
    audioElement,
    isLoading: audioLoading,
    error: audioError,
    streamType,
    latency,
    play: playAudio,
    pause: pauseAudio,
    stop: stopAudio,
    setVolume: setAudioVolume,
    setMuted: setAudioMuted,
  } = useEnhancedAudioPlayer({
    volume,
    muted: isMuted,
    preferredLatency: 'low', // Optimize for low latency
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

  // Get stream type display info
  const getStreamTypeInfo = () => {
    switch (streamType) {
      case 'hls':
        return { icon: <Wifi size={14} />, label: 'HLS', color: '#10B981' };
      case 'tone':
        return { icon: <Radio size={14} />, label: 'Enhanced', color: '#8B5CF6' };
      case 'html5':
        return { icon: <Radio size={14} />, label: 'Standard', color: '#6B7280' };
      default:
        return { icon: <WifiOff size={14} />, label: 'Unknown', color: '#6B7280' };
    }
  };

  // Format latency display
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
            {/* Left: Station Info with Enhanced Details */}
            <Flex align="center" gap="3" className="flex-1 min-w-0">
              <div className="w-12 h-12 bg-[#FF914D]/20 rounded-lg flex items-center justify-center flex-shrink-0 relative">
                <Radio size={20} className="text-[#FF914D]" />
                {/* Stream type indicator */}
                <div 
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                  style={{ backgroundColor: `${streamInfo.color}20`, color: streamInfo.color }}
                  title={`Stream Type: ${streamInfo.label}`}
                >
                  {streamInfo.icon}
                </div>
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
                
                {/* Stream info row */}
                <Flex gap="3" align="center" className="text-xs">
                  <Flex gap="1" align="center" style={{ color: streamInfo.color }}>
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
                </Flex>
              </Flex>
            </Flex>

            {/* Center: Playback Controls */}
            <Flex align="center" gap="2">
              <Button
                size="2"
                onClick={handlePreviousStation}
                disabled={stations.length === 0}
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
                disabled={stations.length === 0}
                title="Next Station (→ key)"
                className="hover:bg-[#FF914D]/10"
              >
                <SkipForward size={18} />
              </Button>
            </Flex>

            {/* Right: Volume & Visualizer */}
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

              {/* Volume Slider - Hidden on small screens */}
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
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded-full focus:outline-none " />
                </Slider.Root>
              </div>

              {/* Volume Percentage - Hidden on smaller screens */}
              <Text size="1" className="text-[#FF914D] min-w-8 hidden lg:block">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </Text>

              {/* Audio Visualizer with enhanced audio element support */}
              <AudioVisualizer
                audioElement={audioRef.current}
                className="hidden lg:flex"
                barCount={12}
                barWidth={6}
                barSpacing={2}
                maxHeight={40}
                sensitivity={streamType === 'tone' ? 1.2 : 1.0} // Higher sensitivity for Tone.js
              />
            </Flex>
          </Flex>

          {/* Enhanced Error/Status Message */}
          {audioError && (
            <Flex align="center" gap="2" className="mt-2 p-2 bg-red-500/10 rounded border border-red-500/20">
              <WifiOff size={16} className="text-red-400 flex-shrink-0" />
              <Text size="2" className="text-red-400 flex-1">
                {audioError}
              </Text>
              {streamType && (
                <Text size="1" className="text-red-400/70">
                  ({streamInfo.label} stream)
                </Text>
              )}
            </Flex>
          )}

          {/* Loading Status */}
          {audioLoading && !audioError && (
            <Flex align="center" gap="2" className="mt-2">
              <div className="w-4 h-4 border-2 border-[#FF914D] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <Text size="2" className="text-slate-400">
                Loading {streamInfo.label.toLowerCase()} stream...
              </Text>
            </Flex>
          )}

          {/* Stream Quality Indicator (Development only) */}
          {process.env.NODE_ENV === 'development' && streamType && !audioError && !audioLoading && (
            <Flex align="center" gap="3" className="mt-2 text-xs text-slate-500">
              <span>Stream: {streamInfo.label}</span>
              {latency > 0 && <span>Latency: {formatLatency(latency)}</span>}
              {currentStation?.codec && <span>Codec: {currentStation.codec.toUpperCase()}</span>}
            </Flex>
          )}
        </Container>
      </Box>
    </>
  );
};

export default GlobalPlayer;