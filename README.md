# QuickStock

Multi-LLM voice commerce platform for India — type what you need, and QuickStock **calls nearby stores on the phone**, checks availability, pricing, and delivery from live conversations, and compares it all against online deals.

You want a product. You don't know which store has it, what the fair price is, whether they deliver, or if there's a better deal online. Finding out means 30+ minutes of Googling, calling stores that don't pick up, and comparing half-remembered prices — and you still aren't sure you got the best option. QuickStock calls up stores simultaneously, gets real answers from real conversations, pulls online deals in parallel, scores everything, and hands you a ranked comparison — in the time it takes one store to answer the phone. Plug in a logistics provider and the item shows up at your door. One query, full circle.

## How It Works

```
User submits query + location
              │
              ▼
┌──────────────────────┐
│    Query Analyzer    │  ← Gemini: specific store vs generic product,
│                      │     search strategy, intent detection
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│   Product Research   │  ← Azure OpenAI GPT-5.3: specs, price tier,
│                      │     preferred retailers, alternatives,
│                      │     Google Maps search terms
└──────────┬───────────┘
           │
           ├─────────────────────────────────────────────┐
           │              runs in parallel               │
           ▼                                             ▼
┌──────────────────────┐                   ┌──────────────────────┐
│    Store Finder      │                   │     Web Deals        │
│    Google Maps API   │                   │     Gemini + Google  │
│    + geocoding       │                   │     Search grounding │
└──────────┬───────────┘                   │                      │
           ▼                               │  4 parallel angles:  │
┌──────────────────────┐                   │  • price comparison  │
│    Store Re-Ranker   │                   │  • deals & offers    │
│    Gemini ranks by:  │                   │  • quick commerce    │
│    • named store     │                   │  • niche / surprise  │
│      match first     │                   └──────────┬───────────┘
│    • preferred       │                              │
│      retailers ↑     │                              │
│    • price tier logic│                              │
│    • distance/rating │                              │
└──────────┬───────────┘                              │
           ▼                                          │
┌──────────────────────┐                              │
│    Store Caller      │                              │
│    Bolna outbound    │                              │
│    parallel calls    │                              │
│                      │                              │
│ ┌──────────────────┐ │                              │
│ │ no answer? retry │ │                              │
│ │ busy? retry once │ │                              │
│ │ failed? mark it  │ │                              │
│ └──────────────────┘ │                              │
└──────────┬───────────┘                              │
           ▼                                          │
┌──────────────────────┐                              │
│  Transcript Analyzer │  ← Azure OpenAI: structured  │
│  per-call extraction │     extraction from live     │
│  of price, stock,    │     conversation transcript  │
│  delivery, specs     │                              │
└──────────┬───────────┘                              │
           │                                          │
           ▼                                          ▼
┌──────────────────────────────────────────────────────────┐
│                    Options Summary                       │
│  ← Azure OpenAI: score, rank, and summarize all store    │
│    results + web deals into a user-facing verdict        │
│                                                          │
│  Scoring: (match_type × 3) + (specs_match × 2) + quality │
│  Ranked by: composite score desc → price asc             │
└──────────────────────────────────┬───────────────────────┘
                                   ▼
                           User sees results
                     (SSE real-time → final options)
```

## What Makes This Complex

- **5 LLM calls per ticket** across two providers (Azure OpenAI + Google Gemini), each with different strengths — Gemini for search-grounded web data, GPT for structured extraction
- **Parallel outbound phone calls** to real stores via Bolna voice AI, with automatic retry on no-answer/busy (120s backoff, one retry per store)
- **4 parallel web searches** via Gemini with Google Search grounding, each targeting a different angle (price comparison, deals, quick commerce, niche platforms)
- **Smart store prioritization** — named stores get exact-match priority; preferred retailers are boosted for premium products; budget queries favor proximity
- **Real-time SSE streaming** — every pipeline stage, every call status change, every transcript arrival pushes an update to the frontend instantly
- **Regional voice adaptation** — detects city from location string and adjusts language, greeting style, and communication tone (Kannada in Bangalore, Tamil in Chennai, Bengali in Kolkata, Hinglish default)
- **Composite scoring algorithm** that weights product match type, spec accuracy, and data quality to rank options
- **Full audit trail** — every LLM call (prompt, response, tokens, latency) and every tool call logged to dedicated tables

