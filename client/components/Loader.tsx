import React from "react";
import { Theme, Flex, Box, Heading } from "@radix-ui/themes";
import logo from "@/assets/base.png";
import Image from "next/image";

const LoadingScreen: React.FC = () => {
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
