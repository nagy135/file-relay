import type { Settings } from "./types";

export function normalizeBaseUrl(input: string): string {
  const url = new URL(input.trim());
  const local =
    /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
      url.hostname,
    );
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local))
    throw new Error(
      "Use an HTTPS relay URL. HTTP is allowed only for local development.",
    );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/+$/, "")
  )
    throw new Error(
      "Enter only the relay origin, for example https://relay.infiniter.tech.",
    );
  return url.origin;
}

export function basicAuth(settings: Settings): string {
  const utf8 = encodeURIComponent(
    `${settings.username}:${settings.password}`,
  ).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  return `Basic ${btoa(utf8)}`;
}
