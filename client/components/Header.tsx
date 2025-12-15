"use client";

import React, { useMemo, memo, useCallback } from "react";
import { Button, Flex, Container, Text } from "@radix-ui/themes";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import Logo from "./Logo";
import LocationSelector from "./LocationSelector";
import { useRadioStore } from "@/store/useRadiostore";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  priority?: boolean;
  variant?: "default" | "icon-only" | "vertical";
  className?: string;
}

interface HeaderProps {
  className?: string;
  showSignIn?: boolean;
  logoProps?: Partial<LogoProps>;
  radioStation?: {
    frequency: string;
    tagline: string;
  };
}

const StationDropdownItem = memo(
  ({
    station,
    isCurrentStation,
    onSelect,
  }: {
    station: any;
    isCurrentStation: boolean;
    onSelect: (uuid: string) => void;
  }) => (
    <DropdownMenu.Item
      className="px-3 py-2 rounded hover:bg-[#ff914d]/10 cursor-pointer transition-colors focus:outline-none focus:bg-[#ff914d]/10"
      onSelect={() => onSelect(station.stationuuid)}
    >
      <Flex direction="column" gap="1">
        <Text
          size="2"
          className={`truncate ${
            isCurrentStation ? "text-[#ff914d] font-medium" : "text-gray-300"
          }`}
        >
          {station.name}
        </Text>
        <Flex align="center" gap="2" className="text-gray-500">
          {station.bitrate > 0 && <Text size="1">{station.bitrate}kbps</Text>}
          {station.codec && (
            <Text size="1" className="uppercase">
              {station.codec}
            </Text>
          )}
        </Flex>
      </Flex>
    </DropdownMenu.Item>
  )
);
StationDropdownItem.displayName = "StationDropdownItem";

const Header: React.FC<HeaderProps> = memo(
  ({ className = "", showSignIn = true, logoProps = {} }) => {
    const currentStation = useRadioStore((state) => state.currentStation);
    const stations = useRadioStore((state) => state.stations);
    const play = useRadioStore((state) => state.play);

    const displayText = useMemo(() => {
      return currentStation?.name || "no station playing";
    }, [currentStation?.name]);

    const handleStationSelect = useCallback(
      (stationUuid: string) => {
        const station = stations.find((s) => s.stationuuid === stationUuid);
        if (station) {
          play(station);
        }
      },
      [stations, play]
    );

    const displayedStations = useMemo(() => {
      return stations.slice(0, 20);
    }, [stations]);

    return (
      <header className={`p-3 ${className}`}>
        <Container size="4">
          <Flex align="center" justify="between" className="h-16 px-6">
            <Flex align="center">
              <div className="block md:hidden">
                <Logo size="md" priority variant="icon-only" {...logoProps} />
              </div>
              <div className="hidden md:block">
                <Logo size="md" priority {...logoProps} />
              </div>
            </Flex>
            <Flex
              align="center"
              className="hidden sm:flex flex-1 justify-center mx-4 max-w-md"
            >
              <LocationSelector />
            </Flex>
            <Flex align="center" gap="3">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="hidden lg:flex items-center gap-2 bg-gray-900/60 border border-gray-700/50 rounded-lg px-3 py-1.5 backdrop-blur-sm hover:border-[#ff914d]/50 transition-colors cursor-pointer"
                    title={displayText}
                  >
                    <Text
                      size="1"
                      className="text-red-400 font-mono font-medium tracking-wider [text-shadow:0_0_8px_rgb(248_113_113_/_0.8)] truncate max-w-[200px]"
                    >
                      {displayText}
                    </Text>
                    <ChevronDown size={14} className="text-red-400" />
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="bg-[#0C1521] border border-gray-700/50 rounded-lg p-2 max-h-[400px] overflow-y-auto min-w-[280px] z-50 shadow-lg"
                    sideOffset={5}
                  >
                    {displayedStations.length > 0 ? (
                      displayedStations.map((station) => (
                        <StationDropdownItem
                          key={station.stationuuid}
                          station={station}
                          isCurrentStation={
                            currentStation?.stationuuid === station.stationuuid
                          }
                          onSelect={handleStationSelect}
                        />
                      ))
                    ) : (
                      <div className="px-3 py-2 text-gray-500 text-sm">
                        No stations available
                      </div>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              {showSignIn && <Button size="2">Sign In</Button>}
            </Flex>
          </Flex>
        </Container>
      </header>
    );
  }
);

Header.displayName = "Header";

export default Header;
export type { HeaderProps, LogoProps };
