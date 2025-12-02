"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Select, Flex, Text } from "@radix-ui/themes";
import { MapPin, Radio, Loader2 } from "lucide-react";
import { useRadioStore } from "@/store/useRadiostore";
import { radioApi } from "@/api/index";

interface Country {
    name: string;
    stationcount: number;
    code?: string;
}

interface LocationSelectorProps {
    onCountryChange?: (countryCode: string) => void;
    onStationChange?: (stationId: string) => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
    onCountryChange,
    onStationChange,
}) => {
    const { stations, setStations, play } = useRadioStore();

    const [countries, setCountries] = useState<Country[]>([]);
    const [selectedCountry, setSelectedCountry] = useState("");
    const [selectedStation, setSelectedStation] = useState("");

    const [isLoadingLocation, setIsLoadingLocation] = useState(true);
    const [isLoadingCountries, setIsLoadingCountries] = useState(false);
    const [isLoadingStations, setIsLoadingStations] = useState(false);

    const [locationGranted, setLocationGranted] = useState(false);
    const [searchCountry, setSearchCountry] = useState("");
    const [searchStation, setSearchStation] = useState("");

    // Country code to emoji mapping
    const getCountryEmoji = (countryCode: string) => {
        const codePoints = countryCode
            .toUpperCase()
            .split("")
            .map((char) => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    };

    // Get user's location on mount
    useEffect(() => {
        const initializeLocation = async () => {
            const savedCountry = localStorage.getItem("radioverse-country");
            const savedStation = localStorage.getItem("radioverse-station");

            if (savedCountry) {
                setSelectedCountry(savedCountry);
                await loadStationsForCountry(savedCountry);
                if (savedStation) {
                    setSelectedStation(savedStation);
                }
                setIsLoadingLocation(false);
                setLocationGranted(true);
                return;
            }

            // Request geolocation
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
                                console.log("📍 Location detected:", countryCode);
                            } else {
                                await loadDefaultStations();
                            }
                        } catch (error) {
                            console.error("Failed to reverse geocode:", error);
                            await loadDefaultStations();
                        } finally {
                            setIsLoadingLocation(false);
                        }
                    },
                    async (error) => {
                        console.log("Location access denied:", error);
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

    // Load countries list
    useEffect(() => {
        const fetchCountries = async () => {
            setIsLoadingCountries(true);
            try {
                const countriesData = await radioApi.getCountries();
                setCountries(countriesData || []);
            } catch (error) {
                console.error("Failed to load countries:", error);
                setCountries([]);
            } finally {
                setIsLoadingCountries(false);
            }
        };

        fetchCountries();
    }, []);

    const loadDefaultStations = async () => {
        console.log("📻 Loading default top stations");
        const defaultCountry = "IN"; // Default to India
        setSelectedCountry(defaultCountry);
        localStorage.setItem("radioverse-country", defaultCountry);
        await loadStationsForCountry(defaultCountry);
    };

    const loadStationsForCountry = async (countryCode: string) => {
        setIsLoadingStations(true);
        try {
            const stationsData = await radioApi.getStationsByCountry(countryCode, 100);
            setStations(stationsData || []);
            console.log(`✅ Loaded ${stationsData?.length ?? 0} stations for ${countryCode}`);
        } catch (error) {
            console.error("Failed to load stations:", error);
            // Fallback to popular stations
            try {
                const popularStations = await radioApi.getPopularStations(50);
                setStations(popularStations || []);
            } catch (fallbackError) {
                console.error("Failed to load fallback stations:", fallbackError);
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
        if (!searchStation) return stations;
        return stations.filter((station) =>
            station.name.toLowerCase().includes(searchStation.toLowerCase())
        );
    }, [stations, searchStation]);

    const handleCountryChange = async (countryCode: string) => {
        setSelectedCountry(countryCode);
        setSelectedStation("");
        setSearchStation("");
        localStorage.setItem("radioverse-country", countryCode);
        await loadStationsForCountry(countryCode);
        onCountryChange?.(countryCode);
    };

    const handleStationChange = (stationUuid: string) => {
        setSelectedStation(stationUuid);
        localStorage.setItem("radioverse-station", stationUuid);

        const station = stations.find((s) => s.stationuuid === stationUuid);
        if (station) {
            play(station);
            onStationChange?.(stationUuid);
        }
    };

    const selectedCountryData = countries.find((c) => c.code === selectedCountry);
    const selectedStationData = stations.find(
        (s) => s.stationuuid === selectedStation
    );

    return (
        <Flex gap="3" align="center" className="w-full">
            {/* Country/Region Dropdown */}
            <Flex align="center" gap="2" className="relative min-w-[180px]">
                <MapPin size={16} className="text-[#ff914d] flex-shrink-0" />
                <Select.Root
                    value={selectedCountry}
                    onValueChange={handleCountryChange}
                    // 👇 IMPORTANT: keep it always interactive, don't block on location
                    disabled={isLoadingCountries && countries.length === 0}
                >
                    <Select.Trigger
                        className="w-full bg-[#0C1521] border border-gray-700/50 rounded-lg px-3 py-2 hover:border-[#ff914d]/50 transition-colors"
                        placeholder={
                            isLoadingLocation && !selectedCountryData
                                ? "Detecting..."
                                : "Select region"
                        }
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
                                <span>
                                    {selectedCountryData.code
                                        ? getCountryEmoji(selectedCountryData.code)
                                        : "🌍"}
                                </span>
                                <Text size="2" className="truncate">
                                    {selectedCountryData.name}
                                </Text>
                            </Flex>
                        ) : (
                            <Text size="2" className="text-gray-400">
                                {isLoadingCountries ? "Loading regions..." : "Select region"}
                            </Text>
                        )}
                    </Select.Trigger>

                    <Select.Content className="bg-[#0C1521] border border-gray-700/50 rounded-lg p-2 max-h-[300px] overflow-y-auto">
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
                                    key={country.code || country.name}
                                    value={country.code || country.name}
                                    className="px-3 py-2 rounded hover:bg-[#ff914d]/10 cursor-pointer transition-colors"
                                >
                                    <Flex align="center" justify="between" gap="2">
                                        <Flex align="center" gap="2">
                                            <span>
                                                {country.code ? getCountryEmoji(country.code) : "🌍"}
                                            </span>
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
                >
                    <Select.Trigger
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
                                    : stations.length === 0
                                        ? "No stations available"
                                        : "Select station"}
                            </Text>
                        )}
                    </Select.Trigger>

                    <Select.Content className="bg-[#0C1521] border border-gray-700/50 rounded-lg p-2 max-h-[400px] overflow-y-auto w-[320px]">
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
                                    No stations found
                                </div>
                            )}
                        </Select.Group>
                    </Select.Content>
                </Select.Root>
            </Flex>

            {/* Location indicator */}
            {locationGranted && (
                <div
                    className="hidden lg:flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded flex-shrink-0"
                    title="Location detected automatically"
                >
                    <MapPin size={12} />
                    <span>Auto</span>
                </div>
            )}
        </Flex>
    );
};

export default LocationSelector;
