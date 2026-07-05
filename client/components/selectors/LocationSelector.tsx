"use client";

import React, { memo } from "react";
import { Select, Flex, Text } from "@radix-ui/themes";
import { MapPin, Radio, Loader2 } from "lucide-react";
import { formatVotes } from "@/utils/formatting";
import { useLocationSelector } from "@/hooks/useLocationSelector";

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
  }) => {
    // Conditions & Derived UI values extracted for cleaner JSX
    const textShadowValue = isCurrentStation
      ? "0 0 8px rgba(239, 68, 68, 0.6)"
      : "0 0 4px rgba(239, 68, 68, 0.3)";
    const votesTextValue = `—${formatVotes(station.votes)} upvotes`;

    return (
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
            textShadow: textShadowValue,
          }}
        >
          {station.name}
        </Text>
        <Text size="1" weight="regular">
          {votesTextValue}
        </Text>
      </Flex>
    );
  }
);
StationItem.displayName = "StationItem";

const LocationSelector: React.FC<LocationSelectorProps> = memo(
  ({ onCountryChange, onStationChange }) => {
    const {
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
    } = useLocationSelector({ onCountryChange, onStationChange });

    const countryTriggerContent = (() => {
      if (isLoadingLocation && !selectedCountryData) {
        return (
          <Flex align="center" gap="2">
            <Loader2 size={14} className="animate-spin" />
            <Text size="2" weight="regular" className="text-gray-400">
              Detecting...
            </Text>
          </Flex>
        );
      }
      if (selectedCountryData) {
        return (
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
        );
      }
      if (selectedCountry && countries.length > 0) {
        return (
          <Flex align="center" gap="2">
            <Text
              size="2"
              weight="regular"
              className="truncate text-accent"
            >
              {selectedCountry}
            </Text>
          </Flex>
        );
      }
      if (countriesError) {
        return (
          <Text size="2" weight="regular" className="text-red-400">
            Error loading regions
          </Text>
        );
      }
      return (
        <Text size="2" weight="regular" className="text-gray-400">
          {isLoadingCountries ? "Loading regions..." : "Select region"}
        </Text>
      );
    })();

    const stationTriggerContent = (() => {
      if (isLoadingStations) {
        return (
          <Flex align="center" gap="2">
            <Loader2 size={14} className="animate-spin" />
            <Text size="2" weight="regular" className="text-gray-400">
              Loading...
            </Text>
          </Flex>
        );
      }
      if (selectedStationData) {
        return (
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
        );
      }
      const fallbackText = !selectedCountry
        ? "Please select region"
        : filteredStations.length === 0
        ? "No stations available"
        : "Select station";

      return (
        <Text
          size="2"
          weight="regular"
          className="text-gray-400 truncate"
        >
          {fallbackText}
        </Text>
      );
    })();


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
              className="w-full location-country-trigger cursor-pointer"
            >
              {countryTriggerContent}
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

                {showNoCountriesFound && (
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
              className="w-full location-country-trigger min-w-0 cursor-pointer"
              placeholder="Select station"
            >
              {stationTriggerContent}
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
                {showNoStationsFound && (
                  <div className="px-3 py-2">
                    <Text size="2" weight="regular" className="text-gray-500">
                      {noStationsFoundText}
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
