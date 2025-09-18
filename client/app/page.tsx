"use client";

import React from "react";
import { Container, Flex, Heading, Text, Section, Box } from "@radix-ui/themes";
import Header from "@/components/Header";
import StationSelector from "@/components/StationSelector";
import { useRadioStore } from "@/store/useRadiostore";

const DEFAULT_HERO_CONTENT = {
  title: "Welcome to RadioHead",
  subtitle:
    "Your ultimate radio streaming experience. Discover, listen, and enjoy music from around the world with crystal-clear quality.",
};

export default function Home() {
  const { showPlayer, isPlaying, currentStation } = useRadioStore();

  const getStatusText = () => {
    if (showPlayer && currentStation) {
      return isPlaying ? "" : "PAUSED - Click gauge again to stop";
    }
    return "Click the radio gauge to start listening →";
  };

  const heroContent = DEFAULT_HERO_CONTENT;

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
