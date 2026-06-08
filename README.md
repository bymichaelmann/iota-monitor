# iota-monitor

**IOTA Rebased Network Monitor CLI** — Real-time network analytics, transaction lookup, address inspection, and validator status — all from your terminal.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Built with the official `@iota/iota-sdk` TypeScript SDK for the IOTA Rebased blockchain.

## Features

- **Network Status** — Current epoch, latest checkpoint, validator count, TPS estimate, gas price
- **Transaction Lookup** — Transaction details: sender, recipients, gas used, status, timestamp
- **Address Info** — Balance (IOTA), owned objects count, recent transaction count
- **Validators List** — Top validators with name, stake, commission, APR
- **Checkpoint Details** — Checkpoint info: digest, epoch, transactions count, timestamp
- **Watch Mode** — Live-updating dashboard that refreshes every 5 seconds (like `top` for IOTA)
- **Multi-Network** — Supports `mainnet`, `testnet`, `devnet` and custom RPC URLs

## Installation

### Quick use with npx

```bash
npx @iota-tools/iota-monitor network
```

### Global install

```bash
npm install -g @iota-tools/iota-monitor
iota-monitor network
```

## Usage

```bash
iota-monitor --help
```

### Commands

| Command | Description |
|---------|-------------|
| `network` | Show current network status |
| `tx <digest>` | Lookup transaction by digest |
| `address <addr>` | Inspect address (balance, objects, txs) |
| `validators` | List top validators |
| `checkpoint [id]` | Show checkpoint details (latest if omitted) |
| `watch` | Live-updating dashboard (refresh every 5s) |

### Options

| Option | Description |
|--------|-------------|
| `--network <network>` | Network: mainnet, testnet, devnet (default: mainnet) |
| `--rpc-url <url>` | Custom RPC URL (overrides --network) |
| `--help` | Show help |
| `--version` | Show version |

### Examples

```bash
# Network status on testnet
iota-monitor --network testnet network

# Transaction lookup
iota-monitor tx <transaction-digest>

# Address inspection
iota-monitor address 0x1234...

# Validators list on testnet
iota-monitor --network testnet validators

# Checkpoint details (latest)
iota-monitor checkpoint

# Checkpoint #42
iota-monitor checkpoint 42

# Watch mode on testnet
iota-monitor --network testnet watch

# Custom RPC URL
iota-monitor --rpc-url https://custom.rpc.iota.cafe network
```

## Development

### Prerequisites

- Node.js 20+

### Setup

```bash
git clone https://github.com/iota-tools/iota-monitor.git
cd iota-monitor
npm install
npm run build
```

### Testing

```bash
npm test
```

### Build

```bash
npm run build
```

The compiled output is in `dist/`.

## Project Structure

```
iota-monitor/
├── src/
│   ├── index.ts              # Entry point — CLI setup
│   ├── commands/
│   │   ├── network.ts        # Network status command
│   │   ├── tx.ts             # Transaction lookup command
│   │   ├── address.ts        # Address info command
│   │   ├── validators.ts     # Validators list command
│   │   ├── checkpoint.ts     # Checkpoint details command
│   │   └── watch.ts          # Live watch mode
│   ├── lib/
│   │   ├── client.ts         # IotaClient factory
│   │   ├── format.ts         # Output formatting helpers
│   │   └── types.ts          # Type definitions
│   └── utils/
│       └── display.ts        # Table, spinner, color helpers
├── tests/
│   ├── network.test.ts
│   ├── tx.test.ts
│   ├── address.test.ts
│   ├── validators.test.ts
│   ├── client.test.ts
│   └── format.test.ts
└── ...
```

## License

MIT — see [LICENSE](LICENSE).

