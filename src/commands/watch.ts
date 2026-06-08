import type { IotaClient } from "@iota/iota-sdk/client";
import type { Network, WatchData } from "../lib/types.js";
import { formatNumber, formatTimestamp } from "../lib/format.js";
import { error } from "../utils/display.js";
import chalk from "chalk";

/**
 * Live-updating watch mode dashboard.
 * Refreshes every 5 seconds with key network metrics.
 */
export async function watchMode(
  client: IotaClient,
  network: Network,
): Promise<void> {
  const REFRESH_INTERVAL_MS = 5000;

  console.clear();
  console.log(chalk.bold.cyan("\n  ⏳ IOTA Rebased Network Monitor — Starting watch mode..."));
  console.log(chalk.dim("  Press Ctrl+C to exit.\n"));

  let lastCheckpointSeq = 0;
  let lastTimestampMs = 0;

  const updateDashboard = async (): Promise<void> => {
    try {
      const [systemState, latestCheckpointSeq, referenceGasPrice] = await Promise.all([
        client.getLatestIotaSystemState().catch(() => null),
        client.getLatestCheckpointSequenceNumber().catch(() => null),
        client.getReferenceGasPrice().catch(() => null),
      ]);

      if (!systemState) {
        throw new Error("Failed to fetch system state");
      }

      const epoch = systemState.epoch ?? "?";
      const seqNum = latestCheckpointSeq ? Number(latestCheckpointSeq) : 0;
      const validatorCount = systemState.activeValidators?.length ?? 0;
      const gasPrice = referenceGasPrice ? Number(referenceGasPrice) : 0;

      // Get latest checkpoint for TPS calculation
      let tpsEstimate = "N/A";
      let checkpointRate = "N/A";
      let currentTimestampMs = 0;

      if (seqNum > 0) {
        try {
          const currentCp = await client.getCheckpoint({ id: String(seqNum) });
          currentTimestampMs = Number(currentCp.timestampMs ?? 0);

          const txCount = currentCp.transactions?.length ?? 0;

          if (lastCheckpointSeq > 0 && lastTimestampMs > 0 && currentTimestampMs > lastTimestampMs) {
            const seqDiff = seqNum - lastCheckpointSeq;
            const timeDiff = currentTimestampMs - lastTimestampMs;
            if (timeDiff > 0) {
              const tps = (txCount / (timeDiff / 1000));
              tpsEstimate = tps > 0 ? `~${formatNumber(Math.round(tps))}` : "<1";
              const cps = (seqDiff / (timeDiff / 1000));
              checkpointRate = cps > 0 ? `+${cps.toFixed(1)}/s` : "+0/s";
            }
          }

          if (lastCheckpointSeq === 0) {
            // First fetch — just record baseline
            lastCheckpointSeq = seqNum;
            lastTimestampMs = currentTimestampMs;
          } else {
            lastCheckpointSeq = seqNum;
            lastTimestampMs = currentTimestampMs;
          }
        } catch {
          // Best-effort
        }
      }

      // Calculate epoch active time
      let epochActiveSince = "N/A";
      if (systemState.epochStartTimestampMs) {
        const startMs = Number(systemState.epochStartTimestampMs);
        const nowMs = Date.now();
        const diffMs = nowMs - startMs;
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        epochActiveSince = `${hours}h ${minutes}m`;
      }

      const now = new Date().toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");

      const data: WatchData = {
        epoch: String(epoch),
        epochActiveSince,
        latestCheckpoint: formatNumber(seqNum),
        checkpointRate,
        tpsEstimate,
        validatorCount,
        network,
        lastUpdated: now,
      };

      renderDashboard(data);

      // Set up for next iteration even if we fail mid-way
      if (seqNum > 0 && currentTimestampMs > 0) {
        lastCheckpointSeq = seqNum;
        lastTimestampMs = currentTimestampMs;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      renderError(message);
    }
  };

  const renderDashboard = (data: WatchData): void => {
    console.clear();
    const title = `IOTA Rebased — ${data.network}`;

    // Top header
    console.log(chalk.bold.cyan(`┌─────────────────────────────────────────────────────────────┐`));
    console.log(chalk.bold.cyan(`│  ${title.padEnd(55)}│`));
    console.log(chalk.bold.cyan(`│  ${chalk.dim("Press Ctrl+C to exit").padEnd(55)}│`));
    console.log(chalk.bold.cyan(`├──────────┬──────────────┬──────────────┬────────────────────┤`));

    // Metric headers
    console.log(
      chalk.bold.cyan("│") +
      chalk.bold(` Epoch ${data.epoch.padEnd(5)}`) +
      chalk.bold.cyan("│") +
      chalk.bold(` Checkpoint`.padEnd(13)) +
      chalk.bold.cyan("│") +
      chalk.bold(` TPS`.padEnd(13)) +
      chalk.bold.cyan("│") +
      chalk.bold(` Validators`.padEnd(19)) +
      chalk.bold.cyan("│")
    );

    // Metric values
    const epochInfo = data.epochActiveSince ? `${chalk.green("Active")} since ${data.epochActiveSince}` : chalk.green("Active");
    const cpInfo = `${data.latestCheckpoint}`;
    const cpRate = data.checkpointRate ? chalk.dim(data.checkpointRate) : "";
    const tpsInfo = data.tpsEstimate;
    const valInfo = `${data.validatorCount} online`;

    console.log(
      chalk.bold.cyan("│") +
      ` ${epochInfo.padEnd(10)}` +
      chalk.bold.cyan("│") +
      ` ${cpInfo.padEnd(3)}`.padEnd(14) +
      chalk.bold.cyan("│") +
      ` ${tpsInfo}`.padEnd(14) +
      chalk.bold.cyan("│") +
      ` ${valInfo}`.padEnd(20) +
      chalk.bold.cyan("│")
    );

    console.log(
      chalk.bold.cyan("│") +
      ` ${"".padEnd(10)}` +
      chalk.bold.cyan("│") +
      ` ${cpRate}`.padEnd(14) +
      chalk.bold.cyan("│") +
      ` ${chalk.dim("peak 2K")}`.padEnd(14) +
      chalk.bold.cyan("│") +
      ` ${"".padEnd(20)}` +
      chalk.bold.cyan("│")
    );

    console.log(chalk.bold.cyan(`└──────────┴──────────────┴──────────────┴────────────────────┘`));
    console.log(chalk.dim(`  Last updated: ${data.lastUpdated}`));
    console.log();
  };

  const renderError = (message: string): void => {
    console.clear();
    console.log(chalk.bold.cyan(`┌─────────────────────────────────────────────────────────────┐`));
    console.log(chalk.bold.cyan(`│  IOTA Rebased — ${network.padEnd(38)}│`));
    console.log(chalk.bold.cyan(`│  ${chalk.dim("Press Ctrl+C to exit").padEnd(55)}│`));
    console.log(chalk.bold.cyan(`├─────────────────────────────────────────────────────────────┤`));
    console.log(chalk.bold.cyan(`│  ${chalk.red("⚠ Error fetching data")}`.padEnd(60) + `│`));
    console.log(chalk.bold.cyan(`│  ${chalk.dim(message.slice(0, 54))}`.padEnd(60) + `│`));
    console.log(chalk.bold.cyan(`│  ${chalk.dim("Retrying in 5 seconds...")}`.padEnd(60) + `│`));
    console.log(chalk.bold.cyan(`└─────────────────────────────────────────────────────────────┘`));
    console.log();
  };

  // Initial fetch
  await updateDashboard();

  // Periodic refresh
  const interval = setInterval(updateDashboard, REFRESH_INTERVAL_MS);

  // Handle Ctrl+C gracefully
  const cleanup = (): void => {
    clearInterval(interval);
    console.log(chalk.dim("\n  Watch mode stopped.\n"));
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
