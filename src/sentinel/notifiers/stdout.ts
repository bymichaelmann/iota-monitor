import type { Alert } from "../types.js";

/**
 * Write an alert as NDJSON (newline-delimited JSON) to stdout.
 */
export async function notify(alert: Alert, _config?: unknown): Promise<void> {
  const output = {
    alert: {
      rule_id: alert.ruleId,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      data: alert.data,
      timestamp: alert.timestamp,
    },
  };
  process.stdout.write(JSON.stringify(output) + "\n");
}
