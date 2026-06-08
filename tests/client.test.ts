import { describe, it, expect } from "vitest";
import { createClient, resolveUrl } from "../src/lib/client.js";

describe("createClient", () => {
  it("creates a client for mainnet", () => {
    const client = createClient("mainnet");
    expect(client).toBeDefined();
    expect(typeof client.getLatestIotaSystemState).toBe("function");
  });

  it("creates a client for testnet", () => {
    const client = createClient("testnet");
    expect(client).toBeDefined();
  });

  it("creates a client for devnet", () => {
    const client = createClient("devnet");
    expect(client).toBeDefined();
  });

  it("accepts custom RPC URL", () => {
    const client = createClient("mainnet", "https://custom.rpc.com");
    expect(client).toBeDefined();
  });
});

describe("resolveUrl", () => {
  it("returns default URL for mainnet", () => {
    expect(resolveUrl("mainnet")).toBe("https://api.mainnet.iota.cafe");
  });

  it("returns default URL for testnet", () => {
    expect(resolveUrl("testnet")).toBe("https://api.testnet.iota.cafe");
  });

  it("returns default URL for devnet", () => {
    expect(resolveUrl("devnet")).toBe("https://api.devnet.iota.cafe");
  });

  it("returns custom URL if provided", () => {
    expect(resolveUrl("mainnet", "https://custom.rpc")).toBe("https://custom.rpc");
  });
});
