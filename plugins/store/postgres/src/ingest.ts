import type {
  CanonicalAnalyticsEvent,
  CanonicalAnalyticsLinkEvent,
} from "@i0c/analytics-domain/events"
import type { PostgresTransactionSql } from "@i0c/database-postgres"

import { getDatabase } from "./database";

export interface AnalyticsIngestResult {
  isDuplicate: boolean;
}

export async function ingestAnalyticsEvent(
  event: CanonicalAnalyticsEvent,
): Promise<AnalyticsIngestResult> {
  const sql = getDatabase();

  const isInserted = await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO analytics_source (source_id)
      VALUES (${event.sourceId})
      ON CONFLICT (source_id) DO NOTHING
    `;

    if (event.eventKind === "runtime") {
      const inserted = await transaction<{ event_id: string }[]>`
        INSERT INTO runtime_event (
          event_id,
          schema_version,
          source_id,
          occurred_at,
          entry_domain,
          provider,
          status_code,
          resource_class,
          match_kind,
          match_outcome,
          traffic_class,
          bot_category,
          bot_confidence,
          classifier_version,
          device_type,
          country_code,
          probe_category,
          sample_rate,
          latency_ms
        )
        VALUES (
          ${event.eventId},
          ${event.schemaVersion},
          ${event.sourceId},
          ${event.occurredAt},
          ${event.entryDomain},
          ${event.provider},
          ${event.statusCode},
          ${event.resourceClass},
          ${event.matchKind},
          ${event.matchOutcome},
          ${event.trafficClass},
          ${event.botCategory},
          ${event.botConfidence},
          ${event.classifierVersion},
          ${event.deviceType},
          ${event.countryCode},
          ${event.probeCategory},
          ${event.sampleRate},
          ${event.latencyMs}
        )
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
      `;

      return inserted.length > 0;
    }

    return ingestLinkEvent(transaction, event);
  });

  return { isDuplicate: !isInserted };
}

async function ingestLinkEvent(
  transaction: PostgresTransactionSql,
  event: CanonicalAnalyticsLinkEvent,
): Promise<boolean> {
  await transaction`
    INSERT INTO analytics_link (
      source_id,
      analytics_id,
      route_path,
      link_type,
      first_seen_at,
      last_seen_at
    )
    VALUES (
      ${event.sourceId},
      ${event.analyticsId},
      ${event.routePath},
      ${event.linkType},
      ${event.occurredAt},
      ${event.occurredAt}
    )
    ON CONFLICT (source_id, analytics_id) DO UPDATE
    SET route_path = CASE
          WHEN EXCLUDED.last_seen_at >= analytics_link.last_seen_at
            THEN EXCLUDED.route_path
          ELSE analytics_link.route_path
        END,
        link_type = CASE
          WHEN EXCLUDED.last_seen_at >= analytics_link.last_seen_at
            THEN EXCLUDED.link_type
          ELSE analytics_link.link_type
        END,
        first_seen_at = LEAST(analytics_link.first_seen_at, EXCLUDED.first_seen_at),
        last_seen_at = GREATEST(analytics_link.last_seen_at, EXCLUDED.last_seen_at)
  `;

  let isEntry = true;
  let didCreateUpstreamClaim = false;
  if (
    event.upstreamEventId
    && event.upstreamAnalyticsId
    && event.upstreamEntryDomain
    && event.upstreamProvider
  ) {
    const claimed = await transaction<{ upstream_event_id: string }[]>`
      INSERT INTO analytics_upstream_claim (
        source_id,
        upstream_event_id,
        downstream_event_id,
        upstream_analytics_id,
        upstream_entry_domain,
        upstream_provider
      )
      VALUES (
        ${event.sourceId},
        ${event.upstreamEventId},
        ${event.eventId},
        ${event.upstreamAnalyticsId},
        ${event.upstreamEntryDomain},
        ${event.upstreamProvider}
      )
      ON CONFLICT DO NOTHING
      RETURNING upstream_event_id
    `;
    didCreateUpstreamClaim = claimed.length > 0;

    const [claim] = await transaction<{ downstream_event_id: string }[]>`
      SELECT downstream_event_id
      FROM analytics_upstream_claim
      WHERE source_id = ${event.sourceId}
        AND upstream_event_id = ${event.upstreamEventId}
      LIMIT 1
    `;

    isEntry = claim?.downstream_event_id !== event.eventId;
    if (!isEntry) {
      await transaction`
        UPDATE analytics_upstream_claim
        SET last_seen_at = NOW()
        WHERE source_id = ${event.sourceId}
          AND upstream_event_id = ${event.upstreamEventId}
          AND downstream_event_id = ${event.eventId}
      `;
    }
  }

  const inserted = await transaction<{ event_id: string }[]>`
    INSERT INTO access_event (
      event_id,
      source_id,
      analytics_id,
      occurred_at,
      route_path,
      link_type,
      provider,
      request_class,
      outcome,
      status_code,
      is_bot,
      is_preview,
      device_type,
      country_code,
      referrer_domain,
      latency_ms,
      schema_version,
      entry_domain,
      campaign_id,
      upstream_event_id,
      upstream_analytics_id,
      upstream_entry_domain,
      upstream_provider,
      is_entry,
      resource_class,
      match_kind,
      traffic_class,
      bot_category,
      bot_confidence,
      classifier_version,
      sample_rate,
      probe_category
    )
    VALUES (
      ${event.eventId},
      ${event.sourceId},
      ${event.analyticsId},
      ${event.occurredAt},
      ${event.routePath},
      ${event.linkType},
      ${event.provider},
      ${event.legacyRequestClass},
      'matched',
      ${event.statusCode},
      ${event.legacyIsBot},
      ${event.legacyIsPreview},
      ${event.deviceType},
      ${event.countryCode},
      ${event.referrerDomain},
      ${event.latencyMs},
      ${event.schemaVersion},
      ${event.entryDomain},
      ${event.campaignId},
      ${event.upstreamEventId},
      ${event.upstreamAnalyticsId},
      ${event.upstreamEntryDomain},
      ${event.upstreamProvider},
      ${isEntry},
      ${event.resourceClass},
      ${event.matchKind},
      ${event.trafficClass},
      ${event.botCategory},
      ${event.botConfidence},
      ${event.classifierVersion},
      ${event.sampleRate},
      ${event.probeCategory}
    )
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id
  `;

  if (inserted.length === 0) {
    if (didCreateUpstreamClaim && event.upstreamEventId) {
      await transaction`
        DELETE FROM analytics_upstream_claim
        WHERE source_id = ${event.sourceId}
          AND upstream_event_id = ${event.upstreamEventId}
          AND downstream_event_id = ${event.eventId}
      `;
    }
    return false;
  }

  return true;
}
