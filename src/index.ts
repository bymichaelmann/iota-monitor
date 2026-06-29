#!/usr/bin/env node

import { Command } from "commander";
import { createClient } from "./lib/client.js";
import type { Network } from "./lib/types.js";
import { networkStatus } from "./commands/network.js";
import { transactionLookup } from "./commands/tx.js";
import { addressInfo } from "./commands/address.js";
import { validatorsList } from "./commands/validators.js";
import { checkpointDetails } from "./commands/checkpoint.js";
import { watchMode } from "./commands/watch.js";
import { sentinelRun } from "./sentinel/index.js";
import type { SentinelConfig } from "./sentinel/index.js";
import { error } from "./utils/display.js";

const program = new Command();

program
  .name("iota-monitor")
  .description("IOTA Rebased Network Monitor CLI — real-time network analytics from your terminal")
  .version("0.1.0")
  .option("--network <network>", "Network to connect to (mainnet|testnet|devnet)", "mainnet")
  .option("--rpc-url <url>", "Custom RPC URL (overrides --network)")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    const validNetworks = ["mainnet", "testnet", "devnet"];
    if (opts.network && !validNetworks.includes(opts.network)) {
      error(`Invalid network "${opts.network}". Valid options: ${validNetworks.join(", ")}`);
      process.exit(1);
    }
  });

// Helper to get client from global options
function getClient(cmd: Command) {
  const globalOpts = cmd.optsWithGlobals();
  const network = (globalOpts.network as Network) || "mainnet";
  const rpcUrl = globalOpts.rpcUrl as string | undefined;
  return { client: createClient(network, rpcUrl), network, rpcUrl };
}

program
  .command("network")
  .description("Show current network status (epoch, checkpoint, validators, TPS, gas price)")
  .action(async () => {
    const { client, network, rpcUrl } = getClient(program);
    await networkStatus(client, network, rpcUrl);
  });

program
  .command("tx")
  .description("Lookup transaction details by digest")
  .argument("<digest>", "Transaction digest to look up")
  .action(async (digest: string) => {
    const { client, network } = getClient(program);
    await transactionLookup(client, network, digest);
  });

program
  .command("address")
  .description("Show address information (balance, owned objects, recent transactions)")
  .argument("<address>", "Address to inspect")
  .action(async (address: string) => {
    const { client, network } = getClient(program);
    await addressInfo(client, network, address);
  });

program
  .command("validators")
  .aliases(["v"])
  .description("List top validators with name, stake, commission, APR")
  .action(async () => {
    const { client, network } = getClient(program);
    await validatorsList(client, network);
  });

program
  .command("checkpoint")
  .description("Show checkpoint details")
  .argument("[id]", "Checkpoint ID (sequence number); shows latest if omitted")
  .action(async (id?: string) => {
    const { client, network } = getClient(program);
    await checkpointDetails(client, network, id);
  });

program
  .command("watch")
  .description("Live-updating dashboard that refreshes every 5 seconds")
  .action(async () => {
    const { client, network } = getClient(program);
    await watchMode(client, network);
  });

// Sentinel / Alerting mode
program
  .command("sentinel")
  .description("Alerting daemon that monitors IOTA based on rules and sends notifications")
  .requiredOption("--config <file>", "Path to rules JSON file")
  .option("--interval <seconds>", "Polling interval in seconds", "15")
  .option("--once", "Run once and exit (exit code = number of alerts)")
  .option("--metrics-port <port>", "Port for Prometheus metrics endpoint")
  .action(async (opts: { config: string; interval: string; once?: boolean; metricsPort?: string }) => {
    const { client } = getClient(program);
    const config: SentinelConfig = {
      configPath: opts.config,
      pollingInterval: parseInt(opts.interval, 10) || 15,
      once: opts.once ?? false,
      metricsPort: opts.metricsPort ? parseInt(opts.metricsPort, 10) : undefined,
    };
    const alertCount = await sentinelRun(client, config);
    if (opts.once) {
      process.exit(alertCount > 0 ? 1 : 0);
    }
  });

program.parse(process.argv);
