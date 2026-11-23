/**
 * AG-55: the public «Información» of a store: how it serves orders (pickup, delivery), how to
 * reach it (phones, WhatsApp, e-mail, address, map), when it is open and its social networks.
 *
 * Pure rules shared by the API (validation), Negocio (editor), Tienda and Catálogo (display).
 * The data lives in the seller's metadata, so no migration is needed. Messages are in Spanish
 * because they are shown to the people editing the information.
 */

export const DAYS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

export const SOCIAL_KEYS = [
  "instagram",
  "facebook",
  "tiktok",
  "telegram",
  "youtube",
  "website",
] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export const SOCIAL_LABEL: Record<SocialKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  telegram: "Telegram",
  youtube: "YouTube",
  website: "Sitio web",
};

export type DayHours = {
  /** 0 = lunes … 6 = domingo. */
  day: number;
  closed: boolean;
  /** «HH:MM», 24 h. If `close` is not after `open`, the store closes the next day. */
  open: string;
  close: string;
};

export type StoreInfo = {
  fulfillment: { pickup: boolean; delivery: boolean; delivery_note: string | null };
  phones: string[];
  whatsapp: string | null;
  email: string | null;
  address: {
    line: string | null;
    area: string | null;
    city: string | null;
    reference: string | null;
  };
  location: { lat: number; lng: number } | null;
  /** Null when the store has not published a schedule. */
  hours: DayHours[] | null;
  timezone: string;
  socials: Record<SocialKey, string | null>;
};

export const DEFAULT_TIMEZONE = "America/Havana";
export const MAX_PHONES = 3;

export class StoreInfoError extends Error {}

export function emptyStoreInfo(): StoreInfo {
  return {
    fulfillment: { pickup: false, delivery: false, delivery_note: null },
    phones: [],
    whatsapp: null,
    email: null,
    address: { line: null, area: null, city: null, reference: null },
    location: null,
    hours: null,
    timezone: DEFAULT_TIMEZONE,
    socials: Object.fromEntries(SOCIAL_KEYS.map((key) => [key, null])) as StoreInfo["socials"],
  };
}

/** A default weekly schedule to start editing from (every day 09:00 – 18:00). */
export function defaultHours(): DayHours[] {
  return DAYS.map((_, day) => ({ day, closed: false, open: "09:00", close: "18:00" }));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function text(value: unknown, max: number, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new StoreInfoError(`${label} debe ser un texto.`);
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (trimmed.length > max)
    throw new StoreInfoError(`${label} admite como máximo ${max} caracteres.`);
  return trimmed;
}

/** «+53 5249 7039», «(53) 52497039» → «+5352497039»; digits only when there is no «+». */
export function normalizePhone(value: unknown, label = "El teléfono"): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new StoreInfoError(`${label} debe ser un texto.`);
  const raw = value.trim();
  if (!raw) return null;
  if (!/^[+\d\s().-]+$/.test(raw)) throw new StoreInfoError(`${label} solo puede llevar números.`);
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15)
    throw new StoreInfoError(`${label} debe tener entre 6 y 15 cifras.`);
  return `${raw.startsWith("+") ? "+" : ""}${digits}`;
}

function normalizeEmail(value: unknown): string | null {
  const email = text(value, 120, "El correo");
  if (!email) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email))
    throw new StoreInfoError("El correo no parece válido.");
  return email.toLowerCase();
}

function normalizeTime(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim()))
    throw new StoreInfoError(`${label} debe tener el formato HH:MM (por ejemplo 09:00).`);
  return value.trim();
}

function normalizeHours(value: unknown): DayHours[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.length !== 7)
    throw new StoreInfoError("El horario debe indicar los 7 días de la semana.");
  const hours = value.map((entry, index) => {
    const day = isRecord(entry) ? entry : {};
    const closed = day.closed === true;
    if (closed) return { day: index, closed: true, open: "00:00", close: "00:00" };
    const open = normalizeTime(day.open, `La hora de apertura del ${DAYS[index]}`);
    const close = normalizeTime(day.close, `La hora de cierre del ${DAYS[index]}`);
    if (open === close)
      throw new StoreInfoError(`El ${DAYS[index]} abre y cierra a la misma hora.`);
    return { day: index, closed: false, open, close };
  });
  return hours.every((day) => day.closed) ? null : hours;
}

const SOCIAL_RULES: Record<
  SocialKey,
  { hosts: RegExp | null; build: ((handle: string) => string) | null }
> = {
  instagram: { hosts: /(^|\.)instagram\.com$/i, build: (h) => `https://instagram.com/${h}` },
  facebook: { hosts: /(^|\.)(facebook|fb)\.com$/i, build: (h) => `https://facebook.com/${h}` },
  tiktok: { hosts: /(^|\.)tiktok\.com$/i, build: (h) => `https://tiktok.com/@${h}` },
  telegram: { hosts: /(^|\.)(t\.me|telegram\.me)$/i, build: (h) => `https://t.me/${h}` },
  youtube: { hosts: /(^|\.)(youtube\.com|youtu\.be)$/i, build: null },
  website: { hosts: null, build: null },
};

