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
import WidgetHeader from '../common/WidgetHeader';
import { FavaWidgetConfig, FavaWidgetProps, FavaAccountNode, FavaBalance } from './types';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  Wallet,
  CreditCard,
  PiggyBank,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Search,
  Settings,
  RefreshCw,
  DollarSign,
  BarChart3,
} from 'lucide-react';

// Base URL for services - override with VITE_SERVICES_BASE_URL env var
const SERVICES_BASE_URL = import.meta.env.VITE_SERVICES_BASE_URL || 'http://localhost';
const FAVA_PORT = import.meta.env.VITE_FAVA_PORT || '7503';

const defaultConfig: FavaWidgetConfig = {
  title: 'Fava',
  baseUrl: `${SERVICES_BASE_URL}:${FAVA_PORT}`,
  beancountPath: 'eleva-spa',
  refreshInterval: 300,
  currency: '$'
};

const FavaWidget: React.FC<FavaWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<FavaWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<FavaAccountNode | null>(null);
  const [liabilities, setLiabilities] = useState<FavaAccountNode | null>(null);
  const [equity, setEquity] = useState<FavaAccountNode | null>(null);
  const [income, setIncome] = useState<FavaAccountNode | null>(null);
  const [expenses, setExpenses] = useState<FavaAccountNode | null>(null);
  const [netWorth, setNetWorth] = useState(0);

  // App-mode state
  const [activeTab, setActiveTab] = useState<'balance' | 'income'>('balance');
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Get total from balance
  const getTotal = useCallback((balance: FavaBalance): number => {
    return Object.values(balance).reduce((sum, val) => sum + val, 0);
  }, []);

  // Fetch data from Fava
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const balanceUrl = new URL(`${localConfig.beancountPath}/api/balance_sheet`, localConfig.baseUrl).href;
      const incomeUrl = new URL(`${localConfig.beancountPath}/api/income_statement`, localConfig.baseUrl).href;

      const [balanceRes, incomeRes] = await Promise.all([
        fetch(balanceUrl, { signal: AbortSignal.timeout(10000) }),
        fetch(incomeUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null),
      ]);

      if (!balanceRes.ok) throw new Error('Failed to fetch balance sheet');

      const balanceData = await balanceRes.json();
      const trees = balanceData.data?.trees || [];

      for (const node of trees) {
        if (node.account === 'Assets') setAssets(node);
        else if (node.account === 'Liabilities') setLiabilities(node);
        else if (node.account === 'Equity') setEquity(node);
      }

      // Calculate net worth from chart data
      const charts = balanceData.data?.charts || [];
      const networthChart = charts.find((c: { label: string }) => c.label === 'Net Worth');
      if (networthChart?.data?.length > 0) {
        const latest = networthChart.data[networthChart.data.length - 1];
        setNetWorth(Object.values(latest.balance as FavaBalance).reduce((sum: number, val: number) => sum + val, 0));
      }

      // Parse income statement if available
      if (incomeRes?.ok) {
        const incomeData = await incomeRes.json();
        const incomeTrees = incomeData.data?.trees || [];
        for (const node of incomeTrees) {
          if (node.account === 'Income') setIncome(node);
          else if (node.account === 'Expenses') setExpenses(node);
        }
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
  const formatCurrency = useCallback((amount: number, compact = false) => {
    const symbol = localConfig.currency || '$';
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (compact) {
      if (absAmount >= 1_000_000_000) return `${sign}${symbol}${(absAmount / 1_000_000_000).toFixed(1)}B`;
      if (absAmount >= 1_000_000) return `${sign}${symbol}${(absAmount / 1_000_000).toFixed(1)}M`;
      if (absAmount >= 1_000) return `${sign}${symbol}${(absAmount / 1_000).toFixed(0)}K`;
    }
    return `${sign}${symbol}${Math.round(absAmount).toLocaleString()}`;
  }, [localConfig.currency]);

  // Open Fava in browser
  const openFava = useCallback(() => {
    window.open(`${localConfig.baseUrl}/${localConfig.beancountPath}/`, '_blank', 'noopener,noreferrer');
  }, [localConfig.baseUrl, localConfig.beancountPath]);

  // Toggle expanded account in tree view
  const toggleExpanded = useCallback((account: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(account)) next.delete(account);
      else next.add(account);
      return next;
    });
  }, []);

  // Flatten account tree for searching
  const flattenTree = useCallback((node: FavaAccountNode, depth = 0): Array<{ node: FavaAccountNode; depth: number }> => {
    const result: Array<{ node: FavaAccountNode; depth: number }> = [{ node, depth }];
    for (const child of node.children) {
      result.push(...flattenTree(child, depth + 1));
    }
    return result;
  }, []);

  // Filtered accounts for search
  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return null;
    const query = searchQuery.toLowerCase();
    const allNodes: Array<{ node: FavaAccountNode; depth: number; section: string }> = [];
    const sections: Array<{ node: FavaAccountNode | null; label: string }> = [
      { node: assets, label: 'Assets' },
      { node: liabilities, label: 'Liabilities' },
      { node: equity, label: 'Equity' },
      { node: income, label: 'Income' },
      { node: expenses, label: 'Expenses' },
    ];
    for (const { node, label } of sections) {
      if (!node) continue;
      const flat = flattenTree(node);
      for (const item of flat) {
        if (item.node.account.toLowerCase().includes(query)) {
          allNodes.push({ ...item, section: label });
        }
      }
    }
    return allNodes;
  }, [searchQuery, assets, liabilities, equity, income, expenses, flattenTree]);

  // Save settings
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  };

  // Reset settings on close
  const handleSettingsOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setLocalConfig(prev => ({ ...prev, ...config }));
    }
    setShowSettings(nextOpen);
  };

  // --- Loading / Error states ---
  if (loading && !assets && !liabilities) {
    if (isTiny) {
      return (
        <div className="w-full h-full flex items-center justify-center widget-drag-handle">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <div className="widget-container h-full flex flex-col p-2 md:p-3">
        <WidgetHeader title={localConfig.title} onSettingsClick={readOnly ? undefined : () => setShowSettings(true)} compact={isShort} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
        {renderSettingsDialog()}
      </div>
    );
  }

  if (error && !assets && !liabilities) {
    if (isTiny) {
      return (
        <div className="w-full h-full flex items-center justify-center widget-drag-handle">
          <AlertCircle className="w-4 h-4 text-red-500" />
        </div>
      );
    }
    return (
      <div className="widget-container h-full flex flex-col p-2 md:p-3">
        <WidgetHeader title={localConfig.title} onSettingsClick={readOnly ? undefined : () => setShowSettings(true)} compact={isShort} />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <span className="text-sm text-red-500">{error}</span>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
        {renderSettingsDialog()}
      </div>
    );
  }

  // Setup prompt if no URL configured
  if (!localConfig.baseUrl) {
    return (
      <div className="widget-container h-full flex flex-col p-2 md:p-3">
        <WidgetHeader title={localConfig.title} onSettingsClick={readOnly ? undefined : () => setShowSettings(true)} />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Settings className="h-8 w-8" />
          <p className="text-sm">Configure Fava URL to get started</p>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              Open Settings
            </Button>
          )}
        </div>
        {renderSettingsDialog()}
      </div>
    );
  }

  // --- Account tree renderer for panel/app modes ---
  const renderAccountTree = (node: FavaAccountNode, depth = 0, maxDepth = 99, maxItems = 999) => {
    const total = getTotal(node.balance_children);
    if (total === 0 && depth > 0) return null;
    const name = node.account.split(':').pop() || node.account;
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedAccounts.has(node.account);
    const isSelected = selectedAccount === node.account;

    let renderedCount = 0;

    return (
      <div key={node.account}>
        <button
          onClick={() => {
            if (hasChildren && depth < maxDepth) toggleExpanded(node.account);
            setSelectedAccount(node.account);
          }}
          className={`w-full flex items-center justify-between py-1.5 px-2 text-sm hover:bg-accent/50 rounded transition-colors ${
            isSelected ? 'bg-accent' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <div className="flex items-center gap-1 min-w-0">
            {hasChildren && depth < maxDepth ? (
              isExpanded ? (
                <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="w-3 shrink-0" />
            )}
            <span className="truncate">{name}</span>
          </div>
          <span className={`shrink-0 ml-2 font-mono text-xs ${total < 0 ? 'text-red-500' : 'text-foreground'}`}>
            {formatCurrency(total)}
          </span>
        </button>
        {hasChildren && isExpanded && depth < maxDepth && (
          <div>
            {node.children
              .filter(c => getTotal(c.balance_children) !== 0)
              .map(child => {
                if (renderedCount >= maxItems) return null;
                renderedCount++;
                return renderAccountTree(child, depth + 1, maxDepth, maxItems);
              })}
          </div>
        )}
      </div>
    );
  };

  // --- Account section header ---
  const renderSectionHeader = (
    label: string,
    icon: React.ReactNode,
    node: FavaAccountNode | null,
    colorClass: string
  ) => {
    if (!node) return null;
    const total = getTotal(node.balance_children);
    return (
      <div className={`flex items-center justify-between text-sm font-medium py-1.5 px-2 ${colorClass}`}>
        <div className="flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-mono text-xs">{formatCurrency(Math.abs(total))}</span>
      </div>
    );
  };

  // --- Size-specific renderers (most specific first) ---

  // 1x1 ICON: net worth value only
  const renderTiny = () => {
    const isPositive = netWorth >= 0;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
        <div className="text-lg font-semibold leading-none text-foreground">
          {formatCurrency(netWorth, true)}
        </div>
        <div className={`text-[10px] flex items-center gap-0.5 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
          {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          <span>NW</span>
        </div>
      </div>
    );
  };

  // Nx1 RIBBON: net worth badge + top account chips
  const renderShort = () => {
    const topAccounts = assets?.children
      .filter(c => getTotal(c.balance_children) !== 0)
      .sort((a, b) => Math.abs(getTotal(b.balance_children)) - Math.abs(getTotal(a.balance_children)))
      .slice(0, Math.max(2, width - 1)) || [];

    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs">
        <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-1 font-medium text-green-700 dark:text-green-300">
          {formatCurrency(netWorth, true)}
        </span>
        {topAccounts.map(account => {
          const name = account.account.split(':').pop() || account.account;
          const total = getTotal(account.balance_children);
          return (
            <button
              key={account.account}
              onClick={() => openFava()}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-foreground transition-colors hover:bg-accent"
            >
              <span className="max-w-[6rem] truncate">{name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{formatCurrency(total, true)}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // 2x2 COMPACT: net worth + summary row per section
  const renderCompact = () => {
    const isPositive = netWorth >= 0;
    return (
      <div className="flex-1 flex flex-col justify-center gap-1.5 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-foreground">{formatCurrency(netWorth, true)}</div>
            <div className={`flex items-center text-[10px] ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              Net Worth
            </div>
          </div>
          <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
        </div>
        <div className="space-y-0.5 text-[11px]">
          {assets && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Wallet className="w-3 h-3 text-blue-500" />
                <span>Assets</span>
              </div>
              <span className="font-medium">{formatCurrency(Math.abs(getTotal(assets.balance_children)), true)}</span>
            </div>
          )}
          {liabilities && getTotal(liabilities.balance_children) !== 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-muted-foreground">
                <CreditCard className="w-3 h-3 text-orange-500" />
                <span>Liabilities</span>
              </div>
              <span className="font-medium text-orange-500">{formatCurrency(Math.abs(getTotal(liabilities.balance_children)), true)}</span>
            </div>
          )}
          {equity && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-muted-foreground">
                <PiggyBank className="w-3 h-3 text-purple-500" />
                <span>Equity</span>
              </div>
              <span className="font-medium">{formatCurrency(Math.abs(getTotal(equity.balance_children)), true)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 3x3 DEFAULT: net worth header + account sections with top children
  const renderDefault = () => {
    const isPositive = netWorth >= 0;

    const renderTopChildren = (node: FavaAccountNode) => {
      return node.children
        .filter(c => getTotal(c.balance_children) !== 0)
        .sort((a, b) => Math.abs(getTotal(b.balance_children)) - Math.abs(getTotal(a.balance_children)))
        .slice(0, 4)
        .map(child => {
          const name = child.account.split(':').pop() || child.account;
          const total = getTotal(child.balance_children);
          return (
            <div key={child.account} className="flex justify-between text-xs py-0.5 pl-5">
              <span className="text-muted-foreground truncate">{name}</span>
              <span className={`shrink-0 ml-2 ${total < 0 ? 'text-red-500' : ''}`}>{formatCurrency(Math.abs(total), true)}</span>
            </div>
          );
        });
    };

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Net worth header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(netWorth)}</div>
            <div className={`flex items-center text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
              Net Worth
            </div>
          </div>
          <BookOpen className="w-7 h-7 text-green-600 dark:text-green-400" />
        </div>

        {/* Account sections */}
        <div className="flex-1 overflow-auto space-y-2">
          {assets && (
            <div>
              {renderSectionHeader('Assets', <Wallet className="w-3.5 h-3.5 text-blue-500" />, assets, '')}
              {renderTopChildren(assets)}
            </div>
          )}
          {liabilities && getTotal(liabilities.balance_children) !== 0 && (
            <div>
              {renderSectionHeader('Liabilities', <CreditCard className="w-3.5 h-3.5 text-orange-500" />, liabilities, 'text-orange-600 dark:text-orange-400')}
              {renderTopChildren(liabilities)}
            </div>
          )}
          {equity && (
            <div>
              {renderSectionHeader('Equity', <PiggyBank className="w-3.5 h-3.5 text-purple-500" />, equity, 'text-purple-600 dark:text-purple-400')}
              {renderTopChildren(equity)}
            </div>
          )}
        </div>

        {!readOnly && (
          <Button variant="outline" size="sm" className="mt-2 w-full" onClick={openFava}>
            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open Fava
          </Button>
        )}
      </div>
    );
  };

  // 4x4-5x5 PANEL: split view with balance sheet + account details
  const renderPanel = () => {
    const isPositive = netWorth >= 0;
    const selectedNode = selectedAccount ? findAccountNode(selectedAccount) : null;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Summary bar */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-foreground">{formatCurrency(netWorth)}</span>
            <span className={`flex items-center text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              Net Worth
            </span>
          </div>
          {!readOnly && (
            <Button variant="ghost" size="sm" onClick={openFava} className="text-xs h-7">
              <ExternalLink className="w-3 h-3 mr-1" /> Fava
            </Button>
          )}
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Account tree */}
          <div className="flex-1 overflow-y-auto border-r border-border/50">
            {assets && (
              <div className="py-1">
                {renderSectionHeader('Assets', <Wallet className="w-3.5 h-3.5 text-blue-500" />, assets, 'bg-blue-500/5')}
                {renderAccountTree(assets, 0, 3, 10)}
              </div>
            )}
            {liabilities && getTotal(liabilities.balance_children) !== 0 && (
              <div className="py-1">
                {renderSectionHeader('Liabilities', <CreditCard className="w-3.5 h-3.5 text-orange-500" />, liabilities, 'bg-orange-500/5')}
                {renderAccountTree(liabilities, 0, 3, 10)}
              </div>
            )}
            {equity && (
              <div className="py-1">
                {renderSectionHeader('Equity', <PiggyBank className="w-3.5 h-3.5 text-purple-500" />, equity, 'bg-purple-500/5')}
                {renderAccountTree(equity, 0, 2, 8)}
              </div>
            )}
          </div>

          {/* Detail pane */}
          <div className="w-2/5 overflow-y-auto p-3">
            {selectedNode ? (
              <div>
                <h4 className="text-sm font-semibold mb-2 break-words">{selectedNode.account}</h4>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Own Balance</div>
                    <div className="text-lg font-mono font-semibold">
                      {formatCurrency(getTotal(selectedNode.balance))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Including Children</div>
                    <div className="text-lg font-mono font-semibold">
                      {formatCurrency(getTotal(selectedNode.balance_children))}
                    </div>
                  </div>
                  {selectedNode.children.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Sub-accounts ({selectedNode.children.length})</div>
                      <div className="space-y-1">
                        {selectedNode.children
                          .filter(c => getTotal(c.balance_children) !== 0)
                          .sort((a, b) => Math.abs(getTotal(b.balance_children)) - Math.abs(getTotal(a.balance_children)))
                          .map(child => {
                            const name = child.account.split(':').pop() || child.account;
                            const total = getTotal(child.balance_children);
                            return (
                              <button
                                key={child.account}
                                onClick={() => setSelectedAccount(child.account)}
                                className="w-full flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-accent/50"
                              >
                                <span className="truncate">{name}</span>
                                <span className={`shrink-0 ml-2 font-mono ${total < 0 ? 'text-red-500' : ''}`}>
                                  {formatCurrency(total)}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                  {/* Balance breakdown by currency */}
                  {Object.keys(selectedNode.balance_children).length > 1 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">By Currency</div>
                      <div className="space-y-0.5">
                        {Object.entries(selectedNode.balance_children)
                          .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                          .map(([currency, amount]) => (
                            <div key={currency} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{currency}</span>
                              <span className="font-mono">{amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                <DollarSign className="w-8 h-8 mb-2" />
                <p>Select an account</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 6x6+ APP: full beancount dashboard with tabs, search, master-detail
  const renderApp = () => {
    const isPositive = netWorth >= 0;

    const tabs = [
      { id: 'balance' as const, label: 'Balance Sheet', icon: <Wallet className="w-3.5 h-3.5" /> },
      { id: 'income' as const, label: 'Income Statement', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    ];

    const balanceSheetNodes: Array<{ node: FavaAccountNode | null; label: string; icon: React.ReactNode; colorClass: string; bgClass: string }> = [
      { node: assets, label: 'Assets', icon: <Wallet className="w-4 h-4 text-blue-500" />, colorClass: '', bgClass: 'bg-blue-500/5' },
      { node: liabilities, label: 'Liabilities', icon: <CreditCard className="w-4 h-4 text-orange-500" />, colorClass: 'text-orange-600 dark:text-orange-400', bgClass: 'bg-orange-500/5' },
      { node: equity, label: 'Equity', icon: <PiggyBank className="w-4 h-4 text-purple-500" />, colorClass: 'text-purple-600 dark:text-purple-400', bgClass: 'bg-purple-500/5' },
    ];

    const incomeStatementNodes: Array<{ node: FavaAccountNode | null; label: string; icon: React.ReactNode; colorClass: string; bgClass: string }> = [
      { node: income, label: 'Income', icon: <TrendingUp className="w-4 h-4 text-green-500" />, colorClass: 'text-green-600 dark:text-green-400', bgClass: 'bg-green-500/5' },
      { node: expenses, label: 'Expenses', icon: <TrendingDown className="w-4 h-4 text-red-500" />, colorClass: 'text-red-600 dark:text-red-400', bgClass: 'bg-red-500/5' },
    ];

    const currentNodes = activeTab === 'balance' ? balanceSheetNodes : incomeStatementNodes;
    const selectedNode = selectedAccount ? findAccountNode(selectedAccount) : null;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top bar: summary + tabs */}
        <div className="flex items-center justify-between px-3 py-2 widget-drag-handle cursor-move">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(netWorth)}</div>
              <div className={`flex items-center text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                Net Worth
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={openFava} className="text-xs h-8">
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open Fava
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={fetchData} className="h-8 w-8 p-0">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border/50 px-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Master-detail layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Master: account tree with search */}
          <div className="w-1/3 border-r border-border/50 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>

            {/* Account tree or search results */}
            <div className="flex-1 overflow-y-auto">
              {filteredAccounts ? (
                filteredAccounts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No matching accounts</div>
                ) : (
                  <div className="py-1">
                    {filteredAccounts.map(({ node: acctNode, section }) => {
                      const total = getTotal(acctNode.balance_children);
                      const isSelected = selectedAccount === acctNode.account;
                      return (
                        <button
                          key={acctNode.account}
                          onClick={() => setSelectedAccount(acctNode.account)}
                          className={`w-full flex items-center justify-between py-1.5 px-3 text-sm hover:bg-accent/50 ${
                            isSelected ? 'bg-accent' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-foreground">{acctNode.account}</div>
                            <div className="text-[10px] text-muted-foreground">{section}</div>
                          </div>
                          <span className={`shrink-0 ml-2 font-mono text-xs ${total < 0 ? 'text-red-500' : ''}`}>
                            {formatCurrency(total)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                currentNodes.map(({ node: sectionNode, label, icon, bgClass }) => {
                  if (!sectionNode) return null;
                  const sectionTotal = getTotal(sectionNode.balance_children);
                  if (sectionTotal === 0 && label !== 'Assets') return null;
                  return (
                    <div key={label} className="py-1">
                      {renderSectionHeader(label, icon, sectionNode, bgClass)}
                      {renderAccountTree(sectionNode, 0, 99, 999)}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail pane */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold break-words">{selectedNode.account}</h3>
                  <div className="text-xs text-muted-foreground mt-1">
                    {selectedNode.children.length} sub-account{selectedNode.children.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Balance cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/70 p-3">
                    <div className="text-xs text-muted-foreground mb-1">Own Balance</div>
                    <div className="text-xl font-mono font-semibold">
                      {formatCurrency(getTotal(selectedNode.balance))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3">
                    <div className="text-xs text-muted-foreground mb-1">Total (with children)</div>
                    <div className="text-xl font-mono font-semibold">
                      {formatCurrency(getTotal(selectedNode.balance_children))}
                    </div>
                  </div>
                </div>

                {/* Currency breakdown */}
                {Object.keys(selectedNode.balance_children).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Balance by Currency</h4>
                    <div className="rounded-lg border border-border/70 divide-y divide-border/50">
                      {Object.entries(selectedNode.balance_children)
                        .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                        .map(([currency, amount]) => (
                          <div key={currency} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="font-medium">{currency}</span>
                            <span className={`font-mono ${amount < 0 ? 'text-red-500' : ''}`}>
                              {amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Sub-accounts list */}
                {selectedNode.children.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Sub-accounts</h4>
                    <div className="rounded-lg border border-border/70 divide-y divide-border/50">
                      {selectedNode.children
                        .filter(c => getTotal(c.balance_children) !== 0)
                        .sort((a, b) => Math.abs(getTotal(b.balance_children)) - Math.abs(getTotal(a.balance_children)))
                        .map(child => {
                          const name = child.account.split(':').pop() || child.account;
                          const total = getTotal(child.balance_children);
                          const childCount = child.children.length;
                          return (
                            <button
                              key={child.account}
                              onClick={() => {
                                setSelectedAccount(child.account);
                                setExpandedAccounts(prev => new Set([...prev, child.account]));
                              }}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-accent/30 transition-colors"
                            >
                              <div className="min-w-0">
                                <div className="font-medium truncate text-foreground">{name}</div>
                                {childCount > 0 && (
                                  <div className="text-[10px] text-muted-foreground">{childCount} sub-accounts</div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className={`font-mono ${total < 0 ? 'text-red-500' : ''}`}>
                                  {formatCurrency(total)}
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <DollarSign className="w-12 h-12 mb-3" />
                <p className="text-sm font-medium">Select an account to view details</p>
                <p className="text-xs mt-1">Use the tree on the left or search to find accounts</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Helper: find account node by path across all trees
  function findAccountNode(accountPath: string): FavaAccountNode | null {
    const trees = [assets, liabilities, equity, income, expenses].filter(Boolean) as FavaAccountNode[];
    for (const tree of trees) {
      const found = findInTree(tree, accountPath);
      if (found) return found;
    }
    return null;
  }

  function findInTree(node: FavaAccountNode, path: string): FavaAccountNode | null {
    if (node.account === path) return node;
    for (const child of node.children) {
      const found = findInTree(child, path);
      if (found) return found;
    }
    return null;
  }

  // --- Settings Dialog ---
  function renderSettingsDialog() {
    if (readOnly) return null;
    return (
      <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{localConfig.title || 'Fava'} Settings</DialogTitle>
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
              <Label htmlFor="baseUrl">Fava URL</Label>
              <Input
                id="baseUrl"
                type="url"
                value={localConfig.baseUrl || ''}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="http://localhost:7503"
              />
            </div>

            <div>
              <Label htmlFor="beancountPath">Beancount Path</Label>
              <Input
                id="beancountPath"
                value={localConfig.beancountPath || ''}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, beancountPath: e.target.value }))}
                placeholder="eleva-spa"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The path segment used in the Fava URL (e.g., eleva-spa)
              </p>
            </div>

            <div>
              <Label htmlFor="currency">Currency Symbol</Label>
              <Input
                id="currency"
                value={localConfig.currency || ''}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, currency: e.target.value }))}
                placeholder="$"
              />
            </div>

            <div>
              <Label htmlFor="refreshInterval">Refresh Interval (seconds)</Label>
              <Input
                id="refreshInterval"
                type="number"
                min={30}
                value={localConfig.refreshInterval || 300}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, refreshInterval: parseInt(e.target.value) || 300 }))}
              />
            </div>
          </div>

          <DialogFooter>
            <div className="flex justify-between w-full">
              {config?.onDelete && (
                <Button variant="destructive" onClick={config.onDelete}>Delete Widget</Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" onClick={() => handleSettingsOpenChange(false)}>Cancel</Button>
                <Button onClick={saveSettings}>Save</Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // --- Main render ---
  return (
    <div className={cn('widget-container h-full flex flex-col', isTiny ? 'widget-drag-handle' : 'p-2 md:p-3')}>
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      {isTiny ? (
        <div className="flex-1 flex items-center justify-center p-1">
          {renderTiny()}
        </div>
      ) : isShort ? (
        <div className="flex-1 overflow-hidden px-1">
          {renderShort()}
        </div>
      ) : isApp ? (
        <div className="flex-1 overflow-hidden">
          {renderApp()}
        </div>
      ) : isWide && isTall ? (
        <div className="flex-1 overflow-hidden">
          {renderPanel()}
        </div>
      ) : isCompact ? (
        <div className="flex-1 overflow-hidden px-1">
          {renderCompact()}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          {renderDefault()}
        </div>
      )}

      {renderSettingsDialog()}
    </div>
  );
};

export default FavaWidget;
