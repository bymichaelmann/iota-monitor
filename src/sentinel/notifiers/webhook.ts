import type { Alert } from "../types.js";

/**
 * Send an alert as an HTTP POST to a webhook URL.
 * The URL can be templated with alert fields using {{fieldName}} syntax.
 */
export async function notify(
  alert: Alert,
  config?: { url?: string; headers?: Record<string, string> },
): Promise<void> {
  if (!config?.url) {
    throw new Error("Webhook notifier requires a URL");
  }

  // Template the URL with alert fields
  let url = config.url;
  url = url.replace(/\{\{ruleId\}\}/g, encodeURIComponent(alert.ruleId));
  url = url.replace(/\{\{type\}\}/g, encodeURIComponent(alert.type));
  url = url.replace(/\{\{severity\}\}/g, encodeURIComponent(alert.severity));
  url = url.replace(/\{\{title\}\}/g, encodeURIComponent(alert.title));

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config.headers || {}),
  };

  const body = JSON.stringify({
    alert: {
      rule_id: alert.ruleId,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      data: alert.data,
      timestamp: alert.timestamp,
    },
  });

  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    throw new Error(`Webhook returned status ${response.status}: ${response.statusText}`);
  }
}
