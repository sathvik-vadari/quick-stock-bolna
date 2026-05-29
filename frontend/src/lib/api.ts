import * as demo from "./demo-data";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// When the live backend is offline, serve realistic sample data so the portfolio
// build stays fully explorable. Flip to false to force live-only behaviour.
const DEMO_FALLBACK = true;

export type BackendStatus = "checking" | "online" | "offline";

let _backendStatus: BackendStatus = "checking";
const _listeners = new Set<(s: BackendStatus) => void>();

export function getBackendStatus(): BackendStatus {
  return _backendStatus;
}

function setBackendStatus(s: BackendStatus) {
  if (s === _backendStatus) return;
  _backendStatus = s;
  _listeners.forEach((fn) => fn(s));
}

export function onBackendStatusChange(fn: (s: BackendStatus) => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export async function checkBackendHealth(): Promise<boolean> {
  const tag = "%c[QuickStock Backend Health]";
  const start = performance.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    const elapsed = Math.round(performance.now() - start);

    if (res.ok) {
      console.log(
        `${tag} %cONLINE %c(${elapsed}ms) — ${API_BASE}`,
        "font-weight:bold",
        "color:#22c55e;font-weight:bold",
        "color:#888"
      );
      setBackendStatus("online");
      return true;
    }

    console.warn(
      `${tag} %cUNHEALTHY %c— HTTP ${res.status} (${elapsed}ms) — ${API_BASE}`,
      "font-weight:bold",
      "color:#f59e0b;font-weight:bold",
      "color:#888"
    );
    setBackendStatus("offline");
    return false;
  } catch {
    const elapsed = Math.round(performance.now() - start);
    console.error(
      `${tag} %cOFFLINE %c(${elapsed}ms) — ${API_BASE}\n` +
        `  ↳ The Azure backend appears to be stopped. Start it before using the app.`,
      "font-weight:bold",
      "color:#ef4444;font-weight:bold",
      "color:#888"
    );
    setBackendStatus("offline");
    return false;
  }
}

// Run the health check exactly once and share the result. API calls await this
// so they know whether to hit the network or serve demo data — no polling.
let _healthPromise: Promise<boolean> | null = null;
export function ensureHealthChecked(): Promise<boolean> {
  if (!_healthPromise) _healthPromise = checkBackendHealth();
  return _healthPromise;
}

export function isDemoMode(): boolean {
  return DEMO_FALLBACK && _backendStatus === "offline";
}

const demoDelay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  if (_backendStatus === "offline") {
    throw new BackendOfflineError();
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...opts?.headers },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

// Try the live backend; if it's unreachable OR returns a response that doesn't
// look like valid QuickStock data (e.g. another server is on the same port, or
// the backend is paused), fall back to demo data and surface the demo badge.
async function liveOrDemo<T>(
  fetcher: () => Promise<T>,
  isValid: (v: T) => boolean,
  demoValue: () => T
): Promise<T> {
  await ensureHealthChecked();
  if (isDemoMode()) {
    await demoDelay();
    return demoValue();
  }
  try {
    const v = await fetcher();
    if (!isValid(v)) throw new Error("malformed response");
    return v;
  } catch {
    setBackendStatus("offline"); // serve demo data + show the demo badge
    return demoValue();
  }
}

