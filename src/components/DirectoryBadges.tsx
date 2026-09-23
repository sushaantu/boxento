import type { FC } from 'react';

/**
 * Dofollow directory badges for free listings.
 *
 * SaaSLineup markup matches the official submit-page snippet
 * (https://saaslineup.com/submit/?tier=free), with the Boxento slug:
 * `<a href="https://saaslineup.com/product/boxento?ref=badge" rel="dofollow">`
 * and `alt="Featured on SaaSLineup"` at 160×44.
 * The andrew@thesaasdir.com email was not in the connected mailboxes.
 *
 * FranceSaaS public référencement pages require the badge and a dofollow
 * link, but they do not publish a copy-paste embed. Listed products install
 * this snippet: shared badge SVG, profile URL, and the French title
 * "Profil du SaaS {name} sur FranceSaaS.fr".
 */
export const SAASLINEUP_BADGE_HREF = 'https://saaslineup.com/product/boxento?ref=badge';
export const SAASLINEUP_BADGE_SRC = 'https://saaslineup.com/badge/boxento.svg';
export const FRANCESAAS_BADGE_HREF = 'https://francesaas.fr/saas/boxento';
export const FRANCESAAS_BADGE_SRC = 'https://francesaas.fr/badge-francesaas.svg';

/**
 * Quiet dofollow partner badges required by free directory listings.
 */
export const DirectoryBadges: FC = () => {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2"
      aria-label="Directory listings"
    >
      <a href={SAASLINEUP_BADGE_HREF} rel="dofollow">
        <img
          src={SAASLINEUP_BADGE_SRC}
          alt="Featured on SaaSLineup"
          width={160}
          height={44}
        />
      </a>
      <a
        href={FRANCESAAS_BADGE_HREF}
        target="_blank"
        rel="noopener noreferrer"
        title="Profil du SaaS Boxento sur FranceSaaS.fr"
      >
        <img
          src={FRANCESAAS_BADGE_SRC}
          alt="Badge FranceSaaS"
          width={200}
          height={44}
          loading="lazy"
          decoding="async"
        />
      </a>
    </div>
  );
};
