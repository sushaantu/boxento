import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Home,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { HomeAssistantEntity } from './types';
import { formatState, isEntityOn } from './utils';

export function HomeSetupState({
  readOnly,
  onSettingsClick,
}: {
  readOnly: boolean;
  onSettingsClick: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-4 text-center">
      <Home className="size-8 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Connect Home Assistant</p>
        <p className="text-xs text-muted-foreground">
          Add your Home Assistant URL and a long-lived access token.
        </p>
      </div>
      {!readOnly ? (
        <Button type="button" size="sm" onClick={onSettingsClick}>
          Configure
        </Button>
      ) : null}
    </div>
  );
}

export function HomeLoadingState({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex h-full flex-col gap-2 p-3', compact && 'p-2')}>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-4/5" />
    </div>
  );
}

export function HomeErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-4 text-center">
      <AlertTriangle className="size-7 text-destructive" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Home Assistant unavailable</p>
        <p className="line-clamp-3 text-xs text-muted-foreground">{message}</p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw data-icon="inline-start" />
        Retry
      </Button>
    </div>
  );
}

export function HomeMetricTile({
  label,
  value,
  tone = 'neutral',
  compact = false,
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'good' | 'warning' | 'danger';
  compact?: boolean;
}) {
  return (
    <div className={cn(
      'min-w-0 rounded-md bg-muted/50 px-3 py-2',
      tone === 'good' && 'bg-green-500/10 text-green-800 dark:text-green-200',
      tone === 'warning' && 'bg-yellow-500/10 text-yellow-800 dark:text-yellow-200',
      tone === 'danger' && 'bg-red-500/10 text-red-800 dark:text-red-200',
      compact && 'px-2 py-1.5'
    )}>
      <div className={cn('truncate text-[11px] text-muted-foreground', tone !== 'neutral' && 'text-current/70')}>
        {label}
      </div>
      <div className={cn('truncate font-semibold', compact ? 'text-sm' : 'text-lg')}>
        {value}
      </div>
    </div>
  );
}

export function HomeTinyStatus({
  value,
  label,
  tone = 'neutral',
}: {
  value: string | number;
  label: string;
  tone?: 'neutral' | 'good' | 'warning' | 'danger';
}) {
  return (
    <div className={cn(
      'flex h-full flex-col items-center justify-center rounded-md p-1 text-center',
      tone === 'good' && 'text-green-700 dark:text-green-300',
      tone === 'warning' && 'text-yellow-700 dark:text-yellow-300',
      tone === 'danger' && 'text-red-700 dark:text-red-300'
    )}>
      <div className="text-lg font-semibold leading-none">{value}</div>
      <div className="mt-1 max-w-full truncate text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function HomeEntityRow({
  entity,
  action,
  actionDisabled = false,
  dense = false,
}: {
  entity: HomeAssistantEntity;
  action?: () => void;
  actionDisabled?: boolean;
  dense?: boolean;
}) {
  const on = isEntityOn(entity);

  return (
    <div className={cn('flex min-w-0 items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/60', dense && 'py-1.5')}>
      <span className={cn(
        'size-2 shrink-0 rounded-full bg-muted-foreground/40',
        on && 'bg-green-500',
        entity.state === 'unavailable' && 'bg-red-500'
      )} />
      <div className="min-w-0 flex-1">
        <div className={cn('truncate font-medium text-foreground', dense ? 'text-xs' : 'text-sm')}>
          {entity.name}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">{formatState(entity)}</div>
      </div>
      {action ? (
        <Button
          type="button"
          variant={on ? 'default' : 'outline'}
          size="sm"
          disabled={actionDisabled}
          onClick={action}
          className="h-7 shrink-0 px-2 text-xs"
        >
          {on ? 'On' : 'Off'}
        </Button>
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}

export function HomeEmptyState({ label = 'No matching devices' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-4 text-center">
      <CheckCircle2 className="size-7 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">Adjust the widget settings or add devices in Home Assistant.</p>
    </div>
  );
}

export function HomeRefreshingBadge({ refreshing }: { refreshing: boolean }) {
  if (!refreshing) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      Syncing
    </span>
  );
}
