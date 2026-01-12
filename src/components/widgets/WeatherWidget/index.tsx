import { useState, useEffect, useRef, type FC, useCallback } from 'react';
import { toast } from 'sonner';
import { useVisibilityRefresh } from '../../../lib/useVisibilityRefresh';
import { Cloud, CloudRain, CloudSnow, CloudLightning, Wind, Sun, SunDim, Droplets, Info, Search, MapPin, Loader2 } from 'lucide-react';
import {
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  RadioGroup,
  RadioGroupItem,
  Label,
  Button,
  Input,
} from '@boxento/primitives';
import WidgetHeader from '../../widgets/common/WidgetHeader';
import { WeatherWidgetProps, WeatherData, WeatherWidgetConfig } from './types';
import { faviconService } from '@/lib/services/favicon';

interface CitySearchResult {
  id: number;
  name: string;
  country: string;
  admin1?: string; // State/province
  latitude: number;
  longitude: number;
}

/**
 * Weather Widget Component
 * 
 * Displays current weather conditions and forecast.
 * Adapts to different sizes with varying levels of detail:
 * - Smallest (2x2): Temperature, icon, location
 * - Small (3x2): Adds humidity, wind, and feels-like temp
 * - Wide (4x2): Adds horizontal 5-day forecast
 * - Medium (3x3): Adds weather details and vertical forecast
 * - Large (4x4): Complete weather data with detailed forecast
 * 
 * @component
 * @param {WeatherWidgetProps} props - Component props
 * @returns {JSX.Element} Weather widget component
 */
