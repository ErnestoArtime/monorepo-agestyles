import assert from "node:assert/strict";
import {
  addressLine,
  defaultHours,
  emptyStoreInfo,
  fulfillmentSummary,
  hasStoreInfo,
  hoursSummary,
  mapsHref,
  normalizePhone,
  normalizeSocial,
  parseStoreInfo,
  readStoreInfo,
  StoreInfoError,
  storeOpenStatus,
  whatsappHref,
  type DayHours,
  type StoreInfo,
} from "../src/store-info.ts";

/** Run with `node test/store-info.test.ts` (Node 24 strips the types). */

const fails = (fn: () => unknown, pattern: RegExp) =>
  assert.throws(fn, (error) => error instanceof StoreInfoError && pattern.test(error.message));

// --- A store like the reference page («Dulcería Matteo y Lucas», Miramar): everything filled in.
const full = parseStoreInfo({
  fulfillment: { pickup: true, delivery: true, delivery_note: "  Envío en La Habana  " },
  phones: ["+53 5249 7039", "(53) 52497039", "+5352497039", ""],
  whatsapp: "+53 5249 7039",
  email: "Contacto@Dulceria.TEST ",
  address: {
    line: "Calle 26 #102A e/ 1ra y 3ra",
    area: "Miramar, Playa",
    city: "La Habana",
    reference: "Al lado del antiguo DHL",
  },
  location: { lat: "23,1136", lng: -82.3666 },
  hours: defaultHours().map((day) => ({ ...day, open: "09:00", close: "20:00" })),
  socials: {
    instagram: "@dulceria.ml",
    facebook: "facebook.com/dulceriaml",
    website: "dulceria.test",
  },
});
assert.deepEqual(full.phones, ["+5352497039"], "duplicates and blanks are dropped");
assert.equal(full.email, "contacto@dulceria.test");
assert.equal(full.fulfillment.delivery_note, "Envío en La Habana");
assert.deepEqual(full.location, { lat: 23.1136, lng: -82.3666 });
assert.equal(full.socials.instagram, "https://instagram.com/dulceria.ml");
assert.equal(full.socials.facebook, "https://facebook.com/dulceriaml");
assert.equal(full.socials.website, "https://dulceria.test");
assert.equal(full.socials.tiktok, null);
assert.equal(fulfillmentSummary(full), "Recogida en tienda y envío a domicilio");
assert.equal(addressLine(full), "Calle 26 #102A e/ 1ra y 3ra, Miramar, Playa, La Habana");
assert.equal(whatsappHref("+53 5249 7039"), "https://wa.me/5352497039");
assert.equal(mapsHref(full), "https://www.google.com/maps/search/?api=1&query=23.1136,-82.3666");
assert.ok(hasStoreInfo(full));

// Without a point, the map link searches the address.
assert.match(mapsHref({ ...full, location: null }) ?? "", /query=Calle%2026/);
assert.equal(mapsHref(emptyStoreInfo()), null);

// --- Empty and tolerant reads.
assert.equal(hasStoreInfo(emptyStoreInfo()), false);
assert.deepEqual(readStoreInfo("garbage"), emptyStoreInfo());
assert.deepEqual(readStoreInfo({ phones: "no es lista" }), emptyStoreInfo());
assert.equal(fulfillmentSummary(emptyStoreInfo()), null);
assert.equal(
  fulfillmentSummary({
    ...emptyStoreInfo(),
    fulfillment: { pickup: true, delivery: false, delivery_note: null },
  }),
  "Solo recogida en tienda",
);

// --- Validation: Spanish messages, nothing dangerous gets through.
fails(() => parseStoreInfo(null), /Faltan los datos/);
fails(() => normalizePhone("abc"), /solo puede llevar números/);
fails(() => normalizePhone("123"), /entre 6 y 15 cifras/);
fails(() => parseStoreInfo({ phones: ["111111", "222222", "333333", "444444"] }), /como máximo 3/);
fails(() => parseStoreInfo({ whatsapp: "5249703" }), /prefijo del país/);
fails(() => parseStoreInfo({ email: "no-es-correo" }), /correo/);
fails(() => parseStoreInfo({ location: { lat: 99, lng: 0 } }), /latitud/);
fails(() => parseStoreInfo({ location: { lat: 10 } }), /latitud y longitud/);
fails(() => parseStoreInfo({ timezone: "Mars/Olympus" }), /zona horaria/);
fails(() => parseStoreInfo({ address: { line: "x".repeat(121) } }), /máximo 120/);
fails(() => normalizeSocial("instagram", "javascript:alert(1)"), /http o https/);
fails(() => normalizeSocial("instagram", "https://evil.test/dulceria"), /debe ser de Instagram/);
fails(
  () => normalizeSocial("instagram", "https://user:pw@instagram.com/x"),
  /usuario ni contraseña/,
);
fails(() => normalizeSocial("youtube", "canal"), /enlace completo/);
fails(() => normalizeSocial("instagram", "con espacios raros"), /enlace completo/);
assert.equal(normalizeSocial("telegram", "@mitienda"), "https://t.me/mitienda");
assert.equal(normalizeSocial("tiktok", "mitienda"), "https://tiktok.com/@mitienda");
assert.equal(normalizeSocial("website", "http://sitio.test/inicio"), "https://sitio.test/inicio");
assert.equal(normalizeSocial("website", "  "), null);

