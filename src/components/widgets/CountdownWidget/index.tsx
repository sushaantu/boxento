import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Pencil } from 'lucide-react';
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
import { Switch } from '../../ui/switch';
import { Calendar } from '../../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import WidgetHeader from '../common/WidgetHeader';
import type { CountdownWidgetProps, CountdownWidgetConfig, CountdownEvent, TimeRemaining } from './types';
import { cn } from '@/lib/utils';

// ---------- helpers ----------

const generateId = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316',
];

function calcTimeRemaining(targetDate: string): TimeRemaining {
  const now = Date.now();
  const target = new Date(targetDate).getTime();
  const difference = target - now;

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true, totalMs: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((difference % (1000 * 60)) / 1000),
    isPast: false,
    totalMs: difference,
  };
}

/** Progress fraction 0-1 between creation and target (clamped). */
function progressFraction(targetDate: string): number {
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  // Assume the countdown "started" 2x the remaining time ago if we don't track creation.
  // A simple heuristic: progress = time elapsed / total span.  Since we don't persist
  // creation date, we base the ring on "fraction of the day done" for visual interest,
  // but for multi-event we use days-remaining as a relative bar.
  const diff = target - now;
  if (diff <= 0) return 1;
  // Show a pulsing seconds-based ring for the current day fraction
  const dayFraction = 1 - (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.min(1, dayFraction));
}

// ---------- SVG progress ring ----------

