import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useDeferredValue,
} from "react";
import { useRadioStore } from "@/store/useRadiostore";
import { useQuery } from "@tanstack/react-query";
import { radioApi } from "@/api/index";
import { debounce } from "lodash";

interface Country {
  name: string;
  stationcount: number;
  code: string;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedFn = useMemo(
    () =>
      debounce((...args: Parameters<T>) => callbackRef.current(...args), delay),
    [delay]
  );

  useEffect(() => {
    return () => {
      debouncedFn.cancel();
    };
  }, [debouncedFn]);

  return debouncedFn;
};

interface UseLocationSelectorProps {
  onCountryChange?: (countryCode: string) => void;
  onStationChange?: (stationId: string) => void;
}

export function useLocationSelector({
  onCountryChange,
  onStationChange,
}: UseLocationSelectorProps = {}) {
  const currentStationUuid = useRadioStore(
    (state) => state.currentStation?.stationuuid || ""
  );
  const selectedCountry = useRadioStore((state) => state.selectedCountry);
  const storeStations = useRadioStore((state) => state.stations);
  const setStations = useRadioStore((state) => state.setStations);
  const setSelectedCountry = useRadioStore(
    (state) => state.setSelectedCountry
  );
  const play = useRadioStore((state) => state.play);

  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [searchCountry, setSearchCountry] = useState("");
  const [searchStation, setSearchStation] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [stationOpen, setStationOpen] = useState(false);

  const countryInputRef = useRef<HTMLInputElement>(null);
  const stationInputRef = useRef<HTMLInputElement>(null);

  const deferredCountrySearch = useDeferredValue(searchCountry);
  const deferredStationSearch = useDeferredValue(searchStation);

  const isInitializedRef = useRef(false);
  const updateStationsRef = useRef(false);

  const {
    data: countries = [],
    isLoading: isLoadingCountries,
    error: countriesError,
  } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const countriesData = await radioApi.getCountries(); //eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (countriesData || []).map((c: any) => ({
        name: c.name,
        stationcount: c.stationcount,
        code:
          c.countrycode?.toUpperCase() ||
          c.iso_3166_1?.toUpperCase() ||
          c.code?.toUpperCase() ||
          String(c.name).slice(0, 2).toUpperCase(),
      }));
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const { data: countryStations, isLoading: isLoadingStations } = useQuery({
    queryKey: ["stations", selectedCountry],
    queryFn: async () => {
      if (!selectedCountry) return [];
      try {
        const stationsData = await radioApi.getStationsByCountry(
          selectedCountry,
          100
        );
        return stationsData || [];
      } catch (error) {
        console.error("Error fetching stations:", error);
        try {
          const popularStations = await radioApi.getPopularStations(50);
          return popularStations || [];
        } catch (fallbackError) {
          return [fallbackError];
        }
      }
    },
    enabled: !!selectedCountry,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (countryStations && !updateStationsRef.current) {
      updateStationsRef.current = true;
      requestAnimationFrame(() => {
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        setStations(countryStations as any);
        updateStationsRef.current = false;
      });
    }
  }, [countryStations, setStations]);

  const getCountryEmoji = useCallback((countryCode: string) => {
    try {
      const codePoints = countryCode
        .toUpperCase()
        .split("")
        .map((char) => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    } catch {
      return "🌍";
    }
  }, []);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initializeLocation = async () => {
      if (selectedCountry) {
        setIsLoadingLocation(false);
        return;
      }

      const savedCountry = localStorage.getItem("radioverse-country");

      if (savedCountry) {
        setSelectedCountry(savedCountry);
        setIsLoadingLocation(false);
        return;
      }

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`
              );
              const data = await response.json();
              const countryCode = data.countryCode;

              if (countryCode) {
                setSelectedCountry(countryCode);
              } else {
                const defaultCountry = "IN";
                setSelectedCountry(defaultCountry);
              }
            } catch (error) {
              const defaultCountry = "IN";
              setSelectedCountry(defaultCountry);
              console.error("Error fetching location data:", error);
            } finally {
              setIsLoadingLocation(false);
            }
          },
          async () => {
            const defaultCountry = "IN";
            setSelectedCountry(defaultCountry);
            setIsLoadingLocation(false);
          }
        );
      } else {
        const defaultCountry = "IN";
        setSelectedCountry(defaultCountry);
        setIsLoadingLocation(false);
      }
    };

    initializeLocation();
  }, [selectedCountry, setSelectedCountry]);

  const filteredCountries = useMemo(() => {
    if (!deferredCountrySearch) return countries;
    const search = deferredCountrySearch.toLowerCase();
    return countries.filter(
      (country: Country) =>
        country.name.toLowerCase().includes(search) ||
        (country.code && country.code.toLowerCase().includes(search))
    );
  }, [countries, deferredCountrySearch]);

  const filteredStations = useMemo(() => {
    if (!storeStations || storeStations.length === 0) return [];
    if (!deferredStationSearch) return storeStations;
    const search = deferredStationSearch.toLowerCase();
    return storeStations.filter((station) =>
      station.name?.toLowerCase().includes(search)
    );
  }, [storeStations, deferredStationSearch]);

  useEffect(() => {
    if (countryOpen && countryInputRef.current) {
      countryInputRef.current.focus();
    }
  }, [filteredCountries, countryOpen]);

  useEffect(() => {
    if (stationOpen && stationInputRef.current) {
      stationInputRef.current.focus();
    }
  }, [filteredStations, stationOpen]);

  const forceBlur = useCallback(() => {
    requestAnimationFrame(() => {
      const focused = document.activeElement as HTMLElement;
      if (
        focused &&
        (focused.hasAttribute("data-radix-select-trigger") ||
          focused.getAttribute("role") === "combobox" ||
          focused.tagName === "BUTTON")
      ) {
        focused.blur();
      }
    });
  }, []);

  const handleCountryChange = useCallback(
    (countryCode: string) => {
      setSelectedCountry(countryCode);
      setCountryOpen(false);
      setSearchCountry("");
      forceBlur();
      onCountryChange?.(countryCode);
    },
    [setSelectedCountry, forceBlur, onCountryChange]
  );

  const handleStationChange = useCallback(
    (stationUuid: string) => {
      setStationOpen(false);
      setSearchStation("");
      forceBlur();

      const station = filteredStations.find(
        (s) => s.stationuuid === stationUuid
      );
      if (station) {
        play(station);
      }
      onStationChange?.(stationUuid);
    },
    [filteredStations, forceBlur, play, onStationChange]
  );

  const selectedCountryData = useMemo(
    () => countries.find((c: Country) => c.code === selectedCountry),
    [countries, selectedCountry]
  );

  const selectedStationData = useMemo(
    () => filteredStations.find((s) => s.stationuuid === currentStationUuid),
    [filteredStations, currentStationUuid]
  );

  const isCountryDropdownDisabled =
    isLoadingCountries && countries.length === 0;

  const debouncedSetCountrySearch = useDebouncedCallback(
    (value: string) => setSearchCountry(value),
    250
  );

  const debouncedSetStationSearch = useDebouncedCallback(
    (value: string) => setSearchStation(value),
    250
  );

  const handleCountrySearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      debouncedSetCountrySearch(value);
    },
    [debouncedSetCountrySearch]
  );

  const handleStationSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      debouncedSetStationSearch(value);
    },
    [debouncedSetStationSearch]
  );

  const showNoCountriesFound = filteredCountries.length === 0 && !isLoadingCountries;
  const showNoStationsFound = filteredStations.length === 0 && !isLoadingStations;

  const noStationsFoundText = selectedCountry
    ? `No stations found in ${selectedCountryData?.name || selectedCountry}`
    : "Please select a country first";

  return {
    countries,
    isLoadingCountries,
    countriesError,
    isLoadingStations,
    isLoadingLocation,
    searchCountry,
    searchStation,
    countryOpen,
    setCountryOpen,
    stationOpen,
    setStationOpen,
    countryInputRef,
    stationInputRef,
    filteredCountries,
    filteredStations,
    getCountryEmoji,
    handleCountryChange,
    handleStationChange,
    selectedCountryData,
    selectedStationData,
    isCountryDropdownDisabled,
    handleCountrySearchChange,
    handleStationSearchChange,
    showNoCountriesFound,
    showNoStationsFound,
    noStationsFoundText,
    currentStationUuid,
    selectedCountry,
  };
}
