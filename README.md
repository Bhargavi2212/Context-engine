# Context Engine — Mistral AI Hackathon Edition

**Cursor for PMs** — an always-on feedback intelligence platform that ingests customer feedback from every source, classifies signal from noise, connects complaints to revenue data, and generates production-ready engineering specs. Multi-agent. Powered by Mistral AI.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Data Flow](#data-flow)
- [Multi-Agent System](#multi-agent-system)
- [Connectors (Slack MCP)](#connectors-slack-mcp)
- [API Overview](#api-overview)
- [Database Schema](#database-schema)
- [Demo Walkthrough](#demo-walkthrough)
- [Built With](#built-with)
- [License](#license)

---

## Overview

Context Engine is a feedback intelligence platform for Product Managers. It uses a multi-agent system on Mistral AI + LangChain + LangGraph to turn scattered customer feedback into prioritized, revenue-aware engineering specs.

**Core Capabilities:**
- **Ingest** feedback from CSV, manual entry, and Slack (Demo Mode or Live MCP)
- **Classify** each item with Mistral (sentiment, feature area, urgency, noise vs signal)
- **Embed** text with Mistral Embed for semantic search
- **Dashboard** — RICE-scored top issues, at-risk customers, volume and sentiment charts
- **Search** — Semantic search over feedback with filters
- **Multi-Agent Chat** — Analyst, Customer, and Spec Writer agents
- **Engineering Specs** — PRD, architecture, rules, and implementation plan from a topic

---

## Features

| Feature | Description |
|--------|-------------|
| **Product Wizard** | 8-step setup: areas, goals, segments, teams, tech stack — injected into agents |
| **Feedback Ingestion** | CSV upload, manual entry, Slack (simulated or live MCP) |
| **Classification Pipeline** | Single Mistral call: sentiment, feature_area, team, urgency, noise detection |
| **Semantic Search** | Mistral Embed + cosine similarity (no vector DB) |
| **RICE Scoring** | Reach × Impact × Confidence / Effort for prioritization |
| **3 Specialized Agents** | Analyst (patterns/trends), Customer (risk/renewals), Spec Writer (4-doc output) |
| **LangSmith Tracing** | Full observability of agent calls and tool usage |
| **Slack Connectors** | Demo mode (JSON feed) or Live MCP (real Slack API via `@modelcontextprotocol/server-slack`) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                  React Frontend (Vite + TypeScript + Tailwind)        │
│  Login │ Dashboard │ Feedback │ Customers │ Specs │ Settings │ Agent │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST API (axios + JWT)
┌──────────────────────────────┴──────────────────────────────────────┐
│                     FastAPI Backend (Python 3.11+)                    │
│                                                                       │
│  Routers: auth, dashboard, feedback, customers, specs, connectors,    │
│           upload, product_context, health, monitoring, agent          │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              LangGraph Router + 3 Agents                       │   │
│  │  ┌────────────┐ ┌─────────────┐ ┌─────────────────────────┐  │   │
│  │  │  Analyst   │ │  Customer   │ │  Spec Writer            │  │   │
│  │  │ (7 tools)  │ │ (5 tools)   │ │ (receives chain output)  │  │   │
│  │  │ mistral-   │ │ mistral-    │ │ mistral-large           │  │   │
│  │  │ medium     │ │ medium      │ │                          │  │   │
│  │  └────────────┘ └─────────────┘ └─────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Classification Pipeline (on ingest)               │   │
│  │  Mistral (JSON mode) → classify  │  Mistral Embed → 1024-dim  │   │
│  │  Fuzzy match → link to customer  │  INSERT into feedback      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │   SQLite     │  │  LangSmith   │  │  Connectors (MCP/stdio)   │   │
│  │   WAL mode   │  │  Tracing     │  │  Simulated Slack (JSON)   │   │
│  │              │  │              │  │  Live Slack (npx server)  │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

**Request flow:**
1. Frontend sends JWT-authenticated requests to `/api/v1/*`
2. Backend routes to auth, dashboard, feedback, etc.
3. Agent requests → LangGraph router → classify intent → route to Analyst / Customer / Spec Writer
4. Classification runs on ingest (CSV, manual, connector) before writing to DB

---

## Tech Stack

### Backend
| Component | Technology |
|-----------|------------|
| Framework | FastAPI |
| Database | SQLite (WAL mode, `aiosqlite` for async) |
| Auth | JWT (python-jose, bcrypt) |
| Classification | Mistral Chat (JSON mode) |
| Embeddings | Mistral Embed (1024 dim) |
| Agents | LangChain + LangGraph, ChatMistralAI |
| Connectors | MCP Python SDK, `@modelcontextprotocol/server-slack` (Node) |
| Observability | LangSmith |

### Frontend
| Component | Technology |
|-----------|------------|
| Framework | React 18, TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Icons | Lucide React |
| HTTP | Axios |
| Routing | React Router 6 |
| Notifications | react-hot-toast |

### Infrastructure
| Mode | Setup |
|------|-------|
| Development | `docker compose up` — backend (8000) + frontend (5173) |
| Production | `docker compose -f docker-compose.prod.yml up` — single container on 8000 |

---

## Project Structure

```
Mistral AI/
├── backend/
│   ├── app/
│   │   ├── agents/           # LangGraph router, analyst, customer, spec_writer
│   │   │   ├── tools/        # analyst_tools, customer_tools
│   │   │   └── state.py
│   │   ├── pipeline/         # classifier, embedder, customer_linker
│   │   ├── routers/          # auth, dashboard, feedback, specs, connectors, etc.
│   │   ├── services/         # feedback_service, connector_service, live_slack_mcp, etc.
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   └── main.py
│   ├── scripts/
│   │   ├── load_demo_data.py
│   │   └── seed_wizard_data.py
│   ├── test-data/
│   │   └── slack_feed.json   # Demo Slack feed
│   ├── Dockerfile            # Python + Node (for npx Slack MCP)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # layout, dashboard, feedback, agent, connectors, etc.
│   │   ├── pages/
│   │   ├── services/         # api, connectorsApi, etc.
│   │   ├── hooks/
│   │   └── types/
│   ├── Dockerfile
│   └── package.json
├── docs/                     # Phase specs, demo script
├── docker-compose.yml        # Dev: backend + frontend
├── docker-compose.prod.yml   # Prod: single service
├── Dockerfile                # Root: prod multi-stage build
├── .env.example
├── PROJECT.md
└── README.md
```

---

## Prerequisites

- **Docker** and **Docker Compose**
- **Mistral API key** from [console.mistral.ai](https://console.mistral.ai)
- **JWT secret** — long random string (e.g. 64 chars)
- **LangSmith** (optional) — for agent tracing

---

## Quick Start

### 1. Clone and enter project

```bash
cd "Mistral AI"
```

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

- `MISTRAL_API_KEY` — from Mistral Console
- `JWT_SECRET_KEY` — long random string

Optional:

- `LANGCHAIN_TRACING_V2=true`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT=context-engine-mistral`

### 3. Run

**Development (backend + frontend):**

```bash
docker compose up
```

Or detached: `docker compose up -d`

**Production (single container):**

```bash
docker compose -f docker-compose.prod.yml up --build
```

### 4. Load demo data (optional)

```bash
docker compose exec backend python -m scripts.load_demo_data
```

Then log in: **demo@contextengine.ai** / **demo123**

### 5. Access

| Mode | Frontend | Backend | Health |
|------|----------|---------|--------|
| Dev | http://localhost:5173 | http://localhost:8000 | http://localhost:8000/api/v1/health |
| Prod | http://localhost:8000 | (same) | http://localhost:8000/api/v1/health |

---

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `MISTRAL_API_KEY` | Yes | Mistral API key |
| `JWT_SECRET_KEY` | Yes | JWT signing secret |
| `DATABASE_PATH` | No | SQLite path (default: `./data/context_engine.db`) |
| `LANGCHAIN_TRACING_V2` | No | Enable LangSmith (`true`/`false`) |
| `LANGCHAIN_API_KEY` | No | LangSmith API key |
| `LANGCHAIN_PROJECT` | No | LangSmith project name |
| `BACKEND_CORS_ORIGINS` | No | CORS origins for backend |
| `VITE_API_BASE_URL` | No | API base URL for frontend |

---

## Data Flow

### Ingestion

1. **CSV upload** — Parse CSV → rows → `process_feedback_batch` (classify, embed, link) → INSERT
2. **Manual entry** — Single item → same pipeline
3. **Connectors** — Background poller reads from:
   - **Demo mode:** `backend/test-data/slack_feed.json`
   - **Live mode:** MCP stdio client → `npx @modelcontextprotocol/server-slack` → `slack_get_channel_history` → `process_single_message` per message

### Classification (per item)

- Mistral Chat (JSON mode) with product context
- Outputs: `is_feedback`, `feedback_type`, `sentiment`, `sentiment_score`, `feature_area`, `team`, `urgency`, `confidence`
- Embedding via Mistral Embed (1024 dim), stored as BLOB
- Fuzzy match on `author_name` to link customer

### Search

- Embed query with Mistral Embed
- Cosine similarity vs stored embeddings
- Filter by product, feature_area, sentiment, date, etc.

---

## Multi-Agent System

### LangGraph Router

- Classifies intent: `analyst` | `customer` | `spec_generation` | `general`
- Routes to the corresponding node

### Analyst Agent

- **Model:** mistral-medium-latest
- **Purpose:** Patterns, trends, priorities, RICE scores
- **Tools:** `search_feedback`, `trend_analysis`, `top_issues`, `find_similar`, `compare_segments`, `revenue_impact`, `rice_scoring`

### Customer Agent

- **Model:** mistral-medium-latest
- **Purpose:** Customer risk, renewals, health, feedback history
- **Tools:** `customer_lookup`, `at_risk_customers`, `customer_feedback_history`, `renewal_tracker`, `customer_comparison`

### Spec Writer Agent

- **Model:** mistral-large-latest
- **Purpose:** Generate 4-doc specs from Analyst + Customer output
- **Flow:** Analyst gathers patterns → Customer gathers impact → Spec Writer generates PRD, Architecture, Rules, Plan

---

## Connectors (Slack MCP)

### Demo Mode (Simulated)

- Reads `backend/test-data/slack_feed.json` on a schedule
- No Slack credentials
- Use for demos and local testing

### Live Mode

- Uses `@modelcontextprotocol/server-slack` (Node) via MCP stdio
- Backend image includes Node/npx
- Requires:
  - **Slack Bot Token** (xoxb-…)
  - **Team ID** (T…)
  - **Channel IDs** (C…), comma-separated
- Polls `slack_get_channel_history` per channel, runs messages through the classification pipeline

**Connector config (live):** `mode: "live"`, `slack_bot_token`, `slack_team_id`, `channel_ids`, `poll_interval_seconds`

---

## API Overview

| Prefix | Description |
|--------|-------------|
| `/api/v1/health` | Health check (Mistral, DB) |
| `/api/v1/auth/*` | Login, signup, JWT |
| `/api/v1/dashboard/*` | RICE, at-risk, volume, sentiment |
| `/api/v1/feedback/*` | List, search, detail |
| `/api/v1/customers/*` | List, profile |
| `/api/v1/specs/*` | List, create, get, update |
| `/api/v1/connectors/*` | List, connect Slack, disconnect, sync, history |
| `/api/v1/upload/*` | CSV upload, status |
| `/api/v1/product-context/*` | Product wizard CRUD |
| `/api/v1/agent/*` | Chat, conversations |
| `/api/v1/monitoring/*` | Agent stats, LangSmith |

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `organizations` | Org metadata |
| `users` | Auth, org membership |
| `feedback` | Feedback items, embeddings (BLOB), classification |
| `customers` | Customer profiles (ARR, health, renewal) |
| `product_context` | Product wizard sections (JSON) |
| `specs` | Generated specs (PRD, architecture, rules, plan) |
| `conversations` | Agent chat history |
| `upload_history` | CSV upload status |
| `connectors` | Connector config, status |
| `connector_sync_history` | Sync events |
| `agent_logs` | Agent call logs |

---

## Demo Walkthrough

1. **Dashboard** — RICE scores, at-risk table, volume chart, period filter (7d/30d/90d)
2. **Feedback** — Search (e.g. "payment problems"), filters, card detail, Investigate / Generate Spec
3. **Agent** — "What should we prioritize?" / "Generate specs for checkout"; inspect LangSmith traces
4. **Specs** — Open spec, switch PRD / Architecture / Rules / Plan, copy or download
5. **Connectors** — Demo mode or Live Slack with Bot Token, Team ID, Channel IDs

---

## Built With

- **Mistral AI** — Classification, embeddings, chat
- **LangChain / LangGraph** — Agent orchestration
- **LangSmith** — Tracing
- **FastAPI** — Backend API
- **React / Vite / Tailwind** — Frontend
- **SQLite** — Data store
- **MCP** — Slack connector (live mode)

---

## License

Context Engine — Mistral AI Hackathon Edition. See [PROJECT.md](PROJECT.md) for product vision.
