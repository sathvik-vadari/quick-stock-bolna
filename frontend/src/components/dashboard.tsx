"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listTickets,
  getDashboardStats,
  BackendOfflineError,
  type TicketListItem,
  type DashboardStats,
} from "@/lib/api";
import {
  Phone,
  MapPin,
  Plus,
  TrendingUp,
  Package,
  PhoneCall,
  ArrowRight,
  Search,
  Zap,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  received: {
    label: "Received",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  analyzing: {
    label: "Analyzing",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  researching: {
    label: "Researching",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  finding_stores: {
    label: "Finding stores",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  calling_stores: {
    label: "Calling stores",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
  completed: {
    label: "Completed",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
  failed: {
    label: "Failed",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden group hover:border-border/80 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const OUTCOME_COLORS: Record<string, string> = {
  available: "oklch(0.723 0.219 149.579)",
  unavailable: "oklch(0.637 0.237 15.168)",
  failed: "oklch(0.556 0 0)",
  in_progress: "oklch(0.623 0.214 259.815)",
};

function OutcomesDonut({
  outcomes,
}: {
  outcomes: DashboardStats["call_outcomes"];
}) {
  const total =
    outcomes.available +
    outcomes.unavailable +
    outcomes.failed +
    outcomes.in_progress;
  if (total === 0) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Call Outcomes
        </p>
        <div className="h-[130px] flex items-center justify-center">
          <p className="text-xs text-muted-foreground">No calls made yet</p>
        </div>
      </div>
    );
  }

  const segments = [
    { key: "available", value: outcomes.available, label: "Available" },
    { key: "unavailable", value: outcomes.unavailable, label: "Unavailable" },
    { key: "failed", value: outcomes.failed, label: "No answer" },
    { key: "in_progress", value: outcomes.in_progress, label: "In progress" },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Call Outcomes
      </p>
      <div className="flex items-center justify-center gap-5">
        <div className="relative h-[130px] w-[130px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={segments}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={58}
                paddingAngle={3}
                strokeWidth={0}
                activeShape={false}
              >
                {segments.map((s) => (
                  <Cell key={s.key} fill={OUTCOME_COLORS[s.key]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.205 0 0)",
                  border: "1px solid oklch(1 0 0 / 10%)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "oklch(0.985 0 0)",
                }}
                wrapperStyle={{ pointerEvents: "none", zIndex: 20 }}
                offset={40}
                formatter={(value, name) => [`${value} calls`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold leading-none">{total}</span>
            <span className="text-[10px] text-muted-foreground">calls</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {segments.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: OUTCOME_COLORS[s.key] }}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {s.label}
              </span>
              <span className="text-xs font-medium">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivityChart({ data }: { data: { hour: string; count: number }[] }) {
  if (data.length < 1) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Recent Activity{" "}
          <span className="normal-case font-normal">(last 24h)</span>
        </p>
        <div className="h-[130px] flex items-center justify-center">
          <p className="text-xs text-muted-foreground">No activity yet</p>
        </div>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.hour).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    short: new Date(d.hour).toLocaleString("en-US", {
      hour: "numeric",
      hour12: true,
    }),
  }));

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Recent Activity{" "}
        <span className="normal-case font-normal">(last 24h)</span>
      </p>
      <div className="h-[130px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={formatted}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="oklch(0.488 0.243 264.376)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="oklch(0.488 0.243 264.376)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="short"
              tick={{ fontSize: 10, fill: "oklch(0.708 0 0)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "oklch(0.708 0 0)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.205 0 0)",
                border: "1px solid oklch(1 0 0 / 10%)",
                borderRadius: 8,
                fontSize: 12,
                color: "oklch(0.985 0 0)",
              }}
              labelFormatter={(l) => l}
              formatter={(value) => [`${value} queries`, ""]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="oklch(0.488 0.243 264.376)"
              strokeWidth={2}
              fill="url(#activityGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TicketRow({
  ticket,
  onClick,
}: {
  ticket: TicketListItem;
  onClick: () => void;
}) {
  const config = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.received;
  const isActive = [
    "received",
    "analyzing",
    "researching",
    "finding_stores",
    "calling_stores",
  ].includes(ticket.status);

  return (
    <button onClick={onClick} className="w-full text-left group">
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div
          className={`h-2 w-2 rounded-full shrink-0 ${
            isActive
              ? "bg-blue-400 animate-pulse"
              : ticket.status === "completed"
                ? "bg-green-500"
                : ticket.status === "failed"
                  ? "bg-red-400"
                  : "bg-muted-foreground"
          }`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {ticket.ticket_id}
            </span>
            <span className="text-sm font-medium truncate">
              {ticket.product_name || ticket.query}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {ticket.location}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {ticket.total_calls > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>
                {ticket.available_count}/{ticket.total_calls}
              </span>
            </div>
          )}
          <Badge
            variant="outline"
            className={`text-[10px] border ${config.bg} ${config.color}`}
          >
            {config.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground w-14 text-right">
            {timeAgo(ticket.created_at)}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onNewQuery }: { onNewQuery: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center">
          <Search className="h-8 w-8 text-blue-400" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
          <Phone className="h-4 w-4 text-green-400" />
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-1">No queries yet</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
        Tell us what you&apos;re looking for and where — our AI will call nearby
        stores to check if they have it in stock.
      </p>
      <Button onClick={onNewQuery} className="gap-2">
        <Zap className="h-4 w-4" />
        Make your first query
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-3 w-full rounded-full" />
      <div className="space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function Dashboard({
  onNewQuery,
  onViewTicket,
}: {
  onNewQuery: () => void;
  onViewTicket: (ticketId: string) => void;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isInitialLoad = useRef(true);
  const prevDataRef = useRef("");

  const refresh = useCallback(async () => {
    const isManual = !isInitialLoad.current;
    setRefreshing(true);
    try {
      const [s, t] = await Promise.all([getDashboardStats(), listTickets(20)]);
      isInitialLoad.current = false;

      const newHash = JSON.stringify({ stats: s, tickets: t.tickets });

      if (isManual && prevDataRef.current === newHash) {
        toast.info("Already up to date");
      } else {
        prevDataRef.current = newHash;
        setStats(s);
        setTickets(t.tickets);
        if (isManual) toast.success("Dashboard refreshed");
      }
    } catch (err) {
      if (isManual && !(err instanceof BackendOfflineError))
        toast.error("Could not reach server");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Header onNewQuery={onNewQuery} onRefresh={refresh} refreshing={refreshing} />
        <LoadingSkeleton />
      </div>
    );
  }

  if (!stats || tickets.length === 0) {
    return (
      <div className="space-y-6">
        <Header onNewQuery={onNewQuery} onRefresh={refresh} refreshing={refreshing} />
        <EmptyState onNewQuery={onNewQuery} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Header onNewQuery={onNewQuery} onRefresh={refresh} refreshing={refreshing} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BarChart3}
          label="Total Queries"
          value={stats.total_tickets}
          sub={
            stats.in_progress > 0 ? `${stats.in_progress} active` : undefined
          }
          accent="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          icon={PhoneCall}
          label="Calls Made"
          value={stats.total_calls}
          sub={`${stats.stores_contacted} stores`}
          accent="bg-violet-500/10 text-violet-400"
        />
        <StatCard
          icon={Package}
          label="Products Found"
          value={stats.products_found}
          accent="bg-green-500/10 text-green-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Success Rate"
          value={`${stats.success_rate}%`}
          sub={`${stats.completed} completed`}
          accent="bg-amber-500/10 text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="px-5 pt-4 pb-5">
            <OutcomesDonut outcomes={stats.call_outcomes} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-5 pt-4 pb-5">
            <ActivityChart data={stats.hourly_activity} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Recent Queries
          </p>
          <span className="text-xs text-muted-foreground">
            {tickets.length} queries
          </span>
        </div>
        <Card className="divide-y divide-border/50 overflow-hidden">
          <CardContent className="p-0">
            {tickets.map((ticket) => (
              <TicketRow
                key={ticket.ticket_id}
                ticket={ticket}
                onClick={() => onViewTicket(ticket.ticket_id)}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Header({
  onNewQuery,
  onRefresh,
  refreshing,
}: {
  onNewQuery: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="relative">
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-32 bg-gradient-to-b from-blue-500/8 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="relative flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">QuickStock</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI calls nearby stores to check availability
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 transition-transform ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={onNewQuery} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Query
          </Button>
        </div>
      </div>
    </div>
  );
}
