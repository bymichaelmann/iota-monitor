import { describe, it, expect } from "vitest";
import type { IotaClient } from "@iota/iota-sdk/client";
import type { Rule } from "../../../src/lib/rules.js";
import type { RuleState } from "../../../src/lib/state.js";
import { poll } from "../../../src/sentinel/triggers/address_activity.js";

function mockClient(
  opts: {
    txs?: any[];
    nextCursor?: string | null;
    queryFn?: (params: any) => Promise<any>;
  } = {},
): IotaClient {
  const { txs = [], nextCursor = null } = opts;
  return {
    queryTransactionBlocks: async (_params: any) => ({
      data: txs,
      nextCursor,
      hasNextPage: false,
    }),
  } as unknown as IotaClient;
}

const baseRule: Rule = {
  id: "addr-test",
  type: "address_activity",
  params: { address: "0xabc123def456" },
  notify: ["stdout"],
};

const baseState: RuleState = { lastCursor: null, lastValue: null, lastAlertHash: null };

function makeTx(digest: string, computationCost = "0", storageCost = "0") {
  return {
    digest,
    effects: {
      gasUsed: { computationCost, storageCost },
    },
  };
}

describe("address_activity trigger", () => {
  // --- direction='from' sets FromAddress ---
  it("direction='from' sets FromAddress on filter", async () => {
    let capturedFilter: any = null;
    const client = {
      queryTransactionBlocks: async (params: any) => {
        capturedFilter = params.filter;
        return { data: [], nextCursor: null, hasNextPage: false };
      },
    } as unknown as IotaClient;

    const rule: Rule = {
      ...baseRule,
      params: { address: "0xabc", direction: "from" },
    };
    const state: RuleState = { ...baseState };

    await poll(client, rule, state);
    expect(capturedFilter.FromAddress).toBe("0xabc");
    expect(capturedFilter.ToAddress).toBeUndefined();
  });

  // --- direction='to' sets ToAddress ---
  it("direction='to' sets ToAddress on filter", async () => {
    let capturedFilter: any = null;
    const client = {
      queryTransactionBlocks: async (params: any) => {
        capturedFilter = params.filter;
        return { data: [], nextCursor: null, hasNextPage: false };
      },
    } as unknown as IotaClient;

    const rule: Rule = {
      ...baseRule,
      params: { address: "0xabc", direction: "to" },
    };
    const state: RuleState = { ...baseState };

    await poll(client, rule, state);
    expect(capturedFilter.ToAddress).toBe("0xabc");
    expect(capturedFilter.FromAddress).toBeUndefined();
  });

  // --- direction='both' sets FromAddress only ---
  it("direction='both' sets FromAddress on filter", async () => {
    let capturedFilter: any = null;
    const client = {
      queryTransactionBlocks: async (params: any) => {
        capturedFilter = params.filter;
        return { data: [], nextCursor: null, hasNextPage: false };
      },
    } as unknown as IotaClient;

    const rule: Rule = {
      ...baseRule,
      params: { address: "0xabc", direction: "both" },
    };
    const state: RuleState = { ...baseState };

    await poll(client, rule, state);
    expect(capturedFilter.FromAddress).toBe("0xabc");
    expect(capturedFilter.ToAddress).toBeUndefined();
  });

  // --- first run (no cursor) returns no alerts but sets cursor ---
  it("first run (no cursor) returns no alerts but sets cursor", async () => {
    const txs = [makeTx("tx1"), makeTx("tx2")];
    const client = mockClient({ txs, nextCursor: "cursor-123" });
    const state: RuleState = { ...baseState, lastCursor: null };

    const alerts = await poll(client, baseRule, state);
    expect(alerts).toHaveLength(0);
    expect(state.lastCursor).toBe("cursor-123");
  });

  // --- second run (with cursor) emits alerts for new txs ---
  it("second run with cursor emits alerts for new transactions", async () => {
    const txs = [
      makeTx("tx-hash-001"),
      makeTx("tx-hash-002"),
    ];
    const client = mockClient({ txs, nextCursor: "cursor-after" });
    const state: RuleState = { ...baseState, lastCursor: "cursor-prev" };

    const alerts = await poll(client, baseRule, state);
    expect(alerts).toHaveLength(2);
    expect(alerts[0].ruleId).toBe("addr-test");
    expect(alerts[0].type).toBe("address_activity");
    expect(alerts[0].severity).toBe("info");
    expect(alerts[0].title).toContain("Transaction detected");
    expect(alerts[0].data.digest).toBe("tx-hash-001");
    expect(alerts[1].data.digest).toBe("tx-hash-002");
    expect(state.lastCursor).toBe("cursor-after");
  });

  // --- empty page returns empty ---
  it("empty page returns empty alerts array", async () => {
    const client = mockClient({ txs: [], nextCursor: null });
    const state: RuleState = { ...baseState, lastCursor: "cursor-prev" };

    const alerts = await poll(client, baseRule, state);
    expect(alerts).toHaveLength(0);
  });

  // --- minAmount filter ---
  it("filters out transactions below minAmount threshold", async () => {
    // 1.5 IOTA = 1500000000 MIST
    const txs = [
      makeTx("tx-low", "500000000", "0"),   // 0.5 IOTA total gas
      makeTx("tx-mid", "1000000000", "0"),  // 1.0 IOTA total gas
      makeTx("tx-high", "2000000000", "0"), // 2.0 IOTA total gas
    ];
    const client = mockClient({ txs, nextCursor: null });
    const rule: Rule = {
      ...baseRule,
      params: { address: "0xabc", minAmount: "1.5" },
    };
    const state: RuleState = { ...baseState, lastCursor: "cursor-prev" };

    const alerts = await poll(client, rule, state);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].data.digest).toBe("tx-high");
  });

  // --- cursor reset on error ---
  it("resets lastCursor to null on error containing 'cursor'", async () => {
    const client = {
      queryTransactionBlocks: async () => {
        throw new Error("Invalid cursor format");
      },
    } as unknown as IotaClient;

    const state: RuleState = { ...baseState, lastCursor: "bad-cursor" };

    const alerts = await poll(client, baseRule, state);
    expect(alerts).toHaveLength(0);
    expect(state.lastCursor).toBeNull();
  });

  // --- non-cursor error does not reset cursor ---
  it("does not reset lastCursor on non-cursor error", async () => {
    const client = {
      queryTransactionBlocks: async () => {
        throw new Error("Network timeout");
      },
    } as unknown as IotaClient;

    const state: RuleState = { ...baseState, lastCursor: "good-cursor" };

    const alerts = await poll(client, baseRule, state);
    expect(alerts).toHaveLength(0);
    expect(state.lastCursor).toBe("good-cursor");
  });

  // --- handles txs without digest gracefully ---
  it("skips transactions without digest", async () => {
    const txs = [
      { effects: { gasUsed: { computationCost: "0", storageCost: "0" } } },
      makeTx("tx-with-digest"),
    ];
    const client = mockClient({ txs, nextCursor: null });
    const state: RuleState = { ...baseState, lastCursor: "cursor-prev" };

    const alerts = await poll(client, baseRule, state);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].data.digest).toBe("tx-with-digest");
  });
});
