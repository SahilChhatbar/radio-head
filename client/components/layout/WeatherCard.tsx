"use client";

import React, { useCallback } from "react";
import { Flex, Text, Button } from "@radix-ui/themes";
import { MapPin, Loader2 } from "lucide-react";
import Lottie from "lottie-react";

import rainyAnimation from "@/animations/rainy.json";
import sunnyAnimation from "@/animations/sunny.json";
import mistAnimation from "@/animations/mist.json";
import snowAnimation from "@/animations/snow.json";
import nightAnimation from "@/animations/night.json";
import { useWeather, WeatherType } from "@/hooks/useWeather";

const WeatherCard: React.FC = () => {
  const {
    weatherData,
    loading,
    error,
    hasLocationPermission,
    requestLocation,
    weatherType,
    weatherDescription,
  } = useWeather();

  const getWeatherAnimation = useCallback((type: WeatherType) => {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const animations: Record<WeatherType, any> = {
      rainy: rainyAnimation,
      sunny: sunnyAnimation,
      mist: mistAnimation,
      snow: snowAnimation,
      night: nightAnimation,
    };
    return animations[type];
  }, []);

  if (loading) {
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        gap="4"
        style={{ minHeight: "clamp(140px, 18vh, 200px)" }}
      >
        <Loader2
          size={40}
          className="animate-spin"
          style={{ color: "var(--accent)" }}
        />
        <Text
          size="4"
          weight="bold"
          className="font-bungee"
          style={{ color: "var(--foreground)" }}
        >
          Loading Weather...
        </Text>
      </Flex>
    );
  }

  if (!hasLocationPermission || error) {
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        gap="4"
        style={{ minHeight: "clamp(140px, 18vh, 200px)" }}
      >
        <MapPin size={56} style={{ color: "var(--accent)" }} />
        <Text
          size={{ initial: "5", sm: "6" }}
          weight="bold"
          className="font-bungee text-center"
          style={{ color: "var(--foreground)" }}
        >
          Weather Widget
        </Text>
        <Text
          size={{ initial: "2", sm: "3" }}
          className="text-center"
          style={{
            color: "var(--foreground)",
            opacity: 0.8,
            maxWidth: "400px",
          }}
        >
          {error || "Enable location access to see your local weather"}
        </Text>
        <Button
          size={{ initial: "2", sm: "3" }}
          onClick={requestLocation}
          style={{ marginTop: "var(--spacing-md)" }}
        >
          <MapPin size={18} />
          Enable Location
        </Button>
      </Flex>
    );
  }

  if (!weatherData) return null;

  const animation = getWeatherAnimation(weatherType || "sunny");

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="4"
      style={{
        minHeight: "clamp(140px, 18vh, 200px)",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div
        style={{
          width: "clamp(80px, 15vw, 140px)",
          height: "clamp(80px, 15vw, 140px)",
          marginBottom: "var(--spacing-sm)",
        }}
      >
        <Lottie
          animationData={animation}
          loop
          autoplay
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <Flex align="center" gap="2">
        <Text
          size={{ initial: "4", sm: "5", md: "6" }}
          weight="bold"
          className="font-bungee"
          style={{
            color: "var(--foreground)",
            textShadow: "0 0 6px rgba(255,145,77,.35)",
          }}
        >
          {weatherData.city}
        </Text>
        <Text
          size={{ initial: "4", sm: "5" }}
          weight="bold"
          className="font-bungee"
          style={{ color: "var(--accent)", opacity: 0.7 }}
        >
          {weatherData.country}
        </Text>
      </Flex>
      <Flex align="center" gap="3" wrap="wrap" justify="center">
        <Text
          size={{ initial: "8", sm: "9" }}
          weight="bold"
          className="font-bungee"
          style={{
            color: "var(--foreground)",
            textShadow: "0 0 10px rgba(255,145,77,.45)",
            lineHeight: 1,
          }}
        >
          {weatherData.temperature}°C
        </Text>
        <Text
          size={{ initial: "3", sm: "4" }}
          style={{ opacity: 0.6, color: "var(--accent)" }}
        >
          •
        </Text>
        <Text
          size={{ initial: "3", sm: "4" }}
          weight="medium"
          className="font-bungee"
          style={{
            color: "var(--foreground)",
            opacity: 0.9,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
          }}
        >
          {weatherDescription}
        </Text>
      </Flex>
      <Flex
        gap={{ initial: "4", sm: "6" }}
        wrap="wrap"
        justify="center"
        style={{ marginTop: "var(--spacing-md)" }}
      >
        <Flex direction="column" align="center" gap="1">
          <Text
            size="1"
            style={{
              color: "var(--foreground)",
              opacity: 0.6,
              textTransform: "uppercase",
              fontSize: "var(--font-size-xs)",
            }}
          >
            Humidity
          </Text>
          <Text
            size={{ initial: "3", sm: "4" }}
            weight="bold"
            className="font-bungee"
          >
            {weatherData.humidity}%
          </Text>
        </Flex>

        <Flex direction="column" align="center" gap="1">
          <Text
            size="1"
            style={{
              color: "var(--foreground)",
              opacity: 0.6,
              textTransform: "uppercase",
              fontSize: "var(--font-size-xs)",
            }}
          >
            Wind
          </Text>
          <Text
            size={{ initial: "3", sm: "4" }}
            weight="bold"
            className="font-bungee"
          >
            {weatherData.windSpeed} km/h
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default WeatherCard;
