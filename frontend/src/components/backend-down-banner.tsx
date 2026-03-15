"use client";

import { useBackendHealth } from "@/components/backend-health-provider";
import { Button } from "@/components/ui/button";
import { ServerOff, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";

export function BackendDownBanner() {
  const { status, retry } = useBackendHealth();
  const [spinning, setSpinning] = useState(false);

  if (status === "online") return null;

  const isChecking = status === "checking";

  const handleRetry = () => {
    setSpinning(true);
    retry();
    setTimeout(() => setSpinning(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md animate-fade-in-up">
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-2xl">
          {isChecking ? (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Connecting to backend...
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Checking if the server is running
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                <ServerOff className="h-8 w-8 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Backend is offline
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The Azure server appears to be stopped. Start the backend and
                try again.
              </p>
              <div className="mt-2 rounded-md bg-muted/50 px-3 py-2">
                <code className="text-xs text-muted-foreground">
                  {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
                </code>
              </div>
              <Button
                onClick={handleRetry}
                className="mt-6 w-full"
                variant="outline"
                disabled={spinning}
              >
                {spinning ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {spinning ? "Checking..." : "Retry connection"}
              </Button>
              <p className="mt-3 text-xs text-muted-foreground/60">
                Auto-retrying every 15 seconds
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
