import { NotificationInbox } from "@agestyles/features-notifications";
import { Redirect, useRouter, type Href } from "expo-router";
import { ScreenFrame } from "../components/screen-frame";
import { useBusiness } from "../context/business-context";
import { routeForTarget } from "../lib/notifications";

export default function NotificationsScreen() {
  const router = useRouter();
  const { seller, ready } = useBusiness();
  // Wait for the stored session to be read: a page reload must not bounce to the start screen.
  if (!ready) return null;
  if (!seller) return <Redirect href="/" />;
  return (
    <ScreenFrame title="Notificaciones">
      <NotificationInbox
        onOpenTarget={(target) => {
          const route = routeForTarget(target);
          if (route) router.push(route as Href);
        }}
      />
    </ScreenFrame>
  );
}
