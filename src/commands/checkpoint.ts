import type { IotaClient } from "@iota/iota-sdk/client";
import type { Network, CheckpointInfo } from "../lib/types.js";
import { formatNumber, formatTimestamp } from "../lib/format.js";
import { keyValueTable, success, error, spinner } from "../utils/display.js";

/**
 * Fetch and display checkpoint details.
 * If id is not provided, fetches the latest checkpoint.
 */
export async function checkpointDetails(
  client: IotaClient,
  network: Network,
  id?: string,
): Promise<void> {
  const label = id ? `Checkpoint #${id}` : "latest checkpoint";
  const spin = spinner(`Fetching ${label}...`);
  spin.start();

  try {
    let checkpointId: string;
    if (id) {
      checkpointId = id;
    } else {
      const seqNum = await client.getLatestCheckpointSequenceNumber();
      checkpointId = String(seqNum);
    }

    const cp = await client.getCheckpoint({ id: checkpointId });

    spin.stop();

    if (!cp) {
      error(`Checkpoint not found: ${checkpointId}`);
      return;
    }

    const rows: [string, string][] = [
      ["Digest", cp.digest ?? "Unknown"],
      ["Epoch", cp.epoch ?? "Unknown"],
      ["Sequence Number", cp.sequenceNumber ?? formatNumber(checkpointId)],
      ["Transactions", formatNumber(cp.transactions?.length ?? 0)],
      ["Timestamp", cp.timestampMs ? formatTimestamp(cp.timestampMs) : "Unknown"],
      ["Network", network],
    ];

    console.log(keyValueTable(rows, "Checkpoint Details"));
    success("Checkpoint info fetched successfully.");
  } catch (err) {
    spin.stop();
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found") || message.includes("Invalid")) {
      error(`Checkpoint not found: ${id || "(latest)"}`);
    } else {
      error(`Failed to fetch checkpoint: ${message}`);
    }
  }
}