export class BackendOfflineError extends Error {
  constructor() {
    super("Backend is offline");
    this.name = "BackendOfflineError";
  }
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface TicketRequest {
  query: string;
  location: string;
  user_phone: string;
  user_name?: string;
  max_stores?: number;
  test_mode?: boolean;
  test_phone?: string;
}

export interface TicketResponse {
  ticket_id: string;
  status: string;
  message: string;
}

export interface TranscriptMessage {
  role: "assistant" | "user" | string;
  content: string;
}

export interface StoreCall {
  id: number;
  store_id: number;
  bolna_call_id: string | null;
  status: string;
  product_available: boolean | null;
  matched_product: string | null;
  price: number | null;
  delivery_available: boolean | null;
  delivery_eta: string | null;
  delivery_mode: string | null;
  delivery_charge: number | null;
  product_match_type: string | null;
  notes: string | null;
  call_analysis: Record<string, unknown> | null;
  store_name: string;
  phone_number: string | null;
  rating: number | null;
  address: string | null;
  transcript: string | null;
  transcript_json: TranscriptMessage[] | null;
}

export interface TicketStatus {
  ticket_id: string;
  status: string;
  query?: string;
  location?: string;
  user_phone?: string;
  user_name?: string;
  created_at?: string;
  updated_at?: string;
  error?: string;
  result?: Record<string, unknown>;
  product?: Record<string, unknown>;
  stores?: Record<string, unknown>[];
  store_calls?: StoreCall[];
  progress?: {
    stores_found: number;
    calls_total: number;
    calls_completed: number;
    calls_in_progress: number;
  };
  web_deals?: {
    search_summary?: string;
    deals: WebDeal[];
    best_deal?: { platform: string; price?: number; reason?: string };
    surprise_finds?: string;
    status?: string;
  };
}

export interface OptionItem {
  rank: number;
  store_name: string;
  address?: string;
  phone_number?: string;
  rating?: number;
  matched_product?: string;
  price?: number;
  product_match_type?: string;
  delivery_available?: boolean;
  delivery_eta?: string;
  delivery_charge?: number;
  call_summary?: string;
  notes?: string;
}

export interface WebDeal {
  platform: string;
  product_title?: string;
  price?: number;
  original_price?: number;
  discount_percent?: number;
  url?: string;
  offer_details?: string;
  delivery_estimate?: string;
  in_stock?: boolean;
  why_notable?: string;
}

export interface OptionsResponse {
  ticket_id: string;
  product_requested: string;
  customer_specs?: Record<string, unknown>;
  stores_contacted: number;
  calls_connected: number;
  options_found: number;
  options: OptionItem[];
  web_deals?: WebDeal[];
  web_deals_summary?: string;
  web_deals_best?: { platform: string; price?: number; reason?: string };
  message: string;
  quick_verdict?: string;
  error?: string;
  status?: string;
}

// ── Dashboard / listing types ─────────────────────────────────────────────

export interface TicketListItem {
  id: number;
  ticket_id: string;
  query: string;
  location: string;
  status: string;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
  product_name?: string;
  total_calls: number;
  available_count: number;
}

export interface DashboardStats {
  total_tickets: number;
  status_counts: Record<string, number>;
  total_calls: number;
  call_outcomes: {
    available: number;
    unavailable: number;
    failed: number;
    in_progress: number;
  };
  stores_contacted: number;
  hourly_activity: { hour: string; count: number }[];
  completed: number;
  failed: number;
  in_progress: number;
  products_found: number;
  success_rate: number;
}

// ── API Functions ──────────────────────────────────────────────────────────

export function createTicket(data: TicketRequest): Promise<TicketResponse> {
  return liveOrDemo(
    () => request<TicketResponse>("/api/ticket", { method: "POST", body: JSON.stringify(data) }),
    (v) => !!v && typeof v.status === "string",
    () => demo.createDemoTicket(data)
  );
}

export function getTicketStatus(ticketId: string): Promise<TicketStatus> {
  return liveOrDemo(
    () => request<TicketStatus>(`/api/ticket/${ticketId}`),
    (v) => !!v && typeof v.ticket_id === "string",
    () => demo.getDemoTicketStatus(ticketId)
  );
}

export function getTicketOptions(ticketId: string): Promise<OptionsResponse> {
  return liveOrDemo(
    () => request<OptionsResponse>(`/api/ticket/${ticketId}/options`),
    (v) => !!v && (typeof v.ticket_id === "string" || Array.isArray(v.options)),
    () => demo.getDemoOptions(ticketId)
  );
}

export function subscribeToTicket(
  ticketId: string,
  onUpdate: (status: TicketStatus) => void,
  onError?: () => void
): () => void {
  if (isDemoMode()) {
    return demo.simulateDemoTicket(ticketId, onUpdate);
  }
  const url = `${API_BASE}/api/ticket/${ticketId}/events`;
  const es = new EventSource(url);

  es.onmessage = (event) => {
    try {
      onUpdate(JSON.parse(event.data) as TicketStatus);
    } catch {
      // malformed event
    }
  };

  es.onerror = () => {
    es.close();
    onError?.();
  };

  return () => es.close();
}

export function listTickets(
  limit = 50,
  offset = 0
): Promise<{ tickets: TicketListItem[]; count: number }> {
  return liveOrDemo(
    () => request<{ tickets: TicketListItem[]; count: number }>(`/api/tickets?limit=${limit}&offset=${offset}`),
    (v) => !!v && Array.isArray(v.tickets),
    () => ({ tickets: demo.DEMO_TICKET_LIST, count: demo.DEMO_TICKET_LIST.length })
  );
}

export function getDashboardStats(): Promise<DashboardStats> {
  return liveOrDemo(
    () => request<DashboardStats>("/api/dashboard"),
    (v) => !!v && typeof v.total_tickets === "number",
    () => demo.DEMO_DASHBOARD_STATS
  );
}
