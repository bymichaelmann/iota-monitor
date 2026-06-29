import type { IotaClient } from "@iota/iota-sdk/client";
import type { Rule } from "../../lib/rules.js";
import type { RuleState } from "../../lib/state.js";
import type { Alert } from "../types.js";

/**
 * Poll for network parameter changes.
 * Monitors: gas price thresholds and epoch changes.
 */
export async function poll(
  client: IotaClient,
  rule: Rule,
  state: RuleState,
): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    const [gasPrice, systemState] = await Promise.all([
      client.getReferenceGasPrice().catch(() => null),
      client.getLatestIotaSystemState().catch(() => null),
    ]);

    // --- Gas price thresholds ---
    const gasAbove = rule.params.gasAbove as string | undefined;
    const gasBelow = rule.params.gasBelow as string | undefined;

    if (gasPrice !== null && (gasAbove || gasBelow)) {
      const currentGas = BigInt(gasPrice);
      const previousGas = state.lastValue !== null ? BigInt(String(state.lastValue)) : null;

      if (gasAbove !== undefined) {
        const threshold = BigInt(gasAbove);
        if (currentGas >= threshold) {
          const crossed = previousGas === null || previousGas < threshold;
          if (crossed) {
            alerts.push({
              ruleId: rule.id,
              type: "network_param",
              severity: "warn",
              title: "Gas price above threshold",
              message: `Reference gas price (${currentGas.toString()} MIST) is above ${threshold.toString()} MIST`,
              data: { param: "gasPrice", value: currentGas.toString(), threshold: gasAbove, direction: "above" },
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      if (gasBelow !== undefined) {
        const threshold = BigInt(gasBelow);
        if (currentGas <= threshold) {
          const crossed = previousGas === null || previousGas > threshold;
          if (crossed) {
            alerts.push({
              ruleId: rule.id,
              type: "network_param",
              severity: "info",
              title: "Gas price below threshold",
              message: `Reference gas price (${currentGas.toString()} MIST) is below ${threshold.toString()} MIST`,
              data: { param: "gasPrice", value: currentGas.toString(), threshold: gasBelow, direction: "below" },
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      state.lastValue = currentGas.toString();
    }

    // --- Epoch change detection ---
    if (systemState) {
      const currentEpoch = String(systemState.epoch ?? "");
      const previousEpoch = state.lastCursor;

      if (previousEpoch !== null && previousEpoch !== "" && currentEpoch !== previousEpoch) {
        alerts.push({
          ruleId: rule.id,
          type: "network_param",
          severity: "info",
          title: "Epoch changed",
          message: `Network moved from epoch ${previousEpoch} to epoch ${currentEpoch}`,
          data: { param: "epoch", from: previousEpoch, to: currentEpoch },
          timestamp: new Date().toISOString(),
        });
      }

      if (currentEpoch) {
        state.lastCursor = currentEpoch;
      }
    }
  } catch (err) {
    // RPC error, skip cycle
  }

  return alerts;
}
