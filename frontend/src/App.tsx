import { useEffect, useMemo, useState } from "react";

type NewsItem = {
  title: string;
  source: string | null;
  url: string;
  publishedAt: string | null;
  description: string | null;
};

type WeatherResult = {
  city: string;
  country: string | null;
  temp: number | null;
  description: string | null;
  aqi: number | null;
  aqiText: string | null;
  news: NewsItem[];
  error?: string;
};

type RecentItem = {
  id: number;
  city: string;
  country: string | null;
  createdAt: string;
};

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function App() {
  const [city, setCity] = useState("Seoul");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WeatherResult | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const theme = useMemo(() => {
    const bg = dark ? "#0b0f19" : "#f6f7fb";
    const card = dark ? "#121a2a" : "#ffffff";
    const text = dark ? "#e7eaf2" : "#0f172a";
    const sub = dark ? "#b7c0d6" : "#475569";
    const border = dark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)";
    const chip = dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
    return { bg, card, text, sub, border, chip };
  }, [dark]);

  async function loadRecent() {
    try {
      const r = await fetch("http://localhost:4000/api/recent");
      const data = await r.json();
      if (r.ok) setRecent(data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadRecent();
  }, []);

  function aqiDisplay(aqi: number | null, aqiText: string | null) {
    if (!aqi) return "—";
    return `${aqi} (${aqiText ?? "AQI"})`;
  }

  async function onSearch(nextCity?: string) {
    const q = (nextCity ?? city).trim();
    if (!q) return;

    setLoading(true);
    setResult(null);

    try {
      const resp = await fetch(`http://localhost:4000/api/weather?city=${encodeURIComponent(q)}`);
      const data = await resp.json();

      if (!resp.ok) {
        setResult({
          city: q,
          country: null,
          temp: null,
          description: null,
          aqi: null,
          aqiText: null,
          news: [],
          error: data?.error ?? "Error",
        });
      } else {
        setResult(data);
        await loadRecent();
      }
    } catch {
      setResult({
        city: q,
        country: null,
        temp: null,
        description: null,
        aqi: null,
        aqiText: null,
        news: [],
        error: "Cannot reach backend. Is it running?",
      });
    } finally {
      setLoading(false);
    }
  }

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div
      style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: 16,
        boxShadow: dark ? "none" : "0 10px 25px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div style={{ fontWeight: 800, color: theme.text, marginBottom: 10 }}>{title}</div>
      <div style={{ color: theme.sub }}>{children}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, padding: 20 }}>
      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: theme.bg,
          paddingBottom: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: theme.text }}>Weather & Location</div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setDark((v) => !v)}
            style={{
              border: `1px solid ${theme.border}`,
              background: theme.card,
              color: theme.text,
              padding: "8px 12px",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
        </div>

        {/* Search row */}
        <div style={{ maxWidth: 900, margin: "12px auto 0", display: "flex", gap: 10 }}>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Search a city (e.g., Seoul)"
            style={{
              flex: 1,
              padding: 12,
              fontSize: 16,
              borderRadius: 14,
              border: `1px solid ${theme.border}`,
              background: theme.card,
              color: theme.text,
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
          />
          <button
            onClick={() => onSearch()}
            disabled={loading}
            style={{
              padding: "12px 14px",
              fontSize: 16,
              borderRadius: 14,
              border: `1px solid ${theme.border}`,
              background: theme.card,
              color: theme.text,
              cursor: "pointer",
              fontWeight: 800,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </div>

        {/* Recent chips */}
        {recent.length > 0 && (
          <div style={{ maxWidth: 900, margin: "10px auto 0" }}>
            <div style={{ color: theme.sub, fontWeight: 700, marginBottom: 8 }}>Recent</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {recent.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setCity(r.city);
                    onSearch(r.city);
                  }}
                  style={{
                    border: `1px solid ${theme.border}`,
                    background: theme.chip,
                    color: theme.text,
                    padding: "6px 10px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {r.city}
                  {r.country ? `, ${r.country}` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card title="Weather">
          {!result && !loading && <div>Search a city to see results.</div>}

          {result?.error && (
            <div>
              <div style={{ fontWeight: 900, color: theme.text, marginBottom: 6 }}>Error</div>
              <div>{result.error}</div>
            </div>
          )}

          {result && !result.error && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: theme.text }}>
                {result.city}
                {result.country ? `, ${result.country}` : ""}
              </div>
              <div style={{ marginTop: 8 }}>
                Temperature: <b style={{ color: theme.text }}>{result.temp ?? "—"}°C</b>
              </div>
              <div>
                Description: <b style={{ color: theme.text }}>{result.description ?? "—"}</b>
              </div>
            </div>
          )}
        </Card>

        <Card title="Air Quality">
          {result && !result.error ? (
            <div>
              <div>
                AQI: <b style={{ color: theme.text }}>{aqiDisplay(result.aqi, result.aqiText)}</b>
              </div>
              <div style={{ marginTop: 8, fontSize: 13 }}>
                OpenWeather AQI scale: 1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=Very Poor
              </div>
            </div>
          ) : (
            <div>Search a city to see air quality.</div>
          )}
        </Card>

        {/* News */}
        <div style={{ gridColumn: "1 / -1" }}>
          <div
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 900, color: theme.text, marginBottom: 8 }}>Local News</div>

            {result && !result.error ? (
              result.news && result.news.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {result.news.map((n, idx) => (
                    <a
                      key={idx}
                      href={n.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        textDecoration: "none",
                        border: `1px solid ${theme.border}`,
                        borderRadius: 14,
                        padding: 12,
                        background: dark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
                      }}
                    >
                      <div style={{ fontWeight: 900, color: theme.text, marginBottom: 4 }}>
                        {n.title}
                      </div>
                      <div style={{ color: theme.sub, fontSize: 13 }}>
                        {(n.source ? n.source : "Unknown source")}{n.publishedAt ? ` • ${formatTime(n.publishedAt)}` : ""}
                      </div>
                      {n.description && (
                        <div style={{ color: theme.sub, marginTop: 6 }}>
                          {n.description}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ color: theme.sub }}>
                  No headlines found for this city right now (or your News API key isn’t set).
                </div>
              )
            ) : (
              <div style={{ color: theme.sub }}>Search a city to see headlines.</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "18px auto 0", color: theme.sub, fontSize: 12 }}>
        v0.3 — React + Express + Prisma + OpenWeather (weather + AQI) + NewsAPI (headlines)
      </div>
    </div>
  );
}
