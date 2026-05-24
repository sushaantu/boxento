import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import WidgetHeader from '../common/WidgetHeader';
import { PaisaWidgetConfig, PaisaWidgetProps, AssetBreakdown, NetworthEntry } from './types';
import { cn } from '@/lib/utils';
import {
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  Landmark,
  Bitcoin,
  Briefcase,
  Wallet,
  Home,
  Car,
  CreditCard,
  Settings2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  DollarSign
} from 'lucide-react';

const defaultConfig: PaisaWidgetConfig = {
  title: 'Paisa',
  baseUrl: 'http://localhost:7500',
  refreshInterval: 300,
  showChart: true,
  currency: '$'
};

// Icon mapping for asset categories
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  bank: <Landmark className="w-4 h-4" />,
  banco: <Landmark className="w-4 h-4" />,
  crypto: <Bitcoin className="w-4 h-4" />,
  pension: <Briefcase className="w-4 h-4" />,
  retirement: <Briefcase className="w-4 h-4" />,
  wallet: <Wallet className="w-4 h-4" />,
  cash: <Wallet className="w-4 h-4" />,
  real_estate: <Home className="w-4 h-4" />,
  property: <Home className="w-4 h-4" />,
  vehicle: <Car className="w-4 h-4" />,
  debt: <CreditCard className="w-4 h-4" />,
  loan: <CreditCard className="w-4 h-4" />,
};

const getCategoryIcon = (name: string): React.ReactNode => {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return <DollarSign className="w-4 h-4" />;
};

// Color palette for asset categories in charts
const CATEGORY_COLORS = [
  'bg-pink-500',
  'bg-blue-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-rose-500',
];

const CATEGORY_TEXT_COLORS = [
  'text-pink-500',
  'text-blue-500',
  'text-amber-500',
  'text-emerald-500',
  'text-purple-500',
  'text-cyan-500',
  'text-orange-500',
  'text-rose-500',
];

