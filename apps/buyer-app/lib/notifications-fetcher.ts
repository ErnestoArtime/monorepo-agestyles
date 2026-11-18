import type { Fetcher } from "@agestyles/api-client/notifications";
import { sdk } from "@/lib/sdk";

/** Adapts the customer session of the Medusa SDK to the shared notifications client. */
export const notificationsFetcher: Fetcher = <T>(
  path: string,
  init?: { method?: "GET" | "POST" | "DELETE"; body?: unknown },
) =>
  sdk.client.fetch<T>(path, {
    method: init?.method ?? "GET",
    ...(init?.body === undefined ? {} : { body: init.body as Record<string, unknown> }),
  });
