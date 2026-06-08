#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";

// src/lib/client.ts
import { IotaClient } from "@iota/iota-sdk/client";

// src/lib/types.ts
var NETWORK_URLS = {
  mainnet: "https://api.mainnet.iota.cafe",
  testnet: "https://api.testnet.iota.cafe",
  devnet: "https://api.devnet.iota.cafe"
};

// src/lib/client.ts
function createClient(network, rpcUrl) {
  const url = rpcUrl || NETWORK_URLS[network];
  return new IotaClient({ url });
}
function resolveUrl(network, rpcUrl) {
  return rpcUrl || NETWORK_URLS[network];
}

// src/lib/format.ts
function formatIota(value, decimals = 9) {
  const val = typeof value === "bigint" ? value : BigInt(value);
  const divisor = BigInt(10 ** decimals);
  const whole = val / divisor;
  const fraction = val % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  if (fractionStr.length === 0) return whole.toLocaleString("en-US");
  return `${whole.toLocaleString("en-US")}.${fractionStr}`;
}
function formatGasPrice(value) {
  const val = typeof value === "bigint" ? value : BigInt(value);
  return `${val.toLocaleString("en-US")} MIST`;
}
function formatNumber(value) {
  if (typeof value === "bigint") return value.toLocaleString("en-US");
  return Number(value).toLocaleString("en-US");
}
function formatTimestamp(timestamp) {
  if (!timestamp) return "Unknown";
  const ts = typeof timestamp === "string" && isNaN(Number(timestamp)) ? new Date(timestamp) : new Date(Number(timestamp));
  if (isNaN(ts.getTime())) return "Unknown";
  return ts.toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
}
function truncateAddress(address, prefixLen = 6, suffixLen = 4) {
  if (address.length <= prefixLen + suffixLen + 3) return address;
  return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}
function formatCommission(rate) {
  const r = typeof rate === "string" ? parseFloat(rate) : rate;
  return `${(r / 100).toFixed(2)}%`;
}

// src/utils/display.ts
import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";
function spinner(text) {
  return ora({ text, color: "cyan" });
}
function keyValueTable(rows, title) {
  const maxKeyLen = Math.max(...rows.map(([k]) => k.length));
  const table = new Table({
    style: { head: [], border: [] },
    colWidths: [maxKeyLen + 4, void 0],
    chars: {
      top: "\u2500",
      "top-mid": "\u252C",
      "top-left": "\u250C",
      "top-right": "\u2510",
      bottom: "\u2500",
      "bottom-mid": "\u2534",
      "bottom-left": "\u2514",
      "bottom-right": "\u2518",
      left: "\u2502",
      "left-mid": "\u251C",
      mid: "\u2500",
      "mid-mid": "\u253C",
      right: "\u2502",
      "right-mid": "\u2524",
      middle: "\u2502"
    }
  });
  if (title) {
    const titleTable = new Table({
      style: { head: [], border: [] },
      chars: {
        top: "\u2500",
        "top-mid": "\u252C",
        "top-left": "\u250C",
        "top-right": "\u2510",
        bottom: "\u2500",
        "bottom-mid": "\u2534",
        "bottom-left": "\u2514",
        "bottom-right": "\u2518",
        left: "\u2502",
        "left-mid": "\u251C",
        mid: "\u2500",
        "mid-mid": "\u253C",
        right: "\u2502",
        "right-mid": "\u2524",
        middle: "\u2502"
      }
    });
    titleTable.push([{ colSpan: 2, content: chalk.bold.cyan(title), hAlign: "center" }]);
    for (const [key, value] of rows) {
      titleTable.push([chalk.bold(key), value]);
    }
    return titleTable.toString();
  }
  for (const [key, value] of rows) {
    table.push([chalk.bold(key), value]);
  }
  return table.toString();
}
function columnTable(headers, rows) {
  const table = new Table({
    head: headers.map((h) => chalk.bold.cyan(h)),
    style: { head: [], border: [] },
    chars: {
      top: "\u2500",
      "top-mid": "\u252C",
      "top-left": "\u250C",
      "top-right": "\u2510",
      bottom: "\u2500",
      "bottom-mid": "\u2534",
      "bottom-left": "\u2514",
      "bottom-right": "\u2518",
      left: "\u2502",
      "left-mid": "\u251C",
      mid: "\u2500",
      "mid-mid": "\u253C",
      right: "\u2502",
      "right-mid": "\u2524",
      middle: "\u2502"
    }
  });
  for (const row of rows) {
    table.push(row);
  }
  return table.toString();
}
function success(message) {
  console.log(chalk.green("\u2713"), message);
}
function error(message) {
  console.error(chalk.red("\u2717"), message);
}
function formatStatus(status) {
  switch (status.toLowerCase()) {
    case "success":
      return chalk.green(status);
    case "failure":
    case "failed":
      return chalk.red(status);
    case "pending":
      return chalk.yellow(status);
    default:
      return status;
  }
}

