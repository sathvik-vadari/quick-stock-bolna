"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  createTicket,
  subscribeToTicket,
  type TicketStatus,
} from "@/lib/api";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Phone,
  MapPin,
  Globe,
  ArrowLeft,
  Search,
  Zap,
  User,
} from "lucide-react";

type Phase = "input" | "polling" | "error";

const PIPELINE_STEPS = [
  { key: "analyzing", label: "Analyzing your query", statuses: ["received", "analyzing"] },
  { key: "researching", label: "Researching product details", statuses: ["researching"] },
  { key: "finding_stores", label: "Finding nearby stores", statuses: ["finding_stores"] },
  { key: "calling_stores", label: "AI is calling stores", statuses: ["calling_stores"] },
  { key: "done", label: "Done! Results ready", statuses: ["completed"] },
];

function StepIcon({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (state === "active") return <Loader2 className="h-4 w-4 text-blue-400 shrink-0 animate-spin" />;
  return <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />;
}

function PipelineProgress({ status }: { status: string }) {
  return (
    <div className="space-y-3 py-2">
      {PIPELINE_STEPS.map((step) => {
        const stepIdx = PIPELINE_STEPS.indexOf(step);
        const currentIdx = PIPELINE_STEPS.findIndex((s) => s.statuses.includes(status));
        const state =
          currentIdx === -1
            ? "pending"
            : stepIdx < currentIdx
            ? "done"
            : stepIdx === currentIdx
            ? "active"
            : "pending";
        return (
          <div key={step.key} className="flex items-center gap-3">
            <StepIcon state={state} />
            <div className="flex-1 flex items-center gap-2">
              <span
                className={`text-sm ${
                  state === "done"
                    ? "text-muted-foreground line-through"
                    : state === "active"
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/60"
                }`}
              >
                {step.label}
              </span>
              {state === "active" && (
                <div className="flex gap-1">
                  <div className="h-1 w-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-1 w-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-1 w-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CallsProgress({ status }: { status: TicketStatus }) {
  const calls = status.store_calls;
  if (!calls?.length) return null;
  const prog = status.progress;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Store Calls</p>
        <p className="text-xs text-muted-foreground">
          {prog?.calls_completed ?? 0} / {prog?.calls_total ?? calls.length} done
        </p>
      </div>
      <div className="space-y-1">
        {calls.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/30">
            <div
              className={`h-2 w-2 rounded-full shrink-0 ${
                c.status === "analyzed"
                  ? c.product_available
                    ? "bg-green-500"
                    : "bg-red-400"
                  : c.status === "failed"
                  ? "bg-red-600"
                  : c.status === "calling" || c.status === "transcript_received"
                  ? "bg-blue-400 animate-pulse"
                  : "bg-muted"
              }`}
            />
            <span className="text-muted-foreground truncate flex-1">{c.store_name}</span>
            {c.status === "analyzed" && c.product_available && c.price && (
              <span className="text-green-400 shrink-0 font-medium">₹{c.price}</span>
            )}
            {c.status === "analyzed" && c.product_available === false && (
              <span className="text-muted-foreground shrink-0">unavailable</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function QueryPanel({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: (ticketId: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("input");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketStatus, setTicketStatus] = useState<TicketStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const unsubRef = useRef<(() => void) | null>(null);

  const stopListening = () => {
    unsubRef.current?.();
    unsubRef.current = null;
  };

  const startListening = (tid: string) => {
    stopListening();
    unsubRef.current = subscribeToTicket(
      tid,
      (status) => {
        setTicketStatus(status);
        if (status.status === "completed") {
          stopListening();
          onComplete(tid);
        } else if (status.status === "failed") {
          stopListening();
          setErrorMsg(status.error || "Pipeline failed.");
          setPhase("error");
        }
      },
      () => {
        // SSE connection error — silently ignore, user can retry
      }
    );
  };

  useEffect(() => () => stopListening(), []);

  const handleSubmit = async () => {
    if (!query.trim() || !location.trim() || !phone.trim()) return;
    setPhase("polling");
    setErrorMsg("");
    setTicketStatus(null);

    try {
      const resp = await createTicket({
        query: query.trim(),
        location: location.trim(),
        user_phone: phone.trim(),
        user_name: name.trim() || undefined,
      });

      if (resp.status === "rejected") {
        setErrorMsg(resp.message);
        setPhase("error");
        return;
      }

      setTicketId(resp.ticket_id);
      startListening(resp.ticket_id);
    } catch {
      setErrorMsg("Could not reach backend. Is it running?");
      setPhase("error");
    }
  };

  const handleReset = () => {
    stopListening();
    setPhase("input");
    setQuery("");
    setLocation("");
    setPhone("");
    setName("");
    setTicketId(null);
    setTicketStatus(null);
    setErrorMsg("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {phase === "input" && (
        <div className="space-y-5">
          <div className="text-center space-y-2 py-2">
            <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center mb-3">
              <Search className="h-6 w-6 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold">What are you looking for?</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Our AI will call nearby stores to check if they have it in stock,
              get prices, and find the best option for you.
            </p>
          </div>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Search className="h-3 w-3" />
                  Product
                </label>
                <Input
                  placeholder="e.g. 2kg Prestige pressure cooker"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  Location
                </label>
                <Input
                  placeholder="e.g. Indiranagar, Bangalore"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    Phone
                  </label>
                  <Input
                    placeholder="+919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    Name <span className="text-muted-foreground/60">(optional)</span>
                  </label>
                  <Input
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>

              <Button
                className="w-full gap-2 h-10"
                onClick={handleSubmit}
                disabled={!query.trim() || !location.trim() || !phone.trim()}
              >
                <Zap className="h-4 w-4" />
                Find it for me
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground/60 py-1">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> Calls up to 4 stores
            </span>
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" /> Checks online deals
            </span>
          </div>
        </div>
      )}

      {phase === "polling" && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{query}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {location}
                </p>
              </div>
              {ticketId && (
                <Badge variant="outline" className="text-xs font-mono">
                  {ticketId}
                </Badge>
              )}
            </div>

            <Separator />

            <PipelineProgress status={ticketStatus?.status || "received"} />

            {ticketStatus && <CallsProgress status={ticketStatus} />}

            {ticketStatus?.web_deals && ticketStatus.web_deals.deals.length > 0 && (
              <div className="space-y-1.5">
                <Separator />
                <div className="flex items-center gap-1.5 mt-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Online deals found
                  </p>
                </div>
                {ticketStatus.web_deals.deals.slice(0, 3).map((deal, i) => (
                  <div key={i} className="flex items-center justify-between text-xs px-2">
                    <span className="text-muted-foreground truncate">{deal.platform}</span>
                    {deal.price != null && (
                      <span className="text-green-400 shrink-0 ml-2">₹{deal.price}</span>
                    )}
                  </div>
                ))}
                {ticketStatus.web_deals.deals.length > 3 && (
                  <p className="text-xs text-muted-foreground px-2">
                    +{ticketStatus.web_deals.deals.length - 3} more deals
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {phase === "error" && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="font-medium text-sm">Something went wrong</span>
            </div>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button size="sm" variant="outline" onClick={handleReset}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
