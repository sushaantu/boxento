import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVisibilityRefresh } from '../../../lib/useVisibilityRefresh';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../ui/dialog';
import WidgetHeader from '../common/WidgetHeader';
import { GitHubStreakWidgetProps, GitHubStreakWidgetConfig } from './types';
import { cn } from '@/lib/utils';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import {
  AlertCircle,
  Flame,
  Github,
  Shield,
  Trophy,
  Calendar,
  GitCommit,
  TrendingUp,
} from 'lucide-react';
import { Skeleton } from '../../ui/skeleton';

interface ContributionDay {
  date: string;
  count: number;
}

interface GitHubContributionDay {
  contributionCount: number;
  date: string;
}

interface GitHubContributionWeek {
  contributionDays: GitHubContributionDay[];
}

interface GitHubContributionCalendar {
  totalContributions: number;
  weeks: GitHubContributionWeek[];
}

interface GitHubContributionsCollection {
  contributionCalendar: GitHubContributionCalendar;
}

interface GitHubUser {
  name: string;
  contributionsCollection: GitHubContributionsCollection;
}

interface GitHubAPIError {
  message: string;
  type?: string;
  path?: string[];
}

interface GitHubAPIResponse {
  data?: {
    user?: GitHubUser;
  };
  errors?: GitHubAPIError[];
}

interface GitHubData {
  username: string;
  currentStreak: number;
  longestStreak: number;
  totalContributions: number;
  contributionsByDay: ContributionDay[];
  todayContributions: number;
  loading: boolean;
  error: string | null;
}

const defaultConfig: GitHubStreakWidgetConfig = {
  title: 'GitHub Streak',
  username: '',
  showContributionGraph: true,
  daysToShow: 30,
  personalAccessToken: '',
};

