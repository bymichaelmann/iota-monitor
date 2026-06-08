/** Represents a network identifier */
export type Network = "mainnet" | "testnet" | "devnet";

/** Network RPC URL mapping */
export const NETWORK_URLS: Record<Network, string> = {
  mainnet: "https://api.mainnet.iota.cafe",
  testnet: "https://api.testnet.iota.cafe",
  devnet: "https://api.devnet.iota.cafe",
};

/** CLI options shared across commands */
export interface GlobalOptions {
  network: Network;
  rpcUrl?: string;
}

/** Summary of network status */
export interface NetworkStatus {
  epoch: string;
  latestCheckpoint: string;
  validatorCount: number;
  tpsEstimate: string;
  gasPrice: string;
  network: string;
}

/** Transaction details */
export interface TxDetails {
  digest: string;
  sender: string;
  recipients: string[];
  gasUsed: string;
  status: string;
  timestamp: string;
  network: string;
}

/** Address information */
export interface AddressInfo {
  address: string;
  balance: string;
  ownedObjects: number;
  recentTxCount: number;
  network: string;
}

/** Validator information */
export interface ValidatorInfo {
  name: string;
  stake: string;
  commission: string;
  address: string;
}

/** Checkpoint details */
export interface CheckpointInfo {
  digest: string;
  epoch: string;
  sequenceNumber: string;
  transactionCount: number;
  timestamp: string;
  network: string;
}

/** Watch mode dashboard data */
export interface WatchData {
  epoch: string;
  epochActiveSince?: string;
  latestCheckpoint: string;
  checkpointRate?: string;
  tpsEstimate: string;
  tpsPeak?: string;
  validatorCount: number;
  validatorsPending?: number;
  network: string;
  lastUpdated: string;
}
