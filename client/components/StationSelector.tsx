"use client";

import React, { useEffect, useRef } from "react";
import { Button, Flex, Text, Box } from "@radix-ui/themes";
import { SkipBack, SkipForward, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { usePopularStations } from "@/hooks/useRadio";
import { useRadioStore } from "@/store/useRadiostore";
import ReactHowler from 'react-howler';
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
    currentStation,
    isPlaying,
    volume,
    isMuted,
    isLoading: playerLoading,
    error: playerError,
    setStations,
    setCurrentStationIndex,
    nextStation,
    previousStation,
    play,
    stop,
    togglePlayPause,
    toggleMute,
    setVolume,
    setError,
    setIsLoading,
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

  const handleNextStation = () => {
    nextStation();
    if (isPlaying && stations[currentStationIndex + 1] || stations[0]) {
      const nextStationData = stations[currentStationIndex + 1] || stations[0];
      play(nextStationData);
    }
  };

  const handlePreviousStation = () => {
    previousStation();
    const prevIndex = currentStationIndex === 0 ? stations.length - 1 : currentStationIndex - 1;
    if (isPlaying && stations[prevIndex]) {
      play(stations[prevIndex]);
    }
  };

  const handlePlayPause = () => {
    if (currentStation) {
      togglePlayPause();
    } else if (stations.length > 0) {
      play(stations[currentStationIndex]);
    }
  };

  // current station display info
  const getCurrentStationDisplay = () => {
    if (error) return "Error loading";
    if (stations.length === 0) return "No stations";
    
    const station = stations[currentStationIndex];
    return station?.name || "Unknown Station";
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
      {/* Howler Player */}
      {currentStation && (
        <ReactHowler
          src={currentStation.url_resolved || currentStation.url}
          playing={isPlaying}
          volume={isMuted ? 0 : volume}
          onLoad={() => setIsLoading(false)}
          onLoadError={(id, error) => {
            console.error('Howler load error:', error);
            setError('Failed to load station');
            setIsLoading(false);
          }}
          onPlayError={(id, error) => {
            console.error('Howler play error:', error);
            setError('Failed to play station');
            setIsLoading(false);
          }}
          onPlay={() => setError(null)}
          format={['mp3', 'aac', 'ogg', 'wav']}
          html5={true}
        />
      )}

      {/* Gauge Display */}
      <div className="w-82 aspect-square" style={{ position: "relative" }}>
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
                  whiteSpace: "normal", // allow wrapping to next line
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
                  const chunk = 18; // insert soft break every `chunk` chars so long names can break earlier
                  return s.length > chunk ? s.replace(new RegExp(`(.{${chunk}})`, 'g'), '$1​') : s;
                })()}
              </span>
            </div>
          </foreignObject>
        </svg>
      </div>
      {/* Player Error Display */}
      {playerError && (
        <Text size="2" className="text-red-400 text-center max-w-80">
          {playerError}
        </Text>
      )}

      {/* Controls */}
      <Flex gap="4" justify="center" align="center" wrap="wrap">
        <Button
          onClick={handlePreviousStation}
          disabled={stations.length === 0}
          title="Previous Station"
        >
          <SkipBack size={20} />
        </Button>
        
        <Button
          onClick={handlePlayPause}
          disabled={stations.length === 0 || playerLoading}
          title={isPlaying ? "Pause" : "Play"}
        >
          {playerLoading ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause size={20} />
          ) : (
            <Play size={20} />
          )}
        </Button>
        
        <Button
          onClick={handleNextStation}
          disabled={stations.length === 0}
          title="Next Station"
        >
          <SkipForward size={20} />
        </Button>
        
        <Button
          onClick={toggleMute}
          disabled={!currentStation}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </Button>
      </Flex>

      {/* Volume Control */}
      {currentStation && (
        <Flex gap="2" align="center" className="w-full max-w-48">
          <Text size="1" className="text-[#ff914d]">Vol:</Text>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 accent-[#ff914d]"
          />
          <Text size="1" className="text-[#ff914d] min-w-8">
            {Math.round(volume * 100)}%
          </Text>
        </Flex>
      )}

      {/* Station Count */}
      <Text size="1" className="text-slate-500">
        Station {currentStationIndex + 1} of {stations.length}
      </Text>
    </div>
  );
}
