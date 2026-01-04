import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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
  lat?: number | null;
  lon?: number | null;
  temp: number | null;
  description: string | null;
  aqi: number | null;
  aqiText: string | null;
  news: NewsItem[];
  isFavorite?: boolean;
  error?: string;
};

type RecentItem = {
  id: number;
  city: string;
  country: string | null;
  cityKey: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
};

type FavoriteItem = {
  id: number;
  city: string;
  country: string | null;
  cityKey: string;
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
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
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
    const accent = "#4f6ef7";
    const accentSoft = dark ? "rgba(79,110,247,0.18)" : "rgba(79,110,247,0.12)";
    return { bg, card, text, sub, border, chip, accent, accentSoft };
  }, [dark]);

  function aqiColor(aqi: number | null) {
    switch (aqi) {
      case 1:
        return "#22c55e";
      case 2:
        return "#84cc16";
      case 3:
        return "#eab308";
      case 4:
        return "#f97316";
      case 5:
        return "#ef4444";
      default:
        return theme.text;
    }
  }

  function staticMapUrl(lat: number, lon: number) {
    const key = import.meta.env.VITE_GEOAPIFY_KEY;
    return (
      `https://maps.geoapify.com/v1/staticmap` +
      `?style=osm-carto` +
      `&width=600` +
      `&height=300` +
      `&center=lonlat:${lon},${lat}` +
      `&zoom=11` +
      `&marker=lonlat:${lon},${lat};color:%23ef4444;size:medium` +
      `&apiKey=${key}`
    );
  }

  function tempColor(temp: number | null) {
    if (temp == null) return theme.text;
    if (temp <= 0) return "#38bdf8";
    if (temp >= 30) return "#fb7185";
    return theme.text;
  }

  async function loadRecent() {
    try {
      const r = await fetch("http://localhost:4000/api/recent");
      const data = await r.json();
      if (r.ok) setRecent(data);
    } catch {
      // ignore
    }
  }

  async function loadFavorites() {
    try {
      const r = await fetch("http://localhost:4000/api/favorites");
      const data = await r.json();
      if (r.ok) setFavorites(data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadRecent();
    loadFavorites();
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
        await loadFavorites();
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

  async function toggleFavorite(cityName: string, country: string | null) {
    try {
      const resp = await fetch("http://localhost:4000/api/favorites/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: cityName, country }),
      });

      const data = await resp.json();
      if (!resp.ok) return;

      setResult((prev) => {
        if (!prev || prev.error) return prev;
        if (prev.city === cityName && (prev.country ?? null) === (country ?? null)) {
          return { ...prev, isFavorite: !!data?.isFavorite };
        }
        return prev;
      });

      await loadFavorites();
      await loadRecent();
    } catch {
      // ignore
    }
  }

  async function clearRecent() {
    try {
      const r = await fetch("http://localhost:4000/api/recent", { method: "DELETE" });
      if (r.ok) setRecent([]);
    } catch {
      // ignore
    }
  }

  const favoriteSet = useMemo(() => new Set(favorites.map((f) => f.cityKey)), [favorites]);

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div
      style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: 18,
        padding: 16,
        boxShadow: dark ? "none" : "0 10px 25px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div
          style={{
            height: 4,
            width: 34,
            background: theme.accent,
            borderRadius: 999,
            opacity: dark ? 0.9 : 0.85,
          }}
        />
        <div style={{ fontWeight: 900, color: theme.text }}>{title}</div>
      </div>

      <div style={{ color: theme.sub }}>{children}</div>
    </div>
  );

  /**
   * Smooth accordion Section
   * - animates height using measured scrollHeight
   * - animates opacity + slight translate
   */
  const Section = ({
    title,
    defaultOpen = true,
    children,
    right,
  }: {
    title: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
    right?: React.ReactNode;
  }) => {
    const [open, setOpen] = useState(defaultOpen);
    const [maxH, setMaxH] = useState<number>(defaultOpen ? 9999 : 0);
    const bodyRef = useRef<HTMLDivElement | null>(null);

    const measure = () => {
      const el = bodyRef.current;
      if (!el) return;
      const h = el.scrollHeight;
      setMaxH(open ? h : 0);
    };

    // Measure after render whenever open changes or content changes
    useLayoutEffect(() => {
      measure();
      // also re-measure on next frame to be safe (fonts/images)
      const id = requestAnimationFrame(measure);
      return () => cancelAnimationFrame(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, children]);

    // Re-measure on window resize
    useEffect(() => {
      const onResize = () => measure();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: `1px solid ${theme.border}`,
            background: theme.card,
            color: theme.text,
            padding: "10px 12px",
            borderRadius: 14,
            cursor: "pointer",
            fontWeight: 900,
            transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
            boxShadow: dark ? "none" : "0 8px 18px rgba(15,23,42,0.04)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accentSoft;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = theme.border;
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.99)";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                height: 8,
                width: 8,
                borderRadius: 999,
                background: theme.accent,
                boxShadow: `0 0 0 6px ${theme.accentSoft}`,
              }}
            />
            <span>{title}</span>

            {right ? (
              <span
                onClick={(e) => e.stopPropagation()}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                {right}
              </span>
            ) : null}
          </span>

          <span style={{ opacity: 0.85 }}>{open ? "▾" : "▸"}</span>
        </button>

        <div
          style={{
            maxHeight: maxH,
            overflow: "hidden",
            transition: "max-height 260ms ease, opacity 220ms ease, transform 220ms ease",
            opacity: open ? 1 : 0,
            transform: open ? "translateY(0)" : "translateY(-4px)",
            willChange: "max-height, opacity, transform",
          }}
        >
          <div ref={bodyRef} style={{ paddingTop: 10 }}>
            {children}
          </div>
        </div>
      </div>
    );
  };

  const Chip = ({
    label,
    onClick,
    starred,
    onStar,
  }: {
    label: string;
    onClick: () => void;
    starred?: boolean;
    onStar?: () => void;
  }) => {
    const H = 36;

    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={onClick}
          style={{
            height: H,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${theme.border}`,
            background: theme.chip,
            color: theme.text,
            padding: "0 12px",
            borderRadius: 999,
            cursor: "pointer",
            fontWeight: 800,
            lineHeight: 1,
            transition: "transform 120ms ease, border-color 120ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accentSoft;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = theme.border;
          }}
        >
          {label}
        </button>

        {onStar && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStar();
            }}
            title={starred ? "Unfavorite" : "Favorite"}
            style={{
              height: H,
              width: H,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${theme.border}`,
              background: theme.card,
              color: starred ? "#facc15" : theme.text,
              borderRadius: 999,
              cursor: "pointer",
              fontWeight: 900,
              lineHeight: 1,
              fontSize: 18,
              padding: 0,
              transition: "transform 120ms ease, border-color 120ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accentSoft;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = theme.border;
            }}
          >
            {starred ? "★" : "☆"}
          </button>
        )}
      </div>
    );
  };

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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: theme.accent,
                boxShadow: `0 0 0 6px ${theme.accentSoft}`,
              }}
            />
            <div style={{ fontSize: 30, fontWeight: 1000, color: theme.text }}>Weather & Location</div>
          </div>

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
              fontWeight: 800,
              transition: "transform 120ms ease, border-color 120ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accentSoft;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = theme.border;
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
              transition: "border-color 120ms ease, box-shadow 120ms ease",
              boxShadow: dark ? "none" : "0 8px 18px rgba(15,23,42,0.04)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.accentSoft;
              e.currentTarget.style.boxShadow = dark ? "none" : "0 12px 24px rgba(15,23,42,0.06)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.border;
              e.currentTarget.style.boxShadow = dark ? "none" : "0 8px 18px rgba(15,23,42,0.04)";
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
              background: loading ? theme.card : theme.accent,
              color: loading ? theme.text : "#ffffff",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 900,
              opacity: loading ? 0.75 : 1,
              transition: "transform 120ms ease, opacity 120ms ease",
              boxShadow: dark ? "none" : "0 12px 24px rgba(79,110,247,0.18)",
            }}
            onMouseEnter={(e) => {
              if (loading) return;
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            }}
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </div>

        {/* Favorites + Recent (collapsible) */}
        <div style={{ maxWidth: 900, margin: "10px auto 0", display: "grid", gap: 10 }}>
          {favorites.length > 0 && (
            <Section title="Favorites" defaultOpen>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {favorites.map((f) => (
                  <Chip
                    key={f.cityKey}
                    label={`${f.city}${f.country ? `, ${f.country}` : ""}`}
                    onClick={() => {
                      setCity(f.city);
                      onSearch(f.city);
                    }}
                    starred
                    onStar={() => toggleFavorite(f.city, f.country)}
                  />
                ))}
              </div>
            </Section>
          )}

          {recent.length > 0 && (
            <Section
              title="Recent"
              defaultOpen
              right={
                <button
                  onClick={clearRecent}
                  style={{
                    border: `1px solid ${theme.border}`,
                    background: theme.card,
                    color: theme.text,
                    padding: "6px 10px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 900,
                    fontSize: 12,
                    transition: "border-color 120ms ease, transform 120ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accentSoft;
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = theme.border;
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  }}
                >
                  Clear
                </button>
              }
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {recent
                  .filter((r) => !favoriteSet.has(r.cityKey))
                  .map((r) => (
                    <Chip
                      key={r.id}
                      label={`${r.city}${r.country ? `, ${r.country}` : ""}`}
                      onClick={() => {
                        setCity(r.city);
                        onSearch(r.city);
                      }}
                      starred={r.isFavorite}
                      onStar={() => toggleFavorite(r.city, r.country)}
                    />
                  ))}
              </div>

              {recent.filter((r) => !favoriteSet.has(r.cityKey)).length === 0 && (
                <div style={{ color: theme.sub, marginTop: 6 }}>All your recent cities are starred ⭐</div>
              )}
            </Section>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card title="Weather">
          {!result && !loading && <div>Search a city to see results.</div>}

          {loading && <div style={{ color: theme.sub }}>Loading weather, AQI, and news…</div>}

          {result?.error && (
            <div>
              <div style={{ fontWeight: 900, color: theme.text, marginBottom: 6 }}>Error</div>
              <div>{result.error}</div>
            </div>
          )}

          {result && !result.error && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 950, color: theme.text }}>
                  {result.city}
                  {result.country ? `, ${result.country}` : ""}
                </div>

                <div style={{ flex: 1 }} />

                <button
                  onClick={() => toggleFavorite(result.city, result.country ?? null)}
                  title={result.isFavorite ? "Unfavorite" : "Favorite"}
                  style={{
                    border: `1px solid ${theme.border}`,
                    background: result.isFavorite ? theme.accentSoft : theme.card,
                    color: theme.text,
                    padding: "6px 10px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontWeight: 950,
                    lineHeight: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    transition: "transform 120ms ease, border-color 120ms ease, background 120ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accentSoft;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = theme.border;
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1, color: result.isFavorite ? "#facc15" : theme.text }}>
                    {result.isFavorite ? "★" : "☆"}
                  </span>
                  <span>{result.isFavorite ? "Starred" : "Star"}</span>
                </button>
              </div>

              <div style={{ marginTop: 10 }}>
                Temperature: <b style={{ color: tempColor(result.temp) }}>{result.temp ?? "—"}°C</b>
              </div>
              <div style={{ marginTop: 6 }}>
                Description: <b style={{ color: theme.text }}>{result.description ?? "—"}</b>
              </div>
            </div>
          )}
        </Card>

        <Card title="Air Quality">
          {result && !result.error ? (
            <div>
              <div>
                AQI: <b style={{ color: aqiColor(result.aqi) }}>{aqiDisplay(result.aqi, result.aqiText)}</b>
              </div>

              <div
                style={{
                  marginTop: 10,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 14,
                  padding: 10,
                  background: dark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)",
                }}
              >
                <div style={{ fontSize: 12, color: theme.sub, fontWeight: 800, marginBottom: 6 }}>AQI scale</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { n: 1, t: "Good" },
                    { n: 2, t: "Fair" },
                    { n: 3, t: "Moderate" },
                    { n: 4, t: "Poor" },
                    { n: 5, t: "Very Poor" },
                  ].map((x) => (
                    <span
                      key={x.n}
                      style={{
                        border: `1px solid ${theme.border}`,
                        background: theme.card,
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 900,
                        color: theme.text,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: aqiColor(x.n) }} />
                      {x.n} — {x.t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>Search a city to see air quality.</div>
          )}
        </Card>
          {result && !result.error && result.lat != null && result.lon != null && (
            <Card title="Location">
              <div style={{ fontSize: 13, color: theme.sub, marginBottom: 8 }}>
                This map confirms the exact location used for the weather data.
              </div>

              <img
                src={staticMapUrl(result.lat, result.lon)}
                alt={`Map of ${result.city}`}
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
                style={{
                  width: "100%",
                  borderRadius: 14,
                  border: `1px solid ${theme.border}`,
                }}
              />

              <div style={{ marginTop: 8, fontSize: 12, color: theme.sub }}>
                Coordinates: {result.lat.toFixed(3)}, {result.lon.toFixed(3)}
              </div>
            </Card>
          )}

        {/* News (collapsible) */}
        <div style={{ gridColumn: "1 / -1" }}>
          <div
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: 18,
              padding: 16,
              boxShadow: dark ? "none" : "0 10px 25px rgba(15, 23, 42, 0.06)",
            }}
          >
            <Section title="Local News" defaultOpen>
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
                          borderRadius: 16,
                          padding: 12,
                          background: dark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
                          transition: "transform 120ms ease, border-color 120ms ease",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
                          (e.currentTarget as HTMLAnchorElement).style.borderColor = theme.accentSoft;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
                          (e.currentTarget as HTMLAnchorElement).style.borderColor = theme.border;
                        }}
                      >
                        <div style={{ fontWeight: 950, color: theme.text, marginBottom: 4 }}>{n.title}</div>
                        <div style={{ color: theme.sub, fontSize: 13 }}>
                          {(n.source ? n.source : "Unknown source")}
                          {n.publishedAt ? ` • ${formatTime(n.publishedAt)}` : ""}
                        </div>
                        {n.description && <div style={{ color: theme.sub, marginTop: 6 }}>{n.description}</div>}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: theme.sub }}>No headlines found for this city right now.</div>
                )
              ) : (
                <div style={{ color: theme.sub }}>Search a city to see headlines.</div>
              )}
            </Section>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "18px auto 0", color: theme.sub, fontSize: 12 }}>
        v0.7 — Smooth accordion motion + accent polish
      </div>
    </div>
  );
}
