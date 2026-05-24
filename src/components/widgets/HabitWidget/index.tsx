import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Check, Pencil, X, Plus, Flame, Search, Trash2, TrendingUp, BarChart3 } from 'lucide-react';
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
import WidgetHeader from '../common/WidgetHeader';
import type { HabitWidgetProps, HabitWidgetConfig, Habit } from './types';
import { cn } from '@/lib/utils';

const defaultConfig: HabitWidgetConfig = {
  title: 'Habits',
  habits: [],
};

const HabitWidget: React.FC<HabitWidgetProps> = ({ width = 2, height = 2, config }) => {
  // --- Size detection (icon → widget → app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [localConfig, setLocalConfig] = useState<HabitWidgetConfig>({
    ...defaultConfig,
    ...config,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitName, setHabitName] = useState('');

  // App-mode state
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [appTab, setAppTab] = useState<'today' | 'all' | 'analytics'>('today');

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  const habits = localConfig.habits || [];

  // Persist config changes (for inline edits like toggling)
  const updateConfig = useCallback((updates: Partial<HabitWidgetConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    if (config?.onUpdate) {
      config.onUpdate(newConfig);
    }
  }, [localConfig, config]);

  // Save settings modal
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  };

  // --- Date helpers ---
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const getDateStr = (offset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };

  // Generate array of days centered around today
  const getWeekDays = useCallback((range: number) => {
    const days: { date: Date; dateStr: string; dayName: string; dayLetter: string; isToday: boolean }[] = [];
    const today = new Date();
    for (let i = -range; i <= range; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({
        date,
        dateStr: date.toISOString().split('T')[0],
        dayName,
        dayLetter: dayName.charAt(0),
        isToday: i === 0,
      });
    }
    return days;
  }, []);

  const weekDays = useMemo(() => getWeekDays(isCompact ? 2 : 3), [getWeekDays, isCompact]);

  // --- Habit calculations ---
  const calculateStreak = useCallback((habit: Habit): number => {
    if (!habit.completedDates || habit.completedDates.length === 0) return 0;
    const sortedDates = [...habit.completedDates].sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0;
    let streak = 0;
    const checkDate = new Date(sortedDates[0]);
    for (const dateStr of sortedDates) {
      const expectedDate = checkDate.toISOString().split('T')[0];
      if (dateStr === expectedDate) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, []);

  const isCompletedOn = (habit: Habit, dateStr: string): boolean => {
    return habit.completedDates?.includes(dateStr) || false;
  };

  const toggleCompletion = (habitId: string, dateStr: string) => {
    if (readOnly) return;
    const updatedHabits = habits.map(habit => {
      if (habit.id !== habitId) return habit;
      const completedDates = habit.completedDates || [];
      const isCompleted = completedDates.includes(dateStr);
      return {
        ...habit,
        completedDates: isCompleted
          ? completedDates.filter(d => d !== dateStr)
          : [...completedDates, dateStr],
      };
    });
    updateConfig({ habits: updatedHabits });
  };

  // Summary calculations
  const todayCompletedCount = useMemo(() =>
    habits.filter(h => isCompletedOn(h, todayStr)).length, [habits, todayStr]);

  const maxStreak = useMemo(() =>
    habits.reduce((max, h) => Math.max(max, calculateStreak(h)), 0), [habits, calculateStreak]);

  // Completion rate for last 7 days
  const weeklyCompletionRate = useMemo(() => {
    if (habits.length === 0) return 0;
    let total = 0;
    let completed = 0;
    for (let i = 0; i < 7; i++) {
      const dateStr = getDateStr(-i);
      for (const habit of habits) {
        total++;
        if (isCompletedOn(habit, dateStr)) completed++;
      }
    }
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [habits]);

  // Completion rate for last 30 days
  const monthlyCompletionRate = useMemo(() => {
    if (habits.length === 0) return 0;
    let total = 0;
    let completed = 0;
    for (let i = 0; i < 30; i++) {
      const dateStr = getDateStr(-i);
      for (const habit of habits) {
        total++;
        if (isCompletedOn(habit, dateStr)) completed++;
      }
    }
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [habits]);

  // --- CRUD ---
  const handleAddHabit = () => {
    if (!habitName.trim()) return;
    const newHabit: Habit = {
      id: `habit-${Date.now()}`,
      name: habitName.trim(),
      createdAt: new Date().toISOString(),
      completedDates: [],
    };
    updateConfig({ habits: [...habits, newHabit] });
    setHabitName('');
    setShowAddDialog(false);
  };

  const handleEditHabit = () => {
    if (!editingHabit || !habitName.trim()) return;
    const updatedHabits = habits.map(habit =>
      habit.id === editingHabit.id ? { ...habit, name: habitName.trim() } : habit
    );
    updateConfig({ habits: updatedHabits });
    setHabitName('');
    setEditingHabit(null);
  };

  const handleDeleteHabit = (habitId: string) => {
    updateConfig({ habits: habits.filter(h => h.id !== habitId) });
    if (selectedHabitId === habitId) setSelectedHabitId(null);
  };

  const openEditDialog = (habit: Habit) => {
    setEditingHabit(habit);
    setHabitName(habit.name);
  };

  // --- 30-day heatmap data for a habit ---
  const getHeatmapData = useCallback((habit: Habit, days: number = 30) => {
    const data: { dateStr: string; completed: boolean; dayLabel: string }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      data.push({
        dateStr,
        completed: isCompletedOn(habit, dateStr),
        dayLabel: d.getDate().toString(),
      });
    }
    return data;
  }, []);

  // ========================================================
  // SIZE-SPECIFIC RENDERERS (icon → widget → app)
  // ========================================================

  /**
   * 1x1 ICON: Show today's completion fraction or top streak
   */
  const renderTinyView = () => {
    if (habits.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center">
          <Check className="h-5 w-5 text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-green-500">
          {todayCompletedCount === habits.length ? 'DONE' : 'TODAY'}
        </div>
        <div className="text-[1.75rem] font-bold leading-none text-foreground">
          {todayCompletedCount}/{habits.length}
        </div>
        {maxStreak > 0 && (
          <div className="mt-0.5 flex items-center gap-0.5">
            <Flame className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground font-medium">{maxStreak}</span>
          </div>
        )}
      </div>
    );
  };

  /**
   * Nx1 RIBBON: Today's habits as small chips
   */
  const renderRibbonView = () => {
    if (habits.length === 0) {
      return (
        <div className="flex h-full items-center justify-center px-2">
          <span className="text-xs text-muted-foreground">No habits tracked</span>
        </div>
      );
    }

    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1">
        {/* Summary badge */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex flex-col items-center rounded-lg bg-green-50 dark:bg-green-900/20 px-2 py-0.5">
            <span className="text-[9px] font-semibold uppercase text-green-600 dark:text-green-400">Today</span>
            <span className="text-lg font-bold leading-tight text-foreground">
              {todayCompletedCount}/{habits.length}
            </span>
          </div>
        </div>

        {/* Habit chips */}
        {habits.map(habit => {
          const done = isCompletedOn(habit, todayStr);
          return (
            <Button type="button" variant="ghost" size="none"
              key={habit.id}
              onClick={() => !readOnly && toggleCompletion(habit.id, todayStr)}
              className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
                done
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-muted'
              }`}
            >
              {done && <Check className="h-3 w-3 text-green-600 dark:text-green-400" />}
              <span className={`max-w-[100px] truncate text-xs font-medium ${
                done
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-muted-foreground'
              }`}>
                {habit.name}
              </span>
            </Button>
          );
        })}
      </div>
    );
  };

  /**
   * 2x2 COMPACT: Today's habits as a tight checklist
   */
  const renderCompactView = () => {
    if (habits.length === 0) return renderEmptyState();

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {habits.map(habit => {
            const done = isCompletedOn(habit, todayStr);
            const streak = calculateStreak(habit);
            return (
              <Button type="button" variant="ghost" size="none"
                key={habit.id}
                onClick={() => !readOnly && toggleCompletion(habit.id, todayStr)}
                className={`w-full flex items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors ${
                  done ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-accent'
                }`}
              >
                <div className={`h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center ${
                  done
                    ? 'border-green-500 bg-green-500'
                    : 'border-border'
                }`}>
                  {done && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <span className={`flex-1 truncate text-xs ${
                  done ? 'text-muted-foreground line-through' : 'text-foreground'
                }`}>
                  {habit.name}
                </span>
                {streak > 0 && (
                  <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                    {streak}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="mt-1 text-[10px] h-auto py-0.5"
          >
            <Plus className="h-2.5 w-2.5 mr-0.5" />
            Add
          </Button>
        )}
      </div>
    );
  };

  /**
   * 3x3 DEFAULT WIDGET: Habit checklist with week-view dots
   */
  const renderDefaultView = () => {
    if (habits.length === 0) return renderEmptyState();

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {habits.map(habit => {
            const streak = calculateStreak(habit);
            return (
              <div key={habit.id} className="mb-3 last:mb-0">
                {/* Habit header */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <span className="font-medium text-sm text-foreground truncate">
                      {habit.name}
                    </span>
                    {!readOnly && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={() => openEditDialog(habit)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteHabit(habit.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                  {streak > 0 && (
                    <span className="text-xs font-medium text-muted-foreground shrink-0 flex items-center gap-0.5">
                      <Flame className="h-3 w-3" />
                      {streak}
                    </span>
                  )}
                </div>

                {/* Week view */}
                <div className="flex gap-0.5">
                  {weekDays.map(({ dateStr, dayName, isToday }) => {
                    const completed = isCompletedOn(habit, dateStr);
                    return (
                      <Button type="button" variant="ghost" size="none"
                        key={dateStr}
                        onClick={() => !readOnly && toggleCompletion(habit.id, dateStr)}
                        className={`
                          flex-1 flex flex-col items-center rounded py-1 px-0.5 text-xs transition-colors
                          ${isToday
                            ? completed
                              ? 'bg-green-500 text-white'
                              : 'bg-secondary text-white'
                            : completed
                              ? 'bg-green-500/80 text-white'
                              : 'bg-muted text-muted-foreground'
                          }
                          ${readOnly ? '' : 'hover:opacity-80'}
                        `}
                      >
                        <span className="font-medium text-[10px]">{dayName}</span>
                        <span className="mt-0.5">
                          {completed ? <Check className="w-3 h-3" /> : '\u00B7'}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="mt-2 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Habit
          </Button>
        )}
      </div>
    );
  };

  /**
   * 4x4–5x5 PANEL: Summary stats + habit list with heatmaps
   */
  const renderPanelView = () => {
    if (habits.length === 0) return renderEmptyState();

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Summary bar */}
        <div className="flex items-center justify-between px-1 py-1.5 border-b mb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-muted-foreground">
                {todayCompletedCount}/{habits.length} today
              </span>
            </div>
            {maxStreak > 0 && (
              <div className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {maxStreak}d streak
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {weeklyCompletionRate}% week
              </span>
            </div>
          </div>
          {!readOnly && (
            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Habit list with 14-day heatmap */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {habits.map(habit => {
            const streak = calculateStreak(habit);
            const heatmap = getHeatmapData(habit, 14);
            return (
              <div key={habit.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* Today toggle */}
                    <Button type="button" variant="ghost" size="none"
                      onClick={() => !readOnly && toggleCompletion(habit.id, todayStr)}
                      className={`h-5 w-5 shrink-0 rounded border flex items-center justify-center transition-colors ${
                        isCompletedOn(habit, todayStr)
                          ? 'border-green-500 bg-green-500'
                          : 'border-border hover:border-green-400'
                      }`}
                    >
                      {isCompletedOn(habit, todayStr) && <Check className="h-3 w-3 text-white" />}
                    </Button>
                    <span className={`text-sm font-medium truncate ${
                      isCompletedOn(habit, todayStr) ? 'text-muted-foreground' : 'text-foreground'
                    }`}>
                      {habit.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {streak > 0 && (
                      <span className="text-xs text-muted-foreground font-medium flex items-center gap-0.5">
                        <Flame className="h-3 w-3" />{streak}
                      </span>
                    )}
                    {!readOnly && (
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEditDialog(habit)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteHabit(habit.id)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 14-day mini heatmap */}
                <div className="flex gap-[2px] pl-7">
                  {heatmap.map(({ dateStr, completed }) => (
                    <div
                      key={dateStr}
                      className={`h-2.5 flex-1 rounded-[2px] ${
                        completed
                          ? 'bg-green-500'
                          : 'bg-muted'
                      }`}
                      title={`${dateStr}: ${completed ? 'Done' : 'Missed'}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * 6x6+ APP: Full habit manager with tabs (Today / All / Analytics),
   * master-detail layout, search, inline editing, heatmaps
   */
  const renderAppView = () => {
    const filteredHabits = searchQuery
      ? habits.filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : habits;

    const selectedHabit = habits.find(h => h.id === selectedHabitId) || null;

    const renderTodayTab = () => (
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredHabits.map(habit => {
          const done = isCompletedOn(habit, todayStr);
          const streak = calculateStreak(habit);
          return (
            <div
              key={habit.id}
              className={`flex items-center gap-3 rounded-lg p-3 transition-colors cursor-pointer ${
                selectedHabitId === habit.id ? 'bg-accent' : 'hover:bg-accent/50'
              }`}
              onClick={() => setSelectedHabitId(habit.id)}
            >
              <Button type="button" variant="ghost" size="none"
                onClick={(e) => { e.stopPropagation(); if (!readOnly) toggleCompletion(habit.id, todayStr); }}
                className={`h-6 w-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                  done
                    ? 'border-green-500 bg-green-500'
                    : 'border-border hover:border-green-400'
                }`}
              >
                {done && <Check className="h-4 w-4 text-white" />}
              </Button>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {habit.name}
                </span>
              </div>
              {streak > 0 && (
                <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                  <Flame className="h-4 w-4" />
                  <span className="text-sm font-semibold">{streak}d</span>
                </div>
              )}
            </div>
          );
        })}
        {filteredHabits.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">{searchQuery ? 'No habits match your search' : 'No habits yet'}</p>
          </div>
        )}
      </div>
    );

    const renderAllTab = () => {
      const extendedDays = getWeekDays(7);
      return (
        <div className="flex-1 overflow-y-auto p-3">
          {/* Column headers */}
          <div className="flex items-center gap-2 mb-2 pl-[140px]">
            {extendedDays.map(({ dateStr, dayLetter, isToday }) => (
              <div key={dateStr} className={`flex-1 text-center text-[10px] font-medium ${isToday ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                {dayLetter}
              </div>
            ))}
          </div>

          {filteredHabits.map(habit => {
            const streak = calculateStreak(habit);
            return (
              <div
                key={habit.id}
                className={`flex items-center gap-2 rounded-lg py-2 px-2 transition-colors cursor-pointer ${
                  selectedHabitId === habit.id ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
                onClick={() => setSelectedHabitId(habit.id)}
              >
                <div className="w-[130px] shrink-0 flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-medium truncate">{habit.name}</span>
                  {streak > 0 && (
                    <span className="text-[10px] text-muted-foreground font-semibold shrink-0">{streak}</span>
                  )}
                </div>
                <div className="flex-1 flex gap-1">
                  {extendedDays.map(({ dateStr, isToday }) => {
                    const completed = isCompletedOn(habit, dateStr);
                    return (
                      <Button type="button" variant="ghost" size="none"
                        key={dateStr}
                        onClick={(e) => { e.stopPropagation(); if (!readOnly) toggleCompletion(habit.id, dateStr); }}
                        className={`flex-1 h-7 rounded flex items-center justify-center transition-colors ${
                          isToday
                            ? completed
                              ? 'bg-green-500 text-white'
                              : 'bg-secondary text-muted-foreground'
                            : completed
                              ? 'bg-green-500/80 text-white'
                              : 'bg-muted text-muted-foreground'
                        } ${readOnly ? '' : 'hover:opacity-80'}`}
                      >
                        {completed && <Check className="h-3.5 w-3.5" />}
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    const renderAnalyticsTab = () => (
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Overview stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground mb-1">Total Habits</div>
            <div className="text-2xl font-bold">{habits.length}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground mb-1">Today</div>
            <div className="text-2xl font-bold text-green-600">{todayCompletedCount}/{habits.length}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground mb-1">7-day Rate</div>
            <div className="text-2xl font-bold text-foreground">{weeklyCompletionRate}%</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground mb-1">30-day Rate</div>
            <div className="text-2xl font-bold text-foreground">{monthlyCompletionRate}%</div>
          </div>
        </div>

        {/* Per-habit 30-day heatmaps */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">30-Day Heatmaps</h3>
          {habits.map(habit => {
            const heatmap = getHeatmapData(habit, 30);
            const streak = calculateStreak(habit);
            const totalDone = habit.completedDates?.length || 0;
            return (
              <div key={habit.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{habit.name}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{totalDone} total</span>
                    {streak > 0 && (
                      <span className="text-muted-foreground font-medium flex items-center gap-0.5">
                        <Flame className="h-3 w-3" />{streak}d
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-[2px]">
                  {heatmap.map(({ dateStr, completed }) => (
                    <div
                      key={dateStr}
                      className={`h-4 flex-1 rounded-[2px] transition-colors ${
                        completed
                          ? 'bg-green-500'
                          : 'bg-muted'
                      }`}
                      title={`${dateStr}: ${completed ? 'Done' : 'Missed'}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    // Detail pane for selected habit
    const renderDetailPane = () => {
      if (!selectedHabit) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
            <BarChart3 className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">Select a habit to see details</p>
          </div>
        );
      }

      const streak = calculateStreak(selectedHabit);
      const heatmap = getHeatmapData(selectedHabit, 30);
      const totalCompleted = selectedHabit.completedDates?.length || 0;
      const createdDate = new Date(selectedHabit.createdAt).toLocaleDateString();

      return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{selectedHabit.name}</h3>
            {!readOnly && (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEditDialog(selectedHabit)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDeleteHabit(selectedHabit.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-2 text-center">
              <div className="text-xs text-muted-foreground">Streak</div>
              <div className="text-xl font-bold text-foreground">{streak}d</div>
            </div>
            <div className="rounded-lg border p-2 text-center">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-xl font-bold">{totalCompleted}</div>
            </div>
            <div className="rounded-lg border p-2 text-center">
              <div className="text-xs text-muted-foreground">Since</div>
              <div className="text-sm font-medium mt-1">{createdDate}</div>
            </div>
          </div>

          {/* 30-day heatmap */}
          <div>
            <h4 className="text-sm font-medium mb-1.5">Last 30 Days</h4>
            <div className="flex gap-[2px]">
              {heatmap.map(({ dateStr, completed }) => (
                <div
                  key={dateStr}
                  className={`h-5 flex-1 rounded-[2px] ${
                    completed ? 'bg-green-500' : 'bg-muted'
                  }`}
                  title={`${dateStr}: ${completed ? 'Done' : 'Missed'}`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">30 days ago</span>
              <span className="text-[10px] text-muted-foreground">Today</span>
            </div>
          </div>

          {/* Week view */}
          <div>
            <h4 className="text-sm font-medium mb-1.5">This Week</h4>
            <div className="flex gap-1">
              {getWeekDays(3).map(({ dateStr, dayName, isToday }) => {
                const completed = isCompletedOn(selectedHabit, dateStr);
                return (
                  <Button type="button" variant="ghost" size="none"
                    key={dateStr}
                    onClick={() => !readOnly && toggleCompletion(selectedHabit.id, dateStr)}
                    className={`flex-1 flex flex-col items-center rounded-lg py-2 transition-colors ${
                      isToday
                        ? completed ? 'bg-green-500 text-white' : 'bg-secondary text-foreground'
                        : completed ? 'bg-green-500/80 text-white' : 'bg-muted text-muted-foreground'
                    } ${readOnly ? '' : 'hover:opacity-80'}`}
                  >
                    <span className="text-xs font-medium">{dayName}</span>
                    <span className="mt-1">{completed ? <Check className="h-4 w-4" /> : '\u00B7'}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="flex flex-col h-full">
        {/* App header with tabs and search */}
        <div className="widget-drag-handle cursor-move">
          <div className="flex items-center justify-between px-3 py-2">
            <h2 className="text-base font-semibold">{localConfig.title || 'Habits'}</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="h-7 w-40 pl-7 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {!readOnly && (
                <Button size="sm" className="h-7 text-xs" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Habit
                </Button>
              )}
            </div>
          </div>
          <div className="flex px-3">
            {(['today', 'all', 'analytics'] as const).map(tab => (
              <Button
                key={tab}
                variant="ghost"
                className={`px-3 py-2 text-sm capitalize rounded-none ${
                  appTab === tab
                    ? 'border-b-2 border-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setAppTab(tab)}
              >
                {tab}
              </Button>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Master list */}
          <div className={`${appTab === 'analytics' ? 'w-full' : 'flex-1'} overflow-hidden flex flex-col`}>
            {appTab === 'today' && renderTodayTab()}
            {appTab === 'all' && renderAllTab()}
            {appTab === 'analytics' && renderAnalyticsTab()}
          </div>

          {/* Detail pane (not for analytics tab) */}
          {appTab !== 'analytics' && (
            <div className="w-2/5 border-l overflow-hidden flex flex-col">
              {renderDetailPane()}
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Shared components ---

  const renderEmptyState = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <Check className="w-8 h-8 text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground mb-3">
        Track your daily habits
      </p>
      {!readOnly && (
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add Habit
        </Button>
      )}
    </div>
  );

  // --- Add/Edit Dialog ---
  const renderHabitDialog = () => (
    <Dialog
      open={showAddDialog || !!editingHabit}
      onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setEditingHabit(null);
          setHabitName('');
        }
      }}
    >
      <DialogContent className="settings-dialog-content sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingHabit ? 'Edit Habit' : 'Add Habit'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="habitName">Habit Name</Label>
            <Input
              id="habitName"
              placeholder="e.g., Meditate 10 mins"
              value={habitName}
              onChange={(e) => setHabitName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (editingHabit) {
                    handleEditHabit();
                  } else {
                    handleAddHabit();
                  }
                }
              }}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-end w-full gap-2">
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingHabit(null); setHabitName(''); }}>
              Cancel
            </Button>
            <Button onClick={editingHabit ? handleEditHabit : handleAddHabit}>
              {editingHabit ? 'Save' : 'Add Habit'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // --- Settings Modal (snapshot/revert pattern) ---
  const renderSettingsModal = () => (
    <Dialog
      open={showSettings}
      onOpenChange={(open) => {
        if (!open) {
          // Revert to persisted config on close
          if (config) setLocalConfig(prev => ({ ...prev, ...config }));
          setShowSettings(false);
        }
      }}
    >
      <DialogContent className="settings-dialog-content sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{localConfig.title || 'Habits'} Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={localConfig.title || ''}
              onChange={(e) => setLocalConfig(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              You have {habits.length} habit{habits.length !== 1 ? 's' : ''} being tracked.
            </p>
          </div>

          {/* Habit list management */}
          {habits.length > 0 && (
            <div className="max-h-[200px] overflow-y-auto border rounded-lg divide-y">
              {habits.map(habit => (
                <div key={habit.id} className="flex items-center gap-2 p-2">
                  <span className="flex-1 truncate text-sm">{habit.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {calculateStreak(habit)}d streak
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => openEditDialog(habit)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleDeleteHabit(habit.id)}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={() => { setShowSettings(false); setShowAddDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Habit
          </Button>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            {config?.onDelete && (
              <Button variant="destructive" onClick={config.onDelete}>Delete Widget</Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={() => {
                  // Revert on cancel
                  if (config) setLocalConfig(prev => ({ ...prev, ...config }));
                  setShowSettings(false);
                }}
              >
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
    <div className={cn('widget-container h-full flex flex-col', isTiny && 'widget-drag-handle', !isTiny && !isApp && 'p-2 md:p-3')}>
      {!isTiny && !isApp && (
        <WidgetHeader
          title={localConfig.title || 'Habits'}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      <div className={`flex-1 overflow-hidden ${isTiny ? 'p-1' : isApp ? '' : ''}`}>
        {isTiny ? renderTinyView()
          : isShort ? renderRibbonView()
          : isApp ? renderAppView()
          : isWide && isTall ? renderPanelView()
          : isCompact ? renderCompactView()
          : renderDefaultView()}
      </div>

      {renderHabitDialog()}
      {renderSettingsModal()}
    </div>
  );
};

export default HabitWidget;
