/**
 * @file safety.ts
 * @description
 * [EN] Proxy target safety checks.
 * Rejects unsupported protocols and literal non-public network targets before every upstream hop.
 *
 * [CN] 反向代理目标安全检查。
 * 在每一次上游请求前拒绝不支持的协议和字面量形式的非公网网络目标。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

function isIPv4(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function isNonPublicIPv4(hostname: string): boolean {
  if (!isIPv4(hostname)) return false;
  const parts = hostname.split(".").map((part) => Number(part));
  if (
    parts.length !== 4
    || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [a, b, c] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return a >= 224;
}

function normalizeHostname(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.+$/u, "");
  return host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1)
    : host;
}

function isNonPublicIPv6(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host.includes(":")) return false;
  if (
    host.startsWith("::")
    || host.startsWith("64:ff9b:")
    || host.startsWith("100:")
    || host.startsWith("2001:db8:")
    || host.startsWith("2002:")
  ) {
    return true;
  }

  const firstHextet = Number.parseInt(host.split(":", 1)[0], 16);
  return (
    (firstHextet >= 0xfc00 && firstHextet <= 0xfdff)
    || (firstHextet >= 0xfe80 && firstHextet <= 0xfeff)
    || (firstHextet >= 0xff00 && firstHextet <= 0xffff)
  );
}

function isNonPublicProxyHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".localhost")) return true;
  return isNonPublicIPv4(host) || isNonPublicIPv6(host);
}

export function assertSafeProxyUrl(url: URL): void {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Unsupported proxy protocol: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error("Proxy targets must not contain credentials");
  }
  if (isNonPublicProxyHost(url.hostname)) {
    throw new Error(`Blocked proxy target host: ${url.hostname}`);
  }
}

export function isAllowedRedirectOrigin(
  candidate: URL,
  initialTarget: URL,
  allowedOrigins: readonly string[] | null
): boolean {
  if (allowedOrigins === null || candidate.origin === initialTarget.origin) {
    return true;
  }
  return allowedOrigins.includes(candidate.origin);
}
