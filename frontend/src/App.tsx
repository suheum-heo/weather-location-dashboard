import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

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

  region?: string | null;
  regionCode?: string | null;
  county?: string | null;
  displayName?: string | null;

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

type GeoCandidate = {
  name: string;
  country: string;
  state: string | null;
  lat: number;
  lon: number;
};

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function formatCityLabel(r: WeatherResult) {
  const city = r.city;
  if (!r.country) return city;

  if (r.country === "US") {
    const stateAbbr: Record<string, string> = {
      Alabama: "AL",
      Alaska: "AK",
      Arizona: "AZ",
      Arkansas: "AR",
      California: "CA",
      Colorado: "CO",
      Connecticut: "CT",
      Delaware: "DE",
      Florida: "FL",
      Georgia: "GA",
      Hawaii: "HI",
      Idaho: "ID",
      Illinois: "IL",
      Indiana: "IN",
      Iowa: "IA",
      Kansas: "KS",
      Kentucky: "KY",
      Louisiana: "LA",
      Maine: "ME",
      Maryland: "MD",
      Massachusetts: "MA",
      Michigan: "MI",
      Minnesota: "MN",
      Mississippi: "MS",
      Missouri: "MO",
      Montana: "MT",
      Nebraska: "NE",
      Nevada: "NV",
      "New Hampshire": "NH",
      "New Jersey": "NJ",
      "New Mexico": "NM",
      "New York": "NY",
      "North Carolina": "NC",
      "North Dakota": "ND",
      Ohio: "OH",
      Oklahoma: "OK",
      Oregon: "OR",
      Pennsylvania: "PA",
      "Rhode Island": "RI",
      "South Carolina": "SC",
      "South Dakota": "SD",
      Tennessee: "TN",
      Texas: "TX",
      Utah: "UT",
      Vermont: "VT",
      Virginia: "VA",
      Washington: "WA",
      "West Virginia": "WV",
      Wisconsin: "WI",
      Wyoming: "WY",
      "District of Columbia": "DC",
    };

    const st = r.region ? stateAbbr[r.region] ?? null : null;
    if (st) return `${city}, ${st}`;
    if (r.region) return `${city}, ${r.region}`;
    return `${city}, US`;
  }

  return `${city}, ${r.country}`;
}

function formatCandidateLabel(c: GeoCandidate) {
  if (c.country === "US" && c.state) return `${c.name}, ${c.state}`;
  return `${c.name}, ${c.country}${c.state ? ` (${c.state})` : ""}`;
}

