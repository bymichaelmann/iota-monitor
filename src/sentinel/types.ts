import type { IotaClient } from "@iota/iota-sdk/client";
import type { Rule } from "../lib/rules.js";
import type { RuleState } from "../lib/state.js";

/** Severity levels for alerts */
export type AlertSeverity = "info" | "warn" | "critical";

/** An alert emitted by a trigger */
export interface Alert {
  ruleId: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

/** Trigger function signature */
export type TriggerFn = (
  client: IotaClient,
  rule: Rule,
  state: RuleState,
) => Promise<Alert[]>;

/** Notifier function signature */
export type NotifierFn = (alert: Alert, config?: unknown) => Promise<void>;
