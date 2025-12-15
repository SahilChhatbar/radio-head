"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Select, Flex, Text } from "@radix-ui/themes";
import { MapPin, Radio, Loader2 } from "lucide-react";
import { useRadioStore } from "@/store/useRadiostore";
import { radioApi } from "@/api/index";

interface Country {
  name: string;
  stationcount: number;
  code: string;
}

interface LocationSelectorProps {
  onCountryChange?: (countryCode: string) => void;
  onStationChange?: (stationId: string) => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  onCountryChange,
  onStationChange,
}) => {
  const { stations, setStations, play, setShowPlayer } = useRadioStore();
  const countryTriggerRef = React.useRef<HTMLButtonElement>(null);
  const stationTriggerRef = React.useRef<HTMLButtonElement>(null);

  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedStation, setSelectedStation] = useState("");

  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  const [countriesError, setCountriesError] = useState<string | null>(null);

  const [locationGranted, setLocationGranted] = useState(false);
  const [searchCountry, setSearchCountry] = useState("");
  const [searchStation, setSearchStation] = useState("");

  // NEW: control open state explicitly so we can blur after close
  const [countryOpen, setCountryOpen] = useState(false);
  const [stationOpen, setStationOpen] = useState(false);

  const getCountryEmoji = (countryCode: string) => {
    try {
      const codePoints = countryCode
        .toUpperCase()
        .split("")
        .map((char) => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    } catch {
      return "🌍";
    }
  };

  useEffect(() => {
    const fetchCountries = async () => {
      setIsLoadingCountries(true);
      setCountriesError(null);
      try {
        const countriesData = await radioApi.getCountries();
        const normalized = (countriesData || []).map((c: any) => ({
          name: c.name,
          stationcount: c.stationcount,
          code:
            c.countrycode?.toUpperCase() ||
            c.iso_3166_1?.toUpperCase() ||
            c.code?.toUpperCase() ||
            String(c.name).slice(0, 2).toUpperCase(),
        }));

        setCountries(normalized);
      } catch (error) {
        setCountriesError("Failed to load countries");
        setCountries([]);
      } finally {
        setIsLoadingCountries(false);
      }
    };

    fetchCountries();
  }, []);

  useEffect(() => {
    const initializeLocation = async () => {
      const savedCountry = localStorage.getItem("radioverse-country");

      if (savedCountry) {
        setSelectedCountry(savedCountry);
        await loadStationsForCountry(savedCountry);
        setIsLoadingLocation(false);
        setLocationGranted(true);
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
                setLocationGranted(true);
                localStorage.setItem("radioverse-country", countryCode);
                await loadStationsForCountry(countryCode);
              } else {
                await loadDefaultStations();
              }
            } catch (error) {
              await loadDefaultStations();
            } finally {
              setIsLoadingLocation(false);
            }
          },
          async (error) => {
            await loadDefaultStations();
            setIsLoadingLocation(false);
          }
        );
      } else {
        await loadDefaultStations();
        setIsLoadingLocation(false);
      }
    };

    initializeLocation();
  }, []);

  const loadDefaultStations = async () => {
    const defaultCountry = "IN";
    setSelectedCountry(defaultCountry);
    localStorage.setItem("radioverse-country", defaultCountry);
    await loadStationsForCountry(defaultCountry);
  };

  const loadStationsForCountry = async (countryCode: string) => {
    setIsLoadingStations(true);
    try {
      const stationsData = await radioApi.getStationsByCountry(
        countryCode,
        100
      );
      setStations(stationsData || []);
    } catch (error) {
      try {
        const popularStations = await radioApi.getPopularStations(50);
        setStations(popularStations || []);
      } catch (fallbackError) {
        setStations([]);
      }
    } finally {
      setIsLoadingStations(false);
    }
  };

  const filteredCountries = useMemo(() => {
    if (!searchCountry) return countries;
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(searchCountry.toLowerCase()) ||
        (country.code &&
          country.code.toLowerCase().includes(searchCountry.toLowerCase()))
    );
  }, [countries, searchCountry]);

  const filteredStations = useMemo(() => {
    if (!stations || stations.length === 0) return [];
    if (!searchStation) return stations;
    return stations.filter((station) =>
      station.name?.toLowerCase().includes(searchStation.toLowerCase())
    );
  }, [stations, searchStation]);

  useEffect(() => {}, [filteredStations.length]);

  useEffect(() => {
    if (filteredStations.length > 0 && !selectedStation) {
      setSelectedStation(filteredStations[0].stationuuid);
    }
  }, [filteredStations, selectedStation]);
  const forceBlur = () => {
    [0, 10, 50, 100].forEach((delay) => {
      setTimeout(() => {
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
        } catch (err) {}
      }, delay);
    });
  };

  const handleCountryChange = async (countryCode: string) => {
    setSelectedCountry(countryCode);
    setCountryOpen(false);
    forceBlur();

    // load stations
    await loadStationsForCountry(countryCode);

    onCountryChange?.(countryCode);
  };

  const handleStationChange = (stationUuid: string) => {
    setSelectedStation(stationUuid);

    setStationOpen(false);
    forceBlur();

    const station = filteredStations.find((s) => s.stationuuid === stationUuid);
    if (station) {
      play(station);
    }
    onStationChange?.(stationUuid);
  };

  const selectedCountryData = countries.find((c) => c.code === selectedCountry);
  const selectedStationData = filteredStations.find(
    (s) => s.stationuuid === selectedStation
  );

  const isCountryDropdownDisabled =
    isLoadingCountries && countries.length === 0;

  return (
    <Flex gap="0" align="center" className="w-full">
      {/* Country/Region Dropdown */}
      <Flex align="center" gap="2" className="relative min-w-[180px]">
        <MapPin size={16} className="text-[#ff914d] flex-shrink-0" />
        <Select.Root
          value={selectedCountry}
          onValueChange={handleCountryChange}
          disabled={isCountryDropdownDisabled}
          open={countryOpen}
          onOpenChange={(open) => {
            setCountryOpen(open);
            if (!open) {
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
            className="w-full bg-[#0C1521] border border-gray-700/50 rounded-lg px-3 py-2 hover:border-[#ff914d]/50 transition-colors"
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
                <Text size="2" className="truncate">
                  {selectedCountryData.name}
                </Text>
              </Flex>
            ) : selectedCountry && countries.length > 0 ? (
              <Flex align="center" gap="2">
                <Text size="2" className="truncate">
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

          <Select.Content className="bg-[#0C1521] border border-gray-700/50 rounded-lg p-2 max-h-[300px] overflow-y-auto z-50">
            <div className="px-2 py-2 sticky top-0 bg-[#0C1521] border-b border-gray-700/50 mb-2 z-10">
              <input
                type="text"
                placeholder="Search countries..."
                value={searchCountry}
                onChange={(e) => setSearchCountry(e.target.value)}
                className="w-full bg-[#16283a] border border-gray-700/50 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ff914d]/50"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <Select.Group>
              {filteredCountries.map((country) => (
                <Select.Item
                  key={country.code}
                  value={country.code}
                  className="px-3 py-2 rounded hover:bg-[#ff914d]/10 cursor-pointer transition-colors"
                >
                  <Flex align="center" justify="between" gap="2">
                    <Flex align="center" gap="2">
                      <span>{getCountryEmoji(country.code)}</span>
                      <Text size="2">{country.name}</Text>
                    </Flex>
                    <Text size="1" className="text-gray-500">
                      {country.stationcount}
                    </Text>
                  </Flex>
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

      {/* Station Dropdown */}
      <Flex align="center" gap="2" className="relative flex-1 min-w-0">
        <Radio size={16} className="text-[#ff914d] flex-shrink-0" />
        <Select.Root
          value={selectedStation}
          onValueChange={handleStationChange}
          disabled={!selectedCountry || isLoadingStations}
          open={stationOpen}
          onOpenChange={(open) => {
            setStationOpen(open);
            if (!open) {
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
            className="w-full bg-[#0C1521] border border-gray-700/50 rounded-lg px-3 py-2 hover:border-[#ff914d]/50 transition-colors min-w-0"
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
                <Text size="2" className="flex-1 truncate text-left">
                  {selectedStationData.name}
                </Text>
                {selectedStationData.bitrate > 0 && (
                  <Text size="1" className="text-gray-500 flex-shrink-0">
                    {selectedStationData.bitrate}k
                  </Text>
                )}
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

          <Select.Content className="bg-[#0C1521] border border-gray-700/50 rounded-lg p-2 max-h-[400px] overflow-y-auto min-w-full w-[320px] z-50">
            <div className="px-2 py-2 sticky top-0 bg-[#0C1521] border-b border-gray-700/50 mb-2 z-10">
              <input
                type="text"
                placeholder="Search stations..."
                value={searchStation}
                onChange={(e) => setSearchStation(e.target.value)}
                className="w-full bg-[#16283a] border border-gray-700/50 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ff914d]/50"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <Select.Group>
              {filteredStations.map((station) => (
                <Select.Item
                  key={station.stationuuid}
                  value={station.stationuuid}
                  className="px-3 py-2 rounded hover:bg-[#ff914d]/10 cursor-pointer transition-colors"
                >
                  <Flex direction="column" gap="1">
                    <Text size="2" className="truncate">
                      {station.name}
                    </Text>
                    <Flex align="center" gap="2" className="text-gray-500">
                      {station.bitrate > 0 && (
                        <Text size="1">{station.bitrate}kbps</Text>
                      )}
                      {station.codec && (
                        <Text size="1" className="uppercase">
                          {station.codec}
                        </Text>
                      )}
                      {station.votes > 0 && (
                        <Text size="1">👍 {station.votes}</Text>
                      )}
                    </Flex>
                  </Flex>
                </Select.Item>
              ))}

              {filteredStations.length === 0 && !isLoadingStations && (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  {selectedCountry
                    ? `No stations found in ${
                        selectedCountryData?.name || selectedCountry
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
};

export default LocationSelector;
