import React, { useEffect, useRef, useMemo, useCallback } from "react";
import {
  useRadioStore,
  useStations,
  useCurrentStationIndex,
  useShowPlayer,
  useIsPlaying,
  useCurrentStation,
} from "@/store/useRadiostore";
import { getStationQualityInfo } from "@/services/StationFilter";

interface UseStationSelectorProps {
  viewBoxSize?: number;
  innerR?: number;
  outerR?: number;
}

export function useStationSelector({
  viewBoxSize = 800,
  innerR = 300,
  outerR = 350,
}: UseStationSelectorProps = {}) {
  const CENTER = viewBoxSize / 2;

  const gaugeRef = useRef<SVGGElement>(null);
  const prevAngleRef = useRef<number>(180);

  const stations = useStations();
  const currentStationIndex = useCurrentStationIndex();
  const showPlayer = useShowPlayer();
  const isPlaying = useIsPlaying();
  const currentStation = useCurrentStation();
  const nextStation = useRadioStore((state) => state.nextStation);
  const previousStation = useRadioStore((state) => state.previousStation);
  const play = useRadioStore((state) => state.play);
  const stop = useRadioStore((state) => state.stop);
  const setShowPlayer = useRadioStore((state) => state.setShowPlayer);
  const [isInitializing, setIsInitializing] = React.useState(false);
  const [isLoadingStations] = React.useState(false);

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

  const ticks = useMemo(() => {
    return Array.from({ length: 136 }).map((_, i) => {
      const angleDeg = 90 + i * 2;
      const rad = (angleDeg * Math.PI) / 180;
      const isMajor = i % 10 === 0;
      const r1 = innerR + (isMajor ? 0 : 20);
      const r2 = outerR;

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
  }, [CENTER, innerR, outerR]);

  const stationInfo = useMemo(() => {
    if (stations.length === 0) return { display: "No stations", quality: null, score: 0 };

    const station = stations[currentStationIndex];
    if (!station) return { display: "Unknown Station", quality: null, score: 0 };

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

  const formattedStationDisplay = useMemo(() => {
    const s = stationInfo.display || "";
    const chunk = 20;
    return s.length > chunk
      ? s.replace(new RegExp(`(.{${chunk}})`, "g"), "$1\u200B")
      : s;
  }, [stationInfo.display]);

  const stationTitleText = `${stationInfo.display}${
    stationInfo.country ? ` - ${stationInfo.country}` : ""
  }`;

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
          console.error("Error playing station:", error);
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

  return {
    gaugeRef,
    stations,
    currentStationIndex,
    showPlayer,
    isPlaying,
    currentStation,
    isInitializing,
    isLoadingStations,
    ticks,
    stationInfo,
    formattedStationDisplay,
    stationTitleText,
    handleGaugeClick,
    handleKeyDown,
    center: CENTER,
  };
}
