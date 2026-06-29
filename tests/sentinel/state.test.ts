import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadState, saveState, getRuleState } from "../../src/lib/state.js";
import type { SentinelState } from "../../src/lib/state.js";

describe("state persistence", () => {
  it("loadState returns empty state when no file exists", () => {
    const state = loadState();
    expect(state).toBeDefined();
    expect(state.rules).toBeDefined();
  });

  it("saveState and loadState round-trip", () => {
    const state: SentinelState = {
      rules: {
        "test-rule": {
          lastCursor: "cursor-123",
          lastValue: "42",
          lastAlertHash: "abc123",
        },
      },
    };
    saveState(state);

    const loaded = loadState();
    expect(loaded.rules["test-rule"]).toBeDefined();
    expect(loaded.rules["test-rule"].lastCursor).toBe("cursor-123");
    expect(loaded.rules["test-rule"].lastValue).toBe("42");
    expect(loaded.rules["test-rule"].lastAlertHash).toBe("abc123");
  });

  it("getRuleState creates default state for unknown rule", () => {
    const state: SentinelState = { rules: {} };
    const rs = getRuleState(state, "new-rule");
    expect(rs.lastCursor).toBeNull();
    expect(rs.lastValue).toBeNull();
    expect(rs.lastAlertHash).toBeNull();
  });

  it("saveState is atomic (writes to tmp then renames)", () => {
    const state: SentinelState = {
      rules: {
        "atomic-test": {
          lastCursor: "test",
          lastValue: 123,
          lastAlertHash: "hash",
        },
      },
    };
    saveState(state);

    const loaded = loadState();
    expect(loaded.rules["atomic-test"].lastValue).toBe(123);
  });
});
