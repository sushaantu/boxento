import React, { useState, useEffect, useRef } from 'react'
import { Trash, GripVertical } from 'lucide-react'
import WidgetHeader from '../../widgets/common/WidgetHeader'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@boxento/primitives'
import { WorldClocksWidgetProps, TimezoneItem } from './types'

/**
 * World Clocks Widget Component
 * 
 * Displays the current time in multiple timezones.
 * Allows adding, editing, and removing timezones.
 * Supports different layouts based on widget dimensions (minimum size 2x2).
 * 
 * @component
 * @param {WorldClocksWidgetProps} props - Component props
 * @returns {JSX.Element} World Clocks widget component
 */
const WorldClocksWidget: React.FC<WorldClocksWidgetProps> = ({ width, height, config }) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [timezones, setTimezones] = useState<TimezoneItem[]>(config?.timezones || [
    { id: 1, name: 'New York, USA', timezone: 'America/New_York' },
    { id: 2, name: 'London, UK', timezone: 'Europe/London' },
    { id: 3, name: 'Tokyo, Japan', timezone: 'Asia/Tokyo' },
    { id: 4, name: 'Sydney, Australia', timezone: 'Australia/Sydney' }
  ])
  const [showSettings, setShowSettings] = useState<boolean>(false)
  const [citySearchInput, setCitySearchInput] = useState<string>('')
  const [searchResults, setSearchResults] = useState<Array<{city: string, country: string, timezone: string}>>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null)
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null)
  const widgetRef = useRef<HTMLDivElement | null>(null)
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])

  /**
   * Formats a date for a specific timezone
   * 
   * @param {Date} date - Date to format
   * @param {string} timezone - IANA timezone identifier
   * @returns {string} Formatted time string
   */
  const formatTime = (date: Date, timezone: string): string => {
    try {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: timezone
      });
    } catch (error: unknown) {
      console.error('Error formatting time:', error instanceof Error ? error.message : error);
      return 'Invalid timezone';
    }
  }

  /**
   * Gets the relative date for a timezone (e.g., "Today", "Tomorrow")
   * 
   * @param {Date} date - Date to check
   * @param {string} timezone - IANA timezone identifier
   * @returns {string} Relative date string
   */
  const getRelativeDate = (date: Date, timezone: string): string => {
    try {
      // Get the date in the target timezone
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        timeZone: timezone
      };
      
      const dateInTimezone = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      const localDate = new Date();
      
      // Compare the date in the target timezone with the local date
      const targetDay = dateInTimezone.getDate();
      const localDay = localDate.getDate();
      
      if (targetDay === localDay) {
        return 'Today';
      } else if (targetDay === localDay + 1) {
        return 'Tomorrow';
      } else if (targetDay === localDay - 1) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString('en-US', options);
      }
    } catch (error) {
      console.error('Error getting relative date:', error);
      return 'Unknown';
    }
  }

  /**
   * Gets the time difference between local time and a timezone
   * 
   * @param {string} timezone - IANA timezone identifier
   * @returns {string} Time difference string (e.g., "+3h")
   */
  const getTimeDiff = (timezone: string): string => {
    try {
      const localDate = new Date();
      
      // Get the target timezone's current time
      const targetDate = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
      
      // Calculate the time difference in hours
      let hoursDiff = (targetDate.getHours() - localDate.getHours());
      
      // Adjust for day boundary crossings
      if (hoursDiff > 12) {
        hoursDiff -= 24;
      } else if (hoursDiff < -12) {
        hoursDiff += 24;
      }
      
      // Format the difference
      if (hoursDiff === 0) {
        return 'Same time';
      } else {
        const sign = hoursDiff > 0 ? '+' : '';
        return `${sign}${hoursDiff}h`;
      }
    } catch (error: unknown) {
      console.error('Error calculating time difference:', error instanceof Error ? error.message : error);
      return '';
    }
  }

  /**
   * Removes a timezone from the list
   * 
   * @param {number} id - The id of the timezone to remove
   */
  const removeTimezone = (id: number): void => {
    const updatedTimezones = timezones.filter(tz => tz.id !== id);
    
    // Update state
    setTimezones(updatedTimezones);
    
    // Save using onUpdate callback to persist
    if (config?.onUpdate) {
      config.onUpdate({
        ...config,
        timezones: updatedTimezones
      });
    }
  };

  /**
   * Searches for cities and their timezones based on input
   * 
   * @param {string} searchTerm - The city name to search for
   */
  const searchCities = (searchTerm: string): void => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    // Comprehensive list of cities and their timezones
    // This is a much more extensive list than the original 10 cities
    const cityDatabase = [
      // North America
      { city: 'New York', country: 'USA', timezone: 'America/New_York' },
      { city: 'Los Angeles', country: 'USA', timezone: 'America/Los_Angeles' },
      { city: 'Chicago', country: 'USA', timezone: 'America/Chicago' },
      { city: 'Toronto', country: 'Canada', timezone: 'America/Toronto' },
      { city: 'Vancouver', country: 'Canada', timezone: 'America/Vancouver' },
      { city: 'Mexico City', country: 'Mexico', timezone: 'America/Mexico_City' },
      { city: 'Denver', country: 'USA', timezone: 'America/Denver' },
      { city: 'Phoenix', country: 'USA', timezone: 'America/Phoenix' },
      { city: 'Montreal', country: 'Canada', timezone: 'America/Montreal' },
      { city: 'San Francisco', country: 'USA', timezone: 'America/Los_Angeles' },
      { city: 'Miami', country: 'USA', timezone: 'America/New_York' },
      { city: 'Dallas', country: 'USA', timezone: 'America/Chicago' },
      { city: 'Seattle', country: 'USA', timezone: 'America/Los_Angeles' },
      { city: 'Atlanta', country: 'USA', timezone: 'America/New_York' },
      { city: 'Calgary', country: 'Canada', timezone: 'America/Edmonton' },
      
      // Europe
      { city: 'London', country: 'UK', timezone: 'Europe/London' },
      { city: 'Paris', country: 'France', timezone: 'Europe/Paris' },
      { city: 'Berlin', country: 'Germany', timezone: 'Europe/Berlin' },
      { city: 'Rome', country: 'Italy', timezone: 'Europe/Rome' },
      { city: 'Madrid', country: 'Spain', timezone: 'Europe/Madrid' },
      { city: 'Moscow', country: 'Russia', timezone: 'Europe/Moscow' },
      { city: 'Amsterdam', country: 'Netherlands', timezone: 'Europe/Amsterdam' },
      { city: 'Brussels', country: 'Belgium', timezone: 'Europe/Brussels' },
      { city: 'Vienna', country: 'Austria', timezone: 'Europe/Vienna' },
      { city: 'Stockholm', country: 'Sweden', timezone: 'Europe/Stockholm' },
      { city: 'Athens', country: 'Greece', timezone: 'Europe/Athens' },
      { city: 'Dublin', country: 'Ireland', timezone: 'Europe/Dublin' },
      { city: 'Prague', country: 'Czech Republic', timezone: 'Europe/Prague' },
      { city: 'Lisbon', country: 'Portugal', timezone: 'Europe/Lisbon' },
      { city: 'Copenhagen', country: 'Denmark', timezone: 'Europe/Copenhagen' },
      { city: 'Oslo', country: 'Norway', timezone: 'Europe/Oslo' },
      { city: 'Helsinki', country: 'Finland', timezone: 'Europe/Helsinki' },
      { city: 'Warsaw', country: 'Poland', timezone: 'Europe/Warsaw' },
      { city: 'Budapest', country: 'Hungary', timezone: 'Europe/Budapest' },
      { city: 'Zurich', country: 'Switzerland', timezone: 'Europe/Zurich' },
      
      // Asia & Pacific
      { city: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo' },
      { city: 'Shanghai', country: 'China', timezone: 'Asia/Shanghai' },
      { city: 'Hong Kong', country: 'China', timezone: 'Asia/Hong_Kong' },
      { city: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore' },
      { city: 'Delhi', country: 'India', timezone: 'Asia/Kolkata' },
      { city: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata' },
      { city: 'Bangkok', country: 'Thailand', timezone: 'Asia/Bangkok' },
      { city: 'Dubai', country: 'UAE', timezone: 'Asia/Dubai' },
      { city: 'Seoul', country: 'South Korea', timezone: 'Asia/Seoul' },
      { city: 'Sydney', country: 'Australia', timezone: 'Australia/Sydney' },
      { city: 'Melbourne', country: 'Australia', timezone: 'Australia/Melbourne' },
      { city: 'Auckland', country: 'New Zealand', timezone: 'Pacific/Auckland' },
      { city: 'Beijing', country: 'China', timezone: 'Asia/Shanghai' },
      { city: 'Jakarta', country: 'Indonesia', timezone: 'Asia/Jakarta' },
      { city: 'Istanbul', country: 'Turkey', timezone: 'Europe/Istanbul' },
      { city: 'Taipei', country: 'Taiwan', timezone: 'Asia/Taipei' },
      { city: 'Manila', country: 'Philippines', timezone: 'Asia/Manila' },
      { city: 'Kuala Lumpur', country: 'Malaysia', timezone: 'Asia/Kuala_Lumpur' },
      { city: 'Osaka', country: 'Japan', timezone: 'Asia/Tokyo' },
      { city: 'Brisbane', country: 'Australia', timezone: 'Australia/Brisbane' },
      
      // Africa & Middle East
      { city: 'Cairo', country: 'Egypt', timezone: 'Africa/Cairo' },
      { city: 'Johannesburg', country: 'South Africa', timezone: 'Africa/Johannesburg' },
      { city: 'Lagos', country: 'Nigeria', timezone: 'Africa/Lagos' },
      { city: 'Nairobi', country: 'Kenya', timezone: 'Africa/Nairobi' },
      { city: 'Casablanca', country: 'Morocco', timezone: 'Africa/Casablanca' },
      { city: 'Doha', country: 'Qatar', timezone: 'Asia/Qatar' },
      { city: 'Abu Dhabi', country: 'UAE', timezone: 'Asia/Dubai' },
      { city: 'Riyadh', country: 'Saudi Arabia', timezone: 'Asia/Riyadh' },
      { city: 'Tel Aviv', country: 'Israel', timezone: 'Asia/Tel_Aviv' },
      
      // South America
      { city: 'São Paulo', country: 'Brazil', timezone: 'America/Sao_Paulo' },
      { city: 'Buenos Aires', country: 'Argentina', timezone: 'America/Argentina/Buenos_Aires' },
      { city: 'Rio de Janeiro', country: 'Brazil', timezone: 'America/Sao_Paulo' },
      { city: 'Lima', country: 'Peru', timezone: 'America/Lima' },
      { city: 'Bogota', country: 'Colombia', timezone: 'America/Bogota' },
      { city: 'Santiago', country: 'Chile', timezone: 'America/Santiago' },
      { city: 'Caracas', country: 'Venezuela', timezone: 'America/Caracas' },
    ];
    
    // Filter results based on search term (case insensitive)
    const results = cityDatabase.filter(item => 
      item.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.country.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10); // Limit to 10 results for performance
    
    setSearchResults(results);
    setIsSearching(false);
  };

  /**
   * Selects a city from search results and adds it as a timezone
   * 
   * @param {Object} cityData - The selected city data with timezone
   */
  const selectCity = (cityData: {city: string, country: string, timezone: string}): void => {
    // Format the display name to include the country
    const displayName = `${cityData.city}, ${cityData.country}`;
    
    // Clear search results
    setSearchResults([]);
    setCitySearchInput('');
    
    // Directly add the timezone after selection
    const newId = Math.max(0, ...timezones.map(tz => tz.id || 0)) + 1;
    const updatedTimezones = [...timezones, { 
      id: newId, 
      name: displayName, 
      timezone: cityData.timezone 
    }];
    
    // Update state
    setTimezones(updatedTimezones);
    
    // Save using onUpdate callback to persist
    if (config?.onUpdate) {
      config.onUpdate({
        ...config,
        timezones: updatedTimezones
      });
    }
  };

  /**
   * Renders a Bauhaus-inspired minimal analog clock
   *
   * @param {string} timezone - IANA timezone identifier
   * @param {number} [size=80] - Size of the clock in pixels
   * @param {boolean} [isDarkMode=false] - Whether to use dark mode colors
   * @returns {React.ReactElement} Analog clock SVG
   */
  const renderClock = (timezone: string, size: number = 80, isDarkMode: boolean = false): React.ReactElement => {
    try {
      // Get the current time in the specified timezone
      const date = new Date(currentTime.toLocaleString('en-US', { timeZone: timezone }));

      // Calculate the angles for the clock hands
      const seconds = date.getSeconds();
      const minutes = date.getMinutes();
      const hours = date.getHours() % 12;

      // Smooth second hand movement
      const secondAngle = ((seconds) / 60) * 360;
      const minuteAngle = ((minutes + seconds / 60) / 60) * 360;
      const hourAngle = ((hours + minutes / 60) / 12) * 360;

      // Calculate dimensions
      const center = size / 2;
      const radius = size / 2 - 2;

      // Hand lengths - Bauhaus proportions
      const hourHandLength = radius * 0.5;
      const minuteHandLength = radius * 0.72;
      const secondHandLength = radius * 0.8;

      // Bauhaus-inspired colors
      const handColor = isDarkMode ? '#f8fafc' : '#1e293b';
      const secondHandColor = '#ef4444'; // Bauhaus red accent
      const markerColor = isDarkMode ? '#475569' : '#cbd5e1';

      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="clock">
          {/* Minimal hour markers - just tiny dots at 12, 3, 6, 9 */}
          {[0, 3, 6, 9].map((hour) => {
            const angle = (hour * 30) * (Math.PI / 180);
            const markerRadius = hour === 0 ? radius * 0.06 : radius * 0.04;
            const x = center + (radius * 0.85) * Math.sin(angle);
            const y = center - (radius * 0.85) * Math.cos(angle);

            return (
              <circle
                key={hour}
                cx={x}
                cy={y}
                r={markerRadius}
                fill={markerColor}
              />
            );
          })}

          {/* Hour hand - bold, geometric rectangle */}
          <rect
            x={center - size * 0.025}
            y={center - hourHandLength}
            width={size * 0.05}
            height={hourHandLength}
            fill={handColor}
            transform={`rotate(${hourAngle}, ${center}, ${center})`}
            rx={size * 0.01}
          />

          {/* Minute hand - slimmer rectangle */}
          <rect
            x={center - size * 0.018}
            y={center - minuteHandLength}
            width={size * 0.036}
            height={minuteHandLength}
            fill={handColor}
            transform={`rotate(${minuteAngle}, ${center}, ${center})`}
            rx={size * 0.008}
          />

          {/* Second hand - thin line with counterweight */}
          <g transform={`rotate(${secondAngle}, ${center}, ${center})`}>
            {/* Main hand */}
            <line
              x1={center}
              y1={center + radius * 0.2}
              x2={center}
              y2={center - secondHandLength}
              stroke={secondHandColor}
              strokeWidth={size * 0.012}
              strokeLinecap="round"
            />
            {/* Counterweight circle */}
            <circle
              cx={center}
              cy={center + radius * 0.15}
              r={size * 0.025}
              fill={secondHandColor}
            />
          </g>

          {/* Center cap */}
          <circle
            cx={center}
            cy={center}
            r={size * 0.04}
            fill={handColor}
          />
        </svg>
      );
    } catch (error: unknown) {
      console.error('Error rendering clock:', error instanceof Error ? error.message : error);
      return <div className="text-red-500 text-xs">Invalid timezone</div>;
    }
  }

  /**
   * Renders the compact view optimized for 1x1 grid size
   * 
   * @returns {React.ReactElement} Compact view optimized for 1x1 grid size
   */
  const renderCompactView = (): React.ReactElement => {
    const mainTimezone = timezones[0] || { id: 0, name: 'Local', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    const timeString = formatTime(currentTime, mainTimezone.timezone).split(':').slice(0, 2).join(':');
    const period = formatTime(currentTime, mainTimezone.timezone).split(' ')[1];
    
    return (
      <div className="flex flex-col items-center justify-center h-full p-2">
        <div className="text-2xl font-bold leading-none">
          {timeString}
        </div>
        <div className="text-xs leading-tight mt-0.5 font-medium text-center">
          {mainTimezone.name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 leading-none">
          {period}
        </div>
      </div>
    );
  };

  /**
   * Renders the default view optimized for 2x2 grid size
   * 
   * @returns {React.ReactElement} Default view optimized for 2x2 grid size
   */
  const renderDefaultView = (): React.ReactElement => {
    // For small number of timezones, use a cleaner layout
    if (timezones.length <= 2) {
      return (
        <div className="grid grid-cols-1 gap-3 p-3 h-full transition-all duration-300">
          {timezones.map(tz => (
            <div key={tz.id} className="flex justify-between items-center h-full transition-all duration-300">
              <div className="flex flex-col">
                <div className="font-medium text-sm tracking-tight text-gray-800 dark:text-gray-200">{tz.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 tracking-wide">{getTimeDiff(tz.timezone)}</div>
              </div>
              <div className="flex flex-col items-end">
                <div className="text-2xl font-light tracking-tighter leading-tight">
                  {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 leading-none tracking-wide">
                  {formatTime(currentTime, tz.timezone).split(' ')[1]}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // For 3+ timezones, use a more compact list view with scrolling
    return (
      <div className="flex flex-col space-y-2 overflow-y-auto h-full py-2 px-3 transition-all duration-300">
        {timezones.map(tz => (
          <div key={tz.id} className="flex justify-between items-center py-1 transition-all duration-300">
            <div className="flex flex-col min-w-0">
              <div className="font-medium text-xs tracking-tight text-gray-800 dark:text-gray-200 truncate">{tz.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 tracking-wide">{getTimeDiff(tz.timezone)}</div>
            </div>
            <div className="text-base font-light tracking-tighter whitespace-nowrap ml-1">
              {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
              <span className="text-xs ml-0.5 text-gray-500 dark:text-gray-400 font-normal tracking-normal">
                {formatTime(currentTime, tz.timezone).split(' ')[1]}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Renders the medium view optimized for 2x2 grid size with multiple timezones
   * 
   * @returns {React.ReactElement} Medium view optimized for 2x2 grid size with multiple timezones
   */
  const renderMediumView = (): React.ReactElement => {
    return (
      <div className="grid grid-cols-2 gap-1 p-1 h-full overflow-y-auto">
        {timezones.map(tz => (
          <div key={tz.id} className="flex flex-col items-center justify-center p-1.5 bg-gray-50 dark:bg-slate-700 dark:bg-opacity-50 rounded">
            <div className="text-base font-bold">
              {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
            </div>
            <div className="text-xs font-medium truncate w-full text-center">{tz.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{getTimeDiff(tz.timezone)}</div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Renders the wide view optimized for 3x2 grid size
   * 
   * @returns {React.ReactElement} Wide view optimized for 3x2 grid size
   */
  const renderWideView = (): React.ReactElement => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // For 1-3 timezones, show analog clocks
    if (timezones.length <= 3) {
      return (
        <div className="grid grid-cols-3 gap-3 h-full transition-all duration-300">
          {timezones.map(tz => (
            <div key={tz.id} className="flex flex-col items-center justify-center h-full transition-all duration-300">
              <div className="text-xs font-medium tracking-tight text-gray-800 dark:text-gray-200 mb-1 truncate w-full text-center">
                {tz.name}
              </div>
              <div className="mb-0.5">
                {renderClock(tz.timezone, 50, isDarkMode)}
              </div>
              <div className="text-base font-light tracking-tighter">
                {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // For 4-6 timezones, show digital clocks in a 3x2 grid
    if (timezones.length <= 6) {
      return (
        <div className="grid grid-cols-3 grid-rows-2 gap-x-3 gap-y-2 h-full transition-all duration-300">
          {timezones.slice(0, 6).map(tz => (
            <div key={tz.id} className="flex flex-col items-center justify-center h-full transition-all duration-300">
              <div className="text-lg font-light tracking-tighter leading-none">
                {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
              </div>
              <div className="text-xs font-medium tracking-tight text-gray-700 dark:text-gray-300 truncate w-full text-center mt-0.5">
                {tz.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 tracking-wide">
                {getTimeDiff(tz.timezone)}
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // For 7+ timezones, use a more compact grid with scrolling
    return (
      <div className="grid grid-cols-3 auto-rows-min gap-x-3 gap-y-2 h-full overflow-y-auto transition-all duration-300">
        {timezones.map(tz => (
          <div key={tz.id} className="flex flex-col items-center justify-center py-1 transition-all duration-300">
            <div className="text-base font-light tracking-tighter leading-none">
              {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
            </div>
            <div className="text-xs font-medium tracking-tight text-gray-700 dark:text-gray-300 truncate w-full text-center mt-0.5">
              {tz.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 tracking-wide">
              {getTimeDiff(tz.timezone)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Renders the tall view optimized for 2x3+ grid sizes
   * 
   * @returns {React.ReactElement} Tall view optimized for 2x3+ grid sizes
   */
  const renderTallView = (): React.ReactElement => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // For 1-4 timezones, show larger clocks with more details
    if (timezones.length <= 4) {
      return (
        <div className="grid grid-cols-2 gap-2 h-full transition-all duration-300">
          {timezones.map(tz => (
            <div key={tz.id} className="flex flex-col items-center justify-center h-full transition-all duration-300">
              <div className="text-xs font-medium mb-0.5 truncate w-full text-center text-gray-800 dark:text-gray-200">
                {tz.name}
              </div>
              <div className="mb-0.5">
                {renderClock(tz.timezone, 50, isDarkMode)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">
                {getTimeDiff(tz.timezone)}
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // For 5+ timezones, use a compact layout with smaller clocks
    return (
      <div className="grid grid-cols-2 auto-rows-min gap-1 h-full overflow-y-auto transition-all duration-300">
        {timezones.map(tz => (
          <div key={tz.id} className="flex items-center p-1 transition-all duration-300">
            <div className="mr-1.5">
              {renderClock(tz.timezone, 30, isDarkMode)}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-xs font-medium truncate text-gray-800 dark:text-gray-200">{tz.name}</div>
              <div className="text-xs font-bold">
                {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{getTimeDiff(tz.timezone)}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Renders the full view optimized for 4x4+ grid sizes
   * 
   * @returns {React.ReactElement} Full view optimized for 4x4+ grid sizes
   */
  const renderFullView = (): React.ReactElement => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    return (
      <div className="grid grid-cols-3 gap-3 h-full overflow-y-auto transition-all duration-300">
        {timezones.map(tz => (
          <div key={tz.id} className="flex flex-col items-center justify-center h-full transition-all duration-300">
            <div className="text-sm font-medium mb-1 text-gray-800 dark:text-gray-200 truncate w-full text-center">{tz.name}</div>
            <div className="mb-2">
              {renderClock(tz.timezone, 70, isDarkMode)}
            </div>
            <div className="text-lg font-light tracking-tighter">
              {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                {formatTime(currentTime, tz.timezone).split(' ')[1]}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 tracking-wide">
              {getRelativeDate(currentTime, tz.timezone)}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 tracking-wide">
              {getTimeDiff(tz.timezone)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Renders the extra-wide view optimized for 6×2 or wider layouts
   * 
   * @returns {React.ReactElement} Extra-wide view optimized for 6×2 or wider layouts
   */
  const renderExtraWideView = (): React.ReactElement => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // For 1-6 timezones, show in a single row with larger analog clocks
    if (timezones.length <= 6) {
      return (
        <div className="grid grid-cols-6 gap-3 h-full transition-all duration-300">
          {timezones.map(tz => (
            <div key={tz.id} className="flex flex-col items-center justify-center h-full transition-all duration-300">
              <div className="text-sm font-medium tracking-tight text-gray-800 dark:text-gray-200 mb-1 truncate w-full text-center">
                {tz.name}
              </div>
              <div className="relative mb-1">
                {renderClock(tz.timezone, 46, isDarkMode)}
              </div>
              <div className="font-light text-xl tracking-tighter leading-none">
                {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
                <span className="text-xs ml-1 text-gray-500 dark:text-gray-400 font-normal tracking-normal">
                  {formatTime(currentTime, tz.timezone).split(' ')[1]}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 tracking-wide mt-0.5">
                {getTimeDiff(tz.timezone)}
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // For 7-12 timezones, use a 6×2 grid layout
    if (timezones.length <= 12) {
      return (
        <div className="grid grid-cols-6 grid-rows-2 gap-x-3 gap-y-1 h-full transition-all duration-300">
          {timezones.slice(0, 12).map(tz => (
            <div key={tz.id} className="flex flex-col items-center justify-center h-full transition-all duration-300">
              <div className="font-light text-lg tracking-tighter leading-none">
                {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
              </div>
              <div className="text-xs font-medium tracking-tight text-gray-700 dark:text-gray-300 truncate w-full text-center mt-0.5">
                {tz.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 tracking-wide">
                {getTimeDiff(tz.timezone)}
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // For 13+ timezones, use a scrollable 6-column grid
    return (
      <div className="grid grid-cols-6 auto-rows-min gap-x-3 gap-y-2 h-full overflow-y-auto transition-all duration-300">
        {timezones.map(tz => (
          <div key={tz.id} className="flex flex-col items-center justify-center min-h-full py-2 transition-all duration-300">
            <div className="font-light text-lg tracking-tighter leading-none">
              {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
            </div>
            <div className="text-xs font-medium tracking-tight text-gray-700 dark:text-gray-300 truncate w-full text-center mt-0.5">
              {tz.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 tracking-wide">
              {getTimeDiff(tz.timezone)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Renders the tall-wide view optimized for 2×3 or 2×4 grid sizes
   * 
   * @returns {React.ReactElement} Tall-wide view optimized for 2×3 or 2×4 grid sizes
   */
  const renderTallWideView = (): React.ReactElement => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    return (
      <div className="grid grid-cols-2 gap-4 h-full transition-all duration-300">
        {timezones.map(tz => (
          <div key={tz.id} className="flex flex-col items-center justify-center h-full transition-all duration-300">
            <div className="text-sm font-medium tracking-tight text-gray-800 dark:text-gray-200 mb-1 truncate w-full text-center">
              {tz.name}
            </div>
            <div className="relative mb-1">
              {renderClock(tz.timezone, 70, isDarkMode)}
            </div>
            <div className="font-light text-2xl tracking-tighter leading-none mt-1">
              {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
            </div>
            <div className="flex items-center justify-center space-x-2 mt-1">
              <div className="text-xs text-gray-500 dark:text-gray-400 tracking-wide">
                {getTimeDiff(tz.timezone)}
              </div>
              <div className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div className="text-xs text-gray-500 dark:text-gray-400 leading-none tracking-wide">
                {formatTime(currentTime, tz.timezone).split(' ')[1]}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Renders the appropriate view for the current dimensions and timezone count
   * 
   * @returns {React.ReactElement} The appropriate view for the current dimensions and timezone count
   */
  const renderContent = (): React.ReactElement => {
    if (timezones.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No timezones added</p>
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
          >
            Add Timezone
          </button>
        </div>
      );
    }
    
    // Single timezone for very small widgets
    if (width === 1 && height === 1) {
      return renderCompactView();
    }
    
    // Determine the best view based on dimensions and timezone count
    
    // Full size widgets - use the most detailed view
    if (width >= 4 && height >= 4) {
      return renderFullView();
    }
    
    // Extra-wide layout (6+ columns, 2 rows)
    if (width >= 6 && height === 2) {
      return renderExtraWideView();
    }
    
    // Tall-wide layout (2 columns, 3-4 rows)
    if (width === 2 && (height === 3 || height === 4)) {
      return renderTallWideView();
    }
    
    // Tall layout - 2x5+
    if (width === 2 && height >= 5) {
      // For many timezones in this layout, the tall view with compact list is best
      return renderTallView();
    }
    
    // Wide layout - 3x2 to 5x2
    if (width >= 3 && height === 2) {
      return renderWideView();
    }
    
    // Square 2x2 layout
    if (width === 2 && height === 2) {
      // Choose based on number of timezones
      if (timezones.length <= 2) {
        return renderDefaultView(); // Cleaner look for fewer timezones
      } else if (timezones.length <= 4) {
        return renderMediumView(); // Grid for 3-4 timezones
      } else {
        return renderDefaultView(); // Scrollable list for many timezones
      }
    }
    
    // 3x3 and similar sizes
    if (width >= 3 && height >= 3) {
      return renderTallView();
    }
    
    // For all other irregular sizes, choose based on aspect ratio
    if (width > height) {
      return renderWideView(); // Wider than tall
    } else if (height > width) {
      return renderTallView(); // Taller than wide
    }
    
    // Default fallback for other dimensions
    return renderDefaultView();
  };

  /**
   * Handles the start of dragging a timezone item
   * 
   * @param {number} index - The index of the item being dragged
   */
  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  /**
   * Handles dragging over another timezone item
   * 
   * @param {number} index - The index of the item being dragged over
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setDragOverItemIndex(index);
  };

  /**
   * Handles dropping a timezone item to reorder
   */
  const handleDrop = () => {
    if (draggedItemIndex !== null && dragOverItemIndex !== null) {
      // Create a copy of the current timezones
      const updatedTimezones = [...timezones];
      
      // Save the dragged item
      const draggedItem = updatedTimezones[draggedItemIndex];
      
      // Remove the dragged item from its original position
      updatedTimezones.splice(draggedItemIndex, 1);
      
      // Insert the dragged item at the new position
      updatedTimezones.splice(dragOverItemIndex, 0, draggedItem);
      
      // Update state with the new order
      setTimezones(updatedTimezones);
      
      // Save using onUpdate callback to persist
      if (config?.onUpdate) {
        config.onUpdate({
          ...config,
          timezones: updatedTimezones
        });
      }
    }
    
    // Reset drag state
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  /**
   * Handles canceling the drag operation
   */
  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  /**
   * Renders the settings content
   * 
   * @returns {React.ReactElement} Settings content
   */
  const renderSettingsContent = (): React.ReactElement => {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add Timezone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="city-search">Search for a city</Label>
              <div className="relative">
                <Input
                  id="city-search"
                  value={citySearchInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value;
                    setCitySearchInput(value);
                    searchCities(value);
                  }}
                  placeholder="Type a city name..."
                  className="w-full"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin h-4 w-4 border-2 border-gray-500 rounded-full border-t-transparent"></div>
                  </div>
                )}
              </div>
              
              {searchResults.length > 0 && (
                <div className="mt-1 border rounded-md overflow-hidden max-h-60 overflow-y-auto bg-white dark:bg-gray-800">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-0"
                      onClick={() => selectCity(result)}
                    >
                      <div className="font-medium">{result.city}, {result.country}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{result.timezone}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {citySearchInput && searchResults.length === 0 && !isSearching && (
                <div className="text-sm text-gray-500 mt-1 px-1">
                  No cities found. Try a different search term.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {timezones.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Current Timezones</span>
                <div className="text-xs text-gray-500 font-normal">Drag to reorder</div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {timezones.map((tz, index) => (
                <div 
                  key={tz.id} 
                  className={`flex justify-between items-center p-2 rounded-lg border ${
                    draggedItemIndex === index 
                      ? 'bg-gray-100 dark:bg-gray-700 border-blue-300 dark:border-blue-500 opacity-50' 
                      : dragOverItemIndex === index 
                        ? 'bg-gray-50 dark:bg-gray-800 border-blue-200 dark:border-blue-700' 
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  } transition-colors duration-150`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center gap-2 flex-1 overflow-hidden">
                    <div className="cursor-move flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <GripVertical size={16} />
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-medium truncate">{tz.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{tz.timezone}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTimezone(tz.id)}
                    className="text-gray-500 hover:text-red-500 ml-2 shrink-0"
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  /**
   * Renders the settings footer
   * 
   * @returns {React.ReactElement} Settings footer
   */
  const renderSettingsFooter = (): React.ReactElement => {
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
        
        <div className="flex justify-end">
          <Button
            variant="default"
            onClick={() => {
              // Explicitly save current timezone list to ensure persistence
              if (config?.onUpdate) {
                config.onUpdate({
                  ...config,
                  timezones: timezones
                });
              }
              
              setShowSettings(false);
              setCitySearchInput('');
              setSearchResults([]);
            }}
          >
            Save
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div ref={widgetRef} className="widget-container h-full flex flex-col">
      <WidgetHeader 
        title="World Clocks" 
        onSettingsClick={() => setShowSettings(true)}
      />
      
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
      
      {showSettings && (
        <Dialog
          open={showSettings}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setShowSettings(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>World Clocks Settings</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {renderSettingsContent()}
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

export default WorldClocksWidget;

// Export types for use in other files
export * from './types'; 