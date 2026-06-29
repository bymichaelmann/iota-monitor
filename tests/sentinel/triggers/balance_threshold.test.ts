import { describe, it, expect } from "vitest";
import type { IotaClient } from "@iota/iota-sdk/client";
import type { Rule } from "../../../src/lib/rules.js";
import type { RuleState } from "../../../src/lib/state.js";
import { poll } from "../../../src/sentinel/triggers/balance_threshold.js";

function mockClient(balance: string): IotaClient {
  return {
    getBalance: async () => ({
      totalBalance: balance,
      coinType: "0x2::iota::IOTA",
    }),
  } as unknown as IotaClient;
}

describe("balance_threshold trigger", () => {
  it("alerts when balance drops below threshold", async () => {
    const client = mockClient("5000000000"); // 5 IOTA
    const rule: Rule = {
      id: "balance-test",
      type: "balance_threshold",
      params: { address: "0x1234", below: "10" }, // below 10 IOTA
      notify: ["stdout"],
    };
    const state: RuleState = { lastCursor: null, lastValue: "10000000000", lastAlertHash: null };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("balance_threshold");
    expect(alerts[0].severity).toBe("warn");
    expect(alerts[0].title).toContain("below");
  });

  it("alerts when balance goes above threshold", async () => {
    const client = mockClient("20000000000"); // 20 IOTA
    const rule: Rule = {
      id: "balance-test",
      type: "balance_threshold",
      params: { address: "0x1234", above: "15" }, // above 15 IOTA
      notify: ["stdout"],
    };
    const state: RuleState = { lastCursor: null, lastValue: "10000000000", lastAlertHash: null };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toContain("above");
  });

  it("does not re-alert if balance stays below threshold", async () => {
    const client = mockClient("5000000000"); // 5 IOTA
    const rule: Rule = {
      id: "balance-test",
      type: "balance_threshold",
      params: { address: "0x1234", below: "10" },
      notify: ["stdout"],
    };
    // Previous balance was also below threshold
    const state: RuleState = { lastCursor: null, lastValue: "3000000000", lastAlertHash: null };

    const alerts = await poll(client, rule, state);
    // Should not alert because it was already below
    expect(alerts).toHaveLength(0);
  });

  it("does not alert when balance is above threshold", async () => {
    const client = mockClient("20000000000"); // 20 IOTA
    const rule: Rule = {
      id: "balance-test",
      type: "balance_threshold",
      params: { address: "0x1234", below: "10" },
      notify: ["stdout"],
    };
    const state: RuleState = { lastCursor: null, lastValue: "20000000000", lastAlertHash: null };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(0);
  });

  it("handles no thresholds set", async () => {
    const client = mockClient("5000000000");
    const rule: Rule = {
      id: "balance-test",
      type: "balance_threshold",
      params: { address: "0x1234" },
      notify: ["stdout"],
    };
    const state: RuleState = { lastCursor: null, lastValue: null, lastAlertHash: null };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(0);
  });
});
