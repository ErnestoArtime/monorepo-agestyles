// Shared packages (packages/**) must use this app's copies of React, React Native, Expo Router
// and the other native libraries. pnpm can give a workspace package its own copy (another set
// of peers), and two copies of a router or React break the app. So third-party imports made
// from a shared package are resolved as if the app had made them (AG-31).
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { getDefaultConfig } = createRequire(import.meta.url)("expo/metro-config");

const config = getDefaultConfig(__dirname);
const packagesDir = path.resolve(__dirname, "../../packages") + path.sep;
const appOrigin = path.join(__dirname, "package.json");
const appDependencies = new Set(
  Object.keys(createRequire(import.meta.url)("./package.json").dependencies ?? {}).filter(
    (name) => !name.startsWith("@agestyles/"),
  ),
);
const packageName = (request) =>
  request.startsWith("@") ? request.split("/").slice(0, 2).join("/") : request.split("/")[0];
// Only libraries this app depends on; a package's own dependencies resolve normally.
const isAppLibrary = (request) =>
  !request.startsWith(".") && !request.startsWith("/") && appDependencies.has(packageName(request));

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromSharedPackage = context.originModulePath.startsWith(packagesDir);
  const target =
    fromSharedPackage && isAppLibrary(moduleName)
      ? { ...context, originModulePath: appOrigin }
      : context;
  return context.resolveRequest(target, moduleName, platform);
};

export default config;
