export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createHash } from "crypto";

type AlertLevel = "low" | "medium" | "high";

type KairosAgentOutput = {
  recommendations?: Array<{
    title?: string;
    urgency?: AlertLevel;
    why?: string;
    steps?: string[];
    owner?: string;
    eta?: string;
    evidence?: string[];
  }>;
  escalation?: {
    level?: "none" | "watch" | "escalate";
    message?: string;
    who?: string[];
    when?: string;
    evidence?: string[];
  };
  aiInsights?: string[];
  topExposureDrivers?: Array<{
    driver?: string;
    sharePct?: number;
    evidence?: string;
  }>;
  keyRisks?: Array<{
    risk?: string;
    severity?: AlertLevel;
    evidence?: string[];
  }>;
};

type AlertEmailRequest = {
  meta?: {
    sourceFileName?: string | null;
    count?: number | null;
  } | null;
  kpis?: {
    totalSpend?: number;
    avgLeadTime?: number;
    avgStorage?: number;
    stockoutRiskPct?: number;
  } | null;
  signals?: {
    asOf?: string;
  } | null;
  output?: KairosAgentOutput | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtMoney(value?: number | null): string {
  const n = Number(value ?? 0);
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtNum(value?: number | null, digits = 1): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0);
}

function buildIdempotencyKey(body: AlertEmailRequest): string {
  const fingerprintSource = JSON.stringify({
    dataset: body.meta?.sourceFileName ?? null,
    count: body.meta?.count ?? null,
    stockoutRiskPct: body.kpis?.stockoutRiskPct ?? null,
    escalationMessage: body.output?.escalation?.message ?? null,
    highRisks: (body.output?.keyRisks ?? [])
      .filter((r) => r?.severity === "high")
      .map((r) => r?.risk ?? ""),
    highRecommendations: (body.output?.recommendations ?? [])
      .filter((r) => r?.urgency === "high")
      .map((r) => r?.title ?? ""),
  });

  const hash = createHash("sha256").update(fingerprintSource).digest("hex");
  return `kairos-high-alert/${hash}`;
}

