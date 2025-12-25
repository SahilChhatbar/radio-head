"use client";

import React, { useState, useEffect, useRef, memo } from "react";
import { Flex, Text, ScrollArea } from "@radix-ui/themes";
import { Heart, Loader2 } from "lucide-react";
import { RadioStation } from "@/types";
import { favoritesApi } from "@/api/favorites";
import { useRadioStore } from "@/store/useRadiostore";
import { formatVotes } from "@/utils/formatting";

interface FavoritesDropdownProps {
    isOpen: boolean;
    onClose: () => void;
}

const StationItem = memo(
    ({
        station,
        isCurrentStation,
        onClick,
    }: {
        station: RadioStation;
        isCurrentStation: boolean;
        onClick: () => void;
    }) => (
        <button
            onClick={onClick}
            className="w-full px-3 py-2 hover:bg-[rgba(255,145,77,0.12)] rounded-md transition-colors text-left"
            style={{
                backgroundColor: isCurrentStation
                    ? "rgba(255,145,77,0.15)"
                    : "transparent",
            }}
        >
            <Flex direction="row" gap="1" align="center" justify="between">
                <Text
                    size="2"
                    weight="regular"
                    className="truncate"
                    style={{
                        textShadow: isCurrentStation
                            ? "0 0 8px rgba(255, 145, 77, 0.6)"
                            : "none",
                        color: isCurrentStation ? "#FF914D" : "var(--foreground)",
                    }}
                >
                    {station.name}
                </Text>
                <Text size="1" weight="regular" className="text-gray-400">
                    🔥{formatVotes(station.votes)}
                </Text>
            </Flex>
        </button>
    )
);
StationItem.displayName = "StationItem";

const FavoritesDropdown: React.FC<FavoritesDropdownProps> = ({
    isOpen,
    onClose,
}) => {
    const [favorites, setFavorites] = useState<RadioStation[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const currentStationUuid = useRadioStore(
        (state) => state.currentStation?.stationuuid || ""
    );
    const play = useRadioStore((state) => state.play);

    useEffect(() => {
        if (isOpen) {
            loadFavorites();
            setTimeout(() => searchInputRef.current?.focus(), 100);
        } else {
            setSearchQuery("");
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    const loadFavorites = async () => {
        setLoading(true);
        try {
            const data = await favoritesApi.getFavorites();
            setFavorites(data);
        } catch (error) {
            console.error("Failed to load favorites:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStationClick = (station: RadioStation) => {
        play(station);
        onClose();
    };

    const filteredFavorites = favorites.filter((station) =>
        station.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div
            ref={dropdownRef}
            className="absolute top-full right-0 mt-2 bg-[var(--secondary-dark)] border border-[rgba(255,145,77,0.3)] rounded-lg shadow-lg z-50"
            style={{
                width: "clamp(280px, 40vw, 400px)",
                maxHeight: "clamp(300px, 50vh, 500px)",
                borderRadius: "var(--radius-lg)",
            }}
        >
            <div className="p-3 border-b border-[rgba(255,145,77,0.2)]">
                <Flex align="center" gap="2" className="mb-3">
                    <Heart size={18} className="text-[#FF914D]" />
                    <Text size="3" weight="bold" className="text-[#FF914D]">
                        Favorite Stations
                    </Text>
                </Flex>

                {/* Search Input */}
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search favorites..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#16283a] border border-[rgba(255,145,77,0.3)] rounded-md px-3 py-2 text-sm text-[var(--foreground)] transition-colors focus:outline-none focus:border-[rgba(255,145,77,0.6)]"
                    style={{
                        fontSize: "var(--font-size-sm)",
                        borderRadius: "var(--radius-sm)",
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            <ScrollArea
                style={{
                    height: "clamp(200px, 40vh, 400px)",
                    padding: "var(--spacing-sm)",
                }}
            >
                {loading ? (
                    <Flex align="center" justify="center" className="py-8">
                        <Loader2 size={24} className="animate-spin text-[#FF914D]" />
                    </Flex>
                ) : filteredFavorites.length === 0 ? (
                    <Flex
                        direction="column"
                        align="center"
                        justify="center"
                        gap="2"
                        className="py-8"
                    >
                        <Heart size={32} className="text-gray-600" />
                        <Text size="2" className="text-gray-500">
                            {searchQuery
                                ? "No favorites match your search"
                                : "No favorite stations yet"}
                        </Text>
                        <Text size="1" className="text-gray-600">
                            {!searchQuery && "Click the heart icon to add stations"}
                        </Text>
                    </Flex>
                ) : (
                    <div className="space-y-1">
                        {filteredFavorites.map((station) => (
                            <StationItem
                                key={station.stationuuid}
                                station={station}
                                isCurrentStation={currentStationUuid === station.stationuuid}
                                onClick={() => handleStationClick(station)}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Footer with count */}
            {favorites.length > 0 && (
                <div className="px-3 py-2 border-t border-[rgba(255,145,77,0.2)]">
                    <Text size="1" className="text-gray-500">
                        {filteredFavorites.length} of {favorites.length} station
                        {favorites.length !== 1 ? "s" : ""}
                    </Text>
                </div>
            )}
        </div>
    );
};

export default memo(FavoritesDropdown);
