import React, { useState, useEffect } from 'react';
import { X, Plus, Calendar, Cloud, Clock, Link, StickyNote, CheckSquare, Timer, DollarSign, BookOpen, Video, Rss, Github, Plane, Globe } from 'lucide-react';
import { WidgetConfig } from '@/types';
import { Button } from '@/components/ui/button';

interface WidgetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (type: string) => void;
  widgetRegistry: WidgetConfig[];
  widgetCategories: { [category: string]: WidgetConfig[] };
}

/**
 * Widget Selector Component
 * 
 * Provides a modal interface for searching and adding widgets to the dashboard
 * 
 * @component
 * @param {WidgetSelectorProps} props - Component props
 * @returns {React.ReactElement | null} Widget selector modal or null if closed
 */
const WidgetSelector = ({ 
  isOpen, 
  onClose, 
  onAddWidget, 
  widgetRegistry,
  widgetCategories
}: WidgetSelectorProps): React.ReactElement | null => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const renderWidgetIcon = (icon?: string): React.ReactElement => {
    switch (icon) {
      case 'Calendar': return <Calendar className="size-4" />;
      case 'Cloud': return <Cloud className="size-4" />;
      case 'Clock': return <Clock className="size-4" />;
      case 'Link': return <Link className="size-4" />;
      case 'StickyNote': return <StickyNote className="size-4" />;
      case 'CheckSquare': return <CheckSquare className="size-4" />;
      case 'Timer': return <Timer className="size-4" />;
      case 'DollarSign': return <DollarSign className="size-4" />;
      case 'BookOpen': return <BookOpen className="size-4" />;
      case 'Video': return <Video className="size-4" />;
      case 'Rss': return <Rss className="size-4" />;
      case 'Github': return <Github className="size-4" />;
      case 'Plane': return <Plane className="size-4" />;
      case 'Globe': return <Globe className="size-4" />;
      default: return <Plus className="size-4" />;
    }
  };

  const renderWidgetCard = (widget: WidgetConfig): React.ReactElement => (
    <Button
      key={widget.type}
      type="button"
      variant="ghost"
      size="none"
      className="h-auto w-full justify-start gap-3 border border-gray-100 bg-white p-4 text-left dark:border-[#2c2c2e] dark:bg-[#1c1c1e]"
      onClick={() => onAddWidget(widget.type)}
      aria-label={`Add ${widget.name} widget`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-[#1c1c54] dark:text-blue-300">
        {renderWidgetIcon(widget.icon)}
      </span>
      <span className="flex flex-1 flex-col pt-1 text-left">
        <span className="text-sm text-gray-900 dark:text-[#f5f5f7]">{widget.name}</span>
        {widget.description && (
          <span className="mt-0.5 text-xs text-gray-500 dark:text-[#8e8e93]">{widget.description}</span>
        )}
      </span>
    </Button>
  );

  // Handle escape key press
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchQuery(e.target.value);
  };

  const filteredWidgets = searchQuery 
    ? widgetRegistry.filter(widget => 
        widget.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (widget.description && widget.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (widget.category && widget.category.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-black rounded-xl shadow-2xl dark:shadow-xl dark:shadow-black/40 w-full max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col border border-gray-200 dark:border-[#1c1c1e]" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 sm:p-5 md:p-6 border-b border-gray-200 dark:border-[#1c1c1e]">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">Add Widget</h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose} 
            className="rounded-full transition-colors duration-200"
            aria-label="Close widget selector"
          >
            <X size={20} className="dark:text-white" />
          </Button>
        </div>
        
        <div className="relative p-4 sm:p-5 md:p-6 border-b border-gray-200 dark:border-[#1c1c1e]">
          <input
            type="text"
            placeholder="Search widgets..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full h-10 rounded-md border border-gray-300 dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] px-3 py-2 text-sm ring-offset-background dark:text-white dark:placeholder:text-[#8e8e93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 dark:focus-visible:ring-blue-400/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
            aria-label="Search widgets"
            autoFocus
          />
        </div>
        
        {searchQuery ? (
          <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 dark:bg-black">
            <h4 className="text-base font-semibold text-gray-700 dark:text-[#f5f5f7] mb-2">Search Results</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {filteredWidgets.length > 0 ? (
                filteredWidgets.map(renderWidgetCard)
              ) : (
                <div className="col-span-full text-center py-8 text-gray-500 dark:text-[#8e8e93] text-sm">No widgets found matching "{searchQuery}"</div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 dark:bg-black">
            {Object.entries(widgetCategories).map(([category, widgets]) => (
              <div key={category} className="mb-8">
                <h4 className="text-base font-semibold text-gray-700 dark:text-[#f5f5f7] mb-2">{category}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  {widgets.map(renderWidgetCard)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WidgetSelector; 
