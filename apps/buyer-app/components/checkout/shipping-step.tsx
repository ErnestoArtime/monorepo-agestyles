import { Loading } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatPrice } from "@/lib/format-price";
import type { ShippingOptions } from "@agestyles/api-client/store";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ShippingStepProps {
  shippingOptions: ShippingOptions;
  selectedShipping: Record<string, string>;
  shippingComplete: boolean;
  currencyCode?: string;
  loading: boolean;
  onSelectOption: (sellerId: string, optionId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ShippingStep({
  shippingOptions,
  selectedShipping,
  shippingComplete,
  currencyCode,
  loading,
  onSelectOption,
  onBack,
  onNext,
}: ShippingStepProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.contentWrapper}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Seleccionar envío para cada vendedor
          </Text>
          {loading ? (
            <Loading />
          ) : Object.keys(shippingOptions).length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.icon }]}>
              No hay opciones de envío disponibles
            </Text>
          ) : (
            Object.entries(shippingOptions).map(([sellerId, options]) => (
              <View key={sellerId} accessibilityRole="radiogroup">
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  {options[0]?.seller?.name || "Seller"}
                </Text>
                {options.map((option) => {
                  const selected = selectedShipping[sellerId] === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      style={[
                        styles.optionCard,
                        {
                          backgroundColor: selected ? colors.tint + "20" : "transparent",
                          borderColor: selected ? colors.tint : colors.icon + "30",
                        },
                      ]}
                      onPress={() => onSelectOption(sellerId, option.id)}
                    >
                      <View style={styles.optionInfo}>
                        <Text
                          style={[
                            styles.optionTitle,
                            { color: selected ? colors.tint : colors.text },
                          ]}
                        >
                          {option.name}
                        </Text>
                        <Text style={[styles.optionPrice, { color: colors.text }]}>
                          {formatPrice(option.amount, currencyCode)}
                        </Text>
                      </View>
                      {selected && <Text style={{ color: colors.tint, fontSize: 20 }}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.buttonContainer,
          { backgroundColor: colors.background, borderTopColor: colors.icon + "30" },
        ]}
      >
        <View style={styles.buttonRow}>
          <Button title="Atrás" variant="secondary" onPress={onBack} style={styles.halfButton} />
          <Button
            title="Continuar"
            onPress={onNext}
            loading={loading}
            disabled={!shippingComplete}
            style={styles.halfButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  optionPrice: {
    fontSize: 14,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    padding: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  halfButton: {
    flex: 1,
  },
});
