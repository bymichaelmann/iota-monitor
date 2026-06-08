import type { IotaClient } from "@iota/iota-sdk/client";
import type { Network, TxDetails } from "../lib/types.js";
import { formatNumber, formatTimestamp, truncateAddress } from "../lib/format.js";
import { keyValueTable, success, error, spinner, formatStatus } from "../utils/display.js";

/**
 * Lookup and display transaction details by digest.
 */
export async function transactionLookup(
  client: IotaClient,
  network: Network,
  digest: string,
): Promise<void> {
  const spin = spinner(`Looking up transaction ${truncateAddress(digest)}...`);
  spin.start();

  try {
    const tx = await client.getTransactionBlock({
      digest,
      options: {
        showInput: true,
        showEffects: true,
        showEvents: false,
        showBalanceChanges: true,
        showObjectChanges: false,
      },
    });

    spin.stop();

    if (!tx) {
      error(`Transaction not found: ${digest}`);
      return;
    }

    const effects = tx.effects;
    const status = effects?.status?.status ?? "Unknown";
    const gasUsed = effects?.gasUsed
      ? formatNumber(String(effects.gasUsed.computationCost ?? 0))
      : "Unknown";

    const timestamp = tx.timestampMs ? formatTimestamp(tx.timestampMs) : "Unknown";
    const sender = tx.transaction?.data?.sender ?? "Unknown";

    // Extract recipients from effects
    const recipients = new Set<string>();
    if (effects?.created?.length) {
      for (const created of effects.created) {
        if (created.owner && typeof created.owner === "object" && "AddressOwner" in created.owner) {
          recipients.add(String(created.owner.AddressOwner));
        }
      }
    }
    if (effects?.mutated?.length) {
      for (const mutated of effects.mutated) {
        if (mutated.owner && typeof mutated.owner === "object" && "AddressOwner" in mutated.owner) {
          recipients.add(String(mutated.owner.AddressOwner));
        }
      }
    }

    const rows: [string, string][] = [
      ["Digest", digest],
      ["Status", formatStatus(status)],
      ["Sender", sender],
      ["Recipients", recipients.size > 0 ? [...recipients].join("\n") : "None"],
      ["Gas Used", `${gasUsed} MIST`],
      ["Timestamp", timestamp],
      ["Network", network],
    ];

    console.log(keyValueTable(rows, "Transaction Details"));
    success("Transaction lookup complete.");
  } catch (err) {
    spin.stop();
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found") || message.includes("Invalid")) {
      error(`Transaction not found: ${digest}`);
    } else {
      error(`Failed to fetch transaction: ${message}`);
    }
  }
}
