const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withLocalSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let source = config.modResults.contents;
    if (!source.includes("signingConfigs {"))
      throw new Error(
        "Could not configure APK signing: unsupported Gradle template.",
      );
    if (!source.includes("relayRelease {")) {
      source = source.replace(
        "signingConfigs {",
        `signingConfigs {
        relayRelease {
            if (System.getenv("FILE_RELAY_STORE_FILE")) {
                storeFile file(System.getenv("FILE_RELAY_STORE_FILE"))
                storePassword System.getenv("FILE_RELAY_STORE_PASSWORD")
                keyAlias "file-relay"
                keyPassword System.getenv("FILE_RELAY_STORE_PASSWORD")
            }
        }`,
      );
    }
    source = source.replace(
      /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig signingConfigs.relayRelease",
    );
    if (!source.includes("signingConfig signingConfigs.relayRelease"))
      throw new Error("Could not configure the release signing block.");
    config.modResults.contents = source;
    return config;
  });
};
