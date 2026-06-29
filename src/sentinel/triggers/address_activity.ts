import type { IotaClient } from "@iota/iota-sdk/client";
import type { Rule } from "../../lib/rules.js";
import type { RuleState } from "../../lib/state.js";
import type { Alert } from "../types.js";

/**
 * Poll for new transactions from/to an address.
 * Supports optional minAmount filter on gas used.
 */
export async function poll(
  client: IotaClient,
  rule: Rule,
  state: RuleState,
): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const address = rule.params.address as string;
  const direction = (rule.params.direction as string) || "from";
  const minAmount = rule.params.minAmount as string | undefined;

  // Build filter based on direction
  const filter: Record<string, unknown> = {};
  if (direction === "from" || direction === "both") {
    filter.FromAddress = address;
  } else if (direction === "to") {
    filter.ToAddress = address;
  }

  const cursor = state.lastCursor || undefined;

  try {
    const txsPage = await client.queryTransactionBlocks({
      filter: filter as any,
      cursor,
      order: "descending",
    });

    const txs = txsPage.data || [];
    if (txs.length === 0) {
      return alerts;
    }

    let newCursor: string | null = null;
    if (txsPage.nextCursor) {
      newCursor = txsPage.nextCursor;
    }

    // Only emit if we have a previous cursor (avoid initial flood)
    if (state.lastCursor !== null) {
      const seen = new Set<string>();
      for (const tx of txs) {
        const digest = tx.digest || tx.certificate?.digest;
        if (!digest || seen.has(digest)) continue;
        seen.add(digest);

        // Optional minAmount filter
        if (minAmount !== undefined) {
          const gasUsed = (tx as any).effects?.gasUsed?.computationCost || "0";
          const gasTotal = (tx as any).effects?.gasUsed?.storageCost || "0";
          const totalGas = BigInt(gasUsed) + BigInt(gasTotal);
          // Parse minAmount as IOTA string (e.g., "1.5" -> 1500000000)
          const minBigInt = parseIotaAmount(minAmount);
          if (totalGas < minBigInt) {
            continue;
          }
        }

        alerts.push({
          ruleId: rule.id,
          type: "address_activity",
          severity: "info",
          title: `Transaction detected for ${address.slice(0, 10)}...`,
          message: `New ${direction} transaction: ${digest.slice(0, 16)}...`,
          data: tx,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (newCursor) {
      state.lastCursor = newCursor;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("cursor") || message.includes("Invalid")) {
      state.lastCursor = null;
    }
  }

  return alerts;
}

/**
 * Parse an IOTA amount string (e.g., "1.5") to bigint (MIST).
 */
function parseIotaAmount(amount: string): bigint {
  const parts = amount.split(".");
  const whole = parts[0] || "0";
  let fraction = parts[1] || "";
  // Pad or truncate to 9 decimal places
  if (fraction.length > 9) {
    fraction = fraction.slice(0, 9);
  } else {
    fraction = fraction.padEnd(9, "0");
  }
  return BigInt(whole + fraction);
}