/** A handle («@tienda») or a link; returns an https link on the network's own host. */
export function normalizeSocial(key: SocialKey, value: unknown): string | null {
  const label = SOCIAL_LABEL[key];
  const input = text(value, 200, label);
  if (!input) return null;
  const rule = SOCIAL_RULES[key];
  if (/^[a-z][a-z0-9+.-]*:/i.test(input) && !/^https?:/i.test(input))
    throw new StoreInfoError(`${label}: solo se admiten enlaces http o https.`);
  const looksLikeLink = /^https?:\/\//i.test(input) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(input);
  if (!looksLikeLink) {
    const handle = input.replace(/^@/, "");
    if (!rule.build || !/^[A-Za-z0-9._-]{1,50}$/.test(handle))
      throw new StoreInfoError(`${label}: escribe el enlace completo.`);
    return rule.build(handle);
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new StoreInfoError(`${label}: el enlace no es válido.`);
  }
  if (url.username || url.password)
    throw new StoreInfoError(`${label}: el enlace no puede llevar usuario ni contraseña.`);
  if (rule.hosts && !rule.hosts.test(url.hostname))
    throw new StoreInfoError(`${label}: el enlace debe ser de ${label}.`);
  url.protocol = "https:";
  return url.toString().replace(/\/$/, "");
}

function normalizeLocation(value: unknown): StoreInfo["location"] {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new StoreInfoError("La ubicación no es válida.");
  const lat = typeof value.lat === "string" ? Number(value.lat.replace(",", ".")) : value.lat;
  const lng = typeof value.lng === "string" ? Number(value.lng.replace(",", ".")) : value.lng;
  if (lat === null && lng === null) return null;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat + lng))
    throw new StoreInfoError("La ubicación necesita latitud y longitud.");
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
    throw new StoreInfoError("La latitud va de -90 a 90 y la longitud de -180 a 180.");
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

function normalizeTimezone(value: unknown): string {
  if (value === null || value === undefined || value === "") return DEFAULT_TIMEZONE;
  if (typeof value !== "string") throw new StoreInfoError("La zona horaria no es válida.");
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: value });
    return value;
  } catch {
    throw new StoreInfoError("La zona horaria no es válida.");
  }
}

/** Validates and normalizes what an editor sent. Throws `StoreInfoError` (Spanish message). */
export function parseStoreInfo(body: unknown): StoreInfo {
  if (!isRecord(body)) throw new StoreInfoError("Faltan los datos de la tienda.");
  const empty = emptyStoreInfo();
  const fulfillment = isRecord(body.fulfillment) ? body.fulfillment : {};
  const address = isRecord(body.address) ? body.address : {};
  const socials = isRecord(body.socials) ? body.socials : {};
  const phonesInput = body.phones === undefined || body.phones === null ? [] : body.phones;
  if (!Array.isArray(phonesInput)) throw new StoreInfoError("Los teléfonos deben ser una lista.");
  const phones = phonesInput
    .map((phone) => normalizePhone(phone))
    .filter((phone): phone is string => phone !== null);
  if (phones.length > MAX_PHONES)
    throw new StoreInfoError(`Se admiten como máximo ${MAX_PHONES} teléfonos.`);
  return {
    fulfillment: {
      pickup: fulfillment.pickup === true,
      delivery: fulfillment.delivery === true,
      delivery_note: text(fulfillment.delivery_note, 160, "La nota de envío"),
    },
    // The same number typed with and without «+» or spaces counts once.
    phones: phones.filter(
      (phone, index) =>
        phones.findIndex((other) => other.replace(/\D/g, "") === phone.replace(/\D/g, "")) ===
        index,
    ),
    whatsapp: normalizePhone(body.whatsapp, "El WhatsApp"),
    email: normalizeEmail(body.email),
    address: {
      line: text(address.line, 120, "La dirección"),
      area: text(address.area, 80, "El municipio o barrio"),
      city: text(address.city, 80, "La provincia o ciudad"),
      reference: text(address.reference, 160, "La referencia"),
    },
    location: normalizeLocation(body.location),
    hours: normalizeHours(body.hours),
    timezone: normalizeTimezone(body.timezone),
    socials: Object.fromEntries(
      SOCIAL_KEYS.map((key) => [key, normalizeSocial(key, socials[key] ?? empty.socials[key])]),
    ) as StoreInfo["socials"],
  };
}

