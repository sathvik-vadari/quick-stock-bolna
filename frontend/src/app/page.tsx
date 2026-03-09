"use client";

import { useState, useCallback } from "react";
import { Dashboard } from "@/components/dashboard";
import { QueryPanel } from "@/components/query-panel";
import { TicketDetail } from "@/components/ticket-detail";

type View =
  | { type: "dashboard" }
  | { type: "new-query" }
  | { type: "ticket"; ticketId: string };

export default function Home() {
  const [view, setView] = useState<View>({ type: "dashboard" });

  const goToDashboard = useCallback(() => setView({ type: "dashboard" }), []);
  const goToNewQuery = useCallback(() => setView({ type: "new-query" }), []);
  const goToTicket = useCallback(
    (ticketId: string) => setView({ type: "ticket", ticketId }),
    []
  );

  return (
    <main className="min-h-dvh bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
        <div key={view.type + (view.type === "ticket" ? view.ticketId : "")} className="animate-fade-in-up">
          {view.type === "dashboard" && (
            <Dashboard onNewQuery={goToNewQuery} onViewTicket={goToTicket} />
          )}
          {view.type === "new-query" && (
            <div className="max-w-2xl mx-auto">
              <QueryPanel onBack={goToDashboard} onComplete={goToTicket} />
            </div>
          )}
          {view.type === "ticket" && (
            <div className="max-w-3xl mx-auto">
              <TicketDetail
                ticketId={view.ticketId}
                onBack={goToDashboard}
                onNewQuery={goToNewQuery}
                onNavigateToTicket={goToTicket}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
