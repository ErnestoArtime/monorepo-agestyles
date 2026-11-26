import { AddressForm } from "./address-form";
import { AppSwitch } from "@agestyles/ui-native";
import { addressSummary, type SavedAddress } from "../../lib/addresses";
import { Button } from "../ui/button";
import { Colors } from "../../constants/theme";
import { useRegion } from "../../context/region-context";
import { useColorScheme } from "../../hooks/use-color-scheme";
import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface Address {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  postalCode: string;
  countryCode: string;
  phone: string;
}

interface DeliveryStepProps {
  email: string;
  shippingAddress: Address;
  billingAddress: Address;
  useSameForBilling: boolean;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onShippingAddressChange: (field: keyof Address, value: string) => void;
  onBillingAddressChange: (field: keyof Address, value: string) => void;
  onUseSameForBillingChange: (value: boolean) => void;
  onNext: () => void;
  /** Signed-in customer's saved addresses (AG-46); empty for guests. */
  savedAddresses?: SavedAddress[];
  onUseSavedAddress?: (saved: SavedAddress) => void;
  /** Offer to keep a new address in the account (only when it is not saved yet). */
  canSaveAddress?: boolean;
  saveAddress?: boolean;
  onSaveAddressChange?: (value: boolean) => void;
}

export function DeliveryStep({
  email,
  shippingAddress,
  billingAddress,
  useSameForBilling,
  loading,
  onEmailChange,
  onShippingAddressChange,
  onBillingAddressChange,
  onUseSameForBillingChange,
  onNext,
  savedAddresses = [],
  onUseSavedAddress,
  canSaveAddress,
  saveAddress,
  onSaveAddressChange,
}: DeliveryStepProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { selectedRegion } = useRegion();
  const scrollViewRef = useRef<ScrollView>(null);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const countries = selectedRegion?.countries || [];

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true),
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false),
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isKeyboardVisible && styles.scrollContentKeyboard,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={true}
        automaticallyAdjustKeyboardInsets={true}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Información de contacto</Text>

          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.icon + "30" }]}
            placeholder="Correo electrónico"
            placeholderTextColor={colors.icon}
            value={email}
            onChangeText={onEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>
            Dirección de envío
          </Text>

          {savedAddresses.length ? (
            <View style={styles.saved} accessibilityLabel="Tus direcciones guardadas">
              {savedAddresses.map((saved) => {
                const selected =
                  saved.address_1 === shippingAddress.address &&
                  saved.city === shippingAddress.city &&
                  (saved.first_name ?? "") === shippingAddress.firstName;
                return (
                  <Pressable
                    key={saved.id}
                    onPress={() => onUseSavedAddress?.(saved)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[
                      styles.savedItem,
                      {
                        borderColor: selected ? colors.tint : colors.border,
                        backgroundColor: colors.cardBackground,
                      },
                    ]}
                  >
                    <Text style={[styles.savedName, { color: colors.text }]}>
                      {saved.address_name || (saved.is_default_shipping ? "Principal" : "Guardada")}
                    </Text>
                    <Text style={{ color: colors.icon }} numberOfLines={2}>
                      {addressSummary(saved)}
                    </Text>
                  </Pressable>
                );
              })}
              <Text style={[styles.savedHint, { color: colors.icon }]}>
                Elige una o escribe otra debajo.
              </Text>
            </View>
          ) : null}

          <AddressForm
            firstName={shippingAddress.firstName}
            lastName={shippingAddress.lastName}
            address={shippingAddress.address}
            city={shippingAddress.city}
            postalCode={shippingAddress.postalCode}
            countryCode={shippingAddress.countryCode}
            phone={shippingAddress.phone}
            countries={countries}
            onFirstNameChange={(value) => onShippingAddressChange("firstName", value)}
            onLastNameChange={(value) => onShippingAddressChange("lastName", value)}
            onAddressChange={(value) => onShippingAddressChange("address", value)}
            onCityChange={(value) => onShippingAddressChange("city", value)}
            onPostalCodeChange={(value) => onShippingAddressChange("postalCode", value)}
            onCountryCodeChange={(value) => onShippingAddressChange("countryCode", value)}
            onPhoneChange={(value) => onShippingAddressChange("phone", value)}
          />

          {canSaveAddress ? (
            <View style={styles.switchContainer}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>
                Guardar esta dirección en mi cuenta
              </Text>
              <AppSwitch value={Boolean(saveAddress)} onValueChange={onSaveAddressChange} />
            </View>
          ) : null}

          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>
              Usar misma dirección para facturación
            </Text>
            <AppSwitch value={useSameForBilling} onValueChange={onUseSameForBillingChange} />
          </View>

          {!useSameForBilling && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>
                Dirección de facturación
              </Text>

              <AddressForm
                firstName={billingAddress.firstName}
                lastName={billingAddress.lastName}
                address={billingAddress.address}
                city={billingAddress.city}
                postalCode={billingAddress.postalCode}
                countryCode={billingAddress.countryCode}
                phone={billingAddress.phone}
                countries={countries}
                onFirstNameChange={(value) => onBillingAddressChange("firstName", value)}
                onLastNameChange={(value) => onBillingAddressChange("lastName", value)}
                onAddressChange={(value) => onBillingAddressChange("address", value)}
                onCityChange={(value) => onBillingAddressChange("city", value)}
                onPostalCodeChange={(value) => onBillingAddressChange("postalCode", value)}
                onCountryCodeChange={(value) => onBillingAddressChange("countryCode", value)}
                onPhoneChange={(value) => onBillingAddressChange("phone", value)}
              />
            </>
          )}
        </View>

        {/* Button moved inside ScrollView for consistent behavior */}
        <View style={[styles.buttonContainer, { backgroundColor: colors.background }]}>
          <Button title="Continuar" onPress={onNext} loading={loading} style={styles.button} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  saved: { gap: 8, marginBottom: 12 },
  savedItem: { borderWidth: 1.5, borderRadius: 10, padding: 12, gap: 2 },
  savedName: { fontSize: 15, fontWeight: "600" },
  savedHint: { fontSize: 13 },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  scrollContentKeyboard: {
    paddingBottom: Platform.OS === "ios" ? 300 : 320,
  },
  section: {
    padding: 20,
  },
  buttonContainer: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 16,
  },
  switchLabel: {
    fontSize: 16,
    flex: 1,
  },
  button: {
    marginTop: 8,
  },
});
