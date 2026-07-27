import { createHash } from "node:crypto";

interface AuthSessionCookie {
  name: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    path: "/";
    secure: boolean;
  };
}

export function createAuthSessionCookie(
  secret: string,
  isSecure: boolean,
): AuthSessionCookie {
  const fingerprint = createHash("sha256")
    .update(secret)
    .digest("hex")
    .slice(0, 16);
  const securePrefix = isSecure ? "__Secure-" : "";

  return {
    name: `${securePrefix}i0c.session-token.${fingerprint}`,
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecure,
    },
  };
}
