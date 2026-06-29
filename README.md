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
- **Sentinel Mode** — Alerting daemon that monitors IOTA based on user-defined rules and sends notifications via webhook, stdout, or exec
- **Multi-Network** — Supports `mainnet`, `testnet`, `devnet` and custom RPC URLs

## Installation

```bash
git clone https://github.com/iota-tools/iota-monitor.git
cd iota-monitor
npm install
npm run build
node dist/index.js network
# Or: npm link && iota-monitor network
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
| `sentinel` | Alerting daemon with configurable rules and notifications |

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

# Sentinel mode with rules file
iota-monitor sentinel --config rules.example.json --interval 30

# Sentinel mode run once (exit code = number of alerts)
iota-monitor sentinel --config rules.example.json --once --interval 10

# Sentinel mode with Prometheus metrics
iota-monitor sentinel --config rules.example.json --interval 15 --metrics-port 9090

# Custom RPC URL
iota-monitor --rpc-url https://custom.rpc.iota.cafe network
```

## Sentinel / Alerting Mode

Sentinel mode is an alerting daemon that polls the IOTA RPC based on user-defined rules and sends notifications. It supports multiple trigger types and notification channels.

### Command

```bash
iota-monitor sentinel --config <rules.json> [options]
```

| Option | Description |
|--------|-------------|
| `--config <file>` | Path to rules JSON file (required) |
| `--interval <seconds>` | Polling interval (default: 15) |
| `--once` | Run once and exit (exit code = number of alerts) |
| `--metrics-port <port>` | Prometheus metrics endpoint port (optional) |

### Rule Types

| Type | Description | Required Params |
|------|-------------|----------------|
| `move_event` | Monitor on-chain events | `package`, `module` |
| `address_activity` | Monitor transactions from/to an address | `address` |
| `balance_threshold` | Alert when balance crosses a threshold | `address` + `below` or `above` |
| `validator_change` | Detect validator set changes | (none) |
| `network_param` | Monitor gas price and epoch changes | (optional: `gasAbove`, `gasBelow`) |

### Notification Channels

| Channel | Description | Config |
|---------|-------------|--------|
| `stdout` | Write NDJSON to stdout | (none) |
| `webhook` | HTTP POST to URL | `url` in params or notifierConfig |
| `exec` | Spawn a process with alert data in env vars | `command` in params or notifierConfig |

### Example Rules File

See [`rules.example.json`](rules.example.json) for a complete example.

```json
{
  "rules": [
    {
      "id": "balance-alert",
      "type": "balance_threshold",
      "params": {
        "address": "0x1234...",
        "below": "10"
      },
      "notify": ["stdout", "webhook"]
    },
    {
      "id": "validator-changes",
      "type": "validator_change",
      "params": {},
      "notify": ["stdout"]
    }
  ]
}
```

### Webhook Notifier

The webhook URL can be templated with alert fields:
- `{{ruleId}}`, `{{type}}`, `{{severity}}`, `{{title}}`

### Exec Notifier

When an alert fires, the configured command is spawned with these environment variables:
- `ALERT_RULE_ID`, `ALERT_TYPE`, `ALERT_SEVERITY`, `ALERT_TITLE`, `ALERT_MESSAGE`, `ALERT_TIMESTAMP`, `ALERT_DATA`

### Prometheus Metrics

If `--metrics-port` is set, a minimal HTTP server exposes:
- `iota_alerts_total{rule_id,type}` — counter
- `iota_poll_duration_seconds{rule_id}` — gauge
- `iota_rpc_errors_total{rule_id}` — counter

### systemd Service Snippet

```ini
[Unit]
Description=IOTA Monitor Sentinel
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/iota-monitor sentinel --config /etc/iota-monitor/rules.json --interval 15 --metrics-port 9090
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
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
│   │   ├── types.ts          # Type definitions
│   │   ├── rules.ts          # Sentinel rule schema & loader
│   │   └── state.ts          # Sentinel state persistence
│   ├── sentinel/
│   │   ├── index.ts          # Main orchestrator
│   │   ├── types.ts          # Alert & trigger types
│   │   ├── metrics.ts        # Prometheus metrics endpoint
│   │   ├── triggers/
│   │   │   ├── move_event.ts
│   │   │   ├── address_activity.ts
│   │   │   ├── balance_threshold.ts
│   │   │   ├── validator_change.ts
│   │   │   └── network_param.ts
│   │   └── notifiers/
│   │       ├── webhook.ts
│   │       ├── stdout.ts
│   │       └── exec.ts
│   └── utils/
│       └── display.ts        # Table, spinner, color helpers
├── tests/
│   ├── network.test.ts
│   ├── tx.test.ts
│   ├── address.test.ts
│   ├── validators.test.ts
│   ├── client.test.ts
│   ├── format.test.ts
│   └── sentinel/
│       ├── rules.test.ts
│       ├── state.test.ts
│       ├── triggers/
│       │   ├── move_event.test.ts
│       │   └── balance_threshold.test.ts
│       └── notifiers/
│           ├── webhook.test.ts
│           └── stdout.test.ts
└── ...
```

## License

MIT — see [LICENSE](LICENSE).

