"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
  useRef,
  useDeferredValue,
} from "react";
import { Select, Flex, Text } from "@radix-ui/themes";
import { MapPin, Radio, Loader2 } from "lucide-react";
import { formatVotes } from "@/utils/formatting";
import { useRadioStore } from "@/store/useRadiostore";
import { useQuery } from "@tanstack/react-query";
import { radioApi } from "@/api/index";
import { debounce } from "lodash";

interface Country {
  name: string;
  stationcount: number;
  code: string;
}

interface Station {
  stationuuid: string;
  name: string;
  bitrate?: number;
  codec?: string;
  votes?: number;
  country?: string;
}

interface LocationSelectorProps {
  onCountryChange?: (countryCode: string) => void;
  onStationChange?: (stationId: string) => void;
}

const CountryItem = memo(
  ({ country, emoji }: { country: Country; emoji: string }) => (
    <Flex align="center" justify="between" gap="2">
      <Flex align="center" gap="2">
        <Text size="2" weight="regular">
          {emoji}
        </Text>
        <Text size="2" weight="regular" className="text-white">
          {country.name}
        </Text>
      </Flex>
      <Text size="1" weight="regular" className="text-white">
        {country.stationcount}
      </Text>
    </Flex>
  )
);
CountryItem.displayName = "CountryItem";

const StationItem = memo(
  ({
    station,
    isCurrentStation,
  }: {
    station: Station;
    isCurrentStation: boolean;
  }) => (
    <Flex
      direction="row"
      gap="1"
      align="center"
      justify="between"
      className="w-full"
    >
      <Text
        size="2"
        weight="regular"
        style={{
          textShadow: isCurrentStation
            ? "0 0 8px rgba(239, 68, 68, 0.6)"
            : "0 0 4px rgba(239, 68, 68, 0.3)",
        }}
      >
        {station.name}
      </Text>
      <Text size="1" weight="regular">
        🔥{formatVotes(station.votes)}
      </Text>
    </Flex>
  )
);
StationItem.displayName = "StationItem";
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