// --- Hours validation.
fails(() => parseStoreInfo({ hours: [] }), /7 días/);
fails(() => parseStoreInfo({ hours: defaultHours().map((d) => ({ ...d, open: "9am" })) }), /HH:MM/);
fails(
  () =>
    parseStoreInfo({ hours: defaultHours().map((d) => ({ ...d, open: "10:00", close: "10:00" })) }),
  /misma hora/,
);
assert.equal(
  parseStoreInfo({ hours: defaultHours().map((d) => ({ ...d, closed: true })) }).hours,
  null,
  "a week that is closed every day is the same as no schedule",
);

// --- Open status, evaluated in the store's own time zone (Cuba, UTC−5 in November).
const info = (hours: DayHours[] | null): StoreInfo => ({ ...emptyStoreInfo(), hours });
const week = (open: string, close: string) =>
  defaultHours().map((day) => ({ ...day, open, close }));
// 2026-11-23 is a Monday. 15:00Z = 10:00 in Havana.
const monday10 = new Date("2026-11-23T15:00:00Z");
assert.equal(storeOpenStatus(info(null), monday10).state, "unknown");
assert.deepEqual(storeOpenStatus(info(week("09:00", "20:00")), monday10), {
  state: "open",
  label: "Abierto · cierra hoy a las 20:00",
});
assert.deepEqual(storeOpenStatus(info(week("11:00", "20:00")), monday10), {
  state: "closed",
  label: "Cerrado · abre hoy a las 11:00",
});
// 02:00Z on Tuesday = 21:00 Monday in Havana: after closing, opens tomorrow.
assert.deepEqual(storeOpenStatus(info(week("09:00", "20:00")), new Date("2026-11-24T02:00:00Z")), {
  state: "closed",
  label: "Cerrado · abre mañana a las 09:00",
});
// A Sunday closed → from Saturday night the next opening is Monday.
const closedSunday = week("09:00", "20:00");
closedSunday[6] = { day: 6, closed: true, open: "00:00", close: "00:00" };
assert.deepEqual(storeOpenStatus(info(closedSunday), new Date("2026-11-22T02:00:00Z")), {
  state: "closed",
  label: "Cerrado · abre el lunes a las 09:00",
});
// A bar that closes after midnight (18:00 – 02:00).
const night = week("18:00", "02:00");
assert.equal(storeOpenStatus(info(night), new Date("2026-11-23T23:00:00Z")).state, "open"); // 18:00
assert.deepEqual(storeOpenStatus(info(night), new Date("2026-11-24T05:30:00Z")), {
  state: "open",
  label: "Abierto · cierra hoy a las 02:00",
}); // 00:30 Tuesday, still inside Monday's range
assert.equal(storeOpenStatus(info(night), new Date("2026-11-24T10:00:00Z")).state, "closed"); // 05:00

// --- Summary of the hours.
assert.deepEqual(hoursSummary(week("09:00", "20:00")), [
  { days: "Todos los días", hours: "09:00 – 20:00" },
]);
const mixed = week("09:00", "18:00");
mixed[5] = { day: 5, closed: false, open: "10:00", close: "14:00" };
mixed[6] = { day: 6, closed: true, open: "00:00", close: "00:00" };
assert.deepEqual(hoursSummary(mixed), [
  { days: "Lun – Vie", hours: "09:00 – 18:00" },
  { days: "Sáb", hours: "10:00 – 14:00" },
  { days: "Dom", hours: "Cerrado" },
]);
assert.deepEqual(hoursSummary(null), []);

console.log("store info rules: ok");
