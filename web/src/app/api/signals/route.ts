export const runtime = "nodejs";

import { NextResponse } from "next/server";

type SignalsReq = {
  locations?: string[];
  suppliers?: string[];
  products?: string[];
};

type WeatherPoint = {
  location: string;
  lat: number;
  lon: number;
  tempC: number | null;
  windMs: number | null;
  condition: string | null;
  precipMm1h: number;
  riskScore: number; // 0..100
};

type WeatherOut = {
  locations: WeatherPoint[];
  overallRisk: number; // 0..100
  maxRisk: number; // 0..100
};

type GeoArticle = {
  title: string;
  url: string;
  seendate?: string;
  domain?: string;
  sourceCountry?: string;
};

type GeoOut = {
  riskScore: number; // 0..100
  queryUsed: string;
  articles: GeoArticle[];
};

declare global {
  // eslint-disable-next-line no-var
  var __gdeltCache: { ts: number; key: string; out: GeoOut } | null;
  // eslint-disable-next-line no-var
  var __gdeltLastCallTs: number;
}
globalThis.__gdeltCache ??= null;
globalThis.__gdeltLastCallTs ??= 0;

const GDELT_MIN_INTERVAL_MS = 6000;

const STATIC_COORDS: Record<string, { lat: number; lon: number; label: string }> = {
  ontario: { lat: 43.6532, lon: -79.3832, label: "Ontario (Toronto)" },
  manitoba: { lat: 49.8951, lon: -97.1384, label: "Manitoba (Winnipeg)" },
  saskatchewan: { lat: 50.4452, lon: -104.6189, label: "Saskatchewan (Regina)" },
  alberta: { lat: 51.0447, lon: -114.0719, label: "Alberta (Calgary)" },
  quebec: { lat: 45.5019, lon: -73.5674, label: "Quebec (Montreal)" },
  toronto: { lat: 43.6532, lon: -79.3832, label: "Toronto" },
  montreal: { lat: 45.5019, lon: -73.5674, label: "Montreal" },
  calgary: { lat: 51.0447, lon: -114.0719, label: "Calgary" },
  winnipeg: { lat: 49.8951, lon: -97.1384, label: "Winnipeg" },
  regina: { lat: 50.4452, lon: -104.6189, label: "Regina" },
};

function norm(s: unknown) {
  return String(s ?? "").trim().toLowerCase();
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

async function safeFetchJson(url: string, warnings: string[]) {
  try {
    const r = await fetch(url, { cache: "no-store" });

    const ct = r.headers.get("content-type") || "";
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      warnings.push(`Fetch failed (${r.status}) for ${url}${txt ? ` :: ${txt.slice(0, 120)}` : ""}`);
      return null;
    }

    // GDELT sometimes returns HTML/text. Only parse JSON when it actually is JSON.
    if (!ct.includes("application/json")) {
      const txt = await r.text().catch(() => "");
      warnings.push(`Non-JSON response from ${url} (content-type=${ct || "unknown"}) :: ${txt.slice(0, 120)}`);
      return null;
    }

    return await r.json().catch(() => {
      warnings.push(`Invalid JSON from ${url}`);
      return null;
    });
  } catch (e: any) {
    warnings.push(`Network error for ${url}: ${e?.message ?? String(e)}`);
    return null;
  }
}

async function geocodeOpenWeather(q: string, apiKey: string, warnings: string[]) {
  const url = new URL("https://api.openweathermap.org/geo/1.0/direct");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "1");
  url.searchParams.set("appid", apiKey);

  const data = (await safeFetchJson(url.toString(), warnings)) as any[] | null;
  const first = Array.isArray(data) ? data[0] : null;
  if (!first?.lat || !first?.lon) return null;

  const label = [first.name, first.state, first.country].filter(Boolean).join(", ");
  return { lat: Number(first.lat), lon: Number(first.lon), label: label || q };
}

async function resolveLocation(name: string, apiKey: string | undefined, warnings: string[]) {
  const key = norm(name);
  if (!key) return null;

  if (STATIC_COORDS[key]) return STATIC_COORDS[key];

  if (apiKey) {
    const geo = await geocodeOpenWeather(name, apiKey, warnings);
    if (geo) return geo;
  }

  return null;
}

