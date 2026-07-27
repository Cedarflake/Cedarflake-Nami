import GitHubProvider from "next-auth/providers/github";

import { bootstrapConfig } from "@i0c/config";

import { requireInstanceSecret } from "@/lib/configuration/instance-secret";

import {
  applyWebUiTokenAuthorization,
  canGitHubUserSignIn,
  getWebUiTokenAuthorization,
} from "./access-policy";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

type NextAuthHandler = typeof import("next-auth/next")["default"];
type AuthConfig = Parameters<NextAuthHandler>[2];

export const authOptions = {
  secret: requireInstanceSecret(),
  providers: [
    GitHubProvider({
      clientId: requireEnv("GITHUB_CLIENT_ID"),
      clientSecret: requireEnv("GITHUB_CLIENT_SECRET"),
      authorization: {
        params: {
          scope: bootstrapConfig.webui.githubOAuthScope
        }
      },
      httpOptions: {
        timeout: 10_000,
      }
    })
  ],
  session: {
    strategy: "jwt" as const
  },
  pages: {
    error: "/",
  },
  callbacks: {
    async signIn({ account }) {
      if (
        account?.provider !== "github" ||
        !await canGitHubUserSignIn(account.providerAccountId)
      ) {
        return "/access-denied";
      }

      return true;
    },
    async jwt({ token, account }) {
      if (account?.provider === "github") {
        token.githubUserId = account.providerAccountId;

        if (account.access_token) {
          token.accessToken = account.access_token;
        }
      }

      await applyWebUiTokenAuthorization(token);

      return token;
    },
    async session({ session, token }) {
      // IMPORTANT: Never expose OAuth access tokens to the browser.
      // Keep tokens only in the server-side JWT and read them in API routes via getToken().
      const authorization = await getWebUiTokenAuthorization(token);
      session.hasAccessToken = authorization.isAuthorized;
      session.isAuthorized = authorization.isAuthorized;
      session.isBlocked = authorization.isBlocked;
      return session;
    }
  }
} satisfies AuthConfig;
