import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StickyNote, FileText, Type, Hash, AlignLeft, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { WidgetSettingsDialog, WidgetSettingsDialogFooter } from '../common/WidgetSettingsDialog';
import { WidgetShell } from '../common/WidgetShell';
import { NotesWidgetProps, NotesWidgetConfig } from './types';
import { Button } from '../../ui/button';

const NOTES_ICON_CLASS_NAME = 'text-muted-foreground';
const NOTES_BADGE_CLASS_NAME = 'bg-muted text-muted-foreground';

/**
 * Notes Widget Component
 *
 * A notepad widget spanning the full icon-to-app spectrum:
 * - 1x1 Icon: notepad icon with word count
 * - Nx1 Ribbon: first-line preview chip + word count badge
 * - 2x2 Compact: non-editable multi-line preview
 * - 3x3 Widget: classic lined notepad editor
 * - 4x4-5x5 Panel: larger lined notepad with more lines
 * - 6x6+ App: full notes application with toolbar and status bar
 *
 * @param {NotesWidgetProps} props - Component props
 * @returns {JSX.Element} Widget component
 */
const NotesWidget: React.FC<NotesWidgetProps> = ({ width = 2, height = 2, config }) => {
  // --- Size detection (icon → widget → app spectrum) ---
  const isTiny = width === 1 && height === 1;
  const isShort = height === 1 && width > 1;
  const isCompact = width <= 2 || height <= 2;
  const isApp = width >= 6 && height >= 6;
  const readOnly = config?.readOnly ?? false;

  const defaultConfig: NotesWidgetConfig = {
    content: '',
    title: 'Notes',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 14,
    lineHeight: 26,
    lineColor: '#E6E6E6',
    paperColor: '#FFFBE6',
    darkPaperColor: '#1E293B'
  };

  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<NotesWidgetConfig>({
    ...defaultConfig,
    ...config
  });

  const widgetRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Update local config when props change
  useEffect(() => {
    setLocalConfig(prevConfig => ({
      ...prevConfig,
      ...config
    }));
  }, [config]);

  // Focus the textarea when the widget is resized
  useEffect(() => {
    if (textareaRef.current && document.activeElement !== textareaRef.current) {
      const scrollPos = textareaRef.current.scrollTop;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = scrollPos;
        }
      }, 0);
    }
  }, [width, height]);

  // --- Text statistics ---
  const textStats = useMemo(() => {
    const content = localConfig.content || '';
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const characters = content.length;
    const lines = content ? content.split('\n').length : 0;
    const firstLine = content.split('\n')[0] || '';
    return { words, characters, lines, firstLine };
  }, [localConfig.content]);

  // --- Font family display name ---
  const fontFamilyLabel = useMemo(() => {
    const fontFamily = localConfig.fontFamily || defaultConfig.fontFamily || '';
    if (fontFamily.includes('Courier') || fontFamily.includes('monospace')) return 'Monospace';
    if (fontFamily.includes('Georgia')) return 'Georgia';
    if (fontFamily.includes('Helvetica')) return 'Helvetica';
    return 'System UI';
  }, [localConfig.fontFamily]);

  // Handle content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setLocalConfig(prev => ({
      ...prev,
      content: newContent
    }));

    if (config?.onUpdate) {
      config.onUpdate({
        ...localConfig,
        content: newContent
      });
    }
  };

  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setLocalConfig(prev => ({
      ...prev,
      title: newTitle
    }));
  };

  // Handle font family change
  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFontFamily = e.target.value;
    setLocalConfig(prev => ({
      ...prev,
      fontFamily: newFontFamily
    }));
  };

  // Handle font size change
  const handleFontSizeChange = (value: number) => {
    setLocalConfig(prev => ({
      ...prev,
      fontSize: value
    }));
  };

  // Handle line height change
  const handleLineHeightChange = (value: number) => {
    setLocalConfig(prev => ({
      ...prev,
      lineHeight: value
    }));
  };

  // Save settings
  const saveSettings = () => {
    if (config?.onUpdate) {
      config.onUpdate(localConfig);
    }
    setShowSettings(false);
  };

  // Cancel settings - reset localConfig to original
  const cancelSettings = () => {
    setLocalConfig({
      ...defaultConfig,
      ...config
    });
    setShowSettings(false);
  };

  // Generate the linear gradient for the lined paper effect
  const getLinedPaperBackground = () => {
    const lineHeight = localConfig.lineHeight || defaultConfig.lineHeight || 26;
    const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const lineColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : (localConfig.lineColor || defaultConfig.lineColor || '#E6E6E6');

    return `repeating-linear-gradient(
      to bottom,
      transparent,
      transparent ${lineHeight - 1}px,
      ${lineColor} ${lineHeight - 1}px,
      ${lineColor} ${lineHeight}px
    )`;
  };

  // --- Lined notepad editor (shared between widget, panel, and app) ---
  const renderLinedNotepad = (fontSize?: number) => {
    const effectiveFontSize = fontSize || localConfig.fontSize || defaultConfig.fontSize;
    return (
      <div
        className="h-full relative overflow-hidden rounded-md"
        style={{
          backgroundImage: getLinedPaperBackground(),
          backgroundColor: 'transparent'
        }}
      >
        <Textarea
          ref={textareaRef}
          value={localConfig.content || ''}
          onChange={handleContentChange}
          readOnly={readOnly}
          className="h-full min-h-0 resize-none border-none bg-transparent shadow-none focus-visible:ring-0
                    text-foreground py-1 leading-relaxed placeholder-muted-foreground"
          style={{
            fontFamily: localConfig.fontFamily || defaultConfig.fontFamily,
            fontSize: `${effectiveFontSize}px`,
            lineHeight: `${localConfig.lineHeight || defaultConfig.lineHeight}px`,
            caretColor: readOnly ? 'transparent' : 'currentColor',
          }}
          placeholder={readOnly ? '' : 'Write your notes here...'}
          aria-label="Notes content"
        />
      </div>
    );
  };

  // ============================================================
  // VIEW RENDERERS
  // ============================================================

  /**
   * 1x1 ICON: Notepad icon with word count
   */
  const renderTinyView = () => {
    const { words } = textStats;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
        <StickyNote size={22} className={NOTES_ICON_CLASS_NAME} />
        {words > 0 && (
          <span className="text-[10px] font-medium leading-none text-muted-foreground">
            {words}
          </span>
        )}
      </div>
    );
  };

  /**
   * Nx1 RIBBON: First line preview chip + word count badge
   */
  const renderRibbonView = () => {
    const { firstLine, words } = textStats;
    return (
      <div className="flex h-full items-center gap-2 overflow-x-auto px-1">
        {/* Icon badge */}
        <div className={`flex shrink-0 items-center justify-center rounded-lg px-2 py-1 ${NOTES_BADGE_CLASS_NAME}`}>
          <StickyNote size={16} />
        </div>

        {/* First line preview */}
        {firstLine ? (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
            <span className="max-w-[160px] truncate text-xs font-medium text-foreground">
              {firstLine}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Empty note</span>
        )}

        {/* Word count badge */}
        {words > 0 && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${NOTES_BADGE_CLASS_NAME}`}>
            {words}w
          </span>
        )}
      </div>
    );
  };

  /**
   * 2x2 COMPACT: Non-editable multi-line preview
   */
  const renderCompactView = () => {
    return (
      <div className="h-full overflow-hidden p-1">
        {renderLinedNotepad(11)}
      </div>
    );
  };

  /**
   * 6x6+ APP: Full notes application with toolbar and status bar
   */
  const renderAppView = () => {
    const { words, characters, lines } = textStats;
    return (
      <div className="flex h-full flex-col">
        {/* Top toolbar */}
        <div
          data-testid="notes-app-header"
          className="flex items-center justify-between px-4 py-2 widget-drag-handle cursor-move"
        >
          <div className="flex items-center gap-2">
            <FileText size={18} className={NOTES_ICON_CLASS_NAME} />
            <h2 className="text-sm font-semibold text-foreground truncate">
              {localConfig.title || 'Notes'}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Type size={12} />
              {words} {words === 1 ? 'word' : 'words'}
            </span>
            <span className="flex items-center gap-1">
              <Hash size={12} />
              {characters} {characters === 1 ? 'char' : 'chars'}
            </span>
            <span className="flex items-center gap-1">
              <AlignLeft size={12} />
              {lines} {lines === 1 ? 'line' : 'lines'}
            </span>
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-6 w-6"
                onClick={() => setShowSettings(true)}
                aria-label="Notes settings"
              >
                <Settings size={14} />
              </Button>
            )}
          </div>
        </div>

        {/* Full editor area */}
        <div className="flex-1 overflow-hidden px-4 py-2">
          {renderLinedNotepad()}
        </div>

        {/* Bottom status bar */}
        <div className="flex items-center justify-between border-t border-border px-4 py-1.5 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>Font: {fontFamilyLabel}</span>
            <span>{localConfig.fontSize || defaultConfig.fontSize}px</span>
          </div>
          <span>{readOnly ? 'Read-only' : 'Ready'}</span>
        </div>
      </div>
    );
  };

  // ============================================================
  // CONTENT ROUTER
  // ============================================================

  const renderContent = () => {
    if (isTiny) return renderTinyView();
    if (isShort) return renderRibbonView();
    if (isApp) return renderAppView();
    if (isCompact) return renderCompactView();

    // Default: 3x3 widget and 4x4-5x5 panel — lined notepad editor
    // Panel gets slightly larger font for breathing room
    const isPanel = (width >= 4 && height >= 4) && !isApp;
    const panelFontSize = isPanel ? Math.max((localConfig.fontSize || 14) + 1, 15) : undefined;
    return (
      <div className="h-full overflow-hidden p-2">
        {renderLinedNotepad(panelFontSize)}
      </div>
    );
  };

  // ============================================================
  // SETTINGS MODAL
  // ============================================================

  const renderSettings = () => {
    return (
      <WidgetSettingsDialog
        open={showSettings}
        onOpenChange={(open: boolean) => {
          if (!open) {
            cancelSettings();
            return;
          }
          setShowSettings(true);
        }}
        title="Notes Settings"
        bodyClassName="flex flex-col gap-4 px-1"
        footer={(
          <WidgetSettingsDialogFooter
            onDelete={config?.onDelete ? () => config.onDelete?.() : undefined}
            onCancel={cancelSettings}
            onSave={saveSettings}
          />
        )}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="title-input">Title</Label>
          <Input
            id="title-input"
            value={localConfig.title || ''}
            onChange={handleTitleChange}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="font-family-select">Font Family</Label>
          <Select
            value={localConfig.fontFamily || 'system-ui, -apple-system, sans-serif'}
            onValueChange={(value) => handleFontFamilyChange({ target: { value } } as React.ChangeEvent<HTMLSelectElement>)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a font family" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system-ui, -apple-system, sans-serif">System UI</SelectItem>
              <SelectItem value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica</SelectItem>
              <SelectItem value="Georgia, serif">Georgia</SelectItem>
              <SelectItem value="'Courier New', monospace">Monospace</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="font-size-range">Font Size</Label>
            <span className="text-sm text-muted-foreground">{localConfig.fontSize || 14}px</span>
          </div>
          <Slider
            id="font-size-range"
            min={12}
            max={24}
            step={1}
            value={[localConfig.fontSize || 14]}
            onValueChange={(value: number[]) => handleFontSizeChange(value[0])}
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="line-height-range">Line Height</Label>
            <span className="text-sm text-muted-foreground">{localConfig.lineHeight || 26}px</span>
          </div>
          <Slider
            id="line-height-range"
            min={20}
            max={40}
            step={2}
            value={[localConfig.lineHeight || 26]}
            onValueChange={(value: number[]) => handleLineHeightChange(value[0])}
            className="w-full"
          />
        </div>
      </WidgetSettingsDialog>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <WidgetShell
      ref={widgetRef}
      title={localConfig.title || 'Notes'}
      isTiny={isTiny}
      hideHeader={isApp}
      compactHeader={isShort}
      onSettingsClick={readOnly ? undefined : () => setShowSettings(true)}
      contentClassName={isTiny ? 'p-1' : ''}
    >
      {renderContent()}
      {/* Settings modal */}
      {showSettings && renderSettings()}
    </WidgetShell>
  );
};

export default NotesWidget;
