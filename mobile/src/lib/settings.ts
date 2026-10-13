import { normalizeBaseUrl } from "./connection.ts";
import { DEFAULT_EXPIRY_SECONDS, isExpirySeconds } from "./expiry.ts";
import type { Settings } from "./types";

export function decodeSettings(value: unknown): Settings {
  if (!value || typeof value !== "object")
    throw new Error("Saved settings could not be read. Enter them again.");
  const saved = value as Record<string, unknown>;
  if (
    typeof saved.username !== "string" ||
    typeof saved.password !== "string" ||
    typeof saved.baseUrl !== "string"
  )
    throw new Error("Saved settings could not be read. Enter them again.");
  return {
    baseUrl: normalizeBaseUrl(saved.baseUrl),
    username: saved.username,
    password: saved.password,
    // Older installed versions have no preference; preserve their credentials.
    defaultExpirySeconds: isExpirySeconds(saved.defaultExpirySeconds)
      ? saved.defaultExpirySeconds
      : DEFAULT_EXPIRY_SECONDS,
  };
}
