# iota-monitor — IOTA Rebased Network Monitor CLI

## Overview
Build a CLI tool (`iota-monitor`) for monitoring the IOTA Rebased blockchain network. It connects via the official `@iota/iota-sdk` TypeScript SDK and provides real-time network analytics, transaction lookup, address inspection, and validator status — all from the terminal.

**Category:** Open-Source Dev — Tooling, Libraries, Public Goods
**Criteria:** Open-source, benefits IOTA/Shimmer network, evaluated on expertise, usefulness, long-term viability, safety, scale.

## Tech Stack
- **Runtime:** Node.js 20+ (TypeScript, compiled)
- **SDK:** `@iota/iota-sdk` (official IOTA Rebased TypeScript SDK)
- **CLI framework:** `commander` (or `yargs`)
- **Output:** Beautiful terminal output with `chalk`, `cli-table3`, `ora` (spinners)
- **Packaging:** `tsup` or `esbuild` to compile to a single executable, published as an npm package and also installable via `npx`

## Acceptance Criteria (must all pass)

1. **Network status command** (`iota-monitor network`): Shows current epoch, latest checkpoint ID, validator count, total TPS estimate, gas price reference
2. **Transaction lookup** (`iota-monitor tx <digest>`): Shows transaction details — sender, recipients, gas used, status, timestamp
3. **Address info** (`iota-monitor address <addr>`): Shows balance (IOTA), number of owned objects, recent transaction count
4. **Validators list** (`iota-monitor validators`): Shows top validators with name, stake, commission, APR
5. **Checkpoint details** (`iota-monitor checkpoint [id]`): Shows checkpoint info — epoch, transactions count, timestamp
6. **Watch mode** (`iota-monitor watch`): Live-updating dashboard that refreshes every 5 seconds showing key network metrics (like `top` or `htop`)
7. **Multi-network support**: Works with `--network mainnet|testnet|devnet` flag (default: mainnet). Testnet RPC: `https://api.testnet.iota.cafe`
8. **Help command** (`iota-monitor --help`): Clear, well-formatted help output

## Implementation Requirements

### Project structure
```
iota-monitor/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
├── LICENSE (MIT)
├── src/
│   ├── index.ts              # Entry point — CLI setup
│   ├── commands/
│   │   ├── network.ts         # Network status command
│   │   ├── tx.ts              # Transaction lookup command
│   │   ├── address.ts         # Address info command
│   │   ├── validators.ts      # Validators list command
│   │   ├── checkpoint.ts      # Checkpoint details command
│   │   └── watch.ts           # Live watch mode
│   ├── lib/
│   │   ├── client.ts          # IotaClient factory (multi-network)
│   │   ├── format.ts          # Output formatting helpers
│   │   └── types.ts           # Type definitions
│   └── utils/
│       └── display.ts         # Table, spinner, color helpers
├── tests/
│   ├── network.test.ts
│   ├── tx.test.ts
│   ├── address.test.ts
│   ├── validators.test.ts
│   └── format.test.ts
├── .github/
```

### Network detection
- `mainnet`: `https://api.mainnet.iota.cafe` (or IOTA RPC)
- `testnet`: `https://api.testnet.iota.cafe`
- `devnet`: `https://api.devnet.iota.cafe`
- Allow custom RPC via `--rpc-url`

### Error handling
- Graceful error messages when RPC is unreachable
- Timeout handling (10s default)
- Clear "not found" messages for invalid addresses/transactions

### Testing
- Unit tests for formatting and parsing functions
- Integration tests that connect to testnet (marked with `--network testnet`, can be skipped offline)

### Output examples

**`iota-monitor network`** should produce something like:
```
┌─────────────────────────────────────┐
│       IOTA Rebased Network           │
├──────────────────┬──────────────────┤
│ Epoch             │ 42               │
│ Latest Checkpoint │ 1234567          │
│ Validators        │ 13               │
│ TPS (est.)        │ 1,234            │
│ Gas Price         │ 100 MIST         │
│ Network           │ mainnet          │
└──────────────────┴──────────────────┘
```

**`iota-monitor watch`** (updates every 5s):
```
┌──────────────────────────────────────────────┐
│ IOTA Rebased — mainnet           [Ctrl+C]    │
├───────────┬──────────┬──────────┬────────────┤
│ Epoch 42  │ Checkpt  │ TPS      │ Validators │
│ Active    │ 1,234,567│ ~1,200   │ 13 online  │
│ since 2h  │ +12/s    │ peak 2K  │ 1 pending  │
└───────────┴──────────┴──────────┴────────────┘
Last updated: 2025-06-07 14:30:00 UTC
```

## Installation
```bash
npx @iota-tools/iota-monitor network
# Or global install:
npm install -g @iota-tools/iota-monitor
iota-monitor network
```

## Git repo
Name: `iota-monitor`
License: MIT
