import { NextResponse } from "next/server";

import { getAppSetupState } from "@/lib/setup/setup-state";
import { isSetupSecretConfigured } from "@/lib/setup/setup-secret";

export async function GET() {
  try {
    return NextResponse.json(
      {
        secretConfigured: isSetupSecretConfigured(),
        setup: await getAppSetupState(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
