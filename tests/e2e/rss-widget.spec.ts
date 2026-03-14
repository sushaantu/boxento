import { expect, test, type Page } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

const CLOUDFARE_FEED_URL = 'https://blog.cloudflare.com/rss/';
const HACKER_NEWS_FEED_URL = 'https://news.ycombinator.com/rss';
const CLOUDFARE_ARTICLE_URL = 'https://blog.cloudflare.com/launch-notes';
const HACKER_NEWS_ARTICLE_URL = 'https://example.com/story';
const HACKER_NEWS_COMMENTS_URL = 'https://news.ycombinator.com/item?id=123';

const CLOUDFARE_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Cloudflare Blog</title>
    <item>
      <title>Cloudflare launch notes</title>
      <link>${CLOUDFARE_ARTICLE_URL}</link>
      <pubDate>Fri, 14 Mar 2026 12:00:00 GMT</pubDate>
      <author>Cloudflare</author>
      <description><![CDATA[<p>Short summary that should not be used.</p>]]></description>
      <content:encoded><![CDATA[
        <p>Reader-friendly full text from the feed.</p>
        <p>The RSS reader should render this article inline with clean spacing and typography.</p>
      ]]></content:encoded>
    </item>
  </channel>
</rss>`;

const HACKER_NEWS_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Hacker News</title>
    <item>
      <title>Hacker News style story</title>
      <link>${HACKER_NEWS_ARTICLE_URL}</link>
      <comments>${HACKER_NEWS_COMMENTS_URL}</comments>
      <pubDate>Fri, 14 Mar 2026 12:05:00 GMT</pubDate>
      <description><![CDATA[<a href="${HACKER_NEWS_COMMENTS_URL}">Comments</a>]]></description>
    </item>
  </channel>
</rss>`;

type ExtractionMode = 'success' | 'unavailable';

const installRssMocks = async (page: Page, extractionMode: ExtractionMode): Promise<void> => {
  await page.route('**/api/rss**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const feedUrl = requestUrl.searchParams.get('url');
    const articleUrl = requestUrl.searchParams.get('articleUrl');

    if (feedUrl === CLOUDFARE_FEED_URL) {
      await route.fulfill({
        status: 200,
        contentType: 'application/rss+xml; charset=utf-8',
        body: CLOUDFARE_FEED_XML,
      });
      return;
    }

    if (feedUrl === HACKER_NEWS_FEED_URL) {
      await route.fulfill({
        status: 200,
        contentType: 'application/rss+xml; charset=utf-8',
        body: HACKER_NEWS_FEED_XML,
      });
      return;
    }

    if (articleUrl === HACKER_NEWS_ARTICLE_URL) {
      if (extractionMode === 'success') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            ok: true,
            article: {
              title: 'Extracted story',
              excerpt: 'Reader mode pulled the article body from the original page.',
              byline: 'Boxento Reader',
              content: `
                <p>Extracted article body loaded from the original page.</p>
                <p>This keeps link-only feeds readable without forcing a browser tab.</p>
              `,
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 422,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          ok: false,
          reason: 'The original page blocked reader extraction for this story.',
        }),
      });
      return;
    }

    await route.abort();
  });
};

const seedRssDashboard = async (page: Page): Promise<void> => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await seedDashboard(page, {
    widgets: [
      {
        id: 'rss-1',
        type: 'rss',
        config: {
          title: 'RSS Reader',
          feeds: [
            { title: 'Cloudflare Blog', url: CLOUDFARE_FEED_URL, enabled: true },
            { title: 'Hacker News', url: HACKER_NEWS_FEED_URL, enabled: true },
          ],
          maxItems: 10,
          showImages: true,
          showDate: true,
          showAuthor: true,
          showDescription: true,
          displayMode: 'list',
          openInNewTab: true,
        },
      },
    ],
    layouts: {
      lg: [
        { i: 'rss-1', x: 0, y: 0, w: 6, h: 6, minW: 2, minH: 2 },
      ],
    },
  });
};

const rssWidget = (page: Page) => page.locator('.react-grid-item[data-widget-id="rss-1"]');

test.describe('RSS widget reader', () => {
  test('renders inline feed content and extracted reader content in app view', async ({ page }) => {
    await installRssMocks(page, 'success');
    await seedRssDashboard(page);

    const widget = rssWidget(page);

    await expect(widget).toBeVisible();
    await expect(widget.getByRole('button', { name: /Cloudflare launch notes/i })).toBeVisible();
    await expect(widget.getByRole('button', { name: /Hacker News style story/i })).toBeVisible();

    await widget.getByRole('button', { name: /Cloudflare launch notes/i }).click();

    await expect(widget.getByRole('heading', { name: 'Cloudflare launch notes' })).toBeVisible();
    await expect(widget).toContainText('Reader-friendly full text from the feed.');
    await expect(widget).toContainText('Full article from feed');
    await expect(widget.getByRole('link', { name: 'Read in browser' })).toHaveAttribute('href', CLOUDFARE_ARTICLE_URL);

    await widget.getByRole('button', { name: /Hacker News style story/i }).click();

    await expect(widget.getByRole('heading', { name: 'Hacker News style story' })).toBeVisible();
    await expect(widget).toContainText('Reader mode extracted from original article');
    await expect(widget).toContainText('Extracted article body loaded from the original page.');
    await expect(widget.getByRole('link', { name: 'View discussion' })).toHaveAttribute('href', HACKER_NEWS_COMMENTS_URL);
  });

  test('renders the unavailable-content fallback state for link-only feeds', async ({ page }) => {
    await installRssMocks(page, 'unavailable');
    await seedRssDashboard(page);

    const widget = rssWidget(page);

    await expect(widget).toBeVisible();
    await widget.getByRole('button', { name: /Hacker News style story/i }).click();

    await expect(widget.getByRole('heading', { name: 'Hacker News style story' })).toBeVisible();
    await expect(widget).toContainText('This feed did not include readable article content.');
    await expect(widget).toContainText('The original page blocked reader extraction for this story.');

    const fallbackPanel = widget.locator('.border-dashed');
    await expect(fallbackPanel.getByRole('link', { name: 'Read in browser' })).toHaveAttribute('href', HACKER_NEWS_ARTICLE_URL);
    await expect(fallbackPanel.getByRole('link', { name: 'View discussion' })).toHaveAttribute('href', HACKER_NEWS_COMMENTS_URL);
  });
});
