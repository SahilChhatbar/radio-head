"use client";

import React, { memo } from "react";
import { Button, Flex, Container } from "@radix-ui/themes";
import Logo from "./Logo";
import LocationSelector from "./LocationSelector";

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

const Header: React.FC<HeaderProps> = memo(
  ({ className = "", showSignIn = true, logoProps = {} }) => {
    return (
      <header className={`p-3 ${className}`}>
        <Container size="4">
          <Flex align="center" justify="between" className="h-16 px-6">
            <Flex align="center">
              <div className="block md:hidden">
                <Logo size="md" priority variant="icon-only" {...logoProps} />
              </div>
              <div className="hidden md:block">
                <Logo size="md" priority {...logoProps} />
              </div>
            </Flex>
            <Flex
              align="center"
              className="hidden sm:flex flex-1 justify-center mx-4 max-w-md"
            >
              <LocationSelector />
            </Flex>
            <Flex align="center" gap="3">
              {showSignIn && <Button size="2">Sign In</Button>}
            </Flex>
          </Flex>
        </Container>
      </header>
    );
  }
);

Header.displayName = "Header";

export default Header;
export type { HeaderProps, LogoProps };