const LocationSelector: React.FC<LocationSelectorProps> = memo(
  ({ onCountryChange, onStationChange }) => {
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

    // Refs to manage input focus
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

    return (
      <Flex
        direction={{ initial: "column", sm: "row" }}
        align={{ initial: "stretch", sm: "center" }}
        gap="3"
        className="w-full"
        style={{ gap: "var(--spacing-sm)" }}
      >
        <Flex
          align="center"
          gap="2"
          className="relative w-full sm:w-auto"
          style={{
            minWidth: "clamp(140px, 20vw, 200px)",
            gap: "var(--spacing-xs)",
          }}
        >
          <MapPin
            size={16}
            className="text-accent flex-shrink-0"
            style={{
              width: "clamp(14px, 2vw, 20px)",
              height: "clamp(14px, 2vw, 20px)",
            }}
          />
          <Select.Root
            value={selectedCountry}
            onValueChange={handleCountryChange}
            disabled={isCountryDropdownDisabled}
            open={countryOpen}
            onOpenChange={setCountryOpen}
          >
            <Select.Trigger
              data-country-trigger
              className="w-full location-country-trigger"
            >
              {isLoadingLocation && !selectedCountryData ? (
                <Flex align="center" gap="2">
                  <Loader2 size={14} className="animate-spin" />
                  <Text size="2" weight="regular" className="text-gray-400">
                    Detecting...
                  </Text>
                </Flex>
              ) : selectedCountryData ? (
                <Flex align="center" gap="2">
                  <Text
                    size="2"
                    weight="regular"
                    className="truncate text-accent"
                    style={{
                      textShadow: "0 0 6px rgba(255, 145, 77, 0.4)",
                    }}
                  >
                    {selectedCountryData.name}
                  </Text>
                </Flex>
              ) : selectedCountry && countries.length > 0 ? (
                <Flex align="center" gap="2">
                  <Text
                    size="2"
                    weight="regular"
                    className="truncate text-accent"
                  >
                    {selectedCountry}
                  </Text>
                </Flex>
              ) : countriesError ? (
                <Text size="2" weight="regular" className="text-red-400">
                  Error loading regions
                </Text>
              ) : (
                <Text size="2" weight="regular" className="text-gray-400">
                  {isLoadingCountries ? "Loading regions..." : "Select region"}
                </Text>
              )}
            </Select.Trigger>

            <Select.Content
              data-country-content
              className="location-country-content"
              position="popper"
              avoidCollisions
              sideOffset={5}
            >
              <div className="location-search-wrapper">
                <input
                  ref={countryInputRef}
                  type="text"
                  placeholder="Search countries..."
                  defaultValue={searchCountry}
                  onChange={handleCountrySearchChange}
                  className="location-search-input"
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <Select.Group>
                {filteredCountries.map((country: Country) => (
                  <Select.Item
                    key={country.code}
                    value={country.code}
                    data-country-item
                    className="location-country-item"
                  >
                    <CountryItem
                      country={country}
                      emoji={getCountryEmoji(country.code)}
                    />
                  </Select.Item>
                ))}

                {filteredCountries.length === 0 && !isLoadingCountries && (
                  <div className="px-3 py-2">
                    <Text size="2" weight="regular" className="text-gray-500">
                      No countries found
                    </Text>
                  </div>
                )}

                {isLoadingCountries && (
                  <Flex align="center" gap="2" className="px-3 py-2">
                    <Loader2 size={14} className="animate-spin" />
                    <Text size="2" weight="regular" className="text-gray-500">
                      Loading countries...
                    </Text>
                  </Flex>
                )}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Flex>

        <Flex
          align="center"
          gap="2"
          className="relative flex-1 min-w-0 w-full sm:w-auto"
          style={{ gap: "var(--spacing-xs)" }}
        >
          <Radio
            size={16}
            className="text-accent flex-shrink-0"
            style={{
              width: "clamp(14px, 2vw, 20px)",
              height: "clamp(14px, 2vw, 20px)",
            }}
          />
          <Select.Root
            value={currentStationUuid}
            onValueChange={handleStationChange}
            disabled={!selectedCountry || isLoadingStations}
            open={stationOpen}
            onOpenChange={setStationOpen}
          >
            <Select.Trigger
              data-station-trigger
              className="w-full location-country-trigger min-w-0"
              placeholder="Select station"
            >
              {isLoadingStations ? (
                <Flex align="center" gap="2">
                  <Loader2 size={14} className="animate-spin" />
                  <Text size="2" weight="regular" className="text-gray-400">
                    Loading...
                  </Text>
                </Flex>
              ) : selectedStationData ? (
                <Flex align="center" gap="2" className="w-full min-w-0">
                  <Text
                    size="2"
                    weight="regular"
                    className="flex-1 truncate text-left text-accent"
                    style={{
                      textShadow: "0 0 6px rgba(255, 145, 77, 0.4)",
                    }}
                  >
                    {selectedStationData.name}
                  </Text>
                </Flex>
              ) : (
                <Text
                  size="2"
                  weight="regular"
                  className="text-gray-400 truncate"
                >
                  {!selectedCountry
                    ? "Please select region"
                    : filteredStations.length === 0
                    ? "No stations available"
                    : "Select station"}
                </Text>
              )}
            </Select.Trigger>

            <Select.Content
              data-station-content
              avoidCollisions
              className="location-country-content"
              position="popper"
              sideOffset={5}
            >
              <div className="location-search-wrapper">
                <input
                  ref={stationInputRef}
                  type="text"
                  placeholder="Search stations..."
                  defaultValue={searchStation}
                  onChange={handleStationSearchChange}
                  className="location-search-input"
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <Select.Group>
                {filteredStations.map((station) => (
                  <Select.Item
                    key={station.stationuuid}
                    value={station.stationuuid}
                    data-station-item
                    className="location-country-item"
                  >
                    <StationItem
                      station={station}
                      isCurrentStation={
                        currentStationUuid === station.stationuuid
                      }
                    />
                  </Select.Item>
                ))}
                {filteredStations.length === 0 && !isLoadingStations && (
                  <div className="px-3 py-2">
                    <Text size="2" weight="regular" className="text-gray-500">
                      {selectedCountry
                        ? `No stations found in ${
                            selectedCountryData?.name || selectedCountry
                          }`
                        : "Please select a country first"}
                    </Text>
                  </div>
                )}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Flex>
      </Flex>
    );
  }
);

LocationSelector.displayName = "LocationSelector";

export default LocationSelector;
