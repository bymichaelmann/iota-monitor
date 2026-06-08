import type { IotaClient } from "@iota/iota-sdk/client";
import type { Network, NetworkStatus } from "../lib/types.js";
import { resolveUrl } from "../lib/client.js";
import { formatNumber, formatGasPrice, formatTimestamp } from "../lib/format.js";
import { keyValueTable, success, error, spinner } from "../utils/display.js";

/**
 * Fetch and display network status.
 */
export async function networkStatus(
  client: IotaClient,
  network: Network,
  rpcUrl?: string,
): Promise<void> {
  const spin = spinner("Fetching network status...");
  spin.start();

  try {
    const [systemState, latestCheckpoint, referenceGasPrice] = await Promise.all([
      client.getLatestIotaSystemState().catch(() => null),
      client.getLatestCheckpointSequenceNumber().catch(() => null),
      client.getReferenceGasPrice().catch(() => null),
    ]);

    spin.stop();

    if (!systemState) {
      error("Failed to fetch network status from RPC endpoint.");
      return;
    }

    const epoch = systemState.epoch ?? "Unknown";
    const epochStartTimestamp = systemState.epochStartTimestampMs
      ? formatTimestamp(String(systemState.epochStartTimestampMs))
      : "Unknown";
    const validatorCount = systemState.activeValidators?.length ?? 0;
    const gasPrice = referenceGasPrice ? formatGasPrice(referenceGasPrice) : "Unknown";

    // Estimate TPS using recent checkpoint data
    let tpsEstimate = "N/A";
    try {
      const seqNum = latestCheckpoint ? Number(latestCheckpoint) : 0;
      if (seqNum > 0) {
        const currentCp = await client.getCheckpoint({ id: String(seqNum) });
        const prevCp = seqNum > 1
          ? await client.getCheckpoint({ id: String(seqNum - 1) })
          : null;

        if (currentCp && prevCp && prevCp.timestampMs) {
          const txCount = Number(currentCp.transactions?.length ?? 0);
          const timeDiff = Number(currentCp.timestampMs) - Number(prevCp.timestampMs);
          if (timeDiff > 0) {
            const tps = (txCount / (timeDiff / 1000)).toFixed(1);
            tpsEstimate = formatNumber(tps);
          }
        }
      }
    } catch {
      // TPS estimate is best-effort
    }

    const url = resolveUrl(network, rpcUrl);

    const rows: [string, string][] = [
      ["Epoch", epoch],
      ["Epoch Start", epochStartTimestamp],
      ["Latest Checkpoint", latestCheckpoint ? formatNumber(latestCheckpoint) : "Unknown"],
      ["Validators", String(validatorCount)],
      ["TPS (est.)", tpsEstimate],
      ["Gas Price", gasPrice],
      ["Network", network],
      ["RPC URL", url],
    ];

    console.log(keyValueTable(rows, "IOTA Rebased Network"));
    success("Network status fetched successfully.");
  } catch (err) {
    spin.stop();
    const message = err instanceof Error ? err.message : String(err);
    error(`Failed to fetch network status: ${message}`);
  }
}
