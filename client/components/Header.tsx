"use client";

import React from "react";
import { Button, Flex, Container, Text } from "@radix-ui/themes";
import Logo from "./Logo";
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
        <Flex align="center" justify="between" className="h-16 px-6">
          <Flex align="center">
            {/* Mobile: icon-only */}
            <div className="block md:hidden">
              <Logo size="md" priority variant="icon-only" {...logoProps} />
            </div>
            {/* Desktop and up: default variant */}
            <div className="hidden md:block">
              <Logo size="md" priority {...logoProps} />
            </div>
          </Flex>
          <Flex align="center" className="justify-center">
            <Container className="bg-gray-900/60 border border-gray-700/50 rounded-lg px-4 py-2 backdrop-blur-sm scrolling-text-container">
              <Text
                size="2"
                className="text-red-400 font-mono font-medium tracking-wider [text-shadow:0_0_8px_rgb(248_113_113_/_0.8),_0_0_16px_rgb(248_113_113_/_0.4)] scrolling-text"
                title={displayText} 
              >
              {displayText}
              </Text>
            </Container>
          </Flex>
          {showSignIn && (
            <Flex align="center" gap="3">
              <Button size="2">Sign In</Button>
            </Flex>
          )}
        </Flex>
      </Container>
    </header>
  );
};

export default Header;
export type { HeaderProps, LogoProps };