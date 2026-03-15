import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import QRCodeWidget from '@/components/widgets/QRCodeWidget';
import type { QRCodeWidgetConfig } from '@/components/widgets/QRCodeWidget/types';

const renderCompactWidget = (
  config: Partial<QRCodeWidgetConfig>,
  dimensions: { width: number; height: number } = { width: 2, height: 2 }
) =>
  renderToStaticMarkup(
    React.createElement(QRCodeWidget, {
      width: dimensions.width,
      height: dimensions.height,
      config,
    })
  );

describe('QRCodeWidget compact layout', () => {
  it('uses compact chrome for the default 2x2 setup state', () => {
    const html = renderCompactWidget({ title: 'QR Code' });

    expect(html).toContain('Configure this widget to get started');
    expect(html).toContain('p-2 md:p-3');
    expect(html).toContain('px-0 py-1.5');
    expect(html).toContain('text-[11px]');
    expect(html).toContain('h-7');
  });

  it('renders a larger QR code for configured 2x2 widgets', () => {
    const html = renderCompactWidget({
      title: 'QR Code',
      content: 'https://example.com',
    });

    expect(html).toContain('height="108"');
    expect(html).toContain('width="108"');
    expect(html).not.toContain('height="80"');
  });

  it('caps compact QR sizing by the constrained side for short-wide layouts', () => {
    const html = renderCompactWidget(
      {
        title: 'QR Code',
        content: 'https://example.com',
      },
      { width: 3, height: 2 }
    );

    expect(html).toContain('height="108"');
    expect(html).toContain('width="108"');
    expect(html).not.toContain('height="124"');
  });
});
