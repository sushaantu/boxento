import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import DashboardResizeHandle from '@/components/dashboard/DashboardResizeHandle';
import WidgetHeader from '@/components/widgets/common/WidgetHeader';
import { WidgetShell } from '@/components/widgets/common/WidgetShell';

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

  it('keeps the shared drag affordance in widget shell headers', () => {
    const html = renderToStaticMarkup(React.createElement(
      WidgetShell,
      {
        title: 'Quick Links',
        onSettingsClick: () => undefined,
      },
      React.createElement('div', null, 'content')
    ));

    expect(html).toContain('widget-drag-handle');
    expect(html).toContain('widget-drag-affordance');
    expect(html).toContain('Open widget settings');
  });

  it('renders the custom resize handle with the expected axis classes', () => {
    const html = renderToStaticMarkup(React.createElement(DashboardResizeHandle, {
      handleAxis: 'se',
      className: 'probe-handle',
      'data-probe': 'resize',
    }));

    expect(html).toContain('dashboard-resize-handle');
    expect(html).toContain('react-resizable-handle-se');
    expect(html).toContain('probe-handle');
    expect(html).toContain('data-probe="resize"');
    expect(html).toContain('dashboard-resize-handle__visual');
  });
});
