import { describe, it, expect } from "vitest";
import type { IotaClient } from "@iota/iota-sdk/client";
import type { Rule } from "../../../src/lib/rules.js";
import type { RuleState } from "../../../src/lib/state.js";
import { poll } from "../../../src/sentinel/triggers/validator_change.js";

function mockValidators(validators: any[]): IotaClient {
  return {
    getLatestIotaSystemState: async () => ({
      activeValidators: validators,
    }),
  } as unknown as IotaClient;
}

const baseRule: Rule = {
  id: "val-test",
  type: "validator_change",
  params: {},
  notify: ["stdout"],
};

function makeValidator(name: string, commissionRate = 200, stake = "1000000000000", address = "0x") {
  return {
    name,
    commissionRate,
    stakingPoolIotaBalance: stake,
    iotaAddress: address,
  };
}

describe("validator_change trigger", () => {
  // --- first run (no snapshot) ---
  it("first run sets snapshot and returns no alerts", async () => {
    const validators = [
      makeValidator("ValidatorA"),
      makeValidator("ValidatorB"),
    ];
    const client = mockValidators(validators);
    const state: RuleState = { lastCursor: null, lastValue: null, lastAlertHash: null };

    const alerts = await poll(client, baseRule, state);
    expect(alerts).toHaveLength(0);
    // Should have stored the snapshot
    const snap = state.lastValue as any[];
    expect(snap).toHaveLength(2);
    expect(snap[0].name).toBe("ValidatorA");
    expect(snap[1].name).toBe("ValidatorB");
  });

  // --- new validator added ---
  it("detects new validator added", async () => {
    const previousSnapshot = [
      { name: "ValidatorA", commissionRate: 200, stake: "1000000000000", address: "0xa" },
    ];
    const currentValidators = [
      makeValidator("ValidatorA"),
      makeValidator("ValidatorB"),
    ];
    const client = mockValidators(currentValidators);
    const state: RuleState = { lastCursor: null, lastValue: previousSnapshot, lastAlertHash: null };

    const alerts = await poll(client, baseRule, state);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("validator_change");
    expect(alerts[0].title).toBe("New validator added");
    expect(alerts[0].message).toContain("ValidatorB");
    expect(alerts[0].data.name).toBe("ValidatorB");
  });

  // --- validator removed ---
  it("detects validator removed", async () => {
    const previousSnapshot = [
      { name: "ValidatorA", commissionRate: 200, stake: "1000000000000", address: "0xa" },
      { name: "ValidatorB", commissionRate: 200, stake: "2000000000000", address: "0xb" },
    ];
    const currentValidators = [
      makeValidator("ValidatorA"),
    ];
    const client = mockValidators(currentValidators);
    const state: RuleState = { lastCursor: null, lastValue: previousSnapshot, lastAlertHash: null };

    const alerts = await poll(client, baseRule, state);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("validator_change");
    expect(alerts[0].severity).toBe("warn");
    expect(alerts[0].title).toBe("Validator removed");
    expect(alerts[0].message).toContain("ValidatorB");
  });

  // --- commission change ---
  it("detects commission change", async () => {
    const previousSnapshot = [
      { name: "ValidatorA", commissionRate: 200, stake: "1000000000000", address: "0xa" },
    ];
    const currentValidators = [
      makeValidator("ValidatorA", 300, "1000000000000"), // commission changed 200 -> 300
    ];
    const client = mockValidators(currentValidators);
    const state: RuleState = { lastCursor: null, lastValue: previousSnapshot, lastAlertHash: null };

    const alerts = await poll(client, baseRule, state);
    // Should have commission change alert
    const commissionAlert = alerts.find(a => a.title.startsWith("Commission change"));
    expect(commissionAlert).toBeDefined();
    expect(commissionAlert!.data.from).toBe(200);
    expect(commissionAlert!.data.to).toBe(300);
  });

  // --- stake change (BigInt diff) ---
  it("detects stake change", async () => {
    const previousSnapshot = [
      { name: "ValidatorA", commissionRate: 200, stake: "1000000000000", address: "0xa" },
    ];
    const currentValidators = [
      // stake increased from 1000000000000 to 3000000000000
      makeValidator("ValidatorA", 200, "3000000000000"),
    ];
    const client = mockValidators(currentValidators);
    const state: RuleState = { lastCursor: null, lastValue: previousSnapshot, lastAlertHash: null };

    const alerts = await poll(client, baseRule, state);
    const stakeAlert = alerts.find(a => a.title.startsWith("Stake change"));
    expect(stakeAlert).toBeDefined();
    expect(stakeAlert!.data.diff).toBe("2000000000000");
  });

  // --- no changes between polls ---
  it("returns empty when no changes between polls", async () => {
    const snapshot = [
      { name: "ValidatorA", commissionRate: 200, stake: "1000000000000", address: "0xa" },
      { name: "ValidatorB", commissionRate: 300, stake: "2000000000000", address: "0xb" },
    ];
    const client = mockValidators([
      makeValidator("ValidatorA", 200, "1000000000000"),
      makeValidator("ValidatorB", 300, "2000000000000"),
    ]);
    const state: RuleState = { lastCursor: null, lastValue: snapshot, lastAlertHash: null };

    const alerts = await poll(client, baseRule, state);
    expect(alerts).toHaveLength(0);
  });

  // --- multiple changes at once ---
  it("detects both new validators and removed validators simultaneously", async () => {
    const previousSnapshot = [
      { name: "ValidatorA", commissionRate: 200, stake: "1000000000000", address: "0xa" },
      { name: "ValidatorB", commissionRate: 200, stake: "2000000000000", address: "0xb" },
    ];
    const currentValidators = [
      makeValidator("ValidatorA"), // stays
      makeValidator("ValidatorC"), // new
    ];
    const client = mockValidators(currentValidators);
    const state: RuleState = { lastCursor: null, lastValue: previousSnapshot, lastAlertHash: null };

    const alerts = await poll(client, baseRule, state);
    expect(alerts).toHaveLength(2);
    const addedAlert = alerts.find(a => a.title === "New validator added");
    const removedAlert = alerts.find(a => a.title === "Validator removed");
    expect(addedAlert).toBeDefined();
    expect(removedAlert).toBeDefined();
    expect(addedAlert!.data.name).toBe("ValidatorC");
    expect(removedAlert!.data.name).toBe("ValidatorB");
  });

  // --- RPC error is swallowed ---
  it("swallows RPC errors and returns empty", async () => {
    const client = {
      getLatestIotaSystemState: async () => {
        throw new Error("RPC unavailable");
      },
    } as unknown as IotaClient;
    const state: RuleState = { lastCursor: null, lastValue: null, lastAlertHash: null };

    const alerts = await poll(client, baseRule, state);
    expect(alerts).toHaveLength(0);
  });
});
