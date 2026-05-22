import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Trash, GripVertical, Sun, Moon } from 'lucide-react'
import WidgetHeader from '../../widgets/common/WidgetHeader'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../ui/dialog'
import { WorldClocksWidgetProps, TimezoneItem } from './types'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../ui/card'

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
  // ── Size detection ──────────────────────────────────────────────
  const isTiny    = width === 1 && height === 1
  const isShort   = height === 1 && width > 1          // Nx1 ribbon
  const isCompact = !isTiny && !isShort && (width <= 2 || height <= 2)
  const isApp     = width >= 6 && height >= 6           // 6x6+ full dashboard
  const readOnly  = Boolean(config?.readOnly)

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
  // Snapshot of timezones when settings opens – used for cancel/reset
  const [savedTimezones, setSavedTimezones] = useState<TimezoneItem[]>(timezones)
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
   * Formats a date string for a specific timezone (e.g. "Fri, Mar 13")
   */
  const formatDateLine = (date: Date, timezone: string): string => {
    try {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: timezone
      });
    } catch {
      return '';
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
   * Determines whether it is daytime (6am-6pm) in a given timezone
   */
  const isDaytime = (date: Date, timezone: string): boolean => {
    try {
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      const hour = tzDate.getHours();
      return hour >= 6 && hour < 18;
    } catch {
      return true;
    }
  }

  const clampValue = (value: number, min: number, max: number): number => (
    Math.min(max, Math.max(min, value))
  );

  const interpolate = (start: number, end: number, progress: number): number => (
    start + (end - start) * progress
  );

  const getAreaScale = (minArea: number, maxArea: number): number => (
    clampValue((width * height - minArea) / (maxArea - minArea), 0, 1)
  );

  const getCityLabel = (name: string): string => name.split(',')[0].trim();

  const abbreviateWord = (word: string, maxLength: number): string => {
    if (word.length <= maxLength) {
      return word;
    }

    if (maxLength <= 1) {
      return word.slice(0, Math.max(maxLength, 0));
    }

    return `${word.slice(0, maxLength - 1)}.`;
  };

  const getTinyLabelLines = (name: string): string[] => {
    const city = getCityLabel(name);

    if (city.length <= 10) {
      return [city];
    }

    const words = city.split(/\s+/).filter(Boolean);

    if (words.length === 1) {
      return [abbreviateWord(words[0], 9)];
    }

    if (words.length === 2) {
      if (city.length <= 12) {
        return [city];
      }

      return words.map((word) => abbreviateWord(word, 7));
    }

    const firstLine = words
      .slice(0, 2)
      .map((word, index) => (index === 0 ? abbreviateWord(word, 6) : `${word[0]}.`))
      .join(' ');
    const secondLine = words.slice(2).map((word) => `${word[0]}.`).join(' ');

    return [firstLine, secondLine];
  };

  const getTimezoneDisplay = (timezoneItem: TimezoneItem) => {
    const formattedTime = formatTime(currentTime, timezoneItem.timezone);
    const [timeWithSeconds = '12:00:00', period = ''] = formattedTime.split(' ');

    return {
      city: getCityLabel(timezoneItem.name),
      time: timeWithSeconds.split(':').slice(0, 2).join(':'),
      period,
      diff: getTimeDiff(timezoneItem.timezone),
      relativeDate: getRelativeDate(currentTime, timezoneItem.timezone),
      dateLine: formatDateLine(currentTime, timezoneItem.timezone),
    };
  };

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
    const { time, period } = getTimezoneDisplay(mainTimezone);
    const labelLines = getTinyLabelLines(mainTimezone.name);

    return (
      <div className="flex h-full flex-col items-center justify-between px-1 py-0.5 text-center">
        <div
          className="font-semibold text-foreground"
          style={{ fontSize: '1.64rem', lineHeight: 1.06, letterSpacing: '-0.045em' }}
        >
          {time}
        </div>
        <div
          className="flex min-h-[1.35rem] flex-col items-center justify-center text-foreground/90"
          style={{ fontSize: '0.58rem', lineHeight: 1.05 }}
        >
          {labelLines.map((line, index) => (
            <span key={`${mainTimezone.id}-${index}`} className="block max-w-full whitespace-nowrap">
              {line}
            </span>
          ))}
        </div>
        <div
          className="rounded-full bg-muted px-1.5 py-0.5 font-semibold uppercase text-muted-foreground"
          style={{ fontSize: '0.47rem', lineHeight: 1, letterSpacing: '0.16em' }}
        >
          {period || 'LOCAL'}
        </div>
      </div>
    );
  };

  // ── Nx1 Ribbon ──────────────────────────────────────────────────
  /**
   * Renders a horizontal ribbon for Nx1 (height === 1, width > 1) layouts.
   * Shows the primary timezone time prominently, plus 2-3 others as chips.
   */
  const renderRibbonView = (): React.ReactElement => {
    const mainTz = timezones[0] || { id: 0, name: 'Local', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    const mainTime = formatTime(currentTime, mainTz.timezone).split(':').slice(0, 2).join(':');
    const mainPeriod = formatTime(currentTime, mainTz.timezone).split(' ')[1];
    const chipCount = Math.min(timezones.length - 1, Math.max(2, width - 1));
    const chipTimezones = timezones.slice(1, 1 + chipCount);

    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs">
        {/* Primary timezone */}
        <span className="shrink-0 font-semibold text-sm text-foreground">
          {mainTime}
          <span className="ml-0.5 text-[10px] font-normal text-muted-foreground uppercase">{mainPeriod}</span>
        </span>
        <span className="shrink-0 truncate text-[11px] font-medium text-muted-foreground">
          {mainTz.name.split(',')[0]}
        </span>

        {/* Divider */}
        {chipTimezones.length > 0 && (
          <span className="h-4 w-px shrink-0 bg-border" />
        )}

        {/* Other timezone chips */}
        {chipTimezones.map((tz) => {
          const t = formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':');
          const p = formatTime(currentTime, tz.timezone).split(' ')[1];
          const city = tz.name.split(',')[0];
          return (
            <span
              key={tz.id}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-foreground ring-1 ring-border"
            >
              <span className="max-w-[6rem] truncate">{city}</span>
              <span className="font-medium">{t}</span>
              <span className="text-[10px] uppercase text-muted-foreground">{p}</span>
            </span>
          );
        })}
      </div>
    );
  };

  // ── 6x6+ App View ──────────────────────────────────────────────
  /**
   * Renders a full world-clock dashboard for 6x6+ "app" sizes.
   * Each timezone gets a large analog clock, digital time, date line,
   * time difference from local, and a day/night indicator.
   */
  const renderAppView = (): React.ReactElement => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    // Responsive grid: aim for 3-4 columns depending on width
    const cols = width >= 8 ? 4 : 3;

    return (
      <div className="flex h-full flex-col overflow-hidden">
        {/* Title bar for app view */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 widget-drag-handle cursor-move">
          <h2 className="text-base font-semibold text-foreground">World Clocks</h2>
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              Edit
            </Button>
          )}
        </div>

        {/* Clock grid */}
        <div
          className="grid flex-1 gap-4 overflow-y-auto px-4 pb-4"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridAutoRows: 'minmax(180px, auto)',
          }}
        >
          {timezones.map((tz) => {
            const timeStr = formatTime(currentTime, tz.timezone);
            const timeParts = timeStr.split(':').slice(0, 2).join(':');
            const period = timeStr.split(' ')[1];
            const dateLine = formatDateLine(currentTime, tz.timezone);
            const diff = getTimeDiff(tz.timezone);
            const day = isDaytime(currentTime, tz.timezone);
            const DayNightIcon = day ? Sun : Moon;

            return (
              <div
                key={tz.id}
                className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/60 p-4 transition-all duration-300"
              >
                {/* City name */}
                <div className="mb-2 text-sm font-semibold text-foreground truncate w-full text-center">
                  {tz.name}
                </div>

                {/* Analog clock */}
                <div className="mb-2">
                  {renderClock(tz.timezone, 100, isDarkMode)}
                </div>

                {/* Digital time */}
                <div className="text-2xl font-light tracking-tighter leading-none">
                  {timeParts}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">{period}</span>
                </div>

                {/* Date line */}
                <div className="mt-1.5 text-xs text-muted-foreground tracking-wide">
                  {dateLine}
                </div>

                {/* Day/night + time diff */}
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <DayNightIcon className="h-3.5 w-3.5" />
                  <span>{day ? 'Day' : 'Night'}</span>
                  <span className="h-3 w-px bg-border" />
                  <span>{diff}</span>
                </div>
              </div>
            );
          })}
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
        <div className="flex h-full flex-col gap-2.5 p-2.5 transition-all duration-300">
          {timezones.map(tz => {
            const display = getTimezoneDisplay(tz);

            return (
              <div
                key={tz.id}
                className="flex min-h-0 flex-1 items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/35 px-2.5 py-2 transition-all duration-300"
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate font-semibold text-foreground"
                    style={{ fontSize: '0.78rem', lineHeight: 1.15 }}
                  >
                    {display.city}
                  </div>
                  <div
                    className="mt-1 text-muted-foreground"
                    style={{ fontSize: '0.68rem', lineHeight: 1.1 }}
                  >
                    {display.diff}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className="font-light text-foreground"
                    style={{ fontSize: '1.45rem', lineHeight: 1, letterSpacing: '-0.05em' }}
                  >
                    {display.time}
                  </div>
                  <div
                    className="mt-1 uppercase text-muted-foreground"
                    style={{ fontSize: '0.6rem', lineHeight: 1.1, letterSpacing: '0.14em' }}
                  >
                    {display.period}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // For 3+ timezones, use a more compact list view with scrolling
    return (
      <div className="flex h-full flex-col gap-1.5 overflow-y-auto p-2.5 transition-all duration-300">
        {timezones.map(tz => {
          const display = getTimezoneDisplay(tz);

          return (
            <div
              key={tz.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/30 px-2 py-1.5 transition-all duration-300"
            >
              <div className="min-w-0 flex-1">
                <div
                  className="truncate font-medium text-foreground"
                  style={{ fontSize: '0.72rem', lineHeight: 1.15 }}
                >
                  {display.city}
                </div>
                <div
                  className="mt-0.5 text-muted-foreground"
                  style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                >
                  {display.diff}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div
                  className="font-light text-foreground"
                  style={{ fontSize: '1.05rem', lineHeight: 1, letterSpacing: '-0.045em' }}
                >
                  {display.time}
                </div>
                <div
                  className="uppercase text-muted-foreground"
                  style={{ fontSize: '0.55rem', lineHeight: 1.1, letterSpacing: '0.12em' }}
                >
                  {display.period}
                </div>
              </div>
            </div>
          );
        })}
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
      <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 overflow-y-auto p-2" style={{ gap: '0.55rem' }}>
        {timezones.map(tz => {
          const display = getTimezoneDisplay(tz);

          return (
            <div
              key={tz.id}
              className="flex min-h-0 flex-col items-center justify-between overflow-hidden rounded-xl border border-border/60 bg-muted/35 px-2 py-2 text-center"
            >
              <div
                className="min-h-[1.7rem] w-full px-1 font-semibold text-foreground"
                style={{ fontSize: '0.72rem', lineHeight: 1.1 }}
              >
                {display.city}
              </div>
              <div
                className="mt-1 font-light text-foreground"
                style={{ fontSize: '1.15rem', lineHeight: 1, letterSpacing: '-0.05em' }}
              >
                {display.time}
              </div>
              <div
                className="mt-1 flex items-center justify-center gap-1 text-muted-foreground"
                style={{ fontSize: '0.56rem', lineHeight: 1.1, letterSpacing: '0.08em' }}
              >
                <span>{display.diff}</span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span className="uppercase">{display.period}</span>
              </div>
            </div>
          );
        })}
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
              <div className="text-xs font-medium tracking-tight text-foreground mb-1 truncate w-full text-center">
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
              <div className="text-xs font-medium tracking-tight text-foreground truncate w-full text-center mt-0.5">
                {tz.name}
              </div>
              <div className="text-xs text-muted-foreground tracking-wide">
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
            <div className="text-xs font-medium tracking-tight text-foreground truncate w-full text-center mt-0.5">
              {tz.name}
            </div>
            <div className="text-xs text-muted-foreground tracking-wide">
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
    const layoutScale = getAreaScale(6, 16);
    const clockSize = Math.round(interpolate(46, 64, layoutScale));
    const gap = `${interpolate(0.625, 0.95, layoutScale)}rem`;
    const cardPadding = `${interpolate(0.65, 0.95, layoutScale)}rem`;
    const titleSize = `${interpolate(0.76, 0.94, layoutScale)}rem`;
    const timeSize = `${interpolate(1.05, 1.55, layoutScale)}rem`;
    const metaSize = `${interpolate(0.58, 0.76, layoutScale)}rem`;

    // For 1-4 timezones, show larger clocks with more details
    if (timezones.length <= 4) {
      const rows = Math.ceil(timezones.length / 2);

      return (
        <div
          className="grid h-full min-h-0 grid-cols-2 transition-all duration-300"
          style={{ gap, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
        >
          {timezones.map(tz => {
            const display = getTimezoneDisplay(tz);

            return (
              <div
                key={tz.id}
                className="flex min-h-0 flex-col items-center justify-between overflow-hidden rounded-2xl border border-border/60 bg-muted/35 text-center transition-all duration-300"
                style={{ padding: cardPadding }}
              >
                <div
                  className="min-h-[1.6rem] w-full px-1 font-semibold text-foreground"
                  style={{ fontSize: titleSize, lineHeight: 1.12 }}
                >
                  {display.city}
                </div>
                <div className="my-1 flex grow items-center justify-center">
                  {renderClock(tz.timezone, clockSize, isDarkMode)}
                </div>
                <div
                  className="font-light text-foreground"
                  style={{ fontSize: timeSize, lineHeight: 1, letterSpacing: '-0.05em' }}
                >
                  {display.time}
                </div>
                <div
                  className="mt-1 flex items-center justify-center gap-1 text-muted-foreground"
                  style={{ fontSize: metaSize, lineHeight: 1.1 }}
                >
                  <span>{display.diff}</span>
                  <span className="h-1 w-1 rounded-full bg-border" />
                  <span className="uppercase" style={{ letterSpacing: '0.14em' }}>
                    {display.period}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // For 5+ timezones, use a compact layout with smaller clocks
    return (
      <div className="grid h-full grid-cols-2 auto-rows-min overflow-y-auto transition-all duration-300" style={{ gap: '0.55rem' }}>
        {timezones.map(tz => {
          const display = getTimezoneDisplay(tz);

          return (
            <div
              key={tz.id}
              className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-2 py-1.5 transition-all duration-300"
            >
              <div className="shrink-0">
                {renderClock(tz.timezone, 32, isDarkMode)}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate font-semibold text-foreground"
                  style={{ fontSize: '0.72rem', lineHeight: 1.15 }}
                >
                  {display.city}
                </div>
                <div
                  className="font-light text-foreground"
                  style={{ fontSize: '0.95rem', lineHeight: 1.05, letterSpacing: '-0.04em' }}
                >
                  {display.time}
                  <span
                    className="ml-1 uppercase text-muted-foreground"
                    style={{ fontSize: '0.55rem', lineHeight: 1, letterSpacing: '0.12em' }}
                  >
                    {display.period}
                  </span>
                </div>
                <div
                  className="mt-0.5 text-muted-foreground"
                  style={{ fontSize: '0.6rem', lineHeight: 1.1 }}
                >
                  {display.diff}
                </div>
              </div>
            </div>
          );
        })}
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
    const layoutScale = getAreaScale(16, 25);
    const columns = timezones.length <= 4 ? 2 : 3;
    const rows = Math.ceil(timezones.length / columns);
    const clockSize = Math.round(interpolate(72, 84, layoutScale));
    const gap = `${interpolate(0.8, 1.1, layoutScale)}rem`;
    const cardPadding = `${interpolate(0.95, 1.2, layoutScale)}rem`;
    const titleSize = `${interpolate(0.94, 1.08, layoutScale)}rem`;
    const timeSize = interpolate(1.7, 2.05, layoutScale);
    const metaSize = `${interpolate(0.68, 0.8, layoutScale)}rem`;

    return (
      <div
        className="grid h-full min-h-0 overflow-y-auto transition-all duration-300"
        style={{
          gap,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: timezones.length <= 6 ? `repeat(${rows}, minmax(0, 1fr))` : undefined,
        }}
      >
        {timezones.map(tz => {
          const display = getTimezoneDisplay(tz);

          return (
            <div
              key={tz.id}
              className="flex min-h-0 flex-col items-center justify-between overflow-hidden rounded-2xl border border-border/60 bg-muted/35 text-center transition-all duration-300"
              style={{ padding: cardPadding }}
            >
              <div
                className="min-h-[1.8rem] w-full px-1 font-semibold text-foreground"
                style={{ fontSize: titleSize, lineHeight: 1.15 }}
              >
                {display.city}
              </div>
              <div className="my-2">
                {renderClock(tz.timezone, clockSize, isDarkMode)}
              </div>
              <div
                className="font-light text-foreground"
                style={{ fontSize: `${timeSize}rem`, lineHeight: 1, letterSpacing: '-0.055em' }}
              >
                {display.time}
                <span
                  className="ml-1 font-medium uppercase text-muted-foreground"
                  style={{ fontSize: `${Math.max(0.78, timeSize * 0.42)}rem`, letterSpacing: '0.14em' }}
                >
                  {display.period}
                </span>
              </div>
              <div
                className="mt-1 text-muted-foreground"
                style={{ fontSize: metaSize, lineHeight: 1.15, letterSpacing: '0.05em' }}
              >
                {display.relativeDate}
              </div>
              <div className="text-muted-foreground" style={{ fontSize: metaSize, lineHeight: 1.15 }}>
                {display.diff}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * Renders the extra-wide view optimized for 6x2 or wider layouts
   *
   * @returns {React.ReactElement} Extra-wide view optimized for 6x2 or wider layouts
   */
  const renderExtraWideView = (): React.ReactElement => {
    const isDarkMode = document.documentElement.classList.contains('dark');

    // For 1-6 timezones, show in a single row with larger analog clocks
    if (timezones.length <= 6) {
      return (
        <div className="grid grid-cols-6 gap-3 h-full transition-all duration-300">
          {timezones.map(tz => (
            <div key={tz.id} className="flex flex-col items-center justify-center h-full transition-all duration-300">
              <div className="text-sm font-medium tracking-tight text-foreground mb-1 truncate w-full text-center">
                {tz.name}
              </div>
              <div className="relative mb-1">
                {renderClock(tz.timezone, 46, isDarkMode)}
              </div>
              <div className="font-light text-xl tracking-tighter leading-none">
                {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
                <span className="text-xs ml-1 text-muted-foreground font-normal tracking-normal">
                  {formatTime(currentTime, tz.timezone).split(' ')[1]}
                </span>
              </div>
              <div className="text-xs text-muted-foreground tracking-wide mt-0.5">
                {getTimeDiff(tz.timezone)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // For 7-12 timezones, use a 6x2 grid layout
    if (timezones.length <= 12) {
      return (
        <div className="grid grid-cols-6 grid-rows-2 gap-x-3 gap-y-1 h-full transition-all duration-300">
          {timezones.slice(0, 12).map(tz => (
            <div key={tz.id} className="flex flex-col items-center justify-center h-full transition-all duration-300">
              <div className="font-light text-lg tracking-tighter leading-none">
                {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
              </div>
              <div className="text-xs font-medium tracking-tight text-foreground truncate w-full text-center mt-0.5">
                {tz.name}
              </div>
              <div className="text-xs text-muted-foreground tracking-wide">
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
            <div className="text-xs font-medium tracking-tight text-foreground truncate w-full text-center mt-0.5">
              {tz.name}
            </div>
            <div className="text-xs text-muted-foreground tracking-wide">
              {getTimeDiff(tz.timezone)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Renders the tall-wide view optimized for 2x3 or 2x4 grid sizes
   *
   * @returns {React.ReactElement} Tall-wide view optimized for 2x3 or 2x4 grid sizes
   */
  const renderTallWideView = (): React.ReactElement => {
    const isDarkMode = document.documentElement.classList.contains('dark');

    return (
      <div className="grid grid-cols-2 gap-4 h-full transition-all duration-300">
        {timezones.map(tz => (
          <div key={tz.id} className="flex flex-col items-center justify-center h-full transition-all duration-300">
            <div className="text-sm font-medium tracking-tight text-foreground mb-1 truncate w-full text-center">
              {tz.name}
            </div>
            <div className="relative mb-1">
              {renderClock(tz.timezone, 70, isDarkMode)}
            </div>
            <div className="font-light text-2xl tracking-tighter leading-none mt-1">
              {formatTime(currentTime, tz.timezone).split(':').slice(0, 2).join(':')}
            </div>
            <div className="flex items-center justify-center space-x-2 mt-1">
              <div className="text-xs text-muted-foreground tracking-wide">
                {getTimeDiff(tz.timezone)}
              </div>
              <div className="w-1 h-1 bg-border rounded-full"></div>
              <div className="text-xs text-muted-foreground leading-none tracking-wide">
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
          <p className="text-sm text-muted-foreground mb-2">No timezones added</p>
          {!readOnly && (
            <Button
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              Add Timezone
            </Button>
          )}
        </div>
      );
    }

    // 1x1 tiny icon
    if (isTiny) {
      return renderCompactView();
    }

    // Nx1 ribbon
    if (isShort) {
      return renderRibbonView();
    }

    // 6x6+ app dashboard
    if (isApp) {
      return renderAppView();
    }

    // ── Existing size routing (unchanged) ─────────────────────────

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

  // ── Settings modal helpers ──────────────────────────────────────

  /** Reset draft state back to the persisted snapshot */
  const resetSettingsDraft = useCallback(() => {
    setTimezones(savedTimezones);
    setCitySearchInput('');
    setSearchResults([]);
  }, [savedTimezones]);

  /** Called when the Dialog open state changes */
  const handleSettingsOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      // Snapshot current timezones when opening
      setSavedTimezones(timezones);
    } else {
      // Closing without save => revert
      resetSettingsDraft();
    }
    setShowSettings(nextOpen);
  }, [timezones, resetSettingsDraft]);

  /** Cancel button handler */
  const handleCancelSettings = useCallback(() => {
    resetSettingsDraft();
    setShowSettings(false);
  }, [resetSettingsDraft]);

  /** Save button handler */
  const saveSettings = useCallback(() => {
    if (config?.onUpdate) {
      config.onUpdate({
        ...config,
        timezones: timezones
      });
    }
    setSavedTimezones(timezones);
    setShowSettings(false);
    setCitySearchInput('');
    setSearchResults([]);
  }, [config, timezones]);

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
                <div className="mt-1 border rounded-md overflow-hidden max-h-60 overflow-y-auto bg-card">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 hover:bg-accent cursor-pointer border-b border-border last:border-0"
                      onClick={() => selectCity(result)}
                    >
                      <div className="font-medium">{result.city}, {result.country}</div>
                      <div className="text-xs text-muted-foreground">{result.timezone}</div>
                    </div>
                  ))}
                </div>
              )}

              {citySearchInput && searchResults.length === 0 && !isSearching && (
                <div className="text-sm text-muted-foreground mt-1 px-1">
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
                <div className="text-xs text-muted-foreground font-normal">Drag to reorder</div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {timezones.map((tz, index) => (
                <div
                  key={tz.id}
                  className={`flex justify-between items-center p-2 rounded-lg border ${
                    draggedItemIndex === index
                      ? 'bg-muted border-primary opacity-50'
                      : dragOverItemIndex === index
                        ? 'bg-muted border-primary/50'
                        : 'bg-muted border-border'
                  } transition-colors duration-150`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center gap-2 flex-1 overflow-hidden">
                    <div className="cursor-move flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <GripVertical size={16} />
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-medium truncate">{tz.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{tz.timezone}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTimezone(tz.id)}
                    className="text-muted-foreground hover:text-destructive ml-2 shrink-0"
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
   * Renders the settings dialog
   */
  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="gap-2 px-6 pt-6">
          <DialogTitle>World Clocks Settings</DialogTitle>
          <DialogDescription>
            Add, remove, and reorder the timezones displayed by this widget.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-6 py-4">
          {renderSettingsContent()}
        </div>

        <DialogFooter className="flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
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
                Delete Widget
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancelSettings}>
              Cancel
            </Button>
            <Button variant="default" onClick={saveSettings}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Main return ─────────────────────────────────────────────────
  const suppressHeader = isTiny || isApp;

  return (
    <div ref={widgetRef} className={`widget-container h-full flex flex-col ${isTiny ? 'widget-drag-handle p-2.5' : ''}`}>
      {!suppressHeader && (
        <WidgetHeader
          title="World Clocks"
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isCompact || isShort}
        />
      )}

      <div className={`flex-1 overflow-hidden ${isTiny ? 'p-1' : ''}`}>
        {renderContent()}
      </div>

      {!readOnly && renderSettings()}
    </div>
  );
};

export default WorldClocksWidget;

// Export types for use in other files
export * from './types';
