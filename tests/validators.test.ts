import { describe, it, expect } from "vitest";

describe("Validators commands module", () => {
  it("exports validatorsList function", async () => {
    const mod = await import("../src/commands/validators.js");
    expect(mod).toBeDefined();
    expect(typeof mod.validatorsList).toBe("function");
  });
});
