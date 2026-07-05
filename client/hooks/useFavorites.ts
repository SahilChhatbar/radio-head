import { useState, useCallback, useEffect } from "react";
import { favoritesApi } from "@/api/favorites";
import { RadioStation } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export function useFavorites() {
  const [favorites, setFavorites] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await favoritesApi.getFavorites();
      setFavorites(data);
      return data;
    } catch (error) {
      console.error("Failed to load favorites:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const addFavorite = useCallback(async (station: RadioStation) => {
    setLoading(true);
    try {
      await favoritesApi.addFavorite(station);
      setFavorites((prev) => {
        if (prev.some((s) => s.stationuuid === station.stationuuid)) return prev;
        return [...prev, station];
      });
    } catch (error) {
      console.error("Failed to add favorite:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeFavorite = useCallback(async (stationUuid: string) => {
    setLoading(true);
    try {
      await favoritesApi.removeFavorite(stationUuid);
      setFavorites((prev) => prev.filter((s) => s.stationuuid !== stationUuid));
    } catch (error) {
      console.error("Failed to remove favorite:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkFavorite = useCallback(async (stationUuid: string) => {
    try {
      return await favoritesApi.checkFavorite(stationUuid);
    } catch (error) {
      console.error("Failed to check favorite:", error);
      return false;
    }
  }, []);

  return {
    favorites,
    loading,
    loadFavorites,
    addFavorite,
    removeFavorite,
    checkFavorite,
  };
}

export function useFavorite(station: RadioStation | null) {
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!user || !station) {
      setIsFavorited(false);
      return;
    }
    try {
      const status = await favoritesApi.checkFavorite(station.stationuuid);
      setIsFavorited(status);
    } catch (error) {
      console.error("Failed to check favorite status:", error);
    }
  }, [user, station]);

  const toggleFavorite = useCallback(async () => {
    if (!user || !station) return;
    setLoading(true);
    try {
      if (isFavorited) {
        await favoritesApi.removeFavorite(station.stationuuid);
        setIsFavorited(false);
      } else {
        await favoritesApi.addFavorite(station);
        setIsFavorited(true);
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    } finally {
      setLoading(false);
    }
  }, [user, station, isFavorited]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    isFavorited,
    loading,
    toggleFavorite,
    checkStatus,
  };
}
