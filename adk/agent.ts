import { FunctionTool, LlmAgent, SequentialAgent, zodObjectToSchema } from "@google/adk";
import { z } from "zod";
import type { GenerateContentConfig } from "@google/genai";

const MODEL_TOOLS = process.env.KAIROS_MODEL_TOOLS ?? process.env.KAIROS_GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";
const MODEL_FORMAT = process.env.KAIROS_MODEL_FORMAT ?? process.env.KAIROS_GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";

const DEBUG_TOOLS = process.env.KAIROS_DEBUG_TOOLS === "1";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/** -------------------- Throttle model calls (avoid burst quota) -------------------- **/
function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

const MIN_MODEL_INTERVAL_MS = 3500;
let nextModelTime = Date.now();

async function throttleModelCalls(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextModelTime - now);
  const jitter = Math.floor(Math.random() * 250);
  nextModelTime = Math.max(nextModelTime, now) + MIN_MODEL_INTERVAL_MS;
  if (wait > 0) await sleep(wait + jitter);
}

type LlmAgentConfig = ConstructorParameters<typeof LlmAgent>[0];
type BeforeModelCallback = NonNullable<LlmAgentConfig["beforeModelCallback"]>;
type AfterToolCallback = NonNullable<LlmAgentConfig["afterToolCallback"]>;

const beforeModelCallback: BeforeModelCallback = async (..._args: any[]): Promise<undefined> => {
  await throttleModelCalls();
  return undefined;
};

/** -------------------- State helpers -------------------- **/
function stateGet(st: any, key: string): any {
  try {
    if (st?.get) return st.get(key);
    return st?.[key];
  } catch {
    return undefined;
  }
}
function stateSet(st: any, key: string, val: any) {
  if (!st) return;
  if (st?.set) st.set(key, val);
  else st[key] = val;
}

/** -------------------- After-tool callback: record tool calls into state -------------------- **/
const afterToolCallback: AfterToolCallback = async ({ tool, args, response, context }: any) => {
  const st = context?.state;
  const key = "kairos:toolRuns";
  const prev = stateGet(st, key);
  const arr: any[] = Array.isArray(prev) ? prev : [];

  // Keep entries small (serializable + not gigantic)
  const entry = {
    at: new Date().toISOString(),
    tool: tool?.name ?? "unknown_tool",
    args,
    response,
  };

  arr.push(entry);

  // prevent unbounded growth in dev UI
  const trimmed = arr.slice(-30);
  stateSet(st, key, trimmed);

  if (DEBUG_TOOLS) {
    // eslint-disable-next-line no-console
    console.log("[TOOL]", entry.tool, entry.args, "=>", entry.response?.status ?? "ok");
  }

  return undefined;
};

/** -------------------- Tools (wrapped object outputs) -------------------- **/

/**
 * Combined weather tool: 1 call per location (deterministic inside tool)
 * Returns a compact forecast summary to reduce tokens + state size.
 */
const weatherForecastForLocation = new FunctionTool({
  name: "weather_forecast_for_location",
  description:
    "Given a location string, geocode via OpenWeather and fetch 5-day forecast. Returns compact points for supply-chain disruption analysis.",
  parameters: z.object({
    location: z.string().describe("Location text, e.g., 'Ontario, Canada'"),
    units: z.enum(["metric", "imperial", "standard"]).optional().default("metric"),
  }),
  execute: async ({ location, units }) => {
    const key = mustEnv("OPENWEATHER_API_KEY");

    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
      location
    )}&limit=5&appid=${key}`;

    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      return { status: "error", kind: "weather", step: "geocode", location, error_message: `OpenWeather geocode failed (${geoRes.status})`, url: geoUrl };
    }

    const candidates = (await geoRes.json()) as any[];
    const best =
      candidates.find((c) => String(c?.country || "").toUpperCase() === "CA") ??
      candidates[0] ??
      null;

    if (!best?.lat || !best?.lon) {
      return { status: "error", kind: "weather", step: "geocode", location, error_message: "No usable geocode result", candidatesCount: candidates.length };
    }

    const fcUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${best.lat}&lon=${best.lon}&units=${units}&appid=${key}`;
    const fcRes = await fetch(fcUrl);
    if (!fcRes.ok) {
      return { status: "error", kind: "weather", step: "forecast", location, error_message: `OpenWeather forecast failed (${fcRes.status})`, url: fcUrl };
    }

    const raw = await fcRes.json();

    // Compact points: first 16 x 3-hour blocks (~2 days) to stay light
    const points = Array.isArray(raw?.list)
      ? raw.list.slice(0, 16).map((p: any) => ({
          dt_txt: p?.dt_txt,
          temp: p?.main?.temp,
          wind: p?.wind?.speed,
          pop: p?.pop,
          rain_3h: p?.rain?.["3h"] ?? 0,
          snow_3h: p?.snow?.["3h"] ?? 0,
          weather: Array.isArray(p?.weather) ? p.weather[0]?.main : undefined,
        }))
      : [];

    return {
      status: "success",
      kind: "weather",
      location,
      geocode: { name: best?.name, country: best?.country, lat: best.lat, lon: best.lon },
      city: raw?.city ? { name: raw.city.name, country: raw.city.country, timezone: raw.city.timezone } : undefined,
      pointsCount: points.length,
      points,
    };
  },
});

