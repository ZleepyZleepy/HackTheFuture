export const runtime = "nodejs";

import { NextResponse } from "next/server";

function envAny(...names: string[]) {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return null;
}

function normalizeBaseUrl(raw: string) {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  u = u.replace(/\/+$/, "");
  return u;
}

function stripCodeFences(s: string) {
  return s.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
}

function tryParseJsonFromText(text: string): any | null {
  const cleaned = stripCodeFences(text);

  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {}
  }

  return null;
}

// relaxed final detector (because your agent may omit a field sometimes)
function looksLikeFinal(obj: any) {
  if (!obj || typeof obj !== "object") return false;
  if (!obj.signals || !obj.risk) return false;
  return Boolean(obj.aiInsights || obj.actionPlan || obj.predictions || obj.strategies);
}

function deepMerge(target: any, patch: any) {
  if (!patch || typeof patch !== "object") return target;
  if (!target || typeof target !== "object") target = Array.isArray(patch) ? [] : {};

  if (Array.isArray(patch)) return patch;

  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const tv = target[k];
    if (pv && typeof pv === "object" && !Array.isArray(pv)) {
      target[k] = deepMerge(tv, pv);
    } else {
      target[k] = pv;
    }
  }
  return target;
}

function findFinalDeep(root: any): any | null {
  const seen = new WeakSet<object>();

  const walk = (v: any, depth: number): any | null => {
    if (depth > 12) return null;

    if (looksLikeFinal(v)) return v;

    if (typeof v === "string") {
      const parsed = tryParseJsonFromText(v);
      if (parsed) {
        if (looksLikeFinal(parsed)) return parsed;
        if (looksLikeFinal(parsed.final)) return parsed.final;
        if (looksLikeFinal(parsed.output)) return parsed.output;
      }
      return null;
    }

    if (!v || typeof v !== "object") return null;

    if (seen.has(v)) return null;
    seen.add(v);

    // common nests
    const o = v as any;
    if (looksLikeFinal(o.final)) return o.final;
    if (looksLikeFinal(o.output)) return o.output;
    if (looksLikeFinal(o.state)) return o.state;
    if (looksLikeFinal(o.delta)) return o.delta;

    // text-like fields
    for (const key of ["text", "message", "data", "payload"]) {
      if (typeof o[key] === "string") {
        const parsed = tryParseJsonFromText(o[key]);
        if (parsed) {
          if (looksLikeFinal(parsed)) return parsed;
          if (looksLikeFinal(parsed.final)) return parsed.final;
          if (looksLikeFinal(parsed.output)) return parsed.output;
        }
      }
    }

    if (Array.isArray(v)) {
      for (const item of v) {
        const found = walk(item, depth + 1);
        if (found) return found;
      }
      return null;
    }

    for (const k of Object.keys(o)) {
      const found = walk(o[k], depth + 1);
      if (found) return found;
    }

    return null;
  };

  return walk(root, 0);
}

async function ensureSessionExists(adkUrl: string, appName: string, userId: string, sessionId: string) {
  const url = `${adkUrl}/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (res.ok) return;

  const txt = await res.text().catch(() => "");
  if (res.status === 409 || txt.toLowerCase().includes("already exists")) return;

  throw new Error(`ADK session create failed (${res.status}): ${txt.slice(0, 300)}`);
}

async function getSession(adkUrl: string, appName: string, userId: string, sessionId: string) {
  const url = `${adkUrl}/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`ADK get session failed (${res.status}): ${t.slice(0, 500)}`);
  }
  return await res.json();
}

