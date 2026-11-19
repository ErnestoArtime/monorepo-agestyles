import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";
import { buyerPath } from "../../../config";

/**
 * `/` also matches the home group: keep the query (`?filtro=novedades`, a category, a
 * store…) so shared and reloaded links open the same listing.
 */
const MainScreen = () => {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: buyerPath("/(drawer)/(tabs)/(home)"), params } as never} />;
};

export default MainScreen;
