import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useVisibilityRefresh } from '../../../lib/useVisibilityRefresh'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, MapPin } from 'lucide-react'
import { encryptionUtils } from '@/lib/encryption'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select"
import { WidgetSettingsDialog, WidgetSettingsDialogFooter } from '../../widgets/common/WidgetSettingsDialog'
import { WidgetShell } from '../../widgets/common/WidgetShell'
import { CalendarWidgetProps, CalendarWidgetConfig, CalendarEvent, CalendarSource } from './types'
import { Button } from '../../ui/button'
import { Label } from '../../ui/label'
import { Checkbox } from '../../ui/checkbox';

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  description?: string;
}

interface GoogleCalendarSource {
  id: string;
  summary: string;
  backgroundColor?: string;
  primary?: boolean;
}

/**
 * Calendar Widget Component
 * 
 * Displays a calendar with different views based on the widget size:
 * - 2x2 (minimum): Shows current date with day of week and minimal event count
 * - 2x3: Shows day, date, and today's events in a list view
 * - 3x2: Shows a compact month calendar with minimal event details
 * - 3x3 or larger: Shows a full calendar with week numbers and detailed daily events
 * - 4x4 or larger: Shows an expanded view with month calendar and weekly agenda
 * 
 * The widget supports configuration through a settings modal:
 * - First day of week (Sunday/Monday)
 * - Show/hide week numbers
 * - Connect to Google Calendar
 * 
 * @component
 * @param {CalendarWidgetProps} props - Component props
 * @returns Calendar widget component
 */
