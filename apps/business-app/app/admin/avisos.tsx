import { NotificationInbox, NotificationsProvider } from "@agestyles/features-notifications";
import { useRouter, type Href } from "expo-router";
import { useMemo } from "react";
import { ScreenFrame } from "../../components/screen-frame";
import { useAdmin } from "../../context/admin-context";
import { routeForTarget, toFetcher } from "../../lib/notifications";

/**
 * Administración → «Avisos» (AG-40): stores waiting for approval, products to review,
 * payment proofs to verify and category requests, with the same inbox as the stores.
 */
export default function AdminNotificationsScreen() {
  const router = useRouter();
  const { admin, adminRequest } = useAdmin();
  const fetcher = useMemo(() => toFetcher(adminRequest), [adminRequest]);
  return (
    <NotificationsProvider
      scope="admin"
      fetcher={fetcher}
      enabled={Boolean(admin)}
      identity={admin?.id ?? ""}
    >
      <ScreenFrame backLabel="Volver">
        <NotificationInbox
          onOpenTarget={(target) => {
            const route = routeForTarget(target);
            if (route) router.push(route as Href);
          }}
        />
      </ScreenFrame>
    </NotificationsProvider>
  );
}
