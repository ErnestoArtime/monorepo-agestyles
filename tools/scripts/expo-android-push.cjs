const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

module.exports = function configureAndroidPush(config, appDir, app) {
  const projectVariable = `AGESTYLES_${app}_EAS_PROJECT_ID`;
  const fileVariable = `AGESTYLES_${app}_GOOGLE_SERVICES_FILE`;
  const projectId = process.env[projectVariable]?.trim();
  const firebasePath = process.env[fileVariable]?.trim();
  if (!projectId && !firebasePath) return config;

  if (!projectId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(projectId)) {
    throw new Error(`Set ${projectVariable} to the Expo project UUID.`);
  }
  if (!firebasePath) throw new Error(`Set ${fileVariable} to the Android Firebase client JSON.`);

  const googleServicesFile = resolve(appDir, firebasePath);
  let firebase;
  try {
    firebase = JSON.parse(readFileSync(googleServicesFile, "utf8"));
  } catch {
    throw new Error(`Cannot read the Android Firebase client JSON in ${fileVariable}.`);
  }
  if (
    !Array.isArray(firebase?.client) ||
    !firebase.client.some(
      (client) =>
        client?.client_info?.android_client_info?.package_name === config.android?.package,
    )
  ) {
    throw new Error(
      `The Firebase client JSON must contain Android package ${config.android?.package}.`,
    );
  }

  return {
    ...config,
    android: { ...config.android, googleServicesFile },
    extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } },
  };
};
