import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AppFooter } from '@/components/AppFooter';
import { DIRECTORY_BADGES, DirectoryBadges } from '@/components/DirectoryBadges';

const renderBadges = () => renderToStaticMarkup(React.createElement(DirectoryBadges));

describe('directory partner badges', () => {
  it('renders dofollow SaaSLineup and FranceSaaS badges with official hrefs', () => {
    const html = renderBadges();

    expect(DIRECTORY_BADGES.map((badge) => badge.href)).toEqual([
      'https://saaslineup.com/product/boxento?ref=badge',
      'https://francesaas.fr/saas/boxento',
    ]);

    for (const badge of DIRECTORY_BADGES) {
      expect(html).toContain(`href="${badge.href}"`);
      expect(html).toContain(`src="${badge.imageSrc}"`);
      expect(html).toContain(`alt="${badge.alt}"`);
    }

    expect(html).not.toMatch(/rel="[^"]*\b(nofollow|sponsored|ugc)\b/);
    expect(html).toContain('rel="noopener dofollow"');
    expect(html).toContain('Profil du SaaS Boxento sur FranceSaaS.fr');
  });

  it('keeps the badges in the site footer without removing existing links', () => {
    const html = renderToStaticMarkup(React.createElement(AppFooter));

    expect(html).toContain('https://saaslineup.com/product/boxento?ref=badge');
    expect(html).toContain('https://francesaas.fr/badge-francesaas.svg');
    expect(html).toContain('https://sushaantu.com');
    expect(html).toContain('https://github.com/sushaantu/boxento/issues');
    expect(html).toContain('https://github.com/sushaantu/boxento#contributing');
  });
});
