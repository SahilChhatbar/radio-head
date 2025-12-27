"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@radix-ui/themes";
import { Heart, Loader2 } from "lucide-react";
import { RadioStation } from "@/types";
import { favoritesApi } from "@/api/favorites";
import { useAuth } from "@/contexts/AuthContext";

interface FavoriteButtonProps {
  station: RadioStation | null;
  size?: "1" | "2" | "3";
  variant?: "solid" | "soft" | "ghost";
}

const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  station,
  size = "2",
  variant = "ghost",
}) => {
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && station) {
      checkFavoriteStatus();
    } else {
      setIsFavorited(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, station]);

  const checkFavoriteStatus = async () => {
    if (!station) return;
    try {
      const status = await favoritesApi.checkFavorite(station.stationuuid);
      setIsFavorited(status);
    } catch (error) {
      console.error("Failed to check favorite status:", error);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user || !station) return;

    setLoading(true);
    try {
      if (isFavorited) {
        await favoritesApi.removeFavorite(station.stationuuid);
        setIsFavorited(false);
      } else {
        await favoritesApi.addFavorite(station);
        setIsFavorited(true);
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || !station) return null;

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleToggleFavorite}
      disabled={loading}
      className="hover:bg-[#FF914D]/10 transition-colors"
      style={{ padding: "var(--spacing-xs)" }}
      title={isFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <Heart
          size={18}
          className={
            isFavorited ? "fill-[#FF914D] text-[#FF914D]" : "text-[#FF914D]"
          }
        />
      )}
    </Button>
  );
};

export default FavoriteButton;
