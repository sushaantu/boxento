import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../ui/dialog';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import WidgetHeader from '../common/WidgetHeader';
import { YearProgressProps, YearProgressConfig } from './types';

/**
 * A Year Progress Widget that shows all 365 dots efficiently using SVG for better scaling
 *
 * Adapts to different sizes:
 * - 1x1 (Tiny): Large percentage or days-left number
 * - Nx1 (Ribbon): Percentage badge + inline progress bar
 * - Default (2x2+): SVG dot grid with stats
 * - 6x6+ (App): Full time dashboard with multi-period progress
 *
 * @param width - Widget width in grid units
 * @param height - Widget height in grid units
 * @param config - Widget configuration
 */
const YearProgressWidget: React.FC<YearProgressProps> = React.memo(({ width, height, config }) => {
  // ─── Size detection ──────────────────────────────────────────────────
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

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
    passed: theme === 'dark' ? '#cbd5e1' : '#334155',
    future: theme === 'dark' ? '#334155' : '#e2e8f0',
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
            <div className="bg-muted px-2 py-0.5 rounded-full transition-colors duration-200 text-center">
              <span className="text-foreground font-semibold">{daysLeft}</span>
              <span className="text-muted-foreground ml-1">days left</span>
            </div>
          )}
          {localConfig.showPercentage && (
            <div className="bg-muted px-2 py-0.5 rounded-full transition-colors duration-200 text-center">
              <span className="text-foreground font-semibold">{percentage}%</span>
              <span className="text-muted-foreground ml-1">complete</span>
            </div>
          )}
        </div>
      );
    }

    // Standard layout for larger widgets
    return (
      <div className="flex justify-between items-center mt-1.5 px-0.5 text-xs font-medium">
        {localConfig.showDaysLeft && (
          <div className="bg-muted px-2.5 py-1 rounded-full transition-colors duration-200">
            <span className="text-foreground font-semibold">{daysLeft}</span>
            <span className="text-muted-foreground ml-1">days left</span>
          </div>
        )}
        {localConfig.showPercentage && (
          <div className="bg-muted px-2.5 py-1 rounded-full transition-colors duration-200">
            <span className="text-foreground font-semibold">{percentage}%</span>
            <span className="text-muted-foreground ml-1">complete</span>
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

  const cancelSettings = useCallback(() => {
    setLocalConfig({
      ...defaultConfig,
      ...config
    });
    setShowSettings(false);
  }, [config]);

  const handleSettingsOpen = useCallback(() => {
    setShowSettings(true);
  }, []);

  // ─── 1x1 ICON: Percentage or days-left as large number ──────────────
  const tinySummary = useMemo(() => {
    const daysLeft = progress.total - progress.passed;
    const percentage = Math.round(progress.percentage);
    const showDaysLeft = localConfig.showDaysLeft;
    const showPercentage = localConfig.showPercentage;

    if (!showDaysLeft && !showPercentage) {
      return null;
    }

    const primaryValue = showPercentage ? `${percentage}%` : `${daysLeft}D`;
    const secondaryValue = showPercentage && showDaysLeft
      ? `${daysLeft}d left`
      : showPercentage
        ? 'complete'
        : 'days left';

    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
        <div className="text-[2.15rem] font-semibold leading-none tracking-tight text-foreground">
          {primaryValue}
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {secondaryValue}
        </div>
      </div>
    );
  }, [localConfig.showDaysLeft, localConfig.showPercentage, progress.passed, progress.percentage, progress.total]);

  // ─── Nx1 RIBBON: Percentage badge + inline progress bar ─────────────
  const renderRibbonView = useCallback(() => {
    const percentage = Math.round(progress.percentage);
    const daysLeft = progress.total - progress.passed;

    return (
      <div className="flex h-full items-center gap-2.5 overflow-hidden px-1">
        {/* Percentage badge */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex flex-col items-center rounded-lg bg-muted px-2.5 py-0.5">
            <span className="text-lg font-bold leading-tight text-foreground">{percentage}%</span>
            <span className="text-[9px] text-muted-foreground">done</span>
          </div>
        </div>

        {/* Inline progress bar filling available width */}
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">{progress.year}</span>
            <span>{daysLeft}d left</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, percentage)}%`,
                backgroundColor: colors.passed,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <span>Day {progress.passed}</span>
            <span>Day {progress.total}</span>
          </div>
        </div>
      </div>
    );
  }, [colors.passed, progress]);

  // ─── Extended progress data for App view ─────────────────────────────
  const extendedProgress = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();

    // Month progress
    const monthEnd = new Date(year, now.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const dayOfMonth = now.getDate();
    const monthPct = (dayOfMonth / daysInMonth) * 100;

    // Week progress (Mon=1 ... Sun=7)
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // convert Sun=0 to 7
    const weekPct = (dayOfWeek / 7) * 100;

    // Day progress
    const hoursElapsed = now.getHours() + now.getMinutes() / 60;
    const dayPct = (hoursElapsed / 24) * 100;

    // Quarter progress
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    const quarterStartMonth = (quarter - 1) * 3;
    const quarterStart = new Date(year, quarterStartMonth, 1);
    const quarterEnd = new Date(year, quarterStartMonth + 3, 0);
    const totalQuarterDays = Math.floor((quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const elapsedQuarterDays = Math.floor((now.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const quarterPct = (elapsedQuarterDays / totalQuarterDays) * 100;

    // ISO week number
    const jan4 = new Date(year, 0, 4);
    const daysSinceJan4 = Math.floor((now.getTime() - jan4.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.ceil((daysSinceJan4 + jan4.getDay() + 1) / 7);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    return {
      month: {
        name: monthNames[now.getMonth()],
        elapsed: dayOfMonth,
        total: daysInMonth,
        remaining: daysInMonth - dayOfMonth,
        pct: monthPct,
      },
      week: {
        elapsed: dayOfWeek,
        total: 7,
        remaining: 7 - dayOfWeek,
        pct: weekPct,
      },
      day: {
        elapsed: Math.floor(hoursElapsed),
        total: 24,
        remaining: 24 - Math.floor(hoursElapsed),
        pct: dayPct,
      },
      quarter: {
        number: quarter,
        elapsed: elapsedQuarterDays,
        total: totalQuarterDays,
        remaining: totalQuarterDays - elapsedQuarterDays,
        pct: quarterPct,
      },
      weekNumber,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localConfig._updateKey]);

  // ─── 6x6+ APP: Full time dashboard ──────────────────────────────────
  const renderAppView = useCallback(() => {
    const yearPct = progress.percentage;
    const daysLeft = progress.total - progress.passed;
    const ep = extendedProgress;

    // Circular progress SVG helper
    const CircularProgress = ({ pct, size, label, sublabel, color }: {
      pct: number; size: number; label: string; sublabel: string; color: string;
    }) => {
      const strokeWidth = size >= 120 ? 10 : 7;
      const radius = (size - strokeWidth) / 2;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (Math.min(100, pct) / 100) * circumference;

      return (
        <div className="flex flex-col items-center gap-2">
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2} cy={size / 2} r={radius}
                fill="none"
                stroke={theme === 'dark' ? '#334155' : '#e2e8f0'}
                strokeWidth={strokeWidth}
              />
              <circle
                cx={size / 2} cy={size / 2} r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-foreground">
                {Math.round(pct)}%
              </span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-foreground">{label}</div>
            <div className="text-xs text-muted-foreground">{sublabel}</div>
          </div>
        </div>
      );
    };

    // Bar progress helper for secondary metrics
    const ProgressBar = ({ pct, label, elapsed, total, remaining, color }: {
      pct: number; label: string; elapsed: number; total: number; remaining: number; color: string;
    }) => (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-sm font-bold text-foreground">{Math.round(pct)}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{elapsed} of {total} elapsed</span>
          <span>{remaining} remaining</span>
        </div>
      </div>
    );

    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* App header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 widget-drag-handle cursor-move">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Year Progress {progress.year}
            </h2>
            <p className="text-xs text-muted-foreground">
              Week {ep.weekNumber} &middot; Q{ep.quarter.number} &middot; {ep.month.name}
            </p>
          </div>
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSettingsOpen}
              aria-label="Open settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </Button>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
          {/* Hero: Year circular progress */}
          <div className="flex items-center justify-center gap-8 py-3">
            <CircularProgress
              pct={yearPct}
              size={140}
              label="Year Progress"
              sublabel={`${progress.passed} of ${progress.total} days`}
              color={colors.passed}
            />
            {/* Key stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted p-3 text-center min-w-[90px]">
                <div className="text-2xl font-bold text-foreground">{daysLeft}</div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Days Left</div>
              </div>
              <div className="rounded-xl bg-muted p-3 text-center min-w-[90px]">
                <div className="text-2xl font-bold text-foreground">Q{ep.quarter.number}</div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Quarter</div>
              </div>
              <div className="rounded-xl bg-muted p-3 text-center min-w-[90px]">
                <div className="text-2xl font-bold text-foreground">W{ep.weekNumber}</div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Week</div>
              </div>
              <div className="rounded-xl bg-muted p-3 text-center min-w-[90px]">
                <div className="text-2xl font-bold text-foreground">{Math.round(yearPct)}%</div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Complete</div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Period progress bars */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Period Progress</h3>

            <ProgressBar
              label={`Q${ep.quarter.number} Quarter`}
              pct={ep.quarter.pct}
              elapsed={ep.quarter.elapsed}
              total={ep.quarter.total}
              remaining={ep.quarter.remaining}
              color={colors.passed}
            />

            <ProgressBar
              label={ep.month.name}
              pct={ep.month.pct}
              elapsed={ep.month.elapsed}
              total={ep.month.total}
              remaining={ep.month.remaining}
              color={colors.passed}
            />

            <ProgressBar
              label="This Week"
              pct={ep.week.pct}
              elapsed={ep.week.elapsed}
              total={ep.week.total}
              remaining={ep.week.remaining}
              color={colors.passed}
            />

            <ProgressBar
              label="Today"
              pct={ep.day.pct}
              elapsed={ep.day.elapsed}
              total={ep.day.total}
              remaining={ep.day.remaining}
              color={colors.passed}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Year dot grid (smaller in app view) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Day-by-Day</h3>
            <div ref={svgContainerRef} className="flex items-center justify-center">
              <svg
                ref={svgRef}
                viewBox={gridLayout.viewBox}
                className="w-full"
                style={{ maxHeight: 160 }}
                preserveAspectRatio="xMidYMid meet"
                aria-label={`Year progress visualization showing ${progress.passed} days passed out of ${progress.total} days in ${progress.year}`}
                role="img"
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={handleSvgMouseLeave}
              >
                {dots}
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }, [colors.passed, progress, extendedProgress, theme, gridLayout, dots, handleSvgMouseMove, handleSvgMouseLeave, readOnly, handleSettingsOpen]);

  // ─── Existing default view (dot grid + stats) ───────────────────────
  const renderDefaultView = useCallback(() => (
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
  ), [gridLayout, progress, dots, tooltip, stats, handleSvgMouseMove, handleSvgMouseLeave]);

  // ─── renderContent routing ──────────────────────────────────────────
  const renderContent = useCallback(() => {
    if (isTiny) return tinySummary;
    if (isShort) return renderRibbonView();
    if (isApp) return renderAppView();
    return renderDefaultView();
  }, [isTiny, isShort, isApp, tinySummary, renderRibbonView, renderAppView, renderDefaultView]);

  // ─── Settings dialog ────────────────────────────────────────────────
  const renderSettings = useCallback(() => (
    <Dialog
      open={showSettings}
      onOpenChange={(open: boolean) => {
        if (!open) {
          // Reset localConfig on close
          setLocalConfig({
            ...defaultConfig,
            ...config
          });
        }
        setShowSettings(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Year Progress Settings</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-4 py-4">
          <div className="space-y-4">
            <Label className="text-sm font-medium">Display Options</Label>
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
                aria-label="Delete this widget"
              >
                Delete
              </Button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={cancelSettings}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={saveSettings}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ), [showSettings, localConfig, config, saveSettings, cancelSettings]);

  return (
    <div ref={widgetRef} className={`widget-container h-full flex flex-col ${isTiny ? 'widget-drag-handle' : ''}`}>
      {!isTiny && !isApp && (
        <WidgetHeader
          title="Year Progress"
          onSettingsClick={readOnly ? undefined : handleSettingsOpen}
          aria-labelledby="year-progress-title"
          compact={isShort}
        />
      )}

      <div className={`flex-grow overflow-hidden ${isTiny ? 'p-2' : ''}`}>
        {renderContent()}
      </div>

      {renderSettings()}
    </div>
  );
});

export default YearProgressWidget;
