import * as SecureStore from "expo-secure-store";
import { DEFAULT_SETTINGS } from "./config";
import { normalizeBaseUrl } from "./connection";
import type { Settings } from "./types";

const KEY = "file-relay.settings.v1";
export async function readSettings(): Promise<Settings> {
  const saved = await SecureStore.getItemAsync(KEY);
  if (!saved) return DEFAULT_SETTINGS;
  const settings = JSON.parse(saved);
  if (
    typeof settings.username !== "string" ||
    typeof settings.password !== "string"
  )
    throw new Error("Saved settings could not be read. Enter them again.");
  return { ...settings, baseUrl: normalizeBaseUrl(settings.baseUrl) };
}
export async function writeSettings(settings: Settings) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(settings));
}
