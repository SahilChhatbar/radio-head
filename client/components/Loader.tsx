import React from "react";
import { Theme, Flex, Box, Heading } from "@radix-ui/themes";
import Image from "next/image";

interface LoaderProps {
  variant?: "default" | "spinner";
  loadingText?: string;
}

const LoadingScreen: React.FC<LoaderProps> = ({
  variant = "default",
  loadingText = "Loading",
}) => {
  if (variant === "spinner") {
    return (
      <Theme>
        <Box>
          <Flex align="center" justify="center" minHeight="50vh">
            <Flex direction="column" align="center" justify="center" gap="4">
              <div className="relative w-62 h-62">
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#ff914d] border-r-[#ff914d] animate-spin" />
                <div className="absolute inset-4 flex items-center justify-center">
                  <Image
                    src="/base.svg"
                    width={120}
                    height={120}
                    alt="RadioVerse"
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
        <Flex align="center" justify="center" minHeight="100vh">
          <Flex direction="column" align="center" justify="center" gap="4">
            <Image
              src="/base.svg"
              width={200}
              height={200}
              alt="RadioVerse"
              className="animate-bounce"
            />
            <Heading
              size={{ initial: "6", sm: "8" }}
              className="text-foreground"
            >
              {loadingText}
              <span className="loading-dots" />
            </Heading>
          </Flex>
        </Flex>
      </Box>
    </Theme>
  );
};

export default LoadingScreen;
