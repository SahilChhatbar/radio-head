import { create } from 'zustand';
import { RadioStation, RadioPlayerState } from '@/types/index';

interface RadioStore extends RadioPlayerState {
  // Actions for playback
  setCurrentStation: (station: RadioStation | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Helper actions
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
  
  // UI state
  showPlayer: boolean;
  setShowPlayer: (show: boolean) => void;
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

  // Playback actions
  setCurrentStation: (station) => set({ currentStation: station }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Helper actions
  togglePlayPause: () => {
    const { isPlaying, currentStation } = get();
    if (currentStation) {
      set({ isPlaying: !isPlaying });
    }
  },

  toggleMute: () => {
    const { isMuted } = get();
    set({ isMuted: !isMuted });
  },

  play: (station) => {
    const { currentStation, stations, currentStationIndex } = get();
    
    if (station) {
      set({ 
        currentStation: station, 
        isPlaying: true, 
        error: null,
        showPlayer: true 
      });
      const index = stations.findIndex(s => s.stationuuid === station.stationuuid);
      if (index >= 0) {
        set({ currentStationIndex: index });
      }
    } else if (currentStation) {
      set({ isPlaying: true, error: null });
    } else if (stations.length > 0) {
      const stationToPlay = stations[currentStationIndex];
      set({ 
        currentStation: stationToPlay, 
        isPlaying: true, 
        error: null,
        showPlayer: true 
      });
    }
  },

  stop: () => {
    set({ isPlaying: false, error: null });
  },

  // Station management
  setStations: (stations) => set({ stations }),
  
  setCurrentStationIndex: (index) => {
    const { stations } = get();
    if (index >= 0 && index < stations.length) {
      set({ currentStationIndex: index });
    }
  },

  nextStation: () => {
    const { stations, currentStationIndex } = get();
    if (stations.length > 0) {
      const nextIndex = (currentStationIndex + 1) % stations.length;
      const nextStation = stations[nextIndex];
      set({ 
        currentStationIndex: nextIndex,
        currentStation: nextStation
      });
    }
  },

  previousStation: () => {
    const { stations, currentStationIndex } = get();
    if (stations.length > 0) {
      const prevIndex = currentStationIndex === 0 ? stations.length - 1 : currentStationIndex - 1;
      const prevStation = stations[prevIndex];
      set({ 
        currentStationIndex: prevIndex,
        currentStation: prevStation
      });
    }
  },
  setShowPlayer: (show) => set({ showPlayer: show }),
}));