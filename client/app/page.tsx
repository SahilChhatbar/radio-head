import React from "react";
import {
  Button,
  Container,
  Flex,
  Heading,
  Text,
  Section,
  Box,
} from "@radix-ui/themes";
import Header from "@/components/Header";
import StationSelector from "@/components/StationSelector";
import Link from "next/link";

// --- Helper function to create a delay ---
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface FooterLink {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface HeroContent {
  title: string;
  subtitle: string;
}

interface FooterContent {
  links: FooterLink[];
  credits: {
    text: string;
    authorName: string;
    authorUrl: string;
  };
}

const DEFAULT_HERO_CONTENT: HeroContent = {
  title: "Welcome to RadioHead",
  subtitle:
    "Your ultimate radio streaming experience. Discover, listen, and enjoy music from around the world with crystal-clear quality.",
};

const DEFAULT_FOOTER_CONTENT: FooterContent = {
  links: [
    { label: "About", href: "/about" },
    { label: "Features", href: "/features" },
    { label: "Contact", href: "/contact" },
  ],
  credits: {
    text: "Made with ❤️ by",
    authorName: "Sahil",
    authorUrl: "https://sahil-chhatbar.vercel.app/",
  },
};

// --- The component is an async function ---
export default async function Home() {
  // This await call will pause the rendering on the server
  await sleep(2000); 

  const heroContent = DEFAULT_HERO_CONTENT;
  const footerContent = DEFAULT_FOOTER_CONTENT;

  return (
    <div>
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
                <Flex
                  gap="4"
                  align="center"
                  direction={{ initial: "column", sm: "row" }}
                  className="mt-6"
                >
                  <Button size="4">Browse Stations</Button>
                  <Button size="4">Start Listening</Button>
                </Flex>
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
