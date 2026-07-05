"use client";

import React from "react";
import { Button } from "@radix-ui/themes";
import { Heart, Loader2 } from "lucide-react";
import { RadioStation } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorite } from "@/hooks/useFavorites";

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
  const { isFavorited, loading, toggleFavorite } = useFavorite(station);

  if (!user || !station) return null;

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite();
  };

  // Conditions & Derived UI values extracted for cleaner JSX
  const buttonTitle = isFavorited ? "Remove from favorites" : "Add to favorites";
  const heartClassName = isFavorited
    ? "fill-[#FF914D] text-[#FF914D]"
    : "text-[#FF914D]";

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleToggleFavorite}
      disabled={loading}
      className="cursor-pointer hover:bg-[#FF914D]/10 transition-colors"
      style={{ padding: "var(--spacing-xs)" }}
      title={buttonTitle}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <Heart
          size={18}
          className={heartClassName}
        />
      )}
    </Button>
  );
};

export default FavoriteButton;

