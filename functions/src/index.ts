import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { exchangeToken, refreshToken, googleClientId, googleClientSecret } from "./oauth";

// Define secrets for API keys
const airLabsApiKey = defineSecret("AIRLABS_API_KEY");

type ReaderExtractResponse =
  | {
      ok: true;
      article: {
        title: string;
        content: string;
        excerpt?: string;
        byline?: string;
        siteName?: string;
        image?: string;
      };
    }
  | {
      ok: false;
      reason: string;
    };

type ReaderCacheEntry = {
  expiresAt: number;
  payload: ReaderExtractResponse;
};

const READER_CACHE_TTL_MS = 15 * 60 * 1000;
const READER_CACHE_MAX_ENTRIES = 100;
const readerArticleCache = new Map<string, ReaderCacheEntry>();

const isPrivateIpv4Address = (hostname: string): boolean => {
  const parts = hostname.split(".").map((part) => Number(part));

  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return false;
  }

  return parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
};

const isPrivateIpv6Address = (hostname: string): boolean => {
  const normalizedHost = hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();

  if (!normalizedHost.includes(":")) {
    return false;
  }

  return normalizedHost === "::1" ||
    normalizedHost.startsWith("fc") ||
    normalizedHost.startsWith("fd") ||
    normalizedHost.startsWith("fe80:");
};

const isDisallowedHostname = (hostname: string): boolean => {
  const normalizedHost = hostname.toLowerCase();

  return normalizedHost === "localhost" ||
    normalizedHost === "0.0.0.0" ||
    normalizedHost === "::1" ||
    normalizedHost === "[::1]" ||
    normalizedHost.endsWith(".local") ||
    isPrivateIpv4Address(normalizedHost) ||
    isPrivateIpv6Address(normalizedHost);
};

const getSafeRemoteUrl = (rawUrl: unknown): URL | null => {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return null;
  }

  try {
    const parsedUrl = new URL(rawUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return null;
    }

    if (isDisallowedHostname(parsedUrl.hostname)) {
      return null;
    }

    return parsedUrl;
  } catch {
    return null;
  }
};

const getCachedReaderArticle = (articleUrl: string): ReaderExtractResponse | null => {
  const cacheEntry = readerArticleCache.get(articleUrl);

  if (!cacheEntry) {
    return null;
  }

  if (cacheEntry.expiresAt <= Date.now()) {
    readerArticleCache.delete(articleUrl);
    return null;
  }

  return cacheEntry.payload;
};

const setCachedReaderArticle = (articleUrl: string, payload: ReaderExtractResponse): void => {
  if (readerArticleCache.size >= READER_CACHE_MAX_ENTRIES) {
    const oldestKey = readerArticleCache.keys().next().value;
    if (oldestKey) {
      readerArticleCache.delete(oldestKey);
    }
  }

  readerArticleCache.set(articleUrl, {
    expiresAt: Date.now() + READER_CACHE_TTL_MS,
    payload,
  });
};

const extractReadableArticle = async (articleUrl: URL): Promise<ReaderExtractResponse> => {
  try {
    const response = await fetch(articleUrl.toString(), {
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "User-Agent": "Boxento RSS Reader/1.0"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: `The original article returned ${response.status}.`
      };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return {
        ok: false,
        reason: "The linked page did not return HTML that Boxento can read inline."
      };
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url: articleUrl.toString() });

    try {
      const image = dom.window.document
        .querySelector('meta[property="og:image"], meta[name="twitter:image"]')
        ?.getAttribute("content") || undefined;
      const article = new Readability(dom.window.document).parse();
      const textContent = article?.textContent?.replace(/\s+/g, " ").trim() || "";

      if (!article?.content || textContent.length < 30) {
        return {
          ok: false,
          reason: "The original page did not expose enough readable article content for reader mode."
        };
      }

      return {
        ok: true,
        article: {
          title: article.title?.trim() || articleUrl.hostname,
          content: article.content,
          excerpt: article.excerpt?.trim() || undefined,
          byline: article.byline?.trim() || undefined,
          siteName: article.siteName?.trim() || undefined,
          image,
        }
      };
    } finally {
      dom.window.close();
    }
  } catch (error) {
    console.error("Error extracting article content:", error);
    return {
      ok: false,
      reason: "Boxento could not extract reader mode from the original page."
    };
  }
};

type RssFetchAttempt = {
  name: string;
  headers: Record<string, string>;
};

