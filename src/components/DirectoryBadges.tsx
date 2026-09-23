import type { FC } from 'react';

/**
 * A dofollow directory badge shown in the site footer.
 * Links stay crawlable: no nofollow, sponsored, or ugc.
 */
export interface DirectoryBadge {
  href: string;
  imageSrc: string;
  alt: string;
  title: string;
  width: number;
  height: number;
  /** Extra rel tokens such as the SaaSLineup `dofollow` marker. */
  rel?: string;
}

/**
 * Official badge URLs.
 * SaaSLineup: product badge from their submit snippet, with the Boxento slug.
 * FranceSaaS: shared badge SVG plus the product-profile link used by listed
 * products (Qwease, Courtadmin). The French title matches those installs.
 */
export const DIRECTORY_BADGES: readonly DirectoryBadge[] = [
  {
    href: 'https://saaslineup.com/product/boxento?ref=badge',
    imageSrc: 'https://saaslineup.com/badge/boxento.svg',
    alt: 'Boxento on SaaSLineup',
    title: 'Boxento on SaaSLineup',
    width: 182,
    height: 46,
    rel: 'dofollow',
  },
  {
    href: 'https://francesaas.fr/saas/boxento',
    imageSrc: 'https://francesaas.fr/badge-francesaas.svg',
    alt: 'Badge FranceSaaS',
    title: 'Profil du SaaS Boxento sur FranceSaaS.fr',
    width: 170,
    height: 54,
  },
];

const linkRel = (extraRel?: string): string => (
  ['noopener', extraRel].filter(Boolean).join(' ')
);

/**
 * Quiet dofollow partner badges required by free directory listings.
 */
export const DirectoryBadges: FC = () => {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2"
      aria-label="Directory listings"
    >
      {DIRECTORY_BADGES.map((badge) => (
        <a
          key={badge.href}
          href={badge.href}
          target="_blank"
          rel={linkRel(badge.rel)}
          title={badge.title}
          className="inline-flex shrink-0 opacity-90 transition-opacity hover:opacity-100"
        >
          <img
            src={badge.imageSrc}
            alt={badge.alt}
            width={badge.width}
            height={badge.height}
            loading="lazy"
            decoding="async"
            className="h-8 w-auto max-w-full"
          />
        </a>
      ))}
    </div>
  );
};