async function listApps(adkUrl: string): Promise<string[]> {
  const res = await fetch(`${adkUrl}/list-apps`, { method: "GET" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? data.map(String) : [];
}

function collectTextPreviews(events: any[], max = 10) {
  const out: string[] = [];
  for (let i = events.length - 1; i >= 0 && out.length < max; i--) {
    const parts = events[i]?.content?.parts ?? [];
    for (let j = parts.length - 1; j >= 0 && out.length < max; j--) {
      const t = parts[j]?.text;
      if (typeof t === "string" && t.trim()) out.push(t.slice(0, 400));
    }
  }
  return out.reverse();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      sessionId?: string;
      dataset?: unknown;
      insiderNotes?: string[];
    };

    const adkUrl = normalizeBaseUrl(envAny("KAIROS_ADK_URL") ?? "http://localhost:8000");
    const appName = envAny("KAIROS_ADK_APP_NAME", "KAIROS_ADK_APPNAME", "KAIROS_ADK_APP") ?? "adk";
    const userId = body.userId ?? "u_anon";
    const sessionId = body.sessionId ?? "kairos";

    // Validate appName to avoid hidden ADK crashes
    const apps = await listApps(adkUrl);
    if (apps.length > 0 && !apps.includes(appName)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Configured appName "${appName}" not found on ADK server`,
          availableApps: apps,
          fix: `Set KAIROS_ADK_APP_NAME to one of: ${apps.join(", ")}`,
        },
        { status: 500 }
      );
    }

    await ensureSessionExists(adkUrl, appName, userId, sessionId);

    // ✅ TypeScript ADK requires camelCase fields for /run
    const runBody = {
      appName,
      userId,
      sessionId,
      streaming: false,
      newMessage: {
        role: "user",
        parts: [
          {
            text: JSON.stringify(
              {
                dataset: body.dataset ?? {},
                insiderNotes: body.insiderNotes ?? [],
              },
              null,
              2
            ),
          },
        ],
      },
    };

    const controller = new AbortController();
    const TIMEOUT_MS = Number(process.env.KAIROS_ADK_TIMEOUT_MS ?? 300_000);
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let runRes: Response;
    try {
      runRes = await fetch(`${adkUrl}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runBody),
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        {
          ok: false,
          error: "ADK fetch failed",
          details: e?.message ?? String(e),
          adkUrl,
          hint: `Start ADK from inside the agent folder (agent.ts): npx adk api_server`,
        },
        { status: 500 }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!runRes.ok) {
      const t = await runRes.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: `ADK run failed (${runRes.status})`,
          details: t.slice(0, 1500),
          adkUrl,
          hint: `Confirm appName="${appName}" matches /list-apps and ADK is running.`,
        },
        { status: 500 }
      );
    }

    const events = (await runRes.json()) as any[];

    // 1) Try find final in event content
    let final = findFinalDeep(events);

    // 2) Apply ALL stateDelta patches into one accumulated state (THIS IS THE BIG FIX)
    if (!final) {
      let accState: any = {};
      for (const evt of events) {
        const delta = evt?.actions?.stateDelta ?? evt?.actions?.state_delta ?? null;
        if (delta && typeof delta === "object") {
          accState = deepMerge(accState, delta);
        }
      }

      // stateDelta may store final as string or object
      final = findFinalDeep(accState);
      if (!final && typeof accState?.final === "string") {
        const parsed = tryParseJsonFromText(accState.final);
        if (parsed && looksLikeFinal(parsed)) final = parsed;
      }
    }

    // 3) If still not found, fetch the full session object and deep scan it
    if (!final) {
      const session = await getSession(adkUrl, appName, userId, sessionId);
      final = findFinalDeep(session);

      // common: session.state.final
      const st = (session as any)?.state;
      if (!final && st && typeof st === "object") {
        if (looksLikeFinal((st as any).final)) final = (st as any).final;
        if (!final && typeof (st as any).final === "string") {
          const parsed = tryParseJsonFromText((st as any).final);
          if (parsed && looksLikeFinal(parsed)) final = parsed;
        }
      }
    }

    if (!final) {
      const previews = collectTextPreviews(events, 10);
      return NextResponse.json(
        {
          ok: false,
          error: "Could not find/parse ADK final JSON from events or session state",
          eventsCount: events.length,
          lastEventKeys: Object.keys(events?.[events.length - 1] ?? {}),
          hint:
            "Most likely ReviewerAgent did NOT return valid JSON, or ADK stored output in stateDelta under an unexpected key. " +
            "See textPreviews for what the model actually returned.",
          textPreviews: previews,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      asOf: new Date().toISOString(),
      appName,
      sessionId,
      output: final,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "analyze failed" }, { status: 500 });
  }
}