const WeatherWidget: FC<WeatherWidgetProps> = ({ width, height, config, refreshInterval = 15 }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<'celsius' | 'fahrenheit'>('celsius');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<WeatherWidgetConfig>(
    config || { id: '', location: 'New York', units: 'metric' }
  );
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [citySearch, setCitySearch] = useState<string>('');
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const configRef = useRef<string>(''); // Track the last config for comparison

  /**
   * Validate location exists using geocoding API
   */
  const validateLocation = useCallback(async (location: string): Promise<{ valid: boolean; error?: string }> => {
    if (!location.trim()) {
      return { valid: false, error: 'Location is required' };
    }

    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) {
        return { valid: false, error: 'Could not verify location' };
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        return { valid: false, error: `Location "${location}" not found` };
      }

      return { valid: true };
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        return { valid: false, error: 'Request timed out' };
      }
      return { valid: false, error: 'Could not verify location' };
    }
  }, []);

  /**
   * Search for cities using geocoding API
   */
  const searchCities = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setCityResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) {
        setCityResults([]);
        return;
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const results: CitySearchResult[] = data.results.map((r: {
          id: number;
          name: string;
          country: string;
          admin1?: string;
          latitude: number;
          longitude: number;
        }) => ({
          id: r.id,
          name: r.name,
          country: r.country,
          admin1: r.admin1,
          latitude: r.latitude,
          longitude: r.longitude,
        }));
        setCityResults(results);
        setShowResults(true);
      } else {
        setCityResults([]);
      }
    } catch (err) {
      console.error('City search error:', err);
      setCityResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Handle city search input with debounce
   */
  const handleCitySearchChange = useCallback((value: string) => {
    setCitySearch(value);
    setLocationError(null);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce the search
    searchTimeoutRef.current = setTimeout(() => {
      searchCities(value);
    }, 300);
  }, [searchCities]);

  /**
   * Handle city selection from search results
   */
  const handleCitySelect = useCallback((city: CitySearchResult) => {
    const locationName = city.admin1
      ? `${city.name}, ${city.admin1}, ${city.country}`
      : `${city.name}, ${city.country}`;

    setLocalConfig(prev => ({ ...prev, location: city.name }));
    setCitySearch(locationName);
    setShowResults(false);
    setCityResults([]);
    setLocationError(null);
  }, []);

  const mockWeatherData: WeatherData = {
    location: 'New York',
    temperature: 22,
    feelsLike: 24,
    condition: 'Clear',
    description: 'Clear sky',
    icon: '01d',
    humidity: 65,
    windSpeed: 5.2,
    windDirection: 120,
    sunrise: 1617267900,
    sunset: 1617315780,
    forecast: [
      {
        day: 'Mon',
        temp: { min: 18, max: 24 },
        condition: 'Clear',
        description: 'Clear sky',
        icon: '01d'
      },
      {
        day: 'Tue',
        temp: { min: 17, max: 26 },
        condition: 'Clouds',
        description: 'Few clouds',
        icon: '02d'
      },
      {
        day: 'Wed',
        temp: { min: 19, max: 28 },
        condition: 'Clouds',
        description: 'Scattered clouds',
        icon: '03d'
      },
      {
        day: 'Thu',
        temp: { min: 20, max: 27 },
        condition: 'Rain',
        description: 'Light rain',
        icon: '10d'
      },
      {
        day: 'Fri',
        temp: { min: 18, max: 25 },
        condition: 'Clear',
        description: 'Clear sky',
        icon: '01d'
      }
    ]
  };

  /**
   * Map Open-Meteo's WMO weather codes to weather conditions
   * 
   * @param {number} code - WMO weather code
   * @returns {string} Weather condition
   */
  const mapWeatherCodeToCondition = (code: number): string => {
    if (code === 0) return 'Clear';
    if (code === 1) return 'Mainly Clear';
    if (code === 2) return 'Partly Cloudy';
    if (code === 3) return 'Overcast';
    if (code === 45 || code === 48) return 'Fog';
    if (code >= 51 && code <= 55) return 'Drizzle';
    if (code >= 56 && code <= 57) return 'Freezing Drizzle';
    if (code >= 61 && code <= 65) return 'Rain';
    if (code >= 66 && code <= 67) return 'Freezing Rain';
    if (code >= 71 && code <= 75) return 'Snow';
    if (code === 77) return 'Snow';
    if (code >= 80 && code <= 82) return 'Rain';
    if (code >= 85 && code <= 86) return 'Snow';
    if (code === 95) return 'Thunderstorm';
    if (code >= 96 && code <= 99) return 'Thunderstorm';
    return 'Unknown';
  };

  /**
   * Map Open-Meteo's WMO weather codes to detailed descriptions
   * 
   * @param {number} code - WMO weather code
   * @returns {string} Detailed weather description
   */
  const mapWeatherCodeToDescription = (code: number): string => {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code === 45) return 'Fog';
    if (code === 48) return 'Depositing rime fog';
    if (code === 51) return 'Light drizzle';
    if (code === 53) return 'Moderate drizzle';
    if (code === 55) return 'Dense drizzle';
    if (code === 56) return 'Light freezing drizzle';
    if (code === 57) return 'Dense freezing drizzle';
    if (code === 61) return 'Slight rain';
    if (code === 63) return 'Moderate rain';
    if (code === 65) return 'Heavy rain';
    if (code === 66) return 'Light freezing rain';
    if (code === 67) return 'Heavy freezing rain';
    if (code === 71) return 'Slight snow fall';
    if (code === 73) return 'Moderate snow fall';
    if (code === 75) return 'Heavy snow fall';
    if (code === 77) return 'Snow grains';
    if (code === 80) return 'Slight rain showers';
    if (code === 81) return 'Moderate rain showers';
    if (code === 82) return 'Violent rain showers';
    if (code === 85) return 'Slight snow showers';
    if (code === 86) return 'Heavy snow showers';
    if (code === 95) return 'Thunderstorm';
    if (code === 96) return 'Thunderstorm with slight hail';
    if (code === 99) return 'Thunderstorm with heavy hail';
    return 'Unknown weather condition';
  };

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    
    try {
      const location = localConfig.location || 'New York';
      const useMetric = localConfig.units !== 'imperial';
      
      // First, get coordinates for the location using Open-Meteo's geocoding API
      const geocodingResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
      );
      
      if (!geocodingResponse.ok) {
        throw new Error(`Geocoding API error: ${geocodingResponse.statusText}`);
      }
      
      const geocodingData = await geocodingResponse.json();
      
      if (!geocodingData.results || geocodingData.results.length === 0) {
        throw new Error(`Location not found: ${location}`);
      }
      
      const { latitude, longitude, name } = geocodingData.results[0];
      
      // Now fetch weather data using Open-Meteo's forecast API
      const temperatureUnit = useMetric ? 'celsius' : 'fahrenheit';
      const windSpeedUnit = useMetric ? 'kmh' : 'mph';
      
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?` +
        `latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset` +
        `&temperature_unit=${temperatureUnit}&wind_speed_unit=${windSpeedUnit}` +
        `&forecast_days=5&timezone=auto`
      );
      
      if (!weatherResponse.ok) {
        throw new Error(`Weather API error: ${weatherResponse.statusText}`);
      }
      
      const weatherData = await weatherResponse.json();
      
      // Process forecast data to match our format
      const forecast = weatherData.daily.time.map((date: string, index: number) => {
        const weatherCode = weatherData.daily.weather_code[index];
        return {
          day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          temp: {
            min: weatherData.daily.temperature_2m_min[index],
            max: weatherData.daily.temperature_2m_max[index]
          },
          condition: mapWeatherCodeToCondition(weatherCode),
          description: mapWeatherCodeToDescription(weatherCode),
          icon: `${weatherCode}`
        };
      });
      
      // Get current weather data
      const currentWeatherCode = weatherData.current.weather_code;
      
      setWeather({
        location: name,
        temperature: weatherData.current.temperature_2m,
        feelsLike: weatherData.current.apparent_temperature,
        condition: mapWeatherCodeToCondition(currentWeatherCode),
        description: mapWeatherCodeToDescription(currentWeatherCode),
        icon: `${currentWeatherCode}`,
        humidity: weatherData.current.relative_humidity_2m,
        windSpeed: weatherData.current.wind_speed_10m,
        windDirection: weatherData.current.wind_direction_10m,
        sunrise: Date.parse(weatherData.daily.sunrise[0]) / 1000,
        sunset: Date.parse(weatherData.daily.sunset[0]) / 1000,
        forecast
      });
      
      setLoading(false);
      setUnit(useMetric ? 'celsius' : 'fahrenheit');
      setError(null);
    } catch (err) {
      console.error('[WeatherWidget] Error:', err);
      setError('Failed to fetch weather data');
      setLoading(false);
      
      // Use mock data if available
      if (mockWeatherData) {
        setWeather(mockWeatherData);
        setLoading(false);
      }
    }
  }, [localConfig.location, localConfig.units]); // Only depend on location and units

  useEffect(() => {
    if (config) {
      // Create a config signature to detect real changes
      const configSignature = `${config.id}-${config.location}-${config.units}`;
      
      // Only update if there's a real change and not just a re-render
      if (configSignature !== configRef.current) {
        configRef.current = configSignature;
        setLocalConfig(config);
      }
    }
  }, [config]);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Auto-refresh when tab becomes visible or at the configured interval
  useVisibilityRefresh({
    onRefresh: fetchWeather,
    minHiddenTime: 60000, // Refresh if hidden for 1+ minute
    refreshInterval: refreshInterval > 0 ? refreshInterval * 60 * 1000 : 0,
    enabled: true
  });

  const handleUnitsChange = useCallback((value: 'metric' | 'imperial') => {
    setLocalConfig(prev => ({...prev, units: value}));
  }, []);

  /**
   * Format temperature with unit
   * 
   * @param {number} temp - Temperature value
   * @returns {string} Formatted temperature with unit
   */
  const formatTemperature = (temp: number): string => {
    const roundedTemp = Math.round(temp);
    return `${roundedTemp}°${unit === 'celsius' ? 'C' : 'F'}`;
  };

  /**
   * Helper function to get the appropriate weather icon
   * 
   * @param {string} condition - Weather condition (clear, rain, cloudy, etc.)
   * @param {string} [icon] - Optional icon code from the API
   * @returns {React.ReactElement} Weather icon component
   */
  const getWeatherIcon = (condition: string, icon?: string): React.ReactElement => {
    // Default size and style
    const defaultSize = 24;
    const className = "text-gray-700 dark:text-gray-300";
    
    // Get WMO weather code if provided
    const weatherCode = icon ? parseInt(icon) : null;
    
    // Check if it's day or night (for Open-Meteo we'll default to day)
    const isNight = false;
    
    // Map icons based on weather codes or condition
    if (weatherCode !== null) {
      if (weatherCode === 0) 
        return isNight ? <SunDim size={defaultSize} className={className} /> : <Sun size={defaultSize} className={className} />;
      
      if (weatherCode === 1 || weatherCode === 2) 
        return <Cloud size={defaultSize} className={className} />;
      
      if (weatherCode === 3) 
        return <Cloud size={defaultSize} className={className} />;
      
      if (weatherCode === 45 || weatherCode === 48) 
        return <Wind size={defaultSize} className={className} />;
      
      if (weatherCode >= 51 && weatherCode <= 57) 
        return <CloudRain size={defaultSize} className={className} />;
      
      if (weatherCode >= 61 && weatherCode <= 67) 
        return <CloudRain size={defaultSize} className={className} />;
      
      if (weatherCode >= 71 && weatherCode <= 77) 
        return <CloudSnow size={defaultSize} className={className} />;
      
      if (weatherCode >= 80 && weatherCode <= 82) 
        return <CloudRain size={defaultSize} className={className} />;
      
      if (weatherCode >= 85 && weatherCode <= 86) 
        return <CloudSnow size={defaultSize} className={className} />;
      
      if (weatherCode >= 95 && weatherCode <= 99) 
        return <CloudLightning size={defaultSize} className={className} />;
    }
    
    // Fallback to condition string if no valid weather code
    switch (condition.toLowerCase()) {
      case 'clear':
        return isNight ? <SunDim size={defaultSize} className={className} /> : <Sun size={defaultSize} className={className} />;
      case 'mainly clear':
      case 'partly cloudy':
      case 'overcast':
      case 'clouds':
        return <Cloud size={defaultSize} className={className} />;
      case 'rain':
      case 'drizzle':
      case 'freezing drizzle':
      case 'freezing rain':
        return <CloudRain size={defaultSize} className={className} />;
      case 'snow':
        return <CloudSnow size={defaultSize} className={className} />;
      case 'thunderstorm':
        return <CloudLightning size={defaultSize} className={className} />;
      case 'fog':
      case 'mist':
      case 'haze':
        return <Wind size={defaultSize} className={className} />;
      default:
        return <Cloud size={defaultSize} className={className} />;
    }
  };

  /**
   * Loading component for all views
   * 
   * @returns {JSX.Element} Loading indicator
   */
  const renderLoading = () => {
    return (
      <div className="h-full w-full p-4 flex flex-col">
        {/* Temperature and icon skeleton */}
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        {/* Location skeleton */}
        <Skeleton className="h-4 w-24 mb-2" />
        {/* Condition skeleton */}
        <Skeleton className="h-3 w-16 mb-4" />
        {/* Forecast skeleton */}
        <div className="flex-1 flex items-end space-x-2">
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  };

  /**
   * Error component for all views
   * 
   * @returns {JSX.Element} Error indicator
   */
  const renderError = () => {
    return (
      <div className="flex flex-col items-center justify-center h-full p-3 text-center">
        <Info className="text-amber-500 mb-2" size={24} />
        <p className="text-sm text-amber-500 mb-1">{error}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Check your location or try again later.
        </p>
      </div>
    );
  };

  /**
   * Renders the minimal view for smallest widget size (2x2)
   * Displays just the essential information: current temperature, weather icon and location
   * 
   * @returns {JSX.Element} Minimal view
   */
  const renderMinimalView = () => {
    if (!weather) return null;
    
    return (
      <div className="flex flex-col items-center justify-center h-full px-2 py-3">
        <div className="mb-1">
          {getWeatherIcon(weather.condition, weather.icon)}
        </div>
        <div className="text-2xl font-medium tracking-tight">
          {formatTemperature(weather.temperature)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
          {weather.location}
        </div>
      </div>
    );
  };

  /**
   * Renders a compact view with essential weather details
   * Adds feels-like temperature, humidity and wind speed to the basic view
   * 
   * @returns {JSX.Element} Compact layout view
   */
  const renderCompactView = () => {
    if (!weather) return null;
    
    return (
      <div className="flex h-full p-3">
        <div className="flex flex-col justify-center items-start flex-1">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1 truncate">
            {weather.location}
          </div>
          <div className="flex items-center">
            <span className="text-2xl font-medium tracking-tight mr-2">
              {formatTemperature(weather.temperature)}
            </span>
            {getWeatherIcon(weather.condition, weather.icon)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {weather.condition}
          </div>
        </div>
        
        <div className="flex flex-col justify-center items-end text-right space-y-1">
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <span className="mr-1">Feels</span> 
            <span className="font-medium">{formatTemperature(weather.feelsLike)}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <Droplets size={12} className="mr-1" /> 
            <span className="font-medium">{weather.humidity}%</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <Wind size={12} className="mr-1" /> 
            <span className="font-medium">{weather.windSpeed}</span>
            <span className="ml-1">{unit === 'celsius' ? 'm/s' : 'mph'}</span>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renders a horizontal forecast view for wider widgets
   * Shows current conditions and a 5-day forecast in a horizontal layout
   * 
   * @returns {JSX.Element} Horizontal forecast view
   */
  const renderHorizontalForecastView = () => {
    if (!weather) return null;
    
    return (
      <div className="flex flex-col h-full p-3">
        <div className="flex items-center mb-3">
          <div className="mr-3">
            {getWeatherIcon(weather.condition, weather.icon)}
          </div>
          <div>
            <div className="text-xl font-medium tracking-tight">
              {formatTemperature(weather.temperature)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {weather.location}
            </div>
          </div>
          <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            Feels like {formatTemperature(weather.feelsLike)}
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <div className="flex space-x-2 h-full">
            {weather.forecast.map((day, index) => (
              <div key={index} className="flex-1 flex flex-col items-center justify-between py-2 px-1">
                <div className="text-xs font-medium">{day.day}</div>
                <div className="py-1">
                  {getWeatherIcon(day.condition, day.icon)}
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-xs font-medium">
                    {Math.round(day.temp.max)}°
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {Math.round(day.temp.min)}°
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renders a vertical forecast view for medium-sized widgets
   * Includes current conditions, weather metrics, and a vertical 5-day forecast
   * 
   * @returns {JSX.Element} Vertical forecast view
   */
  const renderVerticalForecastView = () => {
    if (!weather) return null;
    
    // Calculate sunrise and sunset times
    const sunriseTime = new Date(weather.sunrise * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const sunsetTime = new Date(weather.sunset * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    return (
      <div className="flex flex-col h-full p-3">
        <div className="mb-3">
          <div className="text-sm font-medium truncate mb-1">{weather.location}</div>
          <div className="flex items-end">
            <div className="text-3xl font-medium tracking-tight mr-2">
              {formatTemperature(weather.temperature)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Feels like {formatTemperature(weather.feelsLike)}
            </div>
            <div className="ml-auto">
              {getWeatherIcon(weather.condition, weather.icon)}
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {weather.description}
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-md p-2 text-center">
            <div className="text-xs text-gray-500 ">Humidity</div>
            <div className="text-sm font-medium mt-1">{weather.humidity}%</div>
          </div>
          <div className="rounded-md p-2 text-center">
            <div className="text-xs text-gray-500 ">Wind</div>
            <div className="text-sm font-medium mt-1">{weather.windSpeed} {unit === 'celsius' ? 'm/s' : 'mph'}</div>
          </div>
          <div className="rounded-md p-2 text-center">
            <div className="text-xs text-gray-500">Sunrise/Sunset</div>
            <div className="text-xs font-medium mt-1">{sunriseTime} / {sunsetTime}</div>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <div className="text-xs font-medium mb-2">5-Day Forecast</div>
          <div className="space-y-2">
            {weather.forecast.map((day, index) => (
              <div key={index} className="flex items-center justify-between rounded-md py-2 px-3">
                <div className="text-xs font-medium w-10">{day.day}</div>
                <div className="flex-1 flex justify-center">
                  {getWeatherIcon(day.condition, day.icon)}
                </div>
                <div className="text-xs w-16 text-right">
                  <span className="font-medium">{Math.round(day.temp.max)}°</span>
                  <span className="text-gray-400 ml-1">{Math.round(day.temp.min)}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renders the full-size detailed view for large widgets
   * Comprehensive display with current conditions, detailed metrics, and complete forecast
   * 
   * @returns {JSX.Element} Full-size detailed view
   */
  const renderDetailedView = () => {
    if (!weather) return null;
    
    // Get current date and time
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const currentDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    
    // Calculate sunrise and sunset times
    const sunriseTime = new Date(weather.sunrise * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const sunsetTime = new Date(weather.sunset * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="text-lg font-medium">{weather.location}</h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {currentDate} • {currentTime}
            </div>
            <div className="text-sm mt-1">
              {weather.description}
            </div>
          </div>
          <div className="text-right flex items-center">
            <div className="mr-3">
              {getWeatherIcon(weather.condition, weather.icon)}
            </div>
            <div>
              <div className="text-3xl font-medium tracking-tight">
                {formatTemperature(weather.temperature)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Feels like {formatTemperature(weather.feelsLike)}
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="rounded-md p-3">
            <div className="text-xs text-gray-500 mb-1">Humidity</div>
            <div className="text-lg font-medium">{weather.humidity}%</div>
          </div>
          <div className="rounded-md p-3">
            <div className="text-xs text-gray-500 mb-1">Wind</div>
            <div className="text-lg font-medium">{weather.windSpeed} {unit === 'celsius' ? 'm/s' : 'mph'}</div>
          </div>
          <div className="rounded-md p-3">
            <div className="text-xs text-gray-500 mb-1">Sunrise</div>
            <div className="text-lg font-medium">{sunriseTime}</div>
          </div>
          <div className="rounded-md p-3">
            <div className="text-xs text-gray-500 mb-1">Sunset</div>
            <div className="text-lg font-medium">{sunsetTime}</div>
          </div>
        </div>
        
        <div className="flex-1">
          <h4 className="text-sm font-medium mb-3">5-Day Forecast</h4>
          <div className="grid grid-cols-5 gap-3">
            {weather.forecast.map((day, index) => (
              <div key={index} className="rounded-md p-3 flex flex-col items-center">
                <div className="text-sm font-medium mb-2">{day.day}</div>
                <div className="mb-2">
                  {getWeatherIcon(day.condition, day.icon)}
                </div>
                <div className="text-sm font-medium">
                  {Math.round(day.temp.max)}°
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {Math.round(day.temp.min)}°
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                  {day.condition}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Determines which view to render based on widget dimensions
   * Adapts the content display to make optimal use of available space
   * 
   * @returns {JSX.Element} The appropriate view for the current dimensions
   */
  const renderContent = () => {
    if (error) {
      return renderError();
    }
    
    if (loading) {
      return renderLoading();
    }
    
    // Determine which view to render based on available space
    // Using a more nuanced approach to sizing
    if (width >= 4 && height >= 4) {
      return renderDetailedView();
    } else if (width >= 3 && height >= 3) {
      return renderVerticalForecastView();
    } else if (width >= 4 && height >= 2) {
      return renderHorizontalForecastView();
    } else if (width >= 3 && height >= 2) {
      return renderCompactView();
    } else {
      return renderMinimalView();
    }
  };

  /**
   * Renders the settings content for the modal
   *
   * @returns {JSX.Element} Settings content
   */
  const renderSettingsContent = () => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="location-input">Location</Label>
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="location-input"
              type="text"
              placeholder="Search for a city..."
              value={citySearch || localConfig.location || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                handleCitySearchChange(e.target.value);
              }}
              onFocus={() => {
                if (cityResults.length > 0) setShowResults(true);
              }}
              className={`pl-9 ${locationError ? 'border-red-500' : ''}`}
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search results dropdown */}
          {showResults && cityResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
              {cityResults.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-accent flex items-start gap-2 border-b last:border-b-0"
                  onClick={() => handleCitySelect(city)}
                >
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{city.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {city.admin1 ? `${city.admin1}, ` : ''}{city.country}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {showResults && citySearch.length >= 2 && !isSearching && cityResults.length === 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
              No cities found for "{citySearch}"
            </div>
          )}
        </div>
        {locationError && (
          <p className="text-xs text-red-500">{locationError}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Start typing to search for any city worldwide
        </p>
      </div>

      <div className="space-y-2">
        <Label>Temperature Units</Label>
        <RadioGroup
          value={localConfig.units || 'metric'}
          onValueChange={handleUnitsChange}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="metric" id="metric" />
            <Label htmlFor="metric">Celsius (°C)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="imperial" id="imperial" />
            <Label htmlFor="imperial">Fahrenheit (°F)</Label>
          </div>
        </RadioGroup>
      </div>
    </>
  );
};

  /**
   * Renders the settings footer
   * 
   * @returns {JSX.Element} Settings footer
   */
  const handleSaveSettings = async () => {
    // Validate location before saving
    setIsValidating(true);
    setLocationError(null);

    const result = await validateLocation(localConfig.location || '');

    setIsValidating(false);

    if (!result.valid) {
      setLocationError(result.error || 'Invalid location');
      toast.error('Invalid location', {
        description: result.error,
        duration: 4000,
      });
      return;
    }

    // Save settings via onUpdate callback
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }

    // Apply the local config settings
    setUnit(localConfig.units === 'imperial' ? 'fahrenheit' : 'celsius');
    setIsSettingsOpen(false);

    // Trigger a weather refresh with new settings
    setLoading(true);
    setTimeout(() => {
      fetchWeather();
    }, 300);
  };

  const renderSettingsFooter = () => {
    return (
      <div className="flex justify-between w-full">
        {config?.onDelete && (
          <Button
            variant="destructive"
            onClick={() => {
              if (config.onDelete) {
                config.onDelete();
              }
            }}
            aria-label="Delete this widget"
          >
            Delete
          </Button>
        )}

        <div className="flex">
          <Button
            variant="default"
            onClick={handleSaveSettings}
            disabled={isValidating}
          >
            {isValidating ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Validating...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (weather && !loading && !error) {
      // Update favicon with current temperature
      faviconService.updateWeatherInfo(Math.round(weather.temperature));
    }
  }, [weather, loading, error, localConfig.units]);

  useEffect(() => {
    return () => {
      faviconService.clearWeatherInfo();
    };
  }, []);

  return (
    <div ref={widgetRef} className="widget-container h-full flex flex-col">
      <WidgetHeader 
        title="Weather" 
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      
      <div className="flex-1 overflow-hidden rounded-md m-1">
        {renderContent()}
      </div>
      
      {isSettingsOpen && (
        <Dialog open={isSettingsOpen} onOpenChange={(open: boolean) => {
          setIsSettingsOpen(open);
          if (open) {
            // Reset search state when dialog opens
            setCitySearch('');
            setCityResults([]);
            setShowResults(false);
            setLocationError(null);
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Weather Settings</DialogTitle>
            </DialogHeader>
            {/* Add a div with space-y-4 inside the py-4 container */}
            <div className="py-4">
              <div className="space-y-4">
                {renderSettingsContent()}
              </div>
            </div>
            <DialogFooter>
              {renderSettingsFooter()}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Fix export issue by explicitly exporting the component
export { WeatherWidget };
export default WeatherWidget;