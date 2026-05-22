import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../ui/dialog';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import WidgetHeader from '../common/WidgetHeader';
import { PomodoroWidgetConfig, PomodoroWidgetProps } from './types';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { faviconService } from '@/lib/services/favicon';
import { cn } from '@/lib/utils';

/**
 * Pomodoro Widget Component
 *
 * A productivity widget implementing the Pomodoro Technique for time management.
 * Supports the full "icon -> widget -> app" tier spectrum:
 *   1x1 Icon  |  Nx1 Ribbon  |  default/wide/tall/large  |  6x6+ App
 *
 * @param {PomodoroWidgetProps} props - Component props
 * @returns {JSX.Element} Widget component
 */
const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({ width, height, config }) => {
  // ── Size detection ──────────────────────────────────────────────
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  // Default configuration
  const defaultConfig: PomodoroWidgetConfig = {
    title: 'Pomodoro Timer',
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    cyclesBeforeLongBreak: 4
  };

  // Enum for timer modes
  enum TimerMode {
    WORK = 'work',
    BREAK = 'break',
    LONG_BREAK = 'longBreak'
  }

  // Component state
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<PomodoroWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  const [timeLeft, setTimeLeft] = useState<number>(localConfig.workDuration ? localConfig.workDuration * 60 : 25 * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [mode, setMode] = useState<TimerMode>(TimerMode.WORK);
  const [cyclesCompleted, setCyclesCompleted] = useState<number>(0);

  // Refs
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Merged config for settings reset
  const mergedConfig = useMemo(() => ({
    ...defaultConfig,
    ...config
  }), [config]);

  // Update local config when props config changes
  useEffect(() => {
    setLocalConfig((prevConfig: PomodoroWidgetConfig) => ({
      ...prevConfig,
      ...config
    }));
  }, [config]);

  // Timer logic
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive]);

  // Update favicon when timer state changes
  useEffect(() => {
    // Update favicon when timer state changes
    if (isActive || timeLeft < (localConfig.workDuration || 25) * 60) {
      faviconService.updatePomodoroFavicon(timeLeft, mode, isActive);
    } else {
      faviconService.resetToDefault();
    }

    // Cleanup on unmount
    return () => {
      // Only reset if this is our widget
      if (isActive || timeLeft < (localConfig.workDuration || 25) * 60) {
        faviconService.resetToDefault();
      }
    };
  }, [timeLeft, mode, isActive, localConfig.workDuration]);

  // Handle timer mode changes
  const handleTimerComplete = () => {
    let nextMode: TimerMode;
    let nextDuration: number;
    let nextCycles = cyclesCompleted;

    // Play notification sound
    const audio = new Audio('/sounds/bell.mp3');
    audio.play().catch(() => { /* Audio playback may fail if user hasn't interacted with page */ });

    if (mode === TimerMode.WORK) {
      nextCycles = cyclesCompleted + 1;
      setCyclesCompleted(nextCycles);

      if (nextCycles % (localConfig.cyclesBeforeLongBreak || 4) === 0) {
        nextMode = TimerMode.LONG_BREAK;
        nextDuration = (localConfig.longBreakDuration || 15) * 60;
      } else {
        nextMode = TimerMode.BREAK;
        nextDuration = (localConfig.breakDuration || 5) * 60;
      }
    } else {
      nextMode = TimerMode.WORK;
      nextDuration = (localConfig.workDuration || 25) * 60;
    }

    setMode(nextMode);
    setTimeLeft(nextDuration);
    setIsActive(true);
  };

  // Toggle timer active state
  const toggleTimer = () => {
    if (readOnly) return;
    setIsActive(!isActive);
  };

  // Reset timer
  const resetTimer = () => {
    if (readOnly) return;
    setIsActive(false);
    setMode(TimerMode.WORK);
    setCyclesCompleted(0);
    setTimeLeft((localConfig.workDuration || 25) * 60);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Skip to next mode
  const skipTimer = () => {
    if (readOnly) return;
    handleTimerComplete();
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get mode label
  const getModeLabel = (): string => {
    switch (mode) {
      case TimerMode.WORK:
        return 'Focus Time';
      case TimerMode.BREAK:
        return 'Short Break';
      case TimerMode.LONG_BREAK:
        return 'Long Break';
      default:
        return 'Focus Time';
    }
  };

  // Get short mode label for ribbon
  const getShortModeLabel = (): string => {
    switch (mode) {
      case TimerMode.WORK:
        return 'Work';
      case TimerMode.BREAK:
        return 'Break';
      case TimerMode.LONG_BREAK:
        return 'Long Break';
      default:
        return 'Work';
    }
  };

  // Get mode description
  const getModeDescription = (): string => {
    switch (mode) {
      case TimerMode.WORK:
        return 'Time to focus on your task';
      case TimerMode.BREAK:
        return 'Take a short breather';
      case TimerMode.LONG_BREAK:
        return 'Take a longer rest';
      default:
        return 'Time to focus on your task';
    }
  };

  // Get mode color
  const getModeColor = (): string => {
    switch (mode) {
      case TimerMode.WORK:
        return 'text-red-500 dark:text-red-400';
      case TimerMode.BREAK:
        return 'text-green-500 dark:text-green-400';
      case TimerMode.LONG_BREAK:
        return 'text-blue-500 dark:text-blue-400';
      default:
        return 'text-red-500 dark:text-red-400';
    }
  };

  // Get mode ring stroke color (for SVG)
  const getModeStrokeColor = (): string => {
    switch (mode) {
      case TimerMode.WORK:
        return '#ef4444';
      case TimerMode.BREAK:
        return '#22c55e';
      case TimerMode.LONG_BREAK:
        return '#3b82f6';
      default:
        return '#ef4444';
    }
  };

  // Get mode bg color
  const getModeBgColor = (): string => {
    switch (mode) {
      case TimerMode.WORK:
        return 'bg-red-500/10';
      case TimerMode.BREAK:
        return 'bg-green-500/10';
      case TimerMode.LONG_BREAK:
        return 'bg-blue-500/10';
      default:
        return 'bg-red-500/10';
    }
  };

  // Calculate progress percentage
  const getProgress = (): number => {
    let totalSeconds: number;
    switch (mode) {
      case TimerMode.WORK:
        totalSeconds = (localConfig.workDuration || 25) * 60;
        break;
      case TimerMode.BREAK:
        totalSeconds = (localConfig.breakDuration || 5) * 60;
        break;
      case TimerMode.LONG_BREAK:
        totalSeconds = (localConfig.longBreakDuration || 15) * 60;
        break;
      default:
        totalSeconds = (localConfig.workDuration || 25) * 60;
    }
    return ((totalSeconds - timeLeft) / totalSeconds) * 100;
  };

  // ── 1x1 Icon: Large timer text, colored by mode ────────────────
  const renderTinyView = () => {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
        <div className={`text-lg font-bold leading-none ${getModeColor()} ${!isActive ? 'opacity-50' : ''}`}>
          {formatTime(timeLeft)}
        </div>
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
          {getShortModeLabel()}
        </div>
      </div>
    );
  };

  // ── Nx1 Ribbon: Timer + mode label + play/pause inline ─────────
  const renderRibbonView = () => {
    return (
      <div className="flex h-full items-center gap-2 overflow-hidden px-1">
        <span className={`shrink-0 text-base font-bold ${getModeColor()} ${!isActive ? 'opacity-60' : ''}`}>
          {formatTime(timeLeft)}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${getModeBgColor()} ${getModeColor()}`}>
          {getShortModeLabel()}
        </span>
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full h-7 w-7"
            onClick={toggleTimer}
            aria-label={isActive ? 'Pause' : 'Start'}
          >
            {isActive ? <Pause size={14} /> : <Play size={14} />}
          </Button>
        )}
        {width >= 3 && (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            Cycle {cyclesCompleted % (localConfig.cyclesBeforeLongBreak || 4) + 1}/{localConfig.cyclesBeforeLongBreak || 4}
          </span>
        )}
      </div>
    );
  };

  // ── 6x6+ App: Full productivity timer ──────────────────────────
  const renderAppView = () => {
    const progress = getProgress();
    const radius = 90;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;
    const cyclesBeforeLong = localConfig.cyclesBeforeLongBreak || 4;
    const currentCycleInSet = cyclesCompleted % cyclesBeforeLong;

    return (
      <div className="flex h-full flex-col overflow-hidden">
        {/* App header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 widget-drag-handle cursor-move">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {localConfig.title || defaultConfig.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {getModeDescription()}
            </p>
          </div>
          {!readOnly && (
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
              Settings
            </Button>
          )}
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          {/* Progress ring + timer */}
          <div className="relative flex items-center justify-center">
            <svg width="220" height="220" viewBox="0 0 220 220" className="-rotate-90">
              {/* Background ring */}
              <circle
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-secondary"
              />
              {/* Progress ring */}
              <circle
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke={getModeStrokeColor()}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <div className={`text-5xl font-bold tabular-nums ${getModeColor()}`}>
                {formatTime(timeLeft)}
              </div>
              <div className={`mt-1 rounded-full px-3 py-0.5 text-sm font-medium ${getModeBgColor()} ${getModeColor()}`}>
                {getModeLabel()}
              </div>
            </div>
          </div>

          {/* Controls */}
          {!readOnly && (
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full h-11 w-11"
                onClick={resetTimer}
                aria-label="Reset"
              >
                <RotateCcw size={20} />
              </Button>
              <Button type="button" variant="ghost" size="none"
                className={`rounded-full p-5 text-white transition-colors ${
                  mode === TimerMode.WORK
                    ? 'bg-red-500 hover:bg-red-600'
                    : mode === TimerMode.BREAK
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
                onClick={toggleTimer}
                aria-label={isActive ? 'Pause' : 'Start'}
              >
                {isActive ? <Pause size={28} /> : <Play size={28} />}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full h-11 w-11"
                onClick={skipTimer}
                aria-label="Skip to next"
              >
                <SkipForward size={20} />
              </Button>
            </div>
          )}

          {/* Session progress dots */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Sessions</span>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: cyclesBeforeLong }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full transition-colors ${
                    i < currentCycleInSet
                      ? 'bg-red-500 dark:bg-red-400'
                      : i === currentCycleInSet && mode === TimerMode.WORK
                      ? 'bg-red-500/40 ring-2 ring-red-500/50'
                      : 'bg-secondary'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {cyclesCompleted} total
            </span>
          </div>
        </div>

        {/* Bottom settings bar (inline durations) */}
        <div className="grid grid-cols-3 gap-3 border-t border-border px-5 py-4">
          <div className="rounded-lg bg-muted p-3 text-center">
            <div className="text-xs text-muted-foreground">Focus</div>
            <div className="text-lg font-semibold text-foreground">
              {localConfig.workDuration || 25}<span className="text-xs font-normal text-muted-foreground">m</span>
            </div>
          </div>
          <div className="rounded-lg bg-muted p-3 text-center">
            <div className="text-xs text-muted-foreground">Break</div>
            <div className="text-lg font-semibold text-foreground">
              {localConfig.breakDuration || 5}<span className="text-xs font-normal text-muted-foreground">m</span>
            </div>
          </div>
          <div className="rounded-lg bg-muted p-3 text-center">
            <div className="text-xs text-muted-foreground">Long Break</div>
            <div className="text-lg font-semibold text-foreground">
              {localConfig.longBreakDuration || 15}<span className="text-xs font-normal text-muted-foreground">m</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render content routing ─────────────────────────────────────
  const renderContent = () => {
    if (isTiny) return renderTinyView();
    if (isShort) return renderRibbonView();
    if (isApp) return renderAppView();

    // Existing size-based branching
    if (width >= 4 && height >= 4) {
      return renderLargeView();
    } else if (width >= 4) {
      return renderWideView();
    } else if (height >= 4) {
      return renderTallView();
    } else {
      return renderDefaultView();
    }
  };

  // Default view (2x2)
  const renderDefaultView = () => {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-3">
        <div className={`text-3xl font-bold ${getModeColor()}`}>
          {formatTime(timeLeft)}
        </div>
        <div className="text-sm font-medium">{getModeLabel()}</div>
        {!readOnly && (
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full"
              onClick={toggleTimer}
              aria-label={isActive ? 'Pause' : 'Start'}
            >
              {isActive ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full"
              onClick={resetTimer}
              aria-label="Reset"
            >
              <RotateCcw size={16} />
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Wide view (4x2 or larger width)
  const renderWideView = () => {
    return (
      <div className="flex flex-row items-center justify-between h-full px-4">
        <div className="flex flex-col items-center">
          <div className={`text-4xl font-bold ${getModeColor()}`}>
            {formatTime(timeLeft)}
          </div>
          <div className="text-lg font-medium mt-1">{getModeLabel()}</div>
          <div className="text-sm opacity-75 text-center max-w-[180px]">{getModeDescription()}</div>
        </div>
        <div className="flex flex-col items-center">
          {!readOnly && (
            <div className="flex space-x-3">
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full h-11 w-11"
                onClick={toggleTimer}
                aria-label={isActive ? 'Pause' : 'Start'}
              >
                {isActive ? <Pause size={20} /> : <Play size={20} />}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full h-11 w-11"
                onClick={resetTimer}
                aria-label="Reset"
              >
                <RotateCcw size={20} />
              </Button>
            </div>
          )}
          <div className="text-sm mt-2">
            Cycle: {cyclesCompleted % (localConfig.cyclesBeforeLongBreak || 4) || (localConfig.cyclesBeforeLongBreak || 4)}/{localConfig.cyclesBeforeLongBreak || 4}
          </div>
        </div>
      </div>
    );
  };

  // Tall view (2x4 or larger height)
  const renderTallView = () => {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className={`text-4xl font-bold ${getModeColor()}`}>
          {formatTime(timeLeft)}
        </div>
        <div className="text-lg font-medium">{getModeLabel()}</div>
        <div className="text-sm opacity-75 text-center max-w-[180px]">{getModeDescription()}</div>
        {!readOnly && (
          <div className="flex space-x-3 mt-3">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full h-11 w-11"
              onClick={toggleTimer}
              aria-label={isActive ? 'Pause' : 'Start'}
            >
              {isActive ? <Pause size={20} /> : <Play size={20} />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full h-11 w-11"
              onClick={resetTimer}
              aria-label="Reset"
            >
              <RotateCcw size={20} />
            </Button>
          </div>
        )}
        <div className="text-sm mt-2">
          Cycle: {cyclesCompleted % (localConfig.cyclesBeforeLongBreak || 4) || (localConfig.cyclesBeforeLongBreak || 4)}/{localConfig.cyclesBeforeLongBreak || 4}
        </div>
        <div className="text-sm opacity-75">
          Total completed: {cyclesCompleted}
        </div>
      </div>
    );
  };

  // Large view (4x4 or larger)
  const renderLargeView = () => {
    const isTightLarge = height <= 4;

    return (
      <div className={cn(
        'flex h-full min-h-0 flex-col items-center justify-center overflow-hidden',
        isTightLarge ? 'gap-3' : 'gap-6',
      )}>
        <div className={`${isTightLarge ? 'text-5xl' : 'text-6xl'} font-bold leading-none ${getModeColor()}`}>
          {formatTime(timeLeft)}
        </div>
        <div className={cn('font-medium', isTightLarge ? 'text-lg' : 'text-xl')}>
          {getModeLabel()}
        </div>
        <div className={cn('text-center opacity-75', isTightLarge ? 'max-w-[220px] text-sm' : 'max-w-[280px] text-md')}>
          {getModeDescription()}
        </div>
        {!readOnly && (
          <div className={cn('flex', isTightLarge ? 'gap-3' : 'mt-4 gap-4')}>
            <Button
              variant="secondary"
              size="icon"
              className={cn('rounded-full', isTightLarge ? 'h-12 w-12' : 'h-14 w-14')}
              onClick={toggleTimer}
              aria-label={isActive ? 'Pause' : 'Start'}
            >
              {isActive ? <Pause size={isTightLarge ? 20 : 24} /> : <Play size={isTightLarge ? 20 : 24} />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className={cn('rounded-full', isTightLarge ? 'h-12 w-12' : 'h-14 w-14')}
              onClick={resetTimer}
              aria-label="Reset"
            >
              <RotateCcw size={isTightLarge ? 20 : 24} />
            </Button>
          </div>
        )}
        <div className={cn(isTightLarge ? 'text-sm' : 'mt-2 text-lg')}>
          Cycle: {cyclesCompleted % (localConfig.cyclesBeforeLongBreak || 4) || (localConfig.cyclesBeforeLongBreak || 4)}/{localConfig.cyclesBeforeLongBreak || 4}
        </div>
        <div className={cn('opacity-75', isTightLarge ? 'text-sm' : 'text-md')}>
          Total completed: {cyclesCompleted}
        </div>
        <div className={cn('grid w-full grid-cols-3 text-center', isTightLarge ? 'gap-2' : 'mt-4 gap-4')}>
          <div className={cn('rounded-lg bg-muted', isTightLarge ? 'p-2' : 'p-3')}>
            <div className={cn('opacity-75', isTightLarge ? 'text-xs' : 'text-sm')}>Focus Time</div>
            <div className="font-medium">{localConfig.workDuration} min</div>
          </div>
          <div className={cn('rounded-lg bg-muted', isTightLarge ? 'p-2' : 'p-3')}>
            <div className={cn('opacity-75', isTightLarge ? 'text-xs' : 'text-sm')}>Short Break</div>
            <div className="font-medium">{localConfig.breakDuration} min</div>
          </div>
          <div className={cn('rounded-lg bg-muted', isTightLarge ? 'p-2' : 'p-3')}>
            <div className={cn('opacity-75', isTightLarge ? 'text-xs' : 'text-sm')}>Long Break</div>
            <div className="font-medium">{localConfig.longBreakDuration} min</div>
          </div>
        </div>
      </div>
    );
  };

  // ── Settings helpers ───────────────────────────────────────────
  const resetSettingsDraft = useCallback(() => {
    setLocalConfig(mergedConfig);
  }, [mergedConfig]);

  const handleSettingsOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      resetSettingsDraft();
    } else {
      setLocalConfig(mergedConfig);
    }
    setShowSettings(nextOpen);
  }, [mergedConfig, resetSettingsDraft]);

  const handleCancelSettings = useCallback(() => {
    resetSettingsDraft();
    setShowSettings(false);
  }, [resetSettingsDraft]);

  // Save settings
  const saveSettings = useCallback(() => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);

    // Update timer based on new settings
    setIsActive(false);
    setMode(TimerMode.WORK);
    setCyclesCompleted(0);
    setTimeLeft((localConfig.workDuration || 25) * 60);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [config, localConfig]);

  // Settings dialog
  const renderSettings = () => {
    return (
      <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pomodoro Widget Settings</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 space-y-4 overflow-y-auto py-4">
            {/* Title setting */}
            <div className="space-y-2">
              <Label htmlFor="title-input">Widget Title</Label>
              <Input
                id="title-input"
                type="text"
                value={localConfig.title || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalConfig({...localConfig, title: e.target.value})
                }
              />
            </div>

            {/* Work duration setting */}
            <div className="space-y-2">
              <Label htmlFor="work-duration">Focus Time Duration (minutes)</Label>
              <Input
                id="work-duration"
                type="number"
                min="1"
                max="60"
                value={localConfig.workDuration || 25}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalConfig({...localConfig, workDuration: parseInt(e.target.value)})
                }
              />
            </div>

            {/* Break duration setting */}
            <div className="space-y-2">
              <Label htmlFor="break-duration">Short Break Duration (minutes)</Label>
              <Input
                id="break-duration"
                type="number"
                min="1"
                max="30"
                value={localConfig.breakDuration || 5}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalConfig({...localConfig, breakDuration: parseInt(e.target.value)})
                }
              />
            </div>

            {/* Long break duration setting */}
            <div className="space-y-2">
              <Label htmlFor="long-break-duration">Long Break Duration (minutes)</Label>
              <Input
                id="long-break-duration"
                type="number"
                min="1"
                max="45"
                value={localConfig.longBreakDuration || 15}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalConfig({...localConfig, longBreakDuration: parseInt(e.target.value)})
                }
              />
            </div>

            {/* Cycles before long break setting */}
            <div className="space-y-2">
              <Label htmlFor="cycles-before-long-break">Cycles Before Long Break</Label>
              <Input
                id="cycles-before-long-break"
                type="number"
                min="1"
                max="10"
                value={localConfig.cyclesBeforeLongBreak || 4}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalConfig({...localConfig, cyclesBeforeLongBreak: parseInt(e.target.value)})
                }
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleCancelSettings}>
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={saveSettings}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Main render
  return (
    <div
      ref={widgetRef}
      className={`widget-container h-full flex flex-col ${isTiny ? 'widget-drag-handle' : ''}`}
    >
      {!isTiny && !isApp && (
        <WidgetHeader
          title={localConfig.title || defaultConfig.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      <div className={`flex-grow overflow-hidden ${isTiny ? 'p-1.5' : isShort ? 'p-1.5' : 'p-4'}`}>
        {renderContent()}
      </div>

      {!readOnly && renderSettings()}
    </div>
  );
};

export default PomodoroWidget;
