import { create } from "zustand";
import { RadioStation, RadioPlayerState } from "@/types/index";

interface RadioStore extends RadioPlayerState {
  setCurrentStation: (station: RadioStation | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  togglePlayPause: () => void;
  toggleMute: () => void;
  play: (station?: RadioStation) => void;
  stop: () => void;

  stations: RadioStation[];
  currentStationIndex: number;
  setStations: (stations: RadioStation[]) => void;
  setCurrentStationIndex: (index: number) => void;
  nextStation: () => void;
  previousStation: () => void;

  selectedCountry: string;
  setSelectedCountry: (country: string) => void;

  showPlayer: boolean;
  setShowPlayer: (show: boolean) => void;

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

  updateVolume: (volume: number) => void;
  updateMuted: (muted: boolean) => void;

  streamType: "hls" | "tone" | "howler" | null;
  setStreamType: (type: "hls" | "tone" | "howler" | null) => void;
}

export const useRadioStore = create<RadioStore>((set, get) => ({
  isPlaying: false,
  currentStation: null,
  volume: 0.7,
  isMuted: false,
  isLoading: false,
  error: null,

  stations: [],
  currentStationIndex: 0,

  showPlayer: false,
  selectedCountry:
    typeof window !== "undefined"
      ? localStorage.getItem("radioverse-country") || "IN"
      : "IN",

  streamType: null,

  audioControls: {
    play: null,
    pause: null,
    setVolume: null,
    setMuted: null,
  },

  setAudioControls: (controls) => set({ audioControls: controls }),
  setStreamType: (type) => set({ streamType: type }),

  setCurrentStation: (station) => set({ currentStation: station }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) =>
    set({ volume: Math.max(0, Math.min(1, volume)) }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  togglePlayPause: () => {
    const { isPlaying, currentStation, audioControls } = get();
    if (!currentStation) return;

    if (isPlaying) {
      audioControls.pause?.();
    } else {
      audioControls.play?.(currentStation);
    }

    set({ isPlaying: !isPlaying });
  },

  toggleMute: () => {
    const { isMuted, audioControls, volume } = get();
    const nextMuted = !isMuted;

    set({ isMuted: nextMuted });
    audioControls.setMuted?.(nextMuted);

    if (!nextMuted && volume === 0) {
      set({ volume: 0.7 });
      audioControls.setVolume?.(0.7);
    }
  },

  updateVolume: (volume) => {
    const { audioControls, isMuted } = get();
    const clamped = Math.max(0, Math.min(1, volume));

    // Direct update without triggering re-renders
    audioControls.setVolume?.(clamped);
    
    // Batch state updates
    const updates: Partial<RadioStore> = { volume: clamped };
    
    if (clamped > 0 && isMuted) {
      updates.isMuted = false;
      audioControls.setMuted?.(false);
    }

    if (clamped === 0 && !isMuted) {
      updates.isMuted = true;
      audioControls.setMuted?.(true);
    }

    set(updates);
  },

  updateMuted: (muted) => {
    const { audioControls } = get();
    audioControls.setMuted?.(muted);
    set({ isMuted: muted });
  },

  play: (station) => {
    const { currentStation, stations, currentStationIndex, audioControls } =
      get();

    if (station) {
      const index = stations.findIndex(
        (s) => s.stationuuid === station.stationuuid
      );

      set({
        currentStation: station,
        isPlaying: true,
        error: null,
        showPlayer: true,
        ...(index >= 0 && { currentStationIndex: index }),
      });

      audioControls.play?.(station);
      return;
    }

    if (currentStation) {
      set({ isPlaying: true, error: null, showPlayer: true });
      audioControls.play?.(currentStation);
      return;
    }

    if (stations.length > 0) {
      const stationToPlay = stations[currentStationIndex];
      set({
        currentStation: stationToPlay,
        isPlaying: true,
        error: null,
        showPlayer: true,
      });
      audioControls.play?.(stationToPlay);
    }
  },

  stop: () => {
    const { audioControls } = get();
    audioControls.pause?.();
    set({ isPlaying: false, error: null });
  },

  setStations: (stations) => set({ stations }),

  setCurrentStationIndex: (index) => {
    const { stations } = get();
    if (index >= 0 && index < stations.length) {
      set({ currentStationIndex: index });
    }
  },

  nextStation: () => {
    const { stations, currentStationIndex } = get();
    if (!stations.length) return;

    const nextIndex = (currentStationIndex + 1) % stations.length;
    set({
      currentStationIndex: nextIndex,
      currentStation: stations[nextIndex],
    });
  },

  previousStation: () => {
    const { stations, currentStationIndex } = get();
    if (!stations.length) return;

    const prevIndex =
      currentStationIndex === 0
        ? stations.length - 1
        : currentStationIndex - 1;

    set({
      currentStationIndex: prevIndex,
      currentStation: stations[prevIndex],
    });
  },

  setShowPlayer: (show) => set({ showPlayer: show }),

  setSelectedCountry: (country) => {
    set({ selectedCountry: country });
    if (typeof window !== "undefined") {
      localStorage.setItem("radioverse-country", country);
    }
  },
}));

// Optimized selectors to prevent unnecessary re-renders
export const useIsPlaying = () => useRadioStore((state) => state.isPlaying);
export const useCurrentStation = () => useRadioStore((state) => state.currentStation);
export const useVolume = () => useRadioStore((state) => state.volume);
export const useIsMuted = () => useRadioStore((state) => state.isMuted);
export const useIsLoading = () => useRadioStore((state) => state.isLoading);
export const useShowPlayer = () => useRadioStore((state) => state.showPlayer);
export const useStations = () => useRadioStore((state) => state.stations);
export const useCurrentStationIndex = () => useRadioStore((state) => state.currentStationIndex);