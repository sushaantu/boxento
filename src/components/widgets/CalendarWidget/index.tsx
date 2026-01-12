import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useVisibilityRefresh } from '../../../lib/useVisibilityRefresh'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from 'lucide-react'
import { encryptionUtils } from '@/lib/encryption'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Label,
  Checkbox,
} from '@boxento/primitives'
import WidgetHeader from '../../widgets/common/WidgetHeader'
import { CalendarWidgetProps, CalendarWidgetConfig, CalendarEvent, CalendarSource } from './types'

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
  const [date, setDate] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  
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
   * Renders a compact date view for the smallest widget size (2x2)
   * 
   * @returns Compact date view
   */
  const renderCompactCalendar = () => {
    const today = new Date()
    const dayOfWeek = today.toLocaleDateString('default', { weekday: 'long' })
    const dayOfMonth = today.getDate()
    const month = today.toLocaleDateString('default', { month: 'long' })
    
    return (
      <div ref={widgetRef} className="h-full flex flex-col justify-center items-center text-center">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
          {dayOfWeek}
        </div>
        
        <div className="flex flex-col items-center">
          <span className="text-6xl font-bold text-rose-500">{dayOfMonth}</span>
          <span className="text-sm">{month}</span>
        </div>
        
        {(() => {
          // Filter events for today
          const today = new Date();
          const todayEvents = events.filter(event => {
            if (!event.start) return false;
            const eventDate = new Date(event.start);
            return eventDate.getDate() === today.getDate() &&
                   eventDate.getMonth() === today.getMonth() &&
                   eventDate.getFullYear() === today.getFullYear();
          });
          
          return todayEvents.length > 0 && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
              {todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''} today
            </div>
          );
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
          <div className="text-base font-medium text-gray-700 dark:text-gray-300">
            {dayOfWeek}
          </div>
          
          <div className="flex flex-col items-center mt-1">
            <span className="text-4xl font-bold text-blue-500">{dayOfMonth}</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">{month} {year}</span>
          </div>
        </div>
        
        {/* Today's events list */}
        <div className="flex-1 overflow-y-auto mt-2">
          <h3 className="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
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
                      <div className="text-gray-500 dark:text-gray-400 text-2xs mt-0.5 truncate">
                        {event.location}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-center text-gray-400 dark:text-gray-500 italic py-4">
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
          <button 
            onClick={() => {
              const newDate = new Date(selectedDate)
              newDate.setDate(selectedDate.getDate() - 7)
              setSelectedDate(newDate)
            }}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="flex space-x-2 items-center">
            <button
              onClick={() => {
                const today = new Date();
                setDate(today);
                setSelectedDate(today);
              }}
              className="px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 dark:hover:bg-opacity-20 rounded"
              aria-label="Today"
            >
              Today
            </button>
            
            <h3 className="text-base font-medium">
              {selectedDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
            </h3>
          </div>
          
          <button 
            onClick={() => {
              const newDate = new Date(selectedDate)
              newDate.setDate(selectedDate.getDate() + 7)
              setSelectedDate(newDate)
            }}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-x-2 gap-y-1.5 flex-1">
          {/* Day name headers - simplified */}
          {dayNames.map((day) => (
            <div 
              key={day} 
              className="text-xs text-center text-gray-500 dark:text-gray-400 font-medium"
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
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                } ${
                  !isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : ''
                }`}>
                  {day}
                </div>
                
                {dayEvents.length > 0 && (
                  <div className="flex mt-1 space-x-0.5">
                    {dayEvents.length > 0 && (
                      <div 
                        className={`h-1 w-1 rounded-full ${
                          isCurrentMonth ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'
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
        <div className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
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
                <div className="text-gray-400">No events</div>
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
            <button 
              onClick={() => setDate(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            
            <button
              onClick={() => {
                const today = new Date();
                setDate(today);
                setSelectedDate(today);
              }}
              className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 dark:hover:bg-opacity-20 rounded"
              aria-label="Today"
            >
              Today
            </button>
          </div>
          
          <h3 className="text-lg font-medium">
            {date.toLocaleDateString('default', { month: 'long' })} {date.getFullYear()}
          </h3>
          
          <button 
            onClick={() => setDate(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {/* Day name headers */}
          {dayNames.map((day) => (
            <div 
              key={day} 
              className="text-sm text-center text-gray-500 dark:text-gray-400 font-medium py-2"
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
            
            return (
              <div 
                key={`day-${day}`} 
                className="h-10 flex items-center justify-center cursor-pointer"
                onClick={() => {
                  const clickedDate = new Date(year, month, day);
                  setSelectedDate(clickedDate);
                }}
              >
                <div 
                  className={`w-10 h-10 flex items-center justify-center rounded-lg text-base transition-colors ${
                    isToday
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : isSelected
                        ? 'bg-blue-200 dark:bg-blue-800 hover:bg-blue-300 dark:hover:bg-blue-700'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {day}
                </div>
              </div>
            )
          })}
        </div>
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
            <button 
              onClick={() => setDate(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
              <span className="ml-1 text-sm hidden sm:inline">{new Date(year, month - 1, 1).toLocaleDateString('default', { month: 'short' })}</span>
            </button>
            
            <button
              onClick={() => {
                const today = new Date();
                setDate(today);
                setSelectedDate(today);
              }}
              className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 dark:hover:bg-opacity-20 rounded"
              aria-label="Today"
            >
              Today
            </button>
          </div>
          
          <h3 className="text-base font-medium">
            {date.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
          </h3>
          
          <button 
            onClick={() => setDate(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center"
            aria-label="Next month"
          >
            <span className="mr-1 text-sm hidden sm:inline">{new Date(year, month + 1, 1).toLocaleDateString('default', { month: 'short' })}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      
        <div className="grid grid-cols-2 gap-4 h-full flex-1">
          {/* Left side - Month calendar */}
          <div className="flex flex-col">
            <div className="grid grid-cols-7 gap-1.5">
              {/* Day name headers */}
              {dayNames.map((day) => (
                <div 
                  key={day} 
                  className="text-xs text-center text-gray-500 dark:text-gray-400 font-medium py-1.5"
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
                          : 'hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full'
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
          <div className="flex flex-col border-l border-gray-200 dark:border-slate-700 pl-4 min-h-0">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">
                This Week
              </h3>
              
              <div className="text-xs text-gray-500 dark:text-gray-400">
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
                      className={`mb-3 pb-2 ${index < 6 ? 'border-b border-gray-100 dark:border-slate-800' : ''}`}
                    >
                      <div className={`flex items-center mb-1.5 ${isToday ? 'text-blue-500' : ''}`}>
                        <div className={`w-8 h-8 rounded-full mr-2 flex items-center justify-center ${
                          isToday ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-slate-700'
                        }`}>
                          <span className="text-sm font-medium">{dayDate.getDate()}</span>
                        </div>
                        <div>
                          <div className="text-xs font-medium">
                            {dayDate.toLocaleDateString('default', { weekday: 'long' })}
                            {isToday && ' (Today)'}
                          </div>
                          <div className="text-2xs text-gray-500 dark:text-gray-400">
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
                                  <div className="text-gray-500 dark:text-gray-400 text-2xs mt-0.5 truncate">
                                    {event.location}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-gray-400 dark:text-gray-500 italic pl-2">
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
                    <div className="text-xs text-gray-500 dark:text-gray-400">Connected</div>
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
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
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
      <div className="flex justify-between w-full">
        {config?.onDelete && (
          <Button
            variant="destructive"
            onClick={() => {
              if (config.onDelete) {
                config.onDelete();
              }
              // Clear the saved configuration
              localStorage.removeItem(`calendar-widget-config-${localConfig.id || 'default'}`);
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
              // Save the configuration by notifying parent
              if (config && config.onUpdate) {
                config.onUpdate(localConfig)
              }

              setIsSettingsOpen(false)
            }}
          >
            Save
          </Button>
        </div>
      </div>
    )
  }

  /**
   * Renders the appropriate content based on widget dimensions
   * 
   * @returns The appropriate view for the current dimensions
   */
  const renderContent = () => {
    // Add check for Google Calendar connection
    if (!isGoogleConnected) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center">
          {/* Use CalendarIcon from Lucide with consistent styling */}
          <CalendarIcon size={24} className="text-gray-400 mb-3" strokeWidth={1.5} />
          {/* Consistent text styling */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Connect Google Calendar to see events.
          </p>
          {/* Consistent button styling */}
          <Button
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            variant="outline"
          >
            Configure Calendar
          </Button>
        </div>
      );
    }

    // Choose the appropriate view based on widget dimensions
    if ((width >= 4 && height >= 3) || (width >= 3 && height >= 4)) {
      return renderExpandedCalendar()
    } else if (width >= 3 && height >= 3) {
      return renderFullCalendar()
    } else if (width >= 3) {
      return renderStandardCalendar()
    } else if (height >= 3) {
      return renderDailyView()
    } else {
      return renderCompactCalendar()
    }
  }

  return (
    <div 
      ref={widgetRef} 
      className="widget-container h-full flex flex-col"
    >
      <WidgetHeader 
        title="Calendar" 
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      
      <div className="flex-1 overflow-hidden p-2">
        {renderContent()}
      </div>
      
      {isSettingsOpen && (
        <Dialog
          open={isSettingsOpen}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setIsSettingsOpen(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Calendar Settings</DialogTitle>
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
  )
}

export type { CalendarWidgetProps, CalendarWidgetConfig, CalendarEvent, CalendarSource } from './types';
export default CalendarWidget;