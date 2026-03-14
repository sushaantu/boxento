import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import DashboardResizeHandle from '@/components/dashboard/DashboardResizeHandle';
import WidgetHeader from '@/components/widgets/common/WidgetHeader';

describe('dashboard interaction polish components', () => {
  it('renders the shared drag affordance and explicit settings label', () => {
    const html = renderToStaticMarkup(React.createElement(WidgetHeader, {
      title: 'Quick Links',
      onSettingsClick: () => undefined,
    }));

    expect(html).toContain('widget-drag-handle');
    expect(html).toContain('widget-drag-affordance');
    expect(html).toContain('Open Quick Links settings');
  });

  it('renders the custom resize handle with the expected axis classes', () => {
    const html = renderToStaticMarkup(React.createElement(DashboardResizeHandle, {
      handleAxis: 'se',
    }));

    expect(html).toContain('dashboard-resize-handle');
    expect(html).toContain('react-resizable-handle-se');
    expect(html).toContain('dashboard-resize-handle__visual');
  });
});
