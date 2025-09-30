import React from "react";
import { Theme, Flex, Box, Heading } from "@radix-ui/themes";
import logo from "@/assets/base.png";
import Image from "next/image";

interface LoaderProps {
  variant?: "default" | "spinner";
}

const LoadingScreen: React.FC<LoaderProps> = ({ variant = "default" }) => {
  if (variant === "spinner") {
    return (
      <Theme>
        <Box>
          <Flex align="center" justify="center" minHeight={"50vh"}>
            <Flex direction="column" align="center" justify="center" gap="4">
              {/* Large spinning container with logo */}
              <div className="relative w-62 h-62">
                {/* Spinning border */}
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#ff914d] border-r-[#ff914d] animate-spin"></div>
                {/* Logo in center */}
                <div className="absolute inset-4 flex items-center justify-center">
                  <Image
                    src={logo}
                    width={120}
                    height={120}
                    alt="radioverse"
                    className="object-contain animate-bounce"
                  />
                </div>
              </div>
            </Flex>
          </Flex>
        </Box>
      </Theme>
    );
  }

  return (
    <Theme>
      <Box>
        <Flex align="center" justify="center" minHeight={"100vh"}>
          <Flex direction="column" align="center" justify="center" gap="4">
            <Image src={logo} width={200} alt="radiohead" />
            <Heading
              size={{ initial: "6", sm: "8" }}
              className="text-foreground"
            >
              Tuning in
              <span className="loading-dots"></span>
            </Heading>
          </Flex>
        </Flex>
      </Box>
    </Theme>
  );
};

export default LoadingScreen;
