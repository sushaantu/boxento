import type { FC } from 'react';

/**
 * SaaSLineup free-listing badge. URLs and alt text are the confirmed snippet.
 * The anchor is dofollow: it has no rel="nofollow".
 */
export const SAASLINEUP_BADGE_HREF = 'https://saaslineup.com/product/boxento/?ref=badge';
export const SAASLINEUP_BADGE_SRC = 'https://saaslineup.com/badge/boxento.svg';

export const DirectoryBadges: FC = () => {
  // TODO(FranceSaaS): Paste the official free-tier badge here after the
  // FranceSaaS dashboard provides it for the Boxento teaser/draft listing.
  // Do not guess a badge image or profile URL. Public référencement pages
  // require that provided snippet and do not publish a generic embed.
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2"
      aria-label="Directory listings"
    >
      <a href={SAASLINEUP_BADGE_HREF}>
        <img src={SAASLINEUP_BADGE_SRC} alt="Boxento on SaaSLineup" />
      </a>
    </div>
  );
};
