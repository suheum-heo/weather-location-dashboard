import { useEffect, useState } from "react";
import "./App.css";

type WeatherResult = {
  city: string;
  country: string | null;
  temp: number | null;
  description: string | null;
  error?: string;
};

type RecentItem = {
  id: number;
  city: string;
  country: string | null;
  createdAt: string;
};

export default function App() {
  const [city, setCity] = useState("Seoul");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WeatherResult | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  async function loadRecent() {
    try {
      const r = await fetch("http://localhost:4000/api/recent");
      const data = await r.json();
      if (r.ok) setRecent(data);
    } catch {
      // ignore (backend might be down)
    }
  }

  useEffect(() => {
    loadRecent();
  }, []);

  async function onSearch() {
    const q = city.trim();
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
        error: "Cannot reach backend. Is it running?",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Weather Dashboard (v0)</h1>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Search a city (e.g., Seoul)"
          style={{ flex: 1, padding: 10, fontSize: 16 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
        />
        <button onClick={onSearch} disabled={loading} style={{ padding: "10px 14px", fontSize: 16 }}>
          {loading ? "Loading..." : "Search"}
        </button>
      </div>

      {recent.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Recent searches</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {recent.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setCity(r.city);
                  // optional: auto-search immediately
                  // setTimeout(onSearch, 0);
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #ccc",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                {r.city}
                {r.country ? `, ${r.country}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
        {!result && !loading && <div>Search a city to see weather.</div>}

        {result?.error && (
          <div>
            <div style={{ fontWeight: 700 }}>Error</div>
            <div>{result.error}</div>
          </div>
        )}

        {result && !result.error && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {result.city}
              {result.country ? `, ${result.country}` : ""}
            </div>
            <div style={{ marginTop: 8 }}>Temp: {result.temp ?? "—"}°C</div>
            <div>Description: {result.description ?? "—"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
