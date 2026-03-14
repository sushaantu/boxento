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

      const response = await fetch(feedUrl.toString(), {
        headers: {
          "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml",
          "User-Agent": "Boxento RSS Reader/1.0"
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed: ${response.status}`);
      }

      const data = await response.text();

      // Set appropriate headers
      res.set("Content-Type", "application/xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=300"); // Cache for 5 minutes
      res.send(data);
    } catch (error) {
      console.error("Error fetching RSS feed:", error);
      res.status(500).json({
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
