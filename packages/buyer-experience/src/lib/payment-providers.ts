import type { IconName } from "@agestyles/icons";

/**
 * Information about a payment provider for display purposes
 */
export interface PaymentProviderInfo {
  icon: IconName;
  title: string;
}

/**
 * Get display information for a payment provider based on its ID
 * Returns an icon name and formatted title for the payment provider
 */
export function getPaymentProviderInfo(providerId: string): PaymentProviderInfo {
  switch (providerId) {
    case "pp_system_default":
      return {
        icon: "creditCard",
        title: "Pago manual",
      };
    case "pp_stripe":
    case "pp_stripe_stripe":
      return {
        icon: "creditCard",
        title: "Tarjeta bancaria",
      };
    case "pp_paypal_paypal":
      return {
        icon: "creditCard",
        title: "PayPal",
      };
    default:
      return {
        icon: "creditCard",
        title: "Otro método de pago",
      };
  }
}
