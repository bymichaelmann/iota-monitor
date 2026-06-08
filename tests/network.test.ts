import { describe, it, expect } from "vitest";

describe("Network commands module", () => {
  it("exports networkStatus function", async () => {
    const mod = await import("../src/commands/network.js");
    expect(mod).toBeDefined();
    expect(typeof mod.networkStatus).toBe("function");
  });
});
