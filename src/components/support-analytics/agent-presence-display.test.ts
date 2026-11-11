import assert from "node:assert/strict";
import {
  buildPresenceSinceLines,
  filterDisplayPresenceChannels,
  formatAgentPresenceCardSubtitle,
  formatPresenceSinceLocal,
  formatPresenceSinceShort,
  isAllChannelsChannel,
  presenceBadgeClassName,
  presenceBadgeTone,
  presenceStaleTitle,
  type AgentPresencePublic,
} from "./agent-presence-display.js";

const iso = "2026-11-11T18:45:00.000Z";

function basePresence(overrides: Partial<AgentPresencePublic>): AgentPresencePublic {
  return {
    channels: [],
    label: "Idle",
    available: false,
    loggedIn: true,
    updatedAt: iso,
    fetchedAt: "2026-11-12T07:00:00.000Z",
    stale: false,
    ...overrides,
  };
}

for (const status of ["Idle", "Lunch", "Break", "Meeting", "Training", "Unavailable"] as const) {
  const lines = buildPresenceSinceLines(basePresence({ label: status }), "UTC");
  assert.equal(lines.length, 1);
  assert.ok(lines[0]!.text?.startsWith(`${status} since `));
  assert.match(lines[0]!.text!, /Nov 2026/);
}

{
  const lines = buildPresenceSinceLines(basePresence({ updatedAt: null }), "UTC");
  assert.equal(lines[0]!.text, null);
}

{
  const lines = buildPresenceSinceLines(basePresence({ label: "Mixed", updatedAt: iso }), "UTC");
  assert.equal(lines.length, 0);
  assert.doesNotMatch(
    buildPresenceSinceLines(
      basePresence({
        label: "Mixed",
        updatedAt: iso,
        channels: [
          {
            channel: "Email",
            statusId: 1,
            statusName: "Idle",
            available: true,
            loggedIn: true,
            currentAssignmentLoad: null,
            availabilityUpdatedAt: null,
          },
        ],
      }),
      "UTC",
    )[0]!.text ?? "",
    /since/,
  );
}

{
  const mixed = basePresence({
    label: "Mixed",
    updatedAt: iso,
    channels: [
      {
        channel: "All channels",
        statusId: 1,
        statusName: "Idle",
        available: true,
        loggedIn: true,
        currentAssignmentLoad: null,
        availabilityUpdatedAt: iso,
      },
      {
        channel: "Email queue",
        statusId: 3,
        statusName: "Break",
        available: false,
        loggedIn: true,
        currentAssignmentLoad: null,
        availabilityUpdatedAt: "2026-11-11T19:00:00.000Z",
      },
      {
        channel: "Messaging",
        statusId: 4,
        statusName: "Lunch",
        available: false,
        loggedIn: true,
        currentAssignmentLoad: null,
        availabilityUpdatedAt: "2026-11-11T20:00:00.000Z",
      },
    ],
  });
  const lines = buildPresenceSinceLines(mixed, "UTC");
  assert.equal(lines.length, 2);
  assert.equal(lines.some((l) => l.channelLabel === "All channels"), false);
  assert.ok(lines.find((l) => l.channelLabel === "Email queue")?.text?.startsWith("Break since "));
  assert.ok(lines.find((l) => l.channelLabel === "Messaging")?.text?.startsWith("Lunch since "));
  assert.equal(filterDisplayPresenceChannels(mixed.channels).length, 2);
}

assert.equal(isAllChannelsChannel("All channels"), true);
assert.equal(isAllChannelsChannel("All Channels"), true);
assert.equal(isAllChannelsChannel("Email queue"), false);

assert.equal(formatPresenceSinceLocal(null), null);
const formatted = formatPresenceSinceLocal(iso, { timeZone: "UTC" });
assert.equal(formatted, "11 Nov 2026, 6:45 PM");

assert.equal(formatPresenceSinceShort(iso, { timeZone: "UTC" }), "11 Nov, 6:45 PM");
assert.equal(
  formatAgentPresenceCardSubtitle(basePresence({ label: "Break", updatedAt: iso }), "UTC"),
  "Break · Since 11 Nov, 6:45 PM",
);
assert.equal(formatAgentPresenceCardSubtitle(basePresence({ label: "Idle", updatedAt: null })), "Idle");
assert.match(formatAgentPresenceCardSubtitle(undefined), /^$/);

assert.ok(!presenceBadgeClassName("Idle", false).includes("ring-dashed"));
assert.ok(presenceBadgeClassName("Idle", true).includes("ring-dashed"));
assert.equal(presenceStaleTitle(true), "Presence data may be outdated");
assert.equal(presenceBadgeTone("Meeting"), "busy");
assert.equal(presenceBadgeTone("Mixed"), "mixed");

{
  const stale = basePresence({ stale: true, fetchedAt: iso, updatedAt: null });
  assert.equal(buildPresenceSinceLines(stale, "UTC")[0]!.text, null);
  assert.ok(presenceBadgeClassName("Idle", stale.stale).includes("ring-dashed"));
}

console.log("components/support-analytics/agent-presence-display.test.ts: ok");
