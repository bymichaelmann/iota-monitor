import type { IotaClient } from "@iota/iota-sdk/client";
import type { RuleConfig, Rule, NotifyChannel } from "../lib/rules.js";
import { loadRules } from "../lib/rules.js";
import { loadState, saveState, getRuleState } from "../lib/state.js";
import type { SentinelState, RuleState } from "../lib/state.js";
import type { Alert, TriggerFn } from "./types.js";
import { recordAlert, recordPollDuration, recordRpcError, startMetricsServer } from "./metrics.js";
import { createServer, type Server } from "node:http";

/** Sentinel configuration */
export interface SentinelConfig {
  configPath: string;
  pollingInterval: number;
  once?: boolean;
  metricsPort?: number;
}

/** Discovered triggers by rule type */
const TRIGGERS: Record<string, TriggerFn> = {};

async function loadTrigger(type: string): Promise<TriggerFn> {
  if (TRIGGERS[type]) return TRIGGERS[type];
  switch (type) {
    case "move_event": {
      const mod = await import("./triggers/move_event.js");
      TRIGGERS[type] = mod.poll;
      return mod.poll;
    }
    case "address_activity": {
      const mod = await import("./triggers/address_activity.js");
      TRIGGERS[type] = mod.poll;
      return mod.poll;
    }
    case "balance_threshold": {
      const mod = await import("./triggers/balance_threshold.js");
      TRIGGERS[type] = mod.poll;
      return mod.poll;
    }
    case "validator_change": {
      const mod = await import("./triggers/validator_change.js");
      TRIGGERS[type] = mod.poll;
      return mod.poll;
    }
    case "network_param": {
      const mod = await import("./triggers/network_param.js");
      TRIGGERS[type] = mod.poll;
      return mod.poll;
    }
    default:
      throw new Error(`Unknown trigger type: ${type}`);
  }
}

/** Notifier implementations */
const NOTIFIERS: Record<string, (alert: Alert, config?: unknown) => Promise<void>> = {};

async function loadNotifier(channel: string): Promise<(alert: Alert, config?: unknown) => Promise<void>> {
  if (NOTIFIERS[channel]) return NOTIFIERS[channel];
  switch (channel) {
    case "webhook": {
      const mod = await import("./notifiers/webhook.js");
      NOTIFIERS[channel] = mod.notify;
      return mod.notify;
    }
    case "stdout": {
      const mod = await import("./notifiers/stdout.js");
      NOTIFIERS[channel] = mod.notify;
      return mod.notify;
    }
    case "exec": {
      const mod = await import("./notifiers/exec.js");
      NOTIFIERS[channel] = mod.notify;
      return mod.notify;
    }
    default:
      throw new Error(`Unknown notifier channel: ${channel}`);
  }
}

/**
 * Create a simple hash string from alert content for deduplication.
 */
function hashAlert(alert: Alert): string {
  const str = `${alert.ruleId}|${alert.type}|${alert.title}|${alert.message}|${alert.timestamp.slice(0, 16)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Collect notifier config from rule params.
 */
function getNotifierConfig(rule: Rule, channel: NotifyChannel): unknown {
  // The rule can have channel-specific config in params.notifierConfig
  const nc = rule.params.notifierConfig as Record<string, unknown> | undefined;
  if (nc && typeof nc === "object" && nc[channel]) {
    return nc[channel];
  }
  // Webhook URL can also come from params.url
  if (channel === "webhook" && rule.params.url) {
    return { url: rule.params.url };
  }
  // Exec command from params.command
  if (channel === "exec" && rule.params.command) {
    return {
      command: rule.params.command,
      args: rule.params.args as string[] | undefined,
    };
  }
  return undefined;
}

/**
 * Run a single poll cycle for all rules.
 * Returns number of alerts fired.
 */
export async function runOnce(
  client: IotaClient,
  rules: RuleConfig,
  state: SentinelState,
): Promise<number> {
  let totalAlerts = 0;

  for (const rule of rules.rules) {
    const startTime = Date.now();
    const ruleState = getRuleState(state, rule.id);

    try {
      const trigger = await loadTrigger(rule.type);
      const alerts = await trigger(client, rule, ruleState);

      // Record poll duration
      recordPollDuration(rule.id, Date.now() - startTime);

      // Process alerts
      for (const alert of alerts) {
        const ahash = hashAlert(alert);

        // Dedup check: skip if same hash as last alert
        if (ruleState.lastAlertHash === ahash) {
          continue;
        }

        // Send through all matching notifiers
        for (const channel of rule.notify) {
          try {
            const notifier = await loadNotifier(channel);
            const config = getNotifierConfig(rule, channel);
            await notifier(alert, config);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(
              JSON.stringify({
                level: "error",
                rule: rule.id,
                channel,
                error: message,
                timestamp: new Date().toISOString(),
              }),
            );
          }
        }

        ruleState.lastAlertHash = ahash;
        recordAlert(rule.id, alert.type);
        totalAlerts++;
      }
    } catch (err) {
      recordRpcError(rule.id);
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: "error",
          rule: rule.id,
          error: message,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  // Persist state after each cycle
  saveState(state);

  return totalAlerts;
}

/**
 * Run the sentinel mode.
 * If once is true, runs one poll cycle and returns alert count.
 * If once is false, runs in a loop with setInterval.
 */
export async function sentinelRun(
  client: IotaClient,
  config: SentinelConfig,
): Promise<number> {
  // Load rules
  const rules = loadRules(config.configPath);
  const state = loadState();

  let metricsServer: Server | undefined;
  if (config.metricsPort !== undefined) {
    metricsServer = startMetricsServer(config.metricsPort);
  }

  // Log startup
  console.error(
    JSON.stringify({
      level: "info",
      message: "Sentinel mode started",
      rules: rules.rules.map((r) => ({ id: r.id, type: r.type, notify: r.notify })),
      pollingInterval: config.pollingInterval,
      once: config.once ?? false,
      timestamp: new Date().toISOString(),
    }),
  );

  if (config.once) {
    // Run once and return
    const alertCount = await runOnce(client, rules, state);
    if (metricsServer) {
      metricsServer.close();
    }
    return alertCount;
  }

  // Continuous mode
  const intervalMs = config.pollingInterval * 1000;

  const poll = async (): Promise<void> => {
    await runOnce(client, rules, state);
  };

  // Initial poll
  await poll();

  // Set up interval
  const intervalId = setInterval(poll, intervalMs);

  // Graceful shutdown
  const cleanup = (): void => {
    clearInterval(intervalId);
    if (metricsServer) {
      metricsServer.close();
    }
    console.error(
      JSON.stringify({
        level: "info",
        message: "Sentinel mode stopped",
        timestamp: new Date().toISOString(),
      }),
    );
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Return 0 since we run indefinitely
  return 0;
}
