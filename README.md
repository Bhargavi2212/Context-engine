# Context Engine - Mistral AI Hackathon Edition

**Cursor for PMs** - an always-on feedback intelligence platform that ingests customer feedback from every source, classifies signal from noise, connects complaints to real revenue data, and generates production-ready engineering specs. Multi-agent. Powered by Mistral AI.

---

## Table of Contents

- [What This Is](#what-this-is)
- [The Problem](#the-problem)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Data Models](#data-models)
- [Multi-Agent System](#multi-agent-system)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Frontend Pages](#frontend-pages)
- [Connectors](#connectors)
- [Built With](#built-with)

---

## What This Is

Context Engine is a **production-grade feedback intelligence platform** for Product Managers. It uses a multi-agent system built on Mistral AI + LangChain + LangGraph to help PMs go from scattered customer feedback to prioritized, revenue-aware engineering specs.

## The Problem

PMs drown in feedback from 6+ sources. They manually check Slack, Jira, support tickets, NPS surveys, app reviews, emails - trying to find patterns. Nobody notices checkout complaints spiked 40% until a customer churns. Nobody connects the Slack message, support ticket, and app store review describing the same problem. Even when they find a pattern, there's no way to prove it matters - no connection to revenue, churn risk, or renewal timelines. So the spec they write is based on gut feel, not data. By the time they finish, customers have already left.

**Cursor tells engineers how to build. Context Engine tells PMs what to build.**

---

## How It Works

### Step 1: Product Setup (Product Wizard)
PM fills out their product context in an 8-step wizard:
1. Product basics (name, description, industry, stage)
2. Product areas / modules (checkout, dashboard, mobile, etc.)
3. Business goals / OKRs (with priority and linked areas)
4. Customer segments + pricing tiers
5. Competitors (strengths, weaknesses, differentiation)
6. Roadmap (existing features, planned features)
7. Team structure (who owns what area)
8. Tech stack

This context is injected into every agent's system prompt.

### Step 2: Data Ingestion
Feedback enters through:
- **CSV upload** - Slack exports, Jira exports, support tickets, NPS surveys, app reviews
- **Manual entry** - PM adds individual items
- **MCP connectors** - Live Slack (Demo mode or Live MCP)

### Step 3: Classification Pipeline
Every piece of feedback goes through the same classification pipeline (not an agent - runs on ingest). A single Mistral API call (mistral-medium, JSON mode) returns:

```json
{
  "is_feedback": true,
  "feedback_type": "bug_report",
  "sentiment": "negative",
  "sentiment_score": -0.87,
  "product": "Acme Analytics",
  "feature_area": "checkout",
  "team": "Payments Team",
  "urgency": "high",
  "confidence": ----
}
```

Classification uses the product wizard context. Noise gets tagged, NOT deleted.

### Step 4: Embedding + Customer Linking
- **Embedding:** Mistral Embed API (1024 dimensions) for semantic search
- **Customer linking:** Fuzzy match on author/sender against customer database

### Step 5: Explore + Search
PM can browse feedback with ML badges, filter by product/feature/sentiment/segment, and use **semantic search** - "payment problems" finds "checkout losing cart", "Amex failing", "got charged twice". Powered by Mistral Embed + cosine similarity.

### Step 6: Multi-Agent Chat
3 specialized agents orchestrated by LangGraph:
- **Analyst Agent** - patterns, trends, priorities, RICE scores (7 tools)
- **Customer Agent** - risk, renewals, health, feedback history (5 tools)
- **Spec Writer Agent** - generates 4 engineering documents from Analyst + Customer output

LangGraph routes questions automatically. All agent activity traced in **LangSmith**.

### Step 7: Generate Specs
The multi-agent chain produces 4 documents:
1. **PRD** - Problem statement, user stories, requirements (P0-P3), success metrics
2. **Architecture Brief** - Technical approach, data model, API changes, migration
3. **Engineering Rules** - Constraints, edge cases, accessibility, testing
4. **Implementation Plan** - Phases, team assignments, timeline, rollout

Every recommendation cites real feedback with real dollar amounts.

### Step 8: Dashboard
Real-time overview: feedback volume, sentiment breakdown, top issues by RICE score, at-risk customers, recent feedback, source distribution, product area breakdown, segment breakdown.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              React Frontend (Vite + Tailwind)         │
│  Auth │ Dashboard │ Feedback │ Customers │ Specs │    │
│  Settings │ Agent Chat Panel                         │
└──────────────────────┬──────────────────────────────┘
                       │ REST API (axios + JWT)
┌──────────────────────┴──────────────────────────────┐
│              FastAPI Backend (Python 3.11+)           │
│                                                      │
│  Auth │ Ingestion Pipeline │ Search │ Agents │ Specs │
│  Product Context │ Customer │ Dashboard Analytics    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │         LangChain + LangGraph               │    │
│  │  LangGraph Router                           │    │
│  │    ├── Analyst Agent (mistral-medium)        │    │
│  │    │     └── 7 function tools (SQLite)       │    │
│  │    ├── Customer Agent (mistral-medium)       │    │
│  │    │     └── 5 function tools (SQLite)       │    │
│  │    └── Spec Writer Agent (mistral-large)     │    │
│  │          └── receives data from above agents │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │         Classification Pipeline             │    │
│  │  Mistral Chat (JSON mode) → classify         │    │
│  │  Mistral Embed → 1024-dim vectors            │    │
│  │  Fuzzy Match → link to customer              │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐      │
│  │  SQLite  │  │ LangSmith│  │ MCP Connectors│     │
│  │  WAL     │  │ Tracing  │  │ Slack (Demo + │     │
│  │          │  │          │  │  Live)        │     │
│  └──────────┘  └──────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────┘
```

**Single Docker container:** FastAPI serves API + static frontend on port 8000. SQLite file inside container. No external infrastructure except Mistral API + LangSmith API.

---

## Data Models

### Feedback Item
```json
{
  "id": "fb_001",
  "org_id": "org_acme",
  "text": "Your checkout flow is confusing...",
  "source": "app_store_review",
  "author_name": "John D.",
  "is_feedback": true,
  "feedback_type": "bug_report",
  "sentiment": "negative",
  "sentiment_score": -0.72,
  "product": "Acme Analytics",
  "feature_area": "checkout",
  "team": "Payments Team",
  "urgency": "high",
  "confidence": 0.91,
  "customer_id": "cust_042",
  "customer_name": "TechFlow Inc",
  "embedding": [0.023, -0.118, ...],
  "created_at": "2026-02-10T14:30:00Z",
  "ingestion_method": "csv_upload"
}
```

### Customer Profile
```json
{
  "id": "cust_042",
  "company_name": "TechFlow Inc",
  "segment": "enterprise",
  "plan": "Enterprise Pro",
  "arr": 30000,
  "renewal_date": "2026-04-15",
  "health_score": 72,
  "account_manager": "Sarah Chen"
}
```

### Generated Spec
```json
{
  "id": "spec_001",
  "topic": "Checkout Form State Loss",
  "status": "draft",
  "prd": "## Problem Statement\n...",
  "architecture": "## System Overview\n...",
  "rules": "## Engineering Rules\n...",
  "plan": "## Implementation Plan\n...",
  "feedback_ids": ["fb_001", "fb_007"],
  "customer_ids": ["cust_042", "cust_015"],
  "arr_impacted": 266000,
  "rice_score": 87
}
```

---

## Multi-Agent System

### LangGraph Router
Classifies PM intent: `analyst` | `customer` | `spec_generation` | `general`. Routes accordingly.

```
PM message → LangGraph Router
  ├── Pattern/trend/priority → Analyst Agent → Response
  ├── Customer/risk/renewal  → Customer Agent → Response
  ├── Spec generation       → Analyst → Customer → Spec Writer → 4 docs
  └── General/greeting      → Respond directly (no agent)
```

### Analyst Agent (mistral-medium)
**Tools:** search_feedback, trend_analysis, top_issues, find_similar, compare_segments, revenue_impact, rice_scoring

### Customer Agent (mistral-medium)
**Tools:** customer_lookup, at_risk_customers, customer_feedback_history, renewal_tracker, customer_comparison

### Spec Writer Agent (mistral-large)
No tools - receives Analyst + Customer output, generates PRD, Architecture, Rules, Implementation Plan.

---

## Semantic Search (Mistral Embed)
- **On ingest:** Every feedback item embedded, stored as BLOB in SQLite
- **On search:** Query embedded, cosine similarity vs stored embeddings (numpy)
- Semantic search ("payment problems" → "checkout losing cart") without vector database

---

## RICE Scoring
- **Reach** = (customers_affected / total) × 100 + (feedback_count / total) × 100
- **Impact** = (arr_at_risk / total) × 100 + sentiment_severity + urgency_bonus
- **Confidence** = classification_confidence × 50 + min(feedback_count × 5, 50)
- **Effort** = estimated from areas affected (1 area = high effort, 4+ = low)
- **RICE Score** = (Reach × Impact × Confidence) / Effort

---

## LangSmith Monitoring
Set `LANGCHAIN_TRACING_V2=true`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT=context-engine-mistral`. Traces: every agent call, tool call, routing decision, token usage.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.11, FastAPI, SQLite, LangChain, LangGraph |
| Models | mistral-medium (classification, Analyst, Customer), mistral-large (Spec Writer), mistral-embed |
| Frontend | React 18, TypeScript, Vite, Tailwind, Recharts, Axios |
| Auth | JWT (python-jose, bcrypt) |
| Observability | LangSmith |
| Connectors | MCP Python SDK, @modelcontextprotocol/server-slack (Node/npx) |

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
Edit `.env`: set `MISTRAL_API_KEY`, `JWT_SECRET_KEY`

### 3. Run
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
Log in: **demo@contextengine.ai** / **demo123**

### 5. Access
| Mode | Frontend | Health |
|------|----------|--------|
| Dev | http://localhost:5173 | http://localhost:8000/api/v1/health |
| Prod | http://localhost:8000 | (same) |

---

## Frontend Pages

| Page | Route | What It Shows |
|------|-------|---------------|
| Login | /login | Email + password |
| Sign Up | /signup | Email, password, name, org |
| Dashboard | /dashboard | 9 widgets: RICE, at-risk, volume, sentiment, etc. |
| Feedback | /feedback | ML badges, filters, semantic search, slide-out detail |
| Customers | /customers | Health/ARR, full profile pages |
| Specs | /specs | 4-tab viewer (PRD, Architecture, Rules, Plan) |
| Settings | /settings | Product Wizard, Data Upload, Connectors, Account, System Status |

**Agent Chat:** Always-visible panel (bottom-right bubble → sidebar). Context-aware pre-fills. Dark mode default.

---

## Connectors (Slack MCP)

### Demo Mode (Simulated)
- Reads `backend/test-data/slack_feed.json` on a schedule
- No Slack credentials
- Use for demos and local testing

### Live Mode
- Uses `@modelcontextprotocol/server-slack` (Node) via MCP stdio
- Backend image includes Node/npx
- Requires: **Slack Bot Token** (xoxb-…), **Team ID** (T…), **Channel IDs** (C…)
- Polls `slack_get_channel_history` per channel, runs messages through classification pipeline

---

## Environment Variables

```env
MISTRAL_API_KEY=your-mistral-api-key
JWT_SECRET_KEY=change-this-to-a-random-64-char-string
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-langsmith-api-key
LANGCHAIN_PROJECT=context-engine-mistral
DATABASE_PATH=./data/context_engine.db
BACKEND_CORS_ORIGINS=http://localhost:3000,http://localhost:5173
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## Ingestion Sources

| Source | Status |
|--------|--------|
| CSV Upload | ✅ Primary path |
| Manual Entry | ✅ Available |
| Slack | ✅ Demo + Live MCP |
| Jira | 🔶 Coming soon |
| CRM | 🔶 Coming soon |
| Support Tickets | ✅ Via CSV |
| NPS / App Reviews | ✅ Via CSV |

---

## Built With

- **Mistral AI** - Classification, embeddings, chat
- **LangChain / LangGraph** - Agent orchestration
- **LangSmith** - Tracing
- **FastAPI** - Backend API
- **React / Vite / Tailwind** - Frontend
- **SQLite** - Data store
- **MCP** - Slack connector (live mode)

---

Context Engine — Mistral AI Hackathon Edition. See [PROJECT.md](PROJECT.md) for product vision.
