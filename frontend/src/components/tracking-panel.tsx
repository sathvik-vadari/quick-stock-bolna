"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getTicketStatus, type TicketStatus } from "@/lib/api";
import { Search, Loader2, CheckCircle2, XCircle, Clock, Phone, MapPin, Store } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  analyzing: "Analyzing query",
  researching: "Researching product",
  finding_stores: "Finding stores",
  calling_stores: "Calling stores",
  completed: "Completed",
  failed: "Failed",
};

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed"
      ? "bg-green-500/10 text-green-400 border-green-500/20"
      : status === "failed"
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : "bg-blue-500/10 text-blue-400 border-blue-500/20";
  return (
    <Badge variant="outline" className={`text-xs border ${color}`}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

export function TrackingPanel() {
  const [ticketId, setTicketId] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<TicketStatus | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    const id = ticketId.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    setError("");
    setTicket(null);
    try {
      const data = await getTicketStatus(id);
      if ("error" in data && !data.ticket_id) {
        setError("Ticket not found.");
      } else {
        setTicket(data);
      }
    } catch {
      setError("Could not reach backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Enter your ticket ID to check the status of a previous query.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="TKT-001"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="font-mono uppercase"
            />
            <Button onClick={handleSearch} disabled={loading || !ticketId.trim()} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Track
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {ticket && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Badge variant="outline" className="text-xs font-mono mb-1">
                  {ticket.ticket_id}
                </Badge>
                {ticket.product && (
                  <p className="font-medium text-sm">
                    {(ticket.product as Record<string, unknown>).product_name as string}
                  </p>
                )}
              </div>
              <StatusBadge status={ticket.status} />
            </div>

            {ticket.error && (
              <p className="text-xs text-destructive">{ticket.error}</p>
            )}

            {ticket.progress && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Stores found: {ticket.progress.stores_found}</p>
                <p>
                  Calls: {ticket.progress.calls_completed} / {ticket.progress.calls_total} completed
                </p>
              </div>
            )}

            {ticket.store_calls && ticket.store_calls.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Store calls</p>
                {ticket.store_calls.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    <div
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        c.status === "analyzed"
                          ? c.product_available
                            ? "bg-green-500"
                            : "bg-red-400"
                          : c.status === "failed"
                          ? "bg-red-600"
                          : "bg-blue-400 animate-pulse"
                      }`}
                    />
                    <span className="truncate">{c.store_name}</span>
                    {c.status === "analyzed" && c.product_available && c.price && (
                      <span className="ml-auto text-green-400 shrink-0">₹{c.price}</span>
                    )}
                    {c.status === "analyzed" && c.product_available === false && (
                      <span className="ml-auto text-muted-foreground">unavailable</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {ticket.result && ticket.status === "completed" && (
              <div className="border-t pt-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Result</p>
                <p className="text-sm">
                  {(ticket.result as Record<string, unknown>).recommendation as string ||
                    (ticket.result as Record<string, unknown>).message as string}
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Last updated: {ticket.updated_at ? new Date(ticket.updated_at).toLocaleTimeString() : "—"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
