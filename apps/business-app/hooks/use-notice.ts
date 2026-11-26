import { useToast } from "@agestyles/ui-native";
import { useCallback, useState } from "react";

/**
 * The confirmation line of a screen («Perfil guardado…»), which also pops up as a toast: the
 * line can be off screen after scrolling, the toast is always seen. Clearing it (`""`) is silent.
 */
export function useNotice(initial = "") {
  const [notice, setNoticeState] = useState(initial);
  const toast = useToast();
  const setNotice = useCallback(
    (value: string) => {
      setNoticeState(value);
      if (value) toast.show(value, /^No /.test(value) ? "info" : "success");
    },
    [toast],
  );
  return [notice, setNotice] as const;
}
