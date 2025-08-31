"use client";

import React, { useEffect } from "react";
import { Button, Flex, Text, Box, Container } from "@radix-ui/themes";
import { SkipBack, SkipForward, Play, Pause, Volume2, VolumeX, Radio } from "lucide-react";
import { useRadioStore } from "@/store/useRadiostore";
import * as Slider from "@radix-ui/react-slider";
import ReactHowler from 'react-howler';

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

  const handleNextStation = () => {
    nextStation();
    if (isPlaying && stations[currentStationIndex + 1] || stations[0]) {
      const nextStationData = stations[currentStationIndex + 1] || stations[0];
      play(nextStationData);
    }
  };

  const handlePreviousStation = () => {
    previousStation();
    const prevIndex = currentStationIndex === 0 ? stations.length - 1 : currentStationIndex - 1;
    if (isPlaying && stations[prevIndex]) {
      play(stations[prevIndex]);
    }
  };

  const handlePlayPause = () => {
    if (currentStation) {
      togglePlayPause();
    } else if (stations.length > 0) {
      play(stations[currentStationIndex]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          handlePreviousStation();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handleNextStation();
          break;
        case 'ArrowUp':
          event.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          event.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          break;
        case 'KeyM':
          event.preventDefault();
          toggleMute();
          break;
      }
    };

    // Only add event listener on desktop (non-touch devices)
    if (typeof window !== 'undefined' && !('ontouchstart' in window)) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handlePlayPause, handleNextStation, handlePreviousStation, volume, setVolume, toggleMute]);

  if (!showPlayer || stations.length === 0) {
    return null;
  }

  return (
    <>
      {/* Howler Player */}
      {currentStation && (
        <ReactHowler
          src={currentStation.url_resolved || currentStation.url}
          playing={isPlaying}
          volume={isMuted ? 0 : volume}
          onLoad={() => setIsLoading(false)}
          onLoadError={(id, error) => {
            console.error('Howler load error:', error);
            setError('Failed to load station');
            setIsLoading(false);
          }}
          onPlayError={(id, error) => {
            console.error('Howler play error:', error);
            setError('Failed to play station');
            setIsLoading(false);
          }}
          onPlay={() => setError(null)}
          format={['mp3', 'aac', 'ogg', 'wav']}
          html5={true}
        />
      )}

      {/* Fixed Bottom Player */}
      <Box className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-700/50 backdrop-blur-md bg-[#0c1521]/95">
        <Container size="4" className="py-3">
          <Flex align="center" justify="between" gap="4">
            {/* Left: Station Info */}
            <Flex align="center" gap="3" className="flex-1 min-w-0">
              <div className="w-12 h-12 bg-[#ff914d]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Radio size={20} className="text-[#ff914d]" />
              </div>
              <Flex direction="column" className="min-w-0 flex-1">
                <Text size="3" weight="medium" className="text-foreground truncate">
                  {currentStation?.name || "No Station"}
                </Text>
                <Text size="2" className="text-slate-400 truncate">
                  {currentStation?.country || "Unknown"} • {currentStation?.codec || "Unknown"}
                </Text>
              </Flex>
            </Flex>

            {/* Center: Playback Controls */}
            <Flex align="center" gap="2" className="flex-shrink-0">
              <Button
                size="2"
                onClick={handlePreviousStation}
                disabled={stations.length === 0}
                title="Previous Station"
                className="hover:bg-[#ff914d]/10"
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
                className="hover:bg-[#ff914d]/10"
              >
                <SkipForward size={18} />
              </Button>
            </Flex>

            {/* Right: Volume & Station Counter */}
            <Flex align="center" gap="3" className="flex-1 justify-end min-w-0">
              {/* Volume Control */}
              <Flex align="center" gap="2" className="hidden sm:flex">
                <Button
                  variant="ghost"
                  size="2"
                  onClick={toggleMute}
                  disabled={!currentStation}
                  title={isMuted ? "Unmute" : "Mute"}
                  className="hover:bg-[#ff914d]/10"
                >
                  {isMuted || volume==0 ? <VolumeX size={20} color="#ff914d"/> : <Volume2 size={20} color="#ff914d"/>}
                </Button>
                <div className="w-20 hidden md:block">
                  <Slider.Root
  className="relative flex items-center w-full h-5 select-none"
  min={0}
  max={1}
  step={0.05}
  value={[isMuted ? 0 : volume]}
  onValueChange={(val) => setVolume(val[0])}
>
  <Slider.Track className="relative w-full h-1 rounded-lg bg-gray-600">
    <Slider.Range
      className="absolute h-full rounded-lg"
      style={{
        background: `linear-gradient(to right, #ff914d 0%, #ff914d ${(isMuted ? 0 : volume) * 100}%, #374151 ${(isMuted ? 0 : volume) * 100}%, #374151 100%)`
      }}
    />
  </Slider.Track>
  <Slider.Thumb className="block w-4 h-4 bg-white rounded-full shadow focus:outline-none" />
</Slider.Root>

                </div>
                <Text size="1" className="text-[#ff914d] min-w-8 hidden lg:block">
                  {Math.round(volume * 100)}%
                </Text>
              </Flex>

              {/* Station Counter & Keyboard Shortcuts */}
              <Flex align="center" gap="3" className="hidden sm:flex">
                <Text size="1" className="text-slate-500">
                  {currentStationIndex + 1}/{stations.length}
                </Text>
              </Flex>
            </Flex>
          </Flex>

          {/* Error Message */}
          {playerError && (
            <Box className="mt-2">
              <Text size="1" className="text-red-400 text-center">
                {playerError}
              </Text>
            </Box>
          )}
        </Container>
      </Box>
    </>
  );
};

export default GlobalPlayer;