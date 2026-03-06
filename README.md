# QuickStock — AI Voice Store Availability Checker

> **Bolna Full-Stack Assignment** | Built by [Your Name]

A voice AI platform that automatically calls nearby stores to check product availability, pricing, and delivery options — saving customers the time of calling stores manually.

## The Problem

Customers waste 15–20 minutes calling local stores one by one to check if a product is in stock. Retail and e-commerce businesses lose sales because customers can't easily compare local availability vs. online prices.

**QuickStock** solves this with a voice AI agent (powered by Bolna) that calls multiple stores simultaneously, extracts key info, and presents a clear comparison — in under 2 minutes.

## Architecture

```
User (web app)
    │
    ▼  POST /api/ticket
┌──────────────────────────┐
│     FastAPI Backend       │
│  (Python 3.12, PostgreSQL)│
│                           │
│  1. Gemini: analyze query │
│  2. Azure OpenAI: product │
│  3. Google Maps: stores   │
│  4. Bolna: call stores ───┼──► Bolna Voice Agent
│     (parallel)            │         │
│                           │◄─────── │ webhook + transcript
│  5. Azure OpenAI: analyze │
│  6. Gemini: web deals     │
│  7. Azure OpenAI: summary │
└───────────────────────────┘
    │
    ▼  GET /api/ticket/:id/options
Next.js Frontend (frontend/)
```

## Tech Stack

| Layer      | Tech |
|------------|------|
| Backend    | FastAPI + Uvicorn, Python 3.12 |
| Database   | PostgreSQL |
| Voice AI   | **Bolna** (outbound calls) |
| LLMs       | Azure OpenAI (GPT-4o), Google Gemini 2.0 Flash |
| Store Discovery | Google Maps Places API |
| Online Deals | Gemini with Google Search grounding |
| Frontend   | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |

## Project Structure

```
voice-serve-bolna/
├── app/                        # Python FastAPI backend
│   ├── db/                     # PostgreSQL connection & queries
│   ├── helpers/                # Config, logging, prompt loader
│   ├── prompts/                # LLM prompt templates
│   ├── routes/                 # API endpoints
│   ├── services/               # Business logic (LLM clients, APIs)
│   └── main.py                 # FastAPI entry point
├── frontend/                   # Next.js frontend (self-contained)
│   ├── src/
│   │   ├── app/                # Next.js app router
│   │   ├── components/         # React components + shadcn/ui
│   │   └── lib/                # API client & utils
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.ts
├── pyproject.toml              # Python dependencies
├── .env.example                # Environment template
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

**Tools to add** (under the agent's "Tools" section):

| Tool name | Description |
|-----------|-------------|
| `report_product_availability` | Reports if the product is available, its price and specs |
| `report_delivery_info` | Reports delivery yes/no and ETA |
| `report_alternative_product` | Reports an alternative product the store suggested |

Each tool should be a **webhook** tool pointing to:
`POST {{BOLNA_SERVER_URL}}/api/bolna/tool` (or use Bolna's native tool format)

> **Note:** If you don't add tools, the transcript analyzer LLM will still extract info from the raw transcript. Tools improve accuracy but are optional for a demo.

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

The app auto-creates all tables on first run.

## Step 3 — Backend Setup

```bash
cd voice-serve-bolna

# Install dependencies
pip install -e .

# Configure environment
cp .env.example .env
# Edit .env with your API keys and DB URL

# Expose backend publicly (needed for Bolna webhook during dev)
ngrok http 8000
# Copy the https URL → set as BOLNA_SERVER_URL in .env

# Run the backend
python -m app.main
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

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (default: `postgresql://postgres:postgres@localhost:5432/quickstock`) |
| `AZURE_OPENAI_API_KEY` | Your Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint (e.g. `https://az-openai-shared.openai.azure.com/`) |
| `AZURE_OPENAI_API_VERSION` | API version (default: `2025-04-01-preview`) |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name in Azure (default: `gpt-4o`) |
| `BOLNA_API_KEY` | Bolna API key |
| `BOLNA_AGENT_ID` | Bolna agent ID |
| `BOLNA_SERVER_URL` | Your public webhook URL |
| `GOOGLE_MAPS_API_KEY` | Google Maps Places API key |
| `GEMINI_API_KEY` | Google Gemini API key |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ticket` | Submit a product query |
| `GET` | `/api/ticket/{id}` | Poll for status + progress |
| `GET` | `/api/ticket/{id}/options` | Get final results |
| `POST` | `/api/bolna/webhook` | Bolna calls this when each store call ends |
| `GET` | `/health` | Health check |

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
