import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AppFooter } from '@/components/AppFooter';
import {
  DirectoryBadges,
  SAASLINEUP_BADGE_HREF,
  SAASLINEUP_BADGE_SRC,
} from '@/components/DirectoryBadges';

describe('directory partner badges', () => {
  it('renders the exact SaaSLineup badge without a FranceSaaS link', () => {
    const html = renderToStaticMarkup(React.createElement(DirectoryBadges));

    expect(html).toContain(
      `<a href="${SAASLINEUP_BADGE_HREF}"><img src="${SAASLINEUP_BADGE_SRC}" alt="Boxento on SaaSLineup"/></a>`
    );
    expect(html).not.toMatch(/rel="[^"]*\bnofollow\b/);
    expect(html).not.toContain('francesaas');
  });

  it('keeps the badge in the site footer without removing existing links', () => {
    const html = renderToStaticMarkup(React.createElement(AppFooter));

    expect(html).toContain('https://saaslineup.com/product/boxento/?ref=badge');
    expect(html).toContain('https://saaslineup.com/badge/boxento.svg');
    expect(html).not.toContain('francesaas');
    expect(html).toContain('https://sushaantu.com');
    expect(html).toContain('https://github.com/sushaantu/boxento/issues');
    expect(html).toContain('https://github.com/sushaantu/boxento#contributing');
  });
});