// src/commands/network.ts
async function networkStatus(client, network, rpcUrl) {
  const spin = spinner("Fetching network status...");
  spin.start();
  try {
    const [systemState, latestCheckpoint, referenceGasPrice] = await Promise.all([
      client.getLatestIotaSystemState().catch(() => null),
      client.getLatestCheckpointSequenceNumber().catch(() => null),
      client.getReferenceGasPrice().catch(() => null)
    ]);
    spin.stop();
    if (!systemState) {
      error("Failed to fetch network status from RPC endpoint.");
      return;
    }
    const epoch = systemState.epoch ?? "Unknown";
    const epochStartTimestamp = systemState.epochStartTimestampMs ? formatTimestamp(String(systemState.epochStartTimestampMs)) : "Unknown";
    const validatorCount = systemState.activeValidators?.length ?? 0;
    const gasPrice = referenceGasPrice ? formatGasPrice(referenceGasPrice) : "Unknown";
    let tpsEstimate = "N/A";
    try {
      const seqNum = latestCheckpoint ? Number(latestCheckpoint) : 0;
      if (seqNum > 0) {
        const currentCp = await client.getCheckpoint({ id: String(seqNum) });
        const prevCp = seqNum > 1 ? await client.getCheckpoint({ id: String(seqNum - 1) }) : null;
        if (currentCp && prevCp && prevCp.timestampMs) {
          const txCount = Number(currentCp.transactions?.length ?? 0);
          const timeDiff = Number(currentCp.timestampMs) - Number(prevCp.timestampMs);
          if (timeDiff > 0) {
            const tps = (txCount / (timeDiff / 1e3)).toFixed(1);
            tpsEstimate = formatNumber(tps);
          }
        }
      }
    } catch {
    }
    const url = resolveUrl(network, rpcUrl);
    const rows = [
      ["Epoch", epoch],
      ["Epoch Start", epochStartTimestamp],
      ["Latest Checkpoint", latestCheckpoint ? formatNumber(latestCheckpoint) : "Unknown"],
      ["Validators", String(validatorCount)],
      ["TPS (est.)", tpsEstimate],
      ["Gas Price", gasPrice],
      ["Network", network],
      ["RPC URL", url]
    ];
    console.log(keyValueTable(rows, "IOTA Rebased Network"));
    success("Network status fetched successfully.");
  } catch (err) {
    spin.stop();
    const message = err instanceof Error ? err.message : String(err);
    error(`Failed to fetch network status: ${message}`);
  }
}

