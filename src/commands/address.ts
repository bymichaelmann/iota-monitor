import type { IotaClient } from "@iota/iota-sdk/client";
import type { Network } from "../lib/types.js";
import { formatIota, formatNumber, truncateAddress } from "../lib/format.js";
import { keyValueTable, success, error, spinner } from "../utils/display.js";

/**
 * Fetch and display address information.
 */
export async function addressInfo(
  client: IotaClient,
  network: Network,
  address: string,
): Promise<void> {
  const spin = spinner(`Fetching address info for ${truncateAddress(address)}...`);
  spin.start();

  try {
    const [balance, ownedObjects, recentTxs] = await Promise.all([
      client.getBalance({ owner: address }).catch(() => null),
      client.getOwnedObjects({
        owner: address,
        limit: 50,
      }).catch(() => null),
      client.queryTransactionBlocks({
        filter: { FromAddress: address },
        limit: 10,
      }).catch(() => null),
    ]);

    spin.stop();

    if (!balance && !ownedObjects) {
      error(`Could not fetch information for address: ${address}`);
      return;
    }

    const balanceIota = balance
      ? formatIota(balance.totalBalance)
      : "0";
    const objCount = ownedObjects?.data?.length ?? 0;
    const txCount = recentTxs?.data?.length ?? 0;

    const rows: [string, string][] = [
      ["Address", address],
      ["Balance (IOTA)", balanceIota],
      ["Owned Objects", formatNumber(objCount)],
      ["Recent Tx Count", formatNumber(txCount)],
      ["Network", network],
    ];

    console.log(keyValueTable(rows, "Address Information"));
    success("Address info fetched successfully.");
  } catch (err) {
    spin.stop();
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found") || message.includes("Invalid")) {
      error(`Address not found or invalid: ${address}`);
    } else {
      error(`Failed to fetch address info: ${message}`);
    }
  }
}
