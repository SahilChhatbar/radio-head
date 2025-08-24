import axios from 'axios';
import { RadioStation, RadioSearchParams, RadioApiResponse } from '@/types/index';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`Making API request to: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const radioApi = {
  // Get all stations with optional filters
  getStations: async (params?: RadioSearchParams): Promise<RadioStation[]> => {
    try {
      const response = await api.get<RadioApiResponse>('/radio/stations', { params });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching stations:', error);
      throw error;
    }
  },

  // Search stations by name
  searchStations: async (query: string, limit?: number): Promise<RadioStation[]> => {
    try {
      const response = await api.get<RadioApiResponse>('/radio/search', {
        params: { q: query, limit }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error searching stations:', error);
      throw error;
    }
  },

  // Get stations by country
  getStationsByCountry: async (countryCode: string, limit?: number): Promise<RadioStation[]> => {
    try {
      const response = await api.get<RadioApiResponse>(`/radio/country/${countryCode}`, {
        params: { limit }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching stations by country:', error);
      throw error;
    }
  },

  // Get stations by tag
  getStationsByTag: async (tag: string, limit?: number): Promise<RadioStation[]> => {
    try {
      const response = await api.get<RadioApiResponse>(`/radio/tag/${tag}`, {
        params: { limit }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching stations by tag:', error);
      throw error;
    }
  },

  // Get popular stations
  getPopularStations: async (limit?: number): Promise<RadioStation[]> => {
    try {
      const response = await api.get<RadioApiResponse>('/radio/popular', {
        params: { limit }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching popular stations:', error);
      throw error;
    }
  },

  // Health check
  healthCheck: async (): Promise<boolean> => {
    try {
      await api.get('/health');
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
};

export default radioApi;