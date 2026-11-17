import { getCupExchangeRate, type CupExchangeRate } from "@agestyles/api-client/exchange-rate";
import { sdk } from "@/lib/sdk";
import { useEffect, useState } from "react";

let cached: Promise<CupExchangeRate | null> | undefined;

/** Informational CUP rate, fetched once per app session. Null when not configured. */
export function useCupRate(): CupExchangeRate | null {
  const [rate, setRate] = useState<CupExchangeRate | null>(null);
  useEffect(() => {
    let active = true;
    cached ??= getCupExchangeRate(sdk.client);
    cached.then((value) => {
      if (active) setRate(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return rate;
}
