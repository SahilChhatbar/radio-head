import Image from "next/image";
import { Flex, Heading } from "@radix-ui/themes";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "default" | "vertical" | "icon-only";
  className?: string;
  priority?: boolean;
}

const Logo = ({
  size = "md",
  showText = true,
  variant = "default",
  priority = false,
}: LogoProps) => {
  const imageSizes = {
    sm: { width: 34, height: 34 },
    md: { width: 62, height: 62 },
    lg: { width: 68, height: 68 },
    xl: { width: 84, height: 84 },
  };

  const textSizes = {
    sm: "2" as const,
    md: "3" as const,
    lg: "4" as const,
    xl: "6" as const,
  };

  const imageSize = imageSizes[size];
  const textSize = textSizes[size];

  if (variant === "icon-only") {
    return (
      <Flex>
        <Image
          src="/base.svg" // ← Changed from import
          alt="Logo"
          width={imageSize.width}
          height={imageSize.height}
          priority={priority}
        />
      </Flex>
    );
  }

  if (variant === "vertical") {
    return (
      <Flex gap="1" direction="column">
        <Image
          src="/base.svg" // ← Changed from import
          alt="Logo"
          width={imageSize.width}
          height={imageSize.height}
          priority={priority}
        />
        {showText && (
          <Flex direction="column" align="center">
            <Heading size={textSize} weight="bold">
              Radio
            </Heading>
            <Heading size={textSize} weight="bold">
              Verse
            </Heading>
          </Flex>
        )}
      </Flex>
    );
  }

  return (
    <Flex direction="row" align="center" gap="1">
      <Image
        src="/base.svg"
        alt="Logo"
        width={imageSize.width}
        height={imageSize.height}
        priority={priority}
      />
      {showText && (
        <Flex direction="column" align="center" gap="0">
          <Flex direction="column" align="center" gap="0">
            <Heading size={textSize} weight="bold">
              Radio
            </Heading>
            <div style={{ marginTop: "-4px" }}>
              <Heading size={textSize} weight="bold">
                Verse
              </Heading>
            </div>
          </Flex>
        </Flex>
      )}
    </Flex>
  );
};

export default Logo;
