import { readFileSync, existsSync } from "node:fs";

/**
 * Rule configuration types for Sentinel alerting mode.
 */

/** Supported rule types */
export type RuleType =
  | "move_event"
  | "address_activity"
  | "balance_threshold"
  | "validator_change"
  | "network_param";

/** Notification channel types */
export type NotifyChannel = "webhook" | "stdout" | "exec";

/** A single rule definition */
export interface Rule {
  id: string;
  type: RuleType;
  params: Record<string, unknown>;
  notify: NotifyChannel[];
}

/** Rule configuration file schema */
export interface RuleConfig {
  rules: Rule[];
}

/** Required params per rule type */
const REQUIRED_PARAMS: Record<RuleType, string[]> = {
  move_event: ["package", "module"],
  address_activity: ["address"],
  balance_threshold: ["address"],
  validator_change: [],
  network_param: [],
};

/** Valid notify channels */
const VALID_CHANNELS: NotifyChannel[] = ["webhook", "stdout", "exec"];

/** Valid rule types */
const VALID_TYPES: RuleType[] = [
  "move_event",
  "address_activity",
  "balance_threshold",
  "validator_change",
  "network_param",
];

/**
 * Validate a single rule.
 * Throws if the rule is invalid.
 */
function validateRule(rule: Rule, index: number): void {
  if (!rule.id || typeof rule.id !== "string") {
    throw new Error(`Rule at index ${index}: missing or invalid "id"`);
  }
  if (!VALID_TYPES.includes(rule.type)) {
    throw new Error(
      `Rule "${rule.id}": unknown type "${rule.type}". Valid types: ${VALID_TYPES.join(", ")}`,
    );
  }
  if (!Array.isArray(rule.notify) || rule.notify.length === 0) {
    throw new Error(`Rule "${rule.id}": "notify" must be a non-empty array`);
  }
  for (const channel of rule.notify) {
    if (!VALID_CHANNELS.includes(channel as NotifyChannel)) {
      throw new Error(
        `Rule "${rule.id}": unknown notify channel "${channel}". Valid: ${VALID_CHANNELS.join(", ")}`,
      );
    }
  }
  if (!rule.params || typeof rule.params !== "object") {
    throw new Error(`Rule "${rule.id}": "params" must be an object`);
  }
  const required = REQUIRED_PARAMS[rule.type];
  for (const param of required) {
    if (!(param in rule.params) || rule.params[param] === undefined) {
      throw new Error(`Rule "${rule.id}": missing required param "${param}" for type "${rule.type}"`);
    }
  }
}

/**
 * Load and validate a rules configuration from a JSON file.
 */
export function loadRules(filepath: string): RuleConfig {
  if (!existsSync(filepath)) {
    throw new Error(`Rules file not found: ${filepath}`);
  }
  const raw = readFileSync(filepath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in rules file: ${filepath}`);
  }
  const config = parsed as Record<string, unknown>;
  if (!config || typeof config !== "object" || !Array.isArray(config.rules)) {
    throw new Error(`Rules file must contain a "rules" array at the top level`);
  }
  const ruleConfig: RuleConfig = { rules: [] };
  for (let i = 0; i < config.rules.length; i++) {
    const rule = config.rules[i] as Rule;
    validateRule(rule, i);
    ruleConfig.rules.push(rule);
  }
  return ruleConfig;
}
