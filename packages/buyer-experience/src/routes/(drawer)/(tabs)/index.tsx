import { Redirect } from "expo-router";
import React from "react";
import { buyerHref } from "../../../config";

const MainScreen = () => {
  return <Redirect href={buyerHref("/(drawer)/(tabs)/(home)")} />;
};

export default MainScreen;
