"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  checkBackendHealth,
  ensureHealthChecked,
  getBackendStatus,
  onBackendStatusChange,
  type BackendStatus,
} from "@/lib/api";

interface BackendHealthCtx {
  status: BackendStatus;
  retry: () => void;
}

const Ctx = createContext<BackendHealthCtx>({
  status: "checking",
  retry: () => {},
});

export function useBackendHealth() {
  return useContext(Ctx);
}

export function BackendHealthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BackendStatus>(getBackendStatus);

  useEffect(() => {
    const unsub = onBackendStatusChange(setStatus);
    // Single check on load — no polling. If offline, the app runs in demo mode.
    ensureHealthChecked();
    return unsub;
  }, []);

  const retry = useCallback(() => {
    checkBackendHealth();
  }, []);

  return <Ctx value={{ status, retry }}>{children}</Ctx>;
}
