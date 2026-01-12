import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  Input,
  Button,
} from '@boxento/primitives';
import { Play, Pause, RotateCcw } from 'lucide-react';
import WidgetHeader from '../common/WidgetHeader';
import { PomodoroWidgetConfig, PomodoroWidgetProps } from './types';
import { faviconService } from '@/lib/services/favicon';

/**
 * Pomodoro Widget Component
 * 
 * A productivity widget implementing the Pomodoro Technique for time management.
 * 
 * @param {PomodoroWidgetProps} props - Component props
 * @returns {JSX.Element} Widget component
 */
const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({ width, height, config }) => {
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
    setIsActive(!isActive);
  };

  // Reset timer
  const resetTimer = () => {
    setIsActive(false);
    setMode(TimerMode.WORK);
    setCyclesCompleted(0);
    setTimeLeft((localConfig.workDuration || 25) * 60);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
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
  
  // Render content based on widget size
  const renderContent = () => {
    // Adapt content based on widget dimensions
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
        <div className="flex space-x-3">
          <button 
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            onClick={toggleTimer}
            aria-label={isActive ? 'Pause' : 'Start'}
          >
            {isActive ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button 
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            onClick={resetTimer}
            aria-label="Reset"
          >
            <RotateCcw size={16} />
          </button>
        </div>
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
          <div className="flex space-x-3">
            <button 
              className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              onClick={toggleTimer}
              aria-label={isActive ? 'Pause' : 'Start'}
            >
              {isActive ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button 
              className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              onClick={resetTimer}
              aria-label="Reset"
            >
              <RotateCcw size={20} />
            </button>
          </div>
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
        <div className="flex space-x-3 mt-3">
          <button 
            className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            onClick={toggleTimer}
            aria-label={isActive ? 'Pause' : 'Start'}
          >
            {isActive ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button 
            className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            onClick={resetTimer}
            aria-label="Reset"
          >
            <RotateCcw size={20} />
          </button>
        </div>
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
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className={`text-6xl font-bold ${getModeColor()}`}>
          {formatTime(timeLeft)}
        </div>
        <div className="text-xl font-medium">{getModeLabel()}</div>
        <div className="text-md opacity-75 text-center max-w-[280px]">{getModeDescription()}</div>
        <div className="flex space-x-4 mt-4">
          <button 
            className="p-4 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            onClick={toggleTimer}
            aria-label={isActive ? 'Pause' : 'Start'}
          >
            {isActive ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <button 
            className="p-4 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            onClick={resetTimer}
            aria-label="Reset"
          >
            <RotateCcw size={24} />
          </button>
        </div>
        <div className="text-lg mt-2">
          Cycle: {cyclesCompleted % (localConfig.cyclesBeforeLongBreak || 4) || (localConfig.cyclesBeforeLongBreak || 4)}/{localConfig.cyclesBeforeLongBreak || 4}
        </div>
        <div className="text-md opacity-75">
          Total completed: {cyclesCompleted}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 text-center w-full">
          <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-sm opacity-75">Focus Time</div>
            <div className="font-medium">{localConfig.workDuration} min</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-sm opacity-75">Short Break</div>
            <div className="font-medium">{localConfig.breakDuration} min</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-sm opacity-75">Long Break</div>
            <div className="font-medium">{localConfig.longBreakDuration} min</div>
          </div>
        </div>
      </div>
    );
  };
  
  // Save settings
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
    
    // Update timer based on new settings
    resetTimer();
  };
  
  // Settings dialog
  const renderSettings = () => {
    return (
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pomodoro Widget Settings</DialogTitle>
          </DialogHeader>
          
          {/* Change py-2 to py-4 */}
          <div className="space-y-4 py-4">
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
          
          <DialogFooter>
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
    <div ref={widgetRef} className="widget-container h-full flex flex-col">
      <WidgetHeader 
        title={localConfig.title || defaultConfig.title} 
        onSettingsClick={() => setShowSettings(true)}
      />
      
      <div className="flex-grow p-4 overflow-hidden">
        {renderContent()}
      </div>
      
      {renderSettings()}
    </div>
  );
};

export default PomodoroWidget; 