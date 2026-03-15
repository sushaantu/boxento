import { cn } from '@/lib/utils';

const STANDARD_HEADER_SPACING = 'gap-1.5 md:gap-2';
const COMPACT_HEADER_SPACING = 'gap-1';

export const getWidgetHeaderClassName = (compact = false, className?: string) => (
  cn(
    'widget-header widget-drag-handle flex cursor-move items-center justify-between gap-3 px-0',
    compact ? 'py-1.5' : 'py-2',
    className
  )
);

export const getWidgetHeaderContentClassName = (compact = false, className?: string) => (
  cn(
    'flex min-w-0 items-center',
    compact ? COMPACT_HEADER_SPACING : STANDARD_HEADER_SPACING,
    className
  )
);

export const getWidgetHeaderIconClassName = (compact = false, className?: string) => (
  cn(
    'shrink-0 text-muted-foreground',
    compact ? 'text-[11px]' : 'text-xs md:text-sm',
    className
  )
);

export const getWidgetHeaderTitleClassName = (compact = false, className?: string) => (
  cn(
    'truncate font-medium text-foreground',
    compact ? 'text-[11px]' : 'text-xs md:text-sm',
    className
  )
);

export const getWidgetHeaderSettingsButtonClassName = (compact = false, className?: string) => (
  cn(
    'settings-button rounded-full text-muted-foreground hover:bg-accent',
    compact ? 'p-0.5' : 'p-0.5 md:p-1',
    className
  )
);
