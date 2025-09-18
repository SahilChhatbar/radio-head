"use client";

import React, { useEffect, useRef } from "react";
import { Flex, Text } from "@radix-ui/themes";
import { usePopularStations } from "@/hooks/useRadio";
import { useRadioStore } from "@/store/useRadiostore";
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

export default function StationGauge({ limit = 50 }: StationGaugeProps) {
  const VIEWBOX_SIZE = 800;
  const CENTER = VIEWBOX_SIZE / 2;
  const INNER_R = 300;
  const OUTER_R = 350;

  const gaugeRef = useRef<SVGGElement>(null);
  const prevAngleRef = useRef<number>(180);

  const {
    data: fetchedStations = [],
    isLoading,
    error,
  } = usePopularStations(limit, { enableFiltering: true });

  const {
    stations,
    currentStationIndex,
    showPlayer,
    isPlaying,
    currentStation,
    setStations,
    nextStation,
    previousStation,
    play,
    stop,
    setShowPlayer,
  } = useRadioStore();

  useEffect(() => {
    if (fetchedStations.length > 0 && stations.length === 0) {
      console.log(
        `🎵 Loading ${fetchedStations.length} filtered stations into gauge`
      );
      setStations(fetchedStations);
    }
  }, [fetchedStations, stations.length, setStations]);

  const indexToAngle = (index: number) => {
    if (stations.length === 0) return 180;
    return 180 + (index / Math.max(stations.length - 1, 1)) * 270;
  };

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
  }, [currentStationIndex, stations.length]);

  const ticks: Tick[] = Array.from({ length: 136 }).map((_, i) => {
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

  const getCurrentStationInfo = () => {
    if (error) return { display: "Error loading", quality: null };
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
  };

  const handleGaugeClick = async () => {
    if (stations.length > 0) {
      const currentStationData = stations[currentStationIndex];

      if (showPlayer && currentStation && isPlaying) {
        console.log(`⏹️ Stopping ${currentStation.name}`);
        stop();
        setShowPlayer(false);
      } else {
        try {
          console.log(`▶️ Starting ${currentStationData?.name}`);
          play(currentStationData);
        } catch (error) {
          console.error("Failed to start playback:", error);
          if (stations.length > 1) {
            setTimeout(() => {
              nextStation();
              play(stations[(currentStationIndex + 1) % stations.length]);
            }, 500);
          }
        }
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.code) {
      case "ArrowLeft":
        event.preventDefault();
        console.log("⬅️ Previous station via keyboard");
        previousStation();
        break;
      case "ArrowRight":
        event.preventDefault();
        console.log("➡️ Next station via keyboard");
        nextStation();
        break;
      case "Enter":
      case "Space":
        event.preventDefault();
        handleGaugeClick();
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <Loader variant="spinner" />
        <Text size="2" className="text-slate-500">
          Loading high-quality stations...
        </Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <div className="w-112 aspect-square flex items-center justify-center">
          <Text size="4" className="text-red-400">
            Error loading stations
          </Text>
        </div>
        <Text size="2" className="text-red-400/70">
          Failed to load radio stations. Please try again.
        </Text>
      </div>
    );
  }

  const stationInfo = getCurrentStationInfo();

  return (
    <div className="flex flex-col items-center gap-4 p-8 bg-transparent">
      <div
        className="w-82 aspect-square cursor-pointer transition-all duration-300 hover:scale-105 focus:outline-none rounded-full"
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
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_R}
            fill="none"
            stroke="#ff914d"
            strokeWidth={3}
            strokeDasharray="10 5"
            opacity={0.8}
          />
          {stationInfo.quality && (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={OUTER_R + 15}
              fill="none"
              stroke="#ff914d"
              strokeWidth={2}
              strokeDasharray={`${(stationInfo.score / 100) * 31.4159} 31.4159`}
              strokeLinecap="round"
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
              opacity={0.6}
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
                opacity={0.7}
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
            height={120}
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
                padding: "8px",
                boxSizing: "border-box",
                gap: "4px",
              }}
            >
              <span
                style={{
                  color: "#ff914d",
                  fontFamily: "var(--font-roboto), monospace",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  background: "rgba(30,30,30,0.9)",
                  borderRadius: "8px",
                  border: `1px solid $"#ff914d"40`,
                  padding: "8px 12px",
                  width: "100%",
                  overflow: "hidden",
                  textOverflow: "clip",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  display: "block",
                  lineHeight: 1.2,
                  textAlign: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
                title={`${stationInfo.display}${
                  stationInfo.country ? ` - ${stationInfo.country}` : ""
                }`}
              >
                {(() => {
                  const s = stationInfo.display || "";
                  const chunk = 20;
                  return s.length > chunk
                    ? s.replace(new RegExp(`(.{${chunk}})`, "g"), "$1​")
                    : s;
                })()}
              </span>
              {(stationInfo.codec ||
                stationInfo.bitrate ||
                stationInfo.quality) && (
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    fontSize: "0.7rem",
                    color: "#94a3b8",
                    fontFamily: "var(--font-roboto), monospace",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {stationInfo.quality && (
                    <span
                      style={{
                        backgroundColor: `$"#ff914d"20`,
                        color: "#ff914d",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "0.65rem",
                        fontWeight: 500,
                        border: `1px solid $"#ff914d"40`,
                      }}
                    >
                      {stationInfo.quality.toUpperCase()}
                    </span>
                  )}
                  {stationInfo.codec && (
                    <span>{stationInfo.codec.toUpperCase()}</span>
                  )}
                  {stationInfo.bitrate && stationInfo.bitrate > 0 && (
                    <span>{stationInfo.bitrate}k</span>
                  )}
                </div>
              )}
            </div>
          </foreignObject>
        </svg>
      </div>
      <Flex direction="column" align="center" gap="2">
        <Text size="2" className="text-slate-500">
          {stations.length} high-quality stations available
        </Text>
        {process.env.NODE_ENV === "development" && stations.length > 0 && (
          <Text size="1" className="text-slate-600">
            Station {currentStationIndex + 1}/{stations.length}
            {stationInfo.score &&
              ` • Quality Score: ${Math.round(stationInfo.score)}/100`}
          </Text>
        )}
        {showPlayer && currentStation && (
          <Flex align="center" gap="2">
            <div
              className={`w-2 h-2 rounded-full ${
                isPlaying ? "bg-green-400 animate-pulse" : "bg-yellow-400"
              }`}
              title={isPlaying ? "Playing" : "Paused"}
            />
            <Text size="1" className="text-slate-400">
              {isPlaying ? "Now Playing" : "Paused"}
            </Text>
          </Flex>
        )}
      </Flex>
    </div>
  );
}
