import React from 'react';
import { Input } from '@/components/ui/input';
import WidgetHeader from '../common/WidgetHeader';
import { WidgetSettingsDialog, WidgetSettingsDialogFooter } from '../common/WidgetSettingsDialog';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup
} from '../../ui/select';
import { Switch } from "../../ui/switch";
import { Checkbox } from "../../ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import type { CurrencyConverterWidgetProps, CurrencyConverterWidgetConfig } from './types';
import { AlertCircle, BadgeCent } from 'lucide-react';

// Comprehensive currency database
// This includes all currencies supported by Open Exchange Rates
const CURRENCIES: Record<string, { name: string; symbol: string }> = {
  USD: { name: 'US Dollar', symbol: '$' },
  EUR: { name: 'Euro', symbol: '€' },
  GBP: { name: 'British Pound', symbol: '£' },
  JPY: { name: 'Japanese Yen', symbol: '¥' },
  AUD: { name: 'Australian Dollar', symbol: 'A$' },
  CAD: { name: 'Canadian Dollar', symbol: 'C$' },
  CHF: { name: 'Swiss Franc', symbol: 'CHF' },
  CNY: { name: 'Chinese Yuan', symbol: '¥' },
  HKD: { name: 'Hong Kong Dollar', symbol: 'HK$' },
  NZD: { name: 'New Zealand Dollar', symbol: 'NZ$' },
  SEK: { name: 'Swedish Krona', symbol: 'kr' },
  KRW: { name: 'South Korean Won', symbol: '₩' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$' },
  NOK: { name: 'Norwegian Krone', symbol: 'kr' },
  MXN: { name: 'Mexican Peso', symbol: '$' },
  INR: { name: 'Indian Rupee', symbol: '₹' },
  RUB: { name: 'Russian Ruble', symbol: '₽' },
  ZAR: { name: 'South African Rand', symbol: 'R' },
  TRY: { name: 'Turkish Lira', symbol: '₺' },
  BRL: { name: 'Brazilian Real', symbol: 'R$' },
  TWD: { name: 'Taiwan Dollar', symbol: 'NT$' },
  PLN: { name: 'Polish Zloty', symbol: 'zł' },
  THB: { name: 'Thai Baht', symbol: '฿' },
  IDR: { name: 'Indonesian Rupiah', symbol: 'Rp' },
  CZK: { name: 'Czech Koruna', symbol: 'Kč' },
  ILS: { name: 'Israeli Shekel', symbol: '₪' },
  CLP: { name: 'Chilean Peso', symbol: '$' },
  PHP: { name: 'Philippine Peso', symbol: '₱' },
  AED: { name: 'UAE Dirham', symbol: 'د.إ' },
  COP: { name: 'Colombian Peso', symbol: '$' },
  SAR: { name: 'Saudi Riyal', symbol: '﷼' },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM' },
  RON: { name: 'Romanian Leu', symbol: 'lei' },
  PEN: { name: 'Peruvian Sol', symbol: 'S/' },
  BGN: { name: 'Bulgarian Lev', symbol: 'лв' },
  HUF: { name: 'Hungarian Forint', symbol: 'Ft' },
  UAH: { name: 'Ukrainian Hryvnia', symbol: '₴' },
  HRK: { name: 'Croatian Kuna', symbol: 'kn' },
  DKK: { name: 'Danish Krone', symbol: 'kr' },
  ISK: { name: 'Icelandic Krona', symbol: 'kr' },
  EGP: { name: 'Egyptian Pound', symbol: '£' },
  QAR: { name: 'Qatari Riyal', symbol: '﷼' },
  VND: { name: 'Vietnamese Dong', symbol: '₫' },
  BDT: { name: 'Bangladeshi Taka', symbol: '৳' },
  PKR: { name: 'Pakistani Rupee', symbol: '₨' },
  LKR: { name: 'Sri Lankan Rupee', symbol: '₨' },
  NPR: { name: 'Nepalese Rupee', symbol: '₨' },
  AFN: { name: 'Afghan Afghani', symbol: '؋' },
  AMD: { name: 'Armenian Dram', symbol: '֏' },
  AZN: { name: 'Azerbaijani Manat', symbol: '₼' },
  BHD: { name: 'Bahraini Dinar', symbol: '.د.ب' },
  BYN: { name: 'Belarusian Ruble', symbol: 'Br' },
  BOB: { name: 'Bolivian Boliviano', symbol: '$b' },
  BAM: { name: 'Bosnia-Herzegovina Convertible Mark', symbol: 'KM' },
  BWP: { name: 'Botswanan Pula', symbol: 'P' },
  BND: { name: 'Brunei Dollar', symbol: '$' },
  KHR: { name: 'Cambodian Riel', symbol: '៛' },
  XAF: { name: 'CFA Franc BEAC', symbol: 'FCFA' },
  XOF: { name: 'CFA Franc BCEAO', symbol: 'CFA' },
  XPF: { name: 'CFP Franc', symbol: '₣' },
  CRC: { name: 'Costa Rican Colón', symbol: '₡' },
  CUP: { name: 'Cuban Peso', symbol: '₱' },
  DJF: { name: 'Djiboutian Franc', symbol: 'Fdj' },
  DOP: { name: 'Dominican Peso', symbol: 'RD$' },
  XCD: { name: 'East Caribbean Dollar', symbol: '$' },
  ERN: { name: 'Eritrean Nakfa', symbol: 'Nfk' },
  SZL: { name: 'Swazi Lilangeni', symbol: 'E' },
  ETB: { name: 'Ethiopian Birr', symbol: 'Br' },
  FJD: { name: 'Fijian Dollar', symbol: '$' },
  GMD: { name: 'Gambian Dalasi', symbol: 'D' },
  GEL: { name: 'Georgian Lari', symbol: '₾' },
  GHS: { name: 'Ghanaian Cedi', symbol: 'GH₵' },
  GTQ: { name: 'Guatemalan Quetzal', symbol: 'Q' },
  GNF: { name: 'Guinean Franc', symbol: 'FG' },
  GYD: { name: 'Guyanaese Dollar', symbol: '$' },
  HTG: { name: 'Haitian Gourde', symbol: 'G' },
  HNL: { name: 'Honduran Lempira', symbol: 'L' },
  JMD: { name: 'Jamaican Dollar', symbol: 'J$' },
  JOD: { name: 'Jordanian Dinar', symbol: 'JD' },
  KZT: { name: 'Kazakhstani Tenge', symbol: '₸' },
  KES: { name: 'Kenyan Shilling', symbol: 'KSh' },
  KWD: { name: 'Kuwaiti Dinar', symbol: 'KD' },
  KGS: { name: 'Kyrgystani Som', symbol: 'лв' },
  LAK: { name: 'Laotian Kip', symbol: '₭' },
  LBP: { name: 'Lebanese Pound', symbol: '£' },
  LSL: { name: 'Lesotho Loti', symbol: 'M' },
  LRD: { name: 'Liberian Dollar', symbol: '$' },
  LYD: { name: 'Libyan Dinar', symbol: 'LD' },
  MOP: { name: 'Macanese Pataca', symbol: 'MOP$' },
  MKD: { name: 'Macedonian Denar', symbol: 'ден' },
  MGA: { name: 'Malagasy Ariary', symbol: 'Ar' },
  MWK: { name: 'Malawian Kwacha', symbol: 'MK' },
  MVR: { name: 'Maldivian Rufiyaa', symbol: 'Rf' },
  MRU: { name: 'Mauritanian Ouguiya', symbol: 'UM' },
  MUR: { name: 'Mauritian Rupee', symbol: '₨' },
  MDL: { name: 'Moldovan Leu', symbol: 'lei' },
  MNT: { name: 'Mongolian Tugrik', symbol: '₮' },
  MAD: { name: 'Moroccan Dirham', symbol: 'MAD' },
  MZN: { name: 'Mozambican Metical', symbol: 'MT' },
  MMK: { name: 'Myanmar Kyat', symbol: 'K' },
  NAD: { name: 'Namibian Dollar', symbol: '$' },
  NIO: { name: 'Nicaraguan Córdoba', symbol: 'C$' },
  NGN: { name: 'Nigerian Naira', symbol: '₦' },
  OMR: { name: 'Omani Rial', symbol: '﷼' },
  PAB: { name: 'Panamanian Balboa', symbol: 'B/.' },
  PGK: { name: 'Papua New Guinean Kina', symbol: 'K' },
  PYG: { name: 'Paraguayan Guarani', symbol: 'Gs' },
  RSD: { name: 'Serbian Dinar', symbol: 'Дин.' },
  SCR: { name: 'Seychellois Rupee', symbol: '₨' },
  SLL: { name: 'Sierra Leonean Leone', symbol: 'Le' },
  SOS: { name: 'Somali Shilling', symbol: 'S' },
  STN: { name: 'São Tomé and Príncipe Dobra', symbol: 'Db' },
  SRD: { name: 'Surinamese Dollar', symbol: '$' },
  SYP: { name: 'Syrian Pound', symbol: '£' },
  TJS: { name: 'Tajikistani Somoni', symbol: 'SM' },
  TZS: { name: 'Tanzanian Shilling', symbol: 'TSh' },
  TOP: { name: 'Tongan Paʻanga', symbol: 'T$' },
  TTD: { name: 'Trinidad and Tobago Dollar', symbol: 'TT$' },
  TND: { name: 'Tunisian Dinar', symbol: 'TND' },
  TMT: { name: 'Turkmenistani Manat', symbol: 'T' },
  UGX: { name: 'Ugandan Shilling', symbol: 'USh' },
  UYU: { name: 'Uruguayan Peso', symbol: '$U' },
  UZS: { name: 'Uzbekistan Som', symbol: 'лв' },
  VUV: { name: 'Vanuatu Vatu', symbol: 'VT' },
  VES: { name: 'Venezuelan Bolívar', symbol: 'Bs' },
  WST: { name: 'Samoan Tala', symbol: 'WS$' },
  YER: { name: 'Yemeni Rial', symbol: '﷼' },
  ZMW: { name: 'Zambian Kwacha', symbol: 'ZK' },
  ZWL: { name: 'Zimbabwean Dollar', symbol: 'Z$' }
};

// Common currencies to show at the top of selection lists
const POPULAR_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD', 'NZD', 'SEK',
  'KRW', 'SGD', 'NOK', 'MXN', 'INR', 'RUB', 'ZAR', 'TRY', 'BRL', 'TWD'
];

