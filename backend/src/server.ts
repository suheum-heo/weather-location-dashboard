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
    case 1: return "Good";
    case 2: return "Fair";
    case 3: return "Moderate";
    case 4: return "Poor";
    case 5: return "Very Poor";
    default: return null;
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
// We bias to local sources via gl/ceid but keep English.
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

      // Google News RSS "source" element exists in many entries
      const source =
        it?.source && typeof it.source === "object"
          ? String(it.source?.["#text"] ?? "")
          : it?.source
            ? String(it.source)
            : null;

      // Description frequently contains HTML
      const descriptionText = cleanHtmlToText(it?.description);

      // Link is often a Google redirect; still OK to open
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
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

    const result = {
      city,
      country,
      temp: weatherData?.main?.temp ?? null,
      description: weatherData?.weather?.[0]?.description ?? null,
      aqi,
      aqiText,
      news,
    };

    const cityKey = makeCityKey(result.city, result.country);

    await prisma.recentSearch.upsert({
      where: { cityKey },
      update: { city: result.city, country: result.country }, // updatedAt auto-updates
      create: { city: result.city, country: result.country, cityKey },
    });

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

app.get("/api/recent", async (_req, res) => {
  const searches = await prisma.recentSearch.findMany({
    orderBy: { createdAt: "desc" },
    take: 7,
  });
  res.json(searches);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
