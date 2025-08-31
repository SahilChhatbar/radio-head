"use client";

import React, { useEffect, useRef } from "react";
import { Flex, Text } from "@radix-ui/themes";
import { usePopularStations } from "@/hooks/useRadio";
import { useRadioStore } from "@/store/useRadiostore";
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
  const { data: fetchedStations = [], isLoading, error } = usePopularStations(limit);

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

  // current station display info
  const getCurrentStationDisplay = () => {
    if (error) return "Error loading";
    if (stations.length === 0) return "No stations";
    
    const station = stations[currentStationIndex];
    return station?.name || "Unknown Station";
  };

  // Handle gauge click to toggle play/stop
  const handleGaugeClick = () => {
    if (stations.length > 0) {
      if (showPlayer && currentStation && isPlaying) {
        // If currently playing, stop and hide player
        stop();
        setShowPlayer(false);
      } else {
        // Start playing
        play(stations[currentStationIndex]);
      }
    }
  };

  // Handle station navigation with left/right keys when gauge is focused
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.code) {
      case 'ArrowLeft':
        event.preventDefault();
        previousStation();
        break;
      case 'ArrowRight':
        event.preventDefault();
        nextStation();
        break;
      case 'Enter':
      case 'Space':
        event.preventDefault();
        handleGaugeClick();
        break;
    }
  };

  // Show loader component while stations are loading
  if (isLoading) {
    return <Loader variant="spinner" />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <div className="w-112 aspect-square flex items-center justify-center">
          <Text size="4" className="text-red-400">Error loading stations</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-8 bg-transparent">
      {/* Gauge Display */}
      <div 
        className="w-82 aspect-square cursor-pointer transition-transform hover:scale-105 focus:outline-none rounded-full" 
        style={{ position: "relative" }}
        onClick={handleGaugeClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Radio gauge. Current station: ${getCurrentStationDisplay()}. Use left/right arrows to change station, Enter or Space to toggle play.`}
        title="Click to toggle play • Use ←→ keys to change station • Enter/Space to toggle"
      >
        <svg
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          className="w-full h-full"
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
          />
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
            />
          </g>
          {/* Station Info */}
          <foreignObject
            x={CENTER + 30}
            y={CENTER + 100}
            width={Math.min(220, VIEWBOX_SIZE * 0.32)}
            height={88}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                pointerEvents: "auto",
                padding: "6px",
                boxSizing: "border-box",
              }}
            >
              <span
                style={{
                  color: "#ff914d",
                  fontFamily: "monospace",
                  fontWeight: 500,
                  fontSize: "0.95rem",
                  background: "rgba(30,30,30,0.85)",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  width: "100%",
                  overflow: "hidden",
                  textOverflow: "clip",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  display: "block",
                  lineHeight: 1.1,
                  textAlign: "center",
                }}
                title={getCurrentStationDisplay()}
              >
                {(() => {
                  const s = getCurrentStationDisplay() || "";
                  const chunk = 18;
                  return s.length > chunk ? s.replace(new RegExp(`(.{${chunk}})`, 'g'), '$1​') : s;
                })()}
              </span>
            </div>
          </foreignObject>
        </svg>
      </div>

      {/* Station Count & Instructions */}
      <Flex direction="column" align="center" gap="2">
        <Text size="2" className="text-slate-500">
          {stations.length} stations availabe
        </Text>
      </Flex>
    </div>
  );
}