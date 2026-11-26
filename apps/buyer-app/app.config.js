import configureAndroidPush from "../../tools/scripts/expo-android-push.cjs";

export default ({ config }) => configureAndroidPush(config, __dirname, "BUYER");
