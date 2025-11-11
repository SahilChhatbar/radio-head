"use client";

import React, { useState, useEffect } from "react";
import { Container, Flex, Heading, Text, Section, Box } from "@radix-ui/themes";
import Header from "@/components/Header";
import StationSelector from "@/components/StationSelector";
import { useRadioStore } from "@/store/useRadiostore";
import Loader from "@/components/Loader";

const DEFAULT_HERO_CONTENT = {
  title: "Welcome to RadioVerse",
  subtitle:
    "Log in or sign up for a more personalized and curated experience!",
};

export default function Home() {
  const { showPlayer, isPlaying, currentStation, stations } = useRadioStore();
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const getStatusText = () => {
    if (showPlayer && currentStation) {
      return isPlaying ? "" : "PAUSED - Click gauge again to stop";
    }
    return "Click the radio gauge to start listening →";
  };

  const heroContent = DEFAULT_HERO_CONTENT;

  // Handle loading state with both data check and maximum timeout
  useEffect(() => {
    // Maximum timeout - show content after 3 seconds regardless
    const maxLoadingTimer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 3000);

    // Minimum loading time for smooth UX
    const minLoadingTimer = setTimeout(() => {
      // Hide loader after minimum time if stations are loaded
      if (stations.length > 0) {
        setIsInitialLoading(false);
      }
    }, 1000);

    return () => {
      clearTimeout(maxLoadingTimer);
      clearTimeout(minLoadingTimer);
    };
  }, [stations.length]);

  // Also hide loader when stations become available after minimum time
  useEffect(() => {
    if (stations.length > 0 && !isInitialLoading) {
      return;
    }

    // Small delay to ensure we've passed minimum loading time
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
              {/* Left: Hero Content */}
              <Flex direction="column" gap="6" className="flex-1 items-center">
                <Flex direction="column" gap="4">
                  <Heading size={{ initial: "8", sm: "9" }} weight="bold">
                    {heroContent.title}
                  </Heading>
                  <Text size={{ initial: "4", sm: "5" }}>
                    {heroContent.subtitle}
                  </Text>
                </Flex>
                <Text
                  size="3"
                  className="mt-4 transition-colors duration-300 text-[#ff914d]"
                >
                  {getStatusText()}
                </Text>
              </Flex>
              {/* Right: Station Selector */}
              <Box className="flex-1 flex justify-center md:justify-end w-full">
                <StationSelector />
              </Box>
            </Flex>
          </Container>
        </Section>
      </Flex>
    </div>
  );
}
