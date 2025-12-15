"use client";

import React, { useState, useEffect, memo, useMemo } from "react";
import { Container, Flex, Heading, Text, Section, Box } from "@radix-ui/themes";
import Header from "@/components/Header";
import StationSelector from "@/components/StationSelector";
import {
  useShowPlayer,
  useIsPlaying,
  useCurrentStation,
  useStations,
} from "@/store/useRadiostore";
import Loader from "@/components/Loader";

const DEFAULT_HERO_CONTENT = {
  title: "Welcome to RadioVerse",
  subtitle: "Log in or sign up for a more personalized and curated experience!",
};

const StatusText = memo(
  ({
    showPlayer,
    currentStation,
    isPlaying,
  }: {
    showPlayer: boolean;
    currentStation: any;
    isPlaying: boolean;
  }) => {
    const text = useMemo(() => {
      if (showPlayer && currentStation) {
        return isPlaying ? "" : "PAUSED - Click gauge again to stop";
      }
      return "Select a region and station to start listening →";
    }, [showPlayer, currentStation, isPlaying]);

    return (
      <Text
        size="3"
        className="mt-4 transition-colors duration-300 text-[#ff914d]"
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
              gap="10"
              className="text-center max-w-6xl mx-auto w-full"
            >
              <Flex direction="column" gap="6" className="flex-1 items-center">
                <Flex direction="column" gap="4">
                  <Heading size={{ initial: "8", sm: "9" }} weight="bold">
                    {heroContent.title}
                  </Heading>
                  <Text size={{ initial: "4", sm: "5" }}>
                    {heroContent.subtitle}
                  </Text>
                </Flex>
                <StatusText
                  showPlayer={showPlayer}
                  currentStation={currentStation}
                  isPlaying={isPlaying}
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
