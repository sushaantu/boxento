import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVisibilityRefresh } from '../../../lib/useVisibilityRefresh';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Checkbox,
  Skeleton,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import { GitHubStreakWidgetProps, GitHubStreakWidgetConfig } from './types';
import { AlertCircle, Github, Shield } from 'lucide-react';

/**
 * Size categories for widget content rendering
 * This enum provides clear naming for different widget dimensions
 */
enum WidgetSizeCategory {
  SMALL = 'small',         // 2x2
  WIDE_SMALL = 'wideSmall', // 3x2 
  TALL_SMALL = 'tallSmall', // 2x3
  MEDIUM = 'medium',       // 3x3
  WIDE_MEDIUM = 'wideMedium', // 4x3
  TALL_MEDIUM = 'tallMedium', // 3x4
  LARGE = 'large'          // 4x4
}

/**
 * GitHub contribution data interface
 */
interface GitHubContributionData {
  username: string;
  currentStreak: number;
  longestStreak: number;
  totalContributions: number;
  contributionsByDay: {
    date: string;
    count: number;
  }[];
  loading: boolean;
  error: string | null;
}

/**
 * GitHub contribution day interface
 */
interface GitHubContributionDay {
  contributionCount: number;
  date: string;
}

/**
 * GitHub contribution week interface
 */
interface GitHubContributionWeek {
  contributionDays: GitHubContributionDay[];
}

/**
 * GitHub contribution calendar interface
 */
interface GitHubContributionCalendar {
  totalContributions: number;
  weeks: GitHubContributionWeek[];
}

/**
 * GitHub contributions collection interface
 */
interface GitHubContributionsCollection {
  contributionCalendar: GitHubContributionCalendar;
}

/**
 * GitHub user interface
 */
interface GitHubUser {
  name: string;
  contributionsCollection: GitHubContributionsCollection;
}

/**
 * GitHub API error interface
 */
interface GitHubAPIError {
  message: string;
  type?: string;
  path?: string[];
}

/**
 * GitHub API response interface
 */
interface GitHubAPIResponse {
  data?: {
    user?: GitHubUser;
  };
  errors?: GitHubAPIError[];
}

/**
 * GitHubStreakWidget Component
 * 
 * A widget that displays a user's GitHub contribution streak and contribution graph
 * 
 * @param {GitHubStreakWidgetProps} props - Component props
 * @returns {JSX.Element} Widget component
 */
