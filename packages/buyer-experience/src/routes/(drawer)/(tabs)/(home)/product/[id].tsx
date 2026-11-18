import { ProductDetail } from "../../../../../components/product-detail";
import { useLocalSearchParams, useNavigation } from "expo-router";
import React, { useCallback, useEffect } from "react";

/** Product page for shared links; the catalog opens the same detail in a bottom sheet. */
export default function ProductDetailsScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const navigation = useNavigation();

  useEffect(() => {
    if (title) navigation.setOptions({ title });
  }, [navigation, title]);

  const onTitle = useCallback(
    (productTitle: string) => navigation.setOptions({ title: productTitle }),
    [navigation],
  );

  return <ProductDetail productId={id} layout="screen" onTitle={onTitle} />;
}
