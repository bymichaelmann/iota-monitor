import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

/** Per-rule persisted state */
export interface RuleState {
  lastCursor: string | null;
  lastValue: unknown;
  lastAlertHash: string | null;
}

/** Full state map keyed by rule.id */
export interface SentinelState {
  rules: Record<string, RuleState>;
}

const STATE_DIR = join(homedir(), ".iota-monitor");
const STATE_FILE = join(STATE_DIR, "state.json");

function defaultRuleState(): RuleState {
  return { lastCursor: null, lastValue: null, lastAlertHash: null };
}

/**
 * Ensure the state directory exists.
 */
function ensureStateDir(): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
}

/**
 * Load persisted state from disk.
 * Returns an empty state if the file doesn't exist or is corrupt.
 */
export function loadState(): SentinelState {
  ensureStateDir();
  if (!existsSync(STATE_FILE)) {
    return { rules: {} };
  }
  try {
    const raw = readFileSync(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as SentinelState;
    // Ensure structure
    if (!parsed.rules || typeof parsed.rules !== "object") {
      return { rules: {} };
    }
    // Ensure each rule state has the required fields
    for (const key of Object.keys(parsed.rules)) {
      const rs = parsed.rules[key];
      if (!rs || typeof rs !== "object") {
        parsed.rules[key] = defaultRuleState();
      } else {
        parsed.rules[key] = {
          lastCursor: rs.lastCursor ?? null,
          lastValue: rs.lastValue ?? null,
          lastAlertHash: rs.lastAlertHash ?? null,
        };
      }
    }
    return parsed;
  } catch {
    return { rules: {} };
  }
}

/**
 * Save state to disk atomically.
 */
export function saveState(state: SentinelState): void {
  ensureStateDir();
  const tmpFile = join(STATE_DIR, `.state-${randomUUID()}.tmp`);
  const data = JSON.stringify(state, null, 2);
  writeFileSync(tmpFile, data, "utf-8");
  renameSync(tmpFile, STATE_FILE);
}

/**
 * Get or create state for a specific rule.
 */
export function getRuleState(state: SentinelState, ruleId: string): RuleState {
  if (!state.rules[ruleId]) {
    state.rules[ruleId] = defaultRuleState();
  }
  return state.rules[ruleId];
}
