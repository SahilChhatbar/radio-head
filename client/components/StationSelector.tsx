"use client";

import React, { useEffect, useRef, memo, useCallback } from "react";
import { Text } from "@radix-ui/themes";
import {
  useRadioStore,
  useStations,
  useCurrentStationIndex,
  useShowPlayer,
  useIsPlaying,
  useCurrentStation,
} from "@/store/useRadiostore";
import { getStationQualityInfo } from "@/services/StationFilter";
import Loader from "./Loader";

interface StationGaugeProps {
  limit?: number;
}

interface Tick {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  strokeWidth?: number;
  visible: boolean;
}

const StationGauge = memo(({ limit = 50 }: StationGaugeProps) => {
  const VIEWBOX_SIZE = 800;
  const CENTER = VIEWBOX_SIZE / 2;
  const INNER_R = 300;
  const OUTER_R = 350;

  const gaugeRef = useRef<SVGGElement>(null);
  const prevAngleRef = useRef<number>(180);

  const stations = useStations();
  const currentStationIndex = useCurrentStationIndex();
  const showPlayer = useShowPlayer();
  const isPlaying = useIsPlaying();
  const currentStation = useCurrentStation();

  const setStations = useRadioStore((state) => state.setStations);
  const nextStation = useRadioStore((state) => state.nextStation);
  const previousStation = useRadioStore((state) => state.previousStation);
  const play = useRadioStore((state) => state.play);
  const stop = useRadioStore((state) => state.stop);
  const setShowPlayer = useRadioStore((state) => state.setShowPlayer);
  const selectedCountry = useRadioStore((state) => state.selectedCountry);

  const [isInitializing, setIsInitializing] = React.useState(false);
  const [isLoadingStations, setIsLoadingStations] = React.useState(false);

  useEffect(() => {
    if (stations.length > 0 && isInitializing) {
      setIsInitializing(false);
    }
  }, [stations.length, isInitializing]);

  const indexToAngle = useCallback(
    (index: number) => {
      if (stations.length === 0) return 180;
      return 180 + (index / Math.max(stations.length - 1, 1)) * 270;
    },
    [stations.length]
  );

  useEffect(() => {
    if (!gaugeRef.current) return;

    const prevAngle = prevAngleRef.current;
    const newAngle = indexToAngle(currentStationIndex);
    let delta = newAngle - prevAngle;

    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const finalAngle = prevAngle + delta;
    gaugeRef.current.style.transform = `rotate(${finalAngle}deg)`;
    gaugeRef.current.style.transformOrigin = `${CENTER}px ${CENTER}px`;
    gaugeRef.current.style.transition = "transform 0.3s ease-in-out";
    prevAngleRef.current = finalAngle;
  }, [currentStationIndex, indexToAngle, CENTER]);

  const ticks: Tick[] = React.useMemo(() => {
    return Array.from({ length: 136 }).map((_, i) => {
      const angleDeg = 90 + i * 2;
      const rad = (angleDeg * Math.PI) / 180;
      const isMajor = i % 10 === 0;
      const r1 = INNER_R + (isMajor ? 0 : 20);
      const r2 = OUTER_R;

      if (i <= 135) {
        return {
          x1: CENTER + Math.cos(rad) * r1,
          y1: CENTER + Math.sin(rad) * r1,
          x2: CENTER + Math.cos(rad) * r2,
          y2: CENTER + Math.sin(rad) * r2,
          strokeWidth: isMajor ? 3 : 1,
          visible: true,
        };
      }
      return { visible: false };
    });
  }, [CENTER, INNER_R, OUTER_R]);

  const stationInfo = React.useMemo(() => {
    if (stations.length === 0) return { display: "No stations", quality: null };

    const station = stations[currentStationIndex];
    if (!station) return { display: "Unknown Station", quality: null };

    const qualityInfo = getStationQualityInfo(station);
    return {
      display: station.name,
      quality: qualityInfo.quality,
      score: qualityInfo.score,
      codec: station.codec,
      bitrate: station.bitrate,
      country: station.country,
    };
  }, [stations, currentStationIndex]);

  const handleGaugeClick = useCallback(async () => {
    if (stations.length > 0) {
      const currentStationData = stations[currentStationIndex];

      if (showPlayer && currentStation && isPlaying) {
        stop();
        setShowPlayer(false);
      } else {
        try {
          play(currentStationData);
          setShowPlayer(true);
        } catch (error) {
          if (stations.length > 1) {
            setTimeout(() => {
              nextStation();
              const nextStationData =
                stations[(currentStationIndex + 1) % stations.length];
              play(nextStationData);
              setShowPlayer(true);
            }, 500);
          }
        }
      }
    }
  }, [
    stations,
    currentStationIndex,
    showPlayer,
    currentStation,
    isPlaying,
    stop,
    setShowPlayer,
    play,
    nextStation,
  ]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.code) {
        case "ArrowLeft":
          event.preventDefault();
          previousStation();
          break;
        case "ArrowRight":
          event.preventDefault();
          nextStation();
          break;
        case "Enter":
        case "Space":
          event.preventDefault();
          handleGaugeClick();
          break;
      }
    },
    [previousStation, nextStation, handleGaugeClick]
  );

  if (isLoadingStations || stations.length === 0 || (isInitializing && stations.length === 0)) {
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
        aria-label={`Radio gauge. Current station: ${stationInfo.display
          }. Quality: ${stationInfo.quality || "unknown"
          }. Use left/right arrows to change station, Enter or Space to toggle play.`}
        title={`${stationInfo.display}${stationInfo.quality ? ` (${stationInfo.quality} quality)` : ""
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
            ) : null
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
                title={`${stationInfo.display}${stationInfo.country ? ` - ${stationInfo.country}` : ""
                  }`}
                style={{
                  textShadow: "0 0 6px rgba(255, 145, 77, 0.4)",
                }}
              >
                <span className="scrolling-text inline-block whitespace-nowrap">
                  {(() => {
                    const s = stationInfo.display || "";
                    const chunk = 20;
                    return s.length > chunk
                      ? s.replace(new RegExp(`(.{${chunk}})`, "g"), "$1\u200B")
                      : s;
                  })()}
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