// src/commands/tx.ts
async function transactionLookup(client, network, digest) {
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
        showObjectChanges: false
      }
    });
    spin.stop();
    if (!tx) {
      error(`Transaction not found: ${digest}`);
      return;
    }
    const effects = tx.effects;
    const status = effects?.status?.status ?? "Unknown";
    const gasUsed = effects?.gasUsed ? formatNumber(String(effects.gasUsed.computationCost ?? 0)) : "Unknown";
    const timestamp = tx.timestampMs ? formatTimestamp(tx.timestampMs) : "Unknown";
    const sender = tx.transaction?.data?.sender ?? "Unknown";
    const recipients = /* @__PURE__ */ new Set();
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
    const rows = [
      ["Digest", digest],
      ["Status", formatStatus(status)],
      ["Sender", sender],
      ["Recipients", recipients.size > 0 ? [...recipients].join("\n") : "None"],
      ["Gas Used", `${gasUsed} MIST`],
      ["Timestamp", timestamp],
      ["Network", network]
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

// src/commands/address.ts
async function addressInfo(client, network, address) {
  const spin = spinner(`Fetching address info for ${truncateAddress(address)}...`);
  spin.start();
  try {
    const [balance, ownedObjects, recentTxs] = await Promise.all([
      client.getBalance({ owner: address }).catch(() => null),
      client.getOwnedObjects({
        owner: address,
        limit: 50
      }).catch(() => null),
      client.queryTransactionBlocks({
        filter: { FromAddress: address },
        limit: 10
      }).catch(() => null)
    ]);
    spin.stop();
    if (!balance && !ownedObjects) {
      error(`Could not fetch information for address: ${address}`);
      return;
    }
    const balanceIota = balance ? formatIota(balance.totalBalance) : "0";
    const objCount = ownedObjects?.data?.length ?? 0;
    const txCount = recentTxs?.data?.length ?? 0;
    const rows = [
      ["Address", address],
      ["Balance (IOTA)", balanceIota],
      ["Owned Objects", formatNumber(objCount)],
      ["Recent Tx Count", formatNumber(txCount)],
      ["Network", network]
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

// src/commands/validators.ts
async function validatorsList(client, network) {
  const spin = spinner("Fetching validators...");
  spin.start();
  try {
    const systemState = await client.getLatestIotaSystemState();
    spin.stop();
    if (!systemState?.activeValidators?.length) {
      error("No validators found.");
      return;
    }
    const validators = systemState.activeValidators.map((v) => ({
      name: v.name || "Unknown",
      stake: v.stakingPoolIotaBalance ? formatIota(v.stakingPoolIotaBalance) : v.votingPower ? String(v.votingPower) : "0",
      commission: v.commissionRate !== void 0 ? formatCommission(Number(v.commissionRate)) : "N/A",
      address: v.iotaAddress || "Unknown"
    }));
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
      truncateAddress(v.address)
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

// src/commands/checkpoint.ts
async function checkpointDetails(client, network, id) {
  const label = id ? `Checkpoint #${id}` : "latest checkpoint";
  const spin = spinner(`Fetching ${label}...`);
  spin.start();
  try {
    let checkpointId;
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
    const rows = [
      ["Digest", cp.digest ?? "Unknown"],
      ["Epoch", cp.epoch ?? "Unknown"],
      ["Sequence Number", cp.sequenceNumber ?? formatNumber(checkpointId)],
      ["Transactions", formatNumber(cp.transactions?.length ?? 0)],
      ["Timestamp", cp.timestampMs ? formatTimestamp(cp.timestampMs) : "Unknown"],
      ["Network", network]
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

// src/commands/watch.ts
import chalk2 from "chalk";
async function watchMode(client, network) {
  const REFRESH_INTERVAL_MS = 5e3;
  console.clear();
  console.log(chalk2.bold.cyan("\n  \u23F3 IOTA Rebased Network Monitor \u2014 Starting watch mode..."));
  console.log(chalk2.dim("  Press Ctrl+C to exit.\n"));
  let lastCheckpointSeq = 0;
  let lastTimestampMs = 0;
  const updateDashboard = async () => {
    try {
      const [systemState, latestCheckpointSeq, referenceGasPrice] = await Promise.all([
        client.getLatestIotaSystemState().catch(() => null),
        client.getLatestCheckpointSequenceNumber().catch(() => null),
        client.getReferenceGasPrice().catch(() => null)
      ]);
      if (!systemState) {
        throw new Error("Failed to fetch system state");
      }
      const epoch = systemState.epoch ?? "?";
      const seqNum = latestCheckpointSeq ? Number(latestCheckpointSeq) : 0;
      const validatorCount = systemState.activeValidators?.length ?? 0;
      const gasPrice = referenceGasPrice ? Number(referenceGasPrice) : 0;
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
              const tps = txCount / (timeDiff / 1e3);
              tpsEstimate = tps > 0 ? `~${formatNumber(Math.round(tps))}` : "<1";
              const cps = seqDiff / (timeDiff / 1e3);
              checkpointRate = cps > 0 ? `+${cps.toFixed(1)}/s` : "+0/s";
            }
          }
          if (lastCheckpointSeq === 0) {
            lastCheckpointSeq = seqNum;
            lastTimestampMs = currentTimestampMs;
          } else {
            lastCheckpointSeq = seqNum;
            lastTimestampMs = currentTimestampMs;
          }
        } catch {
        }
      }
      let epochActiveSince = "N/A";
      if (systemState.epochStartTimestampMs) {
        const startMs = Number(systemState.epochStartTimestampMs);
        const nowMs = Date.now();
        const diffMs = nowMs - startMs;
        const hours = Math.floor(diffMs / 36e5);
        const minutes = Math.floor(diffMs % 36e5 / 6e4);
        epochActiveSince = `${hours}h ${minutes}m`;
      }
      const now = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
      const data = {
        epoch: String(epoch),
        epochActiveSince,
        latestCheckpoint: formatNumber(seqNum),
        checkpointRate,
        tpsEstimate,
        validatorCount,
        network,
        lastUpdated: now
      };
      renderDashboard(data);
      if (seqNum > 0 && currentTimestampMs > 0) {
        lastCheckpointSeq = seqNum;
        lastTimestampMs = currentTimestampMs;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      renderError(message);
    }
  };
  const renderDashboard = (data) => {
    console.clear();
    const title = `IOTA Rebased \u2014 ${data.network}`;
    console.log(chalk2.bold.cyan(`\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`));
    console.log(chalk2.bold.cyan(`\u2502  ${title.padEnd(55)}\u2502`));
    console.log(chalk2.bold.cyan(`\u2502  ${chalk2.dim("Press Ctrl+C to exit").padEnd(55)}\u2502`));
    console.log(chalk2.bold.cyan(`\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524`));
    console.log(
      chalk2.bold.cyan("\u2502") + chalk2.bold(` Epoch ${data.epoch.padEnd(5)}`) + chalk2.bold.cyan("\u2502") + chalk2.bold(` Checkpoint`.padEnd(13)) + chalk2.bold.cyan("\u2502") + chalk2.bold(` TPS`.padEnd(13)) + chalk2.bold.cyan("\u2502") + chalk2.bold(` Validators`.padEnd(19)) + chalk2.bold.cyan("\u2502")
    );
    const epochInfo = data.epochActiveSince ? `${chalk2.green("Active")} since ${data.epochActiveSince}` : chalk2.green("Active");
    const cpInfo = `${data.latestCheckpoint}`;
    const cpRate = data.checkpointRate ? chalk2.dim(data.checkpointRate) : "";
    const tpsInfo = data.tpsEstimate;
    const valInfo = `${data.validatorCount} online`;
    console.log(
      chalk2.bold.cyan("\u2502") + ` ${epochInfo.padEnd(10)}` + chalk2.bold.cyan("\u2502") + ` ${cpInfo.padEnd(3)}`.padEnd(14) + chalk2.bold.cyan("\u2502") + ` ${tpsInfo}`.padEnd(14) + chalk2.bold.cyan("\u2502") + ` ${valInfo}`.padEnd(20) + chalk2.bold.cyan("\u2502")
    );
    console.log(
      chalk2.bold.cyan("\u2502") + ` ${"".padEnd(10)}` + chalk2.bold.cyan("\u2502") + ` ${cpRate}`.padEnd(14) + chalk2.bold.cyan("\u2502") + ` ${chalk2.dim("peak 2K")}`.padEnd(14) + chalk2.bold.cyan("\u2502") + ` ${"".padEnd(20)}` + chalk2.bold.cyan("\u2502")
    );
    console.log(chalk2.bold.cyan(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`));
    console.log(chalk2.dim(`  Last updated: ${data.lastUpdated}`));
    console.log();
  };
  const renderError = (message) => {
    console.clear();
    console.log(chalk2.bold.cyan(`\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`));
    console.log(chalk2.bold.cyan(`\u2502  IOTA Rebased \u2014 ${network.padEnd(38)}\u2502`));
    console.log(chalk2.bold.cyan(`\u2502  ${chalk2.dim("Press Ctrl+C to exit").padEnd(55)}\u2502`));
    console.log(chalk2.bold.cyan(`\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524`));
    console.log(chalk2.bold.cyan(`\u2502  ${chalk2.red("\u26A0 Error fetching data")}`.padEnd(60) + `\u2502`));
    console.log(chalk2.bold.cyan(`\u2502  ${chalk2.dim(message.slice(0, 54))}`.padEnd(60) + `\u2502`));
    console.log(chalk2.bold.cyan(`\u2502  ${chalk2.dim("Retrying in 5 seconds...")}`.padEnd(60) + `\u2502`));
    console.log(chalk2.bold.cyan(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`));
    console.log();
  };
  await updateDashboard();
  const interval = setInterval(updateDashboard, REFRESH_INTERVAL_MS);
  const cleanup = () => {
    clearInterval(interval);
    console.log(chalk2.dim("\n  Watch mode stopped.\n"));
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

// src/index.ts
var program = new Command();
program.name("iota-monitor").description("IOTA Rebased Network Monitor CLI \u2014 real-time network analytics from your terminal").version("0.1.0").option("--network <network>", "Network to connect to (mainnet|testnet|devnet)", "mainnet").option("--rpc-url <url>", "Custom RPC URL (overrides --network)").hook("preAction", (thisCommand) => {
  const opts = thisCommand.opts();
  const validNetworks = ["mainnet", "testnet", "devnet"];
  if (opts.network && !validNetworks.includes(opts.network)) {
    error(`Invalid network "${opts.network}". Valid options: ${validNetworks.join(", ")}`);
    process.exit(1);
  }
});
function getClient(cmd) {
  const globalOpts = cmd.optsWithGlobals();
  const network = globalOpts.network || "mainnet";
  const rpcUrl = globalOpts.rpcUrl;
  return { client: createClient(network, rpcUrl), network, rpcUrl };
}
program.command("network").description("Show current network status (epoch, checkpoint, validators, TPS, gas price)").action(async () => {
  const { client, network, rpcUrl } = getClient(program);
  await networkStatus(client, network, rpcUrl);
});
program.command("tx").description("Lookup transaction details by digest").argument("<digest>", "Transaction digest to look up").action(async (digest) => {
  const { client, network } = getClient(program);
  await transactionLookup(client, network, digest);
});
program.command("address").description("Show address information (balance, owned objects, recent transactions)").argument("<address>", "Address to inspect").action(async (address) => {
  const { client, network } = getClient(program);
  await addressInfo(client, network, address);
});
program.command("validators").aliases(["v"]).description("List top validators with name, stake, commission, APR").action(async () => {
  const { client, network } = getClient(program);
  await validatorsList(client, network);
});
program.command("checkpoint").description("Show checkpoint details").argument("[id]", "Checkpoint ID (sequence number); shows latest if omitted").action(async (id) => {
  const { client, network } = getClient(program);
  await checkpointDetails(client, network, id);
});
program.command("watch").description("Live-updating dashboard that refreshes every 5 seconds").action(async () => {
  const { client, network } = getClient(program);
  await watchMode(client, network);
});
program.parse(process.argv);
//# sourceMappingURL=index.js.map