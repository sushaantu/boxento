import React, { Suspense, useCallback, useMemo } from 'react';
import { AlertTriangle, Loader2, RefreshCcw, Trash2 } from 'lucide-react';

import { getWidgetComponent } from '@/components/widgets';
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
  <div
    className="widget-drag-handle flex h-full w-full flex-col items-center justify-center rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:bg-opacity-20 dark:text-red-200"
    data-testid="widget-error-fallback"
  >
    <AlertTriangle className="mb-2" size={24} aria-hidden="true" />
    <h3 className="mb-1 text-sm font-medium">Widget Error</h3>
    <p className="text-center text-xs">
      <span className="break-all">
        {message}
      </span>
    </p>

    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {showReload ? (
        <button
          type="button"
          className="text-xs underline"
          onClick={(event) => {
            event.stopPropagation();
            window.location.reload();
          }}
        >
          <RefreshCcw className="size-4" aria-hidden="true" />
          Reload
        </button>
      ) : null}

      {!isReadOnly ? (
        <button
          type="button"
          className="text-xs underline"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Remove widget
        </button>
      ) : null}
    </div>
  </div>
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
