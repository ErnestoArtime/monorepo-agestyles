/**
 * Builds the "consult my order" WhatsApp link a buyer opens after checkout, one
 * per seller order, keeping the legacy catalog's message shape.
 */
export type WhatsAppOrderLine = {
  title: string;
  variant?: string | null;
  quantity: number;
  unitPrice?: number | null;
};

export type WhatsAppOrder = {
  phone: string;
  sellerName: string;
  orderReference: string;
  currencyCode: string;
  total?: number | null;
  email?: string | null;
  lines: WhatsAppOrderLine[];
};

/** International number as digits only (wa.me format), or null if it is not plausible. */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function money(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(amount);
}

export function buildWhatsAppOrderMessage(order: WhatsAppOrder): string {
  let message = `¡Hola, ${order.sellerName}! Quiero consultar mi pedido ${order.orderReference}:\n\n`;
  if (order.email) message += `Correo: ${order.email}\n\n`;
  order.lines.forEach((line, index) => {
    message += `${index + 1}. ${line.title}\n`;
    if (line.variant && line.variant !== "Default") message += `Variante: ${line.variant}\n`;
    message += `Cantidad: ${line.quantity}\n`;
    if (line.unitPrice != null && line.unitPrice > 0) {
      message += `Precio: ${money(line.unitPrice, order.currencyCode)}\n`;
    }
    message += "\n";
  });
  if (order.total != null && Number.isFinite(order.total)) {
    message += `Total: ${money(order.total, order.currencyCode)}\n\n`;
  }
  message += "¿Me confirmas disponibilidad y forma de pago?";
  return message;
}

/** wa.me link for the seller's number, or null when the seller has no valid number. */
export function buildWhatsAppOrderUrl(order: WhatsAppOrder): string | null {
  const phone = normalizeWhatsAppPhone(order.phone);
  if (!phone || !order.lines.length) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppOrderMessage(order))}`;
}
