const HTML_RESPONSE_PATTERN = /^\s*(?:<!doctype html|<html[\s>])/i;

const getStatusLabel = (response?: Response) => {
  if (!response || response.status === 0) return '';

  return ` (HTTP ${response.status})`;
};

const getContentType = (response?: Response) => (
  response?.headers.get('content-type')?.toLowerCase() ?? ''
);

export const getJsonResponseParseErrorMessage = (
  body: string,
  response?: Response,
  sourceLabel = 'The API endpoint',
) => {
  const trimmedBody = body.trim();
  const statusLabel = getStatusLabel(response);

  if (!trimmedBody) {
    return `${sourceLabel} returned an empty response instead of JSON${statusLabel}. Check the API URL or backend response.`;
  }

  const contentType = getContentType(response);
  const returnedHtml = contentType.includes('text/html') || HTML_RESPONSE_PATTERN.test(trimmedBody);

  if (returnedHtml) {
    return `${sourceLabel} returned HTML instead of JSON${statusLabel}. Check the API URL, backend proxy, or authentication.`;
  }

  return `${sourceLabel} returned invalid JSON${statusLabel}. Check the API URL or backend response.`;
};

export const parseJsonResponseText = <T>(
  body: string,
  response?: Response,
  sourceLabel?: string,
): T => {
  try {
    return JSON.parse(body.trim()) as T;
  } catch {
    throw new SyntaxError(getJsonResponseParseErrorMessage(body, response, sourceLabel));
  }
};
