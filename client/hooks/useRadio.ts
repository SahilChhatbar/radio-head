import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { radioApi } from "@/api/index";
import { RadioStation, RadioSearchParams } from "@/types/index";
import {
  getOptimalStations,
  stationFilterService,
} from "@/services/StationFilter";

export const QUERY_KEYS = {
  stations: ["stations"] as const,
  search: ["stations", "search"] as const,
  popular: ["stations", "popular"] as const,
  country: ["stations", "country"] as const,
  tag: ["stations", "tag"] as const,
  validated: ["stations", "validated"] as const,
} as const;

export const useStations = (
  params?: RadioSearchParams & {
    enableFiltering?: boolean;
    enableRealTimeValidation?: boolean;
  }
): UseQueryResult<RadioStation[], Error> => {
  const {
    enableFiltering = true,
    enableRealTimeValidation = false,
    ...queryParams
  } = params || {};

  return useQuery({
    queryKey: [
      ...QUERY_KEYS.stations,
      queryParams,
      enableFiltering,
      enableRealTimeValidation,
    ],
    queryFn: async () => {
      console.log("🎵 Fetching stations with enhanced filtering...");
      const rawStations = await radioApi.getStations(queryParams);

      if (!enableFiltering) {
        return rawStations;
      }

      let filteredStations = getOptimalStations(rawStations, queryParams.limit);

      if (enableRealTimeValidation && filteredStations.length > 0) {
        console.log("🧪 Applying real-time validation...");
        filteredStations = await stationFilterService.validateStationsRealtime(
          filteredStations.slice(0, 20),
          3
        );
      }
      console.log(`✅ Returning ${filteredStations.length} filtered stations`);
      return filteredStations;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const useSearchStations = (
  query: string,
  limit?: number,
  options?: { enableFiltering?: boolean }
): UseQueryResult<RadioStation[], Error> => {
  const { enableFiltering = true } = options || {};

  return useQuery({
    queryKey: [...QUERY_KEYS.search, query, limit, enableFiltering],
    queryFn: async () => {
      const rawStations = await radioApi.searchStations(query, limit || 50);

      if (!enableFiltering || rawStations.length === 0) {
        return rawStations;
      }
      const filteredStations = stationFilterService.searchStationsOptimal(
        rawStations,
        query,
        limit
      );
      console.log(
        `🔍 Search "${query}": ${filteredStations.length}/${rawStations.length} stations after filtering`
      );
      return filteredStations;
    },
    enabled: query.length > 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

export const usePopularStations = (
  limit?: number,
  options?: { enableFiltering?: boolean }
): UseQueryResult<RadioStation[], Error> => {
  const { enableFiltering = true } = options || {};

  return useQuery({
    queryKey: [...QUERY_KEYS.popular, limit, enableFiltering],
    queryFn: async () => {
      const requestLimit = limit ? Math.min(limit * 2, 200) : 100;
      const rawStations = await radioApi.getPopularStations(requestLimit);

      if (!enableFiltering) {
        return rawStations.slice(0, limit);
      }

      const filteredStations = getOptimalStations(rawStations, limit);
      console.log(
        `🌟 Popular stations: ${filteredStations.length} high-quality stations selected`
      );

      return filteredStations;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useStationsByCountry = (
  countryCode: string,
  limit?: number,
  options?: { enableFiltering?: boolean }
): UseQueryResult<RadioStation[], Error> => {
  const { enableFiltering = true } = options || {};

  return useQuery({
    queryKey: [...QUERY_KEYS.country, countryCode, limit, enableFiltering],
    queryFn: async () => {
      const requestLimit = limit ? Math.min(limit * 2, 200) : 100;
      const rawStations = await radioApi.getStationsByCountry(
        countryCode,
        requestLimit
      );

      if (!enableFiltering) {
        return rawStations.slice(0, limit);
      }

      const filteredStations = stationFilterService.getStationsByCountryOptimal(
        rawStations,
        countryCode,
        limit
      );
      console.log(
        `🌍 Country ${countryCode}: ${filteredStations.length} stations after filtering`
      );
      return filteredStations;
    },
    enabled: !!countryCode,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useStationsByTag = (
  tag: string,
  limit?: number,
  options?: { enableFiltering?: boolean }
): UseQueryResult<RadioStation[], Error> => {
  const { enableFiltering = true } = options || {};

  return useQuery({
    queryKey: [...QUERY_KEYS.tag, tag, limit, enableFiltering],
    queryFn: async () => {
      const requestLimit = limit ? Math.min(limit * 2, 200) : 100;
      const rawStations = await radioApi.getStationsByTag(tag, requestLimit);

      if (!enableFiltering) {
        return rawStations.slice(0, limit);
      }

      const filteredStations = getOptimalStations(rawStations, limit);
      console.log(
        `🏷️ Tag "${tag}": ${filteredStations.length} stations after filtering`
      );

      return filteredStations;
    },
    enabled: !!tag,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useValidatedStations = (
  stations: RadioStation[],
  enabled: boolean = false
): UseQueryResult<RadioStation[], Error> => {
  return useQuery({
    queryKey: [
      ...QUERY_KEYS.validated,
      stations.map((s) => s.stationuuid).join(","),
    ],
    queryFn: async () => {
      if (!stations.length) return [];

      console.log("🧪 Starting real-time validation...");
      const validatedStations =
        await stationFilterService.validateStationsRealtime(
          stations.slice(0, 15),
          4
        );

      return validatedStations;
    },
    enabled: enabled && stations.length > 0,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
};

export const useStationQuality = (station: RadioStation | null) => {
  return station ? stationFilterService.getStationQualityInfo(station) : null;
};

export const useStationQualityStats = (stations: RadioStation[]) => {
  return stationFilterService.getQualityStatistics(stations);
};

export const useCuratedStations = (
  type: "mixed" | "high-quality" | "popular" = "mixed",
  limit: number = 50
): UseQueryResult<RadioStation[], Error> => {
  const { data: popularStations } = usePopularStations(30);
  const { data: recentStations } = useStations({
    limit: 30,
    order: "lastchangetime",
    reverse: true,
  });

  return useQuery({
    queryKey: ["curated", type, limit],
    queryFn: async () => {
      const allStations = [
        ...(popularStations || []),
        ...(recentStations || []),
      ];

      if (allStations.length === 0) return [];

      const unique = allStations.filter(
        (station, index, self) =>
          self.findIndex((s) => s.stationuuid === station.stationuuid) === index
      );

      let curated: RadioStation[];

      switch (type) {
        case "high-quality":
          curated = getOptimalStations(unique).filter((station) => {
            const quality = stationFilterService.getStationQualityInfo(station);
            return (
              quality.quality === "excellent" || quality.quality === "good"
            );
          });
          break;

        case "popular":
          curated = unique
            .sort((a, b) => (b.clickcount || 0) - (a.clickcount || 0))
            .slice(0, limit * 2);
          curated = getOptimalStations(curated, limit);
          break;

        case "mixed":
        default:
          curated = getOptimalStations(unique, limit);
          break;
      }

      console.log(`🎭 Curated ${type} stations: ${curated.length} selected`);
      return curated;
    },
    enabled: !!(popularStations || recentStations),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};
