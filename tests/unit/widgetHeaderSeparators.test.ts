import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import NotesWidget from '@/components/widgets/NotesWidget/index';
import QuickLinksWidget from '@/components/widgets/QuickLinksWidget/index';
import { WidgetShell } from '@/components/widgets/common/WidgetShell';

const getHeaderClassNames = (html: string, testId: string) => {
  const headerTag = html.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? '';

  expect(headerTag).toBeTruthy();

  return headerTag.match(/class="([^"]*)"/)?.[1] ?? '';
};

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
    expect(getHeaderClassNames(html, 'quick-links-header').split(/\s+/)).not.toContain('border-b');
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
    expect(getHeaderClassNames(html, 'notes-app-header').split(/\s+/)).not.toContain('border-b');
  });
});
