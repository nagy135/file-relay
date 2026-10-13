import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(homedir(), "Library/Android/sdk");
if (!existsSync(sdk))
  throw new Error(
    "Install an Android SDK and set ANDROID_HOME before building.",
  );
const keyDirectory =
  process.env.FILE_RELAY_SIGNING_DIR ||
  path.join(homedir(), ".config/file-relay-mobile");
mkdirSync(keyDirectory, { recursive: true, mode: 0o700 });
const credentialsPath = path.join(keyDirectory, "signing.json");
const keystore = path.join(keyDirectory, "release.keystore");
if (!existsSync(credentialsPath)) {
  if (existsSync(keystore))
    throw new Error(
      "The signing password is missing. Restore signing.json before rebuilding.",
    );
  writeFileSync(
    credentialsPath,
    JSON.stringify({ password: randomBytes(32).toString("hex") }),
    { mode: 0o600 },
  );
}
const { password } = JSON.parse(readFileSync(credentialsPath, "utf8"));
const env = {
  ...process.env,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
  FILE_RELAY_STORE_FILE: keystore,
  FILE_RELAY_STORE_PASSWORD: password,
  NODE_ENV: "production",
};
if (!existsSync(keystore)) {
  const result = spawnSync(
    "keytool",
    [
      "-genkeypair",
      "-keystore",
      keystore,
      "-storetype",
      "PKCS12",
      "-storepass:env",
      "FILE_RELAY_STORE_PASSWORD",
      "-keypass:env",
      "FILE_RELAY_STORE_PASSWORD",
      "-alias",
      "file-relay",
      "-keyalg",
      "RSA",
      "-keysize",
      "2048",
      "-validity",
      "10000",
      "-dname",
      "CN=File Relay, O=Personal, C=DE",
    ],
    { env, encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(
      `Signing key generation failed: ${result.stderr || result.error}`,
    );
}
chmodSync(keystore, 0o600);
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
run("npx", ["expo", "prebuild", "--platform", "android", "--no-install"]);
run(
  "./gradlew",
  [
    "assembleRelease",
    "--max-workers=4",
    "-PreactNativeArchitectures=arm64-v8a,armeabi-v7a",
  ],
  path.join(root, "android"),
);
const { expo } = JSON.parse(readFileSync(path.join(root, "app.json"), "utf8"));
const output = path.join(root, `dist/file-relay-${expo.version}.apk`);
mkdirSync(path.dirname(output), { recursive: true });
copyFileSync(
  path.join(root, "android/app/build/outputs/apk/release/app-release.apk"),
  output,
);
console.log(
  `APK: ${output}\nSHA256: ${createHash("sha256").update(readFileSync(output)).digest("hex")}`,
);
