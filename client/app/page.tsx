"use client";

import React, { useState, useEffect, memo, useMemo } from "react";
import { Container, Flex, Text, Section, Box } from "@radix-ui/themes";
import Header from "@/components/Header";
import StationSelector from "@/components/StationSelector";
import {
  useShowPlayer,
  useIsPlaying,
  useCurrentStation,
  useIsLoading,
  useStations,
} from "@/store/useRadiostore";
import Loader from "@/components/Loader";
import { RadioStation } from "@/types";
import WeatherCard from "@/components/WeatherCard";

const StatusText = memo(
  ({
    showPlayer,
    currentStation,
    isPlaying,
    isLoading,
  }: {
    showPlayer: boolean;
    currentStation: RadioStation | null;
    isPlaying: boolean;
    isLoading: boolean;
  }) => {
    const text = useMemo(() => {
      if (isLoading) {
        return "Loading...";
      }

      if (showPlayer && currentStation) {
        return isPlaying ? "" : "PAUSED - Click Radio Meter again to stop";
      }

      return "Click the Radio Meter to start playing →";
    }, [showPlayer, currentStation, isPlaying, isLoading]);

    return (
      <Text
        size="3"
        className="mt-4 transition-colors duration-300 text-[var(--accent)]"
        role="status"
        aria-live="polite"
      >
        {text}
      </Text>
    );
  }
);
StatusText.displayName = "StatusText";

const Home = memo(() => {
  const showPlayer = useShowPlayer();
  const isPlaying = useIsPlaying();
  const currentStation = useCurrentStation();
  const isLoading = useIsLoading();
  const stations = useStations();

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const maxLoadingTimer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 3000);

    const minLoadingTimer = setTimeout(() => {
      if (stations.length > 0) {
        setIsInitialLoading(false);
      }
    }, 1000);

    return () => {
      clearTimeout(maxLoadingTimer);
      clearTimeout(minLoadingTimer);
    };
  }, [stations.length]);

  useEffect(() => {
    if (stations.length > 0 && !isInitialLoading) {
      return;
    }

    const timer = setTimeout(() => {
      if (stations.length > 0) {
        setIsInitialLoading(false);
      }
    }, 1100);

    return () => clearTimeout(timer);
  }, [stations.length, isInitialLoading]);

  if (isInitialLoading) {
    return <Loader />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <Flex direction="column" className="flex-1">
        <Section className="flex-1 flex items-center justify-center">
          <Container size="4" className="z-10 w-full">
            <Flex
              direction={{ initial: "column-reverse", sm: "row" }}
              align="center"
              justify="center"
              gap="5"
              className="text-center w-full md:gap-9"
              style={{ maxWidth: "var(--max-width)", margin: "0 auto" }}
            >
              <Flex direction="column" gap="6" className="flex-1 items-center">
                <WeatherCard />
                <div className="sm:block hidden">
                  <StatusText
                    showPlayer={showPlayer}
                    currentStation={currentStation}
                    isPlaying={isPlaying}
                    isLoading={isLoading}
                  />
                </div>
              </Flex>
              <Box className="flex-1 flex justify-center md:justify-end w-full">
                <StationSelector />
              </Box>
              <div className="sm:hidden w-full flex justify-center">
                <StatusText
                  showPlayer={showPlayer}
                  currentStation={currentStation}
                  isPlaying={isPlaying}
                  isLoading={isLoading}
                />
              </div>
            </Flex>
          </Container>
        </Section>
      </Flex>
    </div>
  );
});

Home.displayName = "Home";

export default Home;
