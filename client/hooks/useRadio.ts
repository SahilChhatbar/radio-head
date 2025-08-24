import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { radioApi } from '@/api/index';
import { RadioStation, RadioSearchParams } from '@/types/index';

export const QUERY_KEYS = {
  stations: ['stations'] as const,
  search: ['stations', 'search'] as const,
  popular: ['stations', 'popular'] as const,
  country: ['stations', 'country'] as const,
  tag: ['stations', 'tag'] as const,
} as const;

export const useStations = (params?: RadioSearchParams): UseQueryResult<RadioStation[], Error> => {
  return useQuery({
    queryKey: [...QUERY_KEYS.stations, params],
    queryFn: () => radioApi.getStations(params),
    staleTime: 5 * 60 * 1000, 
    gcTime: 10 * 60 * 1000, 
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const useSearchStations = (query: string, limit?: number): UseQueryResult<RadioStation[], Error> => {
  return useQuery({
    queryKey: [...QUERY_KEYS.search, query, limit],
    queryFn: () => radioApi.searchStations(query, limit),
    enabled: query.length > 2, 
    staleTime: 2 * 60 * 1000, 
    gcTime: 5 * 60 * 1000, 
  });
};

export const usePopularStations = (limit?: number): UseQueryResult<RadioStation[], Error> => {
  return useQuery({
    queryKey: [...QUERY_KEYS.popular, limit],
    queryFn: () => radioApi.getPopularStations(limit),
    staleTime: 10 * 60 * 1000, 
    gcTime: 30 * 60 * 1000, 
  });
};

export const useStationsByCountry = (countryCode: string, limit?: number): UseQueryResult<RadioStation[], Error> => {
  return useQuery({
    queryKey: [...QUERY_KEYS.country, countryCode, limit],
    queryFn: () => radioApi.getStationsByCountry(countryCode, limit),
    enabled: !!countryCode,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000, 
  });
};

export const useStationsByTag = (tag: string, limit?: number): UseQueryResult<RadioStation[], Error> => {
  return useQuery({
    queryKey: [...QUERY_KEYS.tag, tag, limit],
    queryFn: () => radioApi.getStationsByTag(tag, limit),
    enabled: !!tag,
    staleTime: 10 * 60 * 1000, 
    gcTime: 30 * 60 * 1000, 
  });
};