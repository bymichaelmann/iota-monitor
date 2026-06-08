import { describe, it, expect } from "vitest";

describe("Address commands module", () => {
  it("exports addressInfo function", async () => {
    const mod = await import("../src/commands/address.js");
    expect(mod).toBeDefined();
    expect(typeof mod.addressInfo).toBe("function");
  });
});