## Tech Stack

| Layer           | Tech                                                      |
| --------------- | --------------------------------------------------------- |
| Backend         | FastAPI + Uvicorn, Python 3.12                            |
| Database        | PostgreSQL (raw SQL, no ORM — 7 tables)                   |
| Voice AI        | Bolna (outbound calls, Deepgram STT, Cartesia TTS)        |
| LLMs            | Azure OpenAI GPT-5.3, Google Gemini 3.0 Flash             |
| Store Discovery | Google Maps Places API (New) + Geocoding API              |
| Online Deals    | Gemini with Google Search grounding (4 parallel searches) |
| Frontend        | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Real-time       | Server-Sent Events (SSE)                                  |
| Package Mgmt    | `uv` (Python), `bun` (frontend)                           |

## Dashboard

The frontend ships with a full operational dashboard:

- **4 stat cards** — total queries, calls made, products found, success rate — each with live sub-metrics
- **Call outcomes donut chart** — available / unavailable / no answer / in progress breakdown
- **Activity area chart** — query volume over the last 24 hours
- **Recent queries list** — live status dots (pulsing blue for active, green for completed, red for failed), ticket ID, product, location, call summary ratio, relative timestamps
- **Query panel** — submit a product + location + phone, then watch the 5-stage pipeline progress in real time with per-store call status, prices as they come in, and an online deals preview
- **Ticket detail view** — full results with ranked store option cards (match type badges, delivery info, pricing), transcript viewer (chat-bubble format with bot/user turns), web deals carousel with confidence scoring and "Best Deal" banners
- **Retry mechanism** — when all calls fail, users can refine their query and adjust max stores (1–10) directly from the results view

All updates are **SSE-driven** — no polling. The frontend subscribes to `GET /api/ticket/{id}/events` and every status change, transcript arrival, and analysis result pushes instantly.

## Project Structure

```
app/
├── main.py                        # FastAPI entry, CORS, lifespan, auto-migration
├── db/
│   ├── connection.py              # PostgreSQL pool + schema init (7 tables)
│   └── tickets.py                 # All ticket/store/call/deal CRUD (raw SQL)
├── helpers/
│   ├── config.py                  # Centralized env config (Config class)
│   ├── events.py                  # SSE pub/sub (TicketEvents)
│   ├── logger.py                  # Logging setup
│   ├── prompt_loader.py           # Load prompts from app/prompts/
│   └── regional.py                # City detection → language/greeting/style
├── prompts/                       # LLM prompt templates (.txt)
│   ├── query_analyzer.txt         # Gemini: intent + search strategy
│   ├── product_research.txt       # GPT-5.3: specs + alternatives
│   ├── store_caller.txt           # Bolna agent system prompt
│   ├── transcript_analyzer.txt    # GPT-5.3: structured call extraction
│   ├── options_summary.txt        # GPT-5.3: user-facing verdict
│   └── web_deals.txt              # Gemini: deal synthesis
├── routes/
│   ├── ticket_routes.py           # REST + SSE + dashboard endpoints
│   └── bolna_webhook.py           # Call-end handler + retry logic
└── services/
    ├── gemini_client.py           # Query analysis + store re-ranking
    ├── product_research.py        # Azure OpenAI product extraction
    ├── web_deals.py               # 4-angle parallel Gemini web search
    ├── google_maps.py             # Places API: search + dedup + details
    ├── geocoding.py               # Forward geocoding + pincode extraction
    ├── store_caller.py            # Parallel Bolna call orchestration
    ├── bolna_client.py            # Bolna API client (retry w/ backoff)
    ├── transcript_analyzer.py     # Call transcript → structured JSON
    └── options_summary.py         # Score, rank, summarize all options

frontend/
├── src/
│   ├── app/                       # Next.js app router (layout, page)
│   ├── components/
│   │   ├── dashboard.tsx          # Stats, charts, recent queries
│   │   ├── query-panel.tsx        # Query form + live pipeline tracker
│   │   ├── ticket-detail.tsx      # Results, transcripts, web deals
│   │   └── ui/                    # shadcn/ui primitives
│   └── lib/
│       ├── api.ts                 # Typed API client + SSE subscription
│       └── utils.ts               # Tailwind helpers
├── package.json
└── next.config.ts
```

