import {
  NotificationsProvider,
  PushRegistrar,
  useNotificationTapHandler,
} from "@agestyles/features-notifications";
import type { ReactNode } from "react";

import { useCustomer } from "../context/customer-context";
import { openNotificationTarget } from "../lib/notification-target";
import { notificationsFetcher } from "../lib/notifications-fetcher";

function SessionNotifications() {
  useNotificationTapHandler((target) => openNotificationTarget(target, { fallbackToInbox: true }));
  return <PushRegistrar app="buyer" />;
}

/** Unread count, push registration and push taps, only while a customer is signed in. */
export function NotificationsLayer({ children }: { children: ReactNode }) {
  const { customer } = useCustomer();
  const signedIn = Boolean(customer);
  return (
    <NotificationsProvider
      scope="store"
      fetcher={notificationsFetcher}
      enabled={signedIn}
      identity={customer?.id ?? ""}
    >
      {signedIn ? <SessionNotifications /> : null}
      {children}
    </NotificationsProvider>
  );
}