// Custom hook for fetching exchange rates - now uses free Frankfurter API (no key needed)
const useExchangeRates = (baseCurrency: string = 'USD', autoRefresh: boolean = false, refreshInterval: number = 60) => {
  const [rates, setRates] = React.useState<{[key: string]: number}>({});
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  // More robust fetchRates function with better error handling and debugging
  const fetchRates = React.useCallback(async () => {
    // Clear previous errors when starting a new fetch
    setError(null);
    setLoading(true);

    try {
      // Use our server-side proxy for currency rates (no API key needed)
      const url = `/api/currency?base=${baseCurrency}`;

      const response = await fetch(url);

      // Check if the response is OK
      if (!response.ok) {
        if (response.status === 429) {
          setError('Rate limit exceeded. Please try again later.');
        } else {
          setError(`API error: ${response.status} ${response.statusText}`);
        }
        setLoading(false);
        return;
      }

      const data = await response.json();

      // Check if we have rates in the response
      if (!data.rates) {
        setError('Invalid response from API. Please try again.');
        setLoading(false);
        return;
      }
      setRates(data.rates);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      setError('Failed to fetch rates. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [baseCurrency]);

  // Initial fetch when base currency changes
  React.useEffect(() => {
    fetchRates();
  }, [baseCurrency, fetchRates]);

  // Auto-refresh
  React.useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      fetchRates();
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchRates]);

  return {
    rates,
    loading,
    error,
    lastUpdated,
    refetch: fetchRates
  };
};

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
 * Currency Converter Widget Component
 *
 * A widget that allows users to convert between currencies using Open Exchange Rates API.
 *
 * @param {CurrencyConverterWidgetProps} props - Component props
 * @returns {JSX.Element} Widget component
 */
const CurrencyConverterWidget: React.FC<CurrencyConverterWidgetProps> = ({ width, height, config = {} }) => {
  // --- Size-tier detection ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [amount, setAmount] = React.useState('1');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('general');
  const [showSettings, setShowSettings] = React.useState(false);

  const mergedConfig = React.useMemo<CurrencyConverterWidgetConfig>(() => ({
    title: 'Currency Converter',
    baseCurrency: 'USD',
    targetCurrencies: ['EUR', 'GBP', 'JPY'],
    autoRefresh: false,
    refreshInterval: 60,
    ...config
  }), [config]);

  const [localConfig, setLocalConfig] = React.useState<CurrencyConverterWidgetConfig>(mergedConfig);

  // Keep local config in sync when props change
  React.useEffect(() => {
    setLocalConfig(mergedConfig);
  }, [mergedConfig]);

  // Use exchange rates hook - no API key needed anymore
  const { rates, loading, error, refetch } = useExchangeRates(
    localConfig.baseCurrency,
    localConfig.autoRefresh,
    localConfig.refreshInterval
  );

  // Handle amount input change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    setAmount(value);
  };

  // Reset local config draft back to persisted values
  const resetSettingsDraft = React.useCallback(() => {
    setLocalConfig(mergedConfig);
    setActiveTab('general');
    setSearchQuery('');
  }, [mergedConfig]);

  // Handle dialog open/close -- reset draft when closing
  const handleSettingsOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      resetSettingsDraft();
    }
    setShowSettings(nextOpen);
  }, [resetSettingsDraft]);

  // Cancel button handler
  const handleCancelSettings = React.useCallback(() => {
    resetSettingsDraft();
    setShowSettings(false);
  }, [resetSettingsDraft]);

  // Save settings
  const saveSettings = React.useCallback(() => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }

    setShowSettings(false);
    // Refetch with new settings
    setTimeout(() => {
      refetch();
    }, 500);
  }, [config, localConfig, refetch]);

  // Handle widget deletion
  const handleDelete = React.useCallback(() => {
    if (config?.onDelete) {
      config.onDelete();
    }
    setShowSettings(false);
  }, [config]);

  // Render settings dialog
  const renderSettings = () => (
    <WidgetSettingsDialog
      open={showSettings}
      onOpenChange={handleSettingsOpenChange}
      title="Currency Converter Settings"
      bodyClassName="flex flex-col gap-4 px-1"
      footer={(
        <WidgetSettingsDialogFooter
          onDelete={config?.onDelete ? handleDelete : undefined}
          onCancel={handleCancelSettings}
          onSave={saveSettings}
        />
      )}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="pt-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title-input">Widget Title</Label>
              <Input
                id="title-input"
                value={localConfig.title || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalConfig(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="base-currency-select">Base Currency</Label>
              <Select
                value={localConfig.baseCurrency || 'USD'}
                onValueChange={(value: string) => setLocalConfig(prev => ({ ...prev, baseCurrency: value }))}
              >
                <SelectTrigger id="base-currency-select" className="w-full">
                  <SelectValue placeholder="Select base currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {POPULAR_CURRENCIES.map(code => (
                      <SelectItem key={code} value={code}>
                        {code} - {CURRENCIES[code as keyof typeof CURRENCIES]?.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="currencies" className="pt-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <Label>Target Currencies</Label>
              <span className="text-sm text-muted-foreground">
                {localConfig.targetCurrencies?.length || 0} selected
              </span>
            </div>

            <Input
              type="text"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder="Search currencies..."
            />

            <div className="h-36 overflow-y-auto rounded-2xl border border-border/60 p-2">
              <div className="grid grid-cols-2 gap-2">
                {POPULAR_CURRENCIES.map(code => (
                  <div key={code} className="flex items-center gap-2">
                    <Checkbox
                      id={`currency-${code}`}
                      checked={localConfig.targetCurrencies?.includes(code) || false}
                      onCheckedChange={(checked) => {
                        const currentTargets = localConfig.targetCurrencies || [];
                        const isChecked = checked === true;

                        setLocalConfig(prev => ({
                          ...prev,
                          targetCurrencies: isChecked
                            ? [...currentTargets, code]
                            : currentTargets.filter(c => c !== code)
                        }));
                      }}
                    />
                    <Label htmlFor={`currency-${code}`} className="text-sm">
                      {code}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="pt-4">
          <div className="flex flex-col gap-4">
            <Alert>
              <BadgeCent />
              <AlertTitle>No API Key Required</AlertTitle>
              <AlertDescription>
                Currency rates are provided automatically. Just select your currencies above.
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-3">
              <Switch
                id="auto-refresh"
                checked={localConfig.autoRefresh || false}
                onCheckedChange={(checked: boolean) => setLocalConfig(prev => ({ ...prev, autoRefresh: checked }))}
              />
              <Label htmlFor="auto-refresh">Auto Refresh</Label>
            </div>

            {localConfig.autoRefresh && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="refresh-interval-input">Refresh Interval (minutes)</Label>
                <Input
                  id="refresh-interval-input"
                  type="number"
                  min="1"
                  max="1440"
                  value={localConfig.refreshInterval || 60}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalConfig(prev => ({
                    ...prev,
                    refreshInterval: parseInt(e.target.value) || 60
                  }))}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </WidgetSettingsDialog>
  );

  /**
   * Determines the appropriate size category based on width and height
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

  // --- 1x1 Icon view ---
  const renderTinyView = () => {
    const primaryCurrency = localConfig.targetCurrencies?.[0];
    const rate = primaryCurrency ? (rates[primaryCurrency] || 0) : 0;
    const baseSymbol = CURRENCIES[localConfig.baseCurrency as keyof typeof CURRENCIES]?.symbol || localConfig.baseCurrency;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
        <span className="text-lg font-semibold leading-none text-foreground">
          {baseSymbol}{rate ? rate.toFixed(2) : '--'}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {primaryCurrency || localConfig.baseCurrency}
        </span>
      </div>
    );
  };

  // --- Nx1 Ribbon view ---
  const renderRibbonView = () => {
    const currencies = (localConfig.targetCurrencies || []).slice(0, Math.min(3, Math.max(2, width)));
    const numericAmount = parseFloat(amount) || 0;

    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1 text-xs">
        <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 font-medium text-foreground dark:bg-white/[0.06]">
          {CURRENCIES[localConfig.baseCurrency as keyof typeof CURRENCIES]?.symbol || ''}{numericAmount || 1} {localConfig.baseCurrency}
        </span>
        {currencies.map(currency => {
          const rate = rates[currency] || 0;
          const value = (numericAmount * rate).toFixed(2);
          return (
            <span
              key={currency}
              className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 tabular-nums text-foreground dark:bg-white/[0.06]"
            >
              {CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol}{value} {currency}
            </span>
          );
        })}
      </div>
    );
  };

  // --- 6x6+ App view ---
  const renderAppView = () => {
    const currencies = localConfig.targetCurrencies || [];
    const numericAmount = parseFloat(amount) || 0;
    // For the conversion matrix, show a subset
    const matrixCurrencies = [localConfig.baseCurrency || 'USD', ...currencies.slice(0, 5)];

    return (
      <div className="flex h-full flex-col gap-3 p-3 overflow-y-auto">
        {/* Drag handle header */}
        <div className="flex items-center widget-drag-handle cursor-move">
          <h2 className="text-base font-semibold text-foreground">{localConfig.title || 'Currency Converter'}</h2>
        </div>
        {/* Amount input + base currency selector */}
        <div className="flex gap-2">
          <div className="flex flex-1 border rounded-md overflow-hidden">
            <Input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              className="flex-grow border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label={`Amount in ${localConfig.baseCurrency}`}
            />
          </div>
          <Select
            value={localConfig.baseCurrency || 'USD'}
            onValueChange={(value: string) => {
              setLocalConfig(prev => ({ ...prev, baseCurrency: value }));
              if (config?.onUpdate) {
                config.onUpdate({ ...localConfig, baseCurrency: value });
              }
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
              {POPULAR_CURRENCIES.map(code => (
                <SelectItem key={code} value={code}>
                  {CURRENCIES[code as keyof typeof CURRENCIES]?.symbol} {code}
                </SelectItem>
              ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Currency rate grid */}
        <div className="grid grid-cols-3 gap-2">
          {currencies.map(currency => {
            const rate = rates[currency] || 0;
            const value = (numericAmount * rate).toFixed(2);
            return (
              <div key={currency} className="flex flex-col items-center justify-center bg-card text-card-foreground rounded-md p-3 border shadow-sm">
                <span className="text-xl font-semibold tabular-nums">
                  {CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol}{value}
                </span>
                <span className="text-xs font-medium text-muted-foreground">{currency}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  1 {localConfig.baseCurrency} = {rate.toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Conversion matrix table */}
        {currencies.length > 0 && (
          <div className="mt-1">
            <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Conversion Matrix</h4>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="p-1.5 text-left font-medium text-muted-foreground">From / To</th>
                    {matrixCurrencies.map(code => (
                      <th key={code} className="p-1.5 text-right font-medium text-muted-foreground">{code}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixCurrencies.map(fromCurrency => {
                    const fromRate = fromCurrency === (localConfig.baseCurrency || 'USD') ? 1 : (rates[fromCurrency] ?? 0);
                    return (
                      <tr key={fromCurrency} className="border-t">
                        <td className="p-1.5 font-medium">{fromCurrency}</td>
                        {matrixCurrencies.map(toCurrency => {
                          const toRate = toCurrency === (localConfig.baseCurrency || 'USD') ? 1 : (rates[toCurrency] ?? 0);
                          const crossRate = fromCurrency === toCurrency ? 1 : (fromRate === 0 || toRate === 0) ? 0 : toRate / fromRate;
                          return (
                            <td key={toCurrency} className="p-1.5 text-right tabular-nums text-muted-foreground">
                              {crossRate === 0 && fromCurrency !== toCurrency ? '--' : crossRate.toFixed(4)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render content based on widget size -- isTiny -> isShort -> isApp -> existing size category
  const renderContent = () => {
    if (isTiny) return renderTinyView();
    if (isShort) return renderRibbonView();
    if (isApp) return renderAppView();

    const sizeCategory = getWidgetSizeCategory(width, height);

    switch (sizeCategory) {
      case WidgetSizeCategory.LARGE:
        return renderLargeView();
      case WidgetSizeCategory.WIDE_MEDIUM:
        return renderWideMediumView();
      case WidgetSizeCategory.TALL_MEDIUM:
        return renderTallMediumView();
      case WidgetSizeCategory.MEDIUM:
        return renderMediumView();
      case WidgetSizeCategory.WIDE_SMALL:
        return renderWideSmallView();
      case WidgetSizeCategory.TALL_SMALL:
        return renderTallSmallView();
      case WidgetSizeCategory.SMALL:
      default:
        return renderSmallView();
    }
  };

  // Small View (2x2) - Most critical information only
  const renderSmallView = () => {
    if (!rates || !localConfig.targetCurrencies || localConfig.targetCurrencies.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <span className="block text-2xl font-semibold">-</span>
            <span className="text-xs text-muted-foreground">No currencies selected</span>
          </div>
        </div>
      );
    }

    const primaryCurrency = localConfig.targetCurrencies[0];
    const rate = rates[primaryCurrency] || 0;
    const numericAmount = parseFloat(amount) || 0;
    const value = (numericAmount * rate).toFixed(2);

    return (
      <div className="flex items-center justify-center h-full p-2">
        <div className="text-center">
          <span className="block text-2xl font-semibold">
            {CURRENCIES[primaryCurrency as keyof typeof CURRENCIES]?.symbol}
            {value}
          </span>
          <span className="text-xs text-muted-foreground">{primaryCurrency}</span>
        </div>
      </div>
    );
  };

  // Wide Small View (3x2)
  const renderWideSmallView = () => {
    if (!rates || !localConfig.targetCurrencies || localConfig.targetCurrencies.length === 0) {
      return renderSmallView();
    }

    const currencies = localConfig.targetCurrencies.slice(0, 2);
    const numericAmount = parseFloat(amount) || 0;

    return (
      <div className="flex justify-around items-center h-full p-2">
        {currencies.map(currency => {
          const rate = rates[currency] || 0;
          const value = (numericAmount * rate).toFixed(2);
          return (
            <div key={currency} className="text-center">
              <span className="block text-2xl font-semibold">
                {CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol}
                {value}
              </span>
              <span className="text-xs text-muted-foreground">{currency}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Tall Small View (2x3)
  const renderTallSmallView = () => {
    if (!rates || !localConfig.targetCurrencies || localConfig.targetCurrencies.length === 0) {
      return renderSmallView();
    }

    const currencies = localConfig.targetCurrencies.slice(0, 2);
    const numericAmount = parseFloat(amount) || 0;

    return (
      <div className="flex flex-col justify-around items-center h-full p-2">
        {currencies.map(currency => {
          const rate = rates[currency] || 0;
          const value = (numericAmount * rate).toFixed(2);
          return (
            <div key={currency} className="text-center">
              <span className="block text-2xl font-semibold">
                {CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol}
                {value}
              </span>
              <span className="text-xs text-muted-foreground">{currency}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Medium View (3x3)
  const renderMediumView = () => {
    if (!rates || !localConfig.targetCurrencies || localConfig.targetCurrencies.length === 0) {
      return renderSmallView();
    }

    const currencies = localConfig.targetCurrencies.slice(0, 4);
    const numericAmount = parseFloat(amount) || 0;

    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full p-2">
        {currencies.map(currency => {
          const rate = rates[currency] || 0;
          const value = (numericAmount * rate).toFixed(2);
          return (
            <div key={currency} className="flex flex-col items-center justify-center bg-card text-card-foreground rounded-md p-3 border shadow-sm">
              <span className="text-2xl font-semibold">
                {CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol}
                {value}
              </span>
              <span className="text-xs text-muted-foreground">{currency}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Wide Medium View (4x3)
  const renderWideMediumView = () => {
    if (!rates || !localConfig.targetCurrencies || localConfig.targetCurrencies.length === 0) {
      return renderMediumView();
    }

    const currencies = localConfig.targetCurrencies.slice(0, 6);
    const numericAmount = parseFloat(amount) || 0;

    return (
      <div className="grid grid-cols-3 grid-rows-2 gap-2 h-full p-2">
        {currencies.map(currency => {
          const rate = rates[currency] || 0;
          const value = (numericAmount * rate).toFixed(2);
          return (
            <div key={currency} className="flex flex-col items-center justify-center bg-card text-card-foreground rounded-md p-3 border shadow-sm">
              <span className="text-2xl font-semibold">
                {CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol}
                {value}
              </span>
              <span className="text-xs text-muted-foreground">{currency}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Tall Medium View (3x4)
  const renderTallMediumView = () => {
    if (!rates || !localConfig.targetCurrencies || localConfig.targetCurrencies.length === 0) {
      return renderMediumView();
    }

    const currencies = localConfig.targetCurrencies.slice(0, 6);
    const numericAmount = parseFloat(amount) || 0;

    return (
      <div className="grid grid-cols-2 grid-rows-3 gap-2 h-full p-2">
        {currencies.map(currency => {
          const rate = rates[currency] || 0;
          const value = (numericAmount * rate).toFixed(2);
          return (
            <div key={currency} className="flex flex-col items-center justify-center bg-card text-card-foreground rounded-md p-3 border shadow-sm">
              <span className="text-2xl font-semibold">
                {CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol}
                {value}
              </span>
              <span className="text-xs text-muted-foreground">{currency}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Large View (4x4)
  const renderLargeView = () => {
    if (!rates || !localConfig.targetCurrencies || localConfig.targetCurrencies.length === 0) {
      return renderMediumView();
    }

    const currencies = localConfig.targetCurrencies.slice(0, 8);
    const numericAmount = parseFloat(amount) || 0;

    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-3 h-full p-3">
        {/* Input section */}
        <div className="col-span-3 flex border rounded-md overflow-hidden">
          <Input
            type="text"
            value={amount}
            onChange={handleAmountChange}
            className="flex-grow border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label={`Amount in ${localConfig.baseCurrency}`}
          />
          <div className="flex items-center px-3 text-sm text-muted-foreground bg-muted">
            {localConfig.baseCurrency}
          </div>
        </div>

        {/* Currency cards */}
        {currencies.map(currency => {
          const rate = rates[currency] || 0;
          const value = (numericAmount * rate).toFixed(2);
          return (
            <div key={currency} className="flex flex-col items-center justify-center bg-card text-card-foreground rounded-md p-3 border shadow-sm">
              <span className="text-2xl font-semibold">
                {CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol}
                {value}
              </span>
              <span className="text-xs text-muted-foreground">{currency}</span>
              <span className="text-xs text-muted-foreground mt-1">1 {localConfig.baseCurrency} = {rate.toFixed(4)} {currency}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Main render
  return (
    <div className={`widget-container h-full flex flex-col ${isTiny ? 'widget-drag-handle' : ''}`}>
      {!isTiny && !isApp && (
        <WidgetHeader
          title={localConfig.title || 'Currency Converter'}
          onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
          compact={isShort}
        />
      )}

      <div className={`flex-grow overflow-hidden ${isTiny ? 'p-2' : isShort ? 'p-1.5' : ''}`}>
        {error ? (
          // Error view - compact for tiny
          isTiny ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <AlertCircle size={16} className="text-red-500" strokeWidth={1.5} />
              <span className="text-[10px] text-red-500">Error</span>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <AlertCircle size={40} className="text-red-500 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-red-500 dark:text-red-400 mb-3">
                {error}
              </p>
              <Button
                size="sm"
                onClick={refetch}
              >
                Retry
              </Button>
            </div>
          )
        ) : loading ? (
          isTiny ? (
            <div className="flex h-full items-center justify-center">
              <div className="animate-spin h-4 w-4 rounded-full border-2 border-primary border-t-transparent"></div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent"></div>
            </div>
          )
        ) : (
          renderContent()
        )}
      </div>

      {/* Settings dialog */}
      {!readOnly && renderSettings()}
    </div>
  );
};

export default CurrencyConverterWidget;