const PaisaWidget: React.FC<PaisaWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<PaisaWidgetConfig>({
    ...defaultConfig,
    ...config,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Record<string, AssetBreakdown>>({});
  const [networth, setNetworth] = useState<NetworthEntry[]>([]);
  const [totalNetworth, setTotalNetworth] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'trends'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // --- Settings snapshot/revert ---
  const [configSnapshot, setConfigSnapshot] = useState<PaisaWidgetConfig | null>(null);

  const handleSettingsOpen = useCallback((open: boolean) => {
    if (open) {
      setConfigSnapshot({ ...localConfig });
    } else if (configSnapshot) {
      setLocalConfig(configSnapshot);
      setConfigSnapshot(null);
    }
    setShowSettings(open);
  }, [localConfig, configSnapshot]);

  // Fetch data from Paisa
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [assetsRes, networthRes] = await Promise.all([
        fetch(`${localConfig.baseUrl}/api/assets/balance`),
        fetch(`${localConfig.baseUrl}/api/networth`)
      ]);

      if (!assetsRes.ok || !networthRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const assetsData = await assetsRes.json();
      const networthData = await networthRes.json();

      setAssets(assetsData.asset_breakdowns || {});
      setNetworth(networthData.networthTimeline || []);

      // Calculate total networth from top-level Assets
      if (assetsData.asset_breakdowns?.['Assets']) {
        setTotalNetworth(assetsData.asset_breakdowns['Assets'].marketAmount);
      }
    } catch (err) {
      setError('Cannot connect to Paisa');
      console.error('Paisa API error:', err);
    } finally {
      setLoading(false);
    }
  }, [localConfig.baseUrl]);

  // Fetch on mount and interval
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, (localConfig.refreshInterval || 300) * 1000);
    return () => clearInterval(interval);
  }, [fetchData, localConfig.refreshInterval]);

  // Format currency
  const formatCurrency = useCallback((amount: number, compact: boolean = false) => {
    const symbol = localConfig.currency || '$';
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (compact || absAmount >= 1000000) {
      if (absAmount >= 1000000000) {
        return `${sign}${symbol}${(absAmount / 1000000000).toFixed(1)}B`;
      }
      if (absAmount >= 1000000) {
        return `${sign}${symbol}${(absAmount / 1000000).toFixed(1)}M`;
      }
      if (absAmount >= 1000) {
        return `${sign}${symbol}${(absAmount / 1000).toFixed(0)}K`;
      }
    }
    return `${sign}${symbol}${absAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }, [localConfig.currency]);

  // Get asset categories (top-level groups under Assets:)
  const assetCategories = useMemo(() => {
    const categories: { name: string; key: string; amount: number; icon: React.ReactNode; xirr: number; gainAmount: number }[] = [];

    Object.entries(assets).forEach(([key, value]) => {
      // Only include direct children of Assets (e.g., Assets:banco, Assets:crypto)
      if (key.startsWith('Assets:') && key.split(':').length === 2) {
        const shortName = key.split(':')[1];
        const displayName = shortName.charAt(0).toUpperCase() + shortName.slice(1);
        categories.push({
          name: displayName,
          key,
          amount: value.marketAmount,
          icon: getCategoryIcon(shortName),
          xirr: value.xirr,
          gainAmount: value.gainAmount,
        });
      }
    });

    return categories.sort((a, b) => b.amount - a.amount);
  }, [assets]);

  // Get networth change for a given number of days
  const getNetworthChange = useCallback((days: number = 30) => {
    if (networth.length < 2) return { amount: 0, percentage: 0 };

    const recent = networth.slice(-days);
    const start = recent[0]?.balanceAmount || 0;
    const end = recent[recent.length - 1]?.balanceAmount || 0;
    const change = end - start;
    const percentage = start !== 0 ? ((change / Math.abs(start)) * 100) : 0;

    return { amount: change, percentage };
  }, [networth]);

  // Render sparkline SVG
  const renderSparkline = useCallback((data: number[], sparkHeight: number = 48, strokeColor?: string) => {
    if (data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    }).join(' ');

    const color = strokeColor || (data[data.length - 1] >= data[0] ? '#22c55e' : '#ef4444');

    return (
      <svg className="w-full" style={{ height: sparkHeight }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }, []);

  // --- Loading/error states ---
  if (!localConfig.baseUrl) {
    return (
      <div className="widget-container h-full flex flex-col p-2 md:p-3">
        <WidgetHeader
          title={localConfig.title}
          onSettingsClick={readOnly ? undefined : () => handleSettingsOpen(true)}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Settings2 className="h-8 w-8" />
          <p className="text-sm">Configure Paisa URL to get started</p>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => handleSettingsOpen(true)}>
              Open Settings
            </Button>
          )}
        </div>
        {!readOnly && renderSettingsDialog()}
      </div>
    );
  }

  // --- Size-specific renderers ---

  // 1x1 ICON: net worth abbreviation
  const renderTiny = () => {
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex h-full items-center justify-center">
          <AlertCircle className="w-4 h-4 text-red-500" />
        </div>
      );
    }

    const change = getNetworthChange(30);
    const isPositive = change.amount >= 0;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
        <div className="text-lg font-semibold leading-none text-foreground">
          {formatCurrency(totalNetworth, true)}
        </div>
        <div className={`flex items-center gap-0.5 text-[10px] ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {isPositive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
          {Math.abs(change.percentage).toFixed(1)}%
        </div>
      </div>
    );
  };

  // Nx1 RIBBON: net worth + asset category chips
  const renderShort = () => {
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex h-full items-center gap-2 px-1 text-xs text-red-500">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      );
    }

    const change = getNetworthChange(30);
    const isPositive = change.amount >= 0;
    const maxChips = Math.max(1, width - 1);

    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs">
        <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 font-semibold text-foreground dark:bg-white/[0.06]">
          {formatCurrency(totalNetworth, true)}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-1 ${isPositive ? 'bg-green-500/10 text-green-700 dark:text-green-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}>
          {isPositive ? '+' : ''}{change.percentage.toFixed(1)}%
        </span>
        {assetCategories.slice(0, maxChips).map((cat) => (
          <span
            key={cat.key}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/5 bg-white/80 px-2 py-1 text-muted-foreground dark:border-white/10 dark:bg-black/20"
          >
            {cat.icon}
            <span className="max-w-[6rem] truncate">{cat.name}</span>
            <span className="font-medium text-foreground">{formatCurrency(cat.amount, true)}</span>
          </span>
        ))}
      </div>
    );
  };

  // 2x2 MICRO: net worth + change + mini breakdown
  const renderCompact = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-2">
          <AlertCircle className="w-6 h-6 text-red-500 mb-1" />
          <span className="text-xs text-red-500">{error}</span>
          {!readOnly && (
            <Button variant="outline" size="sm" className="mt-1" onClick={fetchData}>
              Retry
            </Button>
          )}
        </div>
      );
    }

    const change = getNetworthChange(30);
    const isPositive = change.amount >= 0;

    return (
      <div className="flex flex-col h-full p-1">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-lg font-bold text-foreground">{formatCurrency(totalNetworth, true)}</div>
            <div className={`flex items-center text-[10px] ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {formatCurrency(change.amount, true)} ({change.percentage.toFixed(1)}%)
            </div>
          </div>
          <PiggyBank className="w-5 h-5 text-pink-500 shrink-0" />
        </div>

        {/* Mini breakdown */}
        <div className="flex-1 overflow-auto space-y-0.5">
          {assetCategories.slice(0, 4).map(cat => (
            <div key={cat.key} className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1 min-w-0 truncate text-muted-foreground">
                {cat.icon}
                <span className="truncate">{cat.name}</span>
              </div>
              <span className="font-medium text-foreground shrink-0">{formatCurrency(cat.amount, true)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 3x3 WIDGET: balanced detail with sparkline
  const renderDefault = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <span className="text-sm text-red-500">{error}</span>
          {!readOnly && (
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchData}>
              Retry
            </Button>
          )}
        </div>
      );
    }

    const change = getNetworthChange(30);
    const isPositive = change.amount >= 0;

    return (
      <div className="flex flex-col h-full">
        {/* Networth header */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(totalNetworth)}</div>
            <div className={`flex items-center text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
              {formatCurrency(change.amount, true)} ({change.percentage.toFixed(1)}%) 30d
            </div>
          </div>
          <PiggyBank className="w-7 h-7 text-pink-500" />
        </div>

        {/* Sparkline */}
        {localConfig.showChart && networth.length >= 2 && (
          <div className="mb-2 bg-muted/30 rounded-lg p-1.5">
            {renderSparkline(networth.slice(-30).map(n => n.balanceAmount), 36)}
          </div>
        )}

        {/* Asset breakdown */}
        <div className="flex-1 overflow-auto space-y-1.5 px-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Assets
          </div>
          {assetCategories.map((cat, i) => {
            const percentage = totalNetworth > 0 ? (cat.amount / totalNetworth) * 100 : 0;
            return (
              <div key={cat.key}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {cat.icon}
                    <span className="truncate">{cat.name}</span>
                  </div>
                  <span className="font-medium shrink-0">{formatCurrency(cat.amount, true)}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1">
                  <div
                    className={`${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} h-1 rounded-full transition-all`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 4x4-5x5 PANEL: split view with chart + detailed breakdown
  const renderPanel = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <span className="text-sm text-red-500">{error}</span>
          {!readOnly && (
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchData}>
              Retry
            </Button>
          )}
        </div>
      );
    }

    const change30 = getNetworthChange(30);
    const change7 = getNetworthChange(7);
    const isPositive = change30.amount >= 0;

    return (
      <div className="flex flex-col h-full">
        {/* Summary bar */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(totalNetworth)}</div>
              <div className={`flex items-center text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                {formatCurrency(change30.amount, true)} ({change30.percentage.toFixed(1)}%) 30d
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="text-right">
              <div className="font-medium text-foreground">7d</div>
              <div className={change7.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {change7.amount >= 0 ? '+' : ''}{change7.percentage.toFixed(1)}%
              </div>
            </div>
            {!readOnly && (
              <Button type="button" variant="ghost" size="none"
                onClick={fetchData}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Chart */}
          <div className="flex-1 overflow-y-auto p-2">
            {localConfig.showChart && networth.length >= 2 && (
              <div className="bg-muted/30 rounded-lg p-2 mb-3">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Net Worth Trend (30d)
                </div>
                {renderSparkline(networth.slice(-30).map(n => n.balanceAmount), 64)}
              </div>
            )}

            {/* Allocation bar */}
            <div className="mb-3">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                Allocation
              </div>
              <div className="flex h-3 rounded-full overflow-hidden">
                {assetCategories.map((cat, i) => {
                  const percentage = totalNetworth > 0 ? (cat.amount / totalNetworth) * 100 : 0;
                  return (
                    <div
                      key={cat.key}
                      className={`${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} transition-all`}
                      style={{ width: `${percentage}%` }}
                      title={`${cat.name}: ${percentage.toFixed(1)}%`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                {assetCategories.map((cat, i) => {
                  const percentage = totalNetworth > 0 ? (cat.amount / totalNetworth) * 100 : 0;
                  return (
                    <div key={cat.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`} />
                      <span>{cat.name}</span>
                      <span className="font-medium text-foreground">{percentage.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Asset detail list */}
          <div className="w-2/5 border-l border-border/50 overflow-y-auto p-2">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Asset Breakdown
            </div>
            <div className="space-y-2">
              {assetCategories.map((cat, i) => (
                <div
                  key={cat.key}
                  className="rounded-lg border border-border/50 p-2"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`${CATEGORY_TEXT_COLORS[i % CATEGORY_TEXT_COLORS.length]}`}>
                      {cat.icon}
                    </div>
                    <span className="text-xs font-medium text-foreground">{cat.name}</span>
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {formatCurrency(cat.amount)}
                  </div>
                  <div className={`text-[10px] ${cat.gainAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {cat.gainAmount >= 0 ? '+' : ''}{formatCurrency(cat.gainAmount, true)} gain
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 6x6+ APP: full finance dashboard with tabs, charts, detailed views
  const renderApp = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
          <span className="text-base text-red-500">{error}</span>
          {!readOnly && (
            <Button variant="outline" className="mt-3" onClick={fetchData}>
              Retry
            </Button>
          )}
        </div>
      );
    }

    const change30 = getNetworthChange(30);
    const change7 = getNetworthChange(7);
    const change90 = getNetworthChange(90);

    const tabs: { key: typeof activeTab; label: string; icon: React.ReactNode }[] = [
      { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-3.5 h-3.5" /> },
      { key: 'assets', label: 'Assets', icon: <PieChart className="w-3.5 h-3.5" /> },
      { key: 'trends', label: 'Trends', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    ];

    return (
      <div className="flex flex-col h-full">
        {/* Top bar: net worth + period changes */}
        <div
          data-testid="paisa-app-header"
          className="flex items-center justify-between px-4 py-3 widget-drag-handle cursor-move"
        >
          <div>
            <div className="text-3xl font-bold text-foreground">{formatCurrency(totalNetworth)}</div>
            <div className={`flex items-center text-sm mt-0.5 ${change30.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {change30.amount >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {formatCurrency(change30.amount, true)} ({change30.percentage.toFixed(1)}%) last 30 days
            </div>
          </div>
          <div className="flex items-center gap-4">
            {[
              { label: '7d', change: change7 },
              { label: '30d', change: change30 },
              { label: '90d', change: change90 },
            ].map(period => (
              <div key={period.label} className="text-center">
                <div className="text-[10px] font-medium text-muted-foreground uppercase">{period.label}</div>
                <div className={`text-sm font-semibold ${period.change.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {period.change.amount >= 0 ? '+' : ''}{period.change.percentage.toFixed(1)}%
                </div>
              </div>
            ))}
            {!readOnly && (
              <Button type="button" variant="ghost" size="none"
                onClick={fetchData}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-border/50 px-4">
          {tabs.map(tab => (
            <Button type="button" variant="ghost" size="none"
              key={tab.key}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-primary font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'overview' && renderAppOverview()}
          {activeTab === 'assets' && renderAppAssets()}
          {activeTab === 'trends' && renderAppTrends()}
        </div>
      </div>
    );
  };

  // App mode: Overview tab
  const renderAppOverview = () => (
    <div className="flex h-full">
      {/* Left: Chart + Allocation */}
      <div className="flex-1 overflow-y-auto p-4">
        {localConfig.showChart && networth.length >= 2 && (
          <div className="bg-muted/30 rounded-lg p-3 mb-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Net Worth History
            </div>
            {renderSparkline(networth.slice(-90).map(n => n.balanceAmount), 120)}
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{networth.length >= 90 ? networth[networth.length - 90]?.date?.slice(0, 10) : networth[0]?.date?.slice(0, 10)}</span>
              <span>{networth[networth.length - 1]?.date?.slice(0, 10)}</span>
            </div>
          </div>
        )}

        {/* Allocation donut (simplified as horizontal bar) */}
        <div className="mb-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Portfolio Allocation
          </div>
          <div className="flex h-4 rounded-full overflow-hidden">
            {assetCategories.map((cat, i) => {
              const percentage = totalNetworth > 0 ? (cat.amount / totalNetworth) * 100 : 0;
              return (
                <div
                  key={cat.key}
                  className={`${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} transition-all cursor-pointer hover:opacity-80`}
                  style={{ width: `${percentage}%` }}
                  title={`${cat.name}: ${formatCurrency(cat.amount)} (${percentage.toFixed(1)}%)`}
                  onClick={() => { setSelectedCategory(cat.key); setActiveTab('assets'); }}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {assetCategories.map((cat, i) => {
              const percentage = totalNetworth > 0 ? (cat.amount / totalNetworth) * 100 : 0;
              return (
                <div key={cat.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`} />
                  <span>{cat.name}</span>
                  <span className="font-medium text-foreground">{percentage.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Investment vs Market summary */}
        {assets['Assets'] && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-[10px] font-medium text-muted-foreground uppercase">Total Invested</div>
              <div className="text-lg font-semibold text-foreground mt-0.5">
                {formatCurrency(assets['Assets'].investmentAmount)}
              </div>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-[10px] font-medium text-muted-foreground uppercase">Total Gain</div>
              <div className={`text-lg font-semibold mt-0.5 ${assets['Assets'].gainAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {assets['Assets'].gainAmount >= 0 ? '+' : ''}{formatCurrency(assets['Assets'].gainAmount)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Quick asset list */}
      <div className="w-1/3 border-l border-border/50 overflow-y-auto p-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Asset Categories
        </div>
        <div className="space-y-2">
          {assetCategories.map((cat, i) => (
            <Button type="button" variant="ghost" size="none"
              key={cat.key}
              onClick={() => { setSelectedCategory(cat.key); setActiveTab('assets'); }}
              className="w-full text-left rounded-lg border border-border/50 p-3 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={CATEGORY_TEXT_COLORS[i % CATEGORY_TEXT_COLORS.length]}>
                  {cat.icon}
                </div>
                <span className="text-sm font-medium text-foreground">{cat.name}</span>
              </div>
              <div className="text-base font-semibold text-foreground">
                {formatCurrency(cat.amount)}
              </div>
              <div className={`text-xs mt-0.5 ${cat.gainAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {cat.gainAmount >= 0 ? '+' : ''}{formatCurrency(cat.gainAmount, true)} gain
                {cat.xirr ? ` · ${(cat.xirr * 100).toFixed(1)}% XIRR` : ''}
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  // App mode: Assets tab (detailed breakdown)
  const renderAppAssets = () => {
    // Get sub-categories for selected category
    const subCategories: { name: string; key: string; data: AssetBreakdown }[] = [];
    const prefix = selectedCategory ? `${selectedCategory}:` : 'Assets:';

    Object.entries(assets).forEach(([key, value]) => {
      if (key.startsWith(prefix) && key !== selectedCategory) {
        const depth = key.split(':').length;
        const prefixDepth = prefix.split(':').length;
        // Only show direct children
        if (depth === prefixDepth + 1) {
          const shortName = key.split(':').pop() || key;
          subCategories.push({
            name: shortName.charAt(0).toUpperCase() + shortName.slice(1),
            key,
            data: value,
          });
        }
      }
    });

    subCategories.sort((a, b) => b.data.marketAmount - a.data.marketAmount);

    return (
      <div className="flex h-full">
        {/* Left: category list */}
        <div className="w-1/3 border-r border-border/50 overflow-y-auto">
          <div className="p-2 border-b border-border/50">
            <Button type="button" variant="ghost" size="none"
              onClick={() => setSelectedCategory(null)}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                !selectedCategory ? 'bg-accent font-medium' : 'hover:bg-accent/50'
              }`}
            >
              All Assets
            </Button>
          </div>
          {assetCategories.map((cat, i) => (
            <div
              key={cat.key}
              className={`flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                selectedCategory === cat.key ? 'bg-accent' : ''
              }`}
              onClick={() => setSelectedCategory(cat.key)}
            >
              <div className={CATEGORY_TEXT_COLORS[i % CATEGORY_TEXT_COLORS.length]}>
                {cat.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">{cat.name}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(cat.amount, true)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: detail */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedCategory ? (
            <>
              <div className="mb-4">
                <div className="text-lg font-semibold text-foreground">
                  {selectedCategory.split(':').pop()?.charAt(0).toUpperCase()}{selectedCategory.split(':').pop()?.slice(1)}
                </div>
                {assets[selectedCategory] && (
                  <div className="text-2xl font-bold text-foreground mt-1">
                    {formatCurrency(assets[selectedCategory].marketAmount)}
                  </div>
                )}
              </div>

              {/* Sub-categories */}
              {subCategories.length > 0 ? (
                <div className="space-y-2">
                  {subCategories.map(sub => {
                    const parentAmount = assets[selectedCategory]?.marketAmount || totalNetworth;
                    const percentage = parentAmount > 0 ? (sub.data.marketAmount / parentAmount) * 100 : 0;
                    return (
                      <div key={sub.key} className="rounded-lg border border-border/50 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(sub.name)}
                            <span className="text-sm font-medium text-foreground">{sub.name}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground">{formatCurrency(sub.data.marketAmount)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 mb-1">
                          <div
                            className="bg-pink-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{percentage.toFixed(1)}% of category</span>
                          <span className={sub.data.gainAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {sub.data.gainAmount >= 0 ? '+' : ''}{formatCurrency(sub.data.gainAmount, true)} gain
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No sub-categories found</div>
              )}
            </>
          ) : (
            <>
              <div className="text-lg font-semibold text-foreground mb-4">All Assets</div>
              {/* Show all top-level categories in detail cards */}
              <div className="grid grid-cols-2 gap-3">
                {assetCategories.map((cat, i) => {
                  const percentage = totalNetworth > 0 ? (cat.amount / totalNetworth) * 100 : 0;
                  return (
                    <Button type="button" variant="ghost" size="none"
                      key={cat.key}
                      onClick={() => setSelectedCategory(cat.key)}
                      className="text-left rounded-lg border border-border/50 p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={CATEGORY_TEXT_COLORS[i % CATEGORY_TEXT_COLORS.length]}>
                          {cat.icon}
                        </div>
                        <span className="text-sm font-medium text-foreground">{cat.name}</span>
                      </div>
                      <div className="text-xl font-bold text-foreground">{formatCurrency(cat.amount)}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{percentage.toFixed(1)}% of portfolio</span>
                        <span className={`text-xs ${cat.gainAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {cat.gainAmount >= 0 ? '+' : ''}{formatCurrency(cat.gainAmount, true)}
                        </span>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // App mode: Trends tab
  const renderAppTrends = () => {
    const timeRanges = [
      { label: '30 days', days: 30 },
      { label: '90 days', days: 90 },
      { label: '1 year', days: 365 },
      { label: 'All time', days: networth.length },
    ];

    return (
      <div className="p-4 overflow-y-auto h-full">
        {/* Trend charts for different periods */}
        <div className="space-y-6">
          {timeRanges.map(range => {
            const data = networth.slice(-range.days);
            if (data.length < 2) return null;

            const change = getNetworthChange(range.days);
            const isPositive = change.amount >= 0;

            return (
              <div key={range.label} className="rounded-lg border border-border/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-foreground">{range.label}</div>
                  <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {formatCurrency(change.amount, true)} ({change.percentage.toFixed(1)}%)
                  </div>
                </div>
                {renderSparkline(data.map(n => n.balanceAmount), 80)}
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{data[0]?.date?.slice(0, 10)}</span>
                  <span>{data[data.length - 1]?.date?.slice(0, 10)}</span>
                </div>
              </div>
            );
          })}

          {/* Investment vs Market value over time */}
          {networth.length >= 2 && (
            <div className="rounded-lg border border-border/50 p-4">
              <div className="text-sm font-medium text-foreground mb-3">Investment vs Market Value</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-blue-500 rounded" />
                  <span className="text-xs text-muted-foreground">Investment</span>
                </div>
                {renderSparkline(
                  networth.slice(-90).map(n => n.netInvestmentAmount),
                  60,
                  '#3b82f6'
                )}
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-3 h-0.5 bg-green-500 rounded" />
                  <span className="text-xs text-muted-foreground">Market Value</span>
                </div>
                {renderSparkline(
                  networth.slice(-90).map(n => n.balanceAmount),
                  60,
                  '#22c55e'
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Settings Dialog ---
  function renderSettingsDialog() {
    return (
      <Dialog open={showSettings} onOpenChange={handleSettingsOpen}>
        <DialogContent className="settings-dialog-content sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{localConfig.title || 'Paisa'} Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title-input">Title</Label>
              <Input
                id="title-input"
                value={localConfig.title || ''}
                onChange={(e) =>
                  setLocalConfig(prev => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="url-input">Paisa URL</Label>
              <Input
                id="url-input"
                type="url"
                value={localConfig.baseUrl || ''}
                onChange={(e) =>
                  setLocalConfig(prev => ({ ...prev, baseUrl: e.target.value }))
                }
                placeholder="http://localhost:7500"
              />
            </div>

            <div>
              <Label htmlFor="currency-input">Currency Symbol</Label>
              <Input
                id="currency-input"
                value={localConfig.currency || ''}
                onChange={(e) =>
                  setLocalConfig(prev => ({ ...prev, currency: e.target.value }))
                }
                placeholder="$"
              />
            </div>

            <div>
              <Label htmlFor="refresh-input">Refresh Interval (seconds)</Label>
              <Input
                id="refresh-input"
                type="number"
                min={30}
                value={localConfig.refreshInterval || 300}
                onChange={(e) =>
                  setLocalConfig(prev => ({ ...prev, refreshInterval: parseInt(e.target.value) || 300 }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="chart-toggle">Show Chart</Label>
              <Switch
                id="chart-toggle"
                checked={Boolean(localConfig.showChart)}
                onCheckedChange={(checked) =>
                  setLocalConfig(prev => ({ ...prev, showChart: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <div className="flex justify-between w-full">
              {config?.onDelete && (
                <Button variant="destructive" onClick={config.onDelete}>Delete Widget</Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" onClick={() => handleSettingsOpen(false)}>Cancel</Button>
                <Button onClick={saveSettings}>Save</Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Save settings
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setConfigSnapshot(null);
    setShowSettings(false);
  };

  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}>
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title}
          onSettingsClick={readOnly ? undefined : () => handleSettingsOpen(true)}
          compact={isShort}
        />
      )}

      <div className={`flex-1 overflow-hidden ${isTiny ? 'p-2' : isShort ? 'p-1.5' : ''}`}>
        {isTiny ? renderTiny()
          : isShort ? renderShort()
          : isApp ? renderApp()
          : isWide && isTall ? renderPanel()
          : isCompact ? renderCompact()
          : renderDefault()}
      </div>

      {!readOnly && renderSettingsDialog()}
    </div>
  );
};

export default PaisaWidget;
