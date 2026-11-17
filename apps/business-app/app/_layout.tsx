import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BusinessProvider } from "../context/business-context";

export default function RootLayout() {
  return <BusinessProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false }} /></BusinessProvider>;
}
