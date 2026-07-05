"use client";

import React, { memo } from "react";
import { Button, Text } from "@radix-ui/themes";
import { Volume2, VolumeX } from "lucide-react";
import * as Slider from "@radix-ui/react-slider";
import { ORANGE, iconSize } from "./constants";

interface VolumeControlProps {
  isMuted: boolean;
  volume: number;
  displayVolume: number;
  onMuteToggle: () => void;
  onVolumeChange: (v: number[]) => void;
}

const VolumeControl = memo(
  ({
    isMuted,
    volume,
    displayVolume,
    onMuteToggle,
    onVolumeChange,
  }: VolumeControlProps) => {
    // Conditions & Derived UI values extracted for cleaner JSX
    const isVolumeMutedOrZero = isMuted || volume === 0;
    const VolumeIcon = isVolumeMutedOrZero ? VolumeX : Volume2;
    const volumePercentageText = `${Math.round(displayVolume * 100)}%`;

    return (
      <>
        <Button
          variant="ghost"
          onClick={onMuteToggle}
          className="cursor-pointer hover:bg-[#FF914D]/10"
          style={{ padding: "var(--spacing-xs)" }}
        >
          <VolumeIcon
            color={ORANGE}
            style={{ width: iconSize, height: iconSize }}
          />
        </Button>

        <div
          className="hidden md:block"
          style={{ width: "clamp(60px, 10vw, 100px)" }}
        >
          <Slider.Root
            min={0}
            max={1}
            step={0.01}
            value={[displayVolume]}
            onValueChange={onVolumeChange}
            className="relative flex items-center w-full cursor-pointer"
            style={{ height: "clamp(1rem, 1.5vw, 1.5rem)" }}
          >
            <Slider.Track
              className="relative w-full bg-slate-700 rounded-lg"
              style={{ height: "clamp(3px, 0.5vw, 5px)" }}
            >
              <Slider.Range
                className="absolute h-full rounded-lg"
                style={{ background: ORANGE }}
              />
            </Slider.Track>
            <Slider.Thumb
              className="block bg-white rounded-full shadow cursor-pointer"
              style={{
                width: "clamp(12px, 2vw, 18px)",
                height: "clamp(12px, 2vw, 18px)",
              }}
            />
          </Slider.Root>
        </div>

        <Text
          size="1"
          className="text-[#FF914D] hidden lg:block"
          style={{ minWidth: "clamp(1.5rem, 3vw, 2.5rem)" }}
        >
          {volumePercentageText}
        </Text>
      </>
    );
  },
);

VolumeControl.displayName = "VolumeControl";

export default VolumeControl;
