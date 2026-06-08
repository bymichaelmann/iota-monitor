import { describe, it, expect } from "vitest";
import {
  formatIota,
  formatGasPrice,
  formatNumber,
  formatTimestamp,
  truncateAddress,
  formatCommission,
  formatApr,
} from "../src/lib/format.js";

describe("formatIota", () => {
  it("formats whole IOTA amounts correctly", () => {
    expect(formatIota("1000000000")).toBe("1");
    expect(formatIota("2000000000")).toBe("2");
    expect(formatIota("0")).toBe("0");
  });

  it("formats fractional IOTA amounts correctly", () => {
    expect(formatIota("1500000000")).toBe("1.5");
    expect(formatIota("1000000001")).toBe("1.000000001");
    expect(formatIota("123456789")).toBe("0.123456789");
  });

  it("handles bigint input", () => {
    expect(formatIota(BigInt("5000000000"))).toBe("5");
  });

  it("handles large numbers with commas", () => {
    const result = formatIota("1000000000000000000");
    expect(result).toContain("1,000,000,000");
  });
});

describe("formatGasPrice", () => {
  it("formats gas price with MIST suffix", () => {
    expect(formatGasPrice("100")).toBe("100 MIST");
    expect(formatGasPrice("1000")).toBe("1,000 MIST");
  });

  it("handles bigint input", () => {
    expect(formatGasPrice(BigInt(100))).toBe("100 MIST");
  });
});

describe("formatNumber", () => {
  it("formats numbers with commas", () => {
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(42)).toBe("42");
  });

  it("handles string numbers", () => {
    expect(formatNumber("1000")).toBe("1,000");
  });

  it("handles bigint", () => {
    expect(formatNumber(BigInt(1000000))).toBe("1,000,000");
  });
});

describe("formatTimestamp", () => {
  it("formats Unix ms timestamp", () => {
    const result = formatTimestamp("1717740000000");
    expect(result).toContain("UTC");
    expect(result).not.toBe("Unknown");
  });

  it("returns Unknown for missing timestamp", () => {
    expect(formatTimestamp(undefined)).toBe("Unknown");
    expect(formatTimestamp("")).toBe("Unknown");
  });

  it("formats ISO string", () => {
    const result = formatTimestamp("2025-06-07T14:30:00.000Z");
    expect(result).toContain("UTC");
  });
});

describe("truncateAddress", () => {
  it("truncates long addresses", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const result = truncateAddress(addr);
    expect(result).toContain("...");
    expect(result.length).toBeLessThan(addr.length);
    expect(result.startsWith("0x1234")).toBe(true);
    expect(result.endsWith("5678")).toBe(true);
  });

  it("leaves short addresses unchanged", () => {
    const addr = "0x1234";
    expect(truncateAddress(addr)).toBe(addr);
  });
});

describe("formatCommission", () => {
  it("formats basis points as percentage", () => {
    expect(formatCommission(200)).toBe("2.00%");
    expect(formatCommission(1000)).toBe("10.00%");
    expect(formatCommission(50)).toBe("0.50%");
    expect(formatCommission(0)).toBe("0.00%");
  });
});

describe("formatApr", () => {
  it("formats decimal as percentage", () => {
    expect(formatApr(0.05)).toBe("5.00%");
    expect(formatApr(0.1234)).toBe("12.34%");
  });
});
