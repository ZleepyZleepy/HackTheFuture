import { FunctionTool, LlmAgent, SequentialAgent, zodObjectToSchema } from "@google/adk";
import { z } from "zod";
import type { GenerateContentConfig } from "@google/genai";

const MODEL_TOOLS =
  process.env.KAIROS_MODEL_TOOLS ??
  process.env.KAIROS_GEMINI_MODEL ??
  "gemini-3.1-flash-lite-preview";
const MODEL_FORMAT =
  process.env.KAIROS_MODEL_FORMAT ??
  process.env.KAIROS_GEMINI_MODEL ??
  "gemini-3.1-flash-lite-preview";

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

  const entry = {
    at: new Date().toISOString(),
    tool: tool?.name ?? "unknown_tool",
    args,
    response,
  };

  arr.push(entry);

  const trimmed = arr.slice(-30);
  stateSet(st, key, trimmed);

  if (DEBUG_TOOLS) {
    console.log("[TOOL]", entry.tool, entry.args, "=>", entry.response?.status ?? "ok");
  }

  return undefined;
};

/** -------------------- Tools (wrapped object outputs) -------------------- **/

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
      return {
        status: "error",
        kind: "weather",
        step: "geocode",
        location,
        error_message: `OpenWeather geocode failed (${geoRes.status})`,
        url: geoUrl,
      };
    }

    const candidates = (await geoRes.json()) as any[];
    const best =
      candidates.find((c) => String(c?.country || "").toUpperCase() === "CA") ??
      candidates[0] ??
      null;

    if (!best?.lat || !best?.lon) {
      return {
        status: "error",
        kind: "weather",
        step: "geocode",
        location,
        error_message: "No usable geocode result",
        candidatesCount: candidates.length,
      };
    }

    const fcUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${best.lat}&lon=${best.lon}&units=${units}&appid=${key}`;
    const fcRes = await fetch(fcUrl);
    if (!fcRes.ok) {
      return {
        status: "error",
        kind: "weather",
        step: "forecast",
        location,
        error_message: `OpenWeather forecast failed (${fcRes.status})`,
        url: fcUrl,
      };
    }

    const raw = await fcRes.json();

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
      city: raw?.city
        ? { name: raw.city.name, country: raw.city.country, timezone: raw.city.timezone }
        : undefined,
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
  description:
    "Search GDELT for logistics disruption signals (ports, rail delays, strikes, congestion) affecting agriculture distribution.",
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
const multiSentenceString = z
  .string()
  .min(90)
  .regex(
    /^(?=(?:.*[.!?]){2,}).+$/,
    "Must contain at least two complete sentences."
  )
  .describe(
    "Must contain at least 2 complete sentences. Single-sentence output is invalid. Use at least 2 sentence-ending punctuation marks such as '.' or '?' or '!'."
  );

const WeatherSignal = z.object({
  title: z.string(),
  summary: multiSentenceString,
  location: z.string(),
  timeWindow: z.string(),
  severity: z.number().min(0).max(100),
  evidence: z.array(z.string()).min(1),
});

const GeoSignal = z.object({
  title: z.string(),
  summary: multiSentenceString,
  region: z.string(),
  severity: z.number().min(0).max(100),
  links: z.array(z.string()),
  evidence: z.array(z.string()).min(1),
});

const LogisticsSignal = z.object({
  title: z.string(),
  summary: multiSentenceString,
  corridor: z.string(),
  severity: z.number().min(0).max(100),
  links: z.array(z.string()),
  evidence: z.array(z.string()).min(1),
});

const InsiderSignal = z.object({
  title: z.string(),
  summary: multiSentenceString,
  severity: z.number().min(0).max(100),
  evidence: z.array(z.string()).min(1),
});

const StrategyItem = z.object({
  title: z.string(),
  summary: multiSentenceString,
  effectiveness: z.number().min(0).max(1),
});

const PredictionItem = z.object({
  category: z.enum(["short_term", "long_term"]),
  horizon: z.string(),
  title: z.string(),
  prediction: multiSentenceString,
  confidence: z.number().min(0).max(1),
  drivers: z.array(z.string()),
});

const ActionPlanItem = z.object({
  step: z.number().int().min(1),
  do: z.string(),
  details: multiSentenceString,
});

const FinanceOpportunity = z.object({
  title: z.string(),
  impact: z.string(),
  type: z.string(),
  level: z.enum(["low", "medium", "high"]),
  detail: multiSentenceString,
});

const FinanceTrendPoint = z.object({
  month: z.string(),
  revenue: z.number().min(0),
  cost: z.number().min(0),
  profit: z.number(),
});

const FinanceSavingsDriver = z.object({
  name: z.string(),
  value: z.number(),
});

const FinanceProfitScenarioPoint = z.object({
  stage: z.string(),
  value: z.number(),
});

const FinanceMarginPoint = z.object({
  month: z.string(),
  margin: z.number(),
});

const FinanceBlock = z.object({
  currentRevenue: z.number(),
  currentCost: z.number(),
  currentProfit: z.number(),
  marginPct: z.number(),
  potentialSavings: z.number(),
  lossAvoidance: z.number(),
  addedValue: z.number(),
  profitLiftPct: z.number(),
  monthlyTrend: z.array(FinanceTrendPoint).min(4),
  savingsDrivers: z.array(FinanceSavingsDriver).min(4),
  profitScenario: z.array(FinanceProfitScenarioPoint).min(4),
  marginTrend: z.array(FinanceMarginPoint).min(4),
  opportunities: z.array(FinanceOpportunity).length(4),
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
  aiInsights: z.array(multiSentenceString).length(4),
  predictions: z.array(PredictionItem).min(2),
  strategies: z.array(StrategyItem).min(3),
  actionPlan: z.array(ActionPlanItem).min(4),
  finance: FinanceBlock,
});

const formatGenCfg: GenerateContentConfig = {
  temperature: 0.2,
  maxOutputTokens: 4500,
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
- You may fabricate ONLY numeric heuristics (scores/confidence/effectiveness/finance estimates) when info is insufficient.
- You must NOT fabricate external facts (no made-up rain, strikes, sanctions, closures).
  Only claim events if they appear in tool runs (weather_forecast_for_location points or GDELT articles)
  OR directly stated in insiderNotes.
- Every signal must have a non-empty evidence array.
- Do NOT use empty evidence.
- Do NOT use evidence like "0 searches found", "0 results found", or similar wording.
- If no material news articles are available, evidence should instead reference the query theme used, the relevant dataset context, the inspected region/corridor, the tool source, or any tool error message.

Important writing rule:
- Every descriptive field that is not a title must contain AT LEAST 2 complete sentences.
- A single sentence is invalid.
- This includes signal summaries, aiInsights, strategy summaries, prediction explanations, action plan details, and finance opportunity detail.
- Each of these fields must contain at least 2 sentence-ending punctuation marks such as "." or "?" or "!".
- Do not merge everything into one long sentence with commas or semicolons.
- Do not use sentence fragments in place of a second sentence.
- Detailed explanatory sentences are allowed.

How to build signals:
1) Weather:
- If weather tool success exists for a location, inspect points for potential disruption (high wind, high precip, snow, high pop).
- If weather tool errored, create "Weather data unavailable" signal with evidence containing error_message/url.

2) Geopolitics + Logistics:
- If GDELT success has articleCount>0, create 1-3 signals based on article titles; include links.
- If articleCount indicates no material matches, create a low-severity baseline "No major ... found (tool-backed)" signal with evidence referencing the query theme, inspected market/corridor, and source.
- If tool errored, create "Data unavailable" signal with evidence including error_message/url.

3) Insider:
- Always convert insiderNotes to insiderSignals (severity heuristic allowed), evidence must quote or closely paraphrase the note.

4) AI insights:
- Return EXACTLY 4 aiInsights.
- Each aiInsight must contain AT LEAST 2 sentences.

5) Strategies:
- Return AT LEAST 3 strategies.
- Each strategy must have a title.
- Each strategy must include an effectiveness score from 0 to 1.
- Each strategy summary must contain AT LEAST 2 sentences.

6) Predictions:
- Return AT LEAST 2 predictions.
- Include AT LEAST one short_term prediction and one long_term prediction.
- Each prediction must have a title.
- Each prediction explanation must contain AT LEAST 2 sentences.
- Use conditional language when data is limited.

7) Action plan:
- Return AT LEAST 4 steps.
- Each step must have a short action in "do".
- Each step must include "details" as a string with AT LEAST 2 sentences.
- Do NOT include output, owner, or eta fields.

8) Finance:
...
- each opportunity detail must be a string with AT LEAST 2 sentences.

with this:

4) AI insights:
- Return EXACTLY 4 aiInsights.
- Each aiInsight must contain AT LEAST 2 complete sentences.
- Single-sentence aiInsights are invalid.

5) Strategies:
- Return AT LEAST 3 strategies.
- Each strategy must have a title.
- Each strategy must include an effectiveness score from 0 to 1.
- Each strategy summary must contain AT LEAST 2 complete sentences.
- Single-sentence strategy summaries are invalid.

6) Predictions:
- Return AT LEAST 2 predictions.
- Include AT LEAST one short_term prediction and one long_term prediction.
- Each prediction must have a title.
- Each prediction explanation must contain AT LEAST 2 complete sentences.
- Single-sentence prediction explanations are invalid.
- Use conditional language when data is limited.

7) Action plan:
- Return AT LEAST 4 steps.
- Each step must have a short action in "do".
- Each step must include "details" as a string with AT LEAST 2 complete sentences.
- Single-sentence action-plan details are invalid.
- Do NOT include output, owner, or eta fields.

8) Finance:
- Fill the finance object for the Finance page.
- Finance must be generated from dataset context, supply chain signals, and operational risk.
- Numeric finance estimates may be heuristic, but they must be internally consistent.
- currentProfit should be close to currentRevenue - currentCost.
- marginPct should align with currentProfit / currentRevenue.
- potentialSavings, lossAvoidance, and addedValue should reflect the strategy and risk context.
- profitLiftPct should reflect the upside relative to currentProfit.
- monthlyTrend should include at least 4 periods and show a plausible revenue/cost/profit progression.
- savingsDrivers should include at least 4 bars.
- profitScenario should include at least 4 bars.
- marginTrend should align with the monthlyTrend.
- opportunities must contain EXACTLY 4 items.
- opportunity levels may be low, medium, or high.
- each opportunity detail must be a string with AT LEAST 2 complete sentences.
- Single-sentence finance opportunity detail is invalid.
- Do not use hardcoded placeholder wording like "sample" or "example". Make it specific to the current supply chain context.

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