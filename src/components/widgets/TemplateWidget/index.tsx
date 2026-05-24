import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../ui/dialog';
import WidgetHeader from '../common/WidgetHeader';
import { WidgetProps } from '@/types';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Button } from '../../ui/button';
import { TemplateWidgetConfig } from './types';

type TemplateWidgetProps = WidgetProps<TemplateWidgetConfig>;

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
 * Template Widget Component
 * 
 * This is a template for creating new widgets in Boxento.
 * It follows all the required design patterns and structure.
 * 
 * @param {TemplateWidgetProps} props - Component props
 * @returns {JSX.Element} Widget component
 */
const TemplateWidget: React.FC<TemplateWidgetProps> = ({ width, height, config }) => {
  // Default configuration
  const defaultConfig: TemplateWidgetConfig = {
    title: 'Template Widget',
    showDebug: false
    // Add more default config properties here
  };

  // Component state
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [localConfig, setLocalConfig] = useState<TemplateWidgetConfig>({
    ...defaultConfig,
    ...config
  });
  
  // Ref for the widget container
  const widgetRef = useRef<HTMLDivElement | null>(null);
  
  // Update local config when props config changes
  useEffect(() => {
    setLocalConfig((prevConfig: TemplateWidgetConfig) => ({
      ...prevConfig,
      ...config
    }));
  }, [config]);
  
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
  
  /**
   * Small View (2x2) - Most critical information only
   * 
   * Guidelines:
   * - Only show the most critical information
   * - Use minimal UI elements
   * - Avoid complex interactivity
   * - Use smaller font sizes
   * - Focus on quick glanceable information
   * - Example content: Single status indicator, one key metric, icon representation
   * 
   * @returns {JSX.Element} Small view content
   */
  const renderSmallView = () => {
    return (
      <div className="flex items-center justify-center h-full">
        {/* Primary metric or status - the single most important piece of information */}
        <div className="text-center">
          <span className="block text-2xl font-bold">42</span>
          <span className="text-xs text-muted-foreground">Key Metric</span>
        </div>
      </div>
    );
  };

  /**
   * Wide Small View (3x2)
   *
   * Guidelines:
   * - Show critical info plus one secondary element
   * - Optimize for horizontal layout
   * - Can show simple charts or mini-visualizations
   * - Example content: Status plus trend indicator, two related metrics
   *
   * @returns {JSX.Element} Wide small view content
   */
  const renderWideSmallView = () => {
    return (
      <div className="flex justify-around items-center h-full">
        {/* Primary metric (from small view) */}
        <div className="text-center">
          <span className="block text-2xl font-bold">42</span>
          <span className="text-xs text-muted-foreground">Key Metric</span>
        </div>

        {/* Secondary metric - additional info we have space for in wide view */}
        <div className="text-center">
          <span className="block text-xl font-medium">18</span>
          <span className="text-xs text-muted-foreground">Secondary</span>
        </div>
      </div>
    );
  };

  /**
   * Tall Small View (2x3)
   *
   * Guidelines:
   * - Show critical info plus one secondary element
   * - Optimize for vertical layout
   * - Can include a small trend indicator
   * - Example content: Status with contextual information
   *
   * @returns {JSX.Element} Tall small view content
   */
  const renderTallSmallView = () => {
    return (
      <div className="flex flex-col justify-around items-center h-full">
        {/* Primary metric (from small view) */}
        <div className="text-center">
          <span className="block text-2xl font-bold">42</span>
          <span className="text-xs text-muted-foreground">Key Metric</span>
        </div>
        
        {/* Status indicator - additional info we have space for in tall view */}
        <div className="flex items-center mt-2">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
          <span className="text-sm">Status: Good</span>
        </div>
      </div>
    );
  };
  
  /**
   * Medium View (3x3) - Expanded content with more details
   * 
   * Guidelines:
   * - More detailed information
   * - Can include simple interactive elements
   * - Balanced layout with multiple metrics
   * - Example content: Primary + secondary metrics, status, context
   * 
   * @returns {JSX.Element} Medium view content
   */
  const renderMediumView = () => {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full p-1">
        {/* Quadrant 1: Primary metric (from small view) */}
        <div className="flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <span className="text-2xl font-bold">42</span>
          <span className="text-xs text-muted-foreground">Key Metric</span>
        </div>
        
        {/* Quadrant 2: Secondary metric */}
        <div className="flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <span className="text-xl font-medium">18</span>
          <span className="text-xs text-muted-foreground">Secondary Metric</span>
        </div>
        
        {/* Quadrant 3: Status or contextual information */}
        <div className="flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            <span className="text-sm">Status: Good</span>
          </div>
        </div>
        
        {/* Quadrant 4: Mini chart or time-based information */}
        <div className="flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <span className="text-xs text-muted-foreground">Updated 5m ago</span>
          {/* Placeholder for mini-chart */}
          <div className="w-full h-8 bg-secondary rounded mt-1"></div>
        </div>
      </div>
    );
  };
  
  /**
   * Wide Medium View (4x3)
   * 
   * Guidelines:
   * - Show all medium view content plus additional horizontal information
   * - Can include more detailed charts or breakdowns
   * - Optimize for horizontal layout with more space
   * - Example content: All medium metrics + detailed chart or breakdown
   * 
   * @returns {JSX.Element} Wide medium view content
   */
  const renderWideMediumView = () => {
    return (
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-full p-1">
        {/* First row: Key metrics */}
        <div className="col-span-1 flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <span className="text-2xl font-bold">42</span>
          <span className="text-xs text-muted-foreground">Key Metric</span>
        </div>
        
        <div className="col-span-1 flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <span className="text-xl font-medium">18</span>
          <span className="text-xs text-muted-foreground">Secondary</span>
        </div>
        
        <div className="col-span-2 flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <span className="text-xs text-muted-foreground mb-1">Detailed Breakdown</span>
          <div className="w-full flex justify-around">
            <div className="text-center">
              <span className="block text-sm font-medium">10</span>
              <span className="text-xs text-muted-foreground">A</span>
            </div>
            <div className="text-center">
              <span className="block text-sm font-medium">15</span>
              <span className="text-xs text-muted-foreground">B</span>
            </div>
            <div className="text-center">
              <span className="block text-sm font-medium">17</span>
              <span className="text-xs text-muted-foreground">C</span>
            </div>
          </div>
        </div>
        
        {/* Second row: Chart and status */}
        <div className="col-span-3 bg-muted rounded-lg p-2">
          <span className="text-xs text-muted-foreground">Trend Analysis</span>
          {/* Placeholder for larger chart */}
          <div className="w-full h-16 bg-secondary rounded mt-1"></div>
        </div>
        
        <div className="col-span-1 flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <div className="flex items-center mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            <span className="text-sm">Status: Good</span>
          </div>
          <span className="text-xs text-muted-foreground">Updated 5m ago</span>
        </div>
      </div>
    );
  };
  
  /**
   * Tall Medium View (3x4)
   * 
   * Guidelines:
   * - Show all medium view content plus additional vertical information
   * - Can include more detailed charts or interactive elements
   * - Optimize for vertical layout with more space
   * - Example content: All medium metrics + detailed chart or history
   * 
   * @returns {JSX.Element} Tall medium view content
   */
  const renderTallMediumView = () => {
    return (
      <div className="grid grid-cols-2 grid-rows-3 gap-2 h-full p-1">
        {/* Row 1: Key metrics */}
        <div className="flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <span className="text-2xl font-bold">42</span>
          <span className="text-xs text-muted-foreground">Key Metric</span>
        </div>
        
        <div className="flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <span className="text-xl font-medium">18</span>
          <span className="text-xs text-muted-foreground">Secondary Metric</span>
        </div>
        
        {/* Row 2: Status and updates */}
        <div className="flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            <span className="text-sm">Status: Good</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <span className="text-xs text-muted-foreground">Updated 5m ago</span>
          {/* Placeholder for mini-chart */}
          <div className="w-full h-8 bg-secondary rounded mt-1"></div>
        </div>
        
        {/* Row 3: Historical data (extra in tall view) */}
        <div className="col-span-2 bg-muted rounded-lg p-2">
          <span className="text-xs text-muted-foreground mb-1">Historical Data</span>
          <div className="w-full h-24 bg-secondary rounded mt-1 p-2">
            <div className="text-xs text-muted-foreground">
              Last 7 days trend data visualization would appear here
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  /**
   * Large View (4x4 or larger)
   * 
   * Guidelines:
   * - Full featured display with all available information
   * - Can include detailed visualizations and multiple metrics
   * - Interactive elements and controls
   * - Example content: Complete dashboard with charts, metrics, and controls
   * 
   * @returns {JSX.Element} Large view content
   */
  const renderLargeView = () => {
    return (
      <div className="grid grid-cols-4 grid-rows-4 gap-2 h-full p-1">
        {/* Header row: Key metrics */}
        <div className="col-span-1 flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <span className="text-2xl font-bold">42</span>
          <span className="text-xs text-muted-foreground">Key Metric</span>
        </div>
        
        <div className="col-span-1 flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <span className="text-xl font-medium">18</span>
          <span className="text-xs text-muted-foreground">Secondary</span>
        </div>
        
        <div className="col-span-1 flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            <span className="text-sm">Status: Good</span>
          </div>
        </div>
        
        <div className="col-span-1 flex flex-col items-center justify-center bg-muted rounded-lg p-2">
          <span className="text-xs text-muted-foreground">Updated 5m ago</span>
          <div className="flex space-x-1 mt-1">
            <Button variant="default" size="sm" className="px-2 py-1 text-xs h-auto">Refresh</Button>
            <Button variant="secondary" size="sm" className="px-2 py-1 text-xs h-auto">Filter</Button>
          </div>
        </div>
        
        {/* Main chart area */}
        <div className="col-span-3 row-span-2 bg-muted rounded-lg p-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Comprehensive Analysis</span>
            <div className="flex space-x-1">
              <Button variant="default" size="sm" className="px-2 py-1 text-xs h-auto">Day</Button>
              <Button variant="secondary" size="sm" className="px-2 py-1 text-xs h-auto">Week</Button>
              <Button variant="secondary" size="sm" className="px-2 py-1 text-xs h-auto">Month</Button>
            </div>
          </div>
          {/* Placeholder for large chart */}
          <div className="w-full h-32 bg-secondary rounded"></div>
        </div>
        
        {/* Side panel for detailed breakdown */}
        <div className="col-span-1 row-span-2 bg-muted rounded-lg p-2 overflow-auto">
          <span className="text-xs font-medium block mb-2">Detailed Breakdown</span>
          {/* Sample detailed metrics list */}
          {['Component A', 'Component B', 'Component C', 'Component D'].map((item, index) => (
            <div key={index} className="flex justify-between items-center py-1 border-b border-border">
              <span className="text-xs">{item}</span>
              <span className="text-xs font-medium">{10 + index * 3}</span>
            </div>
          ))}
        </div>
        
        {/* Bottom row: Additional widgets */}
        <div className="col-span-2 row-span-1 bg-muted rounded-lg p-2">
          <span className="text-xs text-muted-foreground mb-1">Related Metrics</span>
          <div className="flex justify-around mt-2">
            <div className="text-center">
              <span className="block text-sm font-medium">94%</span>
              <span className="text-xs text-muted-foreground">Efficiency</span>
            </div>
            <div className="text-center">
              <span className="block text-sm font-medium">23</span>
              <span className="text-xs text-muted-foreground">Issues</span>
            </div>
            <div className="text-center">
              <span className="block text-sm font-medium">8.5</span>
              <span className="text-xs text-muted-foreground">Rating</span>
            </div>
          </div>
        </div>
        
        <div className="col-span-2 row-span-1 bg-muted rounded-lg p-2">
          <span className="text-xs text-muted-foreground mb-1">Quick Actions</span>
          <div className="grid grid-cols-2 gap-1 mt-1">
            <Button variant="default" size="sm" className="px-2 py-1 text-xs h-auto">Action 1</Button>
            <Button variant="secondary" size="sm" className="px-2 py-1 text-xs h-auto">Action 2</Button>
            <Button variant="outline" size="sm" className="px-2 py-1 text-xs h-auto">Action 3</Button>
            <Button variant="secondary" size="sm" className="px-2 py-1 text-xs h-auto">Action 4</Button>
          </div>
        </div>
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
  
  // Settings dialog
  const renderSettings = () => {
    return (
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="settings-dialog-content sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Template Widget Settings</DialogTitle>
          </DialogHeader>
          
          {/* Change py-2 to py-4 */}
          <div className="space-y-4 py-4">
            {/* Title setting */}
            <div className="space-y-2">
              <Label htmlFor="title-input">Widget Title</Label>
              <Input
                id="title-input"
                type="text"
                value={localConfig.title || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setLocalConfig({...localConfig, title: e.target.value})
                }
              />
            </div>

            {/* Debug mode toggle */}
            {/* Change layout from justify-between to flex items-center space-x-2 */}
            {/* Place Switch before Label */}
            <div className="flex items-center space-x-2">
              <Switch
                id="debug-toggle"
                checked={Boolean(localConfig.showDebug)}
                onCheckedChange={(checked: boolean) => 
                  setLocalConfig({...localConfig, showDebug: checked})
                }
              />
              <Label htmlFor="debug-toggle">Show Debug Info (Size)</Label>
            </div>

            {/* Add more settings fields here */}
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
                variant="default"
                onClick={saveSettings}
              >
                Save
              </Button>
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
      
      {Boolean(localConfig.showDebug) && (
        <div className="absolute bottom-1 right-1 bg-black opacity-50 text-white text-xs px-1 rounded">
          {width}x{height} - {getWidgetSizeCategory(width, height)}
        </div>
      )}
      
      {renderSettings()}
    </div>
  );
};

export default TemplateWidget; 