"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  checkBackendHealth,
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

const RETRY_INTERVAL_MS = 15_000;

export function BackendHealthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BackendStatus>(getBackendStatus);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unsub = onBackendStatusChange(setStatus);
    return unsub;
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (getBackendStatus() === "offline") {
        checkBackendHealth();
      }
    }, RETRY_INTERVAL_MS);
  }, []);

  useEffect(() => {
    checkBackendHealth();
    startPolling();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startPolling]);

  useEffect(() => {
    if (status === "online" && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (status === "offline" && !intervalRef.current) {
      startPolling();
    }
  }, [status, startPolling]);

  const retry = useCallback(() => {
    checkBackendHealth();
  }, []);

  return <Ctx value={{ status, retry }}>{children}</Ctx>;
}
