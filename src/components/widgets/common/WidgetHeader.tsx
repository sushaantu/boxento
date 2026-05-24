import React, { ReactNode } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

import {
  getWidgetHeaderClassName,
  getWidgetHeaderContentClassName,
  getWidgetHeaderIconClassName,
  getWidgetHeaderSettingsButtonClassName,
  getWidgetHeaderTitleClassName,
} from './widgetHeaderStyles';

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
    <div className={getWidgetHeaderClassName(compact)}>
      <div className={getWidgetHeaderContentClassName(compact)}>
        {icon && (
          <div className={getWidgetHeaderIconClassName(compact)}>
            {icon}
          </div>
        )}
        {title && (
          <h3 className={getWidgetHeaderTitleClassName(compact)}>
            {title}
          </h3>
        )}
        {children}
      </div>
      {onSettingsClick && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={title ? `Open ${title} settings` : 'Open widget settings'}
          className={getWidgetHeaderSettingsButtonClassName(compact)}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onSettingsClick();
          }}
        >
          <Settings2 aria-hidden="true" />
        </Button>
      )}
    </div>
  );
};

export default WidgetHeader;
