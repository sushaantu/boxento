import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import QuickLinksWidget from '@/components/widgets/QuickLinksWidget/index';

const createConfig = (links = [
  {
    id: 1,
    title: 'Boxento',
    url: 'https://boxento.test',
    favicon: 'https://icons.duckduckgo.com/ip3/boxento.test.ico',
    category: 'Work',
  },
]) => ({
  customTitle: 'Quick Links',
  links,
});

describe('QuickLinksWidget app-mode layout', () => {
  it('does not render an idle sidebar placeholder in large layouts', () => {
    const html = renderToStaticMarkup(React.createElement(QuickLinksWidget, {
      width: 6,
      height: 6,
      config: createConfig(),
    }));

    expect(html).toContain('Search links...');
    expect(html).toContain('Add Link');
    expect(html).not.toContain('Select a link to preview details');
    expect(html).not.toContain('w-72');
  });

  it('keeps the standard layout quick-add form for non-app widget sizes', () => {
    const html = renderToStaticMarkup(React.createElement(QuickLinksWidget, {
      width: 3,
      height: 3,
      config: createConfig(),
    }));

    expect(html).toContain('Paste a URL and press Enter...');
    expect(html).toContain('Boxento');
    expect(html).not.toContain('Search links...');
  });
});
