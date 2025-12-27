import axios from "axios";
import {
  RadioStation,
  RadioSearchParams,
  RadioApiResponse,
} from "@/types/index";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export const radioApi = {
  getStations: async (params?: RadioSearchParams): Promise<RadioStation[]> => {
    try {
      const response = await api.get<RadioApiResponse>("/radio/stations", {
        params,
      });
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },
  searchStations: async (
    query: string,
    limit?: number
  ): Promise<RadioStation[]> => {
    try {
      const response = await api.get<RadioApiResponse>("/radio/search", {
        params: { q: query, limit },
      });
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  getStationsByCountry: async (
    countryCode: string,
    limit?: number
  ): Promise<RadioStation[]> => {
    try {
      const response = await api.get<RadioApiResponse>(
        `/radio/country/${countryCode}`,
        {
          params: { limit },
        }
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  getStationsByTag: async (
    tag: string,
    limit?: number
  ): Promise<RadioStation[]> => {
    try {
      const response = await api.get<RadioApiResponse>(`/radio/tag/${tag}`, {
        params: { limit },
      });
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  getPopularStations: async (limit?: number): Promise<RadioStation[]> => {
    try {
      const response = await api.get<RadioApiResponse>("/radio/popular", {
        params: { limit },
      });
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  healthCheck: async (): Promise<boolean> => {
    try {
      await api.get("/health");
      return true;
    } catch (error) {
      return false;
    }
  },
  getCountries: async () => {
    const response = await api.get("/radio/countries");
    return response.data.data;
  }
};