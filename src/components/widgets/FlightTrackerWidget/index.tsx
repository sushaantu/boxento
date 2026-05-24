import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plane,
  RefreshCw,
  AlertCircle,
  CalendarIcon,
  Plus,
  Trash2,
  Clock,
  MapPin,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Calendar } from '../../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import WidgetHeader from '../common/WidgetHeader';
import type {
  FlightTrackerWidgetProps,
  FlightTrackerWidgetConfig,
  TrackedFlight,
} from './types';
import {
  readFlightTrackerSetupProbe,
  resolveFlightTrackerSetupState,
  type FlightTrackerSetupState,
} from './setup';
import { cn } from '@/lib/utils';

// Flight data interface from API
interface FlightData {
  flight_iata: string;
  flight_number: string;
  airline_name: string;
  airline_iata: string;
  status: string;
  departure: {
    airport: string;
    city: string;
    iata: string;
    terminal?: string;
    gate?: string;
    scheduled: string;
    actual?: string;
    delay?: number;
  };
  arrival: {
    airport: string;
    city: string;
    iata: string;
    terminal?: string;
    gate?: string;
    scheduled: string;
    actual?: string;
    delay?: number;
  };
  duration: number;
  progress: number;
}

const defaultConfig: FlightTrackerWidgetConfig = {
  title: 'Flight Tracker',
  flightNumber: '',
  flightDate: '',
  trackedFlights: [],
  refreshInterval: 300000,
};

