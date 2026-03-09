# QuickStock — AI Voice Store Availability Checker

A voice AI platform that automatically calls nearby stores to check product availability, pricing, and delivery options — saving customers the time of calling stores manually.

## The Problem

Customers waste 15–20 minutes calling local stores one by one to check if a product is in stock. Retail and e-commerce businesses lose sales because customers can't easily compare local availability vs. online prices.

**QuickStock** solves this with a voice AI agent (powered by Bolna) that calls multiple stores simultaneously, extracts key info, and presents a clear comparison — in under 2 minutes.

## Architecture

```
User (Next.js web app)
    │
    ▼  POST /api/ticket
┌───────────────────────────────┐
│       FastAPI Backend         │
│    (Python 3.12, PostgreSQL)  │
│                               │
│  1. Gemini: analyze query     │
│  2. Azure OpenAI: research    │
│  3. Gemini: web deals ────────┼──► Google Search grounding
│     (runs in parallel)        │
│  4. Google Maps: find stores  │
│  5. Gemini: re-rank stores    │
│  6. Bolna: call stores ───────┼──► Bolna Voice Agent
│     (parallel outbound)       │         │
│                               │◄─────── │ webhook + transcript
│  7. Azure OpenAI: analyze     │
│  8. Azure OpenAI: summarize   │
└───────────────────────────────┘
    │
    ▼  SSE /api/ticket/:id/events (real-time)
    ▼  GET /api/ticket/:id/options (final)
Next.js Frontend (frontend/)
```

## Tech Stack

| Layer           | Tech                                                      |
| --------------- | --------------------------------------------------------- |
| Backend         | FastAPI + Uvicorn, Python 3.12                            |
| Database        | PostgreSQL (raw SQL, no ORM)                              |
| Voice AI        | **Bolna** (outbound calls)                                |
| LLMs            | Azure OpenAI (GPT-4o), Google Gemini 2.0 Flash            |
| Store Discovery | Google Maps Places API (New)                              |
| Online Deals    | Gemini with Google Search grounding                       |
| Frontend        | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Package Mgmt    | `uv` (Python), `bun` (frontend)                          |

## Project Structure

```
quick-stock-bolna/
├── app/                        # Python FastAPI backend
│   ├── main.py                 # FastAPI entry point + CORS + lifespan
│   ├── db/
│   │   ├── connection.py       # PostgreSQL connection pool + init_db()
│   │   └── tickets.py          # All ticket/store/call CRUD queries
│   ├── helpers/
│   │   ├── config.py           # Centralized env var config (Config class)
│   │   ├── events.py           # SSE event bus (TicketEvents)
│   │   ├── logger.py           # Logging setup
│   │   ├── prompt_loader.py    # Load prompts from app/prompts/
│   │   └── regional.py         # City/region detection for call context
│   ├── prompts/                # LLM prompt templates (.txt)
│   │   ├── query_analyzer.txt
│   │   ├── product_research.txt
│   │   ├── store_caller.txt    # Bolna agent system prompt
│   │   ├── transcript_analyzer.txt
│   │   ├── options_summary.txt
│   │   └── web_deals.txt
│   ├── routes/
│   │   ├── ticket_routes.py    # Ticket CRUD + SSE + dashboard endpoints
│   │   └── bolna_webhook.py    # POST /api/bolna/webhook
│   └── services/
│       ├── gemini_client.py    # Query analysis + store re-ranking
│       ├── product_research.py # Azure OpenAI product research
│       ├── web_deals.py        # Gemini + Google Search grounding
│       ├── google_maps.py      # Places API store discovery
│       ├── geocoding.py        # Address geocoding + pincode extraction
│       ├── store_caller.py     # Orchestrates parallel Bolna calls
│       ├── bolna_client.py     # Bolna API client
│       ├── transcript_analyzer.py  # Call transcript → structured data
│       └── options_summary.py  # Final user-facing summary generation
├── frontend/                   # Next.js frontend
│   ├── src/
│   │   ├── app/                # Next.js app router (layout, page, globals.css)
│   │   ├── components/
│   │   │   ├── dashboard.tsx   # Main dashboard (stats + recent tickets)
│   │   │   ├── query-panel.tsx # Query submission form
│   │   │   ├── ticket-detail.tsx # Live ticket tracking + results display
│   │   │   └── ui/            # shadcn/ui components
│   │   └── lib/
│   │       ├── api.ts          # Typed API client + SSE helper
│   │       └── utils.ts        # Utility functions
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.ts
├── test_pipeline.py            # End-to-end pipeline test script
├── pyproject.toml              # Python dependencies (uv)
├── .env.example                # Environment variable template
└── README.md
```

## Step 1 — Create Your Bolna Agent

