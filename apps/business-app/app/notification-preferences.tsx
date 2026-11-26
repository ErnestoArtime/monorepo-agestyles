import { NotificationPreferences } from "@agestyles/features-notifications";
import { Redirect } from "expo-router";
import { ScrollView } from "react-native";
import { ScreenFrame } from "../components/screen-frame";
import { useBusiness } from "../context/business-context";

export default function NotificationPreferencesScreen() {
  const { seller } = useBusiness();
  if (!seller) return <Redirect href="/" />;
  return (
    <ScreenFrame title="Avisos">
      <ScrollView keyboardShouldPersistTaps="handled">
        <NotificationPreferences app="business" />
      </ScrollView>
    </ScreenFrame>
  );
}
