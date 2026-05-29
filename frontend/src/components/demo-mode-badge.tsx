"use client";

import { useBackendHealth } from "@/components/backend-health-provider";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";

export function DemoModeBadge() {
  const { status } = useBackendHealth();
  const [collapsed, setCollapsed] = useState(true);

  // Only shown when the live backend is paused. Online → render nothing.
  if (status !== "offline") return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 shadow-lg backdrop-blur transition-colors hover:bg-amber-500/15"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
        </span>
        Demo data
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-[300px] animate-fade-in-up">
      <div className="rounded-xl border border-amber-500/25 bg-card/95 p-3.5 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">Demo mode</p>
              <button
                onClick={() => setCollapsed(true)}
                aria-label="Collapse"
                className="-mr-1 -mt-1 p-1 text-muted-foreground/60 transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              The live backend is paused to save costs. Everything here is
              realistic sample data — the dashboard, AI store calls, transcripts
              and online deals are all explorable. Submit a query to watch the
              pipeline run.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
