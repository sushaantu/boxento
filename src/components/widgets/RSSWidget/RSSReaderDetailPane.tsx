import React from 'react';
import { AlertCircle, ExternalLink, LoaderCircle, Rss } from 'lucide-react';

import { Button } from '../../ui/button';
import { Skeleton } from '../../ui/skeleton';
import type { RSSFeedItem } from './types';
import type { RSSExtractedArticle, InlineReaderContent } from './reader';

export type RSSReaderContentState =
  | {
      status: 'loading';
    }
  | {
      status: 'ready';
      article: RSSExtractedArticle;
    }
  | {
      status: 'unavailable';
      reason: string;
    };

interface RSSReaderDetailPaneProps {
  article: RSSFeedItem | null;
  articleCount: number;
  formattedDate?: string;
  readerByline?: string;
  readerImage?: string;
  readerSourceLabel?: string;
  extractedArticle?: RSSExtractedArticle | null;
  inlineReaderContent?: InlineReaderContent | null;
  readerState?: RSSReaderContentState;
  sanitizedReaderHtml: string;
}

export function RSSReaderDetailPane({
  article,
  articleCount,
  formattedDate = '',
  readerByline = '',
  readerImage = '',
  readerSourceLabel = '',
  extractedArticle = null,
  inlineReaderContent = null,
  readerState,
  sanitizedReaderHtml,
}: RSSReaderDetailPaneProps): React.ReactElement {
  if (!article) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <Rss size={32} className="mb-3 text-muted-foreground/40" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">
          Select an article to read
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {articleCount} article{articleCount !== 1 ? 's' : ''} available
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-5">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
        {article.title}
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {article.feedTitle && (
          <span className="font-medium text-muted-foreground">
            {article.feedTitle}
          </span>
        )}
        {article.feedTitle && formattedDate && (
          <span className="text-muted-foreground/40">|</span>
        )}
        {formattedDate && (
          <span>{formattedDate}</span>
        )}
        {readerByline && (
          <>
            <span className="text-muted-foreground/40">|</span>
            <span>{readerByline}</span>
          </>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} />
            Read in browser
          </a>
        </Button>
        {article.commentsLink && article.commentsLink !== article.link && (
          <Button asChild size="sm" variant="outline">
            <a
              href={article.commentsLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              View discussion
            </a>
          </Button>
        )}
        {readerSourceLabel && (
          <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {readerSourceLabel}
          </span>
        )}
      </div>
      {readerImage && (
        <div className="mt-6 overflow-hidden rounded-md border border-border bg-muted/20">
          <img
            src={readerImage}
            alt={article.title}
            className="media-outline max-h-72 w-full object-cover"
          />
        </div>
      )}
      <div className="mt-6 border-t border-border pt-6">
        {readerState?.status === 'loading' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <LoaderCircle size={16} className="animate-spin" />
              Loading reader mode...
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ) : sanitizedReaderHtml ? (
          <div className="mx-auto max-w-3xl">
            {!inlineReaderContent && extractedArticle?.excerpt && (
              <p className="mb-6 border-l-2 border-border pl-4 text-base leading-7 text-muted-foreground">
                {extractedArticle.excerpt}
              </p>
            )}
            <div
              className="rich-media-outline text-[15px] leading-7 text-foreground [&_a]:font-medium [&_a]:text-blue-600 [&_a]:underline-offset-4 hover:[&_a]:underline [&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_figure]:my-6 [&_figcaption]:mt-2 [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_img]:my-6 [&_img]:rounded-xl [&_li]:my-2 [&_ol]:my-5 [&_ol]:pl-6 [&_p]:my-4 [&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-4 [&_ul]:my-5 [&_ul]:pl-6"
              dangerouslySetInnerHTML={{
                __html: sanitizedReaderHtml
              }}
            />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  This feed did not include readable article content.
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {readerState?.status === 'unavailable'
                    ? readerState.reason
                    : 'Boxento only received a link for this story, so there is nothing to render inline yet.'}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button asChild size="sm">
                    <a
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} />
                      Read in browser
                    </a>
                  </Button>
                  {article.commentsLink && article.commentsLink !== article.link && (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={article.commentsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View discussion
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