## Store Prioritization & Call Handling

### Smart ranking by query type

| Query type                                     | Ranking strategy                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| **Named store** ("Boss Burger in Koramangala") | Exact/close name match first, then by distance                          |
| **Premium product** (₹5,000+)                  | Preferred retailers and known chains boosted; small shops deprioritized |
| **Mid-range** (₹500–5,000)                     | Balanced: reputation + convenience, slight preferred retailer boost     |
| **Budget** (<₹500)                             | Proximity first, then category relevance and rating                     |

When a user names a specific store, Google Maps runs two extra targeted searches (bare name + name with area) before generic queries, ensuring the named store surfaces even if it's not the closest result.

### Call failure handling

| Outcome                | Action                                        |
| ---------------------- | --------------------------------------------- |
| **No answer**          | Auto-retry after 120s (one retry per store)   |
| **Busy**               | Auto-retry after 120s (one retry per store)   |
| **Failed / error**     | Marked failed with descriptive note           |
| **Cancelled**          | Marked failed, no retry                       |
| **Call window closed** | Calls skipped entirely (10 AM – 10:30 PM IST) |

When all calls for a ticket are resolved (analyzed or failed), the system automatically compiles and scores the final result.

## Database Schema

Seven tables, auto-created on first boot:

| Table             | Purpose                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `tickets`         | Top-level request tracking — query, location, status, final result, options cache                                         |
| `ticket_products` | Extracted product details: name, category, specs (JSONB), price tier, alternatives                                        |
| `ticket_stores`   | Discovered stores: name, address, phone, rating, coordinates, call priority                                               |
| `store_calls`     | Per-store call records: Bolna call ID, transcript (raw + JSON), full analysis, pricing, delivery, match type, retry count |
| `web_deals`       | Online deal results: structured deals array, best deal, surprise finds, price range, grounding metadata                   |
| `llm_logs`        | Full LLM audit trail: prompt, response, model, tokens in/out, latency per call                                            |
| `tool_call_logs`  | Bolna/tool execution audit: input params, output, status, latency                                                         |

## Regional Support

Calls are always in Hindi/Hinglish, but the voice agent adapts its tone, greetings, and honorifics per city — "dada" in Kolkata, "saar" in Bangalore, "bhai" in Mumbai — auto-detected from the location string.

## API Endpoints

| Method | Path                       | Description                                                     |
| ------ | -------------------------- | --------------------------------------------------------------- |
| `POST` | `/api/ticket`              | Submit a product query + location → kicks off full pipeline     |
| `GET`  | `/api/ticket/{id}`         | Poll for ticket status, progress, and intermediate results      |
| `GET`  | `/api/ticket/{id}/events`  | SSE stream — real-time updates for every pipeline stage         |
| `GET`  | `/api/ticket/{id}/options` | Final ranked results: store options + web deals + verdict       |
| `GET`  | `/api/tickets`             | List all tickets (supports `limit` and `offset`)                |
| `GET`  | `/api/dashboard`           | Aggregated stats: totals, success rate, call outcomes, activity |
| `POST` | `/api/bolna/webhook`       | Bolna calls this when each store call ends                      |
| `GET`  | `/health`                  | Health check                                                    |

**Create ticket:**

```json
POST /api/ticket
{
  "query": "2kg Prestige pressure cooker",
  "location": "Indiranagar, Bangalore",
  "user_phone": "+919876543210",
  "user_name": "Priya"
}
```

**Options response (after completion):**

