import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AppFooter } from '@/components/AppFooter';
import {
  DirectoryBadges,
  FRANCESAAS_BADGE_HREF,
  FRANCESAAS_BADGE_SRC,
  SAASLINEUP_BADGE_HREF,
  SAASLINEUP_BADGE_SRC,
} from '@/components/DirectoryBadges';

describe('directory partner badges', () => {
  it('renders the official SaaSLineup snippet and the FranceSaaS profile badge', () => {
    const html = renderToStaticMarkup(React.createElement(DirectoryBadges));

    expect(html).toContain(
      `<a href="${SAASLINEUP_BADGE_HREF}" rel="dofollow"><img src="${SAASLINEUP_BADGE_SRC}" alt="Featured on SaaSLineup" width="160" height="44"/></a>`
    );
    expect(html).toContain(`href="${FRANCESAAS_BADGE_HREF}"`);
    expect(html).toContain(`src="${FRANCESAAS_BADGE_SRC}"`);
    expect(html).toContain('alt="Badge FranceSaaS"');
    expect(html).toContain('title="Profil du SaaS Boxento sur FranceSaaS.fr"');
    expect(html).not.toMatch(/rel="[^"]*\b(nofollow|sponsored|ugc)\b/);
  });

  it('keeps the badges in the site footer without removing existing links', () => {
    const html = renderToStaticMarkup(React.createElement(AppFooter));

    expect(html).toContain(SAASLINEUP_BADGE_HREF);
    expect(html).toContain(FRANCESAAS_BADGE_SRC);
    expect(html).toContain('https://sushaantu.com');
    expect(html).toContain('https://github.com/sushaantu/boxento/issues');
    expect(html).toContain('https://github.com/sushaantu/boxento#contributing');
  });
});
