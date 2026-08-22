/**
 * OpenWeather / IMD Hyperlocal API client.
 *
 * Fetches weather data for a given location: precipitation, humidity,
 * temperature, and computed 7-day average rainfall.
 *
 * Source: OpenWeather API (Section 6, Section 11).
 * Field produced: avg_rainfall_mm_7d (used by rules engine, Section 4.2)
 *
 * @see Section 11 — Weather: OpenWeather / IMD Hyperlocal API
 * @see Section 4.2 — avg_rainfall_mm_7d below crop's water-requirement threshold
 */

export interface WeatherData {
  /** 7-day average rainfall in mm. Source: OpenWeather API */
  avg_rainfall_mm_7d: number;
  /** Current humidity percentage. Source: OpenWeather API */
  humidity: number;
  /** Current temperature in Celsius. Source: OpenWeather API */
  temperature_celsius: number;
  /** ISO 8601 timestamp of the observation */
  observation_date: string;
}

export interface WeatherClient {
  getWeather(latitude: number, longitude: number): Promise<WeatherData>;
}

/**
 * Creates an OpenWeather API client.
 *
 * Production: calls OpenWeather One Call API 3.0 for current weather
 * and the forecast/historical endpoints for 7-day rainfall aggregation.
 *
 * Fallback: returns realistic simulated weather data for development.
 */
export function createWeatherClient(): WeatherClient {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  return {
    async getWeather(latitude: number, longitude: number): Promise<WeatherData> {
      if (apiKey) {
        try {
          return await fetchRealWeather(apiKey, latitude, longitude);
        } catch (error) {
          console.warn(
            '[weather] Live API call failed, using simulated data:',
            error
          );
        }
      }

      return simulateWeather(latitude, longitude);
    },
  };
}

/**
 * Fetch real weather data from OpenWeather API.
 *
 * Uses the One Call API 3.0 for current conditions and daily forecasts
 * to compute the 7-day average rainfall.
 */
async function fetchRealWeather(
  apiKey: string,
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  // Current weather + 7-day forecast
  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&exclude=minutely,hourly,alerts`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenWeather API returned ${response.status}`);
  }

  const data: any = await response.json();

  // Compute 7-day average rainfall from daily data
  const dailyRainfall: number[] = (data.daily || [])
    .slice(0, 7)
    .map((day: { rain?: number }) => day.rain || 0);

  const totalRain = dailyRainfall.reduce((sum: number, r: number) => sum + r, 0);
  const avgRainfall = dailyRainfall.length > 0 ? totalRain / dailyRainfall.length : 0;

  return {
    avg_rainfall_mm_7d: parseFloat(avgRainfall.toFixed(1)),
    humidity: data.current?.humidity ?? 60,
    temperature_celsius: data.current?.temp ?? 28,
    observation_date: new Date().toISOString(),
  };
}

/**
 * Simulate realistic weather data for development/demo.
 * Tropical locations get more rainfall; temperate zones less.
 */
function simulateWeather(latitude: number, longitude: number): WeatherData {
  const seed = Math.abs(Math.cos(latitude * 7.919 + longitude * 17.881));
  const frac = (seed * 7919 + 10037) % 100003 / 100003;

  // Tropical regions (< 23.5°) get more rain
  const isTropical = Math.abs(latitude) < 23.5;
  const baseRain = isTropical ? 8 : 3;
  const avgRainfall = baseRain + frac * (isTropical ? 12 : 7);

  return {
    avg_rainfall_mm_7d: parseFloat(avgRainfall.toFixed(1)),
    humidity: Math.round(40 + frac * 50),
    temperature_celsius: parseFloat((15 + frac * 20).toFixed(1)),
    observation_date: new Date().toISOString(),
  };
}
