"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Flex, Text, Button } from "@radix-ui/themes";
import { MapPin, Loader2 } from "lucide-react";
import Lottie from "lottie-react";

import rainyAnimation from "@/animations/rainy.json";
import sunnyAnimation from "@/animations/sunny.json";
import mistAnimation from "@/animations/mist.json";
import snowAnimation from "@/animations/snow.json";
import nightAnimation from "@/animations/night.json";

interface WeatherData {
  temperature: number;
  weatherCode: number;
  city: string;
  country: string;
  humidity: number;
  windSpeed: number;
}

type WeatherType = "rainy" | "sunny" | "mist" | "snow" | "night";

const WeatherCard: React.FC = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  const getWeatherType = useCallback(
    (code: number): { type: WeatherType; description: string } => {
      if (code === 0) return { type: "sunny", description: "Clear sky" };
      if (code <= 3) return { type: "mist", description: "Partly cloudy" };
      if (code >= 45 && code <= 48)
        return { type: "mist", description: "Foggy" };
      if (code >= 51 && code <= 67)
        return { type: "rainy", description: "Rainy" };
      if (code >= 71 && code <= 77)
        return { type: "snow", description: "Snowy" };
      if (code >= 80 && code <= 99)
        return { type: "rainy", description: "Rain showers" };
      return { type: "mist", description: "Cloudy" };
    },
    []
  );

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

  const fetchWeatherData = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        setLoading(true);
        setError(null);

        const weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto`
        );
        if (!weatherResponse.ok)
          throw new Error("Failed to fetch weather data");

        const weatherJson = await weatherResponse.json();

        const locationResponse = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        );
        if (!locationResponse.ok)
          throw new Error("Failed to fetch location data");

        const locationJson = await locationResponse.json();

        setWeatherData({
          temperature: Math.round(weatherJson.current.temperature_2m),
          weatherCode: weatherJson.current.weather_code,
          city: locationJson.city || locationJson.locality || "Unknown",
          country: locationJson.countryCode || "XX",
          humidity: weatherJson.current.relative_humidity_2m,
          windSpeed: Math.round(weatherJson.current.wind_speed_10m),
        });

        setHasLocationPermission(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch weather data"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported by your browser");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) =>
        fetchWeatherData(position.coords.latitude, position.coords.longitude),
      (error) => {
        setLoading(false);
        setHasLocationPermission(false);

        if (error.code === error.PERMISSION_DENIED)
          setError(
            "Location access denied. Please enable location permissions."
          );
        else if (error.code === error.POSITION_UNAVAILABLE)
          setError("Location information unavailable.");
        else if (error.code === error.TIMEOUT)
          setError("Location request timed out.");
        else setError("An unknown error occurred.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, [fetchWeatherData]);

  useEffect(() => {
    const checkPermission = async () => {
      if (!("permissions" in navigator)) {
        setLoading(false);
        return;
      }

      try {
        const result = await navigator.permissions.query({
          name: "geolocation" as PermissionName,
        });

        if (result.state === "granted") requestLocation();
        else setLoading(false);
      } catch {
        setLoading(false);
      }
    };

    checkPermission();
  }, [requestLocation]);

  const isNightTime = () => {
    const hour = new Date().getHours();
    return hour >= 20 || hour < 6;
  };

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

  const weatherInfo = getWeatherType(weatherData.weatherCode);
  const animation = getWeatherAnimation(
    isNightTime() ? "night" : weatherInfo.type
  );

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
          {isNightTime()
            ? `${weatherInfo.description}`
            : weatherInfo.description}
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
