import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Button,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import { NotesWidgetProps, NotesWidgetConfig } from './types';

/**
 * Notes Widget Component
 * 
 * A simple notepad widget for taking and saving notes
 * 
 * @param {NotesWidgetProps} props - Component props
 * @returns {JSX.Element} Widget component
 */
const NotesWidget: React.FC<NotesWidgetProps> = ({ width, height, config }) => {
  const defaultConfig: NotesWidgetConfig = {
    content: '',
    title: 'Notes',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 14,
    lineHeight: 26,
    lineColor: '#E6E6E6', // Very subtle light gray
    paperColor: '#FFFBE6', // Cream/beige background color
    darkPaperColor: '#1E293B' // Dark mode paper color - matching other widgets
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
      // Store current scroll position to prevent jump
      const scrollPos = textareaRef.current.scrollTop;
      // Focus and restore scroll position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = scrollPos;
        }
      }, 0);
    }
  }, [width, height]);

  // Handle content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setLocalConfig(prev => ({
      ...prev,
      content: newContent
    }));
    
    // Save to parent config
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

  // Generate the linear gradient for the lined paper effect
  const getLinedPaperBackground = () => {
    const lineHeight = localConfig.lineHeight || defaultConfig.lineHeight || 26;
    const isDarkMode = document.documentElement.classList.contains('dark');
    const lineColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : (localConfig.lineColor || defaultConfig.lineColor || '#E6E6E6');
    
    return `repeating-linear-gradient(
      to bottom,
      transparent,
      transparent ${lineHeight - 1}px,
      ${lineColor} ${lineHeight - 1}px,
      ${lineColor} ${lineHeight}px
    )`;
  };

  // Settings modal using shadcn/ui Dialog
  const renderSettings = () => {
    return (
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notes Settings</DialogTitle>
          </DialogHeader>
          
          {/* Change py-2 to py-4 */}
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title-input">Title</Label>
              <Input
                id="title-input"
                value={localConfig.title || ''}
                onChange={handleTitleChange}
              />
            </div>
            
            <div className="space-y-2">
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
            
            <div className="space-y-2">
              <div className="flex justify-between">
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

            <div className="space-y-2">
              <div className="flex justify-between">
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
              <Button
                onClick={saveSettings}
                variant="default"
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div
      ref={widgetRef} 
      className="widget-container h-full flex flex-col"
    >
      <WidgetHeader 
        title={localConfig.title || 'Notes'} 
        onSettingsClick={() => setShowSettings(!showSettings)}
      />
      
      <div className="flex-1 overflow-hidden p-2">
        <div 
          className="h-full relative overflow-hidden rounded-md"
          style={{
            backgroundImage: getLinedPaperBackground(),
            backgroundColor: 'transparent'
          }}
        >
          <textarea
            ref={textareaRef}
            value={localConfig.content || ''}
            onChange={handleContentChange}
            className="w-full h-full resize-none border-none focus:outline-none focus:ring-0 bg-transparent 
                      text-gray-800 dark:text-gray-200 py-1 leading-relaxed placeholder-gray-500 dark:placeholder-gray-400"
            style={{
              fontFamily: localConfig.fontFamily || defaultConfig.fontFamily,
              fontSize: `${localConfig.fontSize || defaultConfig.fontSize}px`,
              lineHeight: `${localConfig.lineHeight || defaultConfig.lineHeight}px`,
              caretColor: 'currentColor',
            }}
            placeholder="Write your notes here..."
            aria-label="Notes content"
          />
        </div>
      </div>
      
      {/* Settings modal */}
      {renderSettings()}
    </div>
  );
};

export default NotesWidget; 