function renderList(items: string[]): string {
  if (items.length === 0) {
    return "<li>None</li>";
  }

  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function normalizeOutput(output: KairosAgentOutput | null | undefined) {
  return {
    recommendations: Array.isArray(output?.recommendations) ? output!.recommendations! : [],
    escalation: {
      level: output?.escalation?.level ?? "none",
      message: output?.escalation?.message ?? "No escalation message provided.",
      who: Array.isArray(output?.escalation?.who) ? output!.escalation!.who! : [],
      when: output?.escalation?.when ?? "N/A",
      evidence: Array.isArray(output?.escalation?.evidence) ? output!.escalation!.evidence! : [],
    },
    aiInsights: Array.isArray(output?.aiInsights) ? output!.aiInsights! : [],
    topExposureDrivers: Array.isArray(output?.topExposureDrivers) ? output!.topExposureDrivers! : [],
    keyRisks: Array.isArray(output?.keyRisks) ? output!.keyRisks! : [],
  };
}

function isHighAlert(output: ReturnType<typeof normalizeOutput>): boolean {
  const hasHighRecommendation = output.recommendations.some(
    (item) => item?.urgency === "high"
  );

  const hasHighRisk = output.keyRisks.some(
    (item) => item?.severity === "high"
  );

  return output.escalation.level === "escalate" || hasHighRecommendation || hasHighRisk;
}

function parseRecipients(raw: string): string[] {
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function formatResendError(err: unknown): string {
  if (!err) return "Unknown Resend error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const alertToRaw = process.env.KAIROS_ALERT_TO;
    const alertFrom = process.env.KAIROS_ALERT_FROM;

    if (!apiKey || !alertToRaw || !alertFrom) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing RESEND_API_KEY, KAIROS_ALERT_TO, or KAIROS_ALERT_FROM in .env.local",
        },
        { status: 500 }
      );
    }

    const recipients = parseRecipients(alertToRaw);

    if (recipients.length === 0) {
      return NextResponse.json(
        { ok: false, error: "KAIROS_ALERT_TO is empty after parsing recipients" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as AlertEmailRequest;
    const normalized = normalizeOutput(body.output);

    if (!body.output) {
      return NextResponse.json(
        { ok: false, error: "Missing output payload" },
        { status: 400 }
      );
    }

    if (!isHighAlert(normalized)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Alert is not high",
      });
    }

    const resend = new Resend(apiKey);

    const datasetName = body.meta?.sourceFileName ?? "Current dataset";
    const rowCount = Number(body.meta?.count ?? 0);
    const stockoutRiskPct = Number(body.kpis?.stockoutRiskPct ?? 0);
    const avgLeadTime = Number(body.kpis?.avgLeadTime ?? 0);
    const avgStorage = Number(body.kpis?.avgStorage ?? 0);
    const totalSpend = Number(body.kpis?.totalSpend ?? 0);

    const highRisks = normalized.keyRisks
      .filter((item) => item?.severity === "high")
      .slice(0, 5);

    const highRecommendations = normalized.recommendations
      .filter((item) => item?.urgency === "high")
      .slice(0, 5);

    const subject = "Action Required: KAIROS ALERT";

    const text = [
      "Action Required: KAIROS ALERT",
      "",
      `Dataset: ${datasetName}`,
      `Rows: ${rowCount}`,
      `Total Spend: ${fmtMoney(totalSpend)}`,
      `Avg Lead Time: ${fmtNum(avgLeadTime)} days`,
      `Avg Storage: ${fmtNum(avgStorage)} days`,
      `Stockout Risk: ${fmtNum(stockoutRiskPct)}%`,
      `Signals As-Of: ${
        body.signals?.asOf ? new Date(body.signals.asOf).toLocaleString() : "N/A"
      }`,
      "",
      `Message: ${normalized.escalation.message}`,
      "",
      "High Risks:",
      ...(highRisks.length > 0
        ? highRisks.map((risk) => `- ${risk.risk ?? "Unnamed high risk"}`)
        : ["- None"]),
      "",
      "High-Urgency Recommendations:",
      ...(highRecommendations.length > 0
        ? highRecommendations.map((rec) => `- ${rec.title ?? "Untitled"}: ${rec.why ?? ""}`)
        : ["- None"]),
    ].join("\n");

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 12px; color: #b91c1c;">Action Required: KAIROS ALERT</h2>

        <p style="margin: 0 0 14px;">
          Kairos detected a high-severity issue that needs attention.
        </p>

        <p style="margin: 0 0 14px;">
          <strong>Dataset:</strong> ${escapeHtml(datasetName)}<br />
          <strong>Rows:</strong> ${rowCount}<br />
          <strong>Total Spend:</strong> ${escapeHtml(fmtMoney(totalSpend))}<br />
          <strong>Avg Lead Time:</strong> ${escapeHtml(fmtNum(avgLeadTime))} days<br />
          <strong>Avg Storage:</strong> ${escapeHtml(fmtNum(avgStorage))} days<br />
          <strong>Stockout Risk:</strong> ${escapeHtml(fmtNum(stockoutRiskPct))}%<br />
          <strong>Signals As-Of:</strong> ${
            body.signals?.asOf
              ? escapeHtml(new Date(body.signals.asOf).toLocaleString())
              : "N/A"
          }
        </p>

        <h3 style="margin: 16px 0 8px;">Summary</h3>
        <p style="margin: 0 0 16px;">
          ${escapeHtml(normalized.escalation.message)}
        </p>

        <h3 style="margin: 16px 0 8px;">High risks</h3>
        <ul>
          ${renderList(highRisks.map((risk) => risk.risk ?? "Unnamed high risk"))}
        </ul>

        <h3 style="margin: 16px 0 8px;">High-urgency recommendations</h3>
        <ul>
          ${renderList(
            highRecommendations.map((rec) => `${rec.title ?? "Untitled"} - ${rec.why ?? ""}`)
          )}
        </ul>
      </div>
    `;

    const idempotencyKey = buildIdempotencyKey(body);

    const { data, error } = await resend.emails.send({
      from: alertFrom,
      to: recipients,
      subject,
      html,
      text,
      replyTo: alertFrom,
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: formatResendError(error),
          idempotencyKey,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      emailId: data?.id ?? null,
      idempotencyKey,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : formatResendError(error);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}