async function gdeltFetch(query: string, timespan: string, maxrecords: number, sort: string) {
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?` +
    `query=${encodeURIComponent(query)}` +
    `&mode=artlist` +
    `&format=json` +
    `&timespan=${encodeURIComponent(timespan)}` +
    `&maxrecords=${maxrecords}` +
    `&sort=${encodeURIComponent(sort)}`;

  const res = await fetch(url);
  if (!res.ok) {
    return { status: "error", error_message: `GDELT failed (${res.status})`, url };
  }

  const raw = await res.json();
  const articles = Array.isArray(raw?.articles)
    ? raw.articles.slice(0, 12).map((a: any) => ({
        title: a?.title,
        url: a?.url,
        seendate: a?.seendate,
        sourceCountry: a?.sourceCountry,
        domain: a?.domain,
      }))
    : [];

  return {
    status: "success",
    url,
    articleCount: articles.length,
    articles,
  };
}

const gdeltGeoSearch = new FunctionTool({
  name: "gdelt_geo_search",
  description: "Search GDELT for geopolitics/trade policy signals affecting agriculture supply chains.",
  parameters: z.object({
    query: z.string(),
    timespan: z.string().optional().default("3days"),
    maxrecords: z.number().optional().default(25),
    sort: z.enum(["datedesc", "dateasc", "hybridrel", "rel"]).optional().default("datedesc"),
  }),
  execute: async ({ query, timespan, maxrecords, sort }) => {
    const r = await gdeltFetch(query, timespan, maxrecords, sort);
    return { kind: "geopolitics", query, timespan, maxrecords, sort, ...r };
  },
});

const gdeltLogisticsSearch = new FunctionTool({
  name: "gdelt_logistics_search",
  description: "Search GDELT for logistics disruption signals (ports, rail delays, strikes, congestion) affecting agriculture distribution.",
  parameters: z.object({
    query: z.string(),
    timespan: z.string().optional().default("3days"),
    maxrecords: z.number().optional().default(25),
    sort: z.enum(["datedesc", "dateasc", "hybridrel", "rel"]).optional().default("datedesc"),
  }),
  execute: async ({ query, timespan, maxrecords, sort }) => {
    const r = await gdeltFetch(query, timespan, maxrecords, sort);
    return { kind: "logistics", query, timespan, maxrecords, sort, ...r };
  },
});

/** -------------------- ToolRunner agent (LLM + tools, NO outputSchema) -------------------- **/
const toolsGenCfg: GenerateContentConfig = {
  temperature: 0.1,
  maxOutputTokens: 120,
};

const ToolRunner = new LlmAgent({
  name: "ToolRunner",
  model: MODEL_TOOLS,
  tools: [weatherForecastForLocation, gdeltGeoSearch, gdeltLogisticsSearch],
  beforeModelCallback,
  afterToolCallback,
  generateContentConfig: toolsGenCfg,
  instruction: `
You are Kairos ToolRunner (agriculture supply chain only).
Your ONLY job is to call tools and then return a tiny JSON acknowledgement.

You MUST do these tool calls every run:
1) For each dataset.location (up to first 3): call weather_forecast_for_location(location).
2) Call gdelt_geo_search once with a BROAD query.
3) Call gdelt_logistics_search once with a BROAD query.

Rules:
- Read the dataset + insiderNotes from the user's JSON message.
- Build BROAD GDELT queries using the dataset terms.
- DO NOT write analysis. DO NOT summarize.
- After finishing tool calls, return EXACTLY:
{"status":"tool_calls_completed"}

Hints for queries:
Geo query:
(tariff OR sanction OR embargo OR "export control" OR "import ban" OR "trade restriction")
AND (fertilizer OR potash OR urea OR seed OR pesticide OR grain OR agriculture)
AND ("Nutrien" OR "Mosaic" OR Canada OR Ontario OR Manitoba OR Alberta)

