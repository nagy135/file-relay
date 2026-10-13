# File Relay for Android

An Expo SDK 57 / React Native app using the existing relay API. The source is
in this subfolder; the Go service and web dashboard require no changes.

`src/screens/Dashboard.tsx` composes the screen. Its presentational sections live
in `src/components/dashboard/`, while `src/hooks/` owns settings initialization,
foreground polling, incoming shares, upload queue state, link actions, and
feedback. `src/lib/` separates domain types, connection validation, formatting,
file selection, secure persistence, shared-file caching, and HTTP transport.
Expo Router route files stay in `src/app/`; device effects stay out of UI components.

## Use it

1. Install `dist/file-relay-1.0.0.apk` on an Android phone (Android 7 or newer;
   ARM64 or ARMv7). The release APK includes its JavaScript bundle and works
   without Metro, Expo Go, or an Expo account.
2. In Files, Photos, or any other app, select one or more files and choose
   **Share → File Relay**.
3. Review the received files and tap **Upload files**. Each file gets its own
   public download link, with **Copy link** and **Share link** actions.
4. Open **Settings** and enter the same credentials used for `/dashboard` to
   see all active uploads. The public upload flow also works without signing in.

The dashboard includes active-file/storage totals, filename search, all four
sort orders, copy/share/download actions, pull to refresh, automatic refresh
every 15 seconds while active, and live expiry bars. Expired files disappear
locally at their expiry time. Time is synchronized with the server's `now`;
each file's actual `uploaded_at`/`expires_at` determines its lifetime.

## How receiving shares works

The `expo-sharing` config plugin adds Android manifest intent filters for
`android.intent.action.SEND` and `SEND_MULTIPLE`, both accepting `*/*` MIME
types. Android then offers **File Relay** in the system share sheet. The
generated activity uses `singleTask`, so a new share reaches the existing app
as well as launching a closed app. Expo handles the native intent and
`useIncomingShare()` exposes its payloads to React Native. Expo Router sends
incoming share deep links to the dashboard; a link listener also refreshes the
payload when the app is already open.

`scripts/patch-sharing.mjs` applies a small SDK 57 compatibility fix on install:
`text/plain` attachments are handled as files, and the resolver returns original
URIs without first copying unchecked files into a shared cache path. This also
avoids collisions between files with identical names. Only `expo-sharing` is
compiled from source so the APK includes this fix; other Expo modules keep
their normal build behavior. The patch fails explicitly if a future upgrade
changes the code it depends on.

Android gives temporary read access to shared `content://` URIs. The app copies
each original URI into a unique private cache directory, preserving the original
filename and handling identical filenames independently. This does not require
permission to browse the user's storage. There is no file picker in this app.

Uploads use Expo FileSystem's native multipart upload task, exactly one `file`
field per POST to `/upload`, with progress reporting. Multiple received files
upload sequentially. Sizes are checked against 200,000,000 bytes before upload;
the server enforces the same limit. Successful and removed queue items have
their private cached copies deleted. Pending queues are session-only; leftover
private queue copies are cleared on a fresh launch. Keep the app open until
the upload finishes. Network failures with uncertain completion require
checking the dashboard before explicitly sending another copy.

Settings are encrypted using Expo SecureStore. The APK contains no dashboard
credentials. `/api/files` uses HTTP Basic authentication; uploads and download
links remain public. The default server is `https://relay.infiniter.tech`.
HTTPS is required except for localhost/private IPv4 addresses for development.
Incoming sharing uses native code and needs an installed build; Expo Go cannot
register this app as a share target. This APK targets Android. iOS sharing has
not been configured or built.

References: [Expo incoming sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/),
[native file uploads](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/),
[local release builds](https://docs.expo.dev/guides/local-app-production/).

## Develop and build locally

Install Node 22.13 or newer, Java 17, and the Android SDK (API 36, build tools
36.0.0, NDK 27.1.12297006). Set `JAVA_HOME` and `ANDROID_HOME` if necessary.

```sh
cd mobile
npm ci
npm run typecheck
npm run lint
npm test
npx expo-doctor
npm run android
```

Build a standalone signed release APK without EAS or a cloud account:

```sh
npm run build:apk
```

The build script runs Expo prebuild and Gradle `assembleRelease`, with ARM64
and ARMv7 native libraries. The generated `android/` folder and `dist/` outputs
are ignored by Git. Native signing is configured by a repeatable config plugin.

A signing key and random password are generated on the first build under
`~/.config/file-relay-mobile/` (override with `FILE_RELAY_SIGNING_DIR`). Keep
`release.keystore` and `signing.json` backed up privately: subsequent APKs
must use the same key to update an installed app. No signing secrets are
stored in this repository or included in the APK.

Regenerate the code-drawn app icons with `node scripts/generate-icons.mjs`.

## Verification

The release APK was installed in an Android 16 ARM64 emulator and tested with
the repository's Go relay using isolated temporary storage and dummy credentials.
Dashboard sign-in and stored credentials, cold-start single `.txt` sharing,
multiple-file sharing from Android Files, upload completion, and storage totals
were checked. Downloaded test files matched the original bytes. Type checking,
lint, the five logic tests, all 21 Expo Doctor checks, and APK signature
verification passed. The APK's manifest includes no storage permissions.
