import sanitizeHtml from 'sanitize-html';
import type { RSSFeedItem } from './types';

export interface RSSExtractedArticle {
  title: string;
  content: string;
  excerpt?: string;
  byline?: string;
  siteName?: string;
  image?: string;
}

export interface RSSArticleExtractionResponse {
  ok: boolean;
  article?: RSSExtractedArticle;
  reason?: string;
}

export type InlineReaderContentSource = 'content' | 'description';

export interface InlineReaderContent {
  html: string;
  source: InlineReaderContentSource;
}

const PLACEHOLDER_DESCRIPTION_PATTERNS = [
  /^comments?$/i,
  /^view comments?$/i,
  /^discuss$/i,
  /^source$/i,
];

const MIN_CONTENT_TEXT_LENGTH = 24;
const MIN_DESCRIPTION_TEXT_LENGTH = 140;
const MIN_DESCRIPTION_WORD_COUNT = 24;

const readerSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption', 'picture', 'source']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'srcset', 'sizes', 'loading'],
    source: ['srcset', 'sizes', 'type', 'media'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer',
    }),
    img: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        loading: attribs.loading || 'lazy',
      },
    }),
  },
};

const stripHtml = (html?: string): string => {
  if (!html) return '';

  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  }).replace(/\s+/g, ' ').trim();
};

const countWords = (text: string): number => {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

const isMeaningfulContent = (html?: string): boolean => {
  const text = stripHtml(html);

  if (!text) return false;

  if (PLACEHOLDER_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return false;
  }

  return text.length >= MIN_CONTENT_TEXT_LENGTH;
};

const isMeaningfulDescription = (html?: string): boolean => {
  const text = stripHtml(html);

  if (!text) return false;

  if (PLACEHOLDER_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return false;
  }

  return text.length >= MIN_DESCRIPTION_TEXT_LENGTH || countWords(text) >= MIN_DESCRIPTION_WORD_COUNT;
};

export const sanitizeReaderHtml = (html: string): string => sanitizeHtml(html, readerSanitizeOptions);

export const getInlineReaderContent = (
  item: Pick<RSSFeedItem, 'content' | 'description'>
): InlineReaderContent | null => {
  if (isMeaningfulContent(item.content)) {
    return {
      html: item.content || '',
      source: 'content',
    };
  }

  if (isMeaningfulDescription(item.description)) {
    return {
      html: item.description || '',
      source: 'description',
    };
  }

  return null;
};

export const shouldExtractReaderContent = (
  item: Pick<RSSFeedItem, 'link' | 'content' | 'description'>
): boolean => Boolean(item.link && getInlineReaderContent(item) === null);

export const getReaderPreviewText = (
  item: Pick<RSSFeedItem, 'content' | 'description'>
): string => {
  const inlineContent = getInlineReaderContent(item);
  return inlineContent ? stripHtml(inlineContent.html) : '';
};
