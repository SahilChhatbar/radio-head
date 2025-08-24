"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button, Flex } from "@radix-ui/themes";
import { SkipBack, SkipForward, Pause } from "lucide-react";
import {MOCK_STATIONS} from "@/lib/MockStations";

interface StationGaugeProps {
  stations?: string[];
  initialStationIndex?: number;
}

interface Tick {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  strokeWidth?: number;
  visible: boolean;
}

export default function StationGauge({
  stations = MOCK_STATIONS,
  initialStationIndex = 0,
}: StationGaugeProps) {
  const VIEWBOX_SIZE = 800;
  const CENTER = VIEWBOX_SIZE / 2;
  const INNER_R = 300;
  const OUTER_R = 350;
  const [stationIndex, setStationIndex] = useState(initialStationIndex);
  const gaugeRef = useRef<SVGGElement>(null);
  const indexToAngle = (index: number) => 180 + (index / 135) * 270;
  const prevAngleRef = useRef<number>(indexToAngle(stationIndex));

  useEffect(() => {
    if (!gaugeRef.current) return;

    const prevAngle = prevAngleRef.current;
    const newAngle = indexToAngle(stationIndex);
    let delta = newAngle - prevAngle;

    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const finalAngle = prevAngle + delta;
    gaugeRef.current.style.transform = `rotate(${finalAngle}deg)`;
    gaugeRef.current.style.transformOrigin = `${CENTER}px ${CENTER}px`;
    gaugeRef.current.style.transition = "transform 0.3s ease-in-out";
    prevAngleRef.current = finalAngle;
  }, [stationIndex]);

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

  const nextStation = () => {
    setStationIndex((prev) => (prev + 1 >= stations.length ? 0 : prev + 1));
  };

  const previousStation = () => {
    setStationIndex((prev) => (prev - 1 < 0 ? stations.length - 1 : prev - 1));
  };

  return (
    <div className="flex flex-col items-center gap-4 p-8 bg-transparent">
      <div className="w-112 aspect-square">
        <svg
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          className="w-full h-full"
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
          <text
            x={CENTER + 180}
            y={CENTER + 180}
            fill="#ff914d"
            fontSize="38"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="monospace"
          >
            {stations[stationIndex]}
          </text>
        </svg>
      </div>
      {/* Controls */}
      <Flex gap="4" justify="center">
        <Button
          onClick={previousStation}
          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
        >
          <SkipBack />
        </Button>
        <Button
          onClick={() => {}}
          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-500"
        >
          <Pause />
        </Button>
        <Button
          onClick={nextStation}
          className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-600"
        >
          <SkipForward />
        </Button>
      </Flex>
    </div>
  );
}
