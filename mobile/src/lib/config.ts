import type { Settings } from "./types";
import { DEFAULT_EXPIRY_SECONDS } from "./expiry";

export const MAX_FILE_SIZE = 200_000_000;
export const DEFAULT_URL = "https://relay.infiniter.tech";
export const DEFAULT_SETTINGS: Settings = {
  baseUrl: DEFAULT_URL,
  username: "",
  password: "",
  defaultExpirySeconds: DEFAULT_EXPIRY_SECONDS,
};

export const DASHBOARD_REFRESH_MS = 15_000;
export const CLOCK_TICK_MS = 1_000;
