import { describe, it, expect } from "vitest";
import type { IotaClient } from "@iota/iota-sdk/client";
import type { Rule } from "../../../src/lib/rules.js";
import type { RuleState } from "../../../src/lib/state.js";
import { poll } from "../../../src/sentinel/triggers/network_param.js";

function mockClient(opts: {
  gasPrice?: string | null;
  epoch?: string;
  gasPriceError?: boolean;
  systemStateError?: boolean;
}): IotaClient {
  return {
    getReferenceGasPrice: async () => {
      if (opts.gasPriceError) throw new Error("RPC fail");
      if (opts.gasPrice === null) return null;
      return opts.gasPrice ?? "1000";
    },
    getLatestIotaSystemState: async () => {
      if (opts.systemStateError) throw new Error("RPC fail");
      return { epoch: opts.epoch ?? "42" };
    },
  } as unknown as IotaClient;
}

const baseState: RuleState = { lastCursor: null, lastValue: null, lastAlertHash: null };

describe("network_param trigger", () => {
  // --- gasAbove threshold: first run crossing ---
  it("alerts on gasAbove threshold on first run (prev=null)", async () => {
    const client = mockClient({ gasPrice: "1500", epoch: "42" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: { gasAbove: "1000" },
      notify: ["stdout"],
    };
    const state: RuleState = { ...baseState, lastValue: null };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("network_param");
    expect(alerts[0].severity).toBe("warn");
    expect(alerts[0].title).toBe("Gas price above threshold");
    expect(alerts[0].data.direction).toBe("above");
  });

  // --- gasAbove threshold: crosses from below ---
  it("alerts when gas crosses above threshold from below", async () => {
    const client = mockClient({ gasPrice: "1200", epoch: "42" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: { gasAbove: "1000" },
      notify: ["stdout"],
    };
    // Previous gas was below threshold
    const state: RuleState = { ...baseState, lastValue: "500" };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].data.direction).toBe("above");
  });

  // --- gasAbove: no re-alert when already above ---
  it("does not re-alert when gas already above threshold", async () => {
    const client = mockClient({ gasPrice: "1500", epoch: "42" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: { gasAbove: "1000" },
      notify: ["stdout"],
    };
    // Previous gas was also above threshold
    const state: RuleState = { ...baseState, lastValue: "1200" };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(0);
  });

  // --- gasBelow threshold: first run crossing ---
  it("alerts on gasBelow threshold on first run (prev=null)", async () => {
    const client = mockClient({ gasPrice: "300", epoch: "42" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: { gasBelow: "1000" },
      notify: ["stdout"],
    };
    const state: RuleState = { ...baseState, lastValue: null };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("info");
    expect(alerts[0].title).toBe("Gas price below threshold");
    expect(alerts[0].data.direction).toBe("below");
  });

  // --- gasBelow: crosses from above ---
  it("alerts when gas crosses below threshold from above", async () => {
    const client = mockClient({ gasPrice: "500", epoch: "42" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: { gasBelow: "1000" },
      notify: ["stdout"],
    };
    // Previous gas was above threshold
    const state: RuleState = { ...baseState, lastValue: "1500" };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].data.direction).toBe("below");
  });

  // --- gasBelow: no re-alert when already below ---
  it("does not re-alert when gas already below threshold", async () => {
    const client = mockClient({ gasPrice: "200", epoch: "42" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: { gasBelow: "1000" },
      notify: ["stdout"],
    };
    const state: RuleState = { ...baseState, lastValue: "300" };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(0);
  });

  // --- epoch change ---
  it("detects epoch change", async () => {
    const client = mockClient({ gasPrice: "1000", epoch: "43" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: {},
      notify: ["stdout"],
    };
    const state: RuleState = { ...baseState, lastCursor: "42", lastValue: null };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("network_param");
    expect(alerts[0].title).toBe("Epoch changed");
    expect(alerts[0].data.from).toBe("42");
    expect(alerts[0].data.to).toBe("43");
  });

  // --- no epoch change ---
  it("does not alert on same epoch", async () => {
    const client = mockClient({ gasPrice: "1000", epoch: "42" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: {},
      notify: ["stdout"],
    };
    const state: RuleState = { ...baseState, lastCursor: "42", lastValue: null };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(0);
  });

  // --- first run epoch (no previous cursor) ---
  it("first run sets epoch but emits no epoch alert", async () => {
    const client = mockClient({ gasPrice: "1000", epoch: "42" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: {},
      notify: ["stdout"],
    };
    const state: RuleState = { ...baseState, lastCursor: null };

    const alerts = await poll(client, rule, state);
    // Should not have epoch alert since no previous epoch
    const epochAlerts = alerts.filter(a => a.title === "Epoch changed");
    expect(epochAlerts).toHaveLength(0);
    expect(state.lastCursor).toBe("42");
  });

  // --- RPC fail for gas returns null handled gracefully ---
  it("handles RPC fail for gas gracefully", async () => {
    const client = mockClient({ gasPriceError: true, epoch: "42" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: { gasAbove: "1000" },
      notify: ["stdout"],
    };
    const state: RuleState = { ...baseState };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(0);
  });

  // --- RPC fail for system state handled gracefully ---
  it("handles RPC fail for system state gracefully", async () => {
    const client = mockClient({ gasPrice: "1000", systemStateError: true });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: {},
      notify: ["stdout"],
    };
    const state: RuleState = { ...baseState };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(0);
  });

  // --- no thresholds configured ---
  it("returns empty when no thresholds configured", async () => {
    const client = mockClient({ gasPrice: "1000", epoch: "42" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: {},
      notify: ["stdout"],
    };
    const state: RuleState = { ...baseState };

    const alerts = await poll(client, rule, state);
    // Should have no gas-related alerts since no thresholds
    const gasAlerts = alerts.filter(
      a => a.title.includes("Gas price") || a.title.includes("gas"),
    );
    expect(gasAlerts).toHaveLength(0);
  });

  // --- both gasAbove and gasBelow with crossing ---
  it("handles both gasAbove and gasBelow thresholds", async () => {
    const client = mockClient({ gasPrice: "1100", epoch: "42" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: { gasAbove: "1000", gasBelow: "500" },
      notify: ["stdout"],
    };
    // Previous gas was 400 (below gasBelow threshold)
    const state: RuleState = { ...baseState, lastValue: "400" };

    const alerts = await poll(client, rule, state);
    // Should have gasAbove alert (crossed from below)
    // Should NOT have gasBelow alert (1100 > 500)
    const aboveAlerts = alerts.filter(a => a.data.direction === "above");
    const belowAlerts = alerts.filter(a => a.data.direction === "below");
    expect(aboveAlerts).toHaveLength(1);
    expect(belowAlerts).toHaveLength(0);
  });

  // --- both gas alert and epoch alert simultaneously ---
  it("emits both gas and epoch alerts simultaneously when both cross", async () => {
    const client = mockClient({ gasPrice: "1500", epoch: "43" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: { gasAbove: "1000" },
      notify: ["stdout"],
    };
    const state: RuleState = { ...baseState, lastCursor: "42", lastValue: null };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(2);
    const types = alerts.map(a => a.title).sort();
    expect(types).toContain("Epoch changed");
    expect(types).toContain("Gas price above threshold");
  });

  // --- epoch change when previousCursor is empty string ---
  it("treats empty string lastCursor as no previous epoch", async () => {
    const client = mockClient({ gasPrice: "1000", epoch: "42" });
    const rule: Rule = {
      id: "net-test",
      type: "network_param",
      params: {},
      notify: ["stdout"],
    };
    const state: RuleState = { ...baseState, lastCursor: "" };

    const alerts = await poll(client, rule, state);
    const epochAlerts = alerts.filter(a => a.title === "Epoch changed");
    expect(epochAlerts).toHaveLength(0);
  });
});
