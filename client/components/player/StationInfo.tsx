"use client";

import React, { memo } from "react";
import { Flex, Text } from "@radix-ui/themes";
import { Clock, FlameIcon } from "lucide-react";
import { formatVotes } from "@/utils/formatting";

interface StationInfoProps {
  name: string;
  latency: number;
  votes?: number;
}

const StationInfo = memo(({ name, latency, votes }: StationInfoProps) => {
  // Conditions & Derived UI values extracted for cleaner JSX
  const hasLatency = latency > 0;
  const isLatencySubSecond = latency < 1;
  const latencyText = isLatencySubSecond
    ? `${Math.round(latency * 1000)} ms`
    : `${latency.toFixed(1)}s`;
  const votesText = formatVotes(votes);

  return (
    <Flex
      direction="column"
      gap="1"
      className="min-w-0"
      style={{ gap: "var(--spacing-xs)" }}
      align="center"
    >
      <Text size="3" weight="medium" className="truncate">
        {name}
      </Text>
      {hasLatency && (
        <Flex
          gap="2"
          align="center"
          style={{ fontSize: "var(--font-size-xs)", gap: "var(--spacing-xs)" }}
        >
          <div className="sm:flex gap-2.5 items-center hidden w-full">
            <Clock className="text-[#FF914D]" />
            <Text size="2" className="text-[#FF914D]">
              {latencyText}
            </Text>
            <FlameIcon fill="#FF914D" className="text-[#FF914D]" />
            <Text size="2" className="text-[#FF914D]">
              {votesText}
            </Text>
          </div>
        </Flex>
      )}
    </Flex>
  );
});

StationInfo.displayName = "StationInfo";

export default StationInfo;