```json
GET /api/ticket/TKT-001/options
{
  "ticket_id": "TKT-001",
  "product_requested": "2kg Prestige pressure cooker",
  "options": [
    {
      "rank": 1,
      "store_name": "Kumar Kitchen Store",
      "address": "100ft Road, Indiranagar",
      "matched_product": "Prestige Svachh 2L",
      "price": 1499,
      "product_match_type": "exact",
      "delivery_available": true,
      "delivery_eta": "same day",
      "call_summary": "Store confirmed Prestige Svachh 2L in stock at ₹1,499..."
    }
  ],
  "web_deals": [
    {
      "platform": "Amazon",
      "product_title": "Prestige Svachh 2L Pressure Cooker",
      "price": 1399,
      "original_price": 1895,
      "discount_percent": 26,
      "url": "https://amazon.in/...",
      "delivery_estimate": "2-3 days",
      "in_stock": true
    }
  ],
  "message": "Hey Priya! We called 4 stores near Indiranagar for you...",
  "quick_verdict": "Best deal: Kumar Kitchen Store has it for ₹1,499 with free same-day delivery"
}
```

## Setup

### Prerequisites

- Python 3.12+
- Node.js 18+ / Bun
- PostgreSQL
- A [Bolna](https://app.bolna.dev) account with an outbound agent
- API keys: Azure OpenAI, Google Gemini, Google Maps
- A public URL for webhooks (ngrok during development)

### Step 1 — Create Your Bolna Agent

Go to [app.bolna.dev](https://app.bolna.dev) and create a new **outbound** agent:

- **Synthesizer (TTS):** ElevenLabs
- **Transcriber (STT):** Deepgram
- **LLM:** GPT-5.3
- **First message:** `Hello, is this {{user_data.store_name}}?`
- **System Prompt:** paste the contents of `app/prompts/store_caller.txt`

The prompt uses `{{user_data.variable}}` template variables that get injected per-call with product, store, and regional context.

**Webhook URL:** `POST https://your-public-url/api/bolna/webhook`

Copy your **Agent ID** from the URL or settings page.

### Step 2 — Database

```bash
createdb quickstock
```

Tables are auto-created on first backend run.

### Step 3 — Backend

```bash
uv sync                    # install dependencies
cp .env.example .env       # configure API keys
ngrok http 8000            # expose for Bolna webhooks
uv run python -m app.main  # start backend on :8000
```

### Step 4 — Frontend

```bash
cd frontend
bun install
bun run dev                # start on :3000
```

## Environment Variables

| Variable                   | Description                                 | Default                                                    |
| -------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string                | `postgresql://postgres:postgres@localhost:5432/quickstock` |
| `BOLNA_API_KEY`            | Bolna API key                               | —                                                          |
| `BOLNA_AGENT_ID`           | Bolna outbound agent ID                     | —                                                          |
| `BOLNA_SERVER_URL`         | Public webhook URL (ngrok during dev)       | —                                                          |
| `AZURE_OPENAI_API_KEY`     | Azure OpenAI API key                        | —                                                          |
| `AZURE_OPENAI_ENDPOINT`    | Azure OpenAI endpoint                       | —                                                          |
| `AZURE_OPENAI_API_VERSION` | API version                                 | `2025-04-01-preview`                                       |
| `AZURE_OPENAI_DEPLOYMENT`  | Deployment name                             | `gpt-4o`                                                   |
| `GOOGLE_MAPS_API_KEY`      | Google Maps Places + Geocoding API key      | —                                                          |
| `GEMINI_API_KEY`           | Google Gemini API key                       | —                                                          |
| `GEMINI_MODEL`             | Gemini model                                | `gemini-flash-latest`                                      |
| `MAX_STORES_TO_CALL`       | Max parallel Bolna calls per ticket         | `4`                                                        |
| `MAX_ALTERNATIVES`         | Max product alternatives to research        | `3`                                                        |
| `TEST_MODE`                | Call your own number instead of real stores | `false`                                                    |
| `TEST_PHONE`               | Your phone number for test mode             | —                                                          |

## License

This project does not currently include a license. All rights reserved.