function computeWeatherRisk(input: {
  tempC: number | null;
  windMs: number | null;
  precipMm1h: number;
  condition: string | null;
}) {
  let risk = 0;

  const t = input.tempC;
  const w = input.windMs ?? 0;
  const p = input.precipMm1h ?? 0;

  if (w >= 12) risk += 25;
  else if (w >= 8) risk += 12;

  if (p >= 5) risk += 25;
  else if (p >= 1) risk += 10;

  if (t !== null) {
    if (t <= -10) risk += 15;
    else if (t >= 35) risk += 15;
    else if (t <= -2) risk += 6;
    else if (t >= 30) risk += 6;
  }

  const c = (input.condition ?? "").toLowerCase();
  if (c.includes("storm") || c.includes("thunder")) risk += 20;
  if (c.includes("snow") || c.includes("blizzard")) risk += 15;
  if (c.includes("fog")) risk += 10;

  return clamp(Math.round(risk), 0, 100);
}

async function fetchCurrentWeather(lat: number, lon: number, apiKey: string, warnings: string[]) {
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("units", "metric");
  return (await safeFetchJson(url.toString(), warnings)) as any | null;
}

async function fetchWeather(locations: string[], apiKey: string | undefined): Promise<{ out: WeatherOut; warnings: string[] }> {
  const warnings: string[] = [];

  if (!apiKey) {
    warnings.push("OPENWEATHER_API_KEY missing → weather risk disabled.");
    return { warnings, out: { locations: [], overallRisk: 0, maxRisk: 0 } };
  }

  const uniq = Array.from(new Set(locations.map((x) => x.trim()).filter(Boolean))).slice(0, 5);

  const points: WeatherPoint[] = [];
  for (const name of uniq) {
    const resolved = await resolveLocation(name, apiKey, warnings);
    if (!resolved) {
      warnings.push(`Could not resolve location "${name}".`);
      continue;
    }

    const data = await fetchCurrentWeather(resolved.lat, resolved.lon, apiKey, warnings);
    if (!data) continue;

    const tempC = typeof data?.main?.temp === "number" ? data.main.temp : null;
    const windMs = typeof data?.wind?.speed === "number" ? data.wind.speed : null;
    const condition = typeof data?.weather?.[0]?.main === "string" ? data.weather[0].main : null;

    const precipMm1h =
      (typeof data?.rain?.["1h"] === "number" ? data.rain["1h"] : 0) +
      (typeof data?.snow?.["1h"] === "number" ? data.snow["1h"] : 0);

    const riskScore = computeWeatherRisk({ tempC, windMs, precipMm1h, condition });

    points.push({
      location: resolved.label,
      lat: resolved.lat,
      lon: resolved.lon,
      tempC,
      windMs,
      condition,
      precipMm1h,
      riskScore,
    });
  }

  const maxRisk = points.reduce((m, p) => Math.max(m, p.riskScore), 0);
  const overallRisk = points.length ? Math.round(points.reduce((s, p) => s + p.riskScore, 0) / points.length) : 0;

  return { warnings, out: { locations: points, overallRisk, maxRisk } };
}

function buildGdeltQuery(suppliers: string[], products: string[]) {
  const policy = `(tariff OR sanction OR embargo OR "export control" OR "import ban")`;

  // keep only a few key ag terms (short!)
  const ag = `(fertilizer OR potash OR urea OR seed OR pesticide)`;

  // limit suppliers/products to first 2 each (short!)
  const sup = suppliers.filter(Boolean).slice(0, 2).map((s) => `"${s}"`);
  const prod = products.filter(Boolean).slice(0, 2).map((p) => `"${p}"`);

  const focusTerms = [...sup, ...prod];
  const focus = focusTerms.length ? `(${focusTerms.join(" OR ")})` : "";

  // final query
  return focus ? `${policy} AND ${ag} AND ${focus}` : `${policy} AND ${ag}`;
}

