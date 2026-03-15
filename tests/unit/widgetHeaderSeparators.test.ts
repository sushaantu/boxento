import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import NotesWidget from '@/components/widgets/NotesWidget/index';
import QuickLinksWidget from '@/components/widgets/QuickLinksWidget/index';
import { WidgetShell } from '@/components/widgets/common/WidgetShell';

describe('widget header separators', () => {
  it('keeps the shared WidgetShell header free of a bottom border', () => {
    const html = renderToStaticMarkup(
      React.createElement(WidgetShell, { title: 'Example widget' }, React.createElement('div', null, 'Body'))
    );

    expect(html).toContain('widget-header');
    expect(html).not.toMatch(/widget-header[^"]*border-b/);
  });

  it('keeps the Quick Links app header free of a separator border', () => {
    const html = renderToStaticMarkup(
      React.createElement(QuickLinksWidget, {
        width: 6,
        height: 6,
        config: {
          customTitle: 'Quick Links',
          links: [
            { id: 1, title: 'Boxento', url: 'https://boxento.test', favicon: '', category: 'Work' },
          ],
        },
      })
    );

    expect(html).toContain('Search links...');
    expect(html).not.toContain('flex items-center gap-3 border-b border-border px-4 py-3');
  });

  it('keeps the Notes app toolbar free of a separator border', () => {
    const html = renderToStaticMarkup(
      React.createElement(NotesWidget, {
        width: 6,
        height: 6,
        config: {
          title: 'Notes',
          content: 'Notes content',
        },
      })
    );

    expect(html).toContain('Notes');
    expect(html).not.toContain('flex items-center justify-between border-b border-border px-4 py-2 widget-drag-handle cursor-move');
  });

  it('removes the Calendar and Paisa top-level header separators from source', () => {
    const calendarSource = readFileSync(
      new URL('../../src/components/widgets/CalendarWidget/index.tsx', import.meta.url),
      'utf8'
    );
    const paisaSource = readFileSync(
      new URL('../../src/components/widgets/PaisaWidget/index.tsx', import.meta.url),
      'utf8'
    );

    expect(calendarSource).not.toContain('className="flex items-center justify-between border-b border-border px-4 py-2 widget-drag-handle cursor-move"');
    expect(paisaSource).not.toContain('className="flex items-center justify-between px-2 py-1.5 border-b border-border/50"');
    expect(paisaSource).not.toContain('className="flex items-center justify-between px-4 py-3 border-b border-border/50 widget-drag-handle cursor-move"');
  });
});
