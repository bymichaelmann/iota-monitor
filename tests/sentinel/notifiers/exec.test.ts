import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { notify } from "../../../src/sentinel/notifiers/exec.js";
import type { Alert } from "../../../src/sentinel/types.js";

// Mock spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

// Import after mock so we get the mocked version
import { spawn } from "node:child_process";

const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;

const alert: Alert = {
  ruleId: "rule-1",
  type: "balance_threshold",
  severity: "warn",
  title: "Test Alert",
  message: "Something happened",
  data: { key: "value" },
  timestamp: "2025-06-01T00:00:00.000Z",
};

describe("exec notifier", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  // --- missing command throws ---
  it("throws when command is missing", async () => {
    await expect(notify(alert)).rejects.toThrow("Exec notifier requires a command");
  });

  it("throws when config has no command", async () => {
    await expect(notify(alert, { args: ["--verbose"] })).rejects.toThrow(
      "Exec notifier requires a command",
    );
  });

  // --- spawn exit code 0 resolves ---
  it("resolves when child process exits with code 0", async () => {
    const child = new EventEmitter() as any;
    child.stdin = null;
    child.stdout = null;
    child.stderr = null;
    mockSpawn.mockReturnValue(child);

    const promise = notify(alert, { command: "echo", args: ["hello"] });

    // Process.exit does the resolve on next tick

    // Verify spawn was called correctly
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockSpawn.mock.calls[0][0]).toBe("echo");
    expect(mockSpawn.mock.calls[0][1]).toEqual(["hello"]);

    // Emit exit with code 0
    child.emit("exit", 0);

    await expect(promise).resolves.toBeUndefined();
  });

  // --- spawn exit non-zero rejects ---
  it("rejects when child process exits with non-zero code", async () => {
    const child = new EventEmitter() as any;
    child.stdin = null;
    child.stdout = null;
    child.stderr = null;
    mockSpawn.mockReturnValue(child);

    const promise = notify(alert, { command: "bad-command" });

    child.emit("exit", 1);

    await expect(promise).rejects.toThrow("exited with code 1");
  });

  // --- spawn error event rejects ---
  it("rejects on spawn error event", async () => {
    const child = new EventEmitter() as any;
    child.stdin = null;
    child.stdout = null;
    child.stderr = null;
    mockSpawn.mockReturnValue(child);

    const promise = notify(alert, { command: "nonexistent-binary" });

    child.emit("error", new Error("ENOENT"));

    await expect(promise).rejects.toThrow("Failed to spawn");
    await expect(promise).rejects.toThrow("ENOENT");
  });

  // --- passes env vars to spawn ---
  it("passes alert data as environment variables", async () => {
    const child = new EventEmitter() as any;
    child.stdin = null;
    child.stdout = null;
    child.stderr = null;
    mockSpawn.mockReturnValue(child);

    const promise = notify(alert, { command: "my-script" });

    // Check spawn options
    const spawnOpts = mockSpawn.mock.calls[0][2];
    expect(spawnOpts.env.ALERT_RULE_ID).toBe("rule-1");
    expect(spawnOpts.env.ALERT_TYPE).toBe("balance_threshold");
    expect(spawnOpts.env.ALERT_SEVERITY).toBe("warn");
    expect(spawnOpts.env.ALERT_TITLE).toBe("Test Alert");
    expect(spawnOpts.env.ALERT_MESSAGE).toBe("Something happened");
    expect(spawnOpts.env.ALERT_TIMESTAMP).toBe("2025-06-01T00:00:00.000Z");
    expect(JSON.parse(spawnOpts.env.ALERT_DATA)).toEqual({ key: "value" });

    child.emit("exit", 0);
    await promise;
  });

  // --- handles alert without data ---
  it("handles alert without data field", async () => {
    const child = new EventEmitter() as any;
    child.stdin = null;
    child.stdout = null;
    child.stderr = null;
    mockSpawn.mockReturnValue(child);

    const alertNoData: Alert = {
      ruleId: "rule-2",
      type: "validator_change",
      severity: "info",
      title: "No data alert",
      message: "No data attached",
      timestamp: "2025-06-01T00:00:00.000Z",
    };

    const promise = notify(alertNoData, { command: "cmd" });

    const spawnOpts = mockSpawn.mock.calls[0][2];
    expect(spawnOpts.env.ALERT_DATA).toBe("");

    child.emit("exit", 0);
    await promise;
  });
});
