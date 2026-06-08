import { describe, it, expect } from "vitest";

describe("Transaction commands module", () => {
  it("exports transactionLookup function", async () => {
    const mod = await import("../src/commands/tx.js");
    expect(mod).toBeDefined();
    expect(typeof mod.transactionLookup).toBe("function");
  });
});
