import { createServer, type Server } from "node:http";

/** Prometheus metric counters/gauges */
const metricsState: {
  alertsTotal: Map<string, number>;
  pollDuration: Map<string, number>;
  rpcErrors: Map<string, number>;
} = {
  alertsTotal: new Map(),
  pollDuration: new Map(),
  rpcErrors: new Map(),
};

/**
 * Record an alert for metrics.
 */
export function recordAlert(ruleId: string, type: string): void {
  const key = `${ruleId}|${type}`;
  metricsState.alertsTotal.set(key, (metricsState.alertsTotal.get(key) || 0) + 1);
}

/**
 * Record a poll duration.
 */
export function recordPollDuration(ruleId: string, durationMs: number): void {
  metricsState.pollDuration.set(ruleId, durationMs / 1000);
}

/**
 * Record an RPC error.
 */
export function recordRpcError(ruleId: string): void {
  metricsState.rpcErrors.set(ruleId, (metricsState.rpcErrors.get(ruleId) || 0) + 1);
}

/**
 * Generate Prometheus metrics output.
 */
function generateMetrics(): string {
  const lines: string[] = [];

  // Comments
  lines.push("# HELP iota_alerts_total Total number of alerts fired per rule and type");
  lines.push("# TYPE iota_alerts_total counter");
  for (const [key, value] of metricsState.alertsTotal) {
    const [ruleId, type] = key.split("|");
    lines.push(`iota_alerts_total{rule_id="${escapeLabel(ruleId)}",type="${escapeLabel(type)}"} ${value}`);
  }

  lines.push("");
  lines.push("# HELP iota_poll_duration_seconds Duration of the last poll cycle per rule");
  lines.push("# TYPE iota_poll_duration_seconds gauge");
  for (const [ruleId, value] of metricsState.pollDuration) {
    lines.push(`iota_poll_duration_seconds{rule_id="${escapeLabel(ruleId)}"} ${value}`);
  }

  lines.push("");
  lines.push("# HELP iota_rpc_errors_total Total RPC errors per rule");
  lines.push("# TYPE iota_rpc_errors_total counter");
  for (const [ruleId, value] of metricsState.rpcErrors) {
    lines.push(`iota_rpc_errors_total{rule_id="${escapeLabel(ruleId)}"} ${value}`);
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Escape Prometheus label values.
 */
function escapeLabel(val: string): string {
  return val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Start a Prometheus metrics HTTP server on the given port.
 * Returns the server instance.
 */
export function startMetricsServer(port: number): Server {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(generateMetrics());
  });

  server.listen(port, () => {
    console.error(`[sentinel] Metrics server listening on http://0.0.0.0:${port}/metrics`);
  });

  server.on("error", (err) => {
    console.error(`[sentinel] Metrics server error: ${err.message}`);
  });

  return server;
}
