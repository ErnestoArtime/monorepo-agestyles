import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  adminSdk,
  currentAdmin,
  loginAdminActor,
  logoutAdminActor,
  type AdminUser,
} from "./admin-actor";

type AdminContextValue = {
  /** The signed-in marketplace administrator, or null. */
  admin: AdminUser | null;
  adminReady: boolean;
  /** Tries the same credentials as administrator; false when there is no such account. */
  loginAdmin: (email: string, password: string) => Promise<boolean>;
  logoutAdmin: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
  adminRequest: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [adminReady, setAdminReady] = useState(false);

  const refreshAdmin = useCallback(async () => {
    setAdmin(await currentAdmin());
  }, []);

  useEffect(() => {
    let active = true;
    currentAdmin()
      .then((user) => active && setAdmin(user))
      .finally(() => active && setAdminReady(true));
    return () => {
      active = false;
    };
  }, []);

  const loginAdmin = useCallback(async (email: string, password: string) => {
    if (!(await loginAdminActor(email, password))) {
      setAdmin(null);
      return false;
    }
    const user = await currentAdmin();
    setAdmin(user);
    return Boolean(user);
  }, []);

  const logoutAdmin = useCallback(async () => {
    await logoutAdminActor();
    setAdmin(null);
  }, []);

  const adminRequest = useCallback(async <T,>(path: string, method = "GET", body?: unknown) => {
    const result = await adminSdk.client.fetch(path, {
      method,
      ...(body === undefined ? {} : { body }),
    });
    return (result?.data ?? result) as T;
  }, []);

  const value = useMemo(
    () => ({ admin, adminReady, loginAdmin, logoutAdmin, refreshAdmin, adminRequest }),
    [admin, adminReady, loginAdmin, logoutAdmin, refreshAdmin, adminRequest],
  );
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin needs an AdminProvider.");
  return value;
}
