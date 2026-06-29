import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notify } from "../../../src/sentinel/notifiers/stdout.js";
import type { Alert } from "../../../src/sentinel/types.js";

describe("stdout notifier", () => {
  let stdoutWriteSpy: any;

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
  });

  it("writes NDJSON to stdout", async () => {
    const alert: Alert = {
      ruleId: "test-rule",
      type: "balance_threshold",
      severity: "warn",
      title: "Test Alert",
      message: "Test message",
      timestamp: "2025-06-01T00:00:00.000Z",
    };

    await notify(alert);

    expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
    const output = stdoutWriteSpy.mock.calls[0][0];
    const parsed = JSON.parse(output.trim());
    expect(parsed.alert.rule_id).toBe("test-rule");
    expect(parsed.alert.type).toBe("balance_threshold");
    expect(parsed.alert.title).toBe("Test Alert");
  });

  it("outputs one JSON object per line", async () => {
    const alert: Alert = {
      ruleId: "rule-1",
      type: "validator_change",
      severity: "info",
      title: "Validator changed",
      message: "A validator was added",
      timestamp: "2025-06-01T00:00:00.000Z",
    };

    await notify(alert);

    const output = stdoutWriteSpy.mock.calls[0][0];
    expect(output.endsWith("\n")).toBe(true);
  });
});