const ProgressRing: React.FC<{
  radius: number;
  stroke: number;
  progress: number;
  color: string;
  children?: React.ReactNode;
}> = ({ radius, stroke, progress, color, children }) => {
  const normalizedRadius = radius - stroke;
  const circumference = 2 * Math.PI * normalizedRadius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={radius * 2} height={radius * 2}>
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-secondary"
        />
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${radius} ${radius})`}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
};

// ---------- defaults ----------

const defaultConfig: CountdownWidgetConfig = {
  title: 'Countdown',
  eventName: '',
  targetDate: '',
  showTime: true,
  events: [],
};

// ==========================================================
// CountdownWidget
// ==========================================================

const CountdownWidget: React.FC<CountdownWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  // --- State ---
  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<CountdownWidgetConfig>({
    ...defaultConfig,
    ...config,
  });
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [settingsSnapshot, setSettingsSnapshot] = useState<CountdownWidgetConfig | null>(null);

  // App-mode state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<CountdownEvent | null>(null);

  // Settings form transient state
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Calculate time remaining for primary countdown
  useEffect(() => {
    const target = localConfig.targetDate;
    if (!target) {
      setTimeRemaining(null);
      return;
    }

    const tick = () => setTimeRemaining(calcTimeRemaining(target));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [localConfig.targetDate]);

  // --- All events (primary + extras) ---
  const allEvents = useMemo((): CountdownEvent[] => {
    const primary: CountdownEvent | null = localConfig.targetDate
      ? {
          id: '__primary__',
          name: localConfig.eventName || 'Event',
          targetDate: localConfig.targetDate,
          showTime: localConfig.showTime,
          color: DEFAULT_COLORS[0],
        }
      : null;
    const extras = (localConfig.events || []).filter(e => e.targetDate);
    return primary ? [primary, ...extras] : extras;
  }, [localConfig.targetDate, localConfig.eventName, localConfig.showTime, localConfig.events]);

  // Time remaining map for all events (refreshed every second)
  const [allTimeRemaining, setAllTimeRemaining] = useState<Record<string, TimeRemaining>>({});

  useEffect(() => {
    if (allEvents.length === 0) return;
    const tick = () => {
      const map: Record<string, TimeRemaining> = {};
      for (const ev of allEvents) {
        map[ev.id] = calcTimeRemaining(ev.targetDate);
      }
      setAllTimeRemaining(map);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [allEvents]);

  // --- Persist helpers ---
  const persistConfig = useCallback((updates: Partial<CountdownWidgetConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    if (config?.onUpdate) config.onUpdate(newConfig);
  }, [localConfig, config]);

  // --- Settings modal open/close with snapshot/revert ---
  const openSettings = useCallback(() => {
    setSettingsSnapshot({ ...localConfig });
    setShowSettings(true);
  }, [localConfig]);

  const cancelSettings = useCallback(() => {
    if (settingsSnapshot) setLocalConfig(settingsSnapshot);
    setSettingsSnapshot(null);
    setShowSettings(false);
  }, [settingsSnapshot]);

  const saveSettings = useCallback(() => {
    if (config?.onUpdate) config.onUpdate(localConfig);
    setSettingsSnapshot(null);
    setShowSettings(false);
  }, [config, localConfig]);

  // --- Convenience ---
  const daysLabel = (d: number) => (d === 1 ? 'day' : 'days');
  const hasCountdown = !!localConfig.targetDate && !!timeRemaining;

  // =======================================================
  //  TIER RENDERERS
  // =======================================================

  // 1x1 ICON: days remaining as large number
  const renderTiny = () => {
    if (!hasCountdown) {
      return (
        <div className="flex h-full flex-col items-center justify-center">
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>
      );
    }

    if (timeRemaining!.isPast) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-green-500">NOW</div>
          <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-green-500" />
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
        <div className="text-[2rem] font-bold leading-none text-blue-600 dark:text-blue-400">
          {timeRemaining!.days}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {daysLabel(timeRemaining!.days)}
        </div>
      </div>
    );
  };

  // Nx1 RIBBON: event name + countdown inline
  const renderRibbon = () => {
    if (!hasCountdown) {
      return (
        <div className="flex h-full items-center gap-2 px-1">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground truncate">No countdown set</span>
        </div>
      );
    }

    const tr = timeRemaining!;
    const eventsToShow = allEvents.slice(0, Math.max(1, width - 1));

    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1">
        {eventsToShow.map((ev) => {
          const evTr = allTimeRemaining[ev.id] || tr;
          return (
            <div
              key={ev.id}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${ev.color || DEFAULT_COLORS[0]}20` }}
            >
              <div
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: ev.color || DEFAULT_COLORS[0] }}
              />
              <span className="max-w-[100px] truncate text-xs font-medium text-foreground">
                {ev.name}
              </span>
              <span className="text-xs font-bold text-foreground">
                {evTr.isPast ? 'Now!' : `${evTr.days}d`}
              </span>
              {!evTr.isPast && ev.showTime && (
                <span className="text-[10px] text-muted-foreground">
                  {String(evTr.hours).padStart(2, '0')}:{String(evTr.minutes).padStart(2, '0')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // 2x2 COMPACT: primary data only
  const renderCompact = () => {
    if (!hasCountdown) return renderSetupPrompt();
    const tr = timeRemaining!;

    if (tr.isPast) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {localConfig.eventName || 'Event'} is here!
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        {localConfig.eventName && (
          <div className="text-xs text-muted-foreground mb-1 truncate max-w-full px-2">
            {localConfig.eventName}
          </div>
        )}
        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
          {tr.days}
        </div>
        <div className="text-xs text-muted-foreground">
          {daysLabel(tr.days)}
        </div>
        {localConfig.showTime && (
          <div className="text-xs text-muted-foreground/70 mt-1">
            {String(tr.hours).padStart(2, '0')}:
            {String(tr.minutes).padStart(2, '0')}:
            {String(tr.seconds).padStart(2, '0')}
          </div>
        )}
      </div>
    );
  };

  // 3x3 DEFAULT: balanced countdown display with progress ring
  const renderDefault = () => {
    if (!hasCountdown) return renderSetupPrompt();
    const tr = timeRemaining!;

    if (tr.isPast) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
            {localConfig.eventName || 'Event'} is here!
          </div>
          <div className="text-sm text-muted-foreground">
            {new Date(localConfig.targetDate!).toLocaleDateString()}
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        {localConfig.eventName && (
          <div className="text-sm text-muted-foreground mb-3 text-center px-2">
            {localConfig.eventName}
          </div>
        )}

        <div className="flex gap-4 items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {tr.days}
            </div>
            <div className="text-xs text-muted-foreground">
              {daysLabel(tr.days)}
            </div>
          </div>

          {localConfig.showTime && (
            <>
              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-foreground">
                  {String(tr.hours).padStart(2, '0')}
                </div>
                <div className="text-xs text-muted-foreground">hrs</div>
              </div>

              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-foreground">
                  {String(tr.minutes).padStart(2, '0')}
                </div>
                <div className="text-xs text-muted-foreground">min</div>
              </div>

              {width >= 3 && (
                <div className="flex flex-col items-center">
                  <div className="text-3xl font-bold text-foreground">
                    {String(tr.seconds).padStart(2, '0')}
                  </div>
                  <div className="text-xs text-muted-foreground">sec</div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="text-xs text-muted-foreground/70 mt-3 truncate max-w-full px-2">
          {new Date(localConfig.targetDate!).toLocaleDateString(undefined, {
            weekday: width >= 4 ? 'long' : 'short',
            year: 'numeric',
            month: width >= 4 ? 'long' : 'short',
            day: 'numeric',
          })}
        </div>
      </div>
    );
  };

  // 4x4-5x5 PANEL: primary countdown with progress ring + secondary events list
  const renderPanel = () => {
    if (!hasCountdown) return renderSetupPrompt();
    const tr = timeRemaining!;
    const progress = progressFraction(localConfig.targetDate!);
    const sortedEvents = [...allEvents].sort((a, b) => {
      const aTr = allTimeRemaining[a.id];
      const bTr = allTimeRemaining[b.id];
      if (!aTr || !bTr) return 0;
      if (aTr.isPast && !bTr.isPast) return 1;
      if (!aTr.isPast && bTr.isPast) return -1;
      return aTr.totalMs - bTr.totalMs;
    });

    return (
      <div className="flex flex-1 overflow-hidden gap-3">
        {/* Primary countdown with ring */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <ProgressRing
            radius={70}
            stroke={6}
            progress={progress}
            color={DEFAULT_COLORS[0]}
          >
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {tr.isPast ? '0' : tr.days}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {tr.isPast ? 'arrived' : daysLabel(tr.days)}
            </div>
          </ProgressRing>
          <div className="text-sm font-medium mt-3 text-center px-2 truncate max-w-full">
            {localConfig.eventName || 'Event'}
          </div>
          {localConfig.showTime && !tr.isPast && (
            <div className="text-xs text-muted-foreground mt-1">
              {String(tr.hours).padStart(2, '0')}:
              {String(tr.minutes).padStart(2, '0')}:
              {String(tr.seconds).padStart(2, '0')}
            </div>
          )}
          <div className="text-xs text-muted-foreground/70 mt-1">
            {new Date(localConfig.targetDate!).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>

        {/* Secondary events list */}
        {sortedEvents.length > 1 && (
          <div className="w-2/5 border-l overflow-y-auto pl-3">
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Upcoming
            </div>
            <div className="space-y-2">
              {sortedEvents.slice(1).map((ev) => {
                const evTr = allTimeRemaining[ev.id];
                if (!evTr) return null;
                return (
                  <div key={ev.id} className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: ev.color || DEFAULT_COLORS[1] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{ev.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {evTr.isPast
                          ? 'Arrived'
                          : `${evTr.days}d ${String(evTr.hours).padStart(2, '0')}h`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 6x6+ APP: full multi-countdown manager with progress rings, timeline, inline editing
  const renderApp = () => {
    const sortedEvents = [...allEvents].sort((a, b) => {
      const aTr = allTimeRemaining[a.id];
      const bTr = allTimeRemaining[b.id];
      if (!aTr || !bTr) return 0;
      if (aTr.isPast && !bTr.isPast) return 1;
      if (!aTr.isPast && bTr.isPast) return -1;
      return aTr.totalMs - bTr.totalMs;
    });

    const selectedEvent = selectedEventId
      ? allEvents.find((e) => e.id === selectedEventId)
      : sortedEvents[0] || null;
    const selectedTr = selectedEvent ? allTimeRemaining[selectedEvent.id] : null;

    return (
      <div className="flex h-full">
        {/* Master list */}
        <div className="w-1/3 border-r overflow-y-auto">
          <div className="p-2 flex items-center justify-between widget-drag-handle cursor-move">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {allEvents.length} countdown{allEvents.length !== 1 ? 's' : ''}
            </span>
            {!readOnly && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() =>
                  setEditingEvent({
                    id: generateId(),
                    name: '',
                    targetDate: '',
                    color: DEFAULT_COLORS[(allEvents.length) % DEFAULT_COLORS.length],
                    showTime: true,
                  })
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          {sortedEvents.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No countdowns yet. Add one to get started.
            </div>
          )}
          {sortedEvents.map((ev) => {
            const evTr = allTimeRemaining[ev.id];
            if (!evTr) return null;
            const isSelected = selectedEvent?.id === ev.id;
            return (
              <div
                key={ev.id}
                className={`flex items-center gap-2 p-3 cursor-pointer hover:bg-accent ${
                  isSelected ? 'bg-accent' : ''
                }`}
                onClick={() => setSelectedEventId(ev.id)}
              >
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: ev.color || DEFAULT_COLORS[0] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{ev.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {evTr.isPast
                      ? 'Arrived'
                      : `${evTr.days} ${daysLabel(evTr.days)} remaining`}
                  </div>
                </div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400 shrink-0">
                  {evTr.isPast ? '0' : evTr.days}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail pane */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedEvent && selectedTr ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              {/* Actions row */}
              {!readOnly && selectedEvent.id !== '__primary__' && (
                <div className="flex items-center gap-2 self-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingEvent({ ...selectedEvent })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const newEvents = (localConfig.events || []).filter(
                        (e) => e.id !== selectedEvent.id
                      );
                      persistConfig({ events: newEvents });
                      setSelectedEventId(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}

              <ProgressRing
                radius={90}
                stroke={8}
                progress={progressFraction(selectedEvent.targetDate)}
                color={selectedEvent.color || DEFAULT_COLORS[0]}
              >
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {selectedTr.isPast ? '0' : selectedTr.days}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedTr.isPast ? 'arrived' : daysLabel(selectedTr.days)}
                </div>
              </ProgressRing>

              <div className="text-xl font-semibold text-center">{selectedEvent.name}</div>

              {selectedEvent.showTime && !selectedTr.isPast && (
                <div className="flex gap-6 text-center">
                  {[
                    { value: selectedTr.hours, label: 'hours' },
                    { value: selectedTr.minutes, label: 'minutes' },
                    { value: selectedTr.seconds, label: 'seconds' },
                  ].map(({ value, label }) => (
                    <div key={label}>
                      <div className="text-2xl font-bold text-foreground">
                        {String(value).padStart(2, '0')}
                      </div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                {new Date(selectedEvent.targetDate).toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>

              {/* Visual timeline of all events */}
              {allEvents.length > 1 && (
                <div className="w-full max-w-md mt-4 space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Timeline
                  </div>
                  {sortedEvents.map((ev) => {
                    const evTr = allTimeRemaining[ev.id];
                    if (!evTr) return null;
                    const maxDays = Math.max(
                      ...sortedEvents
                        .map((e) => allTimeRemaining[e.id]?.days ?? 0)
                        .filter(d => d > 0),
                      1
                    );
                    const barWidth = evTr.isPast
                      ? 100
                      : Math.max(5, ((maxDays - evTr.days) / maxDays) * 100);

                    return (
                      <div key={ev.id} className="flex items-center gap-2">
                        <div className="w-24 text-xs truncate text-right text-muted-foreground">
                          {ev.name}
                        </div>
                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: ev.color || DEFAULT_COLORS[0],
                              opacity: ev.id === selectedEvent.id ? 1 : 0.5,
                            }}
                          />
                        </div>
                        <div className="w-10 text-xs text-right font-medium">
                          {evTr.isPast ? 'Now' : `${evTr.days}d`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Clock className="h-12 w-12 mb-3" />
              <p className="text-sm">
                {allEvents.length === 0
                  ? 'Create your first countdown'
                  : 'Select a countdown to view details'}
              </p>
              {allEvents.length === 0 && !readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => openSettings()}
                >
                  Open Settings
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Setup prompt (when no date configured) ---
  const renderSetupPrompt = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <CalendarIcon className="h-8 w-8" />
      <p className="text-sm">Set a countdown date</p>
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={() => openSettings()}>
          Configure
        </Button>
      )}
    </div>
  );

  // =======================================================
  //  EVENT EDIT DIALOG (for app-mode multi-event management)
  // =======================================================

  const renderEventEditor = () => {
    if (!editingEvent) return null;
    const isNew = !(localConfig.events || []).some((e) => e.id === editingEvent.id);

    const saveEvent = () => {
      if (!editingEvent.name.trim() || !editingEvent.targetDate) return;
      const events = [...(localConfig.events || [])];
      const idx = events.findIndex((e) => e.id === editingEvent.id);
      if (idx >= 0) {
        events[idx] = editingEvent;
      } else {
        events.push(editingEvent);
      }
      persistConfig({ events });
      setEditingEvent(null);
    };

    return (
      <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add Countdown' : 'Edit Countdown'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ev-name">Event Name</Label>
              <Input
                id="ev-name"
                placeholder="e.g. Vacation, Birthday..."
                value={editingEvent.name}
                onChange={(e) =>
                  setEditingEvent((prev) => prev && { ...prev, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Target Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editingEvent.targetDate
                      ? format(new Date(editingEvent.targetDate), 'PPP')
                      : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editingEvent.targetDate ? new Date(editingEvent.targetDate) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setEditingEvent((prev) =>
                          prev && { ...prev, targetDate: date.toISOString() }
                        );
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-1">
                {DEFAULT_COLORS.map((color) => (
                  <Button type="button" variant="ghost" size="none"
                    key={color}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${
                      editingEvent.color === color
                        ? 'border-foreground scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() =>
                      setEditingEvent((prev) => prev && { ...prev, color })
                    }
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ev-showtime">Show time</Label>
              <Switch
                id="ev-showtime"
                checked={editingEvent.showTime ?? true}
                onCheckedChange={(checked) =>
                  setEditingEvent((prev) => prev && { ...prev, showTime: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={() => setEditingEvent(null)}>
                Cancel
              </Button>
              <Button
                onClick={saveEvent}
                disabled={!editingEvent.name.trim() || !editingEvent.targetDate}
              >
                {isNew ? 'Add' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // =======================================================
  //  SETTINGS MODAL
  // =======================================================

  const renderSettings = () => {
    // Derive picker state from localConfig
    const selDate = localConfig.targetDate ? new Date(localConfig.targetDate) : undefined;
    const selHour = selDate ? selDate.getHours().toString().padStart(2, '0') : '12';
    const selMinute = selDate ? selDate.getMinutes().toString().padStart(2, '0') : '00';

    const updateTargetDate = (date: Date | undefined, hour?: string, minute?: string) => {
      if (!date) {
        setLocalConfig((prev) => ({ ...prev, targetDate: '' }));
        return;
      }
      const d = new Date(date);
      d.setHours(parseInt(hour ?? selHour, 10));
      d.setMinutes(parseInt(minute ?? selMinute, 10));
      d.setSeconds(0);
      setLocalConfig((prev) => ({ ...prev, targetDate: d.toISOString() }));
    };

    return (
      <Dialog
        open={showSettings}
        onOpenChange={(open) => {
          if (!open) cancelSettings();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Countdown Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={localConfig.title || ''}
                onChange={(e) =>
                  setLocalConfig((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="eventName">Event Name</Label>
              <Input
                id="eventName"
                placeholder="My Birthday, Vacation, etc."
                value={localConfig.eventName || ''}
                onChange={(e) =>
                  setLocalConfig((prev) => ({ ...prev, eventName: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Target Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selDate ? (
                      format(selDate, 'PPP')
                    ) : (
                      <span className="text-muted-foreground">Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selDate}
                    onSelect={(date) => {
                      updateTargetDate(date ?? undefined);
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Time</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={selHour}
                    onChange={(e) => {
                      const val = Math.min(23, Math.max(0, parseInt(e.target.value) || 0));
                      const h = val.toString().padStart(2, '0');
                      updateTargetDate(selDate, h, selMinute);
                    }}
                    className="w-16 text-center"
                  />
                  <span className="text-muted-foreground">:</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={selMinute}
                    onChange={(e) => {
                      const val = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                      const m = val.toString().padStart(2, '0');
                      updateTargetDate(selDate, selHour, m);
                    }}
                    className="w-16 text-center"
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  {parseInt(selHour) >= 12 ? 'PM' : 'AM'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="showTime">Show hours/minutes/seconds</Label>
              <Switch
                id="showTime"
                checked={localConfig.showTime ?? true}
                onCheckedChange={(checked) =>
                  setLocalConfig((prev) => ({ ...prev, showTime: checked }))
                }
              />
            </div>

            {/* Additional events list (editable in settings too) */}
            {(localConfig.events || []).length > 0 && (
              <div>
                <Label>Additional Countdowns</Label>
                <div className="max-h-[200px] overflow-y-auto border rounded-lg divide-y mt-1">
                  {(localConfig.events || []).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2 p-2">
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: ev.color || DEFAULT_COLORS[1] }}
                      />
                      <span className="flex-1 truncate text-sm">{ev.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditingEvent({ ...ev })}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setLocalConfig((prev) => ({
                            ...prev,
                            events: (prev.events || []).filter((e) => e.id !== ev.id),
                          }));
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                setEditingEvent({
                  id: generateId(),
                  name: '',
                  targetDate: '',
                  color: DEFAULT_COLORS[((localConfig.events || []).length + 1) % DEFAULT_COLORS.length],
                  showTime: true,
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" /> Add Countdown
            </Button>
          </div>

          <DialogFooter>
            <div className="flex justify-between w-full">
              {config?.onDelete && (
                <Button variant="destructive" onClick={config.onDelete}>
                  Delete Widget
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" onClick={cancelSettings}>
                  Cancel
                </Button>
                <Button onClick={saveSettings}>Save</Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // =======================================================
  //  MAIN RENDER
  // =======================================================

  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}>
      {!isTiny && !isApp && (
        <WidgetHeader
          title={localConfig.title || 'Countdown'}
          onSettingsClick={readOnly ? undefined : () => openSettings()}
          compact={isShort}
        />
      )}

      {isApp && (
        <WidgetHeader
          title={localConfig.title || 'Countdown'}
          onSettingsClick={readOnly ? undefined : () => openSettings()}
        />
      )}

      <div className={`flex-1 overflow-hidden ${isTiny ? 'p-1' : isApp ? '' : ''}`}>
        {isTiny
          ? renderTiny()
          : isShort
            ? renderRibbon()
            : isApp
              ? renderApp()
              : isWide && isTall
                ? renderPanel()
                : isCompact
                  ? renderCompact()
                  : renderDefault()}
      </div>

      {renderSettings()}
      {renderEventEditor()}
    </div>
  );
};

export default CountdownWidget;
