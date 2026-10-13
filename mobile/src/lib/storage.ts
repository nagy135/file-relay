import * as SecureStore from "expo-secure-store";
import { DEFAULT_SETTINGS } from "./config";
import { decodeSettings } from "./settings";
import type { Settings } from "./types";

const KEY = "file-relay.settings.v1";
export async function readSettings(): Promise<Settings> {
  const saved = await SecureStore.getItemAsync(KEY);
  if (!saved) return DEFAULT_SETTINGS;
  return decodeSettings(JSON.parse(saved));
}
export async function writeSettings(settings: Settings) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(settings));
}