const FlightTrackerWidget: React.FC<FlightTrackerWidgetProps> = ({
  width,
  height,
  config,
}) => {
  // --- Size detection ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<FlightTrackerWidgetConfig>({
    ...defaultConfig,
    ...config,
  });
  const [flightDataMap, setFlightDataMap] = useState<
    Record<string, FlightData>
  >({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [setupState, setSetupState] =
    useState<FlightTrackerSetupState>('checking');

  // Settings modal snapshot/revert
  const [configSnapshot, setConfigSnapshot] =
    useState<FlightTrackerWidgetConfig | null>(null);

  // Add-flight form state
  const [addFlightNumber, setAddFlightNumber] = useState('');
  const [addFlightDate, setAddFlightDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig((prev) => ({ ...prev, ...config }));
  }, [config]);

  // Derive the active flight list: either trackedFlights or a single flight from legacy config
  const trackedFlights = useMemo((): TrackedFlight[] => {
    if (localConfig.trackedFlights && localConfig.trackedFlights.length > 0) {
      return localConfig.trackedFlights;
    }
    if (localConfig.flightNumber) {
      return [
        {
          id: 'legacy',
          flightNumber: localConfig.flightNumber,
          flightDate:
            localConfig.flightDate ||
            new Date().toISOString().split('T')[0],
        },
      ];
    }
    return [];
  }, [
    localConfig.trackedFlights,
    localConfig.flightNumber,
    localConfig.flightDate,
  ]);

  // Fetch flight data
  const fetchFlight = useCallback(
    async (flight: TrackedFlight) => {
      if (!flight.flightNumber) return;

      setLoadingMap((prev) => ({ ...prev, [flight.id]: true }));
      setErrorMap((prev) => {
        const next = { ...prev };
        delete next[flight.id];
        return next;
      });

      try {
        const params = new URLSearchParams({
          flight_iata: flight.flightNumber.toUpperCase(),
        });
        if (flight.flightDate) {
          params.append('flight_date', flight.flightDate);
        }
        const response = await fetch(`/api/flights?${params.toString()}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || 'Failed to fetch flight');
        }

        if (!result.data) {
          setErrorMap((prev) => ({
            ...prev,
            [flight.id]: 'Flight not found',
          }));
          setFlightDataMap((prev) => {
            const next = { ...prev };
            delete next[flight.id];
            return next;
          });
        } else {
          setFlightDataMap((prev) => ({ ...prev, [flight.id]: result.data }));
        }
      } catch (err) {
        setErrorMap((prev) => ({
          ...prev,
          [flight.id]:
            err instanceof Error ? err.message : 'Failed to fetch flight',
        }));
      } finally {
        setLoadingMap((prev) => ({ ...prev, [flight.id]: false }));
      }
    },
    []
  );

  // Fetch all flights on mount and when trackedFlights change
  useEffect(() => {
    trackedFlights.forEach((flight) => {
      fetchFlight(flight);
    });
  }, [trackedFlights, fetchFlight]);

  const checkFlightTrackerSetup = useCallback(async (signal?: AbortSignal) => {
    setSetupState('checking');

    try {
      const response = await fetch('/api/flights', { signal });
      const payload = await readFlightTrackerSetupProbe(response);

      setSetupState(
        resolveFlightTrackerSetupState({
          status: response.status,
          error: payload.error,
          message: payload.message,
        })
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      setSetupState('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void checkFlightTrackerSetup(controller.signal);

    return () => controller.abort();
  }, [checkFlightTrackerSetup]);

  // Auto-refresh
  useEffect(() => {
    if (trackedFlights.length === 0) return;
    const interval = setInterval(
      () => {
        trackedFlights.forEach((flight) => fetchFlight(flight));
      },
      localConfig.refreshInterval || 300000
    );
    return () => clearInterval(interval);
  }, [trackedFlights, localConfig.refreshInterval, fetchFlight]);

  // Select first flight by default
  useEffect(() => {
    if (
      trackedFlights.length > 0 &&
      (!selectedFlightId ||
        !trackedFlights.find((f) => f.id === selectedFlightId))
    ) {
      setSelectedFlightId(trackedFlights[0].id);
    }
  }, [trackedFlights, selectedFlightId]);

  // Helpers
  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '--:--';
    const parts = dateStr.split(' ');
    return parts[1] || '--:--';
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'landed':
        return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 'active':
      case 'en-route':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      case 'scheduled':
        return 'text-muted-foreground bg-muted';
      case 'cancelled':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      case 'delayed':
        return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusDotColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'landed':
        return 'bg-green-500';
      case 'active':
      case 'en-route':
        return 'bg-blue-500 animate-pulse';
      case 'scheduled':
        return 'bg-muted-foreground';
      case 'cancelled':
        return 'bg-red-500';
      case 'delayed':
        return 'bg-orange-500';
      default:
        return 'bg-muted-foreground';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getFlightDate = (data: FlightData, fallbackDate: string) => {
    if (data?.departure?.scheduled) {
      const datePart = data.departure.scheduled.split(' ')[0];
      return formatDate(datePart);
    }
    return formatDate(fallbackDate);
  };

  // Get primary flight data (first tracked flight)
  const primaryFlight = trackedFlights[0];
  const primaryData = primaryFlight
    ? flightDataMap[primaryFlight.id]
    : undefined;
  const primaryLoading = primaryFlight
    ? loadingMap[primaryFlight.id]
    : false;
  const primaryError = primaryFlight
    ? errorMap[primaryFlight.id]
    : undefined;

  // Persist config
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
    setConfigSnapshot(null);
  };

  const handleSettingsOpenChange = (open: boolean) => {
    if (open) {
      setConfigSnapshot({ ...localConfig });
    } else if (configSnapshot) {
      setLocalConfig(configSnapshot);
      setConfigSnapshot(null);
    }
    setShowSettings(open);
  };

  const handleCancelSettings = () => {
    if (configSnapshot) {
      setLocalConfig(configSnapshot);
      setConfigSnapshot(null);
    }
    setShowSettings(false);
  };

  const updateConfig = (updates: Partial<FlightTrackerWidgetConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    if (config?.onUpdate) {
      config.onUpdate(newConfig);
    }
  };

  const addTrackedFlight = () => {
    if (!addFlightNumber.trim()) return;
    const newFlight: TrackedFlight = {
      id: `flight-${Date.now()}`,
      flightNumber: addFlightNumber.toUpperCase().trim(),
      flightDate: addFlightDate,
    };
    // Use derived trackedFlights to include legacy single-flight entries
    const flights = [...trackedFlights, newFlight];
    setLocalConfig((prev) => ({ ...prev, trackedFlights: flights }));
    setAddFlightNumber('');
    setAddFlightDate(new Date().toISOString().split('T')[0]);
  };

  const removeTrackedFlight = (id: string) => {
    const flights = (localConfig.trackedFlights || []).filter(
      (f) => f.id !== id
    );
    setLocalConfig((prev) => ({ ...prev, trackedFlights: flights }));
  };

  const setupBlocked =
    setupState === 'unconfigured' || setupState === 'error';

  // --- Setup prompt when no flights configured ---
  const renderSetup = () => {
    if (setupState === 'checking') {
      if (isCompact) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-2 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <p className="text-xs">Checking flight setup</p>
          </div>
        );
      }

      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p className="text-sm">Checking flight data setup</p>
        </div>
      );
    }

    if (setupBlocked) {
      if (isCompact) {
        const isSetupError = setupState === 'error';

        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-2 text-center">
            {isSetupError ? (
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
            ) : (
              <Plane className="h-6 w-6 text-muted-foreground" />
            )}
            <p className="text-xs font-medium leading-tight text-foreground">
              {isSetupError ? 'Couldn\u2019t verify flight setup' : 'Flight data setup needed'}
            </p>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  if (isSetupError) {
                    void checkFlightTrackerSetup();
                  } else {
                    setShowSettings(true);
                  }
                }}
              >
                {isSetupError ? 'Retry' : 'Setup'}
              </Button>
            )}
          </div>
        );
      }

      if (setupState === 'error') {
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Couldn&apos;t verify flight data setup
              </p>
              <p className="text-xs text-muted-foreground">
                Boxento couldn&apos;t reach the flight data proxy just now.
                Check your connection or proxy status, then retry the setup
                check before adding flights.
              </p>
            </div>
            {!readOnly && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void checkFlightTrackerSetup()}
                >
                  Retry Check
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                >
                  Open Settings
                </Button>
              </div>
            )}
          </div>
        );
      }

      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
          <Plane className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Finish flight data setup first
            </p>
            <p className="text-xs text-muted-foreground">
              Flight Tracker needs Boxento&apos;s AirLabs integration before it
              can look up flights. Configure the `/api/flights` proxy with an
              `AIRLABS_API_KEY` secret, then return here to add flights.
            </p>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(true)}
              >
                View Setup Requirements
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void checkFlightTrackerSetup()}
              >
                Recheck Setup
              </Button>
            </div>
          )}
        </div>
      );
    }

    if (isCompact) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-2 text-center">
          <Plane className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs font-medium leading-tight text-foreground">
            No flights tracked yet
          </p>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowSettings(true)}
            >
              Add Flight
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <Plane className="h-8 w-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            No flights tracked yet
          </p>
          <p className="text-xs text-muted-foreground">
            Flight data is ready. Add a flight number and date to start
            tracking it here.
          </p>
        </div>
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
          >
            Add Flight
          </Button>
        )}
      </div>
    );
  };

  // --- Tiny (1x1): plane icon + status dot ---
  const renderTiny = () => {
    if (!primaryData) {
      return (
        <div className="flex h-full flex-col items-center justify-center">
          <Plane className="h-5 w-5 text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5">
        <div className="relative">
          <Plane className="h-5 w-5 text-foreground" />
          <div
            className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${getStatusDotColor(primaryData.status)}`}
          />
        </div>
        <span className="text-[9px] font-medium text-muted-foreground leading-none">
          {primaryData.flight_iata}
        </span>
      </div>
    );
  };

  // --- Short (Nx1): flight number + status + ETA ---
  const renderShort = () => {
    if (trackedFlights.length === 0) {
      return (
        <div className="flex h-full items-center gap-2 px-1 text-xs text-muted-foreground">
          <Plane className="h-3.5 w-3.5 flex-shrink-0" />
          <span>No flights tracked</span>
        </div>
      );
    }

    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs">
        {trackedFlights.slice(0, Math.max(2, width)).map((flight) => {
          const data = flightDataMap[flight.id];
          const loading = loadingMap[flight.id];
          const error = errorMap[flight.id];

          if (loading) {
            return (
              <div
                key={flight.id}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/5 bg-black/[0.02] px-2.5 py-1 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>{flight.flightNumber}</span>
              </div>
            );
          }

          if (error || !data) {
            return (
              <div
                key={flight.id}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/5 bg-black/[0.02] px-2.5 py-1 text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]"
              >
                <AlertCircle className="h-3 w-3" />
                <span>{flight.flightNumber}</span>
              </div>
            );
          }

          return (
            <div
              key={flight.id}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/5 bg-black/[0.02] px-2.5 py-1 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div
                className={`h-2 w-2 rounded-full ${getStatusDotColor(data.status)}`}
              />
              <span className="font-medium">{data.flight_iata}</span>
              <span className="text-muted-foreground">
                {data.departure.iata}→{data.arrival.iata}
              </span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${getStatusColor(data.status)}`}
              >
                {data.status}
              </span>
              {data.arrival.scheduled && (
                <span className="text-muted-foreground">
                  ETA {formatTime(data.arrival.scheduled)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // --- Flight route visualization (shared between compact/default/panel) ---
  const renderFlightRoute = (data: FlightData, compact: boolean = false) => (
    <div className="w-full">
      <div className="flex items-start justify-between mb-1.5">
        <div className="text-left">
          <div
            className={`font-bold ${compact ? 'text-lg' : 'text-2xl'}`}
          >
            {data.departure.iata}
          </div>
          <div
            className={`text-muted-foreground truncate ${compact ? 'text-[10px] max-w-[60px]' : 'text-xs max-w-[80px]'}`}
          >
            {data.departure.city}
          </div>
        </div>

        <div className="flex-grow mx-3 flex items-center">
          <div className="flex-grow border-t-2 border-dashed border-muted-foreground/30 relative">
            <Plane
              className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 text-muted-foreground bg-card px-1"
              size={compact ? 12 : 16}
            />
          </div>
        </div>

        <div className="text-right">
          <div
            className={`font-bold ${compact ? 'text-lg' : 'text-2xl'}`}
          >
            {data.arrival.iata}
          </div>
          <div
            className={`text-muted-foreground truncate ${compact ? 'text-[10px] max-w-[60px]' : 'text-xs max-w-[80px]'}`}
          >
            {data.arrival.city}
          </div>
        </div>
      </div>

      <div
        className={`flex justify-between ${compact ? 'text-xs' : 'text-sm'}`}
      >
        <div className="text-left">
          <div className="font-semibold">
            {formatTime(data.departure.scheduled)}
          </div>
          {!compact && data.departure.terminal && (
            <div className="text-[10px] text-muted-foreground">
              T{data.departure.terminal}
              {data.departure.gate ? ` G${data.departure.gate}` : ''}
            </div>
          )}
        </div>
        <div className="text-center text-xs text-muted-foreground">
          {data.duration > 0
            ? `${Math.floor(data.duration / 60)}h ${data.duration % 60}m`
            : ''}
        </div>
        <div className="text-right">
          <div className="font-semibold">
            {formatTime(data.arrival.scheduled)}
          </div>
          {!compact && data.arrival.terminal && (
            <div className="text-[10px] text-muted-foreground">
              T{data.arrival.terminal}
              {data.arrival.gate ? ` G${data.arrival.gate}` : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // --- Compact (<=2x2): primary flight summary ---
  const renderCompact = () => {
    if (!primaryData) {
      if (primaryLoading) {
        return (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        );
      }
      if (primaryError) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-1 text-center p-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-[10px] text-red-500 line-clamp-2">{primaryError}</p>
          </div>
        );
      }
      return renderSetup();
    }

    return (
      <div className="flex-1 flex flex-col justify-center p-1 space-y-1.5 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">{primaryData.flight_iata}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${getStatusColor(primaryData.status)}`}
          >
            {primaryData.status}
          </span>
        </div>
        {renderFlightRoute(primaryData, true)}
      </div>
    );
  };

  // --- Default (3x3): full flight card ---
  const renderDefault = () => {
    if (!primaryData) {
      if (primaryLoading) {
        return (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        );
      }
      if (primaryError) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-4">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <p className="text-sm text-red-500">{primaryError}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  primaryFlight && fetchFlight(primaryFlight)
                }
              >
                Retry
              </Button>
              {!readOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSettings(true)}
                >
                  Settings
                </Button>
              )}
            </div>
          </div>
        );
      }
      return renderSetup();
    }

    return (
      <div className="flex-1 flex flex-col p-2 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{primaryData.flight_iata}</span>
            <span className="text-xs text-muted-foreground">
              {primaryFlight &&
                getFlightDate(
                  primaryData,
                  primaryFlight.flightDate
                )}
            </span>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${getStatusColor(primaryData.status)}`}
          >
            {primaryData.status}
          </span>
        </div>

        {/* Route */}
        <div className="flex-1 flex items-center">
          {renderFlightRoute(primaryData)}
        </div>

        {/* Airline + refresh */}
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{primaryData.airline_name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => primaryFlight && fetchFlight(primaryFlight)}
            className="h-auto p-0 flex items-center gap-1 hover:text-foreground transition-colors text-xs text-muted-foreground"
          >
            <RefreshCw size={12} />
            Refresh
          </Button>
        </div>

        {/* Other tracked flights summary */}
        {trackedFlights.length > 1 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1 flex-wrap">
              {trackedFlights.slice(1, 4).map((flight) => {
                const data = flightDataMap[flight.id];
                return (
                  <span
                    key={flight.id}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {data?.flight_iata || flight.flightNumber}
                    {data && (
                      <>
                        {' '}
                        <span className="capitalize">{data.status}</span>
                      </>
                    )}
                  </span>
                );
              })}
              {trackedFlights.length > 4 && (
                <span className="text-[10px] text-muted-foreground">
                  +{trackedFlights.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- Panel (4x4-5x5): split view with flight list + detail ---
  const renderPanel = () => {
    if (trackedFlights.length === 0) return renderSetup();

    const selectedData = selectedFlightId
      ? flightDataMap[selectedFlightId]
      : undefined;
    const selectedFlight = trackedFlights.find(
      (f) => f.id === selectedFlightId
    );

    return (
      <div className="flex flex-1 overflow-hidden">
        {/* Flight list */}
        <div className="w-2/5 border-r border-border/50 overflow-y-auto">
          {trackedFlights.map((flight) => {
            const data = flightDataMap[flight.id];
            const loading = loadingMap[flight.id];
            const isSelected = flight.id === selectedFlightId;

            return (
              <div
                key={flight.id}
                className={`p-3 cursor-pointer border-b border-border/30 transition-colors hover:bg-accent ${isSelected ? 'bg-accent' : ''}`}
                onClick={() => setSelectedFlightId(flight.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">
                    {data?.flight_iata || flight.flightNumber}
                  </span>
                  {loading ? (
                    <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : data ? (
                    <div
                      className={`h-2 w-2 rounded-full ${getStatusDotColor(data.status)}`}
                    />
                  ) : null}
                </div>
                {data && (
                  <div className="text-xs text-muted-foreground">
                    {data.departure.iata} → {data.arrival.iata}
                    <span className="ml-1 capitalize">{data.status}</span>
                  </div>
                )}
                {!data && !loading && errorMap[flight.id] && (
                  <div className="text-[10px] text-red-500 truncate">
                    {errorMap[flight.id]}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Detail pane */}
        <div className="flex-1 overflow-y-auto p-3">
          {selectedData && selectedFlight ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold">
                    {selectedData.flight_iata}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedData.airline_name} &middot;{' '}
                    {getFlightDate(
                      selectedData,
                      selectedFlight.flightDate
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${getStatusColor(selectedData.status)}`}
                >
                  {selectedData.status}
                </span>
              </div>

              {renderFlightRoute(selectedData)}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="text-xs font-medium">Departure</span>
                  </div>
                  <div className="text-foreground">
                    {selectedData.departure.airport}
                  </div>
                  {selectedData.departure.terminal && (
                    <div className="text-xs text-muted-foreground">
                      Terminal {selectedData.departure.terminal}
                      {selectedData.departure.gate
                        ? `, Gate ${selectedData.departure.gate}`
                        : ''}
                    </div>
                  )}
                  {selectedData.departure.delay &&
                    selectedData.departure.delay > 0 && (
                      <div className="text-xs text-orange-500">
                        Delayed {selectedData.departure.delay} min
                      </div>
                    )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="text-xs font-medium">Arrival</span>
                  </div>
                  <div className="text-foreground">
                    {selectedData.arrival.airport}
                  </div>
                  {selectedData.arrival.terminal && (
                    <div className="text-xs text-muted-foreground">
                      Terminal {selectedData.arrival.terminal}
                      {selectedData.arrival.gate
                        ? `, Gate ${selectedData.arrival.gate}`
                        : ''}
                    </div>
                  )}
                  {selectedData.arrival.delay &&
                    selectedData.arrival.delay > 0 && (
                      <div className="text-xs text-orange-500">
                        Delayed {selectedData.arrival.delay} min
                      </div>
                    )}
                </div>
              </div>

              {/* Duration */}
              {selectedData.duration > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    Duration: {Math.floor(selectedData.duration / 60)}h{' '}
                    {selectedData.duration % 60}m
                  </span>
                </div>
              )}

              {/* Route map placeholder */}
              <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                <MapPin className="h-6 w-6 mx-auto mb-1" />
                Route map
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchFlight(selectedFlight)}
                className="h-auto p-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw size={12} />
                Refresh
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Plane className="h-8 w-8 mb-2" />
              <p className="text-sm">Select a flight to view details</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- App (6x6+): full application with master-detail, add inline ---
  const renderApp = () => {
    if (trackedFlights.length === 0) return renderSetup();

    const selectedData = selectedFlightId
      ? flightDataMap[selectedFlightId]
      : undefined;
    const selectedFlight = trackedFlights.find(
      (f) => f.id === selectedFlightId
    );

    return (
      <div className="flex h-full">
        {/* Master list */}
        <div className="w-1/3 border-r border-border/50 flex flex-col overflow-hidden">
          {/* Add flight inline */}
          {!readOnly && (
            <div className="p-3 space-y-2 widget-drag-handle cursor-move">
              <div className="flex gap-2">
                <Input
                  placeholder="Flight (e.g. AA100)"
                  value={addFlightNumber}
                  onChange={(e) =>
                    setAddFlightNumber(e.target.value.toUpperCase())
                  }
                  className="text-xs h-8"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2"
                  onClick={() => {
                    if (addFlightNumber.trim()) {
                      const newFlight: TrackedFlight = {
                        id: `flight-${Date.now()}`,
                        flightNumber: addFlightNumber.toUpperCase().trim(),
                        flightDate: addFlightDate,
                      };
                      updateConfig({
                        trackedFlights: [
                          ...(localConfig.trackedFlights || []),
                          newFlight,
                        ],
                      });
                      setAddFlightNumber('');
                    }
                  }}
                  disabled={!addFlightNumber.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Flight list with summary stats */}
          <div className="p-2 border-b border-border/30 flex items-center justify-between text-xs text-muted-foreground">
            <span>{trackedFlights.length} flights</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                trackedFlights.forEach((f) => fetchFlight(f))
              }
              className="h-auto p-0 flex items-center gap-1 hover:text-foreground transition-colors text-xs text-muted-foreground"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh all
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {trackedFlights.map((flight) => {
              const data = flightDataMap[flight.id];
              const loading = loadingMap[flight.id];
              const isSelected = flight.id === selectedFlightId;

              return (
                <div
                  key={flight.id}
                  className={`p-3 cursor-pointer border-b border-border/30 transition-colors hover:bg-accent ${isSelected ? 'bg-accent' : ''}`}
                  onClick={() => setSelectedFlightId(flight.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">
                      {data?.flight_iata || flight.flightNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {loading && (
                        <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                      {data && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${getStatusColor(data.status)}`}
                        >
                          {data.status}
                        </span>
                      )}
                    </div>
                  </div>
                  {data && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>
                        {data.departure.iata} → {data.arrival.iata}
                      </span>
                      <span className="text-muted-foreground/50">|</span>
                      <span>{formatTime(data.departure.scheduled)}</span>
                    </div>
                  )}
                  {!data && !loading && errorMap[flight.id] && (
                    <div className="text-[10px] text-red-500 truncate">
                      {errorMap[flight.id]}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {formatDate(flight.flightDate)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail pane */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedData && selectedFlight ? (
            <div className="space-y-5 max-w-lg mx-auto">
              {/* Flight header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {selectedData.flight_iata}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedData.airline_name} &middot;{' '}
                    {getFlightDate(
                      selectedData,
                      selectedFlight.flightDate
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm px-3 py-1 rounded-full font-medium capitalize ${getStatusColor(selectedData.status)}`}
                  >
                    {selectedData.status}
                  </span>
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        updateConfig({
                          trackedFlights: (
                            localConfig.trackedFlights || []
                          ).filter(
                            (f) => f.id !== selectedFlight.id
                          ),
                        });
                        setSelectedFlightId(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Route visualization */}
              <div className="p-4 rounded-lg bg-muted/20 border border-border/30">
                {renderFlightRoute(selectedData)}
              </div>

              {/* Departure & Arrival detail */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-border/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Departure
                  </div>
                  <div className="text-sm">{selectedData.departure.airport}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedData.departure.city}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>
                      Scheduled:{' '}
                      {formatTime(selectedData.departure.scheduled)}
                    </span>
                  </div>
                  {selectedData.departure.actual && (
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span>
                        Actual:{' '}
                        {formatTime(selectedData.departure.actual)}
                      </span>
                    </div>
                  )}
                  {selectedData.departure.terminal && (
                    <div className="text-xs text-muted-foreground">
                      Terminal {selectedData.departure.terminal}
                      {selectedData.departure.gate
                        ? ` / Gate ${selectedData.departure.gate}`
                        : ''}
                    </div>
                  )}
                  {selectedData.departure.delay &&
                    selectedData.departure.delay > 0 && (
                      <div className="text-xs text-orange-500 font-medium">
                        Delayed {selectedData.departure.delay} min
                      </div>
                    )}
                </div>

                <div className="p-3 rounded-lg border border-border/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Arrival
                  </div>
                  <div className="text-sm">{selectedData.arrival.airport}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedData.arrival.city}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>
                      Scheduled:{' '}
                      {formatTime(selectedData.arrival.scheduled)}
                    </span>
                  </div>
                  {selectedData.arrival.actual && (
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span>
                        Actual:{' '}
                        {formatTime(selectedData.arrival.actual)}
                      </span>
                    </div>
                  )}
                  {selectedData.arrival.terminal && (
                    <div className="text-xs text-muted-foreground">
                      Terminal {selectedData.arrival.terminal}
                      {selectedData.arrival.gate
                        ? ` / Gate ${selectedData.arrival.gate}`
                        : ''}
                    </div>
                  )}
                  {selectedData.arrival.delay &&
                    selectedData.arrival.delay > 0 && (
                      <div className="text-xs text-orange-500 font-medium">
                        Delayed {selectedData.arrival.delay} min
                      </div>
                    )}
                </div>
              </div>

              {/* Duration */}
              {selectedData.duration > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/20 border border-border/30">
                  <Clock className="h-4 w-4" />
                  <span>
                    Flight duration: {Math.floor(selectedData.duration / 60)}h{' '}
                    {selectedData.duration % 60}m
                  </span>
                </div>
              )}

              {/* Progress bar for active flights */}
              {(selectedData.status === 'active' ||
                selectedData.status === 'en-route') &&
                selectedData.progress > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{Math.round(selectedData.progress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${selectedData.progress}%` }}
                      />
                    </div>
                  </div>
                )}

              {/* Route map placeholder */}
              <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2" />
                Route map placeholder
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchFlight(selectedFlight)}
                className="h-auto p-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw size={12} />
                Refresh flight data
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Plane className="h-10 w-10 mb-3" />
              <p className="text-sm">Select a flight to view details</p>
              <p className="text-xs mt-1">
                or add a new flight from the sidebar
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Settings modal ---
  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
      <DialogContent className="settings-dialog-content sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Flight Tracker Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {setupBlocked && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-left">
              <div className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="space-y-1">
                  {setupState === 'error' ? (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        Setup status unavailable
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Boxento couldn&apos;t verify whether the flight data proxy
                        is reachable. Retry the check once the connection or
                        proxy is healthy.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Add-flight controls stay disabled until setup can be
                        verified.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        Flight data setup required
                      </p>
                      <p className="text-sm text-muted-foreground">
                        This widget can&apos;t fetch live flights until
                        Boxento&apos;s `/api/flights` proxy is connected to
                        AirLabs with an `AIRLABS_API_KEY` secret.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Once that integration is ready, reopen this dialog to
                        add flights.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Widget title */}
          <div>
            <Label htmlFor="ft-title">Title</Label>
            <Input
              id="ft-title"
              value={localConfig.title || ''}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  title: e.target.value,
                }))
              }
            />
          </div>

          {/* Tracked flights list */}
          <div>
            <Label>Tracked Flights</Label>
            <div className="mt-2 max-h-[200px] overflow-y-auto border rounded-lg divide-y">
              {(localConfig.trackedFlights || []).length === 0 &&
                !localConfig.flightNumber && (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    No flights tracked yet
                  </div>
                )}
              {/* Show legacy single flight */}
              {localConfig.flightNumber &&
                (!localConfig.trackedFlights ||
                  localConfig.trackedFlights.length === 0) && (
                  <div className="flex items-center justify-between p-2">
                    <div>
                      <span className="text-sm font-medium">
                        {localConfig.flightNumber}
                      </span>
                      {localConfig.flightDate && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {formatDate(localConfig.flightDate)}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          flightNumber: '',
                          flightDate: '',
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              {(localConfig.trackedFlights || []).map((flight) => (
                <div
                  key={flight.id}
                  className="flex items-center justify-between p-2"
                >
                  <div>
                    <span className="text-sm font-medium">
                      {flight.flightNumber}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {formatDate(flight.flightDate)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTrackedFlight(flight.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Add new flight */}
          <div
            className={cn(
              'space-y-2',
              setupBlocked && 'pointer-events-none opacity-60'
            )}
          >
            <Label>Add Flight</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. AA100, LA621"
                value={addFlightNumber}
                onChange={(e) =>
                  setAddFlightNumber(e.target.value.toUpperCase())
                }
                className="flex-1"
                disabled={setupBlocked}
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  size="sm"
                  disabled={setupBlocked}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {addFlightDate
                    ? format(
                        new Date(addFlightDate + 'T00:00:00'),
                        'PPP'
                      )
                    : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={
                    addFlightDate
                      ? new Date(addFlightDate + 'T00:00:00')
                      : undefined
                  }
                  onSelect={(date) => {
                    if (date) {
                      setAddFlightDate(format(date, 'yyyy-MM-dd'));
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              className="w-full"
              onClick={addTrackedFlight}
              disabled={setupBlocked || !addFlightNumber.trim()}
            >
              <Plus className="h-4 w-4 mr-2" /> Add Flight
            </Button>
            {setupBlocked && (
              <p className="text-xs text-muted-foreground">
                Add-flight controls unlock after the flight-data integration is
                configured.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            {config?.onDelete && (
              <Button variant="destructive" onClick={config.onDelete}>
                Delete Widget
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={handleCancelSettings}>
                Cancel
              </Button>
              <Button onClick={saveSettings}>Save</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // --- Main render ---
  return (
    <div
      className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}
    >
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title || defaultConfig.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      {isTiny ? (
        renderTiny()
      ) : isShort ? (
        renderShort()
      ) : trackedFlights.length === 0 ? (
        renderSetup()
      ) : isApp ? (
        renderApp()
      ) : isWide && isTall ? (
        renderPanel()
      ) : isCompact ? (
        renderCompact()
      ) : (
        renderDefault()
      )}

      {!readOnly && renderSettings()}
    </div>
  );
};

export default FlightTrackerWidget;
