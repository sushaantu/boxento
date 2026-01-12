import React, { useState, useEffect, useCallback } from 'react';
import { Plane, RefreshCw, AlertCircle, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Button,
  Label,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import type { FlightTrackerWidgetProps } from './types';

// Flight data interface from AirLabs API
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

const FlightTrackerWidget: React.FC<FlightTrackerWidgetProps> = ({ config }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [flightNumber, setFlightNumber] = useState(config?.flightNumber || '');
  const [flightDate, setFlightDate] = useState(config?.flightDate || new Date().toISOString().split('T')[0]);
  const [inputValue, setInputValue] = useState(config?.flightNumber || '');
  const [inputDate, setInputDate] = useState(config?.flightDate || new Date().toISOString().split('T')[0]);
  const [flightData, setFlightData] = useState<FlightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch flight data
  const fetchFlight = useCallback(async (flight: string, date?: string) => {
    if (!flight) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ flight_iata: flight.toUpperCase() });
      if (date) {
        params.append('flight_date', date);
      }
      const response = await fetch(`/api/flights?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch flight');
      }

      if (!result.data) {
        setError('Flight not found');
        setFlightData(null);
      } else {
        setFlightData(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flight');
      setFlightData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount if flight number is configured
  useEffect(() => {
    if (flightNumber) {
      fetchFlight(flightNumber, flightDate);
    }
  }, [flightNumber, flightDate, fetchFlight]);

  // Format time from "2025-12-27 19:50" to "19:50"
  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '--:--';
    const parts = dateStr.split(' ');
    return parts[1] || '--:--';
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'landed': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'active':
      case 'en-route': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'scheduled': return 'text-gray-600 bg-gray-100 dark:bg-gray-800';
      case 'cancelled': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'delayed': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-800';
    }
  };

  // Save settings
  const handleSave = () => {
    const newFlightNumber = inputValue.toUpperCase().trim();
    setFlightNumber(newFlightNumber);
    setFlightDate(inputDate);
    if (config?.onUpdate) {
      config.onUpdate({ ...config, flightNumber: newFlightNumber, flightDate: inputDate });
    }
    setShowSettings(false);
    if (newFlightNumber) {
      fetchFlight(newFlightNumber, inputDate);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Render setup view when no flight configured
  const renderSetup = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <Plane size={32} className="text-gray-400 mb-3" strokeWidth={1.5} />
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Track your flight
      </p>
      <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>
        Add Flight
      </Button>
    </div>
  );

  // Render loading state
  const renderLoading = () => (
    <div className="h-full flex items-center justify-center">
      <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );

  // Render error state
  const renderError = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <AlertCircle size={32} className="text-red-500 mb-3" strokeWidth={1.5} />
      <p className="text-sm text-red-500 mb-3">{error}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => fetchFlight(flightNumber, flightDate)}>
          Retry
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>
          Settings
        </Button>
      </div>
    </div>
  );

  // Extract flight date from departure time
  const getFlightDate = () => {
    if (flightData?.departure?.scheduled) {
      const datePart = flightData.departure.scheduled.split(' ')[0];
      return formatDate(datePart);
    }
    return formatDate(flightDate);
  };

  // Check if API returned data for a different date than selected
  const isDateMismatch = () => {
    if (!flightData?.departure?.scheduled) return false;
    const apiDate = flightData.departure.scheduled.split(' ')[0];
    return apiDate !== flightDate;
  };

  // Render flight info - Flighty-style minimal design
  const renderFlight = () => {
    if (!flightData) return null;

    const dateMismatch = isDateMismatch();

    return (
      <div className="h-full flex flex-col p-3">
        {/* Date mismatch warning */}
        {dateMismatch && (
          <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs p-2 rounded mb-2 text-center">
            Flight for {formatDate(flightDate)} not available yet. Showing nearest scheduled flight.
          </div>
        )}

        {/* Header with flight number, date, and status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{flightData.flight_iata}</span>
            <span className="text-xs text-gray-500">• {getFlightDate()}</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${getStatusColor(flightData.status)}`}>
            {flightData.status}
          </span>
        </div>

        {/* Route visualization */}
        <div className="flex-grow flex items-center">
          <div className="w-full">
            {/* Cities and times */}
            <div className="flex justify-between items-start mb-2">
              <div className="text-left">
                <div className="text-2xl font-bold">{flightData.departure.iata}</div>
                <div className="text-xs text-gray-500 truncate max-w-[80px]">{flightData.departure.city}</div>
              </div>

              {/* Flight path visualization */}
              <div className="flex-grow mx-3 flex items-center">
                <div className="flex-grow border-t-2 border-dashed border-gray-300 dark:border-gray-600 relative">
                  <Plane
                    className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 px-1"
                    size={16}
                  />
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-bold">{flightData.arrival.iata}</div>
                <div className="text-xs text-gray-500 truncate max-w-[80px]">{flightData.arrival.city}</div>
              </div>
            </div>

            {/* Times */}
            <div className="flex justify-between text-sm">
              <div className="text-left">
                <div className="font-semibold">{formatTime(flightData.departure.scheduled)}</div>
                {flightData.departure.terminal && (
                  <div className="text-xs text-gray-500">T{flightData.departure.terminal}</div>
                )}
              </div>
              <div className="text-center text-xs text-gray-500">
                {Math.floor(flightData.duration / 60)}h {flightData.duration % 60}m
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatTime(flightData.arrival.scheduled)}</div>
                {flightData.arrival.terminal && (
                  <div className="text-xs text-gray-500">T{flightData.arrival.terminal}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={() => fetchFlight(flightNumber, flightDate)}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>
    );
  };

  // Settings dialog
  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Track Flight
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="flight">Flight Number</Label>
            <Input
              id="flight"
              placeholder="e.g. LA621, AA100, UA123"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            />
          </div>

          <div className="space-y-2">
            <Label>Flight Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {inputDate ? format(new Date(inputDate + 'T00:00:00'), 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={inputDate ? new Date(inputDate + 'T00:00:00') : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setInputDate(format(date, 'yyyy-MM-dd'));
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            {config?.onDelete && (
              <Button variant="destructive" onClick={config.onDelete}>
                Delete
              </Button>
            )}
            {!config?.onDelete && <div />}
            <Button onClick={handleSave}>
              Track Flight
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Main render
  const renderContent = () => {
    if (!flightNumber) return renderSetup();
    if (loading && !flightData) return renderLoading();
    if (error && !flightData) return renderError();
    if (flightData) return renderFlight();
    return renderSetup();
  };

  return (
    <div className="widget-container h-full flex flex-col">
      <WidgetHeader
        title={flightData?.flight_iata || "Flight Tracker"}
        onSettingsClick={() => setShowSettings(true)}
      />

      <div className="flex-grow overflow-hidden">
        {renderContent()}
      </div>

      {renderSettings()}
    </div>
  );
};

export default FlightTrackerWidget;
