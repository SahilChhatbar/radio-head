"use client";

import React, { memo } from "react";
import { Disc3, Unplug } from "lucide-react";
import { iconSize } from "./constants";

interface StationIconProps {
  isLoading: boolean;
  isPlaying: boolean;
}

const StationIcon = memo(({ isLoading, isPlaying }: StationIconProps) => {
  if (isLoading) {
    return (
      <div
        className="border-2 border-[#FF914D] border-t-transparent rounded-full animate-spin"
        style={{
          width: iconSize,
          height: iconSize,
        }}
      />
    );
  }
  if (isPlaying) {
    return (
      <Disc3
        className="text-[#FF914D] animate-spin"
        style={{ width: iconSize, height: iconSize }}
      />
    );
  }
  return (
    <Unplug
      className="text-[#FF914D]"
      style={{ width: iconSize, height: iconSize }}
    />
  );
});

StationIcon.displayName = "StationIcon";

export default StationIcon;
