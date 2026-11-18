import AsyncStorage from "@react-native-async-storage/async-storage";
import { sdk } from "@/lib/sdk";

/**
 * Sales agent code (AG-06 phase 4). A buyer may arrive with a link like `?gestor=ANA24`
 * or type the code at checkout; it travels in the cart metadata and the server decides
 * the attribution when the order is placed (only for the agent's own store).
 */
export const AGENT_CODE_METADATA_KEY = "agestyles_agent_code";
const STORAGE_KEY = "agestyles.agent_code";

export function normalizeAgentCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null;
}

export async function rememberAgentCode(value: unknown) {
  const code = normalizeAgentCode(value);
  if (!code) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Remembering the link's code is a convenience; the buyer can still type it.
  }
}

export async function pendingAgentCode(): Promise<string | null> {
  try {
    return normalizeAgentCode(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export async function forgetAgentCode() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to forget.
  }
}

export type AgentCodeInfo = { code: string; seller_id: string; seller_name: string | null };

/** The code's store, or null when the code does not exist or is no longer active. */
export async function lookupAgentCode(value: string): Promise<AgentCodeInfo | null> {
  const code = normalizeAgentCode(value);
  if (!code) return null;
  try {
    const data = await sdk.client.fetch<{ sales_agent: AgentCodeInfo }>(
      `/store/agestyles/sales-agents/${code}`,
    );
    return data.sales_agent ?? null;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}

/** Stores the code in the cart (an empty value removes it). */
export async function setCartAgentCode(cartId: string, code: string | null) {
  await sdk.store.cart.update(cartId, {
    metadata: { [AGENT_CODE_METADATA_KEY]: code ?? "" },
  });
}
