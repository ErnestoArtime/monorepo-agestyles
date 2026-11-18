import {
  listNotifications,
  type Fetcher,
  type NotificationScope,
} from "@agestyles/api-client/notifications";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

type NotificationsValue = {
  scope: NotificationScope;
  fetcher: Fetcher;
  unreadCount: number;
  /** Re-reads the unread count (cheap: one entry). */
  refreshUnread: () => Promise<void>;
  /** Lets the inbox keep the bell in step with what it just read or loaded. */
  setUnreadCount: (count: number) => void;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

/**
 * Keeps the unread count for the bell. It polls once a minute and whenever the app
 * comes back to the foreground; `identity` (for example the selected store) resets it.
 */
export function NotificationsProvider({
  scope,
  fetcher,
  enabled,
  identity = "",
  pollMs = 60_000,
  children,
}: {
  scope: NotificationScope;
  fetcher: Fetcher;
  enabled: boolean;
  identity?: string;
  pollMs?: number;
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const latestFetcher = useRef(fetcher);
  latestFetcher.current = fetcher;

  const refreshUnread = useCallback(async () => {
    if (!enabled) return;
    try {
      const page = await listNotifications(latestFetcher.current, scope, { limit: 1 });
      setUnreadCount(page.unread_count);
    } catch {
      // The bell keeps its last known count; the inbox itself reports errors.
    }
  }, [enabled, scope]);

  useEffect(() => {
    setUnreadCount(0);
    if (!enabled) return;
    void refreshUnread();
    const timer = setInterval(() => void refreshUnread(), pollMs);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshUnread();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [enabled, identity, pollMs, refreshUnread]);

  const value = useMemo<NotificationsValue>(
    () => ({ scope, fetcher, unreadCount, refreshUnread, setUnreadCount }),
    [scope, fetcher, unreadCount, refreshUnread],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications needs a NotificationsProvider.");
  return value;
}

/** For headers rendered where a provider may be absent (signed-out screens). */
export function useOptionalNotifications(): NotificationsValue | null {
  return useContext(NotificationsContext);
}
