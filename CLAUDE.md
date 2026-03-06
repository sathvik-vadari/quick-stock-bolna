# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
# Install dependencies and create venv
uv sync

# Run backend (with hot reload)
uv run python -m app.main
# Backend starts at http://localhost:8000

# Expose publicly for Bolna webhooks (required during dev)
ngrok http 8000
```

### Frontend
```bash
cd frontend
bun install
bun run dev      # http://localhost:3000
bun run build
bun run lint     # eslint
```

### Database
```bash
createdb quickstock
# Tables are auto-created on first backend run via init_db()
```

## Architecture

QuickStock is a voice AI platform where users submit a product query + location, and the system automatically calls nearby stores via Bolna (outbound voice AI) to check availability.

### Request Pipeline (background task, triggered by `POST /api/ticket`)

1. **Gemini** analyzes the query intent (`app/services/gemini_client.py`)
2. **Azure OpenAI (GPT-4o)** researches the product — name, specs, alternatives, store search terms (`app/services/product_research.py`)
3. **Gemini + Google Search grounding** finds online deals in parallel (`app/services/web_deals.py`)
4. **Google Maps Places API** finds nearby stores with phone numbers (`app/services/google_maps.py`)
5. **Gemini** re-ranks stores by relevance
6. **Bolna** places parallel outbound calls to stores (`app/services/store_caller.py` → `app/services/bolna_client.py`)
7. **Bolna webhook** (`POST /api/bolna/webhook`) fires when each call ends with transcript
8. **Azure OpenAI** analyzes each transcript for availability/price/delivery (`app/services/transcript_analyzer.py`)
9. Once all calls are complete, `_compile_final_result` scores and ranks stores, saves to DB
10. Frontend polls `GET /api/ticket/{id}` for progress, then fetches `GET /api/ticket/{id}/options` for final results

### Key Design Patterns

- **Ticket ID format**: `TKT-001`, `TKT-002`, etc. — sequentially generated from DB
- **Bolna call routing**: `ticket_id` and `store_call_id` are embedded in `user_data` passed to Bolna; the webhook uses these to match call results back to the DB record
- **Template variables**: Bolna agent system prompt uses `{{user_data.variable}}` syntax; `_build_user_data()` in `store_caller.py` builds this payload with product, store, and regional context
- **Regional context**: `app/helpers/regional.py` detects city/region from location string and injects language/greeting style into calls
- **Calls only allowed 10:00 AM–10:30 PM IST** (enforced in `store_caller.py`)
- **Test mode**: Set `TEST_MODE=true` + `TEST_PHONE` in `.env` to call a single test number instead of real stores
- **DB connections**: `psycopg2` with a threading lock in `app/db/connection.py`; all queries use `RealDictCursor` for dict-like row access; tables are created on startup via `init_db()`
- **LLM logging**: Every Azure OpenAI and Gemini call is logged to `llm_logs` table; Bolna API calls logged to `tool_call_logs`
- **Prompts**: Loaded from `app/prompts/*.txt` via `app/helpers/prompt_loader.py`

### Stack
- **Backend**: FastAPI + Uvicorn, Python 3.12, `pip install -e .` (pyproject.toml)
- **Database**: PostgreSQL (psycopg2-binary, no ORM — raw SQL)
- **Voice AI**: Bolna (outbound calls)
- **LLMs**: Azure OpenAI GPT-4o (product research, transcript analysis, options summary), Google Gemini 2.0 Flash (query analysis, web deals with Google Search grounding, store re-ranking)
- **Store discovery**: Google Maps Places API (New) via `app/services/google_maps.py`
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix UI), `bun` preferred

### Frontend Structure
- `frontend/src/app/page.tsx` — single-page app with split-panel layout
- `frontend/src/components/query-panel.tsx` — query submission form
- `frontend/src/components/tracking-panel.tsx` — live polling + results display
- `frontend/src/lib/api.ts` — typed API client; `NEXT_PUBLIC_API_URL` env var controls backend URL (defaults to `http://localhost:8000`)

## Environment
Copy `.env.example` to `.env`. Key variables:
- `DATABASE_URL` — PostgreSQL connection string
- `BOLNA_API_KEY`, `BOLNA_AGENT_ID`, `BOLNA_SERVER_URL` — Bolna agent credentials + public webhook URL
- `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT` — Azure OpenAI
- `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY` — Google services
- `MAX_STORES_TO_CALL` — cap on parallel Bolna calls per ticket (default: 4)
- `TEST_MODE=true` + `TEST_PHONE` — call your own number instead of real stores
