import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Download, Copy, Check, Plus, Trash2, Settings, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import WidgetHeader from '../common/WidgetHeader';
import type { QRCodeWidgetConfig, QRCodeWidgetProps, QRCodeHistoryItem } from './types';
import { cn } from '@/lib/utils';

const defaultConfig: QRCodeWidgetConfig = {
  title: 'QR Code',
  content: '',
  fgColor: '#000000',
  bgColor: '#ffffff',
  errorLevel: 'M',
  history: [],
};

const PRESET_TEMPLATES = [
  { label: 'URL', prefix: 'https://', placeholder: 'example.com' },
  { label: 'Phone', prefix: 'tel:', placeholder: '+1234567890' },
  { label: 'Email', prefix: 'mailto:', placeholder: 'email@example.com' },
  { label: 'WiFi', prefix: 'WIFI:T:WPA;S:', placeholder: 'NetworkName;P:Password;;' },
  { label: 'SMS', prefix: 'sms:', placeholder: '+1234567890?body=Hello' },
];

const COMPACT_QR_SIZES = {
  constrainedSide1: 80,
  constrainedSide2: 108,
  constrainedSide3: 124,
  constrainedSide4Plus: 136,
} as const;

const getCompactQrSize = (width: number, height: number) => {
  const constrainedSide = Math.min(width, height);

  if (constrainedSide <= 1) return COMPACT_QR_SIZES.constrainedSide1;
  if (constrainedSide === 2) return COMPACT_QR_SIZES.constrainedSide2;
  if (constrainedSide === 3) return COMPACT_QR_SIZES.constrainedSide3;
  return COMPACT_QR_SIZES.constrainedSide4Plus;
};

