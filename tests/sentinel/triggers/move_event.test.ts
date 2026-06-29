import { describe, it, expect } from "vitest";
import type { IotaClient } from "@iota/iota-sdk/client";
import type { Rule } from "../../../src/lib/rules.js";
import type { RuleState } from "../../../src/lib/state.js";
import { poll } from "../../../src/sentinel/triggers/move_event.js";

function mockClient(
  initialEvents: any[],
  newEvents: any[] = [],
): IotaClient {
  return {
    queryEvents: async ({ cursor }: any) => {
      // When no cursor is provided, return initial events (bootstrap)
      if (!cursor) {
        return {
          data: initialEvents,
          nextCursor: initialEvents.length > 0 ? "cursor-after-bootstrap" : null,
          hasNextPage: false,
        };
      }
      // With a cursor, return new events (subsequent polls)
      return {
        data: newEvents,
        nextCursor: newEvents.length > 0 ? "cursor-after-new" : null,
        hasNextPage: false,
      };
    },
  } as unknown as IotaClient;
}

describe("move_event trigger", () => {
  it("returns empty alerts on first run (no prior cursor)", async () => {
    const client = mockClient([
      { id: { txDigest: "tx1", eventSeq: "0" }, type: "test" },
    ]);
    const rule: Rule = {
      id: "move-test",
      type: "move_event",
      params: { package: "0x2", module: "test" },
      notify: ["stdout"],
    };
    const state: RuleState = { lastCursor: null, lastValue: null, lastAlertHash: null };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(0);
    expect(state.lastCursor).toBe("cursor-after-bootstrap");
  });

  it("returns alerts for new events after initial cursor", async () => {
    // First we need to bootstrap (set lastCursor)
    const client = mockClient(
      [{ id: { txDigest: "tx0", eventSeq: "0" }, type: "bootstrap" }],
      [{ id: { txDigest: "tx1", eventSeq: "0" }, type: "new-event", data: { value: 42 } }],
    );
    const rule: Rule = {
      id: "move-test",
      type: "move_event",
      params: { package: "0x2", module: "test" },
      notify: ["stdout"],
    };

    // Simulate: first run (bootstrap) - sets cursor, no alerts
    const state: RuleState = { lastCursor: null, lastValue: null, lastAlertHash: null };
    await poll(client, rule, state);
    expect(state.lastCursor).toBe("cursor-after-bootstrap");

    // Second run with cursor - should find new events and emit alerts
    const alerts = await poll(client, rule, state);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].ruleId).toBe("move-test");
    expect(alerts[0].type).toBe("move_event");
    expect(alerts[0].title).toContain("Move Event");
  });

  it("handles empty event page", async () => {
    const client = mockClient(
      [{ id: { txDigest: "tx0", eventSeq: "0" }, type: "bootstrap" }],
      [], // No new events
    );
    const rule: Rule = {
      id: "move-test",
      type: "move_event",
      params: { package: "0x2", module: "test" },
      notify: ["stdout"],
    };

    const state: RuleState = { lastCursor: "cursor-from-bootstrap", lastValue: null, lastAlertHash: null };
    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(0);
  });
});