type Rss2JsonPayload = {
  status?: string;
  message?: string;
  feed?: {
    title?: string;
    link?: string;
    description?: string;
  };
  items?: Array<{
    title?: string;
    pubDate?: string;
    link?: string;
    guid?: string;
    author?: string;
    thumbnail?: string;
    description?: string;
    content?: string;
    enclosure?: {
      link?: string;
      type?: string;
    };
  }>;
};

const RSS_FETCH_ATTEMPTS: RssFetchAttempt[] = [
  {
    name: "boxento-rss",
    headers: {
      "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      "User-Agent": "Boxento RSS Reader/1.0 (+https://boxento.app)"
    }
  },
  {
    name: "browser-like",
    headers: {
      "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
    }
  },
  {
    name: "known-reader",
    headers: {
      "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      "User-Agent": "NetNewsWire/6.1.7 (Mac OS X)"
    }
  }
];

const RSS_RETRY_STATUSES = new Set([401, 403, 406, 408, 429, 500, 502, 503, 504]);

const looksLikeFeedPayload = (data: string): boolean => (
  /<\s*(rss|feed|channel|rdf:RDF)\b/i.test(data)
);

const escapeXml = (value: unknown): string => (
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
);

const wrapCdata = (value: unknown): string => (
  `<![CDATA[${String(value ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`
);

const formatRssDate = (value: string | undefined): string => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? value : parsedDate.toUTCString();
};

const rss2JsonPayloadToXml = (feedUrl: URL, payload: Rss2JsonPayload): string => {
  const feed = payload.feed || {};
  const items = payload.items || [];

  const itemXml = items.map((item) => {
    const content = item.content || item.description || "";
    const enclosureUrl = item.enclosure?.link || item.thumbnail || "";
    const enclosureType = item.enclosure?.type || (enclosureUrl ? "image/jpeg" : "");

    return [
      "    <item>",
      `      <title>${wrapCdata(item.title || "No Title")}</title>`,
      `      <link>${escapeXml(item.link || item.guid || "#")}</link>`,
      `      <guid>${escapeXml(item.guid || item.link || "")}</guid>`,
      item.pubDate ? `      <pubDate>${escapeXml(formatRssDate(item.pubDate))}</pubDate>` : "",
      item.author ? `      <dc:creator>${wrapCdata(item.author)}</dc:creator>` : "",
      item.description ? `      <description>${wrapCdata(item.description)}</description>` : "",
      content ? `      <content:encoded>${wrapCdata(content)}</content:encoded>` : "",
      enclosureUrl ? `      <enclosure url="${escapeXml(enclosureUrl)}" type="${escapeXml(enclosureType)}" />` : "",
      "    </item>"
    ].filter(Boolean).join("\n");
  }).join("\n");

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<rss version=\"2.0\" xmlns:content=\"http://purl.org/rss/1.0/modules/content/\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\">",
    "  <channel>",
    `    <title>${wrapCdata(feed.title || feedUrl.hostname)}</title>`,
    `    <link>${escapeXml(feed.link || feedUrl.origin)}</link>`,
    `    <description>${wrapCdata(feed.description || "")}</description>`,
    itemXml,
    "  </channel>",
    "</rss>"
  ].join("\n");
};

