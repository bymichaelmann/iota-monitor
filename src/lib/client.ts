import { IotaClient, getFullnodeUrl } from "@iota/iota-sdk/client";
import { Network, NETWORK_URLS } from "./types.js";

/**
 * Create an IotaClient connected to the specified network.
 * If rpcUrl is provided, it overrides the default network URL.
 */
export function createClient(network: Network, rpcUrl?: string): IotaClient {
  const url = rpcUrl || NETWORK_URLS[network];
  return new IotaClient({ url });
}

/**
 * Resolve the fullnode URL for a given network.
 */
export function resolveUrl(network: Network, rpcUrl?: string): string {
  return rpcUrl || NETWORK_URLS[network];
}
