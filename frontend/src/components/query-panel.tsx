"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  createTicket,
  getTicketStatus,
  getTicketOptions,
  type TicketStatus,
  type OptionsResponse,
  type OptionItem,
  type WebDeal,
} from "@/lib/api";
import {
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  Phone,
  MapPin,
  Store,
  Globe,
  ExternalLink,
  Tag,
  Zap,
  Star,
  Package,
  RefreshCw,
} from "lucide-react";

type Phase = "input" | "polling" | "options_ready" | "error";

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
  return <div className="h-4 w-4 rounded-full border border-muted shrink-0" />;
}

function PipelineProgress({ status }: { status: string }) {
  return (
    <div className="space-y-2 py-2">
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
          <div key={step.key} className="flex items-center gap-2.5">
            <StepIcon state={state} />
            <span
              className={`text-sm ${
                state === "done"
                  ? "text-muted-foreground line-through"
                  : state === "active"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
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
    <div className="mt-3 space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {prog?.calls_completed ?? 0} / {prog?.calls_total ?? calls.length} store calls done
      </p>
      <div className="space-y-1">
        {calls.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs">
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
            <span className="text-muted-foreground truncate">{c.store_name}</span>
            {c.status === "analyzed" && c.product_available && c.price && (
              <span className="ml-auto text-green-400 shrink-0">₹{c.price}</span>
            )}
            {c.status === "analyzed" && c.product_available === false && (
              <span className="ml-auto text-muted-foreground shrink-0">unavailable</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OptionCard({ option, rank }: { option: OptionItem; rank: number }) {
  const matchColor =
    option.product_match_type === "exact"
      ? "bg-green-500/10 text-green-400 border-green-500/20"
      : option.product_match_type === "close"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : "bg-muted text-muted-foreground border-border";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-muted-foreground">#{rank}</span>
            <Store className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-sm">{option.store_name}</span>
          </div>
          {option.rating && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs text-muted-foreground">{option.rating}</span>
            </div>
          )}
        </div>

        {option.address && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
            <span>{option.address}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {option.price != null && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Tag className="h-3 w-3" />₹{option.price}
            </Badge>
          )}
          {option.matched_product && (
            <Badge variant="outline" className="text-xs">
              {option.matched_product}
            </Badge>
          )}
          {option.product_match_type && (
            <Badge variant="outline" className={`text-xs border ${matchColor}`}>
              {option.product_match_type} match
            </Badge>
          )}
          {option.delivery_available != null && (
            <Badge variant="outline" className="text-xs gap-1">
              {option.delivery_available ? (
                <>
                  <Zap className="h-3 w-3 text-green-400" />
                  Delivery{option.delivery_eta ? ` · ${option.delivery_eta}` : ""}
                </>
              ) : (
                "Pickup only"
              )}
            </Badge>
          )}
        </div>

        {option.call_summary && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
            {option.call_summary}
          </p>
        )}

        {option.phone_number && (
          <a
            href={`tel:${option.phone_number}`}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
          >
            <Phone className="h-3 w-3" />
            {option.phone_number}
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function WebDealCard({ deal }: { deal: WebDeal }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-sm">{deal.platform}</span>
          </div>
          {deal.in_stock === false && (
            <Badge variant="outline" className="text-xs text-red-400">Out of stock</Badge>
          )}
        </div>

        {deal.product_title && (
          <p className="text-xs text-muted-foreground">{deal.product_title}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {deal.price != null && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Tag className="h-3 w-3" />₹{deal.price}
            </Badge>
          )}
          {deal.original_price && deal.discount_percent && (
            <Badge variant="outline" className="text-xs text-green-400">
              {deal.discount_percent}% off
            </Badge>
          )}
          {deal.delivery_estimate && (
            <Badge variant="outline" className="text-xs">
              <Zap className="h-3 w-3 mr-0.5" />
              {deal.delivery_estimate}
            </Badge>
          )}
        </div>

        {deal.url && (
          <a
            href={deal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            <ExternalLink className="h-3 w-3" />
            View deal
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function ResultsView({
  options,
  onReset,
}: {
  options: OptionsResponse;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{options.product_requested}</h2>
          {options.quick_verdict && (
            <p className="text-xs text-muted-foreground mt-0.5">{options.quick_verdict}</p>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onReset} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          New query
        </Button>
      </div>

      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>{options.stores_contacted} stores called</span>
        <span>·</span>
        <span>{options.calls_connected} connected</span>
        <span>·</span>
        <span className="text-green-400 font-medium">{options.options_found} with product</span>
      </div>

      {options.message && (
        <Card>
          <CardContent className="p-3">
            <p className="text-sm leading-relaxed">{options.message}</p>
          </CardContent>
        </Card>
      )}

      {options.options.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Store Options
          </p>
          {options.options.map((opt) => (
            <OptionCard key={opt.rank} option={opt} rank={opt.rank} />
          ))}
        </div>
      )}

      {options.web_deals && options.web_deals.length > 0 && (
        <div className="space-y-2">
          <Separator />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Online Deals
          </p>
          {options.web_deals_summary && (
            <p className="text-xs text-muted-foreground">{options.web_deals_summary}</p>
          )}
          {options.web_deals.map((deal, i) => (
            <WebDealCard key={i} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}

export function QueryPanel() {
  const [phase, setPhase] = useState<Phase>("input");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketStatus, setTicketStatus] = useState<TicketStatus | null>(null);
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchOptions = useCallback(async (tid: string) => {
    try {
      const opts = await getTicketOptions(tid);
      if (opts.error && opts.status !== "completed") return false;
      setOptions(opts);
      setPhase("options_ready");
      return true;
    } catch {
      return false;
    }
  }, []);

  const startPolling = useCallback(
    (tid: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const status = await getTicketStatus(tid);
          setTicketStatus(status);

          if (status.status === "completed") {
            stopPolling();
            await fetchOptions(tid);
          } else if (status.status === "failed") {
            stopPolling();
            setErrorMsg(status.error || "Pipeline failed. Check your API keys and Bolna config.");
            setPhase("error");
          }
        } catch {
          // network blip — keep polling
        }
      }, 3000);
    },
    [stopPolling, fetchOptions]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleSubmit = async () => {
    if (!query.trim() || !location.trim() || !phone.trim()) return;
    setPhase("polling");
    setErrorMsg("");
    setTicketStatus(null);
    setOptions(null);

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
      startPolling(resp.ticket_id);
    } catch (e) {
      setErrorMsg("Could not reach backend. Is it running?");
      setPhase("error");
    }
  };

  const handleReset = () => {
    stopPolling();
    setPhase("input");
    setQuery("");
    setLocation("");
    setPhone("");
    setName("");
    setTicketId(null);
    setTicketStatus(null);
    setOptions(null);
    setErrorMsg("");
  };

  if (phase === "options_ready" && options) {
    return <ResultsView options={options} onReset={handleReset} />;
  }

  return (
    <div className="space-y-4">
      {phase === "input" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">What are you looking for?</label>
              <Input
                placeholder="e.g. 2kg Prestige pressure cooker"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Your location
              </label>
              <Input
                placeholder="e.g. Indiranagar, Bangalore"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Your phone
                </label>
                <Input
                  placeholder="+919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Name (optional)</label>
                <Input
                  placeholder="Priya"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleSubmit}
              disabled={!query.trim() || !location.trim() || !phone.trim()}
            >
              <Send className="h-4 w-4" />
              Find it for me
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "polling" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{query}</p>
                <p className="text-xs text-muted-foreground">{location}</p>
              </div>
              {ticketId && (
                <Badge variant="outline" className="text-xs font-mono">{ticketId}</Badge>
              )}
            </div>

            <Separator />

            <PipelineProgress status={ticketStatus?.status || "received"} />

            {ticketStatus && <CallsProgress status={ticketStatus} />}
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
