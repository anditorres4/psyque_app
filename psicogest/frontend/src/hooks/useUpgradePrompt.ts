import { useState } from "react";
import { ApiError } from "@/lib/api";

export function useUpgradePrompt() {
  const [open, setOpen] = useState(false);

  function handleQueryError(error: unknown) {
    if (error instanceof ApiError && error.status === 403) {
      setOpen(true);
    }
  }

  return { upgradePromptOpen: open, closeUpgradePrompt: () => setOpen(false), handleQueryError };
}
