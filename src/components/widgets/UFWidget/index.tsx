import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import WidgetHeader from '../common/WidgetHeader';
import { UFWidgetProps, UFWidgetConfig, UFData, UFSerieItem } from './types';
import { cn } from '@/lib/utils';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Skeleton } from '../../ui/skeleton';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRightLeft,
  DollarSign,
} from 'lucide-react';

const DEFAULT_CONFIG: UFWidgetConfig = {
  title: 'UF (Chile)',
  showHistory: true,
  refreshInterval: 60,
};

const UFWidget: React.FC<UFWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  // --- State ---
  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<UFWidgetConfig>({
    ...DEFAULT_CONFIG,
    ...config,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ufData, setUfData] = useState<UFData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // App-mode state
  const [converterAmount, setConverterAmount] = useState<string>('1');
  const [converterDirection, setConverterDirection] = useState<'uf-to-clp' | 'clp-to-uf'>('uf-to-clp');

  const abortControllerRef = useRef<AbortController | null>(null);

  // Snapshot for settings reset on cancel
  const configSnapshotRef = useRef<UFWidgetConfig>(localConfig);

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // --- Data fetching ---
  const fetchUfData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/mindicador/api', {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data?.uf) {
        throw new Error('Invalid API response');
      }

      const transformed: UFData = {
        codigo: data.uf.codigo,
        nombre: data.uf.nombre,
        unidad_medida: data.uf.unidad_medida,
        fecha: data.uf.fecha,
        valor: data.uf.valor,
        serie: data.uf.serie || [],
      };

      if (controller === abortControllerRef.current) {
        setUfData(transformed);
        setLastUpdated(new Date());
        setLoading(false);
      }
    } catch (err) {
      if (controller === abortControllerRef.current) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError('No se pudo obtener datos');
          setLoading(false);
        }
      }
    }
  }, []);

  // Fetch on mount and set up refresh interval
  useEffect(() => {
    fetchUfData();

    const intervalMs = (localConfig.refreshInterval ?? 60) * 60 * 1000;
    const timer = setInterval(fetchUfData, intervalMs);

    return () => {
      clearInterval(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [fetchUfData, localConfig.refreshInterval]);

  // --- Helpers ---
  const formatUfValue = useCallback((value: number | undefined | null): string => {
    if (value === undefined || value === null) return '--';
    return value.toLocaleString('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  const formatDate = useCallback((dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('es-CL');
    } catch {
      return dateString;
    }
  }, []);

  const dailyChange = useMemo(() => {
    if (!ufData?.serie?.length || !ufData.valor) return null;
    const prev = ufData.serie[0]?.valor;
    if (!prev) return null;
    const diff = ufData.valor - prev;
    const pct = (diff / prev) * 100;
    return { diff, pct, direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' as const };
  }, [ufData]);

  const TrendIcon = dailyChange?.direction === 'up' ? TrendingUp
    : dailyChange?.direction === 'down' ? TrendingDown
    : Minus;

  const trendColor = dailyChange?.direction === 'up'
    ? 'text-green-600 dark:text-green-400'
    : dailyChange?.direction === 'down'
    ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground';

  // Conversion helper
  const convertedValue = useMemo(() => {
    if (!ufData?.valor) return null;
    const amount = parseFloat(converterAmount);
    if (isNaN(amount)) return null;
    if (converterDirection === 'uf-to-clp') {
      return amount * ufData.valor;
    }
    return amount / ufData.valor;
  }, [ufData?.valor, converterAmount, converterDirection]);

  // --- Sparkline (mini chart for series data) ---
  const renderSparkline = useCallback((series: UFSerieItem[], sparkWidth: number, sparkHeight: number) => {
    if (!series.length) return null;
    const reversed = [...series].reverse(); // oldest first
    const values = reversed.map(s => s.valor);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * sparkWidth;
      const y = sparkHeight - ((v - min) / range) * sparkHeight;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={sparkWidth} height={sparkHeight} className="overflow-visible">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          className="text-blue-500 dark:text-blue-400"
        />
      </svg>
    );
  }, []);

  // --- Loading / error states ---
  const renderLoading = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-2">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-20" />
    </div>
  );

  const renderError = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <p className="text-xs">{error}</p>
      <Button variant="outline" size="sm" onClick={fetchUfData}>
        <RefreshCw className="h-3 w-3 mr-1" /> Reintentar
      </Button>
    </div>
  );

  // --- Size-specific renderers ---

  const renderTiny = () => {
    if (loading) return <div className="flex-1 flex items-center justify-center"><Skeleton className="h-5 w-10" /></div>;
    if (error || !ufData) return <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground">--</div>;

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
        <span className="text-lg font-bold leading-none text-blue-600 dark:text-blue-400">
          {Math.round(ufData.valor / 1000)}k
        </span>
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">UF</span>
      </div>
    );
  };

  const renderShort = () => {
    if (loading) return renderLoading();
    if (error || !ufData) return renderError();

    return (
      <div className="flex-1 flex items-center gap-3 overflow-x-auto px-1">
        <div className="flex items-center gap-1.5 shrink-0">
          <DollarSign className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
            ${formatUfValue(ufData.valor)}
          </span>
        </div>
        {dailyChange && (
          <span className={`flex items-center gap-1 shrink-0 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            {dailyChange.pct >= 0 ? '+' : ''}{dailyChange.pct.toFixed(2)}%
          </span>
        )}
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatDate(ufData.fecha)}
        </span>
        {ufData.serie.length > 2 && (
          <div className="shrink-0">
            {renderSparkline(ufData.serie.slice(0, 7), 48, 16)}
          </div>
        )}
      </div>
    );
  };

  const renderCompact = () => {
    if (loading) return renderLoading();
    if (error || !ufData) return renderError();

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-1">
        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          ${formatUfValue(ufData.valor)}
        </div>
        {dailyChange && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            {dailyChange.pct >= 0 ? '+' : ''}{dailyChange.pct.toFixed(2)}%
          </div>
        )}
        <div className="text-[10px] text-muted-foreground">
          {formatDate(ufData.fecha)}
        </div>
      </div>
    );
  };

  const renderDefault = () => {
    if (loading) return renderLoading();
    if (error || !ufData) return renderError();

    const showHistory = localConfig.showHistory && ufData.serie.length > 0;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs text-muted-foreground">Unidad de Fomento</div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              ${formatUfValue(ufData.valor)}
            </div>
            {dailyChange && (
              <div className={`flex items-center gap-1 text-xs font-medium mt-0.5 ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                {dailyChange.diff >= 0 ? '+' : ''}{formatUfValue(dailyChange.diff)} ({dailyChange.pct >= 0 ? '+' : ''}{dailyChange.pct.toFixed(2)}%)
              </div>
            )}
          </div>
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchUfData}
              className="h-7 w-7"
              title="Actualizar"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {showHistory && (
          <div className="flex-1 overflow-y-auto space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Historial reciente
            </div>
            {ufData.serie.slice(0, 5).map((item, i) => (
              <div key={i} className="flex justify-between text-xs px-2 py-1 rounded bg-muted/50">
                <span className="text-muted-foreground">{formatDate(item.fecha)}</span>
                <span className="font-medium">${formatUfValue(item.valor)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground mt-2 text-center">
          {lastUpdated && `${lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} · `}
          mindicador.cl
        </div>
      </div>
    );
  };

  const renderPanel = () => {
    if (loading) return renderLoading();
    if (error || !ufData) return renderError();

    const series = ufData.serie.slice(0, 15);

    return (
      <div className="flex-1 flex overflow-hidden gap-3">
        {/* Left: value + chart */}
        <div className="flex-1 flex flex-col">
          <div className="mb-3">
            <div className="text-xs text-muted-foreground">Unidad de Fomento (UF)</div>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              ${formatUfValue(ufData.valor)}
            </div>
            {dailyChange && (
              <div className={`flex items-center gap-1 text-sm font-medium mt-1 ${trendColor}`}>
                <TrendIcon className="h-4 w-4" />
                {dailyChange.diff >= 0 ? '+' : ''}{formatUfValue(dailyChange.diff)} ({dailyChange.pct >= 0 ? '+' : ''}{dailyChange.pct.toFixed(2)}%)
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {formatDate(ufData.fecha)}
            </div>
          </div>

          {/* Sparkline chart area */}
          {series.length > 2 && (
            <div className="flex-1 flex items-center justify-center p-2">
              {renderSparkline(series, 180, 60)}
            </div>
          )}

          <div className="text-[10px] text-muted-foreground mt-auto">
            {lastUpdated && `${lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} · `}
            mindicador.cl
          </div>
        </div>

        {/* Right: history list */}
        <div className="w-2/5 border-l pl-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Historial
            </div>
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchUfData}
                className="h-6 w-6"
                title="Actualizar"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="space-y-1">
            {series.map((item, i) => (
              <div key={i} className="flex justify-between text-xs px-2 py-1.5 rounded bg-muted/50">
                <span className="text-muted-foreground">{formatDate(item.fecha)}</span>
                <span className="font-medium">${formatUfValue(item.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderApp = () => {
    if (loading) return renderLoading();
    if (error || !ufData) return renderError();

    const series = ufData.serie.slice(0, 30);

    // Stats from series
    const values = series.map(s => s.valor);
    const seriesMin = values.length ? Math.min(...values) : 0;
    const seriesMax = values.length ? Math.max(...values) : 0;
    const seriesAvg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    return (
      <div className="flex-1 flex h-full overflow-hidden">
        {/* Left panel: converter + stats */}
        <div className="w-1/3 border-r flex flex-col overflow-y-auto p-3">
          {/* Current value */}
          <div className="mb-4 widget-drag-handle cursor-move">
            <div className="text-xs text-muted-foreground">Valor actual UF</div>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              ${formatUfValue(ufData.valor)}
            </div>
            {dailyChange && (
              <div className={`flex items-center gap-1 text-sm font-medium mt-1 ${trendColor}`}>
                <TrendIcon className="h-4 w-4" />
                {dailyChange.diff >= 0 ? '+' : ''}{formatUfValue(dailyChange.diff)}
                <span className="text-xs">
                  ({dailyChange.pct >= 0 ? '+' : ''}{dailyChange.pct.toFixed(3)}%)
                </span>
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {formatDate(ufData.fecha)}
            </div>
          </div>

          {/* Converter */}
          <div className="mb-4 p-3 rounded-lg border bg-muted/30">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Convertidor
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">
                  {converterDirection === 'uf-to-clp' ? 'UF' : 'CLP'}
                </Label>
                <Input
                  type="number"
                  value={converterAmount}
                  onChange={(e) => setConverterAmount(e.target.value)}
                  className="h-8 text-sm"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConverterDirection(d => d === 'uf-to-clp' ? 'clp-to-uf' : 'uf-to-clp')}
                  className="h-7 w-7"
                  title="Invertir"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">
                  {converterDirection === 'uf-to-clp' ? 'CLP' : 'UF'}
                </Label>
                <div className="h-8 flex items-center px-3 rounded-md border bg-background text-sm font-medium">
                  {convertedValue !== null
                    ? converterDirection === 'uf-to-clp'
                      ? `$${formatUfValue(convertedValue)}`
                      : formatUfValue(convertedValue)
                    : '--'
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Estadisticas ({series.length} dias)
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Minimo</span>
                <span className="font-medium">${formatUfValue(seriesMin)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Maximo</span>
                <span className="font-medium">${formatUfValue(seriesMax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Promedio</span>
                <span className="font-medium">${formatUfValue(seriesAvg)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rango</span>
                <span className="font-medium">${formatUfValue(seriesMax - seriesMin)}</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground mt-auto pt-3">
            {lastUpdated && `Actualizado: ${lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`}
            <div>Fuente: mindicador.cl</div>
          </div>
        </div>

        {/* Right panel: chart + history table */}
        <div className="flex-1 flex flex-col overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Historial de valores</div>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={fetchUfData}>
                <RefreshCw className="h-3 w-3 mr-1" /> Actualizar
              </Button>
            )}
          </div>

          {/* Chart area */}
          {series.length > 2 && (
            <div className="mb-4 p-4 rounded-lg border bg-muted/20 flex items-center justify-center">
              {renderSparkline(series, 400, 100)}
            </div>
          )}

          {/* History table */}
          <div className="flex-1 overflow-y-auto">
            <div className="rounded-md border">
              <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b bg-muted/30 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Fecha</span>
                <span className="text-right">Valor</span>
                <span className="text-right">Variacion</span>
              </div>
              <div className="divide-y">
                {series.map((item, i) => {
                  const prev = series[i + 1];
                  const change = prev ? ((item.valor - prev.valor) / prev.valor) * 100 : null;
                  return (
                    <div key={i} className="grid grid-cols-3 gap-2 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{formatDate(item.fecha)}</span>
                      <span className="text-right font-medium">${formatUfValue(item.valor)}</span>
                      <span className={`text-right text-xs ${
                        change !== null
                          ? change > 0 ? 'text-green-600 dark:text-green-400'
                          : change < 0 ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                          : ''
                      }`}>
                        {change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(3)}%` : '--'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Settings modal ---
  const handleSettingsOpen = useCallback((open: boolean) => {
    if (open) {
      configSnapshotRef.current = { ...localConfig };
    } else {
      // Revert on close (cancel)
      setLocalConfig(configSnapshotRef.current);
    }
    setShowSettings(open);
  }, [localConfig]);

  const saveSettings = useCallback(() => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  }, [config, localConfig]);

  const handleCancel = useCallback(() => {
    setLocalConfig(configSnapshotRef.current);
    setShowSettings(false);
  }, []);

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

      {/* Size-branching render (most specific first) */}
      {isTiny ? renderTiny()
        : isShort ? renderShort()
        : isApp ? renderApp()
        : isWide && isTall ? renderPanel()
        : isCompact ? renderCompact()
        : renderDefault()}

      {/* Settings Modal */}
      {!readOnly && (
        <Dialog open={showSettings} onOpenChange={handleSettingsOpen}>
          <DialogContent className="settings-dialog-content sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{localConfig.title || 'UF (Chile)'} Settings</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="uf-title">Title</Label>
                <Input
                  id="uf-title"
                  value={localConfig.title || ''}
                  onChange={(e) =>
                    setLocalConfig(prev => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="uf-history">Show historical data</Label>
                <Switch
                  id="uf-history"
                  checked={localConfig.showHistory ?? true}
                  onCheckedChange={(checked) =>
                    setLocalConfig(prev => ({ ...prev, showHistory: checked }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="uf-refresh">Refresh interval (minutes)</Label>
                <Input
                  id="uf-refresh"
                  type="number"
                  min={1}
                  max={1440}
                  value={localConfig.refreshInterval ?? 60}
                  onChange={(e) =>
                    setLocalConfig(prev => ({
                      ...prev,
                      refreshInterval: parseInt(e.target.value) || 60,
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
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button onClick={saveSettings}>Save</Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default UFWidget;
