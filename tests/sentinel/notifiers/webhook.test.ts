import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notify } from "../../../src/sentinel/notifiers/webhook.js";
import type { Alert } from "../../../src/sentinel/types.js";

// Save original fetch
const originalFetch = globalThis.fetch;

describe("webhook notifier", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends POST request with alert data", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK" });
    globalThis.fetch = mockFetch;

    const alert: Alert = {
      ruleId: "test-rule",
      type: "balance_threshold",
      severity: "warn",
      title: "Test Alert",
      message: "This is a test alert",
      timestamp: "2025-06-01T00:00:00.000Z",
    };

    await notify(alert, { url: "https://hooks.example.com/alert" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://hooks.example.com/alert");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(options.body);
    expect(body.alert.rule_id).toBe("test-rule");
    expect(body.alert.title).toBe("Test Alert");
  });

  it("throws on non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" });
    globalThis.fetch = mockFetch;

    const alert: Alert = {
      ruleId: "test-rule",
      type: "balance_threshold",
      severity: "warn",
      title: "Test Alert",
      message: "This is a test alert",
      timestamp: "2025-06-01T00:00:00.000Z",
    };

    await expect(notify(alert, { url: "https://hooks.example.com/alert" })).rejects.toThrow();
  });

  it("throws when URL is missing", async () => {
    const alert: Alert = {
      ruleId: "test-rule",
      type: "balance_threshold",
      severity: "warn",
      title: "Test Alert",
      message: "This is a test alert",
      timestamp: "2025-06-01T00:00:00.000Z",
    };

    await expect(notify(alert, {})).rejects.toThrow("URL");
  });

  it("templates URL with alert fields", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK" });
    globalThis.fetch = mockFetch;

    const alert: Alert = {
      ruleId: "test-rule",
      type: "balance_threshold",
      severity: "warn",
      title: "Test Alert Title",
      message: "Test message",
      timestamp: "2025-06-01T00:00:00.000Z",
    };

    await notify(alert, { url: "https://example.com/{{ruleId}}/{{type}}/{{severity}}" });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("test-rule");
    expect(url).toContain("balance_threshold");
    expect(url).toContain("warn");
  });
});