const CalendarWidget: React.FC<CalendarWidgetProps> = ({ width = 2, height = 2, config }) => {
  // --- Size detection (icon → widget → app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [date, setDate] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>(config?.viewMode || 'month')
  
  // Initialize from props - single source of truth
  const [localConfig, setLocalConfig] = useState<CalendarWidgetConfig>(
    config || { id: '' }
  );

  // Sync config prop changes to localConfig
  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  /**
   * Helper function to update config and notify parent
   * This ensures the parent component always knows about config changes
   */
  const updateConfig = React.useCallback((newConfig: CalendarWidgetConfig | ((prev: CalendarWidgetConfig) => CalendarWidgetConfig)) => {
    setLocalConfig(prevConfig => {
      const updatedConfig = typeof newConfig === 'function' ? newConfig(prevConfig) : newConfig;

      // Notify parent component of the change
      if (config?.onUpdate) {
        config.onUpdate(updatedConfig);
      }

      return updatedConfig;
    });
  }, [config]);

  // Helper function to format time ranges more compactly
  const formatTimeRange = (timeRange?: string): React.ReactNode => {
    if (!timeRange?.includes(' - ')) return timeRange || 'All day';
    
    const [startWithPeriod, endWithPeriod] = timeRange.split(' - ');
    
    // Extract time and period (AM/PM)
    const startMatch = startWithPeriod.match(/(.+) (AM|PM)/);
    const endMatch = endWithPeriod.match(/(.+) (AM|PM)/);
    
    if (startMatch && endMatch) {
      const [, startTime, startPeriod] = startMatch;
      const [, endTime, endPeriod] = endMatch;
      
      // If same period (both AM or both PM), combine them
      if (startPeriod === endPeriod) {
        return <>{startTime}-{endTime} {startPeriod}</>;
      }
      
      // Different periods, show compact format
      return <>{startTime}{startPeriod}-{endTime}{endPeriod}</>;
    }
    
    // Fallback to original format
    return <>{startWithPeriod}-{endWithPeriod}</>;
  };
  
  const widgetRef = useRef<HTMLDivElement | null>(null)
  const oauthProcessingRef = useRef(false)
  const weekSidebarRef = useRef<HTMLDivElement | null>(null)
  
  // Simplified settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(false)
  
  // Google OAuth configuration
  const GOOGLE_CLIENT_ID = React.useMemo(() => 
    import.meta.env.VITE_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID'
  , []);
  
  const GOOGLE_REDIRECT_URI = React.useMemo(() => 
    typeof window !== 'undefined' ? window.location.href.split('?')[0] : ''
  , []);
  
  const GOOGLE_SCOPES = React.useMemo(() => [
    'https://www.googleapis.com/auth/calendar',
    // or keep both of these if you prefer more restricted access:
    // 'https://www.googleapis.com/auth/calendar.readonly',
    // 'https://www.googleapis.com/auth/calendar.events.readonly'
  ], []);

  // Cloud Function URLs for secure OAuth token handling
  const OAUTH_EXCHANGE_URL = import.meta.env.VITE_PUBLIC_OAUTH_EXCHANGE_URL || '';
  const OAUTH_REFRESH_URL = import.meta.env.VITE_PUBLIC_OAUTH_REFRESH_URL || '';
  
  /**
   * Generates a random state string for OAuth security
   */
  const generateStateParam = () => {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  };

  /**
   * Get widget-specific token keys and migrate old tokens if needed
   */
  const getTokenKeys = React.useCallback(() => {
    // Safely handle cases where localConfig might not be fully initialized
    const widgetId = localConfig?.id || 'default';
    const keys = {
      accessTokenKey: `googleAccessToken-${widgetId}`,
      refreshTokenKey: `googleRefreshToken-${widgetId}`,
      tokenExpiryKey: `googleTokenExpiry-${widgetId}`
    };

    // Migration: Check if tokens exist with old 'default' key and migrate them
    if (widgetId !== 'default') {
      const oldAccessToken = localStorage.getItem('googleAccessToken-default');
      const newAccessToken = localStorage.getItem(keys.accessTokenKey);

      // If we have old tokens but no new ones, migrate them
      if (oldAccessToken && !newAccessToken) {
        const oldRefreshToken = localStorage.getItem('googleRefreshToken-default');
        const oldExpiry = localStorage.getItem('googleTokenExpiry-default');

        // Copy to new keys
        localStorage.setItem(keys.accessTokenKey, oldAccessToken);
        if (oldRefreshToken) localStorage.setItem(keys.refreshTokenKey, oldRefreshToken);
        if (oldExpiry) localStorage.setItem(keys.tokenExpiryKey, oldExpiry);

        // Remove old keys
        localStorage.removeItem('googleAccessToken-default');
        localStorage.removeItem('googleRefreshToken-default');
        localStorage.removeItem('googleTokenExpiry-default');

        console.log('Migrated Google Calendar tokens to widget-specific keys');
      }
    }

    return keys;
  }, [localConfig?.id]);

  /**
   * Disconnects from Google Calendar
   */
  const disconnectGoogleCalendar = React.useCallback(() => {
    // Revoke access token if available
    const { accessTokenKey, refreshTokenKey, tokenExpiryKey } = getTokenKeys();
    const accessToken = localStorage.getItem(accessTokenKey);
    if (accessToken) {
      // Revoke the token
      fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }).catch(err => console.error('Error revoking token', err));
    }
    
    // Clear stored tokens
    localStorage.removeItem(accessTokenKey);
    localStorage.removeItem(refreshTokenKey);
    localStorage.removeItem(tokenExpiryKey);
    localStorage.removeItem('googleOAuthState');
    
    // Update state
    setIsGoogleConnected(false);
    updateConfig({
      ...localConfig,
      googleCalendarConnected: false,
      calendars: []
    });
    setEvents([]);
  }, [localConfig, getTokenKeys, updateConfig])
  
  /**
   * Refreshes the access token when it expires
   * Uses Cloud Function to securely handle the refresh without exposing client secret
   * Decrypts refresh token from storage and encrypts new access token before storing
   */
  const refreshAccessToken = React.useCallback(async () => {
    try {
      const { refreshTokenKey, accessTokenKey, tokenExpiryKey } = getTokenKeys();
      const encryptedRefreshToken = localStorage.getItem(refreshTokenKey);

      if (!encryptedRefreshToken) {
        throw new Error('No refresh token available');
      }

      if (!OAUTH_REFRESH_URL) {
        throw new Error('OAuth refresh URL not configured');
      }

      // Decrypt the refresh token before sending to Cloud Function
      const refreshToken = await encryptionUtils.decrypt(encryptedRefreshToken);

      const response = await fetch(OAUTH_REFRESH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData = await response.json();

      // Encrypt new access token before storing
      const encryptedAccessToken = await encryptionUtils.encrypt(tokenData.access_token);
      localStorage.setItem(accessTokenKey, encryptedAccessToken);
      localStorage.setItem(tokenExpiryKey, (Date.now() + tokenData.expires_in * 1000).toString());

      return tokenData.access_token;
    } catch (err) {
      console.error('Failed to refresh token', err);
      toast.error('Google Calendar disconnected', {
        description: 'Your session expired. Please reconnect your calendar.',
        duration: 5000,
      });
      // If refresh fails, disconnect from Google Calendar
      disconnectGoogleCalendar();
      throw err;
    }
  }, [getTokenKeys, OAUTH_REFRESH_URL, disconnectGoogleCalendar]);
  
  /**
   * Gets a valid access token, refreshing if necessary
   * Decrypts the token from localStorage before returning
   */
  const getValidAccessToken = React.useCallback(async () => {
    const { accessTokenKey, tokenExpiryKey } = getTokenKeys();
    const encryptedAccessToken = localStorage.getItem(accessTokenKey);
    const tokenExpiry = localStorage.getItem(tokenExpiryKey);

    if (!encryptedAccessToken || !tokenExpiry) {
      return null;
    }

    // Check if token is expired or about to expire (within 5 minutes)
    if (Date.now() > parseInt(tokenExpiry) - 300000) {
      return refreshAccessToken();
    }

    // Decrypt the access token before returning
    try {
      return await encryptionUtils.decrypt(encryptedAccessToken);
    } catch (err) {
      console.error('Failed to decrypt access token:', err);
      // This usually happens when the encryption key changed (login/logout)
      toast.error('Calendar token expired', {
        description: 'Please reconnect your Google Calendar.',
        duration: 5000,
      });
      disconnectGoogleCalendar();
      return null;
    }
  }, [getTokenKeys, refreshAccessToken, disconnectGoogleCalendar]);
  
  /**
   * Fetches events from Google Calendar
   */
  const fetchEvents = React.useCallback(async (silentMode = false) => {
    if (!isGoogleConnected) {
      return;
    }
    
    
    try {
      setIsLoading(true);
      
      // Get a valid access token
      const accessToken = await getValidAccessToken();
      
      if (!accessToken) {
        throw new Error('No valid access token available');
      }
      
      // Get selected calendars
      const selectedCalendars = localConfig.calendars?.filter(cal => cal.selected) || [];
      
      
      if (selectedCalendars.length === 0) {
        setEvents([]);
        setIsLoading(false);
        return;
      }
      
      // Calculate time range (30 days in the past to 30 days in the future)
      const now = new Date();
      const timeMin = new Date(now);
      timeMin.setDate(timeMin.getDate() - 30); // Go back 30 days
      timeMin.setHours(0, 0, 0, 0);
      
      const timeMax = new Date(now);
      timeMax.setDate(timeMax.getDate() + 30); // Go forward 30 days
      timeMax.setHours(23, 59, 59, 999);
      
      // Fetch events from all selected calendars
      const allEvents: CalendarEvent[] = [];
      
      for (const calendar of selectedCalendars) {
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?` +
          new URLSearchParams({
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '100'
          }),
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        
        if (!response.ok) {
          console.error(`Failed to fetch events for calendar ${calendar.id}: ${response.statusText}`);
          continue;
        }
        
        const data = await response.json();
        
        // Convert Google Calendar events to our format
        const calendarEvents = data.items.map((event: GoogleCalendarEvent) => {
          // Ensure we have valid date strings before creating Date objects
          const startDateTime = event.start.dateTime || event.start.date;
          const endDateTime = event.end.dateTime || event.end.date;
          
          if (!startDateTime || !endDateTime) {
            console.error('Invalid event dates:', event);
            return null;
          }
          
          const start = new Date(startDateTime);
          const end = new Date(endDateTime);
          const isAllDay = !event.start.dateTime;
          
          // Format time string
          let timeString = '';
          if (isAllDay) {
            timeString = 'All day';
          } else {
            timeString = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            
            // Add end time if on same day
            if (start.toDateString() === end.toDateString()) {
              timeString += ' - ' + end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            }
          }
          
          return {
            id: event.id,
            title: event.summary || 'Untitled Event',
            start,
            end,
            allDay: isAllDay,
            location: event.location || '',
            description: event.description || '',
            color: calendar.color,
            time: timeString
          };
        }).filter((event: CalendarEvent | null): event is CalendarEvent => event !== null);
        
        allEvents.push(...calendarEvents);
      }
      
      // Sort events by start time
      allEvents.sort((a, b) => {
        if (a.start && b.start) {
          return new Date(a.start).getTime() - new Date(b.start).getTime();
        }
        return 0;
      });
      
      setEvents(allEvents);
      setIsLoading(false);
    } catch (err) {
      if (!silentMode) console.error('Failed to fetch events', err);
      setIsLoading(false);
    }
  }, [isGoogleConnected, localConfig.calendars, getValidAccessToken])
  
  /**
   * Fetches the user's calendars from Google Calendar API
   */
  const fetchCalendars = async (accessToken: string) => {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch calendars: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Make sure at least one calendar is selected by default
    const calendars = data.items.map((calendar: GoogleCalendarSource) => ({
      id: calendar.id,
      name: calendar.summary,
      color: calendar.backgroundColor || '#4285F4',
      selected: calendar.primary || false,
    }));
    
    // If no calendars are selected, select the first one
    if (calendars.length > 0 && !calendars.some((cal: CalendarSource) => cal.selected)) {
      calendars[0].selected = true;
    }
    
    return calendars;
  };
  
  /**
   * Handles Google Calendar OAuth authentication
   */
  const connectGoogleCalendar = React.useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Generate and store state parameter to prevent CSRF attacks
      const state = generateStateParam();
      localStorage.setItem('googleOAuthState', state);
      
      // Build the authorization URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.append('redirect_uri', GOOGLE_REDIRECT_URI);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('scope', GOOGLE_SCOPES.join(' '));
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent');
      
      // Redirect to Google's authorization page
      window.location.href = authUrl.toString();
      
    } catch (err) {
      console.error('Failed to connect to Google Calendar', err);
      setIsLoading(false);
    }
  }, [GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, GOOGLE_SCOPES]);
  
  /**
   * Handles the OAuth callback and exchanges the code for tokens
   * Uses Cloud Function to securely exchange the authorization code without exposing client secret
   */
  const handleOAuthCallback = React.useCallback(async (code: string, state: string) => {
    try {
      // Verify state parameter to prevent CSRF attacks
      const storedState = localStorage.getItem('googleOAuthState');
      if (state !== storedState) {
        throw new Error('Invalid state parameter');
      }

      // Clear the stored state
      localStorage.removeItem('googleOAuthState');

      if (!OAUTH_EXCHANGE_URL) {
        throw new Error('OAuth exchange URL not configured');
      }

      // Exchange the code for tokens via Cloud Function
      const tokenResponse = await fetch(OAUTH_EXCHANGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          redirectUri: GOOGLE_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokenData = await tokenResponse.json();

      // Store tokens in widget-specific storage with encryption
      const widgetTokenKey = `googleAccessToken-${localConfig.id || 'default'}`;
      const widgetRefreshTokenKey = `googleRefreshToken-${localConfig.id || 'default'}`;
      const widgetTokenExpiryKey = `googleTokenExpiry-${localConfig.id || 'default'}`;

      // Encrypt tokens before storing in localStorage
      const encryptedAccessToken = await encryptionUtils.encrypt(tokenData.access_token);
      const encryptedRefreshToken = await encryptionUtils.encrypt(tokenData.refresh_token);

      localStorage.setItem(widgetTokenKey, encryptedAccessToken);
      localStorage.setItem(widgetRefreshTokenKey, encryptedRefreshToken);
      localStorage.setItem(widgetTokenExpiryKey, (Date.now() + tokenData.expires_in * 1000).toString());

      // Fetch user's calendars
      const calendars = await fetchCalendars(tokenData.access_token);

      setIsGoogleConnected(true);
      // Ensure we have at least one calendar selected
      if (calendars.length > 0 && !calendars.some((cal: CalendarSource) => cal.selected)) {
        calendars[0].selected = true;
      }

      updateConfig({
        ...localConfig,
        googleCalendarConnected: true,
        calendars: calendars,
      });

      // Fetch initial events
      fetchEvents();

      setIsLoading(false);
    } catch (err) {
      console.error('Failed to handle OAuth callback', err);
      toast.error('Failed to connect Google Calendar', {
        description: 'Please try connecting again.',
        duration: 5000,
      });
      setIsLoading(false);
    }
  }, [localConfig, fetchEvents, updateConfig, OAUTH_EXCHANGE_URL, GOOGLE_REDIRECT_URI]);
  
  // Check for OAuth callback - params are stored in sessionStorage by App.tsx
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Prevent duplicate processing (React StrictMode runs effects twice)
    if (oauthProcessingRef.current) return;

    // Check for OAuth callback parameters stored by App.tsx
    const code = sessionStorage.getItem('googleOAuthCode');
    const state = sessionStorage.getItem('googleOAuthState');

    if (code && state) {
      // Mark as processing to prevent race conditions
      oauthProcessingRef.current = true;

      // Clear sessionStorage immediately to prevent re-processing
      sessionStorage.removeItem('googleOAuthCode');
      sessionStorage.removeItem('googleOAuthState');

      // Process the OAuth callback with timeout protection
      setIsLoading(true);

      // Set a timeout to prevent infinite loading state
      const timeoutId = setTimeout(() => {
        if (oauthProcessingRef.current) {
          oauthProcessingRef.current = false;
          setIsLoading(false);
          toast.error('Connection timed out', {
            description: 'Please try connecting again.',
            duration: 5000,
          });
        }
      }, 30000); // 30 second timeout

      handleOAuthCallback(code, state).finally(() => {
        clearTimeout(timeoutId);
        oauthProcessingRef.current = false;
      });
    }
  }, [handleOAuthCallback]);
  
  // Ref to track initial run state to avoid excessive logging and token checks
  const isInitialRun = useRef(true);

  // Update the initialization code to check both localStorage and configuration
  useEffect(() => {
    // Don't run the check until the component is fully initialized
    if (!localConfig) {
      return;
    }
    
    const checkTokens = async () => {
      try {
        const { accessTokenKey, refreshTokenKey } = getTokenKeys();
        const accessToken = localStorage.getItem(accessTokenKey);
        const refreshToken = localStorage.getItem(refreshTokenKey);

        // Check stored config for Google Calendar connection status
        const isConnectedInConfig = localConfig.googleCalendarConnected === true;
        
        if (accessToken && refreshToken) {
          try {
            // Validate the token (silently after first run)
            
            await getValidAccessToken();
            
            
            setIsGoogleConnected(true);
            
            // If we have tokens but the config doesn't reflect it, make sure to update the config
            if (!isConnectedInConfig && localConfig.calendars?.length === 0) {
              // We need to fetch calendars since we have valid tokens but no calendars in config
              const validToken = await getValidAccessToken();
              if (validToken) {
                try {
                  const calendars = await fetchCalendars(validToken);
                  updateConfig(prevConfig => ({
                    ...prevConfig,
                    googleCalendarConnected: true,
                    calendars: calendars
                  }));
                } catch (e) {
                  console.error('Failed to fetch calendars during initialization', e);
                }
              }
            }
            
            // Only fetch events on initial run or if explicitly needed
            if (isInitialRun.current) {
              // Use silent mode to reduce console noise
              fetchEvents(true);
            }
          } catch (err) {
            console.error('Failed to validate tokens', err);
            toast.error('Google Calendar disconnected', {
              description: 'Failed to verify your calendar connection.',
              duration: 5000,
            });
            disconnectGoogleCalendar();
          }
        } else if (isConnectedInConfig) {
          // Config says connected but no tokens found
          setIsGoogleConnected(false);
          updateConfig(prevConfig => ({
            ...prevConfig,
            googleCalendarConnected: false
          }));
        }
      } catch (err) {
        console.error('Error checking tokens:', err);
      }
      
      // Mark initialization as complete
      isInitialRun.current = false;
    };
    
    checkTokens();
    
    // Return cleanup function
    return () => {
      isInitialRun.current = false;
    };
  }, [localConfig?.id, getTokenKeys, getValidAccessToken, fetchCalendars, disconnectGoogleCalendar]); // Include necessary dependencies, but not ones that change frequently
  
  // Update date every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setDate(new Date())
    }, 60000)
    
    return () => clearInterval(timer)
  }, [])
  
  // Initial fetch when connection state changes
  useEffect(() => {
    if (!isGoogleConnected) return;
    fetchEvents(true);
  }, [isGoogleConnected, fetchEvents]);

  // Auto-refresh when tab becomes visible or every 5 minutes
  useVisibilityRefresh({
    onRefresh: () => fetchEvents(true),
    minHiddenTime: 60000, // Refresh if hidden for 1+ minute
    refreshInterval: 300000, // Refresh every 5 minutes
    enabled: isGoogleConnected
  });

  // Scroll the week sidebar to show the selected date (or today if in view)
  useEffect(() => {
    // Small delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      if (weekSidebarRef.current) {
        // First try to scroll to selected date, then fall back to today
        const selectedElement = weekSidebarRef.current.querySelector('[data-selected="true"]') as HTMLElement;
        const todayElement = weekSidebarRef.current.querySelector('[data-today="true"]') as HTMLElement;
        const targetElement = selectedElement || todayElement;
        if (targetElement) {
          // Calculate scroll position to center the element within the sidebar only
          const container = weekSidebarRef.current;
          const elementTop = targetElement.offsetTop;
          const elementHeight = targetElement.offsetHeight;
          const containerHeight = container.clientHeight;
          const scrollTo = elementTop - (containerHeight / 2) + (elementHeight / 2);
          container.scrollTo({ top: Math.max(0, scrollTo), behavior: 'smooth' });
        }
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [selectedDate, events]);

  /**
   * Get the number of days in a month
   * 
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @returns {number} Number of days in the month
   */
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate()
  }
  
  /**
   * Get the first day of the month
   * 
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @returns {number} Day of the week (0-6)
   */
  const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay()
  }

  /**
   * Toggles a calendar's selected state
   * 
   * @param {number} index - Index of the calendar to toggle
   */
  const toggleCalendar = (index: number) => {
    if (!localConfig.calendars) return;
    
    const updatedCalendars = [...localConfig.calendars];
    updatedCalendars[index].selected = !updatedCalendars[index].selected;

    updateConfig({
      ...localConfig,
      calendars: updatedCalendars
    });
  }

  /**
   * Pre-process events into a Map grouped by date for O(1) lookups
   */
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      if (event.start) {
        const dateKey = new Date(event.start).toDateString();
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(event);
      }
    }
    for (const dayEvents of map.values()) {
      dayEvents.sort((a, b) => {
        if (!a.start || !b.start) return 0;
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      });
    }
    return map;
  }, [events]);

  const getEventsForDate = React.useCallback((targetDate: Date): CalendarEvent[] => {
    return eventsByDate.get(targetDate.toDateString()) || [];
  }, [eventsByDate]);

  /**
   * Get upcoming events from now
   */
  const getUpcomingEvents = React.useCallback((count: number): CalendarEvent[] => {
    const now = new Date();
    return events.filter(event => {
      if (!event.start) return false;
      return new Date(event.start).getTime() >= now.getTime();
    }).slice(0, count);
  }, [events]);

  /**
   * 1x1 ICON: Apple Calendar-style date icon
   */
  const renderTinyView = () => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const month = today.toLocaleDateString('default', { month: 'short' }).toUpperCase();
    const todayEvents = getEventsForDate(today);

    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-red-500">
          {month}
        </div>
        <div className="text-[2rem] font-bold leading-none text-foreground">
          {dayOfMonth}
        </div>
        {todayEvents.length > 0 && (
          <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
        )}
      </div>
    );
  };

  /**
   * Nx1 RIBBON: Today's date + upcoming events as horizontal chips
   */
  const renderRibbonView = () => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const weekday = today.toLocaleDateString('default', { weekday: 'short' });
    const month = today.toLocaleDateString('default', { month: 'short' });
    const upcoming = getUpcomingEvents(Math.max(2, width - 1));

    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1">
        {/* Date badge */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex flex-col items-center rounded-lg bg-red-50 dark:bg-red-900/20 px-2 py-0.5">
            <span className="text-[9px] font-semibold uppercase text-red-500">{weekday}</span>
            <span className="text-lg font-bold leading-tight text-foreground">{dayOfMonth}</span>
            <span className="text-[9px] text-muted-foreground">{month}</span>
          </div>
        </div>

        {/* Event chips */}
        {upcoming.length > 0 ? (
          upcoming.map((event, i) => (
            <div
              key={i}
              className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${event.color || '#3B82F6'}20` }}
            >
              <div
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: event.color || '#3B82F6' }}
              />
              <span className="max-w-[120px] truncate text-xs font-medium text-foreground">
                {event.title}
              </span>
              {event.time && !event.allDay && (
                <span className="text-[10px] text-muted-foreground">
                  {event.time.split(' - ')[0]}
                </span>
              )}
            </div>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">No upcoming events</span>
        )}
      </div>
    );
  };

  /**
   * Renders a compact date view for the smallest widget size (2x2)
   *
   * @returns Compact date view
   */
  const renderCompactCalendar = () => {
    const today = new Date()
    const dayOfMonth = today.getDate()
    const month = today.toLocaleDateString('default', { month: 'long' })

    return (
      <div ref={widgetRef} className="h-full flex flex-col justify-center items-center text-center overflow-hidden">
        <div className="text-xs text-muted-foreground mb-0.5 truncate max-w-full px-1">
          {today.toLocaleDateString('default', { weekday: width <= 2 ? 'short' : 'long' })}
        </div>

        <div className="flex flex-col items-center">
          <span className="text-6xl font-bold text-rose-500">{dayOfMonth}</span>
          <span className="text-sm truncate max-w-full px-1">{month}</span>
        </div>
        
        {(() => {
          const today = new Date();
          const todayEvents = getEventsForDate(today);
          const nextEvent = getUpcomingEvents(1)[0];

          if (nextEvent) {
            const isToday = nextEvent.start && new Date(nextEvent.start).toDateString() === today.toDateString();
            return (
              <div className="mt-2 w-full px-2">
                <div className="rounded-md px-2 py-1" style={{ backgroundColor: `${nextEvent.color || '#3B82F6'}15` }}>
                  <div className="truncate text-xs font-medium text-foreground">
                    {nextEvent.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {isToday ? '' : new Date(nextEvent.start!).toLocaleDateString('default', { weekday: 'short' }) + ' · '}
                    {nextEvent.allDay ? 'All day' : nextEvent.time?.split(' - ')[0]}
                  </div>
                </div>
                {todayEvents.length > 1 && (
                  <div className="mt-1 text-center text-[10px] text-muted-foreground">
                    +{todayEvents.length - 1} more today
                  </div>
                )}
              </div>
            );
          }

          return todayEvents.length > 0 ? (
            <div className="mt-2 text-xs text-muted-foreground">
              {todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''} today
            </div>
          ) : null;
        })()}
      </div>
    )
  }

  /**
   * Renders a daily view for tall narrow widgets (2x3)
   * Shows today's day, date, and events
   * 
   * @returns Daily view with today's events
   */
  const renderDailyView = () => {
    const today = new Date()
    const dayOfWeek = today.toLocaleDateString('default', { weekday: 'long' })
    const dayOfMonth = today.getDate()
    const month = today.toLocaleDateString('default', { month: 'long' })
    const year = today.getFullYear()
    
    // Filter events for today
    const todayEvents = events.filter(event => {
      if (!event.start) return false;
      const eventDate = new Date(event.start);
      return eventDate.getDate() === today.getDate() &&
             eventDate.getMonth() === today.getMonth() &&
             eventDate.getFullYear() === today.getFullYear();
    });
    
    // Sort events by time
    const sortedEvents = [...todayEvents].sort((a, b) => {
      if (!a.start || !b.start) return 0;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
    
    return (
      <div className="h-full flex flex-col">
        {/* Today's header */}
        <div className="flex flex-col items-center mb-3">
          <div className="text-base font-medium text-foreground">
            {dayOfWeek}
          </div>
          
          <div className="flex flex-col items-center mt-1">
            <span className="text-4xl font-bold text-blue-500">{dayOfMonth}</span>
            <span className="text-sm text-muted-foreground">{month} {year}</span>
          </div>
        </div>
        
        {/* Today's events list */}
        <div className="flex-1 overflow-y-auto mt-2">
          <h3 className="text-sm font-medium mb-2 text-muted-foreground">
            Today's Events
          </h3>
          
          <div className="space-y-2">
            {sortedEvents.length > 0 ? (
              sortedEvents.map((event, index) => (
                <div 
                  key={`event-${index}`}
                  className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-100 dark:border-blue-800 flex items-start"
                >
                  <div className="w-12 flex-shrink-0 text-blue-500 text-2xs font-medium mr-1">
                    <div>{formatTimeRange(event.time)}</div>
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-medium">{event.title}</div>
                    {event.location && (
                      <div className="text-muted-foreground text-2xs mt-0.5 truncate">
                        {event.location}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-center text-muted-foreground italic py-4">
                No events scheduled for today
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  /**
   * Renders a monthly view for wide widgets (3x2) centered around the current/selected date
   * 
   * @returns Monthly view for wide layouts
   */
  const renderStandardCalendar = () => {
    // Get the month and day from the currently selected date
    const month = selectedDate.getMonth()
    const currentDay = selectedDate.getDate()
    
    // Adjust first day of week based on settings
    const startDay = localConfig.startDay === 'monday' ? 1 : 0
    
    // Day names based on start day setting - use shorter abbreviations
    const dayNames = startDay === 1 
      ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    
    // Calculate visible date range - we'll show 2 weeks (14 days)
    // Position selectedDate roughly in the middle
    const startDate = new Date(selectedDate)
    startDate.setDate(currentDay - 7) // Go back 7 days from selected date
    
    // Create array of dates to display (14 days)
    const visibleDates = Array.from({ length: 14 }, (_, i) => {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      return date
    })
    
    return (
      <div ref={widgetRef} className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-7 w-7"
            onClick={() => {
              const newDate = new Date(selectedDate)
              newDate.setDate(selectedDate.getDate() - 7)
              setSelectedDate(newDate)
            }}
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </Button>

          <div className="flex space-x-2 items-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-medium text-primary h-6 px-1.5"
              onClick={() => {
                const today = new Date();
                setDate(today);
                setSelectedDate(today);
              }}
              aria-label="Today"
            >
              Today
            </Button>

            <h3 className="text-base font-medium">
              {selectedDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
            </h3>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-7 w-7"
            onClick={() => {
              const newDate = new Date(selectedDate)
              newDate.setDate(selectedDate.getDate() + 7)
              setSelectedDate(newDate)
            }}
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        
        <div className="grid grid-cols-7 gap-x-2 gap-y-1.5 flex-1">
          {/* Day name headers - simplified */}
          {dayNames.map((day) => (
            <div 
              key={day} 
              className="text-xs text-center text-muted-foreground font-medium"
            >
              {day}
            </div>
          ))}
          
          {/* Calendar days - now showing 2 weeks centered around selected date */}
          {visibleDates.map((date, index) => {
            const day = date.getDate()
            const isToday = new Date().toDateString() === date.toDateString()
            const isCurrentMonth = date.getMonth() === month
            const isSelected = selectedDate.toDateString() === date.toDateString()
            
            // Check if this day has events
            const dayEvents = events.filter(event => {
              if (!event.start) return false;
              const eventDate = new Date(event.start);
              return eventDate.getDate() === date.getDate() &&
                     eventDate.getMonth() === date.getMonth() &&
                     eventDate.getFullYear() === date.getFullYear();
            });
            
            return (
              <div 
                key={`day-${index}`} 
                className={`flex flex-col items-center cursor-pointer`}
                onClick={() => {
                  setSelectedDate(date);
                }}
              >
                <div className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                  isToday 
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : isSelected
                      ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                      : 'hover:bg-accent'
                } ${
                  !isCurrentMonth ? 'text-muted-foreground/60' : ''
                }`}>
                  {day}
                </div>
                
                {dayEvents.length > 0 && (
                  <div className="flex mt-1 space-x-0.5">
                    {dayEvents.length > 0 && (
                      <div 
                        className={`h-1 w-1 rounded-full ${
                          isCurrentMonth ? 'bg-blue-500 dark:bg-blue-400' : 'bg-muted-foreground/40'
                        }`}
                      ></div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Selected date preview */}
        <div className="mt-auto pt-2 border-t border-border">
          <div className="flex justify-between items-center text-xs">
            <div className="font-medium">
              {selectedDate.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            {(() => {
              const dayEvents = events.filter(event => {
                if (!event.start) return false;
                const eventDate = new Date(event.start);
                return eventDate.getDate() === selectedDate.getDate() &&
                       eventDate.getMonth() === selectedDate.getMonth() &&
                       eventDate.getFullYear() === selectedDate.getFullYear();
              });
              
              return dayEvents.length > 0 ? (
                <div className="text-blue-500">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</div>
              ) : (
                <div className="text-muted-foreground">No events</div>
              );
            })()}
          </div>
        </div>
      </div>
    )
  }

  /**
   * Renders a full calendar view for large widget sizes (3x3 or larger)
   * 
   * @returns Full calendar view
   */
  const renderFullCalendar = () => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const currentDay = date.getDate()
    
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)
    
    // Adjust first day of week based on settings
    const startDay = localConfig.startDay === 'monday' ? 1 : 0
    const adjustedFirstDay = (firstDay - startDay + 7) % 7
    
    // Day names based on start day setting
    const dayNames = startDay === 1 
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={() => setDate(new Date(year, month - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-medium text-primary h-7 px-2"
              onClick={() => {
                const today = new Date();
                setDate(today);
                setSelectedDate(today);
              }}
              aria-label="Today"
            >
              Today
            </Button>
          </div>

          <h3 className="text-lg font-medium">
            {date.toLocaleDateString('default', { month: 'long' })} {date.getFullYear()}
          </h3>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-8 w-8"
            onClick={() => setDate(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </Button>
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {/* Day name headers */}
          {dayNames.map((day) => (
            <div 
              key={day} 
              className="text-sm text-center text-muted-foreground font-medium py-2"
            >
              {day.substring(0, 3)}
            </div>
          ))}
          
          {/* Empty cells for days before the first day of month */}
          {Array.from({ length: adjustedFirstDay }).map((_, index) => (
            <div key={`empty-${index}`} className="h-10"></div>
          ))}
          
          {/* Calendar days */}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1
            const isToday = day === currentDay && new Date().getMonth() === month && new Date().getFullYear() === year

            // Check if this day is the selected day
            const isSelected = selectedDate.getDate() === day &&
                              selectedDate.getMonth() === month &&
                              selectedDate.getFullYear() === year

            // Check for events on this day
            const dayDate = new Date(year, month, day);
            const dayEvents = getEventsForDate(dayDate);
            const hasEvents = dayEvents.length > 0;

            return (
              <div
                key={`day-${day}`}
                className="h-10 flex flex-col items-center justify-center cursor-pointer"
                onClick={() => {
                  const clickedDate = new Date(year, month, day);
                  setSelectedDate(clickedDate);
                }}
              >
                <div
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors ${
                    isToday
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : isSelected
                        ? 'bg-blue-200 dark:bg-blue-800 hover:bg-blue-300 dark:hover:bg-blue-700'
                        : 'hover:bg-accent'
                  }`}
                >
                  {day}
                </div>
                {hasEvents && (
                  <div className="flex mt-0.5 space-x-0.5">
                    {dayEvents.slice(0, 3).map((evt, i) => (
                      <div
                        key={i}
                        className="h-1 w-1 rounded-full"
                        style={{ backgroundColor: isToday ? 'white' : (evt.color || '#3B82F6') }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Selected date events */}
        {(() => {
          const selEvents = getEventsForDate(selectedDate);
          if (selEvents.length === 0) return null;
          return (
            <div className="mt-2 border-t border-border pt-2 overflow-y-auto max-h-24">
              {selEvents.slice(0, 3).map((event, i) => (
                <div key={i} className="flex items-center gap-1.5 py-0.5 text-xs">
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: event.color || '#3B82F6' }}
                  />
                  <span className="truncate font-medium">{event.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {event.allDay ? 'All day' : event.time?.split(' - ')[0]}
                  </span>
                </div>
              ))}
              {selEvents.length > 3 && (
                <div className="text-[10px] text-muted-foreground mt-0.5">+{selEvents.length - 3} more</div>
              )}
            </div>
          );
        })()}
      </div>
    )
  }

  /**
   * Renders an expanded calendar view for extra large widget sizes (4x4 or larger)
   * 
   * @returns Expanded calendar view with weekly agenda
   */
  const renderExpandedCalendar = () => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const currentDay = date.getDate()
    
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)
    
    // Adjust first day of week based on settings
    const startDay = localConfig.startDay === 'monday' ? 1 : 0
    const adjustedFirstDay = (firstDay - startDay + 7) % 7
    
    // Day names based on start day setting
    const dayNames = startDay === 1 
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    
    // For larger layouts, show more event details
    const today = new Date()
    // Use selectedDate instead of today to determine the week to display
    const weekStart = new Date(selectedDate)
    const selectedDayOfWeek = selectedDate.getDay()
    const daysToSubtract = (selectedDayOfWeek - startDay + 7) % 7
    weekStart.setDate(selectedDate.getDate() - daysToSubtract)
    
    return (
      <div className="h-full flex flex-col">
        {/* Calendar header with controls */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full h-8 px-2"
              onClick={() => setDate(new Date(year, month - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
              <span className="ml-1 text-sm hidden sm:inline">{new Date(year, month - 1, 1).toLocaleDateString('default', { month: 'short' })}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-medium text-primary h-7 px-2"
              onClick={() => {
                const today = new Date();
                setDate(today);
                setSelectedDate(today);
              }}
              aria-label="Today"
            >
              Today
            </Button>
          </div>

          <h3 className="text-base font-medium">
            {date.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
          </h3>

          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-8 px-2"
            onClick={() => setDate(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <span className="mr-1 text-sm hidden sm:inline">{new Date(year, month + 1, 1).toLocaleDateString('default', { month: 'short' })}</span>
            <ChevronRight size={16} />
          </Button>
        </div>
      
        <div className="grid grid-cols-2 gap-4 h-full flex-1">
          {/* Left side - Month calendar */}
          <div className="flex flex-col">
            <div className="grid grid-cols-7 gap-1.5">
              {/* Day name headers */}
              {dayNames.map((day) => (
                <div 
                  key={day} 
                  className="text-xs text-center text-muted-foreground font-medium py-1.5"
                >
                  {day}
                </div>
              ))}
              
              {/* Empty cells for days before the first day of month */}
              {Array.from({ length: adjustedFirstDay }).map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square"></div>
              ))}
              
              {/* Calendar days */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1
                const isToday = day === currentDay && new Date().getMonth() === month && new Date().getFullYear() === year
                
                // Check if this day has events by filtering the events array
                const dayDate = new Date(year, month, day);
                const dayEvents = events.filter(event => {
                  if (!event.start) return false;
                  const eventDate = new Date(event.start);
                  return eventDate.getDate() === dayDate.getDate() &&
                         eventDate.getMonth() === dayDate.getMonth() &&
                         eventDate.getFullYear() === dayDate.getFullYear();
                });
                
                const hasEvents = dayEvents.length > 0
                
                return (
                  <div 
                    key={`day-${day}`} 
                    className={`aspect-square flex flex-col items-center justify-center cursor-pointer ${
                      isToday 
                        ? 'bg-blue-500 text-white rounded-full' 
                        : selectedDate.getDate() === day && 
                          selectedDate.getMonth() === month && 
                          selectedDate.getFullYear() === year
                          ? 'bg-blue-200 dark:bg-blue-800 rounded-full'
                          : 'hover:bg-accent rounded-full'
                    }`}
                    onClick={() => {
                      const clickedDate = new Date(year, month, day);
                      setSelectedDate(clickedDate);
                    }}
                  >
                    <div className="text-sm font-medium">{day}</div>
                    {hasEvents && (
                      <div className="flex space-x-1 mt-0.5">
                        {[...Array(Math.min(dayEvents.length, 3))].map((_, i) => (
                          <div 
                            key={i} 
                            className={`h-1.5 w-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-blue-500 dark:bg-blue-400'}`}
                          ></div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          
          {/* Right side - Weekly agenda with more details */}
          <div className="flex flex-col border-l border-border pl-4 min-h-0">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">
                This Week
              </h3>
              
              <div className="text-xs text-muted-foreground">
                {weekStart.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - 
                {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString('default', { month: 'short', day: 'numeric' })}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto" ref={weekSidebarRef}>
              <div className="space-y-1 pr-1">
                {/* Weekday slots */}
                {Array.from({ length: 7 }).map((_, index) => {
                  const dayOffset = index
                  const dayDate = new Date(weekStart)
                  dayDate.setDate(weekStart.getDate() + dayOffset)
                  const isToday = dayDate.getDate() === today.getDate() &&
                                  dayDate.getMonth() === today.getMonth() &&
                                  dayDate.getFullYear() === today.getFullYear()

                  const isSelected = dayDate.getDate() === selectedDate.getDate() &&
                                    dayDate.getMonth() === selectedDate.getMonth() &&
                                    dayDate.getFullYear() === selectedDate.getFullYear()

                  // Filter events for this day
                  const dayEvents = events.filter(event => {
                    if (!event.start) return false;
                    const eventDate = new Date(event.start);
                    return eventDate.getDate() === dayDate.getDate() &&
                          eventDate.getMonth() === dayDate.getMonth() &&
                          eventDate.getFullYear() === dayDate.getFullYear();
                  });

                  return (
                    <div
                      key={`weekday-${index}`}
                      data-today={isToday ? 'true' : undefined}
                      data-selected={isSelected ? 'true' : undefined}
                      className={`mb-3 pb-2 ${index < 6 ? 'border-b border-border' : ''}`}
                    >
                      <div className={`flex items-center mb-1.5 ${isToday ? 'text-blue-500' : ''}`}>
                        <div className={`w-8 h-8 rounded-full mr-2 flex items-center justify-center ${
                          isToday ? 'bg-blue-500 text-white' : 'bg-muted'
                        }`}>
                          <span className="text-sm font-medium">{dayDate.getDate()}</span>
                        </div>
                        <div>
                          <div className="text-xs font-medium">
                            {dayDate.toLocaleDateString('default', { weekday: 'long' })}
                            {isToday && ' (Today)'}
                          </div>
                          <div className="text-2xs text-muted-foreground">
                            {dayDate.toLocaleDateString('default', { month: 'long', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      
                      {/* Events for this day */}
                      <div className="space-y-1.5">
                        {dayEvents.length > 0 ? (
                          dayEvents.map((event, eventIndex) => (
                            <div 
                              key={eventIndex}
                              className="text-xs p-2 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded border border-blue-100 dark:border-blue-800 flex items-start overflow-hidden"
                            >
                              <div className="w-12 flex-shrink-0 text-blue-500 text-2xs font-medium mr-1">
                                <div>{formatTimeRange(event.time)}</div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{event.title}</div>
                                {event.location && (
                                  <div className="text-muted-foreground text-2xs mt-0.5 truncate">
                                    {event.location}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground italic pl-2">
                            No events
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /**
   * 6x6+ APP: Full calendar application with month/week/day views
   */
  const renderAppView = () => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const today = new Date();

    const startDay = localConfig.startDay === 'monday' ? 1 : 0;
    const dayNames = startDay === 1
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Navigation controls shared across views
    const renderAppNav = () => {
      const periodLabel = viewMode === 'day'
        ? selectedDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : viewMode === 'week'
          ? (() => {
              const ws = getWeekStart(selectedDate);
              const we = new Date(ws.getTime() + 6 * 86400000);
              return `${ws.toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            })()
          : date.toLocaleDateString('default', { month: 'long', year: 'numeric' });

      const goBack = () => {
        if (viewMode === 'day') {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() - 1);
          setSelectedDate(d);
        } else if (viewMode === 'week') {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() - 7);
          setSelectedDate(d);
        } else {
          setDate(new Date(year, month - 1, 1));
        }
      };

      const goForward = () => {
        if (viewMode === 'day') {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() + 1);
          setSelectedDate(d);
        } else if (viewMode === 'week') {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() + 7);
          setSelectedDate(d);
        } else {
          setDate(new Date(year, month + 1, 1));
        }
      };

      return (
        <div
          data-testid="calendar-app-header"
          className="flex items-center justify-between px-4 py-2 widget-drag-handle cursor-move"
        >
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={goBack}
            >
              <ChevronLeft size={18} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm font-medium text-primary h-7 px-2.5"
              onClick={() => { setDate(new Date()); setSelectedDate(new Date()); }}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={goForward}
            >
              <ChevronRight size={18} />
            </Button>
            <h2 className="ml-2 text-lg font-medium">{periodLabel}</h2>
          </div>

          {/* View mode tabs */}
          <div className="flex rounded-lg bg-muted p-0.5">
            {(['month', 'week', 'day'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  updateConfig({ ...localConfig, viewMode: mode });
                }}
                className={`px-3 py-1 text-sm rounded-md capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-background shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      );
    };

    // Month view: calendar grid on left, selected day detail on right
    const renderMonthView = () => {
      const daysInMonth = getDaysInMonth(year, month);
      const firstDay = getFirstDayOfMonth(year, month);
      const adjustedFirstDay = (firstDay - startDay + 7) % 7;
      const selectedDayEvents = getEventsForDate(selectedDate);

      return (
        <div className="flex flex-1 overflow-hidden">
          {/* Month grid */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            <div className="grid grid-cols-7 gap-1">
              {dayNames.map(d => (
                <div key={d} className="text-xs text-center text-muted-foreground font-medium py-2">{d}</div>
              ))}
              {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                <div key={`e-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayDate = new Date(year, month, day);
                const isToday = dayDate.toDateString() === today.toDateString();
                const isSelected = dayDate.toDateString() === selectedDate.toDateString();
                const dayEvts = getEventsForDate(dayDate);

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDate(dayDate)}
                    className={`aspect-square flex flex-col items-center justify-center cursor-pointer rounded-lg transition-colors ${
                      isToday ? 'bg-blue-500 text-white' :
                      isSelected ? 'bg-blue-100 dark:bg-blue-800/50' :
                      'hover:bg-accent'
                    }`}
                  >
                    <span className="text-sm font-medium">{day}</span>
                    {dayEvts.length > 0 && (
                      <div className="flex mt-0.5 gap-0.5">
                        {dayEvts.slice(0, 3).map((evt, j) => (
                          <div key={j} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isToday ? 'white' : (evt.color || '#3B82F6') }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected day detail pane */}
          <div className="w-2/5 border-l border-border flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-medium">{selectedDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              <p className="text-xs text-muted-foreground">{selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedDayEvents.length > 0 ? selectedDayEvents.map((event, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <div className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: event.color || '#3B82F6' }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{event.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{formatTimeRange(event.time)}</div>
                      {event.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin size={10} />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{event.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-center text-muted-foreground italic py-8">
                  No events on this day
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    // Helper: get week start
    const getWeekStart = (d: Date) => {
      const ws = new Date(d);
      const dow = ws.getDay();
      const diff = (dow - startDay + 7) % 7;
      ws.setDate(ws.getDate() - diff);
      ws.setHours(0, 0, 0, 0);
      return ws;
    };

    // Week view: 7-column time grid
    const renderWeekView = () => {
      const weekStart = getWeekStart(selectedDate);
      const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM

      return (
        <div className="flex flex-1 overflow-hidden">
          {/* Time gutter */}
          <div className="w-16 shrink-0 border-r border-border pt-10">
            {hours.map(h => (
              <div key={h} className="h-14 flex items-start justify-end pr-2">
                <span className="text-[10px] text-muted-foreground -mt-1.5">
                  {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex-1 grid grid-cols-7 divide-x divide-border overflow-y-auto">
            {Array.from({ length: 7 }).map((_, dayIndex) => {
              const dayDate = new Date(weekStart);
              dayDate.setDate(weekStart.getDate() + dayIndex);
              const isToday = dayDate.toDateString() === today.toDateString();
              const dayEvts = getEventsForDate(dayDate);

              return (
                <div key={dayIndex} className="flex flex-col min-w-0">
                  {/* Day header */}
                  <div className={`sticky top-0 z-10 bg-card text-center py-2 border-b border-border ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <div className="text-xs text-muted-foreground">
                      {dayDate.toLocaleDateString('default', { weekday: 'short' })}
                    </div>
                    <div className={`text-lg font-semibold ${isToday ? 'text-blue-500' : ''}`}>
                      {dayDate.getDate()}
                    </div>
                  </div>

                  {/* Hour slots */}
                  <div className="relative">
                    {hours.map(h => (
                      <div key={h} className="h-14 border-b border-border" />
                    ))}

                    {/* Events positioned by time */}
                    {dayEvts.filter(e => !e.allDay && e.start && e.end).map((event, i) => {
                      const start = new Date(event.start!);
                      const end = new Date(event.end!);
                      const startHour = start.getHours() + start.getMinutes() / 60;
                      const endHour = end.getHours() + end.getMinutes() / 60;
                      const top = (startHour - 6) * 56; // 56px = h-14
                      const height = Math.max((endHour - startHour) * 56, 20);

                      if (startHour < 6 || startHour > 21) return null;

                      return (
                        <div
                          key={i}
                          className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            backgroundColor: `${event.color || '#3B82F6'}20`,
                            borderLeft: `3px solid ${event.color || '#3B82F6'}`,
                          }}
                          onClick={() => setSelectedDate(dayDate)}
                        >
                          <div className="text-[10px] font-medium truncate text-foreground">{event.title}</div>
                          {height > 30 && (
                            <div className="text-[9px] text-muted-foreground">{event.time?.split(' - ')[0]}</div>
                          )}
                        </div>
                      );
                    })}

                    {/* All-day events at top */}
                    {dayEvts.filter(e => e.allDay).length > 0 && (
                      <div className="absolute top-0 left-0 right-0 bg-muted border-b border-border p-0.5">
                        {dayEvts.filter(e => e.allDay).map((event, i) => (
                          <div
                            key={i}
                            className="text-[10px] font-medium px-1 py-0.5 rounded truncate mb-0.5"
                            style={{ backgroundColor: `${event.color || '#3B82F6'}30`, color: event.color || '#3B82F6' }}
                          >
                            {event.title}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Current time indicator */}
                    {isToday && (() => {
                      const now = new Date();
                      const nowHour = now.getHours() + now.getMinutes() / 60;
                      if (nowHour < 6 || nowHour > 22) return null;
                      const top = (nowHour - 6) * 56;
                      return (
                        <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${top}px` }}>
                          <div className="flex items-center">
                            <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1" />
                            <div className="flex-1 h-0.5 bg-red-500" />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    // Day view: single column time grid
    const renderDayView = () => {
      const hours = Array.from({ length: 18 }, (_, i) => i + 5); // 5 AM to 10 PM
      const isToday = selectedDate.toDateString() === today.toDateString();
      const dayEvts = getEventsForDate(selectedDate);

      return (
        <div className="flex flex-1 overflow-y-auto">
          {/* Time gutter */}
          <div className="w-20 shrink-0 border-r border-border">
            {hours.map(h => (
              <div key={h} className="h-16 flex items-start justify-end pr-3">
                <span className="text-xs text-muted-foreground -mt-2">
                  {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                </span>
              </div>
            ))}
          </div>

          {/* Time slots */}
          <div className="flex-1 relative">
            {/* All-day events */}
            {dayEvts.filter(e => e.allDay).length > 0 && (
              <div className="border-b border-border p-2 space-y-1">
                <div className="text-[10px] uppercase text-muted-foreground font-medium">All Day</div>
                {dayEvts.filter(e => e.allDay).map((event, i) => (
                  <div
                    key={i}
                    className="text-sm font-medium px-2 py-1 rounded"
                    style={{ backgroundColor: `${event.color || '#3B82F6'}15`, color: event.color || '#3B82F6' }}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            )}

            {/* Hour rows */}
            {hours.map(h => (
              <div key={h} className="h-16 border-b border-border" />
            ))}

            {/* Positioned events */}
            {dayEvts.filter(e => !e.allDay && e.start && e.end).map((event, i) => {
              const start = new Date(event.start!);
              const end = new Date(event.end!);
              const startHour = start.getHours() + start.getMinutes() / 60;
              const endHour = end.getHours() + end.getMinutes() / 60;
              const top = (startHour - 5) * 64;
              const height = Math.max((endHour - startHour) * 64, 28);
              const allDayOffset = dayEvts.filter(e => e.allDay).length > 0 ? 40 : 0;

              if (startHour < 5 || startHour > 22) return null;

              return (
                <div
                  key={i}
                  className="absolute left-1 right-4 rounded-lg px-3 py-1.5 overflow-hidden"
                  style={{
                    top: `${top + allDayOffset}px`,
                    height: `${height}px`,
                    backgroundColor: `${event.color || '#3B82F6'}15`,
                    borderLeft: `4px solid ${event.color || '#3B82F6'}`,
                  }}
                >
                  <div className="text-sm font-medium text-foreground">{event.title}</div>
                  <div className="text-xs text-muted-foreground">{formatTimeRange(event.time)}</div>
                  {height > 60 && event.location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin size={10} />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                  {height > 80 && event.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                  )}
                </div>
              );
            })}

            {/* Current time indicator */}
            {isToday && (() => {
              const now = new Date();
              const nowHour = now.getHours() + now.getMinutes() / 60;
              if (nowHour < 5 || nowHour > 23) return null;
              const top = (nowHour - 5) * 64;
              const allDayOffset = dayEvts.filter(e => e.allDay).length > 0 ? 40 : 0;
              return (
                <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${top + allDayOffset}px` }}>
                  <div className="flex items-center">
                    <div className="h-3 w-3 rounded-full bg-red-500 -ml-1.5" />
                    <div className="flex-1 h-0.5 bg-red-500" />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      );
    };

    return (
      <div className="flex flex-col h-full">
        {renderAppNav()}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
      </div>
    );
  };

  /**
   * Renders the settings content for the modal
   *
   * @returns Settings content
   */
  const renderSettingsContent = () => {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="first-day-select">First Day of Week</Label>
          <Select
            value={localConfig.startDay || 'sunday'}
            onValueChange={(value: string) => setLocalConfig({...localConfig, startDay: value as 'sunday' | 'monday'})}
          >
            <SelectTrigger id="first-day-select" className="w-full">
              <SelectValue placeholder="Select first day of week" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sunday">Sunday</SelectItem>
              <SelectItem value="monday">Monday</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="pt-4">
          <h3 className="text-sm font-medium mb-3">Google Calendar</h3>
          
          {isGoogleConnected ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-2">
                    <CalendarIcon size={16} className="text-blue-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Google Calendar</div>
                    <div className="text-xs text-muted-foreground">Connected</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                  onClick={disconnectGoogleCalendar}
                  disabled={isLoading}
                >
                  Disconnect
                </Button>
              </div>
              
              {localConfig.calendars && localConfig.calendars.length > 0 && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">
                    Your Calendars
                  </Label>
                  {/* Change space-y-2 to space-y-4 for consistency */}
                  <div className="space-y-4 mt-2">
                    {localConfig.calendars.map((calendar: CalendarSource, index: number) => (
                      <div key={index} className="flex items-center">
                        {/* Replace native checkbox with shadcn/ui Checkbox */}
                        <Checkbox
                          id={`calendar-${index}`}
                          checked={calendar.selected}
                          onCheckedChange={() => toggleCalendar(index)}
                          className="rounded" // Apply shadcn styling
                        />
                        <Label htmlFor={`calendar-${index}`} className="ml-2 text-sm flex items-center cursor-pointer">
                          <span 
                            className="w-3 h-3 rounded-full mr-2" 
                            style={{ backgroundColor: calendar.color }}
                          />
                          {calendar.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Connect to Google Calendar to see your events in this widget.
              </p>
              <Button
                variant="default"
                className="w-full"
                onClick={connectGoogleCalendar}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Google Calendar'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  /**
   * Renders the settings footer for the modal
   * 
   * @returns Settings footer
   */
  const renderSettingsFooter = () => {
    return (
      <WidgetSettingsDialogFooter
        onDelete={config?.onDelete ? () => {
          config.onDelete?.();
          localStorage.removeItem(`calendar-widget-config-${localConfig.id || 'default'}`);
        } : undefined}
        onCancel={() => {
          if (config) {
            setLocalConfig(config);
          }
          setIsSettingsOpen(false);
        }}
        onSave={() => {
          if (config?.onUpdate) {
            config.onUpdate(localConfig);
          }
          setIsSettingsOpen(false);
        }}
      />
    );
  }

  /**
   * Renders the appropriate content based on widget dimensions
   * 
   * @returns The appropriate view for the current dimensions
   */
  const renderContent = () => {
    // Tiny and ribbon views always show the date, even without Google Calendar
    if (isTiny) return renderTinyView();
    if (isShort) return renderRibbonView();

    // For larger sizes, check Google Calendar connection
    if (!isGoogleConnected) {
      // 2x2 compact still shows date when disconnected
      if (isCompact) return renderCompactCalendar();

      return (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <CalendarIcon size={24} className="text-muted-foreground mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground mb-3">
            Connect Google Calendar to see events.
          </p>
          {!readOnly && (
            <Button
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              variant="outline"
            >
              Configure Calendar
            </Button>
          )}
        </div>
      );
    }

    // Full spectrum routing (most specific first)
    if (isApp) return renderAppView();
    if ((width >= 4 && height >= 3) || (width >= 3 && height >= 4)) return renderExpandedCalendar();
    if (width >= 3 && height >= 3) return renderFullCalendar();
    if (width >= 3) return renderStandardCalendar();
    if (height >= 3) return renderDailyView();
    return renderCompactCalendar();
  }

  return (
    <WidgetShell
      ref={widgetRef}
      title="Calendar"
      isTiny={isTiny}
      hideHeader={isApp}
      compactHeader={isShort}
      onSettingsClick={readOnly ? undefined : () => setIsSettingsOpen(true)}
      contentClassName={isTiny ? 'p-1' : isApp ? '' : 'pt-1'}
    >
      {renderContent()}

      {isSettingsOpen && (
        <WidgetSettingsDialog
          open={isSettingsOpen}
          onOpenChange={(open: boolean) => {
            if (!open) {
              // Reset to original config when closing without save
              if (config) {
                setLocalConfig(config);
              }
              setIsSettingsOpen(false);
              return;
            }
            setIsSettingsOpen(true);
          }}
          title="Calendar Settings"
          bodyClassName="flex flex-col gap-4 px-1"
          footer={renderSettingsFooter()}
        >
          {renderSettingsContent()}
        </WidgetSettingsDialog>
      )}
    </WidgetShell>
  )
}

export type { CalendarWidgetProps, CalendarWidgetConfig, CalendarEvent, CalendarSource } from './types';
export default CalendarWidget;
