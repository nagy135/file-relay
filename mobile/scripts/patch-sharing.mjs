// Expo SDK 57's experimental receiver mistakes text/plain attachments for
// pasted text. Keep the fix repeatable across npm ci, and compile this module
// from source instead of using the unpatched prebuilt AAR.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const parsers = path.join(
  root,
  "node_modules/expo-sharing/android/src/main/java/expo/modules/sharing/dataParsers",
);
for (const name of [
  "SimpleShareIntentDataParser.kt",
  "ResolvingShareIntentDataParser.kt",
]) {
  const target = path.join(parsers, name);
  let source = readFileSync(target, "utf8");
  const original = 'return if (type == "text/plain") {';
  const replacement =
    'return if (type == "text/plain" && !intent.hasExtra(Intent.EXTRA_STREAM)) {';
  if (!source.includes(original) && !source.includes(replacement))
    throw new Error(
      `Review the incoming-sharing compatibility patch for ${name} after upgrading Expo.`,
    );
  source = source.replace(original, replacement);
  if (name === "ResolvingShareIntentDataParser.kt") {
    // The app owns cache copies and checks size before copying. Keeping the
    // original URI avoids duplicate-name collisions and unbounded native copies.
    const start = source.indexOf("      // Copy to cache dir to ensure access");
    if (start >= 0) {
      const end = source.indexOf(
        "      return ResolvedSharePayload().apply {",
        start,
      );
      if (end < 0)
        throw new Error(
          "Review the incoming-sharing cache patch after upgrading Expo.",
        );
      source = source.slice(0, start) + source.slice(end);
    }
    source = source.replace(
      "contentUri = file.toURI().toString()",
      "contentUri = uri.toString()",
    );
    if (!source.includes("contentUri = uri.toString()"))
      throw new Error(
        "Review the incoming-sharing URI patch after upgrading Expo.",
      );
  }
  writeFileSync(target, source);
}
