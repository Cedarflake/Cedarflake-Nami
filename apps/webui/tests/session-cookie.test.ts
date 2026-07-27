import assert from "node:assert/strict";
import test from "node:test";

import { createAuthSessionCookie } from "../src/auth/session-cookie";

const firstSecret = "first-i0c-secret-0123456789abcdef";
const secondSecret = "second-i0c-secret-0123456789abcde";

test("keeps the session cookie name stable for the same secret", () => {
  assert.equal(
    createAuthSessionCookie(firstSecret, true).name,
    createAuthSessionCookie(firstSecret, true).name,
  );
});

test("changes the session cookie name when the secret rotates", () => {
  assert.notEqual(
    createAuthSessionCookie(firstSecret, true).name,
    createAuthSessionCookie(secondSecret, true).name,
  );
});

test("uses secure production cookie options", () => {
  const cookie = createAuthSessionCookie(firstSecret, true);

  assert.match(cookie.name, /^__Secure-i0c\.session-token\.[0-9a-f]{16}$/);
  assert.deepEqual(cookie.options, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: true,
  });
});

test("keeps local development cookies compatible with HTTP", () => {
  const cookie = createAuthSessionCookie(firstSecret, false);

  assert.match(cookie.name, /^i0c\.session-token\.[0-9a-f]{16}$/);
  assert.equal(cookie.options.secure, false);
});