Go to [app.bolna.dev](https://app.bolna.dev) and create a new **outbound** agent:

**Agent Settings:**

- **Agent Type:** Outbound
- **Synthesizer (TTS):** Cartesia (recommended) or ElevenLabs
- **Transcriber (STT):** Deepgram
- **LLM:** GPT-4o
- **First message:** `Hello, is this {{user_data.store_name}}?`

**System Prompt** — paste the contents of `app/prompts/store_caller.txt`

> The prompt uses `{{user_data.variable}}` template variables that get injected per-call with the product, store, and regional context. Verify the exact variable syntax matches your Bolna account's templating (some versions use `{variable}` instead).

**Tools (optional):**

You can add webhook tools to the Bolna agent for structured data extraction during calls:

| Tool name                     | Description                                              |
| ----------------------------- | -------------------------------------------------------- |
| `report_product_availability` | Reports if the product is available, its price and specs |
| `report_delivery_info`        | Reports delivery yes/no and ETA                          |
| `report_alternative_product`  | Reports an alternative product the store suggested       |

> **Note:** Tools are optional. Without them, the transcript analyzer LLM still extracts all info from the raw call transcript after the call ends.

**Webhook URL:**
`POST https://your-public-url.ngrok.io/api/bolna/webhook`

After saving, copy your **Agent ID** from the URL or settings page.

## Step 2 — Database Setup (PostgreSQL)

Make sure PostgreSQL is running locally, then create the database:

```bash
createdb quickstock
# Or via psql:
# psql -U postgres -c "CREATE DATABASE quickstock;"
```

The app auto-creates all tables on first run via `init_db()`.

## Step 3 — Backend Setup

```bash
# Install dependencies (creates venv automatically)
uv sync

# Configure environment
cp .env.example .env
# Edit .env with your API keys and DB URL

# Expose backend publicly (needed for Bolna webhook during dev)
ngrok http 8000
# Copy the https URL → set as BOLNA_SERVER_URL in .env

# Run the backend
uv run python -m app.main
```

Backend starts at `http://localhost:8000`

## Step 4 — Frontend Setup

```bash
cd frontend

bun install   # or npm install
bun run dev   # or npm run dev
```

Frontend starts at `http://localhost:3000`

## Environment Variables

| Variable                   | Description                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string (default: `postgresql://postgres:postgres@localhost:5432/quickstock`) |
| `BOLNA_API_KEY`            | Bolna API key                                                                                     |
| `BOLNA_AGENT_ID`           | Bolna agent ID (from [app.bolna.dev](https://app.bolna.dev))                                      |
| `BOLNA_SERVER_URL`         | Your public webhook URL (ngrok https URL during dev)                                              |
| `AZURE_OPENAI_API_KEY`     | Azure OpenAI API key                                                                              |
| `AZURE_OPENAI_ENDPOINT`    | Azure OpenAI endpoint URL                                                                         |
| `AZURE_OPENAI_API_VERSION` | API version (default: `2025-04-01-preview`)                                                       |
| `AZURE_OPENAI_DEPLOYMENT`  | Deployment name in Azure (default: `gpt-4o`)                                                      |
| `GOOGLE_MAPS_API_KEY`      | Google Maps Places API key                                                                        |
| `GEMINI_API_KEY`           | Google Gemini API key                                                                             |
| `GEMINI_MODEL`             | Gemini model name (default: `gemini-flash-latest`)                                                |
| `MAX_STORES_TO_CALL`       | Cap on parallel Bolna calls per ticket (default: `4`)                                             |
| `TEST_MODE`                | Set to `true` to call a test number instead of real stores                                        |
| `TEST_PHONE`               | Your phone number for test mode (e.g. `+919876543210`)                                            |
| `SERVER_HOST`              | Backend bind host (default: `0.0.0.0`)                                                            |
| `SERVER_PORT`              | Backend bind port (default: `8000`)                                                               |

## API Endpoints

| Method | Path                          | Description                                       |
| ------ | ----------------------------- | ------------------------------------------------- |
| `POST` | `/api/ticket`                 | Submit a product query + location                 |
| `GET`  | `/api/ticket/{id}`            | Poll for ticket status + progress                 |
| `GET`  | `/api/ticket/{id}/events`     | SSE stream for real-time progress updates         |
| `GET`  | `/api/ticket/{id}/options`    | Get final ranked results after completion         |
| `GET`  | `/api/tickets`                | List all tickets (supports `limit` and `offset`)  |
| `GET`  | `/api/dashboard`              | Aggregated dashboard statistics                   |
| `POST` | `/api/bolna/webhook`          | Bolna calls this when each store call ends        |
| `GET`  | `/health`                     | Health check                                      |

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
      "delivery_available": true,
      "delivery_eta": "same day"
    }
  ],
  "web_deals": [],
  "message": "Hey! We called 4 stores...",
  "quick_verdict": "Best deal: Kumar Kitchen Store at ₹1,499 with free same-day delivery"
}
```

## License

This project does not currently include a license. All rights reserved.
