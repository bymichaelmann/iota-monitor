import { describe, it, expect } from "vitest";
import systemStateFixture from "./fixtures/systemState.json";
import checkpointFixture from "./fixtures/checkpoint.json";
import transactionFixture from "./fixtures/transaction.json";
import balanceFixture from "./fixtures/balance.json";
import ownedObjectsFixture from "./fixtures/ownedObjects.json";
import {
  formatIota,
  formatCommission,
  formatApr,
  formatNumber,
  formatTimestamp,
  truncateAddress,
} from "../src/lib/format.js";
import { PAYOUT_ADDRESS } from "../src/lib/constants.js";

describe("Integration: validators with systemState fixture", () => {
  it("maps activeValidators correctly", () => {
    const { activeValidators } = systemStateFixture;
    expect(activeValidators).toHaveLength(3);

    const validators = activeValidators.map((v: any) => ({
      name: v.name || "Unknown",
      stake: v.stakingPoolIotaBalance
        ? formatIota(v.stakingPoolIotaBalance)
        : "0",
      commission: v.commissionRate !== undefined
        ? formatCommission(Number(v.commissionRate))
        : "N/A",
      apr: v.apy ? formatApr(Number(v.apy)) : "N/A",
      address: v.iotaAddress || "Unknown",
    }));

    // Alpha
    expect(validators[0].name).toBe("Validator Alpha");
    expect(validators[0].stake).toBe("5,000");
    expect(validators[0].commission).toBe("2.00%");
    expect(validators[0].apr).toBe("5.24%");

    // Beta
    expect(validators[1].name).toBe("Validator Beta");
    expect(validators[1].commission).toBe("5.00%");
    expect(validators[1].apr).toBe("4.10%");

    // Gamma — no apy field → N/A
    expect(validators[2].name).toBe("Validator Gamma");
    expect(validators[2].apr).toBe("N/A");
  });

  it("sorts validators by stake descending", () => {
    const { activeValidators } = systemStateFixture;
    const validators = activeValidators.map((v: any) => ({
      name: v.name,
      stake: v.stakingPoolIotaBalance
        ? formatIota(v.stakingPoolIotaBalance)
        : "0",
    }));
    validators.sort((a: any, b: any) => {
      const aStake = parseFloat(a.stake.replace(/,/g, "") || "0");
      const bStake = parseFloat(b.stake.replace(/,/g, "") || "0");
      return bStake - aStake;
    });
    expect(validators[0].name).toBe("Validator Alpha");
    expect(validators[1].name).toBe("Validator Beta");
    expect(validators[2].name).toBe("Validator Gamma");
  });
});

describe("Integration: checkpoint with fixture", () => {
  it("parses checkpoint data correctly", () => {
    const cp = checkpointFixture;
    expect(cp.digest).toContain("0x");
    expect(cp.epoch).toBe("42");
    expect(cp.sequenceNumber).toBe("1234567");
    expect(cp.transactions).toHaveLength(3);
    expect(cp.timestampMs).toBe("1717740060000");
    expect(formatTimestamp(cp.timestampMs)).toContain("UTC");
  });

  it("formats transaction count", () => {
    expect(formatNumber(checkpointFixture.transactions.length)).toBe("3");
  });
});

describe("Integration: transaction with fixture", () => {
  it("parses transaction data correctly", () => {
    const tx = transactionFixture;
    expect(tx.digest).toContain("0x");
    expect(tx.transaction.data.sender).toContain("0x");
    expect(tx.effects.status.status).toBe("success");
    expect(Number(tx.effects.gasUsed.computationCost)).toBe(1000000);
  });

  it("extracts recipients from created effects", () => {
    const recipients = new Set<string>();
    for (const created of transactionFixture.effects.created) {
      if (
        created.owner &&
        typeof created.owner === "object" &&
        "AddressOwner" in created.owner
      ) {
        recipients.add(String(created.owner.AddressOwner));
      }
    }
    expect(recipients.size).toBe(1);
    expect([...recipients][0]).toContain("0x");
  });
});

describe("Integration: balance with fixture", () => {
  it("formats balance correctly", () => {
    const formatted = formatIota(balanceFixture.totalBalance);
    expect(formatted).toBe("5,000");
  });
});

describe("Integration: ownedObjects with fixture", () => {
  it("counts objects correctly", () => {
    const count = ownedObjectsFixture.data.length;
    expect(count).toBe(5);
  });

  it("displays count without + when under limit", () => {
    const OBJ_LIMIT = 50;
    const count = ownedObjectsFixture.data.length;
    const display = count >= OBJ_LIMIT ? `${formatNumber(count)}+` : formatNumber(count);
    expect(display).toBe("5");
  });

  it("displays count with + when at limit", () => {
    const OBJ_LIMIT = 5;
    const count = ownedObjectsFixture.data.length;
    const display = count >= OBJ_LIMIT ? `${formatNumber(count)}+` : formatNumber(count);
    expect(display).toBe("5+");
  });
});

describe("Integration: constants", () => {
  it("PAYOUT_ADDRESS is defined and looks like an address", () => {
    expect(PAYOUT_ADDRESS).toBeDefined();
    expect(PAYOUT_ADDRESS.startsWith("0x")).toBe(true);
    expect(PAYOUT_ADDRESS.length).toBeGreaterThan(40);
  });
});
