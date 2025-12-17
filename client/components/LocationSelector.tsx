"use client";

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Select, Flex, Text } from "@radix-ui/themes";
import { MapPin, Radio, Loader2 } from "lucide-react";
import { useRadioStore } from "@/store/useRadiostore";
import { useQuery } from "@tanstack/react-query";
import { radioApi } from "@/api/index";

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
        <span>{emoji}</span>
        <Text size="2" className="text-white">
          {country.name}
        </Text>
      </Flex>
      <Text size="1" className="text-white">
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
        style={{
          textShadow: isCurrentStation
            ? "0 0 8px rgba(239, 68, 68, 0.6)"
            : "0 0 4px rgba(239, 68, 68, 0.3)",
        }}
      >
        {station.name}
      </Text>
      <Text size="1">👍 {station.votes}</Text>
    </Flex>
  )
);
StationItem.displayName = "StationItem";

const LocationSelector: React.FC<LocationSelectorProps> = memo(
  ({ onCountryChange, onStationChange }) => {
    // Only subscribe to what we absolutely need
    const currentStationUuid = useRadioStore(
      (state) => state.currentStation?.stationuuid || ""
    );
    const setStations = useRadioStore((state) => state.setStations);
    const play = useRadioStore((state) => state.play);

    // Get stations directly from store for filtering
    const storeStations = useRadioStore((state) => state.stations);

    const countryTriggerRef = React.useRef<HTMLButtonElement>(null);
    const stationTriggerRef = React.useRef<HTMLButtonElement>(null);

    const [selectedCountry, setSelectedCountry] = useState("");
    const [isLoadingLocation, setIsLoadingLocation] = useState(true);

    const [searchCountry, setSearchCountry] = useState("");
    const [searchStation, setSearchStation] = useState("");

    const [countryOpen, setCountryOpen] = useState(false);
    const [stationOpen, setStationOpen] = useState(false);

    // Fetch countries with caching
    const {
      data: countries = [],
      isLoading: isLoadingCountries,
      error: countriesError,
    } = useQuery({
      queryKey: ["countries"],
      queryFn: async () => {
        const countriesData = await radioApi.getCountries();
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

    // Fetch stations for selected country with caching
    const {
      data: countryStations,
      isLoading: isLoadingStations,
    } = useQuery({
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
            return [];
          }
        }
      },
      enabled: !!selectedCountry,
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });

    // Update store stations when country stations change - use ref to prevent re-renders
    const updateStationsRef = React.useRef(false);
    useEffect(() => {
      if (countryStations && !updateStationsRef.current) {
        updateStationsRef.current = true;
        setStations(countryStations);
        requestAnimationFrame(() => {
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

    // Initialize location on mount - only once
    const isInitializedRef = React.useRef(false);
    useEffect(() => {
      if (isInitializedRef.current) return;
      isInitializedRef.current = true;

      const initializeLocation = async () => {
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
                  localStorage.setItem("radioverse-country", countryCode);
                } else {
                  const defaultCountry = "IN";
                  setSelectedCountry(defaultCountry);
                  localStorage.setItem("radioverse-country", defaultCountry);
                }
              } catch (error) {
                const defaultCountry = "IN";
                setSelectedCountry(defaultCountry);
                localStorage.setItem("radioverse-country", defaultCountry);
              } finally {
                setIsLoadingLocation(false);
              }
            },
            async () => {
              const defaultCountry = "IN";
              setSelectedCountry(defaultCountry);
              localStorage.setItem("radioverse-country", defaultCountry);
              setIsLoadingLocation(false);
            }
          );
        } else {
          const defaultCountry = "IN";
          setSelectedCountry(defaultCountry);
          localStorage.setItem("radioverse-country", defaultCountry);
          setIsLoadingLocation(false);
        }
      };

      initializeLocation();
    }, []);

    // Memoized filtered lists - only recalculate when needed
    const filteredCountries = useMemo(() => {
      if (!searchCountry) return countries;
      const search = searchCountry.toLowerCase();
      return countries.filter(
        (country) =>
          country.name.toLowerCase().includes(search) ||
          (country.code && country.code.toLowerCase().includes(search))
      );
    }, [countries, searchCountry]);

    const filteredStations = useMemo(() => {
      if (!storeStations || storeStations.length === 0) return [];
      if (!searchStation) return storeStations;
      const search = searchStation.toLowerCase();
      return storeStations.filter((station) =>
        station.name?.toLowerCase().includes(search)
      );
    }, [storeStations, searchStation]);

    const forceBlur = useCallback(() => {
      requestAnimationFrame(() => {
        try {
          const focused = document.activeElement as HTMLElement;
          if (
            focused &&
            (focused.hasAttribute("data-radix-select-trigger") ||
              focused.getAttribute("role") === "combobox" ||
              focused.tagName === "BUTTON")
          ) {
            focused.blur();
          }
          // Ensure body scroll is restored when dropdown closes
          document.body.style.overflow = "";
          document.body.style.paddingRight = "";
        } catch (err) { }
      });
    }, []); const handleCountryChange = useCallback(
      (countryCode: string) => {
        setSelectedCountry(countryCode);
        setCountryOpen(false);
        setSearchCountry("");
        localStorage.setItem("radioverse-country", countryCode);
        forceBlur();
        onCountryChange?.(countryCode);
      },
      [forceBlur, onCountryChange]
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
      () => countries.find((c) => c.code === selectedCountry),
      [countries, selectedCountry]
    );

    const selectedStationData = useMemo(
      () => filteredStations.find((s) => s.stationuuid === currentStationUuid),
      [filteredStations, currentStationUuid]
    );

    const isCountryDropdownDisabled =
      isLoadingCountries && countries.length === 0;

    return (
      <Flex gap="0" align="center" className="w-full">
        <Flex align="center" gap="2" className="relative min-w-[180px]">
          <MapPin size={16} className="text-accent flex-shrink-0" />
          <Select.Root
            value={selectedCountry}
            onValueChange={handleCountryChange}
            disabled={isCountryDropdownDisabled}
            open={countryOpen}
            onOpenChange={(open) => {
              setCountryOpen(open);
              if (!open) {
                setSearchCountry("");
                requestAnimationFrame(() => {
                  try {
                    countryTriggerRef.current?.blur?.();
                  } catch {
                    (document.activeElement as HTMLElement | null)?.blur?.();
                  }
                });
              }
            }}
          >
            <Select.Trigger
              ref={countryTriggerRef}
              data-country-trigger
              className="w-full location-country-trigger"
            >
              {isLoadingLocation && !selectedCountryData ? (
                <Flex align="center" gap="2">
                  <Loader2 size={14} className="animate-spin" />
                  <Text size="2" className="text-gray-400">
                    Detecting...
                  </Text>
                </Flex>
              ) : selectedCountryData ? (
                <Flex align="center" gap="2">
                  <Text
                    size="2"
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
                  <Text size="2" className="truncate text-accent">
                    {selectedCountry}
                  </Text>
                </Flex>
              ) : countriesError ? (
                <Text size="2" className="text-red-400">
                  Error loading regions
                </Text>
              ) : (
                <Text size="2" className="text-gray-400">
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
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <div className="location-search-wrapper">
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={searchCountry}
                  onChange={(e) => setSearchCountry(e.target.value)}
                  className="location-search-input"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <Select.Group>
                {filteredCountries.map((country) => (
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
                  <div className="px-3 py-2 text-gray-500 text-sm">
                    No countries found
                  </div>
                )}

                {isLoadingCountries && (
                  <div className="px-3 py-2 text-gray-500 text-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Loading countries...
                  </div>
                )}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Flex>

        <Flex align="center" gap="2" className="relative flex-1 min-w-0">
          <Radio size={16} className="text-accent flex-shrink-0" />
          <Select.Root
            value={currentStationUuid}
            onValueChange={handleStationChange}
            disabled={!selectedCountry || isLoadingStations}
            open={stationOpen}
            onOpenChange={(open) => {
              setStationOpen(open);
              if (!open) {
                setSearchStation("");
                requestAnimationFrame(() => {
                  try {
                    stationTriggerRef.current?.blur?.();
                  } catch {
                    (document.activeElement as HTMLElement | null)?.blur?.();
                  }
                });
              }
            }}
          >
            <Select.Trigger
              ref={stationTriggerRef}
              data-station-trigger
              className="w-full location-country-trigger min-w-0"
              placeholder="Select station"
            >
              {isLoadingStations ? (
                <Flex align="center" gap="2">
                  <Loader2 size={14} className="animate-spin" />
                  <Text size="2" className="text-gray-400">
                    Loading...
                  </Text>
                </Flex>
              ) : selectedStationData ? (
                <Flex align="center" gap="2" className="w-full min-w-0">
                  <Text
                    size="2"
                    className="flex-1 truncate text-left text-accent"
                    style={{
                      textShadow: "0 0 6px rgba(255, 145, 77, 0.4)",
                    }}
                  >
                    {selectedStationData.name}
                  </Text>
                </Flex>
              ) : (
                <Text size="2" className="text-gray-400 truncate">
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
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <div className="location-search-wrapper">
                <input
                  type="text"
                  placeholder="Search stations..."
                  value={searchStation}
                  onChange={(e) => setSearchStation(e.target.value)}
                  className="location-search-input"
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
                  <div className="px-3 py-2 text-gray-500 text-sm">
                    {selectedCountry
                      ? `No stations found in ${selectedCountryData?.name || selectedCountry
                      }`
                      : "Please select a country first"}
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
