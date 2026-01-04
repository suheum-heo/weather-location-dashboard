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

type OpenWeatherGeoItem = {
  name?: string;
  lat?: number;
  lon?: number;
  country?: string;
  state?: string;
};

type ReverseGeo = {
  displayName: string | null;
  region: string | null;      // state / province / region
  regionCode: string | null;  // sometimes ISO-like (e.g., US-WI), not guaranteed
  county: string | null;
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

/* ---------------- Reverse geocode (Nominatim) ----------------
   Small cache to avoid spamming. Rounds coords to 3 decimals.
*/
const reverseCache = new Map<string, ReverseGeo>();

function coordKey(lat: number, lon: number) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeo> {
  const key = coordKey(lat, lon);
  const cached = reverseCache.get(key);
  if (cached) return cached;

  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?format=jsonv2` +
    `&lat=${encodeURIComponent(String(lat))}` +
    `&lon=${encodeURIComponent(String(lon))}` +
    `&zoom=10` +
    `&addressdetails=1`;

  try {
    const resp = await fetch(url, {
      headers: {
        // Nominatim asks for a descriptive UA.
        "User-Agent": "weather-location-dashboard/1.0 (local dev)",
        "Accept": "application/json",
      },
    });

    if (!resp.ok) {
      const fallback: ReverseGeo = { displayName: null, region: null, regionCode: null, county: null };
      reverseCache.set(key, fallback);
      return fallback;
    }

    const data: any = await resp.json();
    const addr = data?.address ?? {};

    const region =
      addr.state ??
      addr.province ??
      addr.region ??
      addr.state_district ??
      null;

    const regionCode =
      addr.state_code ??
      addr["ISO3166-2-lvl4"] ??
      addr["ISO3166-2-lvl3"] ??
      null;

    const county = addr.county ?? null;

    const out: ReverseGeo = {
      displayName: typeof data?.display_name === "string" ? data.display_name : null,
      region: region && typeof region === "string" ? region : null,
      regionCode: regionCode && typeof regionCode === "string" ? regionCode : null,
      county: county && typeof county === "string" ? county : null,
    };

    reverseCache.set(key, out);
    return out;
  } catch {
    const fallback: ReverseGeo = { displayName: null, region: null, regionCode: null, county: null };
    reverseCache.set(key, fallback);
    return fallback;
  }
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

app.get("/api/geo", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.status(400).json({ error: "Missing ?q=" });
    if (!OPENWEATHER_API_KEY) return res.status(500).json({ error: "Server missing OPENWEATHER_API_KEY" });

    const limit = 5;
    const url =
      `https://api.openweathermap.org/geo/1.0/direct` +
      `?q=${encodeURIComponent(q)}` +
      `&limit=${limit}` +
      `&appid=${encodeURIComponent(OPENWEATHER_API_KEY)}`;

    const resp = await fetch(url);
    const data = (await resp.json()) as OpenWeatherGeoItem[];

    if (!resp.ok) return res.status(resp.status).json({ error: "Geocoding failed" });

    const out = (Array.isArray(data) ? data : [])
      .filter((x) => x?.name && x?.country && x?.lat != null && x?.lon != null)
      .map((x) => ({
        name: x.name!,
        country: x.country!,
        state: x.state ?? null,
        lat: x.lat!,
        lon: x.lon!,
      }));

    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

app.get("/api/weatherByCoords", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: "Missing/invalid lat/lon" });
    }
    if (!OPENWEATHER_API_KEY) return res.status(500).json({ error: "Server missing OPENWEATHER_API_KEY" });

    const weatherUrl =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${encodeURIComponent(String(lat))}` +
      `&lon=${encodeURIComponent(String(lon))}` +
      `&appid=${encodeURIComponent(OPENWEATHER_API_KEY)}` +
      `&units=metric`;

    const weatherResp = await fetch(weatherUrl);
    const weatherData = (await weatherResp.json()) as OpenWeatherCurrent;

    if (!weatherResp.ok) {
      return res.status(weatherResp.status).json({
        error: weatherData?.message ?? "OpenWeather error",
      });
    }

    const city = weatherData?.name ?? "Unknown";
    const country = weatherData?.sys?.country ?? null;

    // AQI
    let aqi: number | null = null;
    let aqiText: string | null = null;

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

    // reverse geocode (your nominatim function)
    let geo: ReverseGeo = { displayName: null, region: null, regionCode: null, county: null };
    geo = await reverseGeocode(lat, lon);

    const news = await fetchGoogleNewsRss(city, country);
    const cityKey = makeCityKey(city, country);

    await prisma.recentSearch.upsert({
      where: { cityKey },
      update: { city, country },
      create: { city, country, cityKey },
    });

    const fav = await prisma.favoriteCity.findUnique({ where: { cityKey } });

    return res.json({
      city,
      country,
      lat,
      lon,
      region: geo.region,
      regionCode: geo.regionCode,
      county: geo.county,
      displayName: geo.displayName,
      temp: weatherData?.main?.temp ?? null,
      description: weatherData?.weather?.[0]?.description ?? null,
      aqi,
      aqiText,
      news,
      isFavorite: !!fav,
    });
  } catch (e) {
    console.error(e);
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

    // 2.5) Reverse geocode (optional)
    let geo: ReverseGeo = { displayName: null, region: null, regionCode: null, county: null };
    if (lat != null && lon != null) {
      geo = await reverseGeocode(lat, lon);
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
      // reverse-geocode fields
      region: geo.region,
      regionCode: geo.regionCode,
      county: geo.county,
      displayName: geo.displayName,

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

app.delete("/api/recent", async (_req, res) => {
  await prisma.recentSearch.deleteMany({});
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
