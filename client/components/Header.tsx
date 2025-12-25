"use client";

import React, { memo, useState } from "react";
import {
  Button,
  Flex,
  Container,
  Avatar,
  Text,
} from "@radix-ui/themes";
import Logo from "./Logo";
import LocationSelector from "./LocationSelector";
import FavoritesDropdown from "./FavoritesDropdown";
import { useAuth } from "@/contexts/AuthContext";
import { AuthDialog } from "./AuthDialog";
import { LogOut } from "lucide-react";

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
    const { user, logout } = useAuth();
    const [showFavorites, setShowFavorites] = useState(false);

    return (
      <header className={`p-3 ${className}`}>
        <Container size="4">
          <Flex align="center" justify="between" className="h-16 px-6">
            {/* Logo Section */}
            <Flex align="center">
              <div className="block md:hidden">
                <Logo size="md" priority variant="icon-only" {...logoProps} />
              </div>
              <div className="hidden md:block">
                <Logo size="md" priority {...logoProps} />
              </div>
            </Flex>

            {/* Middle Section - Location Selector */}
            <Flex
              align="center"
              className="hidden sm:flex flex-1 justify-center mx-4 max-w-md"
            >
              <LocationSelector />
            </Flex>

            {/* Auth Section */}
            <Flex align="center" gap="3">
              {showSignIn && (
                <>
                  {user ? (
                    <div className="relative">
                      <Button
                        variant="ghost"
                        className="cursor-pointer"
                        onClick={() => setShowFavorites(!showFavorites)}
                      >
                        <Avatar
                          size="2"
                          src={user.avatar}
                          fallback={user.name?.charAt(0).toUpperCase() || "U"}
                          radius="full"
                        />
                        <Text weight="medium" className="hidden sm:block">
                          {user.name}
                        </Text>
                      </Button>

                      {/* Favorites Dropdown */}
                      <FavoritesDropdown
                        isOpen={showFavorites}
                        onClose={() => setShowFavorites(false)}
                      />

                      {/* Logout Button  */}
                      <div className="absolute top-full right-0 mt-1">
                        <Button
                          variant="ghost"
                          size="1"
                          onClick={logout}
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        >
                          <LogOut size={14} />
                          <Text size="1">Sign Out</Text>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <AuthDialog>
                      <Button size="2">Sign In</Button>
                    </AuthDialog>
                  )}
                </>
              )}
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
