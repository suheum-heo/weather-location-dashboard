import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./prisma.js";
import { XMLParser } from "fast-xml-parser";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

type OpenWeatherCurrent = {
  coord?: { lon?: number; lat?: number };
  name?: string;
  sys?: { country?: string }; // ISO alpha-2 like KR/US
  main?: { temp?: number };
  weather?: Array<{ description?: string }>;
  message?: string;
};

type OpenWeatherAir = {
  list?: Array<{ main?: { aqi?: number } }>;
  message?: string;
};

function aqiLabel(aqi: number | null) {
  switch (aqi) {
    case 1:
      return "Good";
    case 2:
      return "Fair";
    case 3:
      return "Moderate";
    case 4:
      return "Poor";
    case 5:
      return "Very Poor";
    default:
      return null;
  }
}

function makeCityKey(city: string, country: string | null) {
  const c = city.trim().toLowerCase().replace(/\s+/g, " ");
  const k = (country ?? "").trim().toLowerCase();
  return `${c}|${k}`;
}

// Strip HTML and decode common entities so RSS descriptions don’t show <a href=...> in UI
function cleanHtmlToText(input: string | null | undefined) {
  if (!input) return null;

  // Remove tags
  let s = input.replace(/<[^>]*>/g, " ");

  // Decode the common entities we actually see
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  // Some RSS descriptions are basically empty after cleaning
  if (!s || s.length < 3) return null;

  return s;
}

// Local news in ENGLISH via Google News RSS edition settings.
async function fetchGoogleNewsRss(city: string, country: string | null) {
  const cc = (country ?? "US").toUpperCase();
  const hl = `en-${cc}`;
  const gl = cc;
  const ceid = `${cc}:en`;

  const q = `"${city}" when:7d`;
  const rssUrl =
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}` +
    `&hl=${encodeURIComponent(hl)}` +
    `&gl=${encodeURIComponent(gl)}` +
    `&ceid=${encodeURIComponent(ceid)}`;

  const resp = await fetch(rssUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!resp.ok) return [];

  const xml = await resp.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const parsed = parser.parse(xml);

  const items = parsed?.rss?.channel?.item;
  const arr = Array.isArray(items) ? items : items ? [items] : [];

  return arr
    .filter((it: any) => it?.title && it?.link)
    .slice(0, 10)
    .map((it: any) => {
      const title = String(it.title);

      const source =
        it?.source && typeof it.source === "object"
          ? String(it.source?.["#text"] ?? "")
          : it?.source
          ? String(it.source)
          : null;

      const descriptionText = cleanHtmlToText(it?.description);
      const url = String(it.link);
      const publishedAt = it?.pubDate ? new Date(it.pubDate).toISOString() : null;

      return {
        title,
        source: source && source.length > 0 ? source : null,
        url,
        publishedAt,
        description: descriptionText,
      };
    });
}

/**
 * Utility: attach isFavorite boolean to a list of recent rows
 */
async function attachFavoriteFlag<T extends { cityKey: string }>(rows: T[]) {
  if (rows.length === 0) return rows.map((r) => ({ ...r, isFavorite: false }));

  const keys = rows.map((r) => r.cityKey);
  const favs = await prisma.favoriteCity.findMany({
    where: { cityKey: { in: keys } },
    select: { cityKey: true },
  });
  const favSet = new Set(favs.map((f) => f.cityKey));

  return rows.map((r) => ({ ...r, isFavorite: favSet.has(r.cityKey) }));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/**
 * Favorites
 * - GET /api/favorites
 * - POST /api/favorites/toggle { city, country? }
 */
app.get("/api/favorites", async (_req, res) => {
  const favorites = await prisma.favoriteCity.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(favorites);
});

app.post("/api/favorites/toggle", async (req, res) => {
  try {
    const city = String(req.body?.city ?? "").trim();
    const countryRaw = req.body?.country;
    const country = countryRaw == null ? null : String(countryRaw).trim();

    if (!city) return res.status(400).json({ error: "Missing city" });

    const cityKey = makeCityKey(city, country);

    const existing = await prisma.favoriteCity.findUnique({ where: { cityKey } });

    if (existing) {
      await prisma.favoriteCity.delete({ where: { cityKey } });
      return res.json({ cityKey, isFavorite: false });
    }

    await prisma.favoriteCity.create({
      data: { city, country, cityKey },
    });

    return res.json({ cityKey, isFavorite: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

app.get("/api/weather", async (req, res) => {
  try {
    const cityQuery = String(req.query.city ?? "").trim();
    if (!cityQuery) return res.status(400).json({ error: "Missing ?city= parameter" });
    if (!OPENWEATHER_API_KEY) return res.status(500).json({ error: "Server missing OPENWEATHER_API_KEY" });

    // 1) Weather
    const weatherUrl =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?q=${encodeURIComponent(cityQuery)}` +
      `&appid=${encodeURIComponent(OPENWEATHER_API_KEY)}` +
      `&units=metric`;

    const weatherResp = await fetch(weatherUrl);
    const weatherData = (await weatherResp.json()) as OpenWeatherCurrent;

    if (!weatherResp.ok) {
      return res.status(weatherResp.status).json({
        error: weatherData?.message ?? "OpenWeather error",
      });
    }

    const city = weatherData?.name ?? cityQuery;
    const country = weatherData?.sys?.country ?? null;
    const lat = weatherData?.coord?.lat ?? null;
    const lon = weatherData?.coord?.lon ?? null;

    // 2) Air quality (optional)
    let aqi: number | null = null;
    let aqiText: string | null = null;

    if (lat != null && lon != null) {
      const airUrl =
        `https://api.openweathermap.org/data/2.5/air_pollution` +
        `?lat=${encodeURIComponent(String(lat))}` +
        `&lon=${encodeURIComponent(String(lon))}` +
        `&appid=${encodeURIComponent(OPENWEATHER_API_KEY)}`;

      const airResp = await fetch(airUrl);
      const airData = (await airResp.json()) as OpenWeatherAir;

      if (airResp.ok) {
        aqi = airData?.list?.[0]?.main?.aqi ?? null;
        aqiText = aqiLabel(aqi);
      }
    }

    // 3) Local news (cleaned)
    const news = await fetchGoogleNewsRss(city, country);

    const cityKey = makeCityKey(city, country);

    // 4) Persist recent search
    await prisma.recentSearch.upsert({
      where: { cityKey },
      update: { city, country }, // updatedAt auto-updates
      create: { city, country, cityKey },
    });

    // 5) Favorite flag
    const fav = await prisma.favoriteCity.findUnique({ where: { cityKey } });

    return res.json({
      city,
      country,
      lat,
      lon,
      temp: weatherData?.main?.temp ?? null,
      description: weatherData?.weather?.[0]?.description ?? null,
      aqi,
      aqiText,
      news,
      isFavorite: !!fav,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

app.get("/api/recent", async (_req, res) => {
  const searches = await prisma.recentSearch.findMany({
    // ordering by updatedAt makes “recent” reflect latest searches even with upsert
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  const withFav = await attachFavoriteFlag(searches);
  res.json(withFav);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

app.delete("/api/recent", async (_req, res) => {
  await prisma.recentSearch.deleteMany({});
  res.json({ ok: true });
});
