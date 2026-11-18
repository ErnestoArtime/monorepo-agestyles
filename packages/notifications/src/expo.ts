/**
 * Minimal Expo Push Service client (https://exp.host/--/api/v2). Sends are
 * batched at 100 messages; receipts are read at 300 ids per request. The two
 * phases exist because a "ok" ticket only means Expo accepted the message:
 * the receipt later says whether the device was reachable.
 */

/** How a push provider error must be handled. */
export type PushErrorAction = "revoke" | "retry" | "fatal";

export function classifyPushError(code: string | null | undefined): PushErrorAction {
  switch (code) {
    case "DeviceNotRegistered":
      return "revoke";
    case "MessageTooBig":
    case "InvalidCredentials":
    case "DeveloperError":
      return "fatal";
    default:
      return "retry";
  }
}

export const EXPO_API_URL = "https://exp.host/--/api/v2";
export const EXPO_PUSH_URL = `${EXPO_API_URL}/push/send`;
export const EXPO_RECEIPTS_URL = `${EXPO_API_URL}/push/getReceipts`;
export const SEND_BATCH = 100;
export const RECEIPT_BATCH = 300;

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type PushResult =
  { ok: true; ticketId: string } | { ok: false; code: string; action: PushErrorAction };

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class ExpoRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpoRequestError";
  }
}

type RawTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

export class ExpoPushClient {
  private readonly fetchImpl: FetchLike;
  private readonly accessToken: string | null;

  private readonly sendUrl: string;
  private readonly receiptsUrl: string;

  /** `baseUrl` exists so tests can point the client at a local stand-in; it must be https or loopback. */
  constructor(options: { fetch?: FetchLike; accessToken?: string | null; baseUrl?: string } = {}) {
    this.fetchImpl = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.accessToken = options.accessToken ?? null;
    const base = (options.baseUrl ?? EXPO_API_URL).replace(/\/+$/, "");
    if (!/^https:\/\//.test(base) && !/^http:\/\/127\.0\.0\.1(?::\d+)?(?:\/|$)/.test(base)) {
      throw new ExpoRequestError("invalid_base_url");
    }
    this.sendUrl = `${base}/push/send`;
    this.receiptsUrl = `${base}/push/getReceipts`;
  }

  private async post(url: string, payload: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
    };
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;
    let response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch {
      throw new ExpoRequestError("network_error");
    }
    if (!response.ok) throw new ExpoRequestError(`http_${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new ExpoRequestError("invalid_response");
    }
  }

  /** One result per message, in order. A request-level failure throws and nothing is assumed sent. */
  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    for (let start = 0; start < messages.length; start += SEND_BATCH) {
      const batch = messages.slice(start, start + SEND_BATCH);
      const body = (await this.post(
        this.sendUrl,
        batch.map((message) => ({
          to: message.to,
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          sound: "default",
          channelId: "default",
        })),
      )) as { data?: RawTicket[] };
      if (!Array.isArray(body.data) || body.data.length !== batch.length) {
        throw new ExpoRequestError("invalid_response");
      }
      for (const ticket of body.data) {
        if (ticket.status === "ok" && typeof ticket.id === "string") {
          results.push({ ok: true, ticketId: ticket.id });
        } else {
          const code = ticket.details?.error ?? "ProviderError";
          results.push({ ok: false, code, action: classifyPushError(code) });
        }
      }
    }
    return results;
  }

  /** Receipt outcome by ticket id; tickets Expo no longer knows are absent from the map. */
  async receipts(ticketIds: string[]): Promise<Map<string, PushResult>> {
    const outcome = new Map<string, PushResult>();
    for (let start = 0; start < ticketIds.length; start += RECEIPT_BATCH) {
      const batch = ticketIds.slice(start, start + RECEIPT_BATCH);
      const body = (await this.post(this.receiptsUrl, { ids: batch })) as {
        data?: Record<string, RawTicket>;
      };
      if (!body.data || typeof body.data !== "object")
        throw new ExpoRequestError("invalid_response");
      for (const [id, receipt] of Object.entries(body.data)) {
        if (receipt.status === "ok") outcome.set(id, { ok: true, ticketId: id });
        else {
          const code = receipt.details?.error ?? "ProviderError";
          outcome.set(id, { ok: false, code, action: classifyPushError(code) });
        }
      }
    }
    return outcome;
  }
}

/** `provider_ref` keeps "deviceId=ticketId" pairs so a receipt can revoke the right token. */
export function encodeTicketRef(pairs: { deviceId: string; ticketId: string }[]): string {
  return pairs.map((pair) => `${pair.deviceId}=${pair.ticketId}`).join(",");
}

export function decodeTicketRef(
  ref: string | null | undefined,
): { deviceId: string; ticketId: string }[] {
  if (!ref) return [];
  return ref
    .split(",")
    .map((part) => part.split("="))
    .filter((pair): pair is [string, string] => pair.length === 2 && !!pair[0] && !!pair[1])
    .map(([deviceId, ticketId]) => ({ deviceId, ticketId }));
}
