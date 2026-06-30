const API_URL = 'http://localhost:8000';

export interface WeatherZoneData {
  id: string;
  temperature: number;
  wind_speed: number;
  wind_direction: number;
  humidity: number;
  risk_percentage: number;
  status: 'safe' | 'warn' | 'fire';
}

export const fetchZonesWeather = async (): Promise<WeatherZoneData[]> => {
  try {
    const response = await fetch(`${API_URL}/weather/zones`);
    if (!response.ok) {
      throw new Error(`Erreur API Météo: ${response.status}`);
    }
    const data = await response.json();
    return data.zones;
  } catch (error) {
    console.error('Failed to fetch weather zones:', error);
    // Returning empty array, Carte.tsx should handle fallback
    return [];
  }
};

export interface ForecastDataPoint {
  time: string;
  temperature: number;
  wind_speed: number;
  humidity: number;
  risk_percentage: number;
  status: 'safe' | 'warn' | 'fire';
}

export interface ZoneForecast {
  id: string;
  forecast: ForecastDataPoint[];
}

export const fetchForecast = async (): Promise<ZoneForecast[]> => {
  try {
    const response = await fetch(`${API_URL}/weather/forecast`);
    if (!response.ok) {
      throw new Error(`Erreur API Forecast: ${response.status}`);
    }
    const data = await response.json();
    return data.zones_forecast;
  } catch (error) {
    console.error('Failed to fetch forecast:', error);
    return [];
  }
};