const GitHubStreakWidget: React.FC<GitHubStreakWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<GitHubStreakWidgetConfig>({
    ...defaultConfig,
    ...config,
  });

  const [githubData, setGithubData] = useState<GitHubData>({
    username: '',
    currentStreak: 0,
    longestStreak: 0,
    totalContributions: 0,
    contributionsByDay: [],
    todayContributions: 0,
    loading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Snapshot/revert for settings modal
  const configSnapshotRef = useRef<GitHubStreakWidgetConfig>(localConfig);

  const handleSettingsOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        configSnapshotRef.current = { ...localConfig };
      } else {
        setLocalConfig(configSnapshotRef.current);
      }
      setShowSettings(nextOpen);
    },
    [localConfig]
  );

  const saveSettings = useCallback(() => {
    configSnapshotRef.current = { ...localConfig };
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  }, [config, localConfig]);

  const handleCancelSettings = useCallback(() => {
    setLocalConfig(configSnapshotRef.current);
    setShowSettings(false);
  }, []);

  // Fetch GitHub contribution data
  const fetchGitHubData = useCallback(async () => {
    if (!localConfig.username) return;

    if (!localConfig.personalAccessToken) {
      setGithubData(prev => ({
        ...prev,
        loading: false,
        error: 'GitHub API requires a Personal Access Token. Please add one in widget settings.',
      }));
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setGithubData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const username = localConfig.username;
      const query = `
        query {
          user(login: "${username}") {
            name
            contributionsCollection {
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    contributionCount
                    date
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `bearer ${localConfig.personalAccessToken}`,
        },
        body: JSON.stringify({ query }),
        signal,
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('GitHub API access forbidden. Could be rate limiting or an invalid token.');
        } else if (response.status === 401) {
          throw new Error('Invalid GitHub Personal Access Token.');
        } else {
          throw new Error(`GitHub API error: ${response.status}`);
        }
      }

      const result = (await response.json()) as GitHubAPIResponse;

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message || 'Error fetching GitHub data');
      }

      if (!result.data || !result.data.user) {
        throw new Error(`GitHub user "${username}" not found`);
      }

      const contributionData = result.data.user.contributionsCollection.contributionCalendar;

      const contributionDays: ContributionDay[] = [];
      contributionData.weeks.forEach((week: GitHubContributionWeek) => {
        week.contributionDays.forEach((day: GitHubContributionDay) => {
          contributionDays.push({ date: day.date, count: day.contributionCount });
        });
      });

      contributionDays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate streaks
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const todayData = contributionDays.find(d => d.date === todayStr);
      const todayContributions = todayData?.count ?? 0;

      const hasYesterdayContribution = contributionDays.some(
        d => d.date === yesterdayStr && d.count > 0
      );

      let currentStreak = 0;

      if (!hasYesterdayContribution) {
        currentStreak = todayContributions > 0 ? 1 : 0;
      } else {
        for (let i = contributionDays.length - 1; i >= 0; i--) {
          const dayData = contributionDays[i];
          const dayDate = new Date(dayData.date);

          if (dayDate > yesterday) continue;

          if (i < contributionDays.length - 1) {
            const prevDate = new Date(contributionDays[i + 1].date);
            const expectedDate = new Date(prevDate);
            expectedDate.setDate(expectedDate.getDate() - 1);
            if (
              dayDate.toISOString().split('T')[0] !==
              expectedDate.toISOString().split('T')[0]
            ) {
              break;
            }
          }

          if (dayData.count > 0) {
            currentStreak++;
          } else {
            break;
          }
        }

        if (todayContributions > 0) {
          currentStreak++;
        }
      }

      let longestStreak = 0;
      let currentLongestStreak = 0;

      for (let i = 0; i < contributionDays.length; i++) {
        if (contributionDays[i].count > 0) {
          currentLongestStreak++;

          if (i > 0) {
            const currentDate = new Date(contributionDays[i].date);
            const prevDate = new Date(contributionDays[i - 1].date);
            const diffDays = Math.ceil(
              Math.abs(currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffDays !== 1) {
              currentLongestStreak = 1;
            }
          }

          longestStreak = Math.max(longestStreak, currentLongestStreak);
        } else {
          currentLongestStreak = 0;
        }
      }

      if (!signal.aborted) {
        setGithubData({
          username,
          currentStreak,
          longestStreak,
          totalContributions: contributionData.totalContributions,
          contributionsByDay: contributionDays,
          todayContributions,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error('Failed to fetch GitHub data:', error);
        setGithubData(prev => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch GitHub data.',
        }));
      }
    }
  }, [localConfig.username, localConfig.personalAccessToken]);

  useEffect(() => {
    fetchGitHubData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchGitHubData]);

  useVisibilityRefresh({
    onRefresh: fetchGitHubData,
    minHiddenTime: 60000,
    refreshInterval: 300000,
    enabled: !!localConfig.username && !!localConfig.personalAccessToken,
  });

  // --- Helpers ---

  const getContributionColor = (count: number) => {
    if (count >= 6) return 'bg-green-700 dark:bg-green-600';
    if (count >= 4) return 'bg-green-500 dark:bg-green-500';
    if (count >= 2) return 'bg-green-300 dark:bg-green-400';
    if (count >= 1) return 'bg-green-100 dark:bg-green-300';
    return 'bg-muted';
  };

  const renderContributionCell = (day: ContributionDay, index: number, size: 'sm' | 'md' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'w-3.5 h-3.5' : size === 'md' ? 'w-3 h-3' : 'w-2.5 h-2.5';
    return (
      <div
        key={index}
        className={`${getContributionColor(day.count)} ${sizeClass} rounded-sm transition-colors`}
        title={`${day.count} contributions on ${day.date}`}
      />
    );
  };

  // Streak flame color based on count
  const streakFlameColor = 'text-muted-foreground';

  // Weekly aggregation for charts
  const weeklyData = useMemo(() => {
    const days = githubData.contributionsByDay;
    const weeks: { weekLabel: string; total: number; days: ContributionDay[] }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const weekDays = days.slice(i, i + 7);
      const total = weekDays.reduce((s, d) => s + d.count, 0);
      const startDate = weekDays[0]?.date ?? '';
      weeks.push({ weekLabel: startDate, total, days: weekDays });
    }
    return weeks;
  }, [githubData.contributionsByDay]);

  // Monthly aggregation for app view
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; total: number; days: number }> = {};
    githubData.contributionsByDay.forEach(d => {
      const monthKey = d.date.substring(0, 7); // YYYY-MM
      if (!months[monthKey]) {
        months[monthKey] = { month: monthKey, total: 0, days: 0 };
      }
      months[monthKey].total += d.count;
      if (d.count > 0) months[monthKey].days++;
    });
    return Object.values(months);
  }, [githubData.contributionsByDay]);

  // Best day
  const bestDay = useMemo(() => {
    let best: ContributionDay = { date: '', count: 0 };
    githubData.contributionsByDay.forEach(d => {
      if (d.count > best.count) best = d;
    });
    return best;
  }, [githubData.contributionsByDay]);

  // Average daily contributions
  const avgDaily = useMemo(() => {
    const days = githubData.contributionsByDay.filter(d => d.count > 0);
    if (days.length === 0) return 0;
    return Math.round(githubData.totalContributions / githubData.contributionsByDay.length * 10) / 10;
  }, [githubData.contributionsByDay, githubData.totalContributions]);

  // --- Setup prompt (no username or no token) ---
  const needsSetup = !localConfig.username || !localConfig.personalAccessToken;

  const renderSetup = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
      {!localConfig.username ? (
        <>
          <Github className="h-8 w-8" />
          <p className="text-sm">Configure your GitHub username</p>
        </>
      ) : (
        <>
          <Shield className="h-8 w-8" />
          <p className="text-sm text-center">Add a Personal Access Token</p>
        </>
      )}
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
          Open Settings
        </Button>
      )}
    </div>
  );

  const renderError = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
      <AlertCircle className="h-6 w-6 text-red-500" />
      <p className="text-xs text-red-500 dark:text-red-400">{githubData.error}</p>
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
          Check Settings
        </Button>
      )}
    </div>
  );

  const renderLoading = () => (
    <div className="flex-1 flex flex-col justify-center space-y-3 p-2">
      <div className="flex items-center justify-center">
        <Skeleton className="h-10 w-20" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );

  // --- Size-specific renderers ---

  // 1x1 ICON: streak count + flame
  const renderTiny = () => {
    if (needsSetup) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Flame className="h-5 w-5 text-muted-foreground" />
        </div>
      );
    }
    if (githubData.loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="h-5 w-8" />
        </div>
      );
    }
    if (githubData.error) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Flame className="h-5 w-5 text-red-400" />
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
        <Flame className={`h-4 w-4 ${streakFlameColor}`} />
        <span className="text-lg font-bold leading-none">{githubData.currentStreak}</span>
        <span className="text-[9px] text-muted-foreground leading-none">days</span>
      </div>
    );
  };

  // Nx1 RIBBON: streak + today's commits as horizontal chips
  const renderShort = () => {
    if (needsSetup || githubData.error) {
      return (
        <div className="flex-1 flex items-center gap-2 overflow-x-auto px-1">
          <Flame className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground shrink-0">
            {needsSetup ? 'Not configured' : 'Error'}
          </span>
        </div>
      );
    }
    if (githubData.loading) {
      return (
        <div className="flex-1 flex items-center gap-2 px-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      );
    }

    const recentDays = githubData.contributionsByDay.slice(-Math.min(width * 3, 14));

    return (
      <div className="flex-1 flex items-center gap-2 overflow-x-auto px-1 text-xs">
        <span className="shrink-0 flex items-center gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1 font-medium">
          <Flame className={`h-3 w-3 ${streakFlameColor}`} />
          {githubData.currentStreak}d streak
        </span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-foreground">
          {githubData.todayContributions} today
        </span>
        {width >= 3 && (
          <span className="shrink-0 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1 text-muted-foreground">
            {githubData.totalContributions} total
          </span>
        )}
        {width >= 4 && (
          <div className="flex items-center gap-0.5 shrink-0">
            {recentDays.map((day, i) => renderContributionCell(day, i, 'sm'))}
          </div>
        )}
      </div>
    );
  };

  // 2x2 COMPACT: streak + basic stats
  const renderCompact = () => {
    if (needsSetup) return renderSetup();
    if (githubData.loading) return renderLoading();
    if (githubData.error) return renderError();

    const recentDays = githubData.contributionsByDay.slice(-14);

    return (
      <div className="flex-1 flex flex-col justify-between overflow-hidden">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <Flame className={`h-4 w-4 ${streakFlameColor}`} />
            <span className="text-2xl font-bold text-foreground">
              {githubData.currentStreak}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">day streak</div>
        </div>

        <div className="grid grid-cols-2 gap-1 text-center text-[10px]">
          <div>
            <div className="text-muted-foreground">Longest</div>
            <div className="text-sm font-semibold">{githubData.longestStreak}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Today</div>
            <div className="text-sm font-semibold">{githubData.todayContributions}</div>
          </div>
        </div>

        {localConfig.showContributionGraph && (
          <div className="flex gap-0.5 justify-center flex-wrap mt-1">
            {recentDays.map((day, i) => renderContributionCell(day, i, 'sm'))}
          </div>
        )}
      </div>
    );
  };

  // 3x3 DEFAULT: balanced streak + contribution graph
  const renderDefault = () => {
    if (needsSetup) return renderSetup();
    if (githubData.loading) return renderLoading();
    if (githubData.error) return renderError();

    const daysToShow = Math.min(localConfig.daysToShow || 28, githubData.contributionsByDay.length);
    const recentDays = githubData.contributionsByDay.slice(-daysToShow);

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <Flame className={`h-5 w-5 ${streakFlameColor}`} />
              <span className="text-3xl font-bold text-foreground">
                {githubData.currentStreak}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">day streak</div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-[10px] text-muted-foreground">Longest</div>
              <div className="text-lg font-semibold">{githubData.longestStreak}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Total</div>
              <div className="text-lg font-semibold">{githubData.totalContributions}</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground mb-1">
          @{githubData.username} &middot; {githubData.todayContributions} today
        </div>

        {localConfig.showContributionGraph && (
          <div className="mt-auto">
            <div className="text-[10px] text-muted-foreground mb-1">Last {daysToShow} days</div>
            <div className="grid grid-cols-7 gap-1">
              {recentDays.map((day, i) => renderContributionCell(day, i, 'md'))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 4x4-5x5 PANEL: split view with weekly breakdown + daily grid
  const renderPanel = () => {
    if (needsSetup) return renderSetup();
    if (githubData.loading) return renderLoading();
    if (githubData.error) return renderError();

    const daysToShow = Math.min(localConfig.daysToShow || 60, githubData.contributionsByDay.length);
    const recentDays = githubData.contributionsByDay.slice(-daysToShow);
    const recentWeeks = weeklyData.slice(-8);
    const maxWeekly = Math.max(...recentWeeks.map(w => w.total), 1);

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stats row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Flame className={`h-6 w-6 ${streakFlameColor}`} />
              <div>
                <div className="text-3xl font-bold text-foreground leading-none">
                  {githubData.currentStreak}
                </div>
                <div className="text-xs text-muted-foreground">day streak</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Longest</div>
              <div className="text-xl font-semibold">{githubData.longestStreak}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-xl font-semibold">{githubData.totalContributions}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Today</div>
              <div className="text-xl font-semibold">{githubData.todayContributions}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Avg/day</div>
              <div className="text-xl font-semibold">{avgDaily}</div>
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mb-3">@{githubData.username}</div>

        {localConfig.showContributionGraph && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Weekly bar chart */}
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1.5">Weekly activity</div>
              <div className="flex items-end gap-1 h-16">
                {recentWeeks.map((week, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-green-500/80 dark:bg-green-500/60 transition-all"
                    style={{ height: `${Math.max((week.total / maxWeekly) * 100, 4)}%` }}
                    title={`Week of ${week.weekLabel}: ${week.total} contributions`}
                  />
                ))}
              </div>
            </div>

            {/* Daily contribution grid */}
            <div className="mt-auto">
              <div className="text-[10px] text-muted-foreground mb-1">
                Last {daysToShow} days
              </div>
              <div className="grid grid-cols-14 gap-1">
                {recentDays.map((day, i) => renderContributionCell(day, i, 'md'))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 6x6+ APP: full contribution graph, stats dashboard, commit history
  const renderApp = () => {
    if (needsSetup) return renderSetup();
    if (githubData.loading) return renderLoading();
    if (githubData.error) return renderError();

    const allDays = githubData.contributionsByDay;
    const recentWeeks = weeklyData.slice(-12);
    const maxWeekly = Math.max(...recentWeeks.map(w => w.total), 1);

    // Last 90 days for the large contribution graph
    const last90 = allDays.slice(-90);

    // Recent activity log (last 14 days with contributions)
    const recentActivity = allDays
      .filter(d => d.count > 0)
      .slice(-20)
      .reverse();

    return (
      <div className="flex h-full overflow-hidden">
        {/* Left panel: stats + contribution graph */}
        <div className="flex-1 flex flex-col overflow-y-auto pr-3 border-r border-border/50">
          {/* Hero stats */}
          <div className="flex items-center gap-4 mb-4 widget-drag-handle cursor-move">
            <div className="flex items-center gap-2">
              <Flame className={`h-8 w-8 ${streakFlameColor}`} />
              <div>
                <div className="text-4xl font-bold text-foreground leading-none">
                  {githubData.currentStreak}
                </div>
                <div className="text-sm text-muted-foreground">day streak</div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground ml-auto">
              @{githubData.username}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Trophy className="h-3 w-3" />
                Longest
              </div>
              <div className="text-2xl font-semibold">{githubData.longestStreak}d</div>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <GitCommit className="h-3 w-3" />
                Total
              </div>
              <div className="text-2xl font-semibold">{githubData.totalContributions}</div>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Calendar className="h-3 w-3" />
                Today
              </div>
              <div className="text-2xl font-semibold">{githubData.todayContributions}</div>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <TrendingUp className="h-3 w-3" />
                Avg/day
              </div>
              <div className="text-2xl font-semibold">{avgDaily}</div>
            </div>
          </div>

          {/* Best day */}
          {bestDay.count > 0 && (
            <div className="text-xs text-muted-foreground mb-4">
              Best day: <span className="font-medium text-foreground">{bestDay.count} contributions</span> on {bestDay.date}
            </div>
          )}

          {/* Weekly activity chart */}
          <div className="mb-4">
            <div className="text-sm font-medium mb-2">Weekly activity</div>
            <div className="flex items-end gap-1.5 h-24">
              {recentWeeks.map((week, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-green-500/80 dark:bg-green-500/60 transition-all"
                    style={{ height: `${Math.max((week.total / maxWeekly) * 100, 4)}%` }}
                    title={`Week of ${week.weekLabel}: ${week.total} contributions`}
                  />
                  <span className="text-[9px] text-muted-foreground">
                    {week.weekLabel.substring(5)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Full contribution graph */}
          {localConfig.showContributionGraph && (
            <div>
              <div className="text-sm font-medium mb-2">Contribution graph (90 days)</div>
              <div className="grid grid-cols-18 gap-1">
                {last90.map((day, i) => renderContributionCell(day, i, 'lg'))}
              </div>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                <span>Less</span>
                <div className="w-2.5 h-2.5 rounded-sm bg-muted" />
                <div className="w-2.5 h-2.5 rounded-sm bg-green-100 dark:bg-green-300" />
                <div className="w-2.5 h-2.5 rounded-sm bg-green-300 dark:bg-green-400" />
                <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
                <div className="w-2.5 h-2.5 rounded-sm bg-green-700 dark:bg-green-600" />
                <span>More</span>
              </div>
            </div>
          )}

          {/* Monthly summary */}
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Monthly summary</div>
            <div className="grid grid-cols-3 gap-2">
              {monthlyData.slice(-6).map(m => (
                <div
                  key={m.month}
                  className="rounded-lg border border-border/50 p-2 text-center"
                >
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(m.month + '-01').toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-sm font-semibold">{m.total}</div>
                  <div className="text-[10px] text-muted-foreground">{m.days} active days</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel: recent activity log */}
        <div className="w-2/5 flex flex-col overflow-hidden pl-3">
          <div className="text-sm font-medium mb-2">Recent activity</div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {recentActivity.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">
                No recent contributions
              </div>
            ) : (
              recentActivity.map((day, i) => {
                const dayDate = new Date(day.date);
                const isToday =
                  day.date === new Date().toISOString().split('T')[0];
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
                  >
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${getContributionColor(day.count)}`}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">
                        {day.count} contribution{day.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {isToday
                        ? 'Today'
                        : dayDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- Settings modal ---
  const renderSettings = () => {
    if (readOnly) return null;

    return (
      <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{localConfig.title || 'GitHub Streak'} Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="gh-title">Title</Label>
              <Input
                id="gh-title"
                value={localConfig.title || ''}
                onChange={e =>
                  setLocalConfig(prev => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="gh-username">GitHub Username</Label>
              <Input
                id="gh-username"
                value={localConfig.username || ''}
                onChange={e =>
                  setLocalConfig(prev => ({ ...prev, username: e.target.value }))
                }
                placeholder="e.g. octocat"
              />
            </div>

            <div>
              <Label htmlFor="gh-pat">
                Personal Access Token
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                id="gh-pat"
                type="password"
                value={localConfig.personalAccessToken || ''}
                onChange={e =>
                  setLocalConfig(prev => ({
                    ...prev,
                    personalAccessToken: e.target.value,
                  }))
                }
                placeholder="Required for GitHub API access"
              />
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <p>
                  Create at{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    github.com/settings/tokens
                  </a>
                </p>
                <p>Only needs read-only access to public repositories</p>
              </div>
            </div>

            <div>
              <Label htmlFor="gh-days">Days to show</Label>
              <Input
                id="gh-days"
                type="number"
                min="7"
                max="365"
                value={localConfig.daysToShow || 30}
                onChange={e =>
                  setLocalConfig(prev => ({
                    ...prev,
                    daysToShow: parseInt(e.target.value, 10),
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="gh-graph">Show contribution graph</Label>
              <Switch
                id="gh-graph"
                checked={!!localConfig.showContributionGraph}
                onCheckedChange={checked =>
                  setLocalConfig(prev => ({
                    ...prev,
                    showContributionGraph: Boolean(checked),
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <div className="flex justify-between w-full">
              {config?.onDelete && (
                <Button variant="destructive" onClick={config.onDelete}>
                  Delete Widget
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" onClick={handleCancelSettings}>
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

  // --- Main render ---
  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}>
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title || defaultConfig.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      <div className={isTiny ? 'flex-1 flex flex-col p-1' : 'flex-1 overflow-hidden'}>
        {isTiny
          ? renderTiny()
          : isShort
            ? renderShort()
            : isApp
              ? renderApp()
              : isWide && isTall
                ? renderPanel()
                : isCompact
                  ? renderCompact()
                  : renderDefault()}
      </div>

      {renderSettings()}
    </div>
  );
};

export default GitHubStreakWidget;
