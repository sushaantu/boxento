import React, { ReactNode } from 'react';
import { Settings } from 'lucide-react';

interface WidgetHeaderProps {
  title?: string;
  icon?: ReactNode;
  onSettingsClick?: () => void;
  children?: ReactNode;
  compact?: boolean;
}

/**
 * Shared widget header component
 * 
 * @param props Component props
 * @returns Widget header component
 */
const WidgetHeader = ({ 
  title, 
  icon, 
  onSettingsClick, 
  children,
  compact = false,
}: WidgetHeaderProps): React.ReactElement => {
  return (
    <div className={`widget-drag-handle flex cursor-move items-center justify-between ${compact ? 'p-1.5' : 'p-2 md:p-2'}`}>
      <div className={`flex min-w-0 items-center ${compact ? 'gap-1' : 'gap-1.5 md:gap-2'}`}>
        {icon && (
          <div className={`text-gray-500 dark:text-slate-400 ${compact ? 'text-[11px]' : 'text-xs md:text-sm'}`}>
            {icon}
          </div>
        )}
        {title && (
          <h3 className={`truncate font-medium text-gray-800 dark:text-slate-100 ${compact ? 'text-[11px]' : 'text-xs md:text-sm'}`}>
            {title}
          </h3>
        )}
        {children}
      </div>
      {onSettingsClick && (
        <button 
          type="button"
          aria-label={title ? `Open ${title} settings` : 'Open widget settings'}
          className={`settings-button hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full ${compact ? 'p-0.5' : 'p-0.5 md:p-1'}`}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onSettingsClick();
          }}
        >
          <Settings size={compact ? 12 : 14} className="text-gray-500 dark:text-slate-400" />
        </button>
      )}
    </div>
  );
};

export default WidgetHeader;
