"use client";

import Link from "next/link";
import AgentRunner from "./AgentRunner";
import { useState } from "react";

type AgentPayload = {
  eventId: string;
  impact: {
    topPart: string;
    daysOfCover: number;
    estLeadTimeDays: number;
    lineStopInDays: number;
    revenueAtRiskUsd: number;
  };
  actions: { title: string; status: string }[];
  alternates: { part: string; score: number; notes: string }[];
  reasoningTrace: string[];
};

export default function EventView({
  eventId,
  initialImpact,
  initialActions,
}: {
  eventId: string;
  initialImpact: AgentPayload["impact"];
  initialActions: AgentPayload["actions"];
}) {
  const [impact, setImpact] = useState(initialImpact);
  const [actions, setActions] = useState(initialActions);
  const [trace, setTrace] = useState<string[] | null>(null);
  const [alternates, setAlternates] = useState<AgentPayload["alternates"]>([]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-500">
            <Link href="/radar" className="hover:underline">
              Radar
            </Link>{" "}
            / Event
          </div>
          <h1 className="text-2xl font-semibold">Event {eventId}</h1>
          <p className="text-sm text-gray-600">
            Impact mapping → alternate parts → trade-off plans → actions.
          </p>
        </div>

        <AgentRunner
          eventId={eventId}
          onDone={(payload: AgentPayload) => {
            setImpact(payload.impact);
            setActions(payload.actions);
            setTrace(payload.reasoningTrace);
            setAlternates(payload.alternates);
          }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Impact snapshot</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Top constrained part</span>
              <span className="font-medium">{impact.topPart}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Days of cover</span>
              <span className="font-medium">{impact.daysOfCover} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Estimated lead time</span>
              <span className="font-medium">{impact.estLeadTimeDays} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Line-stop risk</span>
              <span className="font-medium">~{impact.lineStopInDays} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Revenue at risk</span>
              <span className="font-semibold">
                ${impact.revenueAtRiskUsd.toLocaleString()}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Actions</h2>
          <div className="mt-4 space-y-3">
            {actions.map((a) => (
              <div
                key={a.title}
                className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3 text-sm"
              >
                <div className="font-medium">{a.title}</div>
                <div className="text-gray-600">{a.status}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
      
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Recommended alternates</h2>

        {alternates.length ? (
            <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600">
                <div className="col-span-3">Part</div>
                <div className="col-span-2">Score</div>
                <div className="col-span-7">Notes</div>
            </div>

            {alternates.map((a) => (
                <div
                key={a.part}
                className="grid grid-cols-12 gap-2 border-t px-4 py-3 text-sm"
                >
                <div className="col-span-3 font-medium">{a.part}</div>
                <div className="col-span-2">{Math.round(a.score * 100)}%</div>
                <div className="col-span-7 text-gray-600">{a.notes}</div>
                </div>
            ))}
            </div>
        ) : (
            <p className="mt-2 text-sm text-gray-600">
            Click <span className="font-medium">Run agent</span> to generate alternates.
            </p>
        )}
        </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Reasoning trace</h2>

        {trace ? (
          <div className="mt-4 rounded-lg border bg-gray-50 p-4 text-sm text-gray-700 space-y-1">
            {trace.map((t, i) => (
              <div key={i}>• {t}</div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            Click <span className="font-medium">Run agent</span> to generate a trace.
          </p>
        )}
      </section>
    </div>
  );
}