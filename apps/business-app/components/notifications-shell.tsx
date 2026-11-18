import {
  NotificationsProvider,
  PushRegistrar,
  useNotificationTapHandler,
} from "@agestyles/features-notifications";
import { useRouter, type Href } from "expo-router";
import { useCallback, useMemo, type ReactNode } from "react";
import { useBusiness } from "../context/business-context";
import { routeForTarget, toFetcher } from "../lib/notifications";

function PushAndTaps() {
  const router = useRouter();
  const open = useCallback(
    (target: Parameters<typeof routeForTarget>[0]) => {
      // Deferred so a tap that cold-starts the app lands after the navigator has mounted.
      setTimeout(() => router.push((routeForTarget(target) ?? "/notifications") as Href), 0);
    },
    [router],
  );
  useNotificationTapHandler(open);
  return <PushRegistrar app="business" />;
}

/**
 * Notifications of the selected store for every screen of the business session: the unread
 * count behind the bell, push registration and taps on a push. Nothing runs without a store
 * and a loaded member; changing store starts a fresh count.
 */
export function NotificationsShell({ children }: { children: ReactNode }) {
  const { request, seller, member } = useBusiness();
  const fetcher = useMemo(() => toFetcher(request), [request]);
  const enabled = Boolean(seller && member);
  return (
    <NotificationsProvider
      scope="vendor"
      fetcher={fetcher}
      enabled={enabled}
      identity={seller?.id ?? ""}
    >
      {enabled ? <PushAndTaps /> : null}
      {children}
    </NotificationsProvider>
  );
}
