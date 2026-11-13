/**
 * Run: npx tsx src/components/agent-week-kpi-strip.test.ts
 */
import assert from "node:assert/strict";
import {
  buildAgentWeekKpiStripItems,
  metricNumericValue,
  type AgentWeekKpiStripPayload,
} from "./agent-week-kpi-strip.js";
import type { Metric } from "@/lib/format.js";

const goals = {
  firstResponseHours: 4,
  averageResponseHours: 0.5,
  resolutionHours: 12,
  csatPercent: 90,
  slaPercent: 95,
  qaPercent: 90,
};

function metric(value: number): Metric {
  return { value, freshdeskValue: value, source: "freshdesk", provenance: "live" };
}

function baseOwnKpi(overrides: Partial<AgentWeekKpiStripPayload> = {}): AgentWeekKpiStripPayload {
  return {
    label: "Week 46",
    ticketsHandled: metric(42),
    firstResponseHours: metric(2.5),
    averageResponseHours: metric(0.4),
    resolutionHours: metric(8),
    csatPercent: metric(92),
    slaPercent: metric(96),
    qaScore: 88,
    ...overrides,
  };
}

// A — averageResponseHours null, others populated
{
  const ownKpi = baseOwnKpi({ averageResponseHours: null });
  const items = buildAgentWeekKpiStripItems(ownKpi, goals);
  assert.equal(items.find((i) => i.key === "art")?.value, "N/A");
  assert.doesNotThrow(() => buildAgentWeekKpiStripItems(ownKpi, goals));
}

// B — several nullable metric objects
{
  const ownKpi = baseOwnKpi({
    averageResponseHours: null,
    firstResponseHours: null,
    csatPercent: null,
  });
  const items = buildAgentWeekKpiStripItems(ownKpi, goals);
  assert.equal(items.find((i) => i.key === "frt")?.value, "N/A");
  assert.equal(items.find((i) => i.key === "art")?.value, "N/A");
  assert.equal(items.find((i) => i.key === "csat")?.value, "—");
  assert.doesNotThrow(() => buildAgentWeekKpiStripItems(ownKpi, goals));
}

// C — all metric objects null
{
  const ownKpi: AgentWeekKpiStripPayload = {
    label: "Week 46",
    ticketsHandled: null,
    firstResponseHours: null,
    averageResponseHours: null,
    resolutionHours: null,
    csatPercent: null,
    slaPercent: null,
    qaScore: null,
  };
  const items = buildAgentWeekKpiStripItems(ownKpi, goals);
  assert.equal(items.length, 7);
  for (const item of items) {
    assert.ok(item.tone === "neutral" || item.key === "qa");
    if (item.key === "tickets" || item.key === "sla" || item.key === "csat" || item.key === "qa") {
      assert.equal(item.value, "—");
    } else {
      assert.equal(item.value, "N/A");
    }
  }
  assert.doesNotThrow(() => buildAgentWeekKpiStripItems(ownKpi, goals));
}

// D — missing metric values (object present, value null)
{
  const emptyValue: Metric = { value: null, freshdeskValue: null, source: "manual", provenance: "user" };
  const ownKpi = baseOwnKpi({ slaPercent: emptyValue, ticketsHandled: emptyValue });
  const items = buildAgentWeekKpiStripItems(ownKpi, goals);
  assert.equal(items.find((i) => i.key === "sla")?.value, "—");
  assert.equal(items.find((i) => i.key === "tickets")?.value, "—");
}

// E — tone/comparison with null objects and values
{
  assert.equal(metricNumericValue(null), null);
  assert.equal(metricNumericValue({ value: null, freshdeskValue: null, source: "manual", provenance: "user" }), null);
  const ownKpi = baseOwnKpi({ resolutionHours: null, slaPercent: null });
  const items = buildAgentWeekKpiStripItems(ownKpi, goals);
  assert.equal(items.find((i) => i.key === "res")?.tone, "neutral");
  assert.equal(items.find((i) => i.key === "sla")?.tone, "neutral");
}

// F — valid metrics retain formatting
{
  const ownKpi = baseOwnKpi();
  const items = buildAgentWeekKpiStripItems(ownKpi, goals);
  assert.equal(items.find((i) => i.key === "tickets")?.value, "42");
  assert.equal(items.find((i) => i.key === "frt")?.value, "2h 30m");
  assert.equal(items.find((i) => i.key === "csat")?.value, "92.0%");
  assert.equal(items.find((i) => i.key === "qa")?.value, "88.0/100");
  const frtTone = items.find((i) => i.key === "frt")?.tone;
  assert.ok(frtTone === "success" || frtTone === "warning" || frtTone === "critical");
}

console.log("agent-week-kpi-strip.test.ts: ok");
