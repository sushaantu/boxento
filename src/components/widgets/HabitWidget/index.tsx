import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Check, Pencil, X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Button,
  Label,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import type { HabitWidgetProps, Habit } from './types';

const HabitWidget: React.FC<HabitWidgetProps> = ({ config }) => {
  const [habits, setHabits] = useState<Habit[]>(config?.habits || []);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitName, setHabitName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect if widget is in compact mode (small size)
  useEffect(() => {
    const checkSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setIsCompact(width < 280);
      }
    };

    checkSize();
    const resizeObserver = new ResizeObserver(checkSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Generate array of days centered around today
  const weekDays = useMemo(() => {
    const days: { date: Date; dateStr: string; dayName: string; dayLetter: string; isToday: boolean }[] = [];
    const today = new Date();
    const range = isCompact ? 2 : 3; // 5 days for compact, 7 for normal

    for (let i = -range; i <= range; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({
        date,
        dateStr: date.toISOString().split('T')[0],
        dayName,
        dayLetter: dayName.charAt(0),
        isToday: i === 0
      });
    }
    return days;
  }, [isCompact]);

  // Calculate streak for a habit
  const calculateStreak = (habit: Habit): number => {
    if (!habit.completedDates || habit.completedDates.length === 0) return 0;

    const sortedDates = [...habit.completedDates].sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Streak must include today or yesterday to be active
    if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0;

    let streak = 0;
    let checkDate = new Date(sortedDates[0]);

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
  };

  // Check if a habit is completed on a specific date
  const isCompletedOn = (habit: Habit, dateStr: string): boolean => {
    return habit.completedDates?.includes(dateStr) || false;
  };

  // Toggle habit completion for a date
  const toggleCompletion = (habitId: string, dateStr: string) => {
    const updatedHabits = habits.map(habit => {
      if (habit.id !== habitId) return habit;

      const completedDates = habit.completedDates || [];
      const isCompleted = completedDates.includes(dateStr);

      return {
        ...habit,
        completedDates: isCompleted
          ? completedDates.filter(d => d !== dateStr)
          : [...completedDates, dateStr]
      };
    });

    setHabits(updatedHabits);
    saveHabits(updatedHabits);
  };

  // Save habits to config
  const saveHabits = (updatedHabits: Habit[]) => {
    if (config?.onUpdate) {
      config.onUpdate({ ...config, habits: updatedHabits });
    }
  };

  // Add new habit
  const handleAddHabit = () => {
    if (!habitName.trim()) return;

    const newHabit: Habit = {
      id: `habit-${Date.now()}`,
      name: habitName.trim(),
      createdAt: new Date().toISOString(),
      completedDates: []
    };

    const updatedHabits = [...habits, newHabit];
    setHabits(updatedHabits);
    saveHabits(updatedHabits);
    setHabitName('');
    setShowAddDialog(false);
  };

  // Edit habit
  const handleEditHabit = () => {
    if (!editingHabit || !habitName.trim()) return;

    const updatedHabits = habits.map(habit =>
      habit.id === editingHabit.id
        ? { ...habit, name: habitName.trim() }
        : habit
    );

    setHabits(updatedHabits);
    saveHabits(updatedHabits);
    setHabitName('');
    setEditingHabit(null);
  };

  // Delete habit
  const handleDeleteHabit = (habitId: string) => {
    const updatedHabits = habits.filter(h => h.id !== habitId);
    setHabits(updatedHabits);
    saveHabits(updatedHabits);
  };

  // Open edit dialog
  const openEditDialog = (habit: Habit) => {
    setEditingHabit(habit);
    setHabitName(habit.name);
  };

  // Render empty state
  const renderEmptyState = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <div className="text-4xl mb-3">
        <Check className="w-8 h-8 text-gray-400" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Track your daily habits
      </p>
      <Button size="sm" onClick={() => setShowAddDialog(true)}>
        <Plus className="w-4 h-4 mr-1" />
        Add Habit
      </Button>
    </div>
  );

  // Render habit item
  const renderHabitItem = (habit: Habit) => {
    const streak = calculateStreak(habit);

    return (
      <div key={habit.id} className={`${isCompact ? 'mb-2' : 'mb-4'} last:mb-0`}>
        {/* Habit header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className={`font-medium text-gray-900 dark:text-white truncate ${isCompact ? 'text-xs' : 'text-sm'}`}>
              {habit.name}
            </span>
            {!isCompact && (
              <>
                <button
                  onClick={() => openEditDialog(habit)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteHabit(habit.id)}
                  className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
          {streak > 0 && (
            <span className={`font-medium text-orange-500 flex-shrink-0 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
              {isCompact ? streak : `Streak: ${streak}`}
            </span>
          )}
        </div>

        {/* Week view */}
        <div className="flex gap-0.5">
          {weekDays.map(({ dateStr, dayName, dayLetter, isToday }) => {
            const completed = isCompletedOn(habit, dateStr);
            return (
              <button
                key={dateStr}
                onClick={() => toggleCompletion(habit.id, dateStr)}
                className={`
                  flex-1 flex flex-col items-center rounded transition-colors
                  ${isCompact ? 'py-1 text-[10px]' : 'py-1.5 px-1 text-xs'}
                  ${isToday
                    ? completed
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-700 text-white'
                    : completed
                      ? 'bg-green-500/80 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }
                  hover:opacity-80
                `}
              >
                <span className="font-medium">{isCompact ? dayLetter : dayName}</span>
                <span className={isCompact ? '' : 'mt-0.5'}>
                  {completed ? <Check className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} /> : '?'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Render habits list
  const renderHabits = () => (
    <div className="h-full flex flex-col">
      {/* Habits list */}
      <div className="flex-1 overflow-y-auto pr-1">
        {habits.map(renderHabitItem)}
      </div>

      {/* Add button at bottom - muted style */}
      <button
        onClick={() => setShowAddDialog(true)}
        className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center gap-1"
      >
        <Plus className="w-3 h-3" />
        Add Habit
      </button>
    </div>
  );

  // Add/Edit dialog
  const renderDialog = () => (
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {editingHabit ? 'Edit Habit' : 'Add Habit'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="habitName">Habit Name</Label>
            <Input
              id="habitName"
              placeholder="e.g., Meditate 10 mins"
              value={habitName}
              onChange={(e) => setHabitName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  editingHabit ? handleEditHabit() : handleAddHabit();
                }
              }}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={editingHabit ? handleEditHabit : handleAddHabit}>
            {editingHabit ? 'Save' : 'Add Habit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Settings dialog (for widget deletion)
  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Habit Tracker Settings</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You have {habits.length} habit{habits.length !== 1 ? 's' : ''} being tracked.
          </p>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            {config?.onDelete && (
              <Button variant="destructive" onClick={config.onDelete}>
                Delete Widget
              </Button>
            )}
            {!config?.onDelete && <div />}
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="widget-container h-full flex flex-col" ref={containerRef}>
      <WidgetHeader
        title="Habits"
        onSettingsClick={() => setShowSettings(true)}
      />

      <div className={`flex-grow overflow-hidden ${isCompact ? 'p-2' : 'p-3'}`}>
        {habits.length === 0 ? renderEmptyState() : renderHabits()}
      </div>

      {renderDialog()}
      {renderSettings()}
    </div>
  );
};

export default HabitWidget;
