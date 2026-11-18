import {
  registerPushDevice,
  removePushDevice,
  type Fetcher,
  type NotificationScope,
  type NotificationTarget,
  markNotificationsRead,
} from "@agestyles/api-client/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useNotifications } from "./provider";

export type AppName = "buyer" | "business";

/**
 * - unsupported: web, or Android inside Expo Go (remote push needs a development build)
 * - unconfigured: the build has no EAS project id, so Expo cannot issue a token
 * - denied / undetermined: the person has not allowed notifications (yet)
 * - granted: allowed, but this device is not registered with the server yet
 * - registered: this device receives push for the signed-in account
 */
export type PushStatus =
  | "checking"
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "undetermined"
  | "granted"
  | "registered";

const deviceKey = (scope: NotificationScope) => `agestyles.push.device.${scope}`;

type NotificationsModule = typeof import("expo-notifications");

function pushSupported(): boolean {
  if (Platform.OS === "web") return false;
  return !(
    Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}

function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

let handlersReady = false;
/** The last response survives until the app restarts, so each tap is opened only once. */
const handledResponses = new Set<string>();

/** Loaded on demand so web builds and Expo Go never touch the native module needlessly. */
async function notificationsModule(): Promise<NotificationsModule> {
  const Notifications = await import("expo-notifications");
  if (!handlersReady) {
    handlersReady = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "AgeStyles",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return Notifications;
}

async function registerToken(
  fetcher: Fetcher,
  scope: NotificationScope,
  app: AppName,
  Notifications: NotificationsModule,
): Promise<boolean> {
  const projectId = easProjectId();
  if (!projectId) return false;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { device } = await registerPushDevice(fetcher, scope, {
    token,
    app,
    platform: Platform.OS === "ios" ? "ios" : "android",
    appVersion: Constants.expoConfig?.version,
  });
  await AsyncStorage.setItem(deviceKey(scope), device.id);
  return true;
}

/** Call before the session is dropped (sign out): the server stops pushing to this device. */
export async function unregisterThisDevice(
  fetcher: Fetcher,
  scope: NotificationScope,
): Promise<void> {
  const id = await AsyncStorage.getItem(deviceKey(scope));
  if (!id) return;
  try {
    await removePushDevice(fetcher, scope, id);
  } catch {
    // An already removed or unreachable device is harmless: the server revokes dead tokens.
  }
  await AsyncStorage.removeItem(deviceKey(scope));
}

/**
 * Permission and registration state for this device. With the permission already granted it
 * registers silently; otherwise `enable()` asks, ideally from a screen that explains why.
 */
export function usePushRegistration(app: AppName) {
  const { fetcher, scope } = useNotifications();
  const [status, setStatus] = useState<PushStatus>("checking");
  const [busy, setBusy] = useState(false);
  const latestFetcher = useRef(fetcher);
  latestFetcher.current = fetcher;

  const sync = useCallback(
    async (request: boolean) => {
      if (!pushSupported()) return setStatus("unsupported");
      if (!easProjectId()) return setStatus("unconfigured");
      try {
        const Notifications = await notificationsModule();
        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted && request && permission.canAskAgain) {
          permission = await Notifications.requestPermissionsAsync();
        }
        if (!permission.granted) {
          return setStatus(permission.canAskAgain ? "undetermined" : "denied");
        }
        const registered = await registerToken(latestFetcher.current, scope, app, Notifications);
        setStatus(registered ? "registered" : "unconfigured");
      } catch {
        setStatus("granted");
      }
    },
    [app, scope],
  );

  useEffect(() => {
    void sync(false);
  }, [sync]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      await sync(true);
    } finally {
      setBusy(false);
    }
  }, [sync]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await unregisterThisDevice(latestFetcher.current, scope);
      setStatus("granted");
    } finally {
      setBusy(false);
    }
  }, [scope]);

  return { status, busy, enable, disable };
}

/** Render once inside the provider: registers this device when the permission is already granted. */
export function PushRegistrar({ app }: { app: AppName }) {
  usePushRegistration(app);
  return null;
}

/**
 * Tapping a push opens the matching screen, also when the app was closed. The entry is
 * marked as read on a best-effort basis.
 */
export function useNotificationTapHandler(onOpenTarget: (target: NotificationTarget) => void) {
  const { fetcher, scope } = useNotifications();
  const open = useRef(onOpenTarget);
  open.current = onOpenTarget;
  const latestFetcher = useRef(fetcher);
  latestFetcher.current = fetcher;

  useEffect(() => {
    if (!pushSupported()) return;
    let active = true;
    let subscription: { remove(): void } | undefined;

    const handle = (response: import("expo-notifications").NotificationResponse | null) => {
      if (!response || !active) return;
      const responseId = response.notification.request.identifier;
      if (handledResponses.has(responseId)) return;
      handledResponses.add(responseId);
      const data = response.notification.request.content.data as
        { notification_id?: string; target?: NotificationTarget } | undefined;
      if (data?.notification_id) {
        markNotificationsRead(latestFetcher.current, scope, { ids: [data.notification_id] }).catch(
          () => undefined,
        );
      }
      open.current(data?.target ?? null);
    };

    notificationsModule()
      .then(async (Notifications) => {
        if (!active) return;
        subscription = Notifications.addNotificationResponseReceivedListener(handle);
        handle(await Notifications.getLastNotificationResponseAsync());
      })
      .catch(() => undefined);

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [scope]);
}
