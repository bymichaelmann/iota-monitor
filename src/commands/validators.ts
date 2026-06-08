import type { IotaClient } from "@iota/iota-sdk/client";
import type { Network, ValidatorInfo } from "../lib/types.js";
import { formatIota, formatCommission, truncateAddress } from "../lib/format.js";
import { columnTable, success, error, spinner } from "../utils/display.js";

/**
 * Fetch and display validators list.
 */
export async function validatorsList(
  client: IotaClient,
  network: Network,
): Promise<void> {
  const spin = spinner("Fetching validators...");
  spin.start();

  try {
    const systemState = await client.getLatestIotaSystemState();

    spin.stop();

    if (!systemState?.activeValidators?.length) {
      error("No validators found.");
      return;
    }

    const validators: ValidatorInfo[] = systemState.activeValidators.map((v: any) => ({
      name: v.name || "Unknown",
      stake: v.stakingPoolIotaBalance
        ? formatIota(v.stakingPoolIotaBalance)
        : v.votingPower
          ? String(v.votingPower)
          : "0",
      commission: v.commissionRate !== undefined
        ? formatCommission(Number(v.commissionRate))
        : "N/A",
      address: v.iotaAddress || "Unknown",
    }));

    // Sort by stake descending (compare numerically)
    validators.sort((a, b) => {
      const aStake = parseFloat(a.stake.replace(/,/g, "") || "0");
      const bStake = parseFloat(b.stake.replace(/,/g, "") || "0");
      return bStake - aStake;
    });

    const headers = ["#", "Name", "Stake (IOTA)", "Commission", "Address"];
    const rows = validators.map((v, i) => [
      String(i + 1),
      v.name,
      v.stake,
      v.commission,
      truncateAddress(v.address),
    ]);

    console.log(columnTable(headers, rows));
    console.log();
    success(`Found ${validators.length} active validators on ${network}.`);
  } catch (err) {
    spin.stop();
    const message = err instanceof Error ? err.message : String(err);
    error(`Failed to fetch validators: ${message}`);
  }
}