export default function App() {
  const [draftCity, setDraftCity] = useState("Seoul");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WeatherResult | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem("theme") === "dark");

  const [candidates, setCandidates] = useState<GeoCandidate[] | null>(null);
  const [pendingQuery, setPendingQuery] = useState<string>("");

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

  // 🔥 IMPORTANT: This fixes the “first render looks like a narrow column” issue
  // (Vite templates often set #root max-width & padding in index.css)
  const GlobalReset = () => (
    <style>{`
      html, body, #root { height: 100%; width: 100%; margin: 0; padding: 0; }
      #root { max-width: none !important; padding: 0 !important; }
      body { background: ${theme.bg}; }
      * { box-sizing: border-box; }
    `}</style>
  );

  // Layout
  const containerStyle: React.CSSProperties = {
    width: "100%",
    padding: "0 22px",
  };

  const gridMin = 360; // card minimum width
  const cardMinHeight = 180; // helps rows look less uneven
  const mapHeight = 180; // forces Location card to not blow up row height

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

  function aqiDisplay(aqi: number | null, aqiText: string | null) {
    if (!aqi) return "—";
    return `${aqi} (${aqiText ?? "AQI"})`;
  }

  function tempColor(temp: number | null) {
    if (temp == null) return theme.text;
    if (temp <= 0) return "#38bdf8";
    if (temp >= 30) return "#fb7185";
    return theme.text;
  }

  function staticMapUrl(lat: number, lon: number) {
    const key = import.meta.env.VITE_GEOAPIFY_KEY;
    return (
      `https://maps.geoapify.com/v1/staticmap` +
      `?style=osm-carto` +
      `&width=900` +
      `&height=360` +
      `&center=lonlat:${lon},${lat}` +
      `&zoom=11` +
      `&marker=lonlat:${lon},${lat};color:%23ef4444;size:medium` +
      `&apiKey=${encodeURIComponent(String(key ?? ""))}`
    );
  }

  async function loadRecent() {
    try {
      const r = await fetch(`${API_BASE}/api/recent`);
      const data = await r.json();
      if (r.ok) setRecent(data);
    } catch {
      // ignore
    }
  }

  async function loadFavorites() {
    try {
      const r = await fetch(`${API_BASE}/api/favorites`);
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

  async function fetchWeatherByCoords(lat: number, lon: number) {
    const resp = await fetch(
      `${API_BASE}/api/weatherByCoords?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(
        String(lon)
      )}`
    );
    const data = await resp.json();

    if (!resp.ok) {
      setResult({
        city: pendingQuery || draftCity,
        country: null,
        temp: null,
        description: null,
        aqi: null,
        aqiText: null,
        news: [],
        error: data?.error ?? "Error",
      });
      return;
    }

    setResult(data);
    await loadRecent();
    await loadFavorites();
  }

  async function onSearch(nextCity?: string) {
    const q = (nextCity ?? draftCity).trim();
    if (!q) return;

    setPendingQuery(q);
    setCandidates(null);

    setLoading(true);
    setResult(null);

    try {
      const geoResp = await fetch(`${API_BASE}/api/geo?q=${encodeURIComponent(q)}`);
      const geoData = await geoResp.json();

      if (!geoResp.ok) {
        setResult({
          city: q,
          country: null,
          temp: null,
          description: null,
          aqi: null,
          aqiText: null,
          news: [],
          error: geoData?.error ?? "Geocoding error",
        });
        return;
      }

      const list: GeoCandidate[] = Array.isArray(geoData) ? geoData : [];

      if (list.length === 0) {
        setResult({
          city: q,
          country: null,
          temp: null,
          description: null,
          aqi: null,
          aqiText: null,
          news: [],
          error: "No matching cities found. Try adding a country (e.g., Madison, US).",
        });
        return;
      }

      if (list.length === 1) {
        await fetchWeatherByCoords(list[0].lat, list[0].lon);
        return;
      }

      setCandidates(list);
      setResult({
        city: q,
        country: null,
        temp: null,
        description: null,
        aqi: null,
        aqiText: null,
        news: [],
        error: "Multiple matches found — pick the correct location below.",
      });
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
      const resp = await fetch(`${API_BASE}/api/favorites/toggle`, {
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
      const r = await fetch(`${API_BASE}/api/recent`, { method: "DELETE" });
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
        minWidth: 0,
        minHeight: cardMinHeight,
        height: "100%",
        display: "flex",
        flexDirection: "column",
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

      <div style={{ color: theme.sub, flex: 1 }}>{children}</div>
    </div>
  );

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

    useLayoutEffect(() => {
      measure();
      const id = requestAnimationFrame(measure);
      return () => cancelAnimationFrame(id);
    }, [open, children]);

    useEffect(() => {
      const onResize = () => measure();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
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

  // ✅ Stable map URL so the image does NOT blink on re-renders
  const mapUrl = useMemo(() => {
    if (!result || result.error || result.lat == null || result.lon == null) return null;
    return staticMapUrl(result.lat, result.lon);
  }, [result?.lat, result?.lon, result?.error]);

  return (
    <div style={{ minHeight: "100vh", background: theme.bg }}>
      <GlobalReset />

      {/* Sticky header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: theme.bg,
          padding: "18px 0 12px",
          borderBottom: `1px solid ${theme.border}`,
          backdropFilter: "saturate(1.2) blur(8px)",
        }}
      >
        <div style={{ ...containerStyle, display: "flex", alignItems: "center", gap: 12 }}>
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
            }}
          >
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
        </div>

        <div style={{ ...containerStyle, marginTop: 12, display: "flex", gap: 10 }}>
          <input
            value={draftCity}
            onChange={(e) => setDraftCity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSearch(draftCity);
              }
            }}
            placeholder="Search a city (e.g., Madison)"
            style={{
              flex: 1,
              padding: 12,
              fontSize: 16,
              borderRadius: 14,
              border: `1px solid ${theme.border}`,
              background: theme.card,
              color: theme.text,
              outline: "none",
              boxShadow: dark ? "none" : "0 8px 18px rgba(15,23,42,0.04)",
            }}
          />

          <button
            onClick={() => onSearch(draftCity)}
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
              boxShadow: dark ? "none" : "0 12px 24px rgba(79,110,247,0.18)",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </div>

        {candidates && candidates.length > 1 && (
          <div style={{ ...containerStyle, marginTop: 10 }}>
            <div
              style={{
                border: `1px solid ${theme.border}`,
                background: theme.card,
                borderRadius: 16,
                padding: 12,
                boxShadow: dark ? "none" : "0 10px 25px rgba(15, 23, 42, 0.06)",
              }}
            >
              <div style={{ fontWeight: 900, color: theme.text, marginBottom: 8 }}>
                Did you mean:
                <span style={{ marginLeft: 8, color: theme.sub, fontWeight: 800 }}>({pendingQuery})</span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {candidates.map((c, idx) => (
                  <button
                    key={`${c.lat}-${c.lon}-${idx}`}
                    onClick={async () => {
                      setCandidates(null);
                      setLoading(true);
                      try {
                        await fetchWeatherByCoords(c.lat, c.lon);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    style={{
                      border: `1px solid ${theme.border}`,
                      background: theme.chip,
                      color: theme.text,
                      padding: "8px 12px",
                      borderRadius: 999,
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                    title={`${c.name} (${c.lat.toFixed(3)}, ${c.lon.toFixed(3)})`}
                  >
                    {formatCandidateLabel(c)}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: theme.sub }}>
                Tip: this avoids the “Madison, AL vs Madison, WI” problem.
              </div>
            </div>
          </div>
        )}

        {/* Favorites + Recent */}
        <div style={{ ...containerStyle, marginTop: 10, display: "grid", gap: 10 }}>
          {favorites.length > 0 && (
            <Section title="Favorites" defaultOpen>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {favorites.map((f) => (
                  <Chip
                    key={f.cityKey}
                    label={`${f.city}${f.country ? `, ${f.country}` : ""}`}
                    onClick={() => {
                      setDraftCity(f.city);
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
                        setDraftCity(r.city);
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

      {/* Body */}
      <div style={{ ...containerStyle, paddingTop: 16, paddingBottom: 22 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(${gridMin}px, 1fr))`,
            gap: 14,
            alignItems: "stretch",
          }}
        >
          <Card title="Weather">
            {!result && !loading && <div>Search a city to see results.</div>}
            {loading && <div style={{ color: theme.sub }}>Loading weather, AQI, and news…</div>}

            {result?.error && (
              <div>
                <div style={{ fontWeight: 900, color: theme.text, marginBottom: 6 }}>Notice</div>
                <div>{result.error}</div>
              </div>
            )}

            {result && !result.error && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 950, color: theme.text }}>{formatCityLabel(result)}</div>
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
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1, color: result.isFavorite ? "#facc15" : theme.text }}>
                      {result.isFavorite ? "★" : "☆"}
                    </span>
                    <span>{result.isFavorite ? "Starred" : "Star"}</span>
                  </button>
                </div>

                <div>
                  Temperature: <b style={{ color: tempColor(result.temp) }}>{result.temp ?? "—"}°C</b>
                </div>
                <div>
                  Description: <b style={{ color: theme.text }}>{result.description ?? "—"}</b>
                </div>
              </div>
            )}
          </Card>

          <Card title="Air Quality">
            {result && !result.error ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  AQI: <b style={{ color: aqiColor(result.aqi) }}>{aqiDisplay(result.aqi, result.aqiText)}</b>
                </div>

                <div
                  style={{
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
                This confirms the exact location used for the weather data.
              </div>

              {mapUrl && (
                <img
                  src={mapUrl}
                  alt={`Map of ${result.city}`}
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: mapHeight,
                    objectFit: "cover",
                    borderRadius: 14,
                    border: `1px solid ${theme.border}`,
                  }}
                />
              )}

              <div style={{ marginTop: 8, fontSize: 12, color: theme.sub }}>
                Coordinates: {result.lat.toFixed(3)}, {result.lon.toFixed(3)}
              </div>

              {(result.region || result.county) && (
                <div style={{ marginTop: 6, fontSize: 12, color: theme.sub }}>
                  {result.region && (
                    <div>
                      Region: <b style={{ color: theme.text }}>{result.region}</b>
                      {result.regionCode ? ` (${result.regionCode})` : ""}
                    </div>
                  )}
                  {result.county && (
                    <div>
                      County: <b style={{ color: theme.text }}>{result.county}</b>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* News full width */}
        <div style={{ marginTop: 14 }}>
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
                        }}
                      >
                        <div style={{ fontWeight: 950, color: theme.text, marginBottom: 4 }}>{n.title}</div>
                        <div style={{ color: theme.sub, fontSize: 13 }}>
                          {n.source ? n.source : "Unknown source"}
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

        <div style={{ marginTop: 14, color: theme.sub, fontSize: 12 }}>
          v1.1 — Full-width from first render + aligned cards
        </div>
      </div>
    </div>
  );
}
