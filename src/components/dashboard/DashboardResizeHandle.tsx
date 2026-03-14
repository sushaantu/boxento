import { forwardRef, type ComponentPropsWithoutRef, type Ref } from 'react';

export type DashboardResizeHandleAxis =
  | 's'
  | 'w'
  | 'e'
  | 'n'
  | 'sw'
  | 'nw'
  | 'se'
  | 'ne';

type DashboardResizeHandleProps = ComponentPropsWithoutRef<'span'> & {
  handleAxis: DashboardResizeHandleAxis;
};

export const DashboardResizeHandle = forwardRef<HTMLElement, DashboardResizeHandleProps>(
  function DashboardResizeHandle({ handleAxis, className, ...props }, ref) {
    return (
      <span
        ref={ref as Ref<HTMLSpanElement>}
        className={[
          'dashboard-resize-handle',
          'react-resizable-handle',
          `react-resizable-handle-${handleAxis}`,
          className,
        ].filter(Boolean).join(' ')}
        aria-hidden="true"
        {...props}
      >
        <span className="dashboard-resize-handle__visual" />
      </span>
    );
  }
);

export default DashboardResizeHandle;
