"use client";

import React, { memo } from "react";
import {
  Button,
  Flex,
  Container,
  Avatar,
  DropdownMenu,
  Text,
} from "@radix-ui/themes";
import Logo from "./Logo";
import LocationSelector from "./LocationSelector";
import { useAuth } from "@/contexts/AuthContext";
import { AuthDialog } from "./AuthDialog";
import { LogOut, User } from "lucide-react";

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
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger>
                        <Button variant="ghost" className="cursor-pointer">
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
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content>
                        <DropdownMenu.Label>My Account</DropdownMenu.Label>
                        <DropdownMenu.Item color="gray">
                          <User size={14} className="mr-2" /> Profile
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item color="red" onClick={logout}>
                          <LogOut size={14} className="mr-2" /> Sign Out
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
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
