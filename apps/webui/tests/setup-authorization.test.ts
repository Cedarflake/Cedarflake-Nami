import assert from "node:assert/strict";
import test from "node:test";

import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";

import { createAuthSessionCookie } from "../src/auth/session-cookie";
import { getSetupTokenGitHubUserId } from "../src/auth/setup-token-authorization";

const instanceSecret = "nami-setup-authorization-test-secret";

test("reads setup authorization from the configured session cookie", async () => {
  const authSessionCookie = createAuthSessionCookie(instanceSecret, true);
  const sessionToken = await encode({
    secret: instanceSecret,
    token: {
      githubUserId: "10000001",
      sub: "10000001",
    },
  });
  const request = new NextRequest("https://u.example.com/api/setup/initialize", {
    headers: {
      cookie: `${authSessionCookie.name}=${sessionToken}`,
    },
  });

  assert.equal(
    await getSetupTokenGitHubUserId(
      request,
      instanceSecret,
      authSessionCookie.name,
    ),
    "10000001",
  );
});
