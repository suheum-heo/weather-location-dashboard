import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./prisma.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

type OpenWeatherResponse = {
  name?: string;
  sys?: { country?: string };
  main?: { temp?: number };
  weather?: Array<{ description?: string }>;
  message?: string;
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/weather", async (req, res) => {
  try {
    const city = String(req.query.city ?? "").trim();
    if (!city) return res.status(400).json({ error: "Missing ?city= parameter" });
    if (!OPENWEATHER_API_KEY) return res.status(500).json({ error: "Server missing OPENWEATHER_API_KEY" });

    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?q=${encodeURIComponent(city)}` +
      `&appid=${encodeURIComponent(OPENWEATHER_API_KEY)}` +
      `&units=metric`;

    const resp = await fetch(url);
    const data = (await resp.json()) as OpenWeatherResponse;

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.message ?? "OpenWeather error",
      });
    }

    const result = {
      city: data?.name ?? city,
      country: data?.sys?.country ?? null,
      temp: data?.main?.temp ?? null,
      description: data?.weather?.[0]?.description ?? null,
    };

    await prisma.recentSearch.create({
      data: {
        city: result.city,
        country: result.country,
      },
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
    take: 5,
  });
  res.json(searches);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