const fetchRssFeedViaRss2Json = async (feedUrl: URL): Promise<string> => {
  const fallbackUrl = new URL("https://api.rss2json.com/v1/api.json");
  fallbackUrl.searchParams.set("rss_url", feedUrl.toString());

  const response = await fetch(fallbackUrl.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Boxento RSS Reader/1.0 (+https://boxento.app)"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`rss2json returned ${response.status}`);
  }

  const payload = await response.json() as Rss2JsonPayload;
  if (payload.status !== "ok" || !payload.items?.length) {
    throw new Error(payload.message || "rss2json did not return feed items");
  }

  return rss2JsonPayloadToXml(feedUrl, payload);
};

const fetchRssFeed = async (feedUrl: URL): Promise<string> => {
  let lastStatus: number | null = null;
  let lastStatusText = "";
  let lastAttempt = "";
  let lastError: unknown = null;

  for (const attempt of RSS_FETCH_ATTEMPTS) {
    lastAttempt = attempt.name;

    try {
      const response = await fetch(feedUrl.toString(), {
        headers: {
          ...attempt.headers,
          ...(attempt.name === "browser-like" ? { "Referer": feedUrl.origin + "/" } : {})
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data = await response.text();
        if (looksLikeFeedPayload(data)) {
          return data;
        }

        lastStatus = response.status;
        lastStatusText = "Non-feed response";
        continue;
      }

      lastStatus = response.status;
      lastStatusText = response.statusText;

      if (!RSS_RETRY_STATUSES.has(response.status)) {
        break;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastStatus !== null) {
    const detail = lastStatusText ? ` ${lastStatusText}` : "";
    try {
      return await fetchRssFeedViaRss2Json(feedUrl);
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "fallback failed";
      throw new Error(`The feed server returned ${lastStatus}${detail} after the ${lastAttempt} request. Fallback also failed: ${fallbackMessage}`);
    }
  }

  try {
    return await fetchRssFeedViaRss2Json(feedUrl);
  } catch (fallbackError) {
    const directMessage = lastError instanceof Error ? lastError.message : "Could not reach RSS feed";
    const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "fallback failed";
    throw new Error(`${directMessage}. Fallback also failed: ${fallbackMessage}`);
  }
};

// Proxy for mindicador.cl API (Chilean economic indicators)
export const mindicadorProxy = onRequest(
  {
    cors: true,
    invoker: "public"
  },
  async (req, res) => {
    try {
      // Only allow GET requests
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Fetch from mindicador.cl
      const response = await fetch("https://mindicador.cl/api", {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Boxento/1.0"
        }
      });

      if (!response.ok) {
        throw new Error(`Mindicador API error: ${response.status}`);
      }

      const data = await response.json();

      // Cache for 5 minutes (UF updates daily, but we want fresh data)
      res.set("Cache-Control", "public, max-age=300");
      res.json(data);
    } catch (error) {
      console.error("Error fetching mindicador data:", error);
      res.status(500).json({
        error: "Failed to fetch data from mindicador.cl",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);

// Export OAuth functions with secrets (publicly accessible for OAuth flow) v2
export const oauthExchange = onRequest(
  {
    cors: true,
    secrets: [googleClientId, googleClientSecret],
    invoker: "public"  // Allow unauthenticated access
  },
  exchangeToken
);

export const oauthRefresh = onRequest(
  {
    cors: true,
    secrets: [googleClientId, googleClientSecret],
    invoker: "public"  // Allow unauthenticated access
  },
  refreshToken
);

// Proxy for AirLabs API (Flight tracking)
// Better free tier than AviationStack - 1000 requests/month with more features
export const flightProxy = onRequest(
  {
    cors: true,
    secrets: [airLabsApiKey],
    invoker: "public"
  },
  async (req, res) => {
    try {
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const apiKey = airLabsApiKey.value();
      if (!apiKey) {
        res.status(500).json({ error: "API key not configured" });
        return;
      }

      const { flight_iata, flight_icao, flight_date } = req.query;

      if (!flight_iata && !flight_icao) {
        res.status(400).json({ error: "Flight number is required" });
        return;
      }

      // Build the AirLabs API URL - use schedules endpoint for better date support
      const params = new URLSearchParams({ api_key: apiKey });
      if (flight_iata) params.append("flight_iata", flight_iata as string);
      if (flight_icao) params.append("flight_icao", flight_icao as string);

      // Use schedules endpoint which returns flight schedule data
      const apiUrl = `https://airlabs.co/api/v9/schedules?${params.toString()}`;
      const response = await fetch(apiUrl, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Boxento/1.0"
        }
      });

      if (!response.ok) {
        throw new Error(`AirLabs API error: ${response.status}`);
      }

      const data = await response.json();

      // Check for API errors in response
      if (data.error) {
        throw new Error(data.error.message || "AirLabs API error");
      }

      // Get flights from response array
      const flights = data.response;
      if (!flights || !Array.isArray(flights) || flights.length === 0) {
        res.json({ data: null, message: "Flight not found" });
        return;
      }

      // If date is provided, try to find a matching flight
      let flight = flights[0]; // Default to first result
      if (flight_date) {
        const targetDate = flight_date as string;
        const matchingFlight = flights.find((f: { dep_time?: string }) =>
          f.dep_time && f.dep_time.startsWith(targetDate)
        );
        if (matchingFlight) {
          flight = matchingFlight;
        }
      }

      // Return clean flight data
      const transformedData = {
        data: {
          flight_iata: flight.flight_iata,
          flight_icao: flight.flight_icao,
          flight_number: flight.flight_number,
          airline_name: flight.airline_name || `${flight.airline_iata} Airlines`,
          airline_iata: flight.airline_iata,
          status: flight.status,
          departure: {
            airport: flight.dep_name,
            city: flight.dep_city,
            country: flight.dep_country,
            iata: flight.dep_iata,
            icao: flight.dep_icao,
            terminal: flight.dep_terminal,
            gate: flight.dep_gate,
            scheduled: flight.dep_time,
            scheduled_utc: flight.dep_time_utc,
            estimated: flight.dep_estimated,
            actual: flight.dep_actual,
            delay: flight.dep_delayed
          },
          arrival: {
            airport: flight.arr_name,
            city: flight.arr_city,
            country: flight.arr_country,
            iata: flight.arr_iata,
            icao: flight.arr_icao,
            terminal: flight.arr_terminal,
            gate: flight.arr_gate,
            baggage: flight.arr_baggage,
            scheduled: flight.arr_time,
            scheduled_utc: flight.arr_time_utc,
            estimated: flight.arr_estimated,
            actual: flight.arr_actual,
            delay: flight.arr_delayed
          },
          duration: flight.duration,
          progress: flight.percent || 0,
          aircraft: {
            registration: flight.reg_number,
            icao: flight.aircraft_icao
          },
          live: flight.lat && flight.lng ? {
            latitude: flight.lat,
            longitude: flight.lng,
            altitude: flight.alt,
            speed: flight.speed,
            heading: flight.dir
          } : null
        }
      };

      // Cache for 2 minutes
      res.set("Cache-Control", "public, max-age=120");
      res.json(transformedData);
    } catch (error) {
      console.error("Error fetching flight data:", error);
      res.status(500).json({
        error: "Failed to fetch flight data",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);

// CORS Proxy for RSS feeds
// Replaces third-party allorigins.win dependency with our own proxy
export const rssProxy = onRequest(
  {
    cors: true,
    invoker: "public"
  },
  async (req, res) => {
    try {
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const articleUrl = getSafeRemoteUrl(req.query.articleUrl);
      if (req.query.articleUrl) {
        if (!articleUrl) {
          res.status(400).json({ error: "Invalid article URL format" });
          return;
        }

        const cacheKey = articleUrl.toString();
        const cachedPayload = getCachedReaderArticle(cacheKey);
        if (cachedPayload) {
          res.set("Content-Type", "application/json; charset=utf-8");
          res.set("Cache-Control", "public, max-age=900");
          res.json(cachedPayload);
          return;
        }

        const payload = await extractReadableArticle(articleUrl);
        setCachedReaderArticle(cacheKey, payload);

        res.set("Content-Type", "application/json; charset=utf-8");
        res.set("Cache-Control", payload.ok ? "public, max-age=900" : "public, max-age=300");
        res.json(payload);
        return;
      }

      const feedUrl = getSafeRemoteUrl(req.query.url);
      if (!feedUrl) {
        res.status(400).json({ error: "Invalid URL format" });
        return;
      }

      const data = await fetchRssFeed(feedUrl);

      // Set appropriate headers
      res.set("Content-Type", "application/xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=300"); // Cache for 5 minutes
      res.send(data);
    } catch (error) {
      console.error("Error fetching RSS feed:", error);
      res.status(502).json({
        error: "Failed to fetch RSS feed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);

// Proxy for currency exchange rates using Frankfurter API (completely free, no key needed)
// Centralizes currency data so users don't need their own API keys
export const currencyProxy = onRequest(
  {
    cors: true,
    invoker: "public"
  },
  async (req, res) => {
    try {
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const base = (req.query.base as string) || "USD";
      const symbols = req.query.symbols as string; // Optional: comma-separated list

      // Build the Frankfurter API URL
      let apiUrl = `https://api.frankfurter.app/latest?from=${base}`;
      if (symbols) {
        apiUrl += `&to=${symbols}`;
      }

      const response = await fetch(apiUrl, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Boxento/1.0"
        }
      });

      if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status}`);
      }

      const data = await response.json();

      // Transform to match Open Exchange Rates format for compatibility
      const transformedData = {
        base: data.base,
        date: data.date,
        rates: data.rates
      };

      // Cache for 1 hour (exchange rates don't change that frequently)
      res.set("Cache-Control", "public, max-age=3600");
      res.json(transformedData);
    } catch (error) {
      console.error("Error fetching currency rates:", error);
      res.status(500).json({
        error: "Failed to fetch currency rates",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);
