"use client";

import React, { useState, useEffect, memo, useMemo } from "react";
import { Container, Flex, Heading, Text, Section, Box } from "@radix-ui/themes";
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

const DEFAULT_HERO_CONTENT = {
  title: "Welcome to RadioVerse",
  subtitle: "Log in or sign up for a more personalized and curated experience!",
};

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
        return isPlaying ? "" : "PAUSED - Click gauge again to stop";
      }

      return "Select a region and station to start listening →";
    }, [showPlayer, currentStation, isPlaying, isLoading]);

    return (
      <Text
        size="3"
        className="mt-4 transition-colors duration-300 text-[#ff914d]"
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

  const heroContent = DEFAULT_HERO_CONTENT;

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
        <Section className="flex-1 flex items-center justify-center py-20 relative">
          <Container size="4" className="relative z-10 w-full">
            <Flex
              direction={{ initial: "column", md: "row" }}
              align="center"
              justify="center"
              gap="9"
              className="text-center w-full"
              style={{ maxWidth: "var(--max-width)", margin: "0 auto" }}
            >
              <Flex direction="column" gap="6" className="flex-1 items-center">
                <Flex direction="column" gap="4">
                  <Heading size={{ initial: "8", sm: "9" }} weight="bold">
                    {heroContent.title}
                  </Heading>
                  <Text size={{ initial: "3", sm: "4" }}>
                    {heroContent.subtitle}
                  </Text>
                </Flex>
                <StatusText
                  showPlayer={showPlayer}
                  currentStation={currentStation}
                  isPlaying={isPlaying}
                  isLoading={isLoading}
                />
              </Flex>
              <Box className="flex-1 flex justify-center md:justify-end w-full">
                <StationSelector />
              </Box>
            </Flex>
          </Container>
        </Section>
      </Flex>
    </div>
  );
});

Home.displayName = "Home";

export default Home;
