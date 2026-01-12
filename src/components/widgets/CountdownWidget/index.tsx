import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
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
  Switch,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import type { CountdownWidgetProps, TimeRemaining } from './types';

const CountdownWidget: React.FC<CountdownWidgetProps> = ({ width, height, config }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [targetDate, setTargetDate] = useState(config?.targetDate || '');
  const [eventName, setEventName] = useState(config?.eventName || '');
  const [showTime, setShowTime] = useState(config?.showTime ?? true);
  const [inputEventName, setInputEventName] = useState(config?.eventName || '');
  const [inputShowTime, setInputShowTime] = useState(config?.showTime ?? true);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);

  // Separate date and time state for the picker
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    if (config?.targetDate) {
      return new Date(config.targetDate);
    }
    return undefined;
  });
  const [selectedHour, setSelectedHour] = useState(() => {
    if (config?.targetDate) {
      return new Date(config.targetDate).getHours().toString().padStart(2, '0');
    }
    return '12';
  });
  const [selectedMinute, setSelectedMinute] = useState(() => {
    if (config?.targetDate) {
      return new Date(config.targetDate).getMinutes().toString().padStart(2, '0');
    }
    return '00';
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Calculate time remaining
  useEffect(() => {
    if (!targetDate) {
      setTimeRemaining(null);
      return;
    }

    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isPast: true
        });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds, isPast: false });
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  // Save settings
  const handleSave = () => {
    // Combine date and time into ISO string
    let newTargetDate = '';
    if (selectedDate) {
      const dateWithTime = new Date(selectedDate);
      dateWithTime.setHours(parseInt(selectedHour, 10));
      dateWithTime.setMinutes(parseInt(selectedMinute, 10));
      dateWithTime.setSeconds(0);
      newTargetDate = dateWithTime.toISOString();
    }

    setTargetDate(newTargetDate);
    setEventName(inputEventName);
    setShowTime(inputShowTime);

    if (config?.onUpdate) {
      config.onUpdate({
        ...config,
        targetDate: newTargetDate,
        eventName: inputEventName,
        showTime: inputShowTime
      });
    }
    setShowSettings(false);
  };

  // Determine if compact mode based on size
  const isCompact = width <= 2 && height <= 2;

  // Render setup view when no date configured
  const renderSetup = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <CalendarIcon size={32} className="text-gray-400 mb-3" strokeWidth={1.5} />
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Set a countdown date
      </p>
      <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>
        Configure
      </Button>
    </div>
  );

  // Render countdown display
  const renderCountdown = () => {
    if (!timeRemaining) return renderSetup();

    if (timeRemaining.isPast) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
            {eventName || 'Event'} is here!
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(targetDate).toLocaleDateString()}
          </div>
        </div>
      );
    }

    // Compact view for small widgets
    if (isCompact) {
      return (
        <div className="h-full flex flex-col items-center justify-center">
          {eventName && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate max-w-full px-2">
              {eventName}
            </div>
          )}
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {timeRemaining.days}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {timeRemaining.days === 1 ? 'day' : 'days'}
          </div>
          {showTime && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {String(timeRemaining.hours).padStart(2, '0')}:
              {String(timeRemaining.minutes).padStart(2, '0')}:
              {String(timeRemaining.seconds).padStart(2, '0')}
            </div>
          )}
        </div>
      );
    }

    // Full view for larger widgets
    return (
      <div className="h-full flex flex-col items-center justify-center">
        {eventName && (
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 text-center px-2">
            {eventName}
          </div>
        )}

        <div className="flex gap-4 items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {timeRemaining.days}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {timeRemaining.days === 1 ? 'day' : 'days'}
            </div>
          </div>

          {showTime && (
            <>
              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                  {String(timeRemaining.hours).padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">hrs</div>
              </div>

              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                  {String(timeRemaining.minutes).padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">min</div>
              </div>

              {width >= 3 && (
                <div className="flex flex-col items-center">
                  <div className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                    {String(timeRemaining.seconds).padStart(2, '0')}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">sec</div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          {new Date(targetDate).toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>
    );
  };

  // Settings dialog
  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Countdown Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="eventName">Event Name</Label>
            <Input
              id="eventName"
              placeholder="My Birthday, Vacation, etc."
              value={inputEventName}
              onChange={(e) => setInputEventName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Target Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : <span className="text-muted-foreground">Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setCalendarOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Time</Label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={selectedHour}
                  onChange={(e) => {
                    const val = Math.min(23, Math.max(0, parseInt(e.target.value) || 0));
                    setSelectedHour(val.toString().padStart(2, '0'));
                  }}
                  className="w-16 text-center"
                />
                <span className="text-muted-foreground">:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={selectedMinute}
                  onChange={(e) => {
                    const val = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                    setSelectedMinute(val.toString().padStart(2, '0'));
                  }}
                  className="w-16 text-center"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {parseInt(selectedHour) >= 12 ? 'PM' : 'AM'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="showTime"
              checked={inputShowTime}
              onCheckedChange={setInputShowTime}
            />
            <Label htmlFor="showTime">Show hours/minutes/seconds</Label>
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
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="widget-container h-full flex flex-col">
      <WidgetHeader
        title={config?.title || 'Countdown'}
        onSettingsClick={() => setShowSettings(true)}
      />

      <div className="flex-grow overflow-hidden p-3">
        {renderCountdown()}
      </div>

      {renderSettings()}
    </div>
  );
};

export default CountdownWidget;
