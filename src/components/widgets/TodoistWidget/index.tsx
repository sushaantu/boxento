import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { useVisibilityRefresh } from '../../../lib/useVisibilityRefresh';
import {
  Check,
  Loader2,
  CalendarIcon,
  ExternalLink,
  CheckSquare,
  AlertCircle,
  Search,
  Plus,
  Flag,
  ChevronRight,
  FolderOpen,
  Inbox,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import WidgetHeader from '../common/WidgetHeader';
import { TodoistWidgetConfig, TodoistWidgetProps, TodoistTask, TodoistProject } from './types';
import { cn } from '@/lib/utils';
import { Button } from '../../ui/button';

const defaultConfig: TodoistWidgetConfig = {
  title: 'Todoist Tasks',
  maxTasks: 10,
  showCompleted: false,
};

// Priority color mapping (Todoist: 4=urgent/red, 3=high/orange, 2=medium/blue, 1=normal/none)
const getPriorityColor = (priority: number) => {
  switch (priority) {
    case 4: return 'text-red-500';
    case 3: return 'text-orange-500';
    case 2: return 'text-blue-500';
    default: return 'text-muted-foreground';
  }
};

const getPriorityBorder = (priority: number) => {
  switch (priority) {
    case 4: return 'border-red-500 hover:border-red-600';
    case 3: return 'border-orange-500 hover:border-orange-600';
    case 2: return 'border-blue-500 hover:border-blue-600';
    default: return 'border-border hover:border-muted-foreground/60';
  }
};

const COMPLETED_TASK_CHROME_CLASS = 'bg-foreground border-foreground';
const COMPLETED_TASK_ICON_CLASS = 'text-background';

const getPriorityLabel = (priority: number) => {
  switch (priority) {
    case 4: return 'Urgent';
    case 3: return 'High';
    case 2: return 'Medium';
    default: return 'Normal';
  }
};

// Memoized task content formatter
const TaskContent = memo(({ content, completed, className }: { content: string; completed: boolean; className?: string }) => {
  const urlPattern = /\[(.*?)]\((https?:\/\/[^\s)]+)\)/g;

  const formattedContent = useMemo(() => {
    if (!content.match(urlPattern)) {
      return <span>{content}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = urlPattern.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${match.index}`}>
            {content.slice(lastIndex, match.index)}
          </span>
        );
      }

      parts.push(
        <a
          key={`link-${match.index}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground hover:underline"
        >
          {match[1]}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(
        <span key="text-end">
          {content.slice(lastIndex)}
        </span>
      );
    }

    return <>{parts}</>;
  }, [content]);

  return (
    <span className={`flex-grow ${completed ? 'line-through text-muted-foreground' : ''} ${className || ''}`}>
      {formattedContent}
    </span>
  );
});

TaskContent.displayName = 'TaskContent';