/** Reads what is stored, tolerating anything unexpected (never throws). */
export function readStoreInfo(stored: unknown): StoreInfo {
  try {
    return parseStoreInfo(stored);
  } catch {
    return emptyStoreInfo();
  }
}

/** True when the store published at least one piece of information worth a page. */
export function hasStoreInfo(info: StoreInfo): boolean {
  return Boolean(
    info.fulfillment.pickup ||
    info.fulfillment.delivery ||
    info.phones.length ||
    info.whatsapp ||
    info.email ||
    info.address.line ||
    info.address.area ||
    info.address.city ||
    info.location ||
    info.hours ||
    SOCIAL_KEYS.some((key) => info.socials[key]),
  );
}

// ---------------------------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------------------------

export const phoneHref = (phone: string) => `tel:${phone}`;
export const emailHref = (email: string) => `mailto:${email}`;
export const whatsappHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

/** A map link: the exact point when there is one, otherwise a search for the address. */
export function mapsHref(info: StoreInfo): string | null {
  if (info.location) {
    return `https://www.google.com/maps/search/?api=1&query=${info.location.lat},${info.location.lng}`;
  }
  const query = [info.address.line, info.address.area, info.address.city]
    .filter(Boolean)
    .join(", ");
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

/** The address in one line for display: «Calle 26 #102A · Miramar, Playa · La Habana». */
export function addressLine(info: StoreInfo): string | null {
  const parts = [info.address.line, info.address.area, info.address.city].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// ---------------------------------------------------------------------------------------------
// Hours and «abierto ahora»
// ---------------------------------------------------------------------------------------------

export type OpenStatus =
  { state: "unknown"; label: string } | { state: "open" | "closed"; label: string };

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Day index (0 = lunes) and minutes since midnight in the store's own time zone. */
function localClock(now: Date, timezone: string): { day: number; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: DEFAULT_TIMEZONE,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  }
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return {
    day: weekday < 0 ? 0 : weekday,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/**
 * «Abierto · cierra hoy a las 20:00» / «Cerrado · abre mañana a las 09:00». A range whose close
 * is not after its open ends the next day, so the previous day's late range is checked too.
 */
export function storeOpenStatus(info: StoreInfo, now: Date = new Date()): OpenStatus {
  if (!info.hours) return { state: "unknown", label: "Horario no publicado" };
  const { day, minutes } = localClock(now, info.timezone);
  const today = info.hours[day];
  const yesterday = info.hours[(day + 6) % 7];

  // Still inside yesterday's range that crossed midnight.
  if (!yesterday.closed && toMinutes(yesterday.close) <= toMinutes(yesterday.open)) {
    if (minutes < toMinutes(yesterday.close))
      return { state: "open", label: `Abierto · cierra hoy a las ${yesterday.close}` };
  }
  if (!today.closed) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    const crosses = close <= open;
    if (minutes >= open && (crosses || minutes < close))
      return {
        state: "open",
        label: crosses
          ? `Abierto · cierra mañana a las ${today.close}`
          : `Abierto · cierra hoy a las ${today.close}`,
      };
    if (minutes < open) return { state: "closed", label: `Cerrado · abre hoy a las ${today.open}` };
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = info.hours[(day + offset) % 7];
    if (next.closed) continue;
    const when = offset === 1 ? "mañana" : `el ${DAYS[(day + offset) % 7]}`;
    return { state: "closed", label: `Cerrado · abre ${when} a las ${next.open}` };
  }
  return { state: "closed", label: "Cerrado" };
}

/** Groups consecutive days with the same hours: «Lun – Vie · 09:00 – 18:00», «Dom · Cerrado». */
export function hoursSummary(hours: DayHours[] | null): { days: string; hours: string }[] {
  if (!hours) return [];
  const short = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const label = (day: DayHours) => (day.closed ? "Cerrado" : `${day.open} – ${day.close}`);
  if (hours.every((day) => label(day) === label(hours[0]))) {
    return [{ days: "Todos los días", hours: label(hours[0]) }];
  }
  const groups: { from: number; to: number; hours: string }[] = [];
  hours.forEach((day, index) => {
    const last = groups[groups.length - 1];
    if (last && last.hours === label(day) && last.to === index - 1) last.to = index;
    else groups.push({ from: index, to: index, hours: label(day) });
  });
  return groups.map((group) => ({
    days: group.from === group.to ? short[group.from] : `${short[group.from]} – ${short[group.to]}`,
    hours: group.hours,
  }));
}

/** «Recogida y envío a domicilio», «Solo recogida», … or null when nothing is declared. */
export function fulfillmentSummary(info: StoreInfo): string | null {
  const { pickup, delivery } = info.fulfillment;
  if (pickup && delivery) return "Recogida en tienda y envío a domicilio";
  if (pickup) return "Solo recogida en tienda";
  if (delivery) return "Solo envío a domicilio";
  return null;
}
