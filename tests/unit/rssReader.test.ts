import { describe, expect, it } from 'vitest';

import {
  getInlineReaderContent,
  sanitizeReaderHtml,
  shouldExtractReaderContent,
} from '@/components/widgets/RSSWidget/reader';

describe('RSS reader content heuristics', () => {
  it('prefers feed content when an item ships full article HTML', () => {
    const inlineContent = getInlineReaderContent({
      content: '<p>Short but complete feed post with enough words to read inline.</p>',
      description: '<p>This fallback should not be used.</p>',
    });

    expect(inlineContent).toEqual({
      html: '<p>Short but complete feed post with enough words to read inline.</p>',
      source: 'content',
    });
  });

  it('treats placeholder comment-only descriptions as extraction candidates', () => {
    const item = {
      link: 'https://example.com/story',
      description: '<a href="https://news.ycombinator.com/item?id=1">Comments</a>',
    };

    expect(getInlineReaderContent(item)).toBeNull();
    expect(shouldExtractReaderContent(item)).toBe(true);
  });

  it('accepts long descriptions as readable inline content', () => {
    const item = {
      link: 'https://example.com/story',
      description: '<p>Boxento should keep a detailed summary inline when the feed already provides a substantial amount of text for the article reader and the user does not need to leave the dashboard to understand the story.</p>',
    };

    expect(getInlineReaderContent(item)).toEqual({
      html: item.description,
      source: 'description',
    });
    expect(shouldExtractReaderContent(item)).toBe(false);
  });

  it('sanitizes reader markup while preserving safe article elements', () => {
    const html = sanitizeReaderHtml(
      '<p>Hello<script>alert(1)</script><a href="https://example.com">Read more</a><img src="https://example.com/image.jpg" alt="Example"></p>'
    );

    expect(html).not.toContain('<script');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('<img');
  });
});
