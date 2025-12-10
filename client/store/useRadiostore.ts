// File: client/store/useRadiostore.ts
// Fixed to always show player when playing starts

import { create } from "zustand";
import { RadioStation, RadioPlayerState } from "@/types/index";

interface RadioStore extends RadioPlayerState {
  // State setters
  setCurrentStation: (station: RadioStation | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Player actions
  togglePlayPause: () => void;
  toggleMute: () => void;
  play: (station?: RadioStation) => void;
  stop: () => void;

  // Station management
  stations: RadioStation[];
  currentStationIndex: number;
  setStations: (stations: RadioStation[]) => void;
  setCurrentStationIndex: (index: number) => void;
  nextStation: () => void;
  previousStation: () => void;

  // Country management
  selectedCountry: string;
  setSelectedCountry: (country: string) => void;

  // UI state
  showPlayer: boolean;
  setShowPlayer: (show: boolean) => void;

  // Audio control callbacks (to be set by GlobalPlayer)
  audioControls: {
    play: ((station?: RadioStation) => Promise<void>) | null;
    pause: (() => void) | null;
    setVolume: ((volume: number) => void) | null;
    setMuted: ((muted: boolean) => void) | null;
  };
  setAudioControls: (controls: {
    play: (station?: RadioStation) => Promise<void>;
    pause: () => void;
    setVolume: (volume: number) => void;
    setMuted: (muted: boolean) => void;
  }) => void;

  // Centralized volume control
  updateVolume: (volume: number) => void;
  updateMuted: (muted: boolean) => void;

  // Stream type state
  streamType: "hls" | "tone" | "howler" | null;
  setStreamType: (type: "hls" | "tone" | "howler" | null) => void;
}

export const useRadioStore = create<RadioStore>((set, get) => ({
  // Initial state
  isPlaying: false,
  currentStation: null,
  volume: 0.7,
  isMuted: false,
  isLoading: false,
  error: null,
  stations: [],
  currentStationIndex: 0,
  showPlayer: false,
  selectedCountry: "IN",
  streamType: null,

  // Audio control callbacks
  audioControls: {
    play: null,
    pause: null,
    setVolume: null,
    setMuted: null,
  },

  setAudioControls: (controls) => set({ audioControls: controls }),
  setStreamType: (type) => set({ streamType: type }),

  // State setters
  setCurrentStation: (station) => set({ currentStation: station }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Toggle play/pause
  togglePlayPause: () => {
    const { isPlaying, currentStation, audioControls } = get();
    if (currentStation) {
      if (isPlaying) {
        audioControls.pause?.();
      } else {
        audioControls.play?.(currentStation);
      }
      set({ isPlaying: !isPlaying });
    }
  },

  // Toggle mute - centralized control
  toggleMute: () => {
    const { isMuted, audioControls, volume } = get();
    const newMuted = !isMuted;

    console.log(`🔇 Store toggleMute: ${isMuted} -> ${newMuted}`);

    // Update store state
    set({ isMuted: newMuted });

    // Apply to audio player
    audioControls.setMuted?.(newMuted);

    // If unmuting with zero volume, set to default
    if (!newMuted && volume === 0) {
      set({ volume: 0.7 });
      audioControls.setVolume?.(0.7);
    }
  },

  // Centralized volume update
  updateVolume: (volume: number) => {
    const { audioControls, isMuted } = get();
    const clampedVolume = Math.max(0, Math.min(1, volume));

    console.log(`🔊 Store updateVolume: ${clampedVolume}`);

    set({ volume: clampedVolume });
    audioControls.setVolume?.(clampedVolume);

    // If volume is set to non-zero and currently muted, unmute
    if (clampedVolume > 0 && isMuted) {
      set({ isMuted: false });
      audioControls.setMuted?.(false);
    }

    // If volume is set to zero, mute
    if (clampedVolume === 0 && !isMuted) {
      set({ isMuted: true });
      audioControls.setMuted?.(true);
    }
  },

  // Centralized mute update
  updateMuted: (muted: boolean) => {
    const { audioControls } = get();

    console.log(`🔇 Store updateMuted: ${muted}`);

    set({ isMuted: muted });
    audioControls.setMuted?.(muted);
  },

  // FIXED: Play station - ALWAYS show player when playing
  play: (station) => {
    const { currentStation, stations, currentStationIndex, audioControls } = get();

    console.log("▶️ Store play() called with station:", station?.name || "current");

    if (station) {
      // Find index of station in stations array
      const index = stations.findIndex(
        (s) => s.stationuuid === station.stationuuid
      );

      set({
        currentStation: station,
        isPlaying: true,
        error: null,
        showPlayer: true, // ✅ ALWAYS show player
        ...(index >= 0 && { currentStationIndex: index }),
      });

      console.log("✅ Player visibility set to TRUE");
      audioControls.play?.(station);
    } else if (currentStation) {
      set({
        isPlaying: true,
        error: null,
        showPlayer: true, // ✅ ALWAYS show player
      });
      console.log("✅ Player visibility set to TRUE (current station)");
      audioControls.play?.(currentStation);
    } else if (stations.length > 0) {
      const stationToPlay = stations[currentStationIndex];
      set({
        currentStation: stationToPlay,
        isPlaying: true,
        error: null,
        showPlayer: true, // ✅ ALWAYS show player
      });
      console.log("✅ Player visibility set to TRUE (first station)");
      audioControls.play?.(stationToPlay);
    }
  },

  // Stop playback
  stop: () => {
    const { audioControls } = get();
    audioControls.pause?.();
    set({ isPlaying: false, error: null });
  },

  // Station management
  setStations: (stations) => {
    console.log(`📻 Store: Setting ${stations.length} stations`);
    set({ stations });
  },

  setCurrentStationIndex: (index) => {
    const { stations } = get();
    if (index >= 0 && index < stations.length) {
      set({ currentStationIndex: index });
    }
  },

  // Next station
  nextStation: () => {
    const { stations, currentStationIndex } = get();
    if (stations.length > 0) {
      const nextIndex = (currentStationIndex + 1) % stations.length;
      const nextStation = stations[nextIndex];
      console.log(`⏭️ Next station: ${nextStation.name}`);
      set({
        currentStationIndex: nextIndex,
        currentStation: nextStation,
      });
    }
  },

  // Previous station
  previousStation: () => {
    const { stations, currentStationIndex } = get();
    if (stations.length > 0) {
      const prevIndex =
        currentStationIndex === 0
          ? stations.length - 1
          : currentStationIndex - 1;
      const prevStation = stations[prevIndex];
      console.log(`⏮️ Previous station: ${prevStation.name}`);
      set({
        currentStationIndex: prevIndex,
        currentStation: prevStation,
      });
    }
  },

  // UI state
  setShowPlayer: (show) => {
    console.log(`👁️ Store: setShowPlayer(${show})`);
    set({ showPlayer: show });
  },

  // Country management
  setSelectedCountry: (country) => {
    console.log(`🌍 Store: setSelectedCountry(${country})`);
    set({ selectedCountry: country });
    localStorage.setItem("radioverse-country", country);
  },
}));
