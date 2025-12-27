// client/api/favorites.ts
import axios from "axios";
import { RadioStation } from "@/types/index";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const getAuthHeader = () => {
  const token = localStorage.getItem("radioverse_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const favoritesApi = {
  getFavorites: async (): Promise<RadioStation[]> => {
    try {
      const response = await axios.get(`${BASE_URL}/favorites`, {
        headers: getAuthHeader(),
      });
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  addFavorite: async (station: RadioStation): Promise<void> => {
    try {
      await axios.post(
        `${BASE_URL}/favorites`,
        { station },
        {
          headers: {
            ...getAuthHeader(),
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      throw error;
    }
  },

  removeFavorite: async (stationUuid: string): Promise<void> => {
    try {
      await axios.delete(`${BASE_URL}/favorites/${stationUuid}`, {
        headers: getAuthHeader(),
      });
    } catch (error) {
      throw error;
    }
  },

  checkFavorite: async (stationUuid: string): Promise<boolean> => {
    try {
      const response = await axios.get(
        `${BASE_URL}/favorites/check/${stationUuid}`,
        {
          headers: getAuthHeader(),
        }
      );
      return response.data.data.isFavorited;
    } catch (error) {
      return false;
    }
  },
};
