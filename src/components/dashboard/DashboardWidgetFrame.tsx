import React, { Suspense, useCallback, useMemo } from 'react';
import { AlertTriangle, Loader2, RefreshCcw, Trash2 } from 'lucide-react';

import { getWidgetComponent } from '@/components/widgets';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import WidgetErrorBoundary from '@/components/widgets/common/WidgetErrorBoundary';
import {
  areDashboardWidgetFramePropsEqual,
  type DashboardWidgetFrameComparisonProps,
} from '@/components/dashboard/dashboardWidgetFrameComparator';
import {
  stopDashboardContextMenuPropagation,
  stopDashboardInteractionPropagation,
} from '@/lib/dashboardInteraction';

type DashboardWidgetFrameProps = DashboardWidgetFrameComparisonProps & {
  onDeleteWidget: (widgetId: string) => Promise<void>;
  onUpdateWidgetConfig: (widgetId: string, newConfig: Record<string, unknown>) => void;
};

const DashboardWidgetLoadingFallback = () => (
  <div className="flex h-full w-full items-center justify-center rounded-lg bg-card">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const isDynamicImportError = (error: Error): boolean => (
  /dynamically imported module|importing a module script failed|chunkloaderror|loading chunk/i.test(error.message)
);

type DashboardWidgetErrorFallbackProps = {
  isReadOnly: boolean;
  message: string;
  onDelete: () => void;
  showReload?: boolean;
};

const DashboardWidgetErrorFallback: React.FC<DashboardWidgetErrorFallbackProps> = ({
  isReadOnly,
  message,
  onDelete,
  showReload = false,
}) => (
  <Alert
    variant="destructive"
    className="widget-drag-handle flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border-destructive/30 p-4 text-center"
    data-testid="widget-error-fallback"
  >
    <AlertTriangle className="mb-1 size-6" aria-hidden="true" />
    <AlertTitle className="text-sm">Widget Error</AlertTitle>
    <AlertDescription className="flex flex-col items-center gap-3 text-xs">
      <span className="break-all">{message}</span>

      <div className="flex flex-wrap justify-center gap-2">
        {showReload ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              window.location.reload();
            }}
          >
            <RefreshCcw data-icon="inline-start" aria-hidden="true" />
            Reload
          </Button>
        ) : null}

        {!isReadOnly ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 data-icon="inline-start" aria-hidden="true" />
            Remove widget
          </Button>
        ) : null}
      </div>
    </AlertDescription>
  </Alert>
);

const DashboardWidgetFrameComponent: React.FC<DashboardWidgetFrameProps> = ({
  widget,
  width,
  height,
  isReadOnly,
  onDeleteWidget,
  onUpdateWidgetConfig,
}) => {
  const WidgetComponent = getWidgetComponent(widget.type);

  const widgetConfig = useMemo(() => ({
    ...widget.config,
    id: widget.id,
    readOnly: isReadOnly,
    ...(isReadOnly ? {} : {
      onDelete: () => {
        void onDeleteWidget(widget.id);
      },
      onUpdate: (newConfig: Record<string, unknown>) => {
        onUpdateWidgetConfig(widget.id, newConfig);
      },
    }),
  }), [isReadOnly, onDeleteWidget, onUpdateWidgetConfig, widget]);
  const handleDeleteWidget = useCallback(() => {
    void onDeleteWidget(widget.id);
  }, [onDeleteWidget, widget.id]);

  if (!WidgetComponent) {
    return (
      <DashboardWidgetErrorFallback
        isReadOnly={isReadOnly}
        message={`Widget type "${widget.type}" is not available.`}
        onDelete={handleDeleteWidget}
      />
    );
  }

  return (
    <div
      className="h-full"
      onMouseDownCapture={stopDashboardInteractionPropagation}
      onTouchStartCapture={stopDashboardInteractionPropagation}
      onClick={stopDashboardInteractionPropagation}
      onContextMenu={stopDashboardContextMenuPropagation}
    >
      <WidgetErrorBoundary
        resetKey={`${widget.id}:${widget.type}`}
        fallback={(error) => (
          <DashboardWidgetErrorFallback
            isReadOnly={isReadOnly}
            message={error.message || 'An error occurred while rendering this widget.'}
            onDelete={handleDeleteWidget}
            showReload={isDynamicImportError(error)}
          />
        )}
      >
        <Suspense fallback={<DashboardWidgetLoadingFallback />}>
          <WidgetComponent
            width={width}
            height={height}
            config={widgetConfig}
          />
        </Suspense>
      </WidgetErrorBoundary>
    </div>
  );
};

export const DashboardWidgetFrame = React.memo(
  DashboardWidgetFrameComponent,
  areDashboardWidgetFramePropsEqual
);

export default DashboardWidgetFrame;
