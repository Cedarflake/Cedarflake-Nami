import {
  readAnalyticsIngestSecret,
  resolveAnalyticsSourceId,
} from "@/lib/analytics/configuration";
import { createPrivateAnalyticsJsonResponse } from "@/lib/analytics/api-response";
import { normalizeAnalyticsEvent } from "@/lib/analytics/event-normalization";
import { parseAnalyticsIngestRequest } from "@/lib/analytics/ingest-request";
import { scheduleAnalyticsRetention } from "@/lib/analytics/retention-scheduler";
import { getAnalyticsStore } from "@/lib/analytics/store";
import { getAuthoritativeDataConfig } from "@/lib/configuration/data-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ingestSecret = readAnalyticsIngestSecret();
  if (!ingestSecret) {
    return createPrivateAnalyticsJsonResponse(
      { error: "Analytics ingestion is not configured" },
      { status: 503 },
    );
  }

  const parsedRequest = await parseAnalyticsIngestRequest(request, ingestSecret);
  if (parsedRequest.status === "rejected") {
    return createPrivateAnalyticsJsonResponse(
      { error: parsedRequest.error },
      { status: parsedRequest.httpStatus },
    );
  }

  let sourceId: ReturnType<typeof resolveAnalyticsSourceId>;
  let store: Awaited<ReturnType<typeof getAnalyticsStore>>;
  try {
    const config = await getAuthoritativeDataConfig();
    sourceId = resolveAnalyticsSourceId(config);
    store = await getAnalyticsStore(config);
  } catch (error) {
    console.error("Failed to initialize analytics ingestion", error);
    return createPrivateAnalyticsJsonResponse(
      { error: "Analytics ingestion is not configured" },
      { status: 503 },
    );
  }
  if (!sourceId || !store?.configured) {
    return createPrivateAnalyticsJsonResponse(
      { error: "Analytics ingestion is not configured" },
      { status: 503 },
    );
  }

  const event = normalizeAnalyticsEvent(parsedRequest.event, sourceId);

  if (event.sourceId !== sourceId) {
    return createPrivateAnalyticsJsonResponse(
      { error: "Analytics source is not allowed" },
      { status: 403 },
    );
  }

  try {
    const result = await store.ingest(event);
    scheduleAnalyticsRetention(store);
    return createPrivateAnalyticsJsonResponse(
      { accepted: true, duplicate: result.isDuplicate },
      { status: 202 },
    );
  } catch (error) {
    console.error("Failed to ingest analytics event", error);
    return createPrivateAnalyticsJsonResponse(
      { error: "Analytics event could not be stored" },
      { status: 500 },
    );
  }
}
