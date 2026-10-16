const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
    <application
        android:usesCleartextTraffic="true"
        tools:replace="android:usesCleartextTraffic" />
</manifest>
`;

const STRINGS = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="app_name">Manne Dev</string>
</resources>
`;

const DEBUG_BLOCK = `debug {
            applicationIdSuffix ".dev"
            signingConfig signingConfigs.debug`;

/** Le build debug est une seconde appli : HTTP local, identifiant et nom à part. Le release ne change pas. */
function withDebugApp(config) {
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') return config;
    if (!config.modResults.contents.includes('applicationIdSuffix')) {
      config.modResults.contents = config.modResults.contents.replace(/debug \{\s*signingConfig signingConfigs\.debug/, DEBUG_BLOCK);
    }
    return config;
  });
  return withDangerousMod(config, [
    'android',
    (config) => {
      const dir = path.join(config.modRequest.platformProjectRoot, 'app/src/debug');
      fs.mkdirSync(path.join(dir, 'res/values'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'AndroidManifest.xml'), MANIFEST);
      fs.writeFileSync(path.join(dir, 'res/values/strings.xml'), STRINGS);
      return config;
    },
  ]);
}

module.exports = withDebugApp;
