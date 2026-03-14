import * as React from 'react';
import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type WidgetShellProps = React.ComponentProps<'div'> & {
  title?: string;
  icon?: React.ReactNode;
  isTiny?: boolean;
  hideHeader?: boolean;
  compactHeader?: boolean;
  onSettingsClick?: () => void;
  headerContent?: React.ReactNode;
  headerActions?: React.ReactNode;
  contentClassName?: string;
};

export const WidgetShell = React.forwardRef<HTMLDivElement, WidgetShellProps>(
  (
    {
      title,
      icon,
      isTiny = false,
      hideHeader = false,
      compactHeader = false,
      onSettingsClick,
      headerContent,
      headerActions,
      className,
      contentClassName,
      children,
      ...props
    },
    ref
  ) => {
    const showHeader = !isTiny && !hideHeader;

    return (
      <div
        ref={ref}
        className={cn(
          'widget-container flex h-full flex-col',
          isTiny && 'widget-drag-handle',
          className
        )}
        {...props}
      >
        {showHeader ? (
          <CardHeader
            className={cn(
              'widget-header widget-drag-handle flex flex-row items-center justify-between gap-3 border-b border-border/60 px-0',
              compactHeader ? 'pb-2' : 'pb-3'
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              {icon ? (
                <span className="shrink-0 text-muted-foreground">{icon}</span>
              ) : null}
              {title ? (
                <CardTitle
                  role="heading"
                  aria-level={3}
                  className={cn(
                    'truncate text-sm font-medium',
                    compactHeader && 'text-xs'
                  )}
                >
                  {title}
                </CardTitle>
              ) : null}
              {headerContent}
            </div>

            {headerActions ?? onSettingsClick ? (
              <div className="flex shrink-0 items-center gap-1">
                {headerActions ?? null}
                {onSettingsClick ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'settings-button text-muted-foreground',
                      compactHeader ? 'size-7' : 'size-8'
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSettingsClick();
                    }}
                    aria-label="Open widget settings"
                  >
                    <Settings2 />
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardHeader>
        ) : null}

        <div className={cn('min-h-0 flex-1 overflow-hidden', contentClassName)}>
          {children}
        </div>
      </div>
    );
  }
);

WidgetShell.displayName = 'WidgetShell';
