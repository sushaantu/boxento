import React, { useState, useEffect, useCallback } from 'react';
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
import {
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  Landmark,
  Bitcoin,
  Briefcase
} from 'lucide-react';

const PaisaWidget: React.FC<PaisaWidgetProps> = ({ width, height, config }) => {
  const defaultConfig: PaisaWidgetConfig = {
    title: 'Paisa',
    baseUrl: 'https://mini.tailf2415.ts.net:7501', // Port 7501 is CORS-enabled proxy
    refreshInterval: 300, // 5 minutes
    showChart: true,
    currency: '$'
  };

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<PaisaWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Record<string, AssetBreakdown>>({});
  const [networth, setNetworth] = useState<NetworthEntry[]>([]);
  const [totalNetworth, setTotalNetworth] = useState<number>(0);

  // Update local config when props change
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

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
  const formatCurrency = (amount: number) => {
    const symbol = localConfig.currency || '$';
    const absAmount = Math.abs(amount);
    if (absAmount >= 1000000) {
      return `${symbol}${(amount / 1000000).toFixed(1)}M`;
    }
    if (absAmount >= 1000) {
      return `${symbol}${(amount / 1000).toFixed(0)}K`;
    }
    return `${symbol}${amount.toFixed(0)}`;
  };

  // Get asset categories (top-level groups)
  const getAssetCategories = () => {
    const categories: { name: string; amount: number; icon: React.ReactNode }[] = [];

    // Look for specific asset groups
    Object.entries(assets).forEach(([key, value]) => {
      if (key === 'Assets:banco') {
        categories.push({
          name: 'Bank',
          amount: value.marketAmount,
          icon: <Landmark className="w-4 h-4" />
        });
      } else if (key === 'Assets:crypto') {
        categories.push({
          name: 'Crypto',
          amount: value.marketAmount,
          icon: <Bitcoin className="w-4 h-4" />
        });
      } else if (key === 'Assets:pension') {
        categories.push({
          name: 'Pension',
          amount: value.marketAmount,
          icon: <Briefcase className="w-4 h-4" />
        });
      }
    });

    return categories.sort((a, b) => b.amount - a.amount);
  };

  // Get networth change (last 30 days)
  const getNetworthChange = () => {
    if (networth.length < 2) return { amount: 0, percentage: 0 };

    const recent = networth.slice(-30);
    const start = recent[0]?.balanceAmount || 0;
    const end = recent[recent.length - 1]?.balanceAmount || 0;
    const change = end - start;
    const percentage = start !== 0 ? ((change / Math.abs(start)) * 100) : 0;

    return { amount: change, percentage };
  };

  // Render simple sparkline
  const renderSparkline = () => {
    const recent = networth.slice(-30);
    if (recent.length < 2) return null;

    const values = recent.map(n => n.balanceAmount);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    }).join(' ');

    const change = getNetworthChange();
    const color = change.amount >= 0 ? '#22c55e' : '#ef4444';

    return (
      <svg className="w-full h-12" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  };

  // Determine view mode
  const isCompact = width <= 2 && height <= 2;
  const isMedium = !isCompact && (width <= 3 || height <= 3);

  // Render compact view
  const renderCompactView = () => {
    const change = getNetworthChange();
    const isPositive = change.amount >= 0;

    return (
      <div className="flex flex-col items-center justify-center h-full p-2 text-center">
        <PiggyBank className="w-6 h-6 mb-1 text-pink-500" />
        <div className="text-lg font-bold">{formatCurrency(totalNetworth)}</div>
        <div className={`flex items-center text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
          {change.percentage.toFixed(1)}%
        </div>
      </div>
    );
  };

  // Render medium view (with breakdown)
  const renderMediumView = () => {
    const categories = getAssetCategories();
    const change = getNetworthChange();
    const isPositive = change.amount >= 0;

    return (
      <div className="flex flex-col h-full p-3">
        {/* Total networth */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-2xl font-bold">{formatCurrency(totalNetworth)}</div>
            <div className={`flex items-center text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {formatCurrency(change.amount)} ({change.percentage.toFixed(1)}%)
            </div>
          </div>
          <PiggyBank className="w-8 h-8 text-pink-500" />
        </div>

        {/* Asset breakdown */}
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {cat.icon}
                <span>{cat.name}</span>
              </div>
              <span className="font-medium">{formatCurrency(cat.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render full view (with chart)
  const renderFullView = () => {
    const categories = getAssetCategories();
    const change = getNetworthChange();
    const isPositive = change.amount >= 0;

    return (
      <div className="flex flex-col h-full p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-3xl font-bold">{formatCurrency(totalNetworth)}</div>
            <div className={`flex items-center text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {formatCurrency(change.amount)} ({change.percentage.toFixed(1)}%) last 30 days
            </div>
          </div>
          <PiggyBank className="w-10 h-10 text-pink-500" />
        </div>

        {/* Sparkline chart */}
        {localConfig.showChart && (
          <div className="mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
            {renderSparkline()}
          </div>
        )}

        {/* Asset breakdown */}
        <div className="flex-grow">
          <div className="text-xs text-gray-500 mb-2">Asset Breakdown</div>
          <div className="space-y-3">
            {categories.map(cat => {
              const percentage = totalNetworth > 0 ? (cat.amount / totalNetworth) * 100 : 0;
              return (
                <div key={cat.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      {cat.icon}
                      <span>{cat.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-pink-500 h-1.5 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render content based on state and size
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <span className="text-sm text-red-500">{error}</span>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchData}>
            Retry
          </Button>
        </div>
      );
    }

    if (isCompact) return renderCompactView();
    if (isMedium) return renderMediumView();
    return renderFullView();
  };

  // Save settings
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  };

  // Settings dialog
  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Paisa Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title-input">Widget Title</Label>
            <Input
              id="title-input"
              type="text"
              value={localConfig.title || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalConfig({ ...localConfig, title: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url-input">Paisa URL</Label>
            <Input
              id="url-input"
              type="url"
              value={localConfig.baseUrl || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalConfig({ ...localConfig, baseUrl: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency-input">Currency Symbol</Label>
            <Input
              id="currency-input"
              type="text"
              value={localConfig.currency || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalConfig({ ...localConfig, currency: e.target.value })
              }
              placeholder="$"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="chart-toggle"
              checked={Boolean(localConfig.showChart)}
              onCheckedChange={(checked: boolean) =>
                setLocalConfig({ ...localConfig, showChart: checked })
              }
            />
            <Label htmlFor="chart-toggle">Show Chart</Label>
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            {config?.onDelete && (
              <Button variant="destructive" onClick={config.onDelete}>
                Delete Widget
              </Button>
            )}
            <Button variant="default" onClick={saveSettings}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="widget-container h-full flex flex-col relative">
      <WidgetHeader
        title={localConfig.title || defaultConfig.title}
        onSettingsClick={() => setShowSettings(true)}
      />

      <div className="flex-grow overflow-hidden">
        {renderContent()}
      </div>

      {renderSettings()}
    </div>
  );
};

export default PaisaWidget;