Logistics query:
("port congestion" OR "port closure" OR strike OR "rail delay" OR "rail strike" OR "container backlog" OR "truck shortage")
AND (Vancouver OR Toronto OR Calgary OR Saskatoon OR Regina OR Canada)
AND (fertilizer OR potash OR urea OR grain OR agriculture)
`,
});

/** -------------------- Formatter agent (LLM, NO tools, WITH outputSchema) -------------------- **/

const WeatherSignal = z.object({
  title: z.string(),
  summary: z.string(),
  location: z.string(),
  timeWindow: z.string(),
  severity: z.number().min(0).max(100),
  evidence: z.array(z.string()),
});

const GeoSignal = z.object({
  title: z.string(),
  summary: z.string(),
  region: z.string(),
  severity: z.number().min(0).max(100),
  links: z.array(z.string()),
  evidence: z.array(z.string()),
});

const LogisticsSignal = z.object({
  title: z.string(),
  summary: z.string(),
  corridor: z.string(),
  severity: z.number().min(0).max(100),
  links: z.array(z.string()),
  evidence: z.array(z.string()),
});

const InsiderSignal = z.object({
  title: z.string(),
  summary: z.string(),
  severity: z.number().min(0).max(100),
  evidence: z.array(z.string()),
});

const FinalSchemaZod = z.object({
  signals: z.object({
    weatherSignals: z.array(WeatherSignal),
    geoSignals: z.array(GeoSignal),
    logisticsSignals: z.array(LogisticsSignal),
    insiderSignals: z.array(InsiderSignal),
  }),
  risk: z.object({
    overallScore: z.number().min(0).max(100),
    level: z.enum(["low", "medium", "high"]),
    breakdown: z.object({
      weather: z.number().min(0).max(100),
      geopolitics: z.number().min(0).max(100),
      logistics: z.number().min(0).max(100),
      insider: z.number().min(0).max(100),
    }),
    why: z.array(z.string()),
  }),
  aiInsights: z.array(z.string()),
  predictions: z.array(
    z.object({
      horizon: z.string(),
      prediction: z.string(),
      confidence: z.number().min(0).max(1),
      drivers: z.array(z.string()),
    })
  ),
  strategies: z.array(z.string()),
  actionPlan: z.array(
    z.object({
      step: z.number().int().min(1),
      do: z.string(),
      output: z.string(),
      owner: z.string(),
      eta: z.string(),
    })
  ),
});

const formatGenCfg: GenerateContentConfig = {
  temperature: 0.2,
  maxOutputTokens: 1200,
};

const Formatter = new LlmAgent({
  name: "Formatter",
  model: MODEL_FORMAT,
  beforeModelCallback,
  generateContentConfig: formatGenCfg,
  includeContents: "default",
  outputSchema: zodObjectToSchema(FinalSchemaZod),
  outputKey: "final",
  instruction: `
You are Kairos Formatter (agriculture supply chain only).

You will receive:
- The user's dataset + insiderNotes in the conversation history.
- Tool runs in state key kairos:toolRuns (may be absent).

Tool runs injected here (JSON):
{kairos:toolRuns?}

Hard rules:
- Output MUST match the output schema exactly (pure JSON).
- You may fabricate ONLY numeric heuristics (scores/confidence) when info is insufficient.
- You must NOT fabricate external facts (no made-up rain, strikes, sanctions, closures).
  Only claim events if they appear in tool runs (weather_forecast_for_location points or GDELT articles)
  OR directly stated in insiderNotes.

How to build signals:
1) Weather:
- If weather tool success exists for a location, inspect points for potential disruption (high wind, high precip, snow, high pop).
- If no major patterns, create a low-severity "No major weather disruptions detected (tool-backed)" signal with evidence like "pointsCount=16".
- If weather tool errored, create "Weather data unavailable" signal with evidence containing error_message/url.

2) Geopolitics + Logistics:
- If GDELT success has articleCount>0, create 1-3 signals based on article titles; include links.
- If articleCount==0, create a low-severity baseline "No major ... found (tool-backed)" with evidence including the query and articleCount=0.
- If tool errored, create "Data unavailable" signal with evidence including error_message/url.

3) Insider:
- Always convert insiderNotes to insiderSignals (severity heuristic allowed), evidence must quote the note.

Risk scoring:
- Use exposures/kpis + signal severities.
- If only insider exists, overallScore should still be >0 (heuristic).
- Use conditional language in predictions when data is limited ("If the rail backlog persists...").
`,
});

/** -------------------- Root -------------------- **/
export const rootAgent = new SequentialAgent({
  name: "KairosRoot",
  subAgents: [ToolRunner, Formatter],
});