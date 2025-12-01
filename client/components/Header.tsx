"use client";

import React from "react";
import { Button, Flex, Container, Text } from "@radix-ui/themes";
import Logo from "./Logo";
import LocationSelector from "./LocationSelector";
import { useRadioStore } from "@/store/useRadiostore";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  priority?: boolean;
  variant?: "default" | "icon-only" | "vertical";
  className?: string;
}

interface HeaderProps {
  className?: string;
  showSignIn?: boolean;
  logoProps?: Partial<LogoProps>;
  radioStation?: {
    frequency: string;
    tagline: string;
  };
}

const Header: React.FC<HeaderProps> = ({
  className = "",
  showSignIn = true,
  logoProps = {},
}) => {
  const currentStation = useRadioStore((state) => state.currentStation);

  const displayText = currentStation
    ? currentStation.name
    : "no station playing";

  return (
    <header className={`p-3 ${className}`}>
      <Container size="4">
        {/* Single Row Layout */}
        <Flex align="center" justify="between" className="h-16 px-6">
          {/* Left: Logo */}
          <Flex align="center">
            {/* Mobile: icon-only */}
            <div className="block md:hidden">
              <Logo size="md" priority variant="icon-only" {...logoProps} />
            </div>
            {/* Desktop: default variant */}
            <div className="hidden md:block">
              <Logo size="md" priority {...logoProps} />
            </div>
          </Flex>

          {/* Center: Location Selectors (Hidden on very small screens) */}
          <Flex align="center" className="hidden sm:flex flex-1 justify-center mx-4 max-w-md">
            <LocationSelector />
          </Flex>

          {/* Right: Now Playing & Sign In */}
          <Flex align="center" gap="3">
            {/* Now Playing - Hidden on mobile */}
            <Container className="hidden lg:block bg-gray-900/60 border border-gray-700/50 rounded-lg px-3 py-1.5 backdrop-blur-sm">
              <Text
                size="1"
                className="text-red-400 font-mono font-medium tracking-wider [text-shadow:0_0_8px_rgb(248_113_113_/_0.8)] truncate max-w-[200px]"
                title={displayText}
              >
                {displayText}
              </Text>
            </Container>
            {showSignIn && (
              <Button size="2">Sign In</Button>
            )}
          </Flex>
        </Flex>

        {/* Mobile: Show location selectors below on small screens */}

      </Container>
    </header>
  );
};

export default Header;
export type { HeaderProps, LogoProps };

