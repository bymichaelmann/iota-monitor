import type { IotaClient } from "@iota/iota-sdk/client";
import type { Rule } from "../../lib/rules.js";
import type { RuleState } from "../../lib/state.js";
import type { Alert } from "../types.js";

/**
 * Poll for new move events matching the rule's filter.
 * Supports filtering by: package+module, eventType, or sender.
 */
export async function poll(
  client: IotaClient,
  rule: Rule,
  state: RuleState,
): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Build the event query filter
  const queryFilter: Record<string, unknown> = {};
  const pkg = rule.params.package as string | undefined;
  const mod = rule.params.module as string | undefined;
  const eventType = rule.params.eventType as string | undefined;
  const sender = rule.params.sender as string | undefined;

  if (pkg && mod) {
    queryFilter.MoveModule = { package: pkg, module: mod };
  } else if (eventType) {
    queryFilter.MoveEventType = eventType;
  } else if (sender) {
    queryFilter.Sender = sender;
  } else {
    // Fallback: use MoveModule from params
    queryFilter.MoveModule = { package: pkg || "", module: mod || "" };
  }

  const cursor = state.lastCursor || undefined;

  try {
    const eventsPage = await client.queryEvents({
      query: queryFilter as any,
      cursor,
      order: "descending",
    });

    const events = eventsPage.data || [];
    if (events.length === 0) {
      return alerts;
    }

    // Update cursor to the first event's cursor (most recent)
    // Since we query descending, the first event is the newest
    let newCursor: string | null = null;
    if (eventsPage.nextCursor) {
      newCursor = eventsPage.nextCursor;
    } else if (events.length > 0 && (events[0] as any).id) {
      newCursor = (events[0] as any).id.txDigest || null;
    }

    // Only emit alerts if we have a previous cursor (avoid initial flood)
    if (state.lastCursor !== null) {
      // Events are newest first; we want to alert on each new event
      const seen = new Set<string>();
      for (const event of events) {
        const eventId = (event as any).id?.txDigest
          ? `${(event as any).id.txDigest}:${(event as any).id.eventSeq}`
          : JSON.stringify(event);
        if (seen.has(eventId)) continue;
        seen.add(eventId);

        alerts.push({
          ruleId: rule.id,
          type: "move_event",
          severity: "info",
          title: `New Move Event: ${rule.params.eventType || `${pkg}::${mod}`}`,
          message: `Event detected on ${rule.params.package || pkg}::${rule.params.module || mod}`,
          data: event,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update cursor
    if (newCursor) {
      state.lastCursor = newCursor;
    }
  } catch (err) {
    // If cursor becomes invalid, reset it
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("cursor") || message.includes("Invalid")) {
      state.lastCursor = null;
    }
  }

  return alerts;
}
