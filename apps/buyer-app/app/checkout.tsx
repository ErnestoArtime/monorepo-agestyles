import {
  completeCart,
  listShippingOptions,
  type ShippingOptions,
} from "@agestyles/api-client/store";
import { DeliveryStep } from "@/components/checkout/delivery-step";
import { PaymentStep } from "@/components/checkout/payment-step";
import { ShippingStep } from "@/components/checkout/shipping-step";
import { Colors } from "@/constants/theme";
import { useCart } from "@/context/cart-context";
import { useCustomer } from "@/context/customer-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { sdk } from "@/lib/sdk";
import { forgetAgentCode } from "@/lib/agent-code";
import { rememberOrderWhatsAppLinks, snapshotCartBySeller } from "@/lib/order-whatsapp";
import type { HttpTypes } from "@medusajs/types";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

type CheckoutStep = "delivery" | "shipping" | "payment";

const STEP_ORDER: CheckoutStep[] = ["delivery", "shipping", "payment"];

const STEP_LABELS: Record<CheckoutStep, string> = {
  delivery: "Entrega",
  shipping: "Envío",
  payment: "Pago",
};

export default function CheckoutScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { cart, refreshCart, clearCart } = useCart();
  const { customer } = useCustomer();

  const [currentStep, setCurrentStep] = useState<CheckoutStep>("delivery");
  const [loading, setLoading] = useState(false);

  // Contact & Address state
  const [email, setEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState({
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    postalCode: "",
    countryCode: "",
    phone: "",
  });
  const [useSameForBilling, setUseSameForBilling] = useState(true);
  const [billingAddress, setBillingAddress] = useState({
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    postalCode: "",
    countryCode: "",
    phone: "",
  });

  // Shipping step
  const [shippingOptions, setShippingOptions] = useState<ShippingOptions>({});
  const [selectedShipping, setSelectedShipping] = useState<Record<string, string>>({});

  // Payment step
  const [paymentProviders, setPaymentProviders] = useState<HttpTypes.StorePaymentProvider[]>([]);
  const [selectedPaymentProvider, setSelectedPaymentProvider] = useState<string | null>(null);

  // Sync form state with cart values (handles both prepopulation and reset)
  useEffect(() => {
    // Populate form with existing cart data or reset to empty values
    setEmail(cart?.email || "");
    setShippingAddress({
      firstName: cart?.shipping_address?.first_name || "",
      lastName: cart?.shipping_address?.last_name || "",
      address: cart?.shipping_address?.address_1 || "",
      city: cart?.shipping_address?.city || "",
      postalCode: cart?.shipping_address?.postal_code || "",
      countryCode: cart?.shipping_address?.country_code || "",
      phone: cart?.shipping_address?.phone || "",
    });

    // Billing address - check if different from shipping
    const hasDifferentBilling =
      cart?.billing_address &&
      (cart.billing_address.address_1 !== cart.shipping_address?.address_1 ||
        cart.billing_address.city !== cart.shipping_address?.city);

    setUseSameForBilling(!hasDifferentBilling);
    setBillingAddress({
      firstName: cart?.billing_address?.first_name || "",
      lastName: cart?.billing_address?.last_name || "",
      address: cart?.billing_address?.address_1 || "",
      city: cart?.billing_address?.city || "",
      postalCode: cart?.billing_address?.postal_code || "",
      countryCode: cart?.billing_address?.country_code || "",
      phone: cart?.billing_address?.phone || "",
    });

    // Reset selections when cart is null
    if (!cart) {
      setSelectedShipping({});
      setSelectedPaymentProvider(null);
      setCurrentStep("delivery");
    }
  }, [cart]);

  useEffect(() => {
    if (!customer) return;
    setEmail((current) => current || customer.email);
    setShippingAddress((current) => ({
      ...current,
      firstName: current.firstName || customer.first_name || "",
      lastName: current.lastName || customer.last_name || "",
    }));
  }, [customer]);

  const fetchShippingOptions = useCallback(async () => {
    if (!cart) return;

    try {
      setLoading(true);
      const { shipping_options } = await listShippingOptions(sdk.client, cart.id);
      setShippingOptions(shipping_options);
    } catch (err) {
      console.error("Failed to fetch shipping options:", err);
      Alert.alert("Aviso", "No se pudieron cargar las opciones de envío");
    } finally {
      setLoading(false);
    }
  }, [cart]);

  const fetchPaymentProviders = useCallback(async () => {
    if (!cart) return;

    try {
      setLoading(true);
      const { payment_providers } = await sdk.store.payment.listPaymentProviders({
        region_id: cart.region_id || "",
      });
      setPaymentProviders(payment_providers || []);
    } catch (err) {
      console.error("Failed to fetch payment providers:", err);
      Alert.alert("Aviso", "No se pudieron cargar los métodos de pago");
    } finally {
      setLoading(false);
    }
  }, [cart]);

  useEffect(() => {
    if (currentStep === "shipping") {
      fetchShippingOptions();
    } else if (currentStep === "payment") {
      fetchPaymentProviders();
    }
  }, [currentStep, fetchShippingOptions, fetchPaymentProviders]);

  const handleDeliveryNext = async () => {
    // Validate shipping address
    if (
      !email ||
      !shippingAddress.firstName ||
      !shippingAddress.lastName ||
      !shippingAddress.address ||
      !shippingAddress.city ||
      !shippingAddress.postalCode ||
      !shippingAddress.countryCode ||
      !shippingAddress.phone
    ) {
      Alert.alert("Aviso", "Completa todos los campos de la dirección de envío");
      return;
    }

    // Validate billing address if different
    if (!useSameForBilling) {
      if (
        !billingAddress.firstName ||
        !billingAddress.lastName ||
        !billingAddress.address ||
        !billingAddress.city ||
        !billingAddress.postalCode ||
        !billingAddress.countryCode ||
        !billingAddress.phone
      ) {
        Alert.alert("Aviso", "Completa todos los campos de la dirección de facturación");
        return;
      }
    }

    if (!cart) return;

    try {
      setLoading(true);
      const shippingAddressData = {
        first_name: shippingAddress.firstName,
        last_name: shippingAddress.lastName,
        address_1: shippingAddress.address,
        city: shippingAddress.city,
        postal_code: shippingAddress.postalCode,
        country_code: shippingAddress.countryCode,
        phone: shippingAddress.phone,
      };

      const billingAddressData = useSameForBilling
        ? shippingAddressData
        : {
            first_name: billingAddress.firstName,
            last_name: billingAddress.lastName,
            address_1: billingAddress.address,
            city: billingAddress.city,
            postal_code: billingAddress.postalCode,
            country_code: billingAddress.countryCode,
            phone: billingAddress.phone,
          };

      await sdk.store.cart.update(cart.id, {
        email,
        shipping_address: shippingAddressData,
        billing_address: billingAddressData,
      });

      await refreshCart();
      setCurrentStep("shipping");
    } catch (err) {
      console.error("Failed to update cart:", err);
      Alert.alert("Aviso", "No se pudo guardar la información de entrega");
    } finally {
      setLoading(false);
    }
  };

  const sellerOptions = Object.entries(shippingOptions);
  const shippingComplete =
    sellerOptions.length > 0 &&
    sellerOptions.every(([sellerId, options]) =>
      options.some((option) => option.id === selectedShipping[sellerId]),
    );

  const handleShippingNext = async () => {
    if (!shippingComplete || !cart) {
      Alert.alert("Aviso", "Selecciona un envío para cada vendedor");
      return;
    }

    try {
      setLoading(true);

      for (const [sellerId] of sellerOptions) {
        await sdk.store.cart.addShippingMethod(cart.id, { option_id: selectedShipping[sellerId] });
      }

      await refreshCart();
      setCurrentStep("payment");
    } catch (err) {
      console.error("Failed to add shipping method:", err);
      Alert.alert("Aviso", "No se pudo guardar el método de envío");
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedPaymentProvider || !cart) {
      Alert.alert("Aviso", "Selecciona un método de pago");
      return;
    }

    try {
      setLoading(true);

      // Create payment session
      await sdk.store.payment.initiatePaymentSession(cart, {
        provider_id: selectedPaymentProvider,
      });

      const sellerSnapshots = await snapshotCartBySeller(sdk.client, cart.id);
      const result = await completeCart(sdk.client, cart.id);
      if (result.type !== "order_group") {
        Alert.alert(
          "Aviso",
          "No se pudo completar el pedido. Revisa los datos e inténtalo de nuevo.",
        );
        return;
      }

      await rememberOrderWhatsAppLinks(sdk.client, result.order_group.id, sellerSnapshots);
      router.replace({
        pathname: "/marketplace-confirmation",
        params: {
          groupId: result.order_group.id,
          orderCount: String(result.order_group.orders.length),
        },
      });
      await clearCart();
      await forgetAgentCode();
    } catch (err: any) {
      console.error("Failed to complete order:", err);
      Alert.alert(
        "Aviso",
        "No se pudo completar el pedido. Revisa los datos e inténtalo de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!cart) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>
          No hay ningún carrito. Agrega productos antes de continuar.
        </Text>
      </View>
    );
  }

  const stepIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.steps, { borderBottomColor: colors.border }]}
        accessibilityRole="progressbar"
        accessibilityLabel={`Paso ${stepIndex + 1} de 3: ${STEP_LABELS[currentStep]}`}
      >
        <Text style={[styles.stepCaption, { color: colors.icon }]}>Paso {stepIndex + 1} de 3</Text>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{STEP_LABELS[currentStep]}</Text>
        <View style={styles.segments}>
          {STEP_ORDER.map((step, index) => (
            <View
              key={step}
              style={[
                styles.segment,
                { backgroundColor: index <= stepIndex ? colors.tint : colors.border },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.content}>
        {currentStep === "delivery" && (
          <DeliveryStep
            email={email}
            shippingAddress={shippingAddress}
            billingAddress={billingAddress}
            useSameForBilling={useSameForBilling}
            loading={loading}
            onEmailChange={setEmail}
            onShippingAddressChange={(field, value) =>
              setShippingAddress((prev) => ({ ...prev, [field]: value }))
            }
            onBillingAddressChange={(field, value) =>
              setBillingAddress((prev) => ({ ...prev, [field]: value }))
            }
            onUseSameForBillingChange={setUseSameForBilling}
            onNext={handleDeliveryNext}
          />
        )}

        {currentStep === "shipping" && (
          <ShippingStep
            shippingOptions={shippingOptions}
            selectedShipping={selectedShipping}
            shippingComplete={shippingComplete}
            currencyCode={cart.currency_code}
            loading={loading}
            onSelectOption={(sellerId, optionId) =>
              setSelectedShipping((current) => ({ ...current, [sellerId]: optionId }))
            }
            onBack={() => setCurrentStep("delivery")}
            onNext={handleShippingNext}
          />
        )}

        {currentStep === "payment" && (
          <PaymentStep
            cart={cart}
            paymentProviders={paymentProviders}
            selectedPaymentProvider={selectedPaymentProvider}
            loading={loading}
            onSelectProvider={setSelectedPaymentProvider}
            onBack={() => setCurrentStep("shipping")}
            onPlaceOrder={handlePlaceOrder}
            onCartChanged={refreshCart}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  steps: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepCaption: { fontSize: 13 },
  stepTitle: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  segments: { flexDirection: "row", gap: 6, marginTop: 8 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  content: {
    flex: 1,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
});
