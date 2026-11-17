import assert from "node:assert/strict";
import { cupEquivalent, formatCupEquivalent } from "../src/exchange-rate.ts";
import {
  buildWhatsAppOrderMessage,
  buildWhatsAppOrderUrl,
  normalizeWhatsAppPhone,
} from "../src/whatsapp.ts";

/** Run with `node test/exchange-rate-whatsapp.test.ts` (Node 24 strips the types). */

const rate = {
  base_currency: "usd" as const,
  currency_code: "cup" as const,
  rate: 395.5,
  source: "elTOQUE",
  updated_at: "2026-11-17T20:00:00.000Z",
};

assert.equal(cupEquivalent(50, "usd", rate), 19775);
assert.equal(cupEquivalent(50, "USD", rate), 19775);
assert.equal(cupEquivalent(50, "eur", rate), null, "only USD amounts convert");
assert.equal(cupEquivalent(50, "usd", null), null, "no rate, no equivalent");
assert.equal(cupEquivalent(-1, "usd", rate), null);
assert.equal(cupEquivalent(undefined, "usd", rate), null);
assert.equal(formatCupEquivalent(50, "usd", rate)?.replace(/\s/g, " "), "≈ 19.775 CUP");
assert.equal(formatCupEquivalent(50, "usd", null), null);

assert.equal(normalizeWhatsAppPhone("+53 5309-3096"), "5353093096");
assert.equal(normalizeWhatsAppPhone("123"), null);
assert.equal(normalizeWhatsAppPhone(undefined), null);

const order = {
  phone: "+5353093096",
  sellerName: "AgeStyles",
  orderReference: "#12",
  currencyCode: "usd",
  total: 70,
  email: "cliente@example.com",
  lines: [
    { title: "Nike", variant: "Hombre 9.5", quantity: 1, unitPrice: 50 },
    { title: "Glicinato de Magnesio", variant: "Default", quantity: 1, unitPrice: 20 },
  ],
};
const message = buildWhatsAppOrderMessage(order);
assert.match(message, /^¡Hola, AgeStyles! Quiero consultar mi pedido #12:/);
assert.match(message, /Variante: Hombre 9\.5/);
assert.doesNotMatch(message, /Variante: Default/, "the placeholder variant is not shown");
assert.match(message, /¿Me confirmas disponibilidad y forma de pago\?$/);

const url = buildWhatsAppOrderUrl(order);
assert.ok(url?.startsWith("https://wa.me/5353093096?text="));
assert.equal(decodeURIComponent(url!.split("?text=")[1]), message);
assert.equal(buildWhatsAppOrderUrl({ ...order, phone: "" }), null, "no number, no link");
assert.equal(buildWhatsAppOrderUrl({ ...order, lines: [] }), null);

console.log("exchange-rate and whatsapp rules: ok");