const QRCodeWidget: React.FC<QRCodeWidgetProps> = ({ width, height, config }) => {
  // --- Size detection (icon -> widget -> app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isWide = width >= 4;
  const isTall = height >= 4;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [configSnapshot, setConfigSnapshot] = useState<QRCodeWidgetConfig | null>(null);
  const [localConfig, setLocalConfig] = useState<QRCodeWidgetConfig>({
    ...defaultConfig,
    ...config,
  });
  const [copied, setCopied] = useState(false);
  const [appInput, setAppInput] = useState('');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const appQrRef = useRef<HTMLDivElement>(null);

  // Sync with external config changes
  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Persist config changes
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setConfigSnapshot(null);
    setShowSettings(false);
  };

  // Cancel settings - revert to snapshot
  const cancelSettings = () => {
    if (configSnapshot) {
      setLocalConfig(configSnapshot);
    }
    setConfigSnapshot(null);
    setShowSettings(false);
  };

  // Open settings with snapshot
  const openSettings = () => {
    setConfigSnapshot({ ...localConfig });
    setShowSettings(true);
  };

  // Helper for updating config AND persisting immediately (for non-modal changes)
  const updateConfig = useCallback((updates: Partial<QRCodeWidgetConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    if (config?.onUpdate) {
      config.onUpdate(newConfig);
    }
  }, [localConfig, config]);

  // Add to history
  const addToHistory = useCallback((content: string) => {
    if (!content.trim()) return;
    const existing = (localConfig.history || []).find(h => h.content === content);
    if (existing) return;
    const item: QRCodeHistoryItem = {
      id: Date.now().toString(36),
      content,
      createdAt: new Date().toISOString(),
    };
    const newHistory = [item, ...(localConfig.history || [])].slice(0, 20);
    updateConfig({ history: newHistory });
  }, [localConfig.history, updateConfig]);

  // Remove from history
  const removeFromHistory = useCallback((id: string) => {
    const newHistory = (localConfig.history || []).filter(h => h.id !== id);
    updateConfig({ history: newHistory });
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null);
    }
  }, [localConfig.history, updateConfig, selectedHistoryId]);

  // Download QR code as PNG
  const handleDownload = useCallback((ref?: React.RefObject<HTMLDivElement | null>) => {
    const target = ref?.current || qrRef.current;
    if (!target) return;

    const svg = target.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      if (ctx) {
        ctx.fillStyle = localConfig.bgColor || '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = 'qrcode.png';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [localConfig.bgColor]);

  // Copy content to clipboard
  const handleCopy = useCallback(async (text?: string) => {
    const content = text || localConfig.content;
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [localConfig.content]);

  // Calculate QR code size based on widget dimensions
  const getQRSize = useCallback(() => {
    const baseSize = Math.min(width, height);
    if (baseSize <= 2) return 80;
    if (baseSize <= 3) return 120;
    if (baseSize <= 5) return 160;
    return 200;
  }, [width, height]);

  // --- Setup prompt when no content ---
  const renderSetup = (compactLayout = false) => (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center text-muted-foreground',
        compactLayout ? 'gap-1.5 px-2 text-center' : 'gap-2'
      )}
    >
      <Settings className={cn(compactLayout ? 'h-5 w-5' : 'h-8 w-8')} />
      <p
        className={cn(
          'text-center',
          compactLayout ? 'max-w-[10rem] text-xs leading-tight' : 'text-sm'
        )}
      >
        Configure this widget to get started
      </p>
      {!readOnly && (
        <Button
          variant="outline"
          size="sm"
          onClick={openSettings}
          className={cn(compactLayout && 'h-7 px-2 text-xs')}
        >
          Open Settings
        </Button>
      )}
    </div>
  );

  // --- Size-specific renderers (icon -> widget -> app) ---

  const renderTiny = () => {
    // 1x1 ICON: show a small QR code or icon
    if (!localConfig.content) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <QrCode className="h-5 w-5 text-muted-foreground" />
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center p-1">
        <div className="bg-white rounded p-0.5">
          <QRCodeSVG
            value={localConfig.content}
            size={32}
            level="L"
            fgColor={localConfig.fgColor || '#000000'}
            bgColor="#ffffff"
            includeMargin={false}
          />
        </div>
      </div>
    );
  };

  const renderShort = () => {
    // Nx1 RIBBON: mini QR + truncated content text
    if (!localConfig.content) {
      return (
        <div className="flex-1 flex items-center gap-2 px-1">
          <QrCode className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">No content</span>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center gap-2 px-1 overflow-hidden">
        <div className="bg-white rounded p-0.5 shrink-0">
          <QRCodeSVG
            value={localConfig.content}
            size={24}
            level="L"
            fgColor={localConfig.fgColor || '#000000'}
            bgColor="#ffffff"
            includeMargin={false}
          />
        </div>
        <span className="text-[10px] text-muted-foreground truncate min-w-0">
          {localConfig.content}
        </span>
        {width >= 3 && !readOnly && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCopy()}
            className="h-6 w-6 shrink-0"
            title="Copy content"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          </Button>
        )}
      </div>
    );
  };

  const renderCompact = () => {
    // 2x2 MICRO-WIDGET: QR code centered, no actions
    if (!localConfig.content) return renderSetup(true);

    const qrSize = getCompactQrSize(width, height);

    return (
      <div className="flex-1 flex items-center justify-center overflow-hidden px-1 pb-1">
        <div ref={qrRef} className="bg-white p-2 rounded-lg shadow-sm">
          <QRCodeSVG
            value={localConfig.content}
            size={qrSize}
            level={localConfig.errorLevel || 'M'}
            fgColor={localConfig.fgColor || '#000000'}
            bgColor={localConfig.bgColor || '#ffffff'}
            includeMargin={false}
          />
        </div>
      </div>
    );
  };

  const renderDefault = () => {
    // 3x3 WIDGET: QR code + action buttons + truncated content
    if (!localConfig.content) return renderSetup();

    const qrSize = getQRSize();

    return (
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
        <div ref={qrRef} className="bg-white p-2 rounded-lg">
          <QRCodeSVG
            value={localConfig.content}
            size={qrSize}
            level={localConfig.errorLevel || 'M'}
            fgColor={localConfig.fgColor || '#000000'}
            bgColor={localConfig.bgColor || '#ffffff'}
            includeMargin={false}
          />
        </div>

        <div className="mt-2 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDownload()}
            className="h-7 w-7"
            title="Download PNG"
          >
            <Download size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCopy()}
            className="h-7 w-7"
            title="Copy content"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </Button>
        </div>

        {localConfig.content.length <= 60 && (
          <div className="mt-1.5 text-xs text-muted-foreground text-center truncate max-w-full px-2">
            {localConfig.content}
          </div>
        )}
      </div>
    );
  };

  const renderPanel = () => {
    // 4x4-5x5 PANEL: QR code + info sidebar
    if (!localConfig.content) return renderSetup();

    const qrSize = getQRSize();
    const history = localConfig.history || [];

    return (
      <div className="flex flex-1 overflow-hidden">
        {/* QR display */}
        <div className="flex-1 flex flex-col items-center justify-center p-2">
          <div ref={qrRef} className="bg-white p-3 rounded-lg">
            <QRCodeSVG
              value={localConfig.content}
              size={qrSize}
              level={localConfig.errorLevel || 'M'}
              fgColor={localConfig.fgColor || '#000000'}
              bgColor={localConfig.bgColor || '#ffffff'}
              includeMargin={false}
            />
          </div>

          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleDownload()}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleCopy()}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              Copy
            </Button>
          </div>

          <div className="mt-2 text-xs text-muted-foreground text-center break-all max-w-full px-2 line-clamp-2">
            {localConfig.content}
          </div>
        </div>

        {/* Info sidebar */}
        <div className="w-2/5 border-l overflow-y-auto p-2">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Error Level</p>
              <p className="text-xs">{localConfig.errorLevel || 'M'} ({
                { L: '~7%', M: '~15%', Q: '~25%', H: '~30%' }[localConfig.errorLevel || 'M']
              } recovery)</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Content Length</p>
              <p className="text-xs">{localConfig.content.length} characters</p>
            </div>
            {history.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Recent
                </p>
                <div className="space-y-1">
                  {history.slice(0, 5).map(item => (
                    <button
                      key={item.id}
                      className="w-full text-left text-xs text-muted-foreground hover:text-foreground truncate block py-0.5 hover:bg-accent rounded px-1 transition-colors"
                      onClick={() => {
                        if (!readOnly) {
                          updateConfig({ content: item.content });
                        }
                      }}
                      title={item.content}
                    >
                      {item.label || item.content}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderApp = () => {
    // 6x6+ APP: full QR generator with input, history, presets, color customization
    const history = localConfig.history || [];
    const selectedItem = history.find(h => h.id === selectedHistoryId);
    const displayContent = selectedItem?.content || localConfig.content || '';

    return (
      <div className="flex h-full">
        {/* Left panel: history + presets */}
        <div className="w-1/3 border-r flex flex-col overflow-hidden">
          <div className="p-2 border-b widget-drag-handle cursor-move">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Quick Templates</p>
            <div className="flex flex-wrap gap-1">
              {PRESET_TEMPLATES.map(preset => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="text-[10px] px-2 py-1 h-auto rounded-full"
                  onClick={() => {
                    if (!readOnly) {
                      setAppInput(preset.prefix + preset.placeholder);
                    }
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-2 py-1.5 border-b">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Clock className="h-3 w-3" />
              History
            </p>
            <span className="text-[10px] text-muted-foreground">{history.length} items</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <QrCode className="h-6 w-6 mb-2 opacity-50" />
                <p className="text-xs text-center">Generated QR codes will appear here</p>
              </div>
            ) : (
              history.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-accent border-b transition-colors ${
                    selectedHistoryId === item.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => setSelectedHistoryId(item.id)}
                >
                  <div className="bg-white rounded p-0.5 shrink-0">
                    <QRCodeSVG
                      value={item.content}
                      size={24}
                      level="L"
                      fgColor={localConfig.fgColor || '#000000'}
                      bgColor="#ffffff"
                      includeMargin={false}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate">{item.label || item.content}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromHistory(item.id);
                      }}
                      title="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right panel: QR display + input */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Input bar */}
          {!readOnly && (
            <div className="p-3 border-b">
              <div className="flex gap-2">
                <Input
                  value={appInput}
                  onChange={(e) => setAppInput(e.target.value)}
                  placeholder="Enter URL, text, or select a template..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && appInput.trim()) {
                      updateConfig({ content: appInput.trim() });
                      addToHistory(appInput.trim());
                      setSelectedHistoryId(null);
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (appInput.trim()) {
                      updateConfig({ content: appInput.trim() });
                      addToHistory(appInput.trim());
                      setSelectedHistoryId(null);
                    }
                  }}
                  disabled={!appInput.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Generate
                </Button>
              </div>
            </div>
          )}

          {/* QR Code display */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto">
            {displayContent ? (
              <>
                <div ref={appQrRef} className="bg-white p-4 rounded-xl shadow-sm">
                  <QRCodeSVG
                    value={displayContent}
                    size={200}
                    level={localConfig.errorLevel || 'M'}
                    fgColor={localConfig.fgColor || '#000000'}
                    bgColor={localConfig.bgColor || '#ffffff'}
                    includeMargin={false}
                  />
                </div>

                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(appQrRef)}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Download PNG
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleCopy(displayContent)}>
                    {copied ? <Check className="h-4 w-4 mr-1.5 text-green-500" /> : <Copy className="h-4 w-4 mr-1.5" />}
                    Copy Text
                  </Button>
                </div>

                <div className="mt-3 text-sm text-muted-foreground text-center break-all max-w-md px-4 line-clamp-3">
                  {displayContent}
                </div>

                {/* Color & options bar */}
                {!readOnly && (
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="app-fg" className="cursor-pointer">Color:</label>
                      <input
                        id="app-fg"
                        type="color"
                        value={localConfig.fgColor || '#000000'}
                        onChange={(e) => updateConfig({ fgColor: e.target.value })}
                        className="w-6 h-6 rounded border cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="app-bg" className="cursor-pointer">Background:</label>
                      <input
                        id="app-bg"
                        type="color"
                        value={localConfig.bgColor || '#ffffff'}
                        onChange={(e) => updateConfig({ bgColor: e.target.value })}
                        className="w-6 h-6 rounded border cursor-pointer"
                      />
                    </div>
                    <Select
                      value={localConfig.errorLevel || 'M'}
                      onValueChange={(value) => updateConfig({ errorLevel: value as 'L' | 'M' | 'Q' | 'H' })}
                    >
                      <SelectTrigger className="h-7 w-[100px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Low (~7%)</SelectItem>
                        <SelectItem value="M">Medium (~15%)</SelectItem>
                        <SelectItem value="Q">Quartile (~25%)</SelectItem>
                        <SelectItem value="H">High (~30%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <QrCode className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-sm">Enter text or a URL above to generate a QR code</p>
                <p className="text-xs mt-1">Or select a template to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- Settings modal ---
  const renderSettingsModal = () => (
    <Dialog
      open={showSettings}
      onOpenChange={(open) => {
        if (!open) cancelSettings();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{localConfig.title || 'QR Code'} Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="display">Display</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <div>
              <Label htmlFor="settings-title">Widget Title</Label>
              <Input
                id="settings-title"
                value={localConfig.title || ''}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="settings-content">Content (URL or text)</Label>
              <textarea
                id="settings-content"
                placeholder="https://example.com or any text"
                value={localConfig.content || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setLocalConfig(prev => ({ ...prev, content: e.target.value }))
                }
                rows={4}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter a URL, text, phone number, or any content to encode
              </p>
            </div>

            <div className="text-xs text-muted-foreground">
              <strong>Tips:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>URL: https://example.com</li>
                <li>Phone: tel:+1234567890</li>
                <li>Email: mailto:email@example.com</li>
                <li>WiFi: WIFI:T:WPA;S:NetworkName;P:Password;;</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="display" className="space-y-4">
            <div>
              <Label>Error Correction Level</Label>
              <Select
                value={localConfig.errorLevel || 'M'}
                onValueChange={(value) =>
                  setLocalConfig(prev => ({ ...prev, errorLevel: value as 'L' | 'M' | 'Q' | 'H' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Low (~7% recovery)</SelectItem>
                  <SelectItem value="M">Medium (~15% recovery)</SelectItem>
                  <SelectItem value="Q">Quartile (~25% recovery)</SelectItem>
                  <SelectItem value="H">High (~30% recovery)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Higher levels make the QR code more resilient to damage but denser
              </p>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="fg-color">Foreground Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    id="fg-color"
                    type="color"
                    value={localConfig.fgColor || '#000000'}
                    onChange={(e) =>
                      setLocalConfig(prev => ({ ...prev, fgColor: e.target.value }))
                    }
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <Input
                    value={localConfig.fgColor || '#000000'}
                    onChange={(e) =>
                      setLocalConfig(prev => ({ ...prev, fgColor: e.target.value }))
                    }
                    className="flex-1"
                    placeholder="#000000"
                  />
                </div>
              </div>

              <div className="flex-1">
                <Label htmlFor="bg-color">Background Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    id="bg-color"
                    type="color"
                    value={localConfig.bgColor || '#ffffff'}
                    onChange={(e) =>
                      setLocalConfig(prev => ({ ...prev, bgColor: e.target.value }))
                    }
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <Input
                    value={localConfig.bgColor || '#ffffff'}
                    onChange={(e) =>
                      setLocalConfig(prev => ({ ...prev, bgColor: e.target.value }))
                    }
                    className="flex-1"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            </div>

            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLocalConfig(prev => ({
                    ...prev,
                    fgColor: '#000000',
                    bgColor: '#ffffff',
                  }))
                }
              >
                Reset Colors
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <div className="flex justify-between w-full">
            {config?.onDelete && (
              <Button variant="destructive" onClick={config.onDelete}>
                Delete Widget
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={cancelSettings}>
                Cancel
              </Button>
              <Button onClick={saveSettings}>Save</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div
      className={cn(
        'widget-container h-full flex flex-col',
        isTiny ? 'widget-drag-handle' : 'p-2 md:p-3'
      )}
    >
      {!isTiny && (
        <WidgetHeader
          title={localConfig.title || 'QR Code'}
          onSettingsClick={readOnly ? undefined : openSettings}
          compact={isShort || isCompact}
        />
      )}

      <div className={cn('flex-1 overflow-hidden min-h-0', isTiny ? 'p-1' : isShort ? 'px-1' : '')}>
        {/* Size-branching render (most specific first) */}
        {isTiny ? renderTiny()
          : isShort ? renderShort()
          : isApp ? renderApp()
          : isWide && isTall ? renderPanel()
          : isCompact ? renderCompact()
          : renderDefault()}
      </div>

      {!readOnly && renderSettingsModal()}
    </div>
  );
};

export default QRCodeWidget;