async function fetchGdelt(suppliers: string[], products: string[]): Promise<{ out: GeoOut; warnings: string[] }> {
  const warnings: string[] = [];
  const queryUsed = buildGdeltQuery(suppliers, products);

  const now = Date.now();

  // Hard throttle: never call GDELT more than once per ~6s
  const msSinceLast = now - globalThis.__gdeltLastCallTs;
  if (msSinceLast < GDELT_MIN_INTERVAL_MS) {
    if (globalThis.__gdeltCache?.key === queryUsed) {
      warnings.push("GDELT: served from cache (rate-limit protection).");
      return { warnings, out: globalThis.__gdeltCache.out };
    }
    warnings.push(`GDELT: skipped (rate-limit protection). Try again in ${GDELT_MIN_INTERVAL_MS - msSinceLast}ms.`);
    return { warnings, out: { riskScore: 0, queryUsed, articles: [] } };
  }

  // mark call time BEFORE request to prevent parallel hits
  globalThis.__gdeltLastCallTs = now;

  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", queryUsed);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "HybridRel");
  url.searchParams.set("maxrecords", "10");
  url.searchParams.set("timespan", "7d");

  try {
    const r = await fetch(url.toString(), { cache: "no-store" });

    if (r.status === 429) {
      const txt = await r.text().catch(() => "");
      warnings.push(`GDELT 429: ${txt.slice(0, 160)}`);
      // return cached if available
      if (globalThis.__gdeltCache?.key === queryUsed) {
        warnings.push("GDELT: fell back to cache.");
        return { warnings, out: globalThis.__gdeltCache.out };
      }
      return { warnings, out: { riskScore: 0, queryUsed, articles: [] } };
    }

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      warnings.push(`GDELT fetch failed (${r.status}) :: ${txt.slice(0, 160)}`);
      return { warnings, out: { riskScore: 0, queryUsed, articles: [] } };
    }

    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const txt = await r.text().catch(() => "");
      warnings.push(`GDELT non-JSON (content-type=${ct || "unknown"}) :: ${txt.slice(0, 160)}`);
      return { warnings, out: { riskScore: 0, queryUsed, articles: [] } };
    }

    const data = (await r.json().catch(() => null)) as any;
    const articlesRaw = Array.isArray(data?.articles) ? data.articles : [];

    const articles: GeoArticle[] = articlesRaw
      .map((a: any) => ({
        title: String(a?.title ?? ""),
        url: String(a?.url ?? ""),
        seendate: a?.seendate ? String(a.seendate) : undefined,
        domain: a?.domain ? String(a.domain) : undefined,
        sourceCountry: a?.sourcecountry ? String(a.sourcecountry) : undefined,
      }))
      .filter((a: GeoArticle) => a.title && a.url);

    const out: GeoOut = {
      riskScore: clamp(Math.round(articles.length * 7), 0, 100),
      queryUsed,
      articles,
    };

    globalThis.__gdeltCache = { ts: Date.now(), key: queryUsed, out };
    return { warnings, out };
  } catch (e: any) {
    warnings.push(`GDELT network error: ${e?.message ?? String(e)}`);
    if (globalThis.__gdeltCache?.key === queryUsed) {
      warnings.push("GDELT: fell back to cache.");
      return { warnings, out: globalThis.__gdeltCache.out };
    }
    return { warnings, out: { riskScore: 0, queryUsed, articles: [] } };
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as SignalsReq;

  const locations = Array.isArray(body.locations) ? body.locations : [];
  const suppliers = Array.isArray(body.suppliers) ? body.suppliers : [];
  const products = Array.isArray(body.products) ? body.products : [];

  const warnings: string[] = [];

  const { out: weather, warnings: w1 } = await fetchWeather(locations, process.env.OPENWEATHER_API_KEY);
  warnings.push(...w1);

  const { out: geopolitics, warnings: w2 } = await fetchGdelt(suppliers, products);
  warnings.push(...w2);

  return NextResponse.json({
    ok: true,
    asOf: new Date().toISOString(),
    weather,
    geopolitics,
    warnings,
  });
}