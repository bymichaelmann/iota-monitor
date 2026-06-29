import type { IotaClient } from "@iota/iota-sdk/client";
import type { Rule } from "../../lib/rules.js";
import type { RuleState } from "../../lib/state.js";
import type { Alert } from "../types.js";

interface ValidatorSnapshot {
  name: string;
  commissionRate: number;
  stake: string;
  address: string;
}

/**
 * Poll for validator set changes.
 * Detects: new validators, removed validators, commission changes, stake changes.
 */
export async function poll(
  client: IotaClient,
  rule: Rule,
  state: RuleState,
): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    const systemState = await client.getLatestIotaSystemState();
    const currentValidators: ValidatorSnapshot[] = (systemState.activeValidators || []).map((v: any) => ({
      name: v.name || "Unknown",
      commissionRate: Number(v.commissionRate ?? 0),
      stake: v.stakingPoolIotaBalance || "0",
      address: v.iotaAddress || "",
    }));

    const previousSnapshot = state.lastValue as ValidatorSnapshot[] | null;

    if (previousSnapshot !== null) {
      const prevMap = new Map<string, ValidatorSnapshot>();
      for (const v of previousSnapshot) {
        prevMap.set(v.name, v);
      }

      const currentMap = new Map<string, ValidatorSnapshot>();
      for (const v of currentValidators) {
        currentMap.set(v.name, v);
      }

      // Detect new validators
      for (const v of currentValidators) {
        if (!prevMap.has(v.name)) {
          alerts.push({
            ruleId: rule.id,
            type: "validator_change",
            severity: "info",
            title: "New validator added",
            message: `Validator "${v.name}" has joined the active set`,
            data: v,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Detect removed validators
      for (const v of previousSnapshot) {
        if (!currentMap.has(v.name)) {
          alerts.push({
            ruleId: rule.id,
            type: "validator_change",
            severity: "warn",
            title: "Validator removed",
            message: `Validator "${v.name}" has left the active set`,
            data: v,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Detect commission and stake changes for existing validators
      for (const v of currentValidators) {
        const prev = prevMap.get(v.name);
        if (!prev) continue;

        if (prev.commissionRate !== v.commissionRate) {
          alerts.push({
            ruleId: rule.id,
            type: "validator_change",
            severity: "info",
            title: `Commission change: ${v.name}`,
            message: `Commission changed from ${(prev.commissionRate / 100).toFixed(2)}% to ${(v.commissionRate / 100).toFixed(2)}%`,
            data: { name: v.name, from: prev.commissionRate, to: v.commissionRate },
            timestamp: new Date().toISOString(),
          });
        }

        if (prev.stake !== v.stake) {
          const stakeDiff = BigInt(v.stake) - BigInt(prev.stake);
          alerts.push({
            ruleId: rule.id,
            type: "validator_change",
            severity: "info",
            title: `Stake change: ${v.name}`,
            message: `Stake changed by ${formatStakeDiff(stakeDiff)}`,
            data: { name: v.name, from: prev.stake, to: v.stake, diff: stakeDiff.toString() },
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Update snapshot
    state.lastValue = currentValidators;
  } catch (err) {
    // RPC error, skip cycle
  }

  return alerts;
}

/**
 * Format stake difference for display.
 */
function formatStakeDiff(diff: bigint): string {
  const sign = diff >= 0 ? "+" : "";
  const absDiff = diff >= 0 ? diff : -diff;
  const divisor = BigInt(1_000_000_000);
  const whole = absDiff / divisor;
  const fraction = absDiff % divisor;
  const fractionStr = fraction.toString().padStart(9, "0").replace(/0+$/, "");
  if (fractionStr.length === 0) return `${sign}${whole.toLocaleString("en-US")} IOTA`;
  return `${sign}${whole.toLocaleString("en-US")}.${fractionStr} IOTA`;
}
