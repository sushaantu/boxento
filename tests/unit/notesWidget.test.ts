import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import NotesWidget from '@/components/widgets/NotesWidget/index';

const renderNotesWidget = (
  width: number,
  height: number,
  content = 'Notes content',
  config: Record<string, unknown> = {}
) => renderToStaticMarkup(
  React.createElement(NotesWidget, {
    width,
    height,
    config: {
      title: 'Notes',
      content,
      ...config,
    },
  })
);

describe('NotesWidget icon styling', () => {
  it('keeps tiny and ribbon icon surfaces monochrome', () => {
    const tinyHtml = renderNotesWidget(1, 1);
    const ribbonHtml = renderNotesWidget(3, 1, 'First line\nSecond line');

    expect(tinyHtml).toMatch(/lucide-sticky-note[^"]*text-muted-foreground/);
    expect(ribbonHtml).toContain('bg-muted text-muted-foreground');
    expect(ribbonHtml).toContain('lucide-sticky-note');
    expect(ribbonHtml).toContain('bg-muted');
    expect(tinyHtml).not.toContain('amber');
    expect(ribbonHtml).not.toContain('amber');
  });

  it('keeps the app header icon monochrome', () => {
    const appHtml = renderNotesWidget(6, 6);

    expect(appHtml).toMatch(/lucide-file-text[^"]*text-muted-foreground/);
    expect(appHtml).not.toContain('amber');
  });

  it('uses the configured font size in compact and panel editors', () => {
    const compactHtml = renderNotesWidget(2, 2, 'Compact note', { fontSize: 20 });
    const panelHtml = renderNotesWidget(4, 4, 'Panel note', { fontSize: 18 });

    expect(compactHtml).toContain('font-size:20px');
    expect(panelHtml).toContain('font-size:18px');
    expect(compactHtml).not.toContain('font-size:11px');
    expect(panelHtml).not.toContain('font-size:19px');
  });
});
