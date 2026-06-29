import { spawn } from "node:child_process";
import type { Alert } from "../types.js";

/**
 * Execute a command with alert data passed as environment variables.
 * The command is specified in config.command (required).
 */
export async function notify(
  alert: Alert,
  config?: { command?: string; args?: string[] },
): Promise<void> {
  if (!config?.command) {
    throw new Error("Exec notifier requires a command");
  }

  return new Promise((resolve, reject) => {
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ALERT_RULE_ID: alert.ruleId,
      ALERT_TYPE: alert.type,
      ALERT_SEVERITY: alert.severity,
      ALERT_TITLE: alert.title,
      ALERT_MESSAGE: alert.message,
      ALERT_TIMESTAMP: alert.timestamp,
      ALERT_DATA: alert.data ? JSON.stringify(alert.data) : "",
    };

    const child = spawn(config.command!, config.args || [], {
      env,
      stdio: ["ignore", "inherit", "inherit"],
      shell: false,
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn "${config.command}": ${err.message}`));
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command "${config.command}" exited with code ${code}`));
      }
    });
  });
}