// Memoized task component for default/panel views
const Task = memo(({
  task,
  onToggle,
  isPending,
  readOnly,
  compact = false,
}: {
  task: TodoistTask;
  onToggle: (id: string, completed: boolean) => void;
  isPending: boolean;
  readOnly: boolean;
  compact?: boolean;
}) => {
  return (
    <div className={`flex items-center ${compact ? 'gap-2 py-1 px-1' : 'gap-3 p-2'} hover:bg-accent rounded-lg group`}>
      {!readOnly && (
        <Button type="button" variant="ghost" size="none"
          onClick={() => onToggle(task.id, !task.completed)}
          className={`flex-shrink-0 ${compact ? 'w-4 h-4' : 'w-[18px] h-[18px]'} rounded-full border-2 ${
            task.completed
              ? COMPLETED_TASK_CHROME_CLASS
              : getPriorityBorder(task.priority)
          } flex items-center justify-center transition-colors relative`}
          aria-label={task.completed ? 'Mark task as incomplete' : 'Mark task as complete'}
          disabled={isPending}
        >
          {task.completed && (
            <Check
              className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} ${COMPLETED_TASK_ICON_CLASS} ${isPending ? 'opacity-50' : ''}`}
              strokeWidth={3}
            />
          )}
          {isPending && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2
                className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} animate-spin ${
                  task.completed ? COMPLETED_TASK_ICON_CLASS : 'text-foreground'
                }`}
              />
            </div>
          )}
        </Button>
      )}
      {readOnly && (
        <div className={`flex-shrink-0 ${compact ? 'w-4 h-4' : 'w-[18px] h-[18px]'} rounded-full border-2 ${
          task.completed ? COMPLETED_TASK_CHROME_CLASS : getPriorityBorder(task.priority)
        } flex items-center justify-center`}>
          {task.completed && (
            <Check
              className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} ${COMPLETED_TASK_ICON_CLASS}`}
              strokeWidth={3}
            />
          )}
        </div>
      )}
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2">
          <TaskContent content={task.content} completed={task.completed} className={compact ? 'text-xs' : 'text-sm'} />
          <a
            href={task.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
            aria-label="Open in Todoist"
          >
            <ExternalLink className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
          </a>
        </div>
        {task.due && !compact && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <CalendarIcon className="w-3 h-3" />
            <span>{task.due.string}</span>
          </div>
        )}
      </div>
    </div>
  );
});

Task.displayName = 'Task';

const TodoistWidget: React.FC<TodoistWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [projects, setProjects] = useState<TodoistProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<TodoistWidgetConfig>({
    ...defaultConfig,
    ...config,
  });
  const [pendingTasks, setPendingTasks] = useState<Set<string>>(new Set());
  const [configSnapshot, setConfigSnapshot] = useState<TodoistWidgetConfig | null>(null);

  // App-mode state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskContent, setNewTaskContent] = useState('');

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Fetch projects from Todoist
  const fetchProjects = useCallback(async () => {
    if (!localConfig?.apiToken) return;

    try {
      const response = await fetch('https://api.todoist.com/rest/v2/projects', {
        headers: { 'Authorization': `Bearer ${localConfig.apiToken}` }
      });

      if (!response.ok) throw new Error('Failed to fetch projects');

      const data = await response.json();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  }, [localConfig?.apiToken]);

  // Fetch tasks from Todoist
  const fetchTasks = useCallback(async () => {
    if (!localConfig?.apiToken) {
      setError('API token not configured');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = localConfig.projectId
        ? `https://api.todoist.com/rest/v2/tasks?project_id=${localConfig.projectId}`
        : 'https://api.todoist.com/rest/v2/tasks';

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localConfig.apiToken}` }
      });

      if (!response.ok) throw new Error('Failed to fetch tasks');

      const data = await response.json();
      const filteredTasks = localConfig.showCompleted
        ? data
        : data.filter((task: TodoistTask) => !task.completed);

      setTasks(filteredTasks.slice(0, localConfig.maxTasks || 10));
    } catch (err) {
      console.error('Error fetching Todoist tasks:', err);
      setError('Failed to fetch tasks. Please check your API token.');
    } finally {
      setLoading(false);
    }
  }, [localConfig?.apiToken, localConfig?.projectId, localConfig?.showCompleted, localConfig?.maxTasks]);

  // Toggle task completion
  const toggleTask = useCallback(async (taskId: string, completed: boolean) => {
    if (!localConfig?.apiToken || pendingTasks.has(taskId) || readOnly) return;

    setPendingTasks(prev => new Set(prev).add(taskId));
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, completed } : task
      )
    );

    try {
      const endpoint = completed ? 'close' : 'reopen';
      const response = await fetch(`https://api.todoist.com/rest/v2/tasks/${taskId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localConfig.apiToken}` }
      });

      if (!response.ok) throw new Error('Failed to update task');

      setPendingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Failed to update task');

      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, completed: !completed } : task
        )
      );
      setPendingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [localConfig?.apiToken, pendingTasks, readOnly]);

  // Add a new task (app mode)
  const addTask = useCallback(async () => {
    if (!localConfig?.apiToken || !newTaskContent.trim() || readOnly) return;

    try {
      const body: Record<string, string> = { content: newTaskContent.trim() };
      if (selectedProjectId) {
        body.project_id = selectedProjectId;
      } else if (localConfig.projectId) {
        body.project_id = localConfig.projectId;
      }

      const response = await fetch('https://api.todoist.com/rest/v2/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localConfig.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to add task');

      const newTask = await response.json();
      setTasks(prev => [newTask, ...prev]);
      setNewTaskContent('');
    } catch (err) {
      console.error('Error adding task:', err);
      setError('Failed to add task');
    }
  }, [localConfig?.apiToken, localConfig?.projectId, newTaskContent, selectedProjectId, readOnly]);

  useEffect(() => {
    if (localConfig?.apiToken) {
      fetchTasks();
      if (isApp || (isWide && isTall)) {
        fetchProjects();
      }
    }
  }, [fetchTasks, fetchProjects, isApp, isWide, isTall]);

  // Auto-refresh
  useVisibilityRefresh({
    onRefresh: fetchTasks,
    minHiddenTime: 60000,
    refreshInterval: 300000,
    enabled: !!localConfig?.apiToken,
  });

  // Computed values
  const completedCount = tasks.filter(t => t.completed).length;
  const pendingCount = tasks.length - completedCount;

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (selectedProjectId) {
      result = result.filter(t => t.project_id === selectedProjectId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.content.toLowerCase().includes(q));
    }
    return result;
  }, [tasks, selectedProjectId, searchQuery]);

  const selectedTask = useMemo(() => {
    return tasks.find(t => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  const projectName = useCallback((projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || 'Unknown Project';
  }, [projects]);

  // --- Settings modal: snapshot/revert pattern ---
  const handleSettingsOpen = useCallback(() => {
    setConfigSnapshot({ ...localConfig });
    setShowSettings(true);
  }, [localConfig]);

  const handleSettingsOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && configSnapshot) {
      setLocalConfig(configSnapshot);
      setConfigSnapshot(null);
    }
    setShowSettings(nextOpen);
  }, [configSnapshot]);

  const handleCancelSettings = useCallback(() => {
    if (configSnapshot) {
      setLocalConfig(configSnapshot);
      setConfigSnapshot(null);
    }
    setShowSettings(false);
  }, [configSnapshot]);

  const saveSettings = useCallback(() => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setConfigSnapshot(null);
    setShowSettings(false);
  }, [config, localConfig]);

  // --- Setup prompt ---
  if (!localConfig?.apiToken) {
    if (isTiny) {
      return (
        <div className="widget-container h-full flex flex-col widget-drag-handle">
          <div className="flex-1 flex items-center justify-center p-1" onClick={() => !readOnly && setShowSettings(true)}>
            <CheckSquare className="w-5 h-5 text-muted-foreground" />
          </div>
          {renderSettingsDialog()}
        </div>
      );
    }

    return (
      <div className="widget-container h-full flex flex-col p-2 md:p-3">
        <WidgetHeader
          title={localConfig.title || defaultConfig.title}
          onSettingsClick={readOnly ? undefined : () => handleSettingsOpen()}
          compact={isShort || isTiny}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <CheckSquare className="h-8 w-8" />
          <p className="text-sm">Configure your Todoist API token</p>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => handleSettingsOpen()}>
              Open Settings
            </Button>
          )}
        </div>
        {renderSettingsDialog()}
      </div>
    );
  }

  // --- Loading / Error states for non-tiny views ---
  function renderLoadingState() {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function renderErrorState() {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-2">
        <AlertCircle size={24} className="text-red-500" strokeWidth={1.5} />
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        <Button size="sm" onClick={fetchTasks}>Retry</Button>
      </div>
    );
  }

  function renderEmptyState() {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <CheckSquare className="w-6 h-6" />
        <span className="text-sm">No tasks found</span>
      </div>
    );
  }

  // --- 1x1 ICON: task count badge ---
  function renderTiny() {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <div className="text-lg font-semibold leading-none text-foreground">
          {pendingCount}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          tasks
        </div>
      </div>
    );
  }

  // --- Nx1 RIBBON: task count + upcoming task names as chips ---
  function renderShort() {
    if (loading && tasks.length === 0) return renderLoadingState();
    if (error && tasks.length === 0) return renderErrorState();

    const previewTasks = filteredTasks.filter(t => !t.completed).slice(0, Math.max(2, width));
    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs">
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 font-medium text-foreground">
          {pendingCount} tasks
        </span>
        {previewTasks.map(task => (
          <a
            key={task.id}
            href={task.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-foreground transition-colors hover:bg-accent max-w-[10rem] truncate"
          >
            {task.priority >= 3 && <Flag className={`w-3 h-3 flex-shrink-0 ${getPriorityColor(task.priority)}`} />}
            <span className="truncate">{task.content}</span>
          </a>
        ))}
      </div>
    );
  }

  // --- 2x2 MICRO: compact task list ---
  function renderCompact() {
    if (loading && tasks.length === 0) return renderLoadingState();
    if (error && tasks.length === 0) return renderErrorState();
    if (filteredTasks.length === 0) return renderEmptyState();

    const visibleTasks = filteredTasks.slice(0, 5);
    return (
      <div className="flex-1 overflow-auto space-y-0.5">
        {visibleTasks.map(task => (
          <Task
            key={task.id}
            task={task}
            onToggle={toggleTask}
            isPending={pendingTasks.has(task.id)}
            readOnly={readOnly}
            compact
          />
        ))}
        {filteredTasks.length > visibleTasks.length && (
          <div className="text-[10px] text-center text-muted-foreground pt-1">
            +{filteredTasks.length - visibleTasks.length} more
          </div>
        )}
      </div>
    );
  }

  // --- 3x3 WIDGET: standard task list ---
  function renderDefault() {
    if (loading && tasks.length === 0) return renderLoadingState();
    if (error && tasks.length === 0) return renderErrorState();
    if (filteredTasks.length === 0) return renderEmptyState();

    return (
      <div className="flex-1 overflow-auto">
        <div className="space-y-1">
          {filteredTasks.map(task => (
            <Task
              key={task.id}
              task={task}
              onToggle={toggleTask}
              isPending={pendingTasks.has(task.id)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>
    );
  }

  // --- 4x4-5x5 PANEL: split pending/completed ---
  function renderPanel() {
    if (loading && tasks.length === 0) return renderLoadingState();
    if (error && tasks.length === 0) return renderErrorState();

    const pending = filteredTasks.filter(t => !t.completed);
    const completed = filteredTasks.filter(t => t.completed);

    return (
      <div className="flex flex-col h-full">
        {/* Summary bar */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
              {pending.length} pending
            </span>
            {completed.length > 0 && (
              <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-green-700 dark:text-green-300">
                {completed.length} done
              </span>
            )}
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add a task..."
                value={newTaskContent}
                onChange={(e) => setNewTaskContent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                className="h-7 text-xs w-40"
              />
              <Button size="sm" variant="outline" onClick={addTask} disabled={!newTaskContent.trim()} className="h-7 px-2">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Two-column content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Pending tasks */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1">
              Pending
            </div>
            {pending.length === 0 ? (
              <div className="text-xs text-center text-muted-foreground py-4">All done!</div>
            ) : (
              <div className="space-y-0.5">
                {pending.map(task => (
                  <Task
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    isPending={pendingTasks.has(task.id)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Completed tasks */}
          {completed.length > 0 && (
            <div className="w-2/5 border-l border-border/50 overflow-y-auto p-2">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1">
                Completed
              </div>
              <div className="space-y-0.5">
                {completed.map(task => (
                  <Task
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    isPending={pendingTasks.has(task.id)}
                    readOnly={readOnly}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- 6x6+ APP: full task manager with project sidebar, task details ---
  function renderApp() {
    if (loading && tasks.length === 0) return renderLoadingState();
    if (error && tasks.length === 0) return renderErrorState();

    const pending = filteredTasks.filter(t => !t.completed);
    const completed = filteredTasks.filter(t => t.completed);

    return (
      <div className="flex h-full">
        {/* Sidebar: project filter */}
        <div className="w-1/4 min-w-[160px] max-w-[240px] border-r border-border/50 overflow-y-auto flex flex-col">
          <div className="p-3 widget-drag-handle cursor-move">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            <Button type="button" variant="ghost" size="none"
              onClick={() => setSelectedProjectId(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                !selectedProjectId
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-foreground hover:bg-accent/50'
              }`}
            >
              <Inbox className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">All Tasks</span>
              <span className="ml-auto text-xs text-muted-foreground">{tasks.length}</span>
            </Button>

            {projects.map(project => {
              const projectTaskCount = tasks.filter(t => t.project_id === project.id).length;
              if (projectTaskCount === 0) return null;
              return (
                <Button type="button" variant="ghost" size="none"
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id === selectedProjectId ? null : project.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    selectedProjectId === project.id
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-foreground hover:bg-accent/50'
                  }`}
                >
                  <FolderOpen className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{project.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{projectTaskCount}</span>
                </Button>
              );
            })}
          </div>

          <div className="p-2 border-t border-border/50 text-[11px] text-muted-foreground text-center">
            {pendingCount} pending / {completedCount} done
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Add task bar */}
          {!readOnly && (
            <div className="flex items-center gap-2 p-3 border-b border-border/50">
              <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder="Add a new task..."
                value={newTaskContent}
                onChange={(e) => setNewTaskContent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                className="h-8 text-sm border-none shadow-none focus-visible:ring-0 px-0"
              />
              {newTaskContent.trim() && (
                <Button size="sm" onClick={addTask} className="h-7 px-3 text-xs">
                  Add
                </Button>
              )}
            </div>
          )}

          {/* Task sections */}
          <div className="flex-1 overflow-y-auto">
            {filteredTasks.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                {/* Pending tasks */}
                {pending.length > 0 && (
                  <div className="px-1 pt-2">
                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-1">
                      Pending ({pending.length})
                    </div>
                    {pending.map(task => (
                      <div
                        key={task.id}
                        className={`cursor-pointer ${selectedTaskId === task.id ? 'bg-accent/50' : ''}`}
                        onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                      >
                        <div className="flex items-center gap-3 px-3 py-2 hover:bg-accent rounded-lg group">
                          {!readOnly ? (
                            <Button type="button" variant="ghost" size="none"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTask(task.id, !task.completed);
                              }}
                              className={`flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 ${
                                task.completed
                                  ? COMPLETED_TASK_CHROME_CLASS
                                  : getPriorityBorder(task.priority)
                              } flex items-center justify-center transition-colors relative`}
                              disabled={pendingTasks.has(task.id)}
                            >
                              {pendingTasks.has(task.id) && (
                                <Loader2 className="w-3 h-3 animate-spin text-foreground" />
                              )}
                            </Button>
                          ) : (
                            <div className={`flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 ${getPriorityBorder(task.priority)} flex items-center justify-center`} />
                          )}
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm truncate">{task.content}</span>
                              {task.priority >= 3 && (
                                <Flag className={`w-3 h-3 flex-shrink-0 ${getPriorityColor(task.priority)}`} />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {task.due && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <CalendarIcon className="w-3 h-3" />
                                  {task.due.string}
                                </span>
                              )}
                              {projects.length > 0 && (
                                <span className="text-[11px] text-muted-foreground">
                                  {projectName(task.project_id)}
                                </span>
                              )}
                            </div>
                          </div>
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Completed tasks */}
                {completed.length > 0 && (
                  <div className="px-1 pt-3 pb-2">
                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-1">
                      Completed ({completed.length})
                    </div>
                    {completed.map(task => (
                      <div
                        key={task.id}
                        className={`cursor-pointer ${selectedTaskId === task.id ? 'bg-accent/50' : ''}`}
                        onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                      >
                        <Task
                          task={task}
                          onToggle={toggleTask}
                          isPending={pendingTasks.has(task.id)}
                          readOnly={readOnly}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Detail pane */}
        {selectedTask && (
          <div className="w-1/3 max-w-[320px] border-l border-border/50 overflow-y-auto p-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-base text-foreground">{selectedTask.content}</h3>
                {selectedTask.description && (
                  <p className="text-sm text-muted-foreground mt-2">{selectedTask.description}</p>
                )}
              </div>

              <div className="space-y-3">
                {/* Priority */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Priority</span>
                  <span className={`flex items-center gap-1 font-medium ${getPriorityColor(selectedTask.priority)}`}>
                    <Flag className="w-3.5 h-3.5" />
                    {getPriorityLabel(selectedTask.priority)}
                  </span>
                </div>

                {/* Due date */}
                {selectedTask.due && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Due date</span>
                    <span className="flex items-center gap-1 text-foreground">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {selectedTask.due.string}
                    </span>
                  </div>
                )}

                {/* Project */}
                {projects.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Project</span>
                    <span className="flex items-center gap-1 text-foreground">
                      <FolderOpen className="w-3.5 h-3.5" />
                      {projectName(selectedTask.project_id)}
                    </span>
                  </div>
                )}

                {/* Labels */}
                {selectedTask.labels && selectedTask.labels.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground block mb-1">Labels</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedTask.labels.map(label => (
                        <span key={label} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`font-medium ${selectedTask.completed ? 'text-green-600' : 'text-foreground'}`}>
                    {selectedTask.completed ? 'Completed' : 'Pending'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-border/50 space-y-2">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a href={selectedTask.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-2" />
                    Open in Todoist
                  </a>
                </Button>
                {!readOnly && (
                  <Button
                    variant={selectedTask.completed ? 'outline' : 'default'}
                    size="sm"
                    className="w-full"
                    onClick={() => toggleTask(selectedTask.id, !selectedTask.completed)}
                    disabled={pendingTasks.has(selectedTask.id)}
                  >
                    {pendingTasks.has(selectedTask.id) ? (
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 mr-2" />
                    )}
                    {selectedTask.completed ? 'Reopen Task' : 'Complete Task'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Settings Modal ---
  function renderSettingsDialog() {
    return (
      <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{localConfig.title || 'Todoist'} Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="todoist-title">Title</Label>
              <Input
                id="todoist-title"
                value={localConfig.title || ''}
                onChange={(e) =>
                  setLocalConfig(prev => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="todoist-api-token">API Token</Label>
              <Input
                id="todoist-api-token"
                type="password"
                value={localConfig.apiToken || ''}
                onChange={(e) =>
                  setLocalConfig(prev => ({ ...prev, apiToken: e.target.value }))
                }
                placeholder="Enter your Todoist API token"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Get your API token from Todoist Settings &rarr; Integrations
              </p>
            </div>

            <div>
              <Label htmlFor="todoist-project-id">Project ID (Optional)</Label>
              <Input
                id="todoist-project-id"
                type="text"
                value={localConfig.projectId || ''}
                onChange={(e) =>
                  setLocalConfig(prev => ({ ...prev, projectId: e.target.value }))
                }
                placeholder="Enter project ID to filter tasks"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="todoist-show-completed">Show Completed Tasks</Label>
              <Switch
                id="todoist-show-completed"
                checked={localConfig.showCompleted || false}
                onCheckedChange={(checked) =>
                  setLocalConfig(prev => ({ ...prev, showCompleted: checked }))
                }
              />
            </div>

            <div>
              <Label htmlFor="todoist-max-tasks">Maximum Tasks</Label>
              <Input
                id="todoist-max-tasks"
                type="number"
                value={localConfig.maxTasks || 10}
                onChange={(e) =>
                  setLocalConfig(prev => ({ ...prev, maxTasks: parseInt(e.target.value) || 10 }))
                }
                min="1"
                max="50"
              />
            </div>
          </div>

          <DialogFooter>
            <div className="flex justify-between w-full">
              {config?.onDelete && (
                <Button variant="destructive" onClick={config.onDelete}>Delete Widget</Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" onClick={handleCancelSettings}>Cancel</Button>
                <Button onClick={saveSettings}>Save</Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}>
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title || defaultConfig.title}
          onSettingsClick={readOnly ? undefined : handleSettingsOpen}
          compact={isShort || isCompact}
        />
      )}

      {isTiny && (
        <div className="flex-1 flex items-center justify-center p-1">
          {loading && tasks.length === 0 ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : error && tasks.length === 0 ? (
            <AlertCircle className="w-5 h-5 text-red-500" />
          ) : (
            renderTiny()
          )}
        </div>
      )}

      {!isTiny && (
        <div className={`flex-grow overflow-hidden ${isShort ? 'px-1' : ''}`}>
          {isShort ? renderShort()
            : isApp ? renderApp()
            : isWide && isTall ? renderPanel()
            : isCompact ? renderCompact()
            : renderDefault()}
        </div>
      )}

      {renderSettingsDialog()}
    </div>
  );
};

export default TodoistWidget;
