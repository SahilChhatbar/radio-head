// File: client/components/LocationSelector.tsx
// Fixed version with proper value display and immediate station loading

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
                console.log("🌍 Fetching countries list...");
                const countriesData = await radioApi.getCountries();
                console.log("✅ Countries raw:", countriesData?.length);

                // 🔧 Normalize shape: ensure we always have a 2-letter code
                const normalized = (countriesData || []).map((c: any) => ({
                    name: c.name,
                    stationcount: c.stationcount,
                    // RadioBrowser uses "countrycode" and/or "iso_3166_1"
                    code:
                        c.countrycode?.toUpperCase() ||
                        c.iso_3166_1?.toUpperCase() ||
                        c.code?.toUpperCase() ||
                        // ultra fallback: first 2 letters of name (not ideal, but prevents crashes)
                        String(c.name).slice(0, 2).toUpperCase(),
                }));

                setCountries(normalized);
            } catch (error) {
                console.error("❌ Failed to load countries:", error);
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
            const savedStation = localStorage.getItem("radioverse-station");

            if (savedCountry) {
                console.log("📍 Using saved country:", savedCountry);
                setSelectedCountry(savedCountry);
                await loadStationsForCountry(savedCountry);
                if (savedStation) {
                    setSelectedStation(savedStation);
                }
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
                                console.log("📍 Location detected:", countryCode);
                                setSelectedCountry(countryCode);
                                setLocationGranted(true);
                                localStorage.setItem("radioverse-country", countryCode);
                                await loadStationsForCountry(countryCode);
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

    const loadDefaultStations = async () => {
        console.log("📻 Loading default stations");
        const defaultCountry = "IN";
        setSelectedCountry(defaultCountry);
        localStorage.setItem("radioverse-country", defaultCountry);
        await loadStationsForCountry(defaultCountry);
    };

    const loadStationsForCountry = async (countryCode: string) => {
        console.log("📻 Loading stations for:", countryCode);
        setIsLoadingStations(true);
        try {
            const stationsData = await radioApi.getStationsByCountry(countryCode, 100);
            console.log(`✅ Loaded ${stationsData?.length ?? 0} stations for ${countryCode}`);
            setStations(stationsData || []);
        } catch (error) {
            console.error("❌ Failed to load stations:", error);
            try {
                const popularStations = await radioApi.getPopularStations(50);
                setStations(popularStations || []);
            } catch (fallbackError) {
                console.error("❌ Failed to load fallback stations:", fallbackError);
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

    // === FIX: don't re-filter by countrycode — stations comes from loadStationsForCountry
    const filteredStations = useMemo(() => {
        // Debugging: log station count and sample
        // console.log("stations from store:", stations?.length, stations?.slice?.(0,3));
        if (!stations || stations.length === 0) return [];
        if (!searchStation) return stations;
        return stations.filter((station) =>
            station.name?.toLowerCase().includes(searchStation.toLowerCase())
        );
    }, [stations, searchStation]);

    // helpful debug while developing
    useEffect(() => {
        console.log("🔎 filteredStations.length:", filteredStations.length);
    }, [filteredStations.length]);

    const handleCountryChange = async (countryCode: string) => {
        console.log("🌍 Country changed to:", countryCode);
        setSelectedCountry(countryCode);
        const { setSelectedCountry: storeSetSelectedCountry } = useRadioStore.getState();
        if (typeof storeSetSelectedCountry === "function") {
            storeSetSelectedCountry(countryCode); // Update store if function exists
        }
        setSelectedStation(""); // Clear selected station
        setSearchStation("");

        // IMMEDIATELY load stations for the new country
        await loadStationsForCountry(countryCode);

        onCountryChange?.(countryCode);
    };

    const handleStationChange = (stationUuid: string) => {
        setSelectedStation(stationUuid);
        localStorage.setItem("radioverse-station", stationUuid);

        const station = filteredStations.find((s) => s.stationuuid === stationUuid);
        if (station) {
            console.log(`📻 Playing station: ${station.name} from ${station.country}`);
            play(station);
            onStationChange?.(stationUuid);
        }
    };

    const selectedCountryData = countries.find((c) => c.code === selectedCountry);
    const selectedStationData = filteredStations.find(
        (s) => s.stationuuid === selectedStation
    );

    const isCountryDropdownDisabled = isLoadingCountries && countries.length === 0;

    return (
        <Flex gap="3" align="center" className="w-full">
            {/* Country/Region Dropdown */}
            <Flex align="center" gap="2" className="relative min-w-[180px]">
                <MapPin size={16} className="text-[#ff914d] flex-shrink-0" />
                <Select.Root
                    value={selectedCountry}
                    onValueChange={handleCountryChange}
                    disabled={isCountryDropdownDisabled}
                >
                    <Select.Trigger
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
                                    value={country.code}   // ✅ ALWAYS a 2-letter ISO code
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
                                    : filteredStations.length === 0
                                        ? "No stations available"
                                        : "Select station"}
                            </Text>
                        )}
                    </Select.Trigger>

                    {/* FIX: ensure content is visible (z-index) and wide enough */}
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
                                        ? `No stations found in ${selectedCountryData?.name || selectedCountry}`
                                        : "Please select a country first"}
                                </div>
                            )}
                        </Select.Group>
                    </Select.Content>
                </Select.Root>
            </Flex>

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
