import { useState, useEffect, useCallback } from "react";

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  city: string;
  country: string;
  humidity: number;
  windSpeed: number;
}

export type WeatherType = "rainy" | "sunny" | "mist" | "snow" | "night";

export function useWeather() {
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
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
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
    if (typeof window === "undefined") return;

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

  const isNightTime = useCallback(() => {
    const hour = new Date().getHours();
    return hour >= 20 || hour < 6;
  }, []);

  const weatherInfo = weatherData ? getWeatherType(weatherData.weatherCode) : null;
  const weatherType: WeatherType | null = weatherInfo
    ? isNightTime()
      ? "night"
      : weatherInfo.type
    : null;
  const weatherDescription = weatherInfo ? weatherInfo.description : "";

  return {
    weatherData,
    loading,
    error,
    hasLocationPermission,
    requestLocation,
    weatherType,
    weatherDescription,
    isNightTime: isNightTime(),
  };
}