const GitHubStreakWidget: React.FC<GitHubStreakWidgetProps> = ({ width, height, config }) => {
  // Default configuration
  const defaultConfig: GitHubStreakWidgetConfig = {
    title: 'GitHub Streak',
    username: '',
    showContributionGraph: true,
    daysToShow: 30,
    personalAccessToken: '' // Default to no token
  };

  // Component state
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<GitHubStreakWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  
  const [githubData, setGithubData] = useState<GitHubContributionData>({
    username: '',
    currentStreak: 0,
    longestStreak: 0,
    totalContributions: 0,
    contributionsByDay: [],
    loading: false,
    error: null
  });
  
  // Ref for the widget container
  const widgetRef = useRef<HTMLDivElement | null>(null);
  
  // Update local config when props config changes
  useEffect(() => {
    setLocalConfig((prevConfig: GitHubStreakWidgetConfig) => ({
      ...prevConfig,
      ...config
    }));
  }, [config]);
  
  // Ref to track abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch GitHub contribution data
  const fetchGitHubData = useCallback(async () => {
    // Skip if no username is provided
    if (!localConfig.username) {
      return;
    }

    // Skip if no token is provided
    if (!localConfig.personalAccessToken) {
      setGithubData(prev => ({
        ...prev,
        loading: false,
        error: 'GitHub API requires a Personal Access Token. Please add one in widget settings.'
      }));
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setGithubData(prev => ({ ...prev, loading: true, error: null }));

    try {
      // GitHub contributions API using GitHub's GraphQL API
      const username = localConfig.username;

      // Fetch contribution data for the last 365 days
      // Using GitHub GraphQL API
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

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `bearer ${localConfig.personalAccessToken}`
      };

      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
        signal
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('GitHub API access forbidden. This could be due to rate limiting or an invalid token.');
        } else if (response.status === 401) {
          throw new Error('Invalid GitHub Personal Access Token. Please update it in widget settings.');
        } else {
          throw new Error(`GitHub API error: ${response.status}`);
        }
      }

      const result = await response.json() as GitHubAPIResponse;

      // Check for errors in the response
      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message || 'Error fetching GitHub data');
      }

      if (!result.data || !result.data.user) {
        throw new Error(`GitHub user "${username}" not found`);
      }

      const userData = result.data.user;
      const contributionData = userData.contributionsCollection.contributionCalendar;

      // Extract contribution days from weeks
      const contributionDays: { date: string; count: number }[] = [];
      contributionData.weeks.forEach((week: GitHubContributionWeek) => {
        week.contributionDays.forEach((day: GitHubContributionDay) => {
          contributionDays.push({
            date: day.date,
            count: day.contributionCount
          });
        });
      });

      // Sort by date
      contributionDays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate current streak
      let currentStreak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get yesterday's date for checking if the streak is still active
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Check if yesterday had contributions to maintain streak
      const hasYesterdayContribution = contributionDays.some(
        day => day.date === yesterdayStr && day.count > 0
      );

      // If no contribution yesterday, streak is broken
      if (!hasYesterdayContribution) {
        // Check if there was a contribution today to start a new streak
        const todayStr = today.toISOString().split('T')[0];
        const hasTodayContribution = contributionDays.some(
          day => day.date === todayStr && day.count > 0
        );

        currentStreak = hasTodayContribution ? 1 : 0;
      } else {
        // Count consecutive days with contributions
        // Start from the most recent day (excluding today)
        for (let i = contributionDays.length - 1; i >= 0; i--) {
          const dayData = contributionDays[i];
          const dayDate = new Date(dayData.date);

          // Skip future days and today
          if (dayDate > yesterday) continue;

          // If this day doesn't match the expected next day in streak, break
          if (i < contributionDays.length - 1) {
            const prevDate = new Date(contributionDays[i + 1].date);
            const expectedDate = new Date(prevDate);
            expectedDate.setDate(expectedDate.getDate() - 1);

            if (dayDate.toISOString().split('T')[0] !== expectedDate.toISOString().split('T')[0]) {
              break;
            }
          }

          // Add to streak if there were contributions
          if (dayData.count > 0) {
            currentStreak++;
          } else {
            break;
          }
        }

        // Add today if there was a contribution
        const todayStr = today.toISOString().split('T')[0];
        const hasTodayContribution = contributionDays.some(
          day => day.date === todayStr && day.count > 0
        );

        if (hasTodayContribution) {
          currentStreak++;
        }
      }

      // Calculate longest streak
      let longestStreak = 0;
      let currentLongestStreak = 0;

      for (let i = 0; i < contributionDays.length; i++) {
        if (contributionDays[i].count > 0) {
          currentLongestStreak++;

          if (i > 0) {
            // Check if this day is consecutive to the previous one
            const currentDate = new Date(contributionDays[i].date);
            const prevDate = new Date(contributionDays[i - 1].date);

            const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // If days are not consecutive, reset streak
            if (diffDays !== 1) {
              currentLongestStreak = 1;
            }
          }

          longestStreak = Math.max(longestStreak, currentLongestStreak);
        } else {
          currentLongestStreak = 0;
        }
      }

      // Set the contribution data only if not aborted
      if (!signal.aborted) {
        setGithubData({
          username,
          currentStreak,
          longestStreak,
          totalContributions: contributionData.totalContributions,
          contributionsByDay: contributionDays,
          loading: false,
          error: null
        });
      }

    } catch (error) {
      // Only update state if not aborted
      if (!signal.aborted) {
        console.error('Failed to fetch GitHub data:', error);
        setGithubData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch GitHub data. Please check the username and try again.'
        }));
      }
    }
  }, [localConfig.username, localConfig.personalAccessToken]);

  // Fetch data on mount and when config changes
  useEffect(() => {
    fetchGitHubData();

    // Cleanup function to abort fetch on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchGitHubData]);

  // Auto-refresh when tab becomes visible or every 5 minutes
  useVisibilityRefresh({
    onRefresh: fetchGitHubData,
    minHiddenTime: 60000, // Refresh if hidden for 1+ minute
    refreshInterval: 300000, // Also refresh every 5 minutes
    enabled: !!localConfig.username && !!localConfig.personalAccessToken
  });
  
  /**
   * Determines the appropriate size category based on width and height
   * 
   * @param width - Widget width in grid units
   * @param height - Widget height in grid units
   * @returns The corresponding WidgetSizeCategory
   */
  const getWidgetSizeCategory = (width: number, height: number): WidgetSizeCategory => {
    if (width >= 4 && height >= 4) {
      return WidgetSizeCategory.LARGE;
    } else if (width >= 4 && height >= 3) {
      return WidgetSizeCategory.WIDE_MEDIUM;
    } else if (width >= 3 && height >= 4) {
      return WidgetSizeCategory.TALL_MEDIUM;
    } else if (width >= 3 && height >= 3) {
      return WidgetSizeCategory.MEDIUM;
    } else if (width >= 3 && height >= 2) {
      return WidgetSizeCategory.WIDE_SMALL;
    } else if (width >= 2 && height >= 3) {
      return WidgetSizeCategory.TALL_SMALL;
    } else {
      return WidgetSizeCategory.SMALL;
    }
  };
  
  // Render content based on widget size
  const renderContent = () => {
    const sizeCategory = getWidgetSizeCategory(width, height);
    
    switch (sizeCategory) {
      case WidgetSizeCategory.WIDE_SMALL:
        return renderWideSmallView();
      case WidgetSizeCategory.TALL_SMALL:
        return renderTallSmallView();
      case WidgetSizeCategory.MEDIUM:
        return renderMediumView();
      case WidgetSizeCategory.WIDE_MEDIUM:
        return renderWideMediumView();
      case WidgetSizeCategory.TALL_MEDIUM:
        return renderTallMediumView();
      case WidgetSizeCategory.LARGE:
        return renderLargeView();
      case WidgetSizeCategory.SMALL:
      default:
        return renderSmallView();
    }
  };
  
  /**
   * Render a contribution cell for the GitHub graph
   */
  const renderContributionCell = (count: number, date: string, index: number) => {
    // Color based on contribution count
    let bgColor = 'bg-gray-100 dark:bg-gray-800';
    
    if (count > 0) {
      if (count >= 6) {
        bgColor = 'bg-green-700 dark:bg-green-600';
      } else if (count >= 4) {
        bgColor = 'bg-green-500 dark:bg-green-500';
      } else if (count >= 2) {
        bgColor = 'bg-green-300 dark:bg-green-400';
      } else {
        bgColor = 'bg-green-100 dark:bg-green-300';
      }
    }
    
    return (
      <div
        key={index}
        className={`${bgColor} w-3 h-3 rounded-sm transition-colors`}
        title={`${count} contributions on ${date}`}
      />
    );
  };
  
  // Small view (2x2) - Basic streak info
  const renderSmallView = () => {
    if (!localConfig.username) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center">
          {/* Use Github icon from Lucide with consistent styling */}
          <Github size={24} className="text-gray-400 mb-3" strokeWidth={1.5} />
          {/* Consistent text styling */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Add your GitHub username in settings.
          </p>
          {/* Consistent button styling */}
          <Button
            size="sm"
            onClick={() => setShowSettings(true)}
            variant="outline"
          >
            Configure Username
          </Button>
        </div>
      );
    }

    if (!localConfig.personalAccessToken) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-4">
          {/* Use Shield icon from Lucide with consistent styling (gray color) */}
          <Shield size={40} className="text-gray-400 mb-3" strokeWidth={1.5} />
          {/* Consistent text styling */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            GitHub API requires a Personal Access Token.
          </p>
          {/* Consistent button styling */}
          <Button
            size="sm"
            onClick={() => setShowSettings(true)}
            variant="outline"
          >
            Add Token
          </Button>
        </div>
      );
    }

    if (githubData.loading) {
      return (
        <div className="h-full flex flex-col p-4 space-y-3">
          {/* Streak number skeleton */}
          <div className="flex items-center justify-center">
            <Skeleton className="h-12 w-24" />
          </div>
          {/* Contribution graph skeleton */}
          <div className="flex-1 flex flex-col justify-center space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          {/* Stats skeleton */}
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      );
    }
    
    if (githubData.error) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-4">
          {/* Use AlertCircle icon for errors */}
          <AlertCircle size={40} className="text-red-500 mb-3" strokeWidth={1.5} />
          {/* Consistent error text styling */}
          <p className="text-sm text-red-500 dark:text-red-400 mb-3">
            {githubData.error}
          </p>
          {/* Consistent button styling */}
          <Button
            size="sm"
            onClick={() => setShowSettings(true)}
            variant="outline"
          >
            Check Settings
          </Button>
        </div>
      );
    }
    
    return (
      <div className="h-full flex flex-col justify-between">
        <div className="text-center mb-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">Current Streak</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {githubData.currentStreak} days
          </div>
        </div>
        
        <div className="grid grid-cols-2 text-center">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Longest</div>
            <div className="text-lg font-semibold">{githubData.longestStreak}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
            <div className="text-lg font-semibold">{githubData.totalContributions}</div>
          </div>
        </div>
      </div>
    );
  };
  
  // Wide small view (3x2)
  const renderWideSmallView = () => {
    if (!localConfig.username || githubData.loading || githubData.error) {
      return renderSmallView();
    }
    
    const recentDays = githubData.contributionsByDay.slice(-14);
    
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Current Streak</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {githubData.currentStreak} days
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Longest</div>
              <div className="text-lg font-semibold">{githubData.longestStreak}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              <div className="text-lg font-semibold">{githubData.totalContributions}</div>
            </div>
          </div>
        </div>
        
        {localConfig.showContributionGraph && (
          <div className="mt-auto">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last 14 days</div>
            <div className="flex gap-1 justify-between">
              {recentDays.map((day, index) => 
                renderContributionCell(day.count, day.date, index)
              )}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Tall small view (2x3)
  const renderTallSmallView = () => {
    if (!localConfig.username || githubData.loading || githubData.error) {
      return renderSmallView();
    }
    
    const recentDays = githubData.contributionsByDay.slice(-14);
    
    return (
      <div className="h-full flex flex-col">
        <div className="text-center mb-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">Current Streak</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {githubData.currentStreak} days
          </div>
        </div>
        
        <div className="grid grid-cols-2 text-center mb-3">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Longest</div>
            <div className="text-lg font-semibold">{githubData.longestStreak}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
            <div className="text-lg font-semibold">{githubData.totalContributions}</div>
          </div>
        </div>
        
        {localConfig.showContributionGraph && (
          <div className="mt-auto">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last 14 days</div>
            <div className="grid grid-cols-7 gap-1">
              {recentDays.map((day, index) => 
                renderContributionCell(day.count, day.date, index)
              )}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Medium view (3x3)
  const renderMediumView = () => {
    if (!localConfig.username || githubData.loading || githubData.error) {
      return renderSmallView();
    }
    
    const recentDays = githubData.contributionsByDay.slice(-28);
    
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Current Streak</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {githubData.currentStreak} days
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Longest</div>
              <div className="text-xl font-semibold">{githubData.longestStreak}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              <div className="text-xl font-semibold">{githubData.totalContributions}</div>
            </div>
          </div>
        </div>
        
        {localConfig.showContributionGraph && (
          <div className="mt-auto">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last 28 days</div>
            <div className="grid grid-cols-7 gap-1">
              {recentDays.map((day, index) => 
                renderContributionCell(day.count, day.date, index)
              )}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Wide medium view (4x3)
  const renderWideMediumView = () => {
    if (!localConfig.username || githubData.loading || githubData.error) {
      return renderSmallView();
    }
    
    const daysToShow = Math.min(localConfig.daysToShow || 30, githubData.contributionsByDay.length);
    const recentDays = githubData.contributionsByDay.slice(-daysToShow);
    
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <div className="mr-6">
              <div className="text-sm text-gray-500 dark:text-gray-400">Current Streak</div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {githubData.currentStreak} days
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Longest</div>
                <div className="text-xl font-semibold">{githubData.longestStreak}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                <div className="text-xl font-semibold">{githubData.totalContributions}</div>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            @{githubData.username}
          </div>
        </div>
        
        {localConfig.showContributionGraph && (
          <div className="mt-auto">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Last {daysToShow} days
            </div>
            <div className="grid grid-cols-10 gap-1">
              {recentDays.map((day, index) => 
                renderContributionCell(day.count, day.date, index)
              )}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Tall medium view (3x4)
  const renderTallMediumView = () => {
    if (!localConfig.username || githubData.loading || githubData.error) {
      return renderSmallView();
    }
    
    const daysToShow = Math.min(localConfig.daysToShow || 30, githubData.contributionsByDay.length);
    const recentDays = githubData.contributionsByDay.slice(-daysToShow);
    
    return (
      <div className="h-full flex flex-col">
        <div className="text-center mb-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Current Streak</div>
          <div className="text-4xl font-bold text-green-600 dark:text-green-400">
            {githubData.currentStreak} days
          </div>
        </div>
        
        <div className="grid grid-cols-2 text-center gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Longest Streak</div>
            <div className="text-2xl font-semibold">{githubData.longestStreak}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Contributions</div>
            <div className="text-2xl font-semibold">{githubData.totalContributions}</div>
          </div>
        </div>
        
        <div className="text-sm text-center text-gray-500 dark:text-gray-400 mb-2">
          @{githubData.username}
        </div>
        
        {localConfig.showContributionGraph && (
          <div className="mt-auto">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Last {daysToShow} days
            </div>
            <div className="grid grid-cols-7 gap-1">
              {recentDays.map((day, index) => 
                renderContributionCell(day.count, day.date, index)
              )}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Large view (4x4 or larger)
  const renderLargeView = () => {
    if (!localConfig.username || githubData.loading || githubData.error) {
      return renderSmallView();
    }
    
    const daysToShow = Math.min(localConfig.daysToShow || 60, githubData.contributionsByDay.length);
    const recentDays = githubData.contributionsByDay.slice(-daysToShow);
    
    // Calculate streak data
    const weeklyContributions = Array(Math.ceil(daysToShow / 7)).fill(0);
    recentDays.forEach((day, index) => {
      const weekIndex = Math.floor(index / 7);
      if (weekIndex < weeklyContributions.length) {
        weeklyContributions[weekIndex] += day.count;
      }
    });
    
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <div className="mr-6">
              <div className="text-sm text-gray-500 dark:text-gray-400">Current Streak</div>
              <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                {githubData.currentStreak} days
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Longest Streak</div>
                <div className="text-2xl font-semibold">{githubData.longestStreak}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Contributions</div>
                <div className="text-2xl font-semibold">{githubData.totalContributions}</div>
              </div>
            </div>
          </div>
          
          <div className="text-lg text-gray-500 dark:text-gray-400">
            @{githubData.username}
          </div>
        </div>
        
        {localConfig.showContributionGraph && (
          <div className="flex-grow">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Contribution History (Last {daysToShow} days)
            </div>
            
            <div className="flex flex-col h-full">
              {/* Weekly breakdown */}
              <div className="grid grid-cols-8 gap-2 mb-4">
                {weeklyContributions.map((count, index) => (
                  <div key={index} className="text-center">
                    <div className={`mx-auto w-full h-16 rounded-md bg-gradient-to-t ${
                      count > 20 ? 'from-green-700 to-green-500' : 
                      count > 10 ? 'from-green-500 to-green-300' : 
                      count > 0 ? 'from-green-300 to-green-100' : 
                      'from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800'
                    }`} style={{ 
                      height: `${Math.min(Math.max(count * 3, 10), 64)}px` 
                    }}></div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">W{index+1}</div>
                  </div>
                ))}
              </div>
              
              {/* Daily contribution cells */}
              <div className="mt-auto">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Daily contributions</div>
                <div className="grid grid-cols-14 gap-1">
                  {recentDays.map((day, index) => 
                    renderContributionCell(day.count, day.date, index)
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Save settings
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  };
  
  // Settings modal
  const renderSettings = () => {
    return (
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>GitHub Streak Widget Settings</DialogTitle>
          </DialogHeader>
          
          {/* Change layout from grid to space-y-4 */}
          <div className="space-y-4 py-4">
            {/* Title Setting */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Title
              </Label>
              <Input
                id="title"
                value={localConfig.title || ''}
                className="h-10" // Ensure consistent height
                onChange={e => setLocalConfig(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
          
            {/* GitHub Username Setting */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                GitHub Username
              </Label>
              <Input
                id="username"
                value={localConfig.username || ''}
                className="h-10" // Ensure consistent height
                onChange={e => setLocalConfig(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
          
            {/* Personal Access Token Setting */}
            <div className="space-y-2">
              <Label htmlFor="pat" className="text-sm font-medium">
                Personal Access Token
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                id="pat"
                type="password"
                value={localConfig.personalAccessToken || ''}
                className="w-full h-10" // Ensure consistent height
                onChange={e => setLocalConfig(prev => ({ ...prev, personalAccessToken: e.target.value }))}
                placeholder="Required for GitHub API access"
              />
              <div className="text-xs text-gray-500 mt-1">
                <p>Create a token at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">github.com/settings/tokens</a></p>
                <p>Only needs <span className="font-medium">read-only</span> access to public repositories</p>
              </div>
            </div>
          
            {/* Days to Show Setting */}
            <div className="space-y-2">
              <Label htmlFor="daysToShow" className="text-sm font-medium">
                Days to Show in Graph
              </Label>
              <Input
                id="daysToShow"
                type="number"
                min="7"
                max="365"
                value={localConfig.daysToShow || 30}
                className="h-10" // Ensure consistent height
                onChange={e => setLocalConfig(prev => ({ ...prev, daysToShow: parseInt(e.target.value, 10) }))}
              />
            </div>
          
            {/* Show Graph Setting */}
            {/* Use flex layout for checkbox and label */}
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="showGraph"
                checked={!!localConfig.showContributionGraph}
                onCheckedChange={checked => setLocalConfig(prev => ({ ...prev, showContributionGraph: Boolean(checked) }))}
              />
              <Label htmlFor="showGraph" className="text-sm font-medium">
                Show Contribution Graph
              </Label>
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
              <Button onClick={saveSettings}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Main render
  return (
    <div ref={widgetRef} className="widget-container h-full flex flex-col relative">
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

export default GitHubStreakWidget; 