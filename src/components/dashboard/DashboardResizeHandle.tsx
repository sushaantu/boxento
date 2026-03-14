import { forwardRef, type Ref } from 'react';

export type DashboardResizeHandleAxis =
  | 's'
  | 'w'
  | 'e'
  | 'n'
  | 'sw'
  | 'nw'
  | 'se'
  | 'ne';

type DashboardResizeHandleProps = {
  handleAxis: DashboardResizeHandleAxis;
};

export const DashboardResizeHandle = forwardRef<HTMLElement, DashboardResizeHandleProps>(
  function DashboardResizeHandle({ handleAxis }, ref) {
    return (
      <span
        ref={ref as Ref<HTMLSpanElement>}
        className={`dashboard-resize-handle react-resizable-handle react-resizable-handle-${handleAxis}`}
        aria-hidden="true"
      >
        <span className="dashboard-resize-handle__visual" />
      </span>
    );
  }
);

export default DashboardResizeHandle;
