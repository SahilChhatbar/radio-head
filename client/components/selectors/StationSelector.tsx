"use client";

import React, { memo } from "react";
import { Text } from "@radix-ui/themes";
import { useStationSelector } from "@/hooks/useStationSelector";
import Loader from "../layout/Loader";

interface Tick {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  strokeWidth?: number;
  visible: boolean;
}

const StationGauge = memo(() => {
  const VIEWBOX_SIZE = 800;
  const INNER_R = 300;
  const OUTER_R = 350;

  const {
    gaugeRef,
    stations,
    isInitializing,
    isLoadingStations,
    ticks,
    stationInfo,
    formattedStationDisplay,
    stationTitleText,
    handleGaugeClick,
    handleKeyDown,
    center: CENTER,
  } = useStationSelector({
    viewBoxSize: VIEWBOX_SIZE,
    innerR: INNER_R,
    outerR: OUTER_R,
  });

  if (
    isLoadingStations ||
    stations.length === 0 ||
    (isInitializing && stations.length === 0)
  ) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <Loader variant="spinner" />
        <Text size="2" weight="regular" className="text-slate-500">
          Loading stations...
        </Text>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-8 bg-transparent max-w-130 mx-auto">
      <div
        className="w-full aspect-square cursor-pointer transition-all duration-300 hover:scale-105 focus:outline-none rounded-full"
        style={{ position: "relative" }}
        onClick={handleGaugeClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Radio gauge. Current station: ${
          stationInfo.display
        }. Quality: ${
          stationInfo.quality || "unknown"
        }. Use left/right arrows to change station, Enter or Space to toggle play.`}
        title={`${stationInfo.display}${
          stationInfo.quality ? ` (${stationInfo.quality} quality)` : ""
        }\n\nClick to toggle play\nUse ←→ keys to change station\nEnter/Space to toggle`}
      >
        <svg
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          className="w-full h-full drop-shadow-lg"
          style={{ position: "relative" }}
        >
          {stationInfo.quality && (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={OUTER_R + 15}
              fill="none"
              strokeDasharray={`${(stationInfo.score / 100) * 31.4159} 31.4159`}
              strokeLinecap="round"
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
              opacity={0.5}
            />
          )}
          {ticks.map(({ x1, y1, x2, y2, strokeWidth, visible }, idx) =>
            visible ? (
              <line
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#ff914d"
                strokeWidth={strokeWidth}
                opacity={0.8}
              />
            ) : null,
          )}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={15}
            fill="#ff914d"
            stroke="#333"
            strokeWidth={3}
          />
          <g ref={gaugeRef}>
            <line
              x1={CENTER}
              y1={CENTER}
              x2={CENTER}
              y2={CENTER - INNER_R + 30}
              stroke="#ff914d"
              strokeWidth={6}
              strokeLinecap="round"
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
            />
          </g>
          <foreignObject
            x={CENTER + 30}
            y={CENTER + 80}
            width={Math.min(240, VIEWBOX_SIZE * 0.35)}
            height="20%"
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                pointerEvents: "auto",
                padding: "var(--spacing-sm)",
                boxSizing: "border-box",
                gap: "var(--spacing-xs)",
              }}
            >
              <Text
                size="2"
                weight="bold"
                className="w-full block text-center text-[#ff914d] font-bungee text-fluid-base rounded-xl px-3 py-2 bg-[rgba(12,21,33,0.8)] border border-[rgba(255,145,77,0.3)] shadow-[0_0_12px_rgba(255,145,77,0.2)] transition-all duration-150 ease-out overflow-hidden"
                title={stationTitleText}
                style={{
                  textShadow: "0 0 6px rgba(255, 145, 77, 0.4)",
                }}
              >
                <span className="scrolling-text inline-block whitespace-nowrap">
                  {formattedStationDisplay}
                </span>
              </Text>
            </div>
          </foreignObject>
        </svg>
      </div>
    </div>
  );
});

StationGauge.displayName = "StationGauge";

export default StationGauge;
