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
import WidgetHeader from '../common/WidgetHeader';
import { FavaWidgetConfig, FavaWidgetProps, FavaAccountNode, FavaBalance } from './types';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  Wallet,
  CreditCard,
  PiggyBank,
  ExternalLink
} from 'lucide-react';

const FavaWidget: React.FC<FavaWidgetProps> = ({ width, height, config }) => {
  const defaultConfig: FavaWidgetConfig = {
    title: 'Fava',
    baseUrl: 'https://mini.tailf2415.ts.net:7503', // Port 7503 is CORS-enabled proxy
    beancountPath: 'eleva-spa',
    refreshInterval: 300,
    currency: '$'
  };

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<FavaWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<FavaAccountNode | null>(null);
  const [liabilities, setLiabilities] = useState<FavaAccountNode | null>(null);
  const [equity, setEquity] = useState<FavaAccountNode | null>(null);
  const [netWorth, setNetWorth] = useState<number>(0);

  // Update local config when props change
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Get total from balance
  const getTotal = (balance: FavaBalance): number => {
    return Object.values(balance).reduce((sum, val) => sum + val, 0);
  };

  // Fetch data from Fava
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = `${localConfig.baseUrl}/${localConfig.beancountPath}/api/balance_sheet`;
      const response = await fetch(apiUrl);

      if (!response.ok) throw new Error('Failed to fetch data');

      const data = await response.json();
      const trees = data.data?.trees || [];

      // Find Assets, Liabilities, and Equity nodes
      for (const node of trees) {
        if (node.account === 'Assets') {
          setAssets(node);
        } else if (node.account === 'Liabilities') {
          setLiabilities(node);
        } else if (node.account === 'Equity') {
          setEquity(node);
        }
      }

      // Calculate net worth from chart data
      const charts = data.data?.charts || [];
      const networthChart = charts.find((c: { label: string }) => c.label === 'Net Worth');
      if (networthChart?.data?.length > 0) {
        const latest = networthChart.data[networthChart.data.length - 1];
        setNetWorth(getTotal(latest.balance));
      }
    } catch (err) {
      setError('Cannot connect to Fava');
      console.error('Fava API error:', err);
    } finally {
      setLoading(false);
    }
  }, [localConfig.baseUrl, localConfig.beancountPath]);

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
    const sign = amount < 0 ? '-' : '';
    if (absAmount >= 1000000) {
      return `${sign}${symbol}${(absAmount / 1000000).toFixed(1)}M`;
    }
    if (absAmount >= 1000) {
      return `${sign}${symbol}${(absAmount / 1000).toFixed(0)}K`;
    }
    return `${sign}${symbol}${absAmount.toFixed(0)}`;
  };

  // Open Fava
  const openFava = () => {
    window.open(`${localConfig.baseUrl}/${localConfig.beancountPath}/`, '_blank', 'noopener,noreferrer');
  };

  // Determine view mode
  const isCompact = width <= 2 && height <= 2;
  const isMedium = !isCompact && (width <= 3 || height <= 3);

  // Render compact view
  const renderCompactView = () => {
    const isPositive = netWorth >= 0;

    return (
      <button
        onClick={openFava}
        className="flex flex-col items-center justify-center h-full p-2 text-center hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors w-full"
      >
        <BookOpen className="w-6 h-6 mb-1 text-green-600" />
        <div className="text-lg font-bold">{formatCurrency(Math.abs(netWorth))}</div>
        <div className={`flex items-center text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
          {isPositive ? 'Profit' : 'Loss'}
        </div>
      </button>
    );
  };

  // Render account summary
  const renderAccountSummary = (node: FavaAccountNode | null, icon: React.ReactNode, label: string) => {
    if (!node) return null;
    const total = getTotal(node.balance_children);

    return (
      <div className="flex items-center justify-between text-sm py-1">
        <div className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
        </div>
        <span className={`font-medium ${total < 0 ? 'text-red-500' : ''}`}>
          {formatCurrency(Math.abs(total))}
        </span>
      </div>
    );
  };

  // Render medium view
  const renderMediumView = () => {
    const isPositive = netWorth >= 0;

    return (
      <div className="flex flex-col h-full p-3">
        {/* Net worth header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-2xl font-bold">{formatCurrency(Math.abs(netWorth))}</div>
            <div className={`flex items-center text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {isPositive ? 'Net Profit' : 'Net Loss'}
            </div>
          </div>
          <BookOpen className="w-8 h-8 text-green-600" />
        </div>

        {/* Account summary */}
        <div className="space-y-1 flex-grow">
          {renderAccountSummary(assets, <Wallet className="w-4 h-4 text-blue-500" />, 'Assets')}
          {renderAccountSummary(liabilities, <CreditCard className="w-4 h-4 text-orange-500" />, 'Liabilities')}
          {renderAccountSummary(equity, <PiggyBank className="w-4 h-4 text-purple-500" />, 'Equity')}
        </div>

        <Button variant="outline" size="sm" className="mt-2" onClick={openFava}>
          <ExternalLink className="w-4 h-4 mr-1" />
          Open Fava
        </Button>
      </div>
    );
  };

  // Render full view with account details
  const renderFullView = () => {
    const isPositive = netWorth >= 0;

    const renderChildren = (children: FavaAccountNode[], depth = 0) => {
      return children
        .filter(child => getTotal(child.balance_children) !== 0)
        .slice(0, 5)
        .map(child => {
          const total = getTotal(child.balance_children);
          const name = child.account.split(':').pop() || child.account;
          return (
            <div key={child.account} className="flex justify-between text-xs py-0.5" style={{ paddingLeft: depth * 8 }}>
              <span className="text-gray-600 dark:text-gray-400 truncate">{name}</span>
              <span className={total < 0 ? 'text-red-500' : ''}>{formatCurrency(Math.abs(total))}</span>
            </div>
          );
        });
    };

    return (
      <div className="flex flex-col h-full p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-3xl font-bold">{formatCurrency(Math.abs(netWorth))}</div>
            <div className={`flex items-center text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {isPositive ? 'Net Profit' : 'Net Loss'}
            </div>
          </div>
          <BookOpen className="w-10 h-10 text-green-600" />
        </div>

        {/* Accounts breakdown */}
        <div className="flex-grow space-y-3 overflow-auto">
          {/* Assets */}
          {assets && (
            <div>
              <div className="flex items-center justify-between text-sm font-medium mb-1">
                <div className="flex items-center gap-1">
                  <Wallet className="w-4 h-4 text-blue-500" />
                  Assets
                </div>
                <span>{formatCurrency(Math.abs(getTotal(assets.balance_children)))}</span>
              </div>
              {renderChildren(assets.children)}
            </div>
          )}

          {/* Liabilities */}
          {liabilities && getTotal(liabilities.balance_children) !== 0 && (
            <div>
              <div className="flex items-center justify-between text-sm font-medium mb-1">
                <div className="flex items-center gap-1">
                  <CreditCard className="w-4 h-4 text-orange-500" />
                  Liabilities
                </div>
                <span className="text-orange-500">{formatCurrency(Math.abs(getTotal(liabilities.balance_children)))}</span>
              </div>
              {renderChildren(liabilities.children)}
            </div>
          )}

          {/* Equity */}
          {equity && (
            <div>
              <div className="flex items-center justify-between text-sm font-medium mb-1">
                <div className="flex items-center gap-1">
                  <PiggyBank className="w-4 h-4 text-purple-500" />
                  Equity
                </div>
                <span className="text-purple-500">{formatCurrency(Math.abs(getTotal(equity.balance_children)))}</span>
              </div>
              {renderChildren(equity.children)}
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" className="mt-3" onClick={openFava}>
          <ExternalLink className="w-4 h-4 mr-1" />
          Open Fava
        </Button>
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
          <DialogTitle>Fava Settings</DialogTitle>
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
            <Label htmlFor="url-input">Fava URL</Label>
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
            <Label htmlFor="path-input">Beancount Path</Label>
            <Input
              id="path-input"
              type="text"
              value={localConfig.beancountPath || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalConfig({ ...localConfig, beancountPath: e.target.value })
              }
              placeholder="eleva-spa"
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

export default FavaWidget;
