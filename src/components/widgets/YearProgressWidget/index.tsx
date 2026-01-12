import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Switch,
  Label,
  Button,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import { YearProgressProps, YearProgressConfig } from './types';

/**
 * A Year Progress Widget that shows all 365 dots efficiently using SVG for better scaling
 * 
 * @param width - Widget width in grid units
 * @param config - Widget configuration
 */
const YearProgressWidget: React.FC<YearProgressProps> = React.memo(({ width, config }) => {
  const defaultConfig: YearProgressConfig = {
    showPercentage: true,
    showDaysLeft: true,
  };

  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<YearProgressConfig>({
    ...defaultConfig,
    ...config
  });
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    content: string;
    date: string;
    day: number;
    x: number;
    y: number;
    showBelow: boolean;
  }>({
    show: false,
    content: '',
    date: '',
    day: 0,
    x: 0,
    y: 0,
    showBelow: false
  });

  const widgetRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  
  // Detect dark mode using useMemo to reduce recomputation
  const theme = useMemo(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'light';
  }, []);
  
  // Observer for theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          const newTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
          if (newTheme !== theme) {
            // Force re-render using a key in localConfig to avoid creating a state variable
            setLocalConfig(prev => ({ ...prev, _themeKey: Date.now() }));
            break;
          }
        }
      }
    });
    
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [theme]);

  // Cached progress calculation - recalculates at midnight via _updateKey
  const progress = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    const daysInYear = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const daysPassed = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return {
      total: Math.floor(daysInYear),
      passed: Math.floor(daysPassed),
      percentage: (daysPassed / daysInYear) * 100,
      year: now.getFullYear()
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localConfig._updateKey]); // Recalculate when _updateKey changes (at midnight)
  
  // Update progress at midnight without full rerender
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Date formatter - created once and memoized
  const dateFormatter = useMemo(() => 
    new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }),
  []);

  // Pre-calculate all dates for the year in one operation
  const dateCache = useMemo(() => {
    const cache = new Array(progress.total);
    const year = progress.year;
    // Batch date creation in a single loop for better performance
    for (let i = 0; i < progress.total; i++) {
      cache[i] = dateFormatter.format(new Date(year, 0, i + 1));
    }
    return cache;
  }, [dateFormatter, progress.year, progress.total]);

  // Get colors based on theme only - simplified to just handle light/dark mode
  const colors = useMemo(() => ({
    passed: theme === 'dark' ? '#3b82f6' : '#3b82f6', // blue-500
    future: theme === 'dark' ? '#334155' : '#e2e8f0', // dark: slate-700, light: slate-200
  }), [theme]);

  // Calculate optimal grid layout - memoized on width and total days
  const gridLayout = useMemo(() => {
    // Determine columns based on widget size to create a balanced grid
    let cols = 24; // Default
    
    // Only recalculate if width changes
    if (width > 3) {
      cols = 36; // Larger widgets
    } else if (width > 2) {
      cols = 30; // Medium widgets
    }
    
    const rows = Math.ceil(progress.total / cols);
    
    // Pre-calculate values for dot positioning
    const radius = 1.2;
    const spacing = 3.5;
    const viewBoxWidth = (cols * spacing) + (radius * 2) + 2;
    const viewBoxHeight = (rows * spacing) + (radius * 2) + 2;
    
    return { 
      cols, 
      rows,
      radius,
      spacing,
      viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`
    };
  }, [progress.total, width]);

  // Handle tooltip display on hover - using event delegation on SVG parent
  // Use viewport coordinates (fixed positioning) to avoid clipping by overflow-hidden
  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    if (target.tagName === 'circle') {
      const day = parseInt(target.getAttribute('data-day') || '0', 10);
      if (day > 0) {
        const circleRect = target.getBoundingClientRect();
        // Use viewport coordinates for fixed positioning
        setTooltip({
          show: true,
          content: `Day ${day} of ${progress.total}`,
          date: dateCache[day - 1],
          day,
          x: circleRect.left + circleRect.width / 2,
          y: circleRect.top,
          showBelow: false
        });
      }
    }
  }, [dateCache, progress.total]);

  const handleSvgMouseLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, show: false }));
  }, []);

  // Virtualization for dots - only render visible dots for smaller screen sizes
  const updateVisibility = useCallback(() => {
    // Empty function - virtualization disabled
  }, []);
  
  // Apply virtualization on scroll or resize
  useEffect(() => {
    // Virtualization disabled - no effect
    return () => {};
  }, [updateVisibility, width]);

  // Generate dots - optimized: no individual event handlers, minimal classes
  const dots = useMemo(() => {
    const { cols, radius, spacing } = gridLayout;
    const totalDays = progress.total;
    const passedCount = progress.passed;

    // Build SVG path data for better performance than individual circles
    // Group dots by color to minimize DOM elements
    const passedDots: string[] = [];
    const futureDots: string[] = [];

    for (let i = 0; i < totalDays; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = (col * spacing) + radius + 1;
      const cy = (row * spacing) + radius + 1;

      // Create circle element string for the appropriate group
      if (i < passedCount) {
        passedDots.push(`M${cx - radius},${cy}a${radius},${radius} 0 1,0 ${radius * 2},0a${radius},${radius} 0 1,0 -${radius * 2},0`);
      } else {
        futureDots.push(`M${cx - radius},${cy}a${radius},${radius} 0 1,0 ${radius * 2},0a${radius},${radius} 0 1,0 -${radius * 2},0`);
      }
    }

    // Return two path elements instead of 365 circles
    return (
      <>
        <path d={futureDots.join(' ')} fill={colors.future} />
        <path d={passedDots.join(' ')} fill={colors.passed} />
        {/* Invisible circles for hover detection only */}
        {Array.from({ length: totalDays }, (_, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cx = (col * spacing) + radius + 1;
          const cy = (row * spacing) + radius + 1;
          return (
            <circle
              key={i + 1}
              cx={cx}
              cy={cy}
              r={radius + 1}
              fill="transparent"
              data-day={i + 1}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
      </>
    );
  }, [gridLayout, colors, progress.passed, progress.total]);

  // Update at midnight - simple state trigger to recalculate progress
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    const midnightTimer = setTimeout(() => {
      // Trigger re-render to update progress
      setLocalConfig(prev => ({ ...prev, _updateKey: Date.now() }));
    }, timeUntilMidnight);

    return () => clearTimeout(midnightTimer);
  }, [localConfig._updateKey]);

  // Sync config updates - only update when specific config values change
  useEffect(() => {
    if (config?.showPercentage !== localConfig.showPercentage ||
        config?.showDaysLeft !== localConfig.showDaysLeft) {
      setLocalConfig(prev => ({
        ...prev,
        showPercentage: config?.showPercentage ?? prev.showPercentage,
        showDaysLeft: config?.showDaysLeft ?? prev.showDaysLeft
      }));
    }
  }, [config?.showPercentage, config?.showDaysLeft]);

  // Memoized stats with caching for performance
  const stats = useMemo(() => {
    if (!localConfig.showDaysLeft && !localConfig.showPercentage) return null;
    
    // Calculate values only when needed
    const daysLeft = progress.total - progress.passed;
    const percentage = progress.percentage.toFixed(1);
    
    // For small widgets, use a more compact layout
    if (width <= 2) {
      return (
        <div className="flex flex-col space-y-1 mt-1 px-0.5 text-xs font-medium">
          {localConfig.showDaysLeft && (
            <div className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full transition-colors duration-200 text-center">
              <span className="text-gray-900 dark:text-gray-100 font-semibold">{daysLeft}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">days left</span>
            </div>
          )}
          {localConfig.showPercentage && (
            <div className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full transition-colors duration-200 text-center">
              <span className="text-gray-900 dark:text-gray-100 font-semibold">{percentage}%</span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">complete</span>
            </div>
          )}
        </div>
      );
    }
    
    // Standard layout for larger widgets
    return (
      <div className="flex justify-between items-center mt-1.5 px-0.5 text-xs font-medium">
        {localConfig.showDaysLeft && (
          <div className="bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full transition-colors duration-200">
            <span className="text-gray-900 dark:text-gray-100 font-semibold">{daysLeft}</span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">days left</span>
          </div>
        )}
        {localConfig.showPercentage && (
          <div className="bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full transition-colors duration-200">
            <span className="text-gray-900 dark:text-gray-100 font-semibold">{percentage}%</span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">complete</span>
          </div>
        )}
      </div>
    );
  }, [localConfig.showDaysLeft, localConfig.showPercentage, progress.total, progress.passed, progress.percentage, width]);

  // Event handlers with useCallback for stability
  const saveSettings = useCallback(() => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  }, [config, localConfig]);

  const handleSettingsOpen = useCallback(() => {
    setShowSettings(true);
  }, []);

  // Settings dialog - memoized to prevent recreation
  const settingsDialog = useMemo(() => (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Year Progress Settings</DialogTitle>
        </DialogHeader>
        
        {/* Change py-2 to py-4 and space-y-5 to space-y-4 */}
        <div className="space-y-4 py-4">
          {/* Change space-y-3 to space-y-4 */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Display Options</Label>
            {/* Change space-y-3 to space-y-4 */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-percentage"
                  checked={localConfig.showPercentage}
                  onCheckedChange={(checked) => 
                    setLocalConfig(prev => ({ ...prev, showPercentage: checked }))
                  }
                />
                <Label htmlFor="show-percentage">Show Percentage</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-days"
                  checked={localConfig.showDaysLeft}
                  onCheckedChange={(checked) => 
                    setLocalConfig(prev => ({ ...prev, showDaysLeft: checked }))
                  }
                />
                <Label htmlFor="show-days">Show Days Left</Label>
              </div>
            </div>
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
  ), [showSettings, localConfig, config, saveSettings]);

  return (
    <div ref={widgetRef} className="widget-container h-full flex flex-col">
      <WidgetHeader 
        title="Year Progress" 
        onSettingsClick={handleSettingsOpen}
        aria-labelledby="year-progress-title"
      />
      
      <div className="flex-grow p-1 overflow-hidden">
        <div className="h-full flex flex-col justify-between">
          <div ref={svgContainerRef} className="flex-grow flex items-center justify-center relative">
            <svg
              ref={svgRef}
              viewBox={gridLayout.viewBox}
              className="w-full h-full"
              preserveAspectRatio="xMidYMid meet"
              aria-label={`Year progress visualization showing ${progress.passed} days passed out of ${progress.total} days in ${progress.year}`}
              role="img"
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={handleSvgMouseLeave}
            >
              {dots}
            </svg>
            
            {tooltip.show && createPortal(
              <div
                className="fixed px-3 py-2 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded shadow-lg pointer-events-none"
                style={{
                  left: `${tooltip.x}px`,
                  top: `${tooltip.y - 8}px`,
                  transform: 'translate(-50%, -100%)',
                  zIndex: 9999
                }}
              >
                <div className="font-medium">{tooltip.date}</div>
                <div className="text-xs opacity-80">{tooltip.content}</div>
              </div>,
              document.body
            )}
          </div>
          {stats}
        </div>
      </div>
      
      {settingsDialog}
    </div>
  );
});

export default YearProgressWidget; 