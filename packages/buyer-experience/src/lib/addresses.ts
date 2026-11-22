import type { HttpTypes } from "@medusajs/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "../config";
import { useCustomer } from "../context/customer-context";

/** The address shape the checkout and «Mi cuenta» forms work with. */
export type AddressFields = {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  postalCode: string;
  countryCode: string;
  phone: string;
};

export type SavedAddress = HttpTypes.StoreCustomerAddress;

export const EMPTY_ADDRESS: AddressFields = {
  firstName: "",
  lastName: "",
  address: "",
  city: "",
  postalCode: "",
  countryCode: "",
  phone: "",
};

export function fieldsFromSaved(saved: SavedAddress): AddressFields {
  return {
    firstName: saved.first_name ?? "",
    lastName: saved.last_name ?? "",
    address: saved.address_1 ?? "",
    city: saved.city ?? "",
    postalCode: saved.postal_code ?? "",
    countryCode: saved.country_code ?? "",
    phone: saved.phone ?? "",
  };
}

export function savedFromFields(fields: AddressFields, name?: string) {
  return {
    address_name: name?.trim() || undefined,
    first_name: fields.firstName.trim(),
    last_name: fields.lastName.trim(),
    address_1: fields.address.trim(),
    city: fields.city.trim(),
    postal_code: fields.postalCode.trim(),
    country_code: fields.countryCode.trim().toLowerCase() || undefined,
    phone: fields.phone.trim(),
  };
}

/** One line to recognise an address: street, city and who receives it. */
export function addressSummary(saved: SavedAddress) {
  const who = [saved.first_name, saved.last_name].filter(Boolean).join(" ");
  return [saved.address_1, saved.city, saved.postal_code, who].filter(Boolean).join(" · ");
}

export function missingAddressField(fields: AddressFields): string | null {
  if (!fields.firstName.trim()) return "Escribe el nombre de quien recibe.";
  if (!fields.address.trim()) return "Escribe la dirección.";
  if (!fields.city.trim()) return "Escribe la ciudad.";
  if (!fields.phone.trim()) return "Escribe un teléfono de contacto.";
  return null;
}

const same = (a: string, b?: string | null) =>
  a.trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/** Whether these fields are already one of the saved addresses (to not save twice). */
export function isSaved(fields: AddressFields, saved: SavedAddress[]) {
  return saved.some(
    (item) =>
      same(fields.address, item.address_1) &&
      same(fields.city, item.city) &&
      same(fields.firstName, item.first_name) &&
      same(fields.phone, item.phone),
  );
}

/** The signed-in customer's delivery addresses, default first. Empty when signed out. */
export function useSavedAddresses() {
  const { customer } = useCustomer();
  const customerId = customer?.id;
  const session = useMemo(() => ({ customerId }), [customerId]);
  const activeSession = useRef<typeof session | null>(null);
  const latestRequest = useRef(0);
  const [result, setResult] = useState<{
    session: typeof session;
    addresses: SavedAddress[];
    error: string | null;
  } | null>(null);
  const [pendingSession, setPendingSession] = useState<typeof session | null>(null);

  const reload = useCallback(async () => {
    if (!session.customerId || activeSession.current !== session) return;
    const request = ++latestRequest.current;
    const isCurrent = () => activeSession.current === session && latestRequest.current === request;
    setPendingSession(session);
    try {
      const { addresses: list } = await sdk.store.customer.listAddress({ limit: 50 });
      if (!isCurrent()) return;
      const addresses = [...(list ?? [])].sort(
        (a, b) => Number(Boolean(b.is_default_shipping)) - Number(Boolean(a.is_default_shipping)),
      );
      setResult({ session, addresses, error: null });
    } catch {
      if (isCurrent()) {
        setResult((previous) => ({
          session,
          addresses: previous?.session === session ? previous.addresses : [],
          error: "No se pudieron cargar tus direcciones.",
        }));
      }
    } finally {
      if (isCurrent()) setPendingSession(null);
    }
  }, [session]);

  useEffect(() => {
    activeSession.current = session;
    void reload();
    return () => {
      activeSession.current = null;
    };
  }, [reload, session]);

  const requireSession = useCallback(() => {
    if (!session.customerId || activeSession.current !== session) {
      throw new Error("La sesión ha cambiado.");
    }
  }, [session]);

  const save = useCallback(
    async (fields: AddressFields, options: { id?: string; name?: string; isDefault?: boolean }) => {
      requireSession();
      const body = {
        ...savedFromFields(fields, options.name),
        ...(options.isDefault === undefined ? {} : { is_default_shipping: options.isDefault }),
      };
      if (options.id) await sdk.store.customer.updateAddress(options.id, body);
      else await sdk.store.customer.createAddress(body);
      await reload();
    },
    [reload, requireSession],
  );

  const remove = useCallback(
    async (id: string) => {
      requireSession();
      await sdk.store.customer.deleteAddress(id);
      await reload();
    },
    [reload, requireSession],
  );

  const makeDefault = useCallback(
    async (id: string) => {
      requireSession();
      await sdk.store.customer.updateAddress(id, { is_default_shipping: true });
      await reload();
    },
    [reload, requireSession],
  );

  const current = result?.session === session ? result : null;
  return {
    addresses: current?.addresses ?? EMPTY_SAVED_ADDRESSES,
    error: current?.error ?? null,
    loading: Boolean(customerId && (!current || pendingSession === session)),
    reload,
    save,
    remove,
    makeDefault,
  };
}

const EMPTY_SAVED_ADDRESSES: SavedAddress[] = [];
