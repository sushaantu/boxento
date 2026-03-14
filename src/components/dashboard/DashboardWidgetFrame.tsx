import React, { Suspense, useMemo } from 'react';
import { Loader2 } from 'lucide-react';

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

  if (!WidgetComponent) {
    return (
      <div className="widget-error">
        <p>Widget type "{widget.type}" not found</p>
      </div>
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
      <WidgetErrorBoundary>
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
