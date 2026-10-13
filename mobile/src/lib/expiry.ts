export const DEFAULT_EXPIRY_SECONDS = 3600;
export const MAX_EXPIRY_SECONDS = 30 * 24 * 3600;
export const EXPIRY_OPTIONS = [
  { seconds: 3600, label: "1 hour" },
  { seconds: 21600, label: "6 hours" },
  { seconds: 86400, label: "1 day" },
  { seconds: 259200, label: "3 days" },
  { seconds: 604800, label: "7 days" },
  { seconds: 1209600, label: "14 days" },
  { seconds: 2592000, label: "1 month" },
];

export function uploadParameters(expiresIn: number): Record<string, string> {
  if (!isExpirySeconds(expiresIn))
    throw new Error("Choose a link lifetime between 1 hour and 30 days.");
  return expiresIn === DEFAULT_EXPIRY_SECONDS
    ? {}
    : { expires_in: String(expiresIn) };
}

export function isExpirySeconds(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= DEFAULT_EXPIRY_SECONDS &&
    value <= MAX_EXPIRY_SECONDS
  );
}
