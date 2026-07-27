import { type NextRequest, NextResponse } from "next/server";

import {
  createRuntimeSnapshotEtag,
  matchesRuntimeSnapshotEtag,
  readRuntimeDataSnapshot,
} from "@/lib/data/runtime-snapshot";

const SUCCESS_CACHE_CONTROL =
  "public, max-age=0, s-maxage=30, stale-if-error=300";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const snapshot = await readRuntimeDataSnapshot();
    const etag = createRuntimeSnapshotEtag(snapshot.revision);
    const headers = {
      "Cache-Control": SUCCESS_CACHE_CONTROL,
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    };
    if (matchesRuntimeSnapshotEtag(request.headers.get("if-none-match"), etag)) {
      return new Response(null, { status: 304, headers });
    }
    return NextResponse.json(snapshot, { headers });
  } catch (error) {
    console.error("Failed to publish Runtime data snapshot", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Runtime data snapshot is temporarily unavailable" },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}
