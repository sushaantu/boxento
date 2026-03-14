import { expect, test } from '@playwright/test';

import { seedDashboard } from './helpers/dashboardSeed';

const FULL_TEXT_FEED_URL = 'https://feeds.example/full-text.xml';
const LINK_ONLY_FEED_URL = 'https://feeds.example/link-only.xml';
const ARTICLE_URL = 'https://example.com/story';
const COMMENTS_URL = 'https://news.ycombinator.com/item?id=123';

const FULL_TEXT_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Boxento Full Text</title>
    <item>
      <title>Cloudflare launch notes</title>
      <link>https://blog.cloudflare.com/launch-notes</link>
      <description><![CDATA[<p>This summary should not be used when full content is available.</p>]]></description>
      <content:encoded><![CDATA[
        <p>Reader-friendly full text from the feed.</p>
        <p>The RSS reader should render this article inline with clean spacing and typography.</p>
      ]]></content:encoded>
      <pubDate>Fri, 14 Mar 2026 12:00:00 GMT</pubDate>
      <author>Cloudflare</author>
    </item>
  </channel>
</rss>`;

const LINK_ONLY_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Link Only Feed</title>
    <item>
      <title>Hacker News style story</title>
      <link>${ARTICLE_URL}</link>
      <comments>${COMMENTS_URL}</comments>
      <description><![CDATA[<a href="${COMMENTS_URL}">Comments</a>]]></description>
      <pubDate>Fri, 14 Mar 2026 12:05:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const EXTRACTED_ARTICLE_RESPONSE = {
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
};

const UNAVAILABLE_ARTICLE_RESPONSE = {
  ok: false,
  reason: 'The original page blocked reader extraction for this story.',
};

test.describe('RSS widget reader', () => {
  test('renders full-text feeds inline and extracts content for link-only feeds', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });

    await page.route('**/api/rss**', async (route) => {
      const requestUrl = new URL(route.request().url());
      const feedUrl = requestUrl.searchParams.get('url');
      const articleUrl = requestUrl.searchParams.get('articleUrl');

      if (feedUrl === FULL_TEXT_FEED_URL) {
        await route.fulfill({
          status: 200,
          contentType: 'application/xml; charset=utf-8',
          body: FULL_TEXT_FEED_XML,
        });
        return;
      }

      if (feedUrl === LINK_ONLY_FEED_URL) {
        await route.fulfill({
          status: 200,
          contentType: 'application/xml; charset=utf-8',
          body: LINK_ONLY_FEED_XML,
        });
        return;
      }

      if (articleUrl === ARTICLE_URL) {
        await page.waitForTimeout(150);
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify(EXTRACTED_ARTICLE_RESPONSE),
        });
        return;
      }

      await route.abort();
    });

    await seedDashboard(page, {
      widgets: [
        {
          id: 'rss-reader',
          type: 'rss',
          config: {
            title: 'Inbox Reader',
            feeds: [
              { url: FULL_TEXT_FEED_URL, title: 'Cloudflare Blog', enabled: true },
              { url: LINK_ONLY_FEED_URL, title: 'Hacker News', enabled: true },
            ],
            showDate: true,
            showAuthor: true,
            showImages: true,
            displayMode: 'list',
            openInNewTab: true,
          },
        },
      ],
      layouts: {
        lg: [
          { i: 'rss-reader', x: 0, y: 0, w: 6, h: 6, minW: 2, minH: 2 },
        ],
      },
    });

    const widget = page.locator('.react-grid-item[data-widget-id="rss-reader"]');
    const detailPane = widget.locator('.flex-1.overflow-y-auto').last();

    await expect(widget).toContainText('Cloudflare launch notes');
    await expect(widget).toContainText('Hacker News style story');

    await widget.getByRole('button', { name: /Cloudflare launch notes/i }).click();
    await expect(detailPane).toContainText('Reader-friendly full text from the feed.');
    await expect(detailPane).toContainText('Full article from feed');

    await detailPane.screenshot({
      path: testInfo.outputPath('rss-reader-full-text-detail.png'),
    });

    await widget.getByRole('button', { name: /Hacker News style story/i }).click();
    await expect(detailPane).toContainText('Loading reader mode...');
    await expect(detailPane).toContainText('Extracted article body loaded from the original page.');
    await expect(detailPane).toContainText('Reader mode extracted from original article');
    await expect(detailPane.getByRole('link', { name: 'View discussion' })).toHaveAttribute('href', COMMENTS_URL);

    await detailPane.screenshot({
      path: testInfo.outputPath('rss-reader-extracted-detail.png'),
    });
  });

  test('shows a clear fallback when reader extraction is unavailable', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });

    await page.route('**/api/rss**', async (route) => {
      const requestUrl = new URL(route.request().url());
      const feedUrl = requestUrl.searchParams.get('url');
      const articleUrl = requestUrl.searchParams.get('articleUrl');

      if (feedUrl === LINK_ONLY_FEED_URL) {
        await route.fulfill({
          status: 200,
          contentType: 'application/xml; charset=utf-8',
          body: LINK_ONLY_FEED_XML,
        });
        return;
      }

      if (articleUrl === ARTICLE_URL) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify(UNAVAILABLE_ARTICLE_RESPONSE),
        });
        return;
      }

      await route.abort();
    });

    await seedDashboard(page, {
      widgets: [
        {
          id: 'rss-reader',
          type: 'rss',
          config: {
            title: 'Inbox Reader',
            feeds: [
              { url: LINK_ONLY_FEED_URL, title: 'Hacker News', enabled: true },
            ],
            showDate: true,
            showAuthor: true,
            showImages: true,
            displayMode: 'list',
            openInNewTab: true,
          },
        },
      ],
      layouts: {
        lg: [
          { i: 'rss-reader', x: 0, y: 0, w: 6, h: 6, minW: 2, minH: 2 },
        ],
      },
    });

    const widget = page.locator('.react-grid-item[data-widget-id="rss-reader"]');
    const detailPane = widget.locator('.flex-1.overflow-y-auto').last();

    await widget.getByRole('button', { name: /Hacker News style story/i }).click();
    await expect(detailPane).toContainText('This feed did not include readable article content.');
    await expect(detailPane).toContainText('The original page blocked reader extraction for this story.');
    await expect(
      detailPane
        .locator('.border-dashed')
        .getByRole('link', { name: 'Read in browser' })
    ).toHaveAttribute('href', ARTICLE_URL);

    await detailPane.screenshot({
      path: testInfo.outputPath('rss-reader-fallback-detail.png'),
    });
  });
});
