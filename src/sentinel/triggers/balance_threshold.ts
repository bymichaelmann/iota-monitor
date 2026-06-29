import type { IotaClient } from "@iota/iota-sdk/client";
import type { Rule } from "../../lib/rules.js";
import type { RuleState } from "../../lib/state.js";
import type { Alert } from "../types.js";

/**
 * Monitor an address balance and alert when it crosses a threshold.
 * Alerts only once per crossing (state change).
 */
export async function poll(
  client: IotaClient,
  rule: Rule,
  state: RuleState,
): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const address = rule.params.address as string;
  const below = rule.params.below as string | undefined;
  const above = rule.params.above as string | undefined;

  try {
    const balanceRes = await client.getBalance({ owner: address });
    const currentBalance = BigInt(balanceRes.totalBalance);
    const previousBalance = state.lastValue !== null ? BigInt(String(state.lastValue)) : null;

    // Check below threshold
    if (below !== undefined) {
      const threshold = parseIotaAmount(below);
      if (currentBalance <= threshold) {
        const crossed = previousBalance === null || previousBalance >= threshold;
        if (crossed) {
          alerts.push({
            ruleId: rule.id,
            type: "balance_threshold",
            severity: "warn",
            title: "Balance below threshold",
            message: `Address ${address.slice(0, 10)}... balance (${formatBalance(currentBalance)}) is below ${below} IOTA`,
            data: {
              address,
              balance: currentBalance.toString(),
              threshold: below,
              thresholdType: "below",
            },
            timestamp: new Date().toISOString(),
          });
          state.lastAlertHash = null; // Allow re-alert on next crossing direction
        }
      }
    }

    // Check above threshold
    if (above !== undefined) {
      const threshold = parseIotaAmount(above);
      if (currentBalance >= threshold) {
        const crossed = previousBalance === null || previousBalance <= threshold;
        if (crossed) {
          alerts.push({
            ruleId: rule.id,
            type: "balance_threshold",
            severity: "info",
            title: "Balance above threshold",
            message: `Address ${address.slice(0, 10)}... balance (${formatBalance(currentBalance)}) is above ${above} IOTA`,
            data: {
              address,
              balance: currentBalance.toString(),
              threshold: above,
              thresholdType: "above",
            },
            timestamp: new Date().toISOString(),
          });
          state.lastAlertHash = null;
        }
      }
    }

    // Update last value
    state.lastValue = currentBalance.toString();
  } catch (err) {
    // RPC error, skip this poll cycle
  }

  return alerts;
}

/**
 * Parse IOTA amount string to bigint (MIST).
 */
function parseIotaAmount(amount: string): bigint {
  const parts = amount.split(".");
  const whole = parts[0] || "0";
  let fraction = parts[1] || "";
  if (fraction.length > 9) {
    fraction = fraction.slice(0, 9);
  } else {
    fraction = fraction.padEnd(9, "0");
  }
  return BigInt(whole + fraction);
}

/**
 * Format bigint balance to IOTA string for display.
 */
function formatBalance(balance: bigint): string {
  const divisor = BigInt(1_000_000_000);
  const whole = balance / divisor;
  const fraction = balance % divisor;
  const fractionStr = fraction.toString().padStart(9, "0").replace(/0+$/, "");
  if (fractionStr.length === 0) return whole.toLocaleString("en-US");
  return `${whole.toLocaleString("en-US")}.${fractionStr}`;
}
