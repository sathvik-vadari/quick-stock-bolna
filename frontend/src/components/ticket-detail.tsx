"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getTicketStatus,
  getTicketOptions,
  subscribeToTicket,
  createTicket,
  type TicketStatus,
  type OptionsResponse,
  type OptionItem,
  type WebDeal,
} from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
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
  RefreshCw,
  Clock,
  Package,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Trophy,
} from "lucide-react";

const PIPELINE_STEPS = [
  { key: "analyzing", label: "Analyzing your query", statuses: ["received", "analyzing"] },
  { key: "researching", label: "Researching product details", statuses: ["researching"] },
  { key: "finding_stores", label: "Finding nearby stores", statuses: ["finding_stores"] },
  { key: "calling_stores", label: "AI is calling stores", statuses: ["calling_stores"] },
  { key: "done", label: "Done! Results ready", statuses: ["completed"] },
];

function StepIcon({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done")
    return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (state === "active")
    return <Loader2 className="h-4 w-4 text-blue-400 shrink-0 animate-spin" />;
  return <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />;
}

function PipelineProgress({ status }: { status: string }) {
  return (
    <div className="space-y-3 py-2">
      {PIPELINE_STEPS.map((step) => {
        const stepIdx = PIPELINE_STEPS.indexOf(step);
        const currentIdx = PIPELINE_STEPS.findIndex((s) =>
          s.statuses.includes(status)
        );
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
      <div className="space-y-1.5">
        {calls.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/30"
          >
            <div
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                c.status === "analyzed"
                  ? c.product_available
                    ? "bg-green-500"
                    : "bg-red-400"
                  : c.status === "failed"
                  ? "bg-red-600"
                  : c.status === "calling" || c.status === "transcript_received"
                  ? "bg-blue-400 animate-pulse"
                  : "bg-muted-foreground/30"
              }`}
            />
            <span className="text-sm text-foreground truncate flex-1">
              {c.store_name}
            </span>
            {c.status === "analyzed" && c.product_available && c.price && (
              <Badge variant="secondary" className="text-xs gap-1 text-green-400">
                <Tag className="h-3 w-3" />
                ₹{c.price}
              </Badge>
            )}
            {c.status === "analyzed" && c.product_available === false && (
              <span className="text-xs text-muted-foreground">unavailable</span>
            )}
            {(c.status === "calling" || c.status === "transcript_received") && (
              <Loader2 className="h-3 w-3 text-blue-400 animate-spin shrink-0" />
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
    <Card className="overflow-hidden hover:border-border/80 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <span className="text-xs font-mono font-bold text-muted-foreground">
                {rank}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-sm">{option.store_name}</span>
              </div>
              {option.address && (
                <div className="flex items-start gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>{option.address}</span>
                </div>
              )}
            </div>
          </div>
          {option.rating && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs text-muted-foreground">{option.rating}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {option.price != null && (
            <Badge variant="secondary" className="text-xs gap-1 font-semibold">
              <Tag className="h-3 w-3" />₹{option.price}
            </Badge>
          )}
          {option.matched_product && (
            <Badge variant="outline" className="text-xs">
              {option.matched_product}
            </Badge>
          )}
          {option.product_match_type && (
            <Badge
              variant="outline"
              className={`text-xs border ${matchColor}`}
            >
              {option.product_match_type} match
            </Badge>
          )}
          {option.delivery_available != null && (
            <Badge variant="outline" className="text-xs gap-1">
              {option.delivery_available ? (
                <>
                  <Zap className="h-3 w-3 text-green-400" />
                  Delivery
                  {option.delivery_eta ? ` · ${option.delivery_eta}` : ""}
                </>
              ) : (
                "Pickup only"
              )}
            </Badge>
          )}
        </div>

        {option.call_summary && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3 leading-relaxed">
            &ldquo;{option.call_summary}&rdquo;
          </p>
        )}

        {option.phone_number && (
          <a
            href={`tel:${option.phone_number}`}
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Phone className="h-3 w-3" />
            {option.phone_number}
          </a>
        )}
      </CardContent>
    </Card>
  );
}

type Confidence = "high" | "medium" | "low";

function getDealConfidence(deal: WebDeal): Confidence {
  const title = (deal.product_title || "").toLowerCase();
  const platform = (deal.platform || "").toLowerCase();
  const notable = (deal.why_notable || "").toLowerCase();

  const refurbTerms = [
    "refurbished", "renewed", "used", "pre-owned", "pre owned",
    "2nd hand", "second hand", "open box", "unboxed",
  ];
  const lowPlatforms = ["olx", "cashify", "quikr", "2gud"];

  if (refurbTerms.some((t) => title.includes(t) || notable.includes(t)))
    return "low";
  if (lowPlatforms.some((p) => platform.includes(p))) return "low";

  if (deal.in_stock === false) return "low";

  let score = 0;
  if (deal.in_stock === true) score += 3;
  if (deal.price != null) score += 2;
  if (deal.url) score += 1;
  if (deal.delivery_estimate) score += 1;
  if (deal.discount_percent && deal.discount_percent > 0) score += 1;

  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

const CONFIDENCE_CONFIG: Record<Confidence, { label: string; border: string; pill: string; Icon: typeof ShieldCheck }> = {
  high: { label: "High", border: "border-green-500/30", pill: "bg-green-500/10 text-green-400 border-green-500/20", Icon: ShieldCheck },
  medium: { label: "Medium", border: "border-amber-500/30", pill: "bg-amber-500/10 text-amber-400 border-amber-500/20", Icon: ShieldAlert },
  low: { label: "Low", border: "border-muted-foreground/20", pill: "bg-muted text-muted-foreground border-border", Icon: Shield },
};

function WebDealCard({ deal }: { deal: WebDeal }) {
  const confidence = getDealConfidence(deal);
  const conf = CONFIDENCE_CONFIG[confidence];

  return (
    <Card className={`overflow-hidden ${conf.border} hover:border-border/80 transition-colors h-full`}>
      <CardContent className="p-4 space-y-2.5 flex flex-col h-full">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-sm">{deal.platform}</span>
          </div>
          <Badge variant="outline" className={`text-[10px] border gap-1 ${conf.pill}`}>
            <conf.Icon className="h-3 w-3" />
            {conf.label}
          </Badge>
        </div>

        {deal.product_title && (
          <p className="text-xs text-muted-foreground line-clamp-2">{deal.product_title}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {deal.price != null && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Tag className="h-3 w-3" />₹{deal.price}
            </Badge>
          )}
          {deal.original_price != null && deal.discount_percent != null && deal.discount_percent > 0 && (
            <Badge variant="outline" className="text-xs text-green-400 border-green-500/20">
              {deal.discount_percent}% off
            </Badge>
          )}
          {deal.delivery_estimate && (
            <Badge variant="outline" className="text-xs gap-0.5">
              <Zap className="h-3 w-3" />
              {deal.delivery_estimate}
            </Badge>
          )}
          {deal.in_stock === false && (
            <Badge variant="outline" className="text-xs text-red-400 border-red-500/20">
              Out of stock
            </Badge>
          )}
        </div>

        <div className="flex-1" />

        {deal.url && (
          <a
            href={deal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View deal
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function BestDealBanner({
  best,
}: {
  best: { platform: string; price?: number; reason?: string };
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
      <Trophy className="h-5 w-5 text-green-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          Best online deal: {best.platform}
          {best.price != null && (
            <span className="text-green-400 ml-1.5">₹{best.price.toLocaleString("en-IN")}</span>
          )}
        </p>
        {best.reason && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {best.reason}
          </p>
        )}
      </div>
    </div>
  );
}

function WebDealsCarousel({
  deals,
  summary,
  bestDeal,
}: {
  deals: WebDeal[];
  summary?: string;
  bestDeal?: { platform: string; price?: number; reason?: string };
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll, deals]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -300 : 300,
      behavior: "smooth",
    });
  };

  return (
    <div className="space-y-3">
      <Separator />
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5" />
          Online Deals
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canScrollLeft}
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canScrollRight}
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {bestDeal && <BestDealBanner best={bestDeal} />}
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none"
      >
        {deals.map((deal, i) => (
          <div key={i} className="min-w-[260px] max-w-[300px] snap-start shrink-0">
            <WebDealCard deal={deal} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RetryForm({
  ticket,
  onRetry,
}: {
  ticket: TicketStatus;
  onRetry: (ticketId: string) => void;
}) {
  const [query, setQuery] = useState(ticket.query || "");
  const [maxStores, setMaxStores] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  const [retryError, setRetryError] = useState("");

  const handleRetry = async () => {
    if (!query.trim() || !ticket.location || !ticket.user_phone) return;
    setSubmitting(true);
    setRetryError("");
    try {
      const resp = await createTicket({
        query: query.trim(),
        location: ticket.location,
        user_phone: ticket.user_phone,
        user_name: ticket.user_name,
        max_stores: maxStores,
      });
      if (resp.status === "rejected") {
        setRetryError(resp.message);
      } else {
        onRetry(resp.ticket_id);
      }
    } catch {
      setRetryError("Could not reach backend.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="font-medium text-sm flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
            Try again with a refined search?
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Add more detail to your query or increase the number of stores we call.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-medium">
            Refined query
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRetry()}
            placeholder="Be more specific about brand, size, model..."
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-medium">
            Stores to call
          </label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={maxStores <= 1}
              onClick={() => setMaxStores((v) => Math.max(1, v - 1))}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="font-mono text-sm w-6 text-center">{maxStores}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={maxStores >= 10}
              onClick={() => setMaxStores((v) => Math.min(10, v + 1))}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground ml-1">
              (was {ticket.progress?.calls_total ?? "?"})
            </span>
          </div>
        </div>

        {retryError && (
          <p className="text-xs text-destructive">{retryError}</p>
        )}

        <Button
          onClick={handleRetry}
          disabled={submitting || !query.trim()}
          className="w-full gap-2"
          size="sm"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Retry search
        </Button>
      </CardContent>
    </Card>
  );
}

function ResultsView({
  options,
  ticket,
  onRetry,
}: {
  options: OptionsResponse;
  ticket: TicketStatus;
  onRetry: (ticketId: string) => void;
}) {
  const allFailed = options.options_found === 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-lg">{options.product_requested}</h2>
        {options.quick_verdict && (
          <p className="text-sm text-muted-foreground mt-1">{options.quick_verdict}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{options.stores_contacted}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Stores Called</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{options.calls_connected}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Connected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-lg font-bold ${allFailed ? "text-red-400" : "text-green-400"}`}>
              {options.options_found}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase">Available</p>
          </CardContent>
        </Card>
      </div>

      {options.message && (
        <Card className={allFailed ? "border-red-500/20 bg-red-500/5" : "border-blue-500/20 bg-blue-500/5"}>
          <CardContent className="p-3">
            <p className="text-sm leading-relaxed">{options.message}</p>
          </CardContent>
        </Card>
      )}

      {allFailed && ticket.query && ticket.location && ticket.user_phone && (
        <RetryForm ticket={ticket} onRetry={onRetry} />
      )}

      {options.options.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Store Options
          </p>
          {options.options.map((opt) => (
            <OptionCard key={opt.rank} option={opt} rank={opt.rank} />
          ))}
        </div>
      )}

      {options.web_deals && options.web_deals.length > 0 && (
        <WebDealsCarousel
          deals={options.web_deals}
          summary={options.web_deals_summary}
          bestDeal={options.web_deals_best}
        />
      )}
    </div>
  );
}

export function TicketDetail({
  ticketId,
  onBack,
  onNewQuery,
  onNavigateToTicket,
}: {
  ticketId: string;
  onBack: () => void;
  onNewQuery: () => void;
  onNavigateToTicket: (ticketId: string) => void;
}) {
  const [ticket, setTicket] = useState<TicketStatus | null>(null);
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const unsubRef = useRef<(() => void) | null>(null);

  const fetchOptions = useCallback(async (tid: string) => {
    try {
      const opts = await getTicketOptions(tid);
      if (opts.error && opts.status !== "completed") return;
      setOptions(opts);
    } catch {
      // might not have options yet
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await getTicketStatus(ticketId);
        if (!mounted) return;
        if ("error" in data && !data.ticket_id) {
          setError("Ticket not found.");
          setLoading(false);
          return;
        }
        setTicket(data);
        setLoading(false);

        if (data.status === "completed") {
          await fetchOptions(ticketId);
        } else if (data.status !== "failed") {
          unsubRef.current = subscribeToTicket(
            ticketId,
            async (update) => {
              if (!mounted) return;
              setTicket(update);
              if (update.status === "completed") {
                unsubRef.current?.();
                unsubRef.current = null;
                await fetchOptions(ticketId);
              } else if (update.status === "failed") {
                unsubRef.current?.();
                unsubRef.current = null;
              }
            },
          );
        }
      } catch {
        if (mounted) {
          setError("Could not reach backend.");
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [ticketId, fetchOptions]);

  const isActive = ticket && ["received", "analyzing", "researching", "finding_stores", "calling_stores"].includes(ticket.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1" />
        {ticket && (
          <Badge variant="outline" className="text-xs font-mono">
            {ticket.ticket_id}
          </Badge>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      )}

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 flex flex-col items-center gap-3 py-8">
            <XCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={onBack}>
              Go back
            </Button>
          </CardContent>
        </Card>
      )}

      {ticket && !loading && !error && (
        <>
          {/* Header info */}
          <div>
            <h2 className="font-semibold text-lg">
              {(ticket.product as Record<string, unknown>)?.product_name as string ||
                ticket.ticket_id}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {ticket.created_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(ticket.created_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Active pipeline */}
          {isActive && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <PipelineProgress status={ticket.status} />
                <CallsProgress status={ticket} />

                {ticket.web_deals && ticket.web_deals.deals.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-xs font-medium text-muted-foreground">
                          Online deals found
                        </p>
                      </div>
                      {ticket.web_deals.deals.slice(0, 3).map((deal, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs px-2"
                        >
                          <span className="text-muted-foreground truncate">
                            {deal.platform}
                          </span>
                          {deal.price != null && (
                            <span className="text-green-400 shrink-0 ml-2">
                              ₹{deal.price}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Failed state */}
          {ticket.status === "failed" && (
            <Card className="border-destructive/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Something went wrong</span>
                </div>
                {ticket.error && (
                  <p className="text-sm text-muted-foreground">{ticket.error}</p>
                )}
                <Button size="sm" variant="outline" onClick={onNewQuery} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try a new query
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Completed with options */}
          {ticket.status === "completed" && options && (
            <ResultsView options={options} ticket={ticket} onRetry={onNavigateToTicket} />
          )}

          {/* Completed but loading options */}
          {ticket.status === "completed" && !options && (
            <div className="flex items-center gap-2 p-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading results...</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
