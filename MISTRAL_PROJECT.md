# PROJECT.md — Context Engine (Mistral AI Hackathon Edition)

## One-Liner
**Cursor for PMs** — an always-on feedback intelligence platform that ingests customer feedback from every source, classifies signal from noise, connects complaints to real revenue data, and generates production-ready engineering specs. Multi-agent. Multi-modal. Powered by Mistral AI.

---

## What This Is

Context Engine is a **production-grade feedback intelligence platform** for Product Managers. It uses a multi-agent system built on Mistral AI + LangChain + LangGraph to help PMs go from scattered customer feedback to prioritized, revenue-aware engineering specs.

This is a **new build** for the Mistral AI Worldwide Hackathon (Feb 28 – Mar 1, 2026). It is based on an existing Elasticsearch version built the previous week. The concept, data models, UX, and business logic are proven — this version rebuilds the backend on Mistral's stack and adds new capabilities (multi-agent, RICE scoring, LangSmith monitoring, MCP connectors, multimodal ingestion).

**Reference project (READ ONLY):** `D:\LinkedIn\Week4\Hackathon`
**This project:** `D:\LinkedIn\Week4\Mistral AI`

---

## The Problem

PMs drown in feedback from 6+ sources. They manually check Slack, Jira, support tickets, NPS surveys, app reviews, emails — trying to find patterns. Nobody notices checkout complaints spiked 40% until a customer churns. Nobody connects the Slack message, support ticket, and app store review describing the same problem. Even when they find a pattern, there's no way to prove it matters — no connection to revenue, churn risk, or renewal timelines. So the spec they write is based on gut feel, not data. By the time they finish, customers have already left.

Cursor tells engineers how to build. Context Engine tells PMs **what** to build.

---

## How It Works (End to End)

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

This context is injected into every agent's system prompt. It's how the agents know "checkout is owned by the Payments Team" and "reducing checkout abandonment is a P0 goal this quarter."

### Step 2: Data Ingestion
Feedback enters the system through multiple paths:
- **CSV upload** — Slack exports, Jira exports, support tickets, NPS surveys, app reviews
- **Manual entry** — PM adds individual items
- **MCP connectors** — Live connections to Slack, Jira, CRM (stretch goal)
- **Audio upload** — Sales call recordings, transcribed by Mistral audio model (stretch goal)
- **Image upload** — Screenshots of feedback, read by Mistral vision model (stretch goal)

Customer data enters separately:
- **CSV upload** — Customer list with company name, ARR, segment, health score, renewal date
- **MCP to CRM** — Live connection to Salesforce/HubSpot (stretch goal)

### Step 3: Classification Pipeline
Every piece of feedback — regardless of source — goes through the same classification pipeline. This is NOT an agent. It's a background pipeline that runs on ingest.

For each item, a single Mistral API call (mistral-medium, JSON mode) returns:
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
  "confidence": 0.91
}
```

Classification uses the product wizard context — the model knows what products exist, what features each product has, and what teams own what. When the PM adds a new product area, classification adapts immediately.

**What gets classified:**
- **is_feedback** — Is this real feedback or noise? ("checkout is broken" = feedback. "ok see you at standup" = noise.)
- **feedback_type** — bug_report, feature_request, complaint, praise, question, noise
- **sentiment** — positive, negative, neutral + score from -1.0 to 1.0
- **product** — Which product from the wizard
- **feature_area** — Which feature/module from the wizard
- **team** — Which team owns this area, from the wizard
- **urgency** — low, medium, high, critical (based on language intensity and business signals like "switching to competitor", "renewal coming up")
- **confidence** — How confident the model is in the classification (0.0 to 1.0)

Noise gets tagged, NOT deleted. PM can always review what was filtered.

### Step 4: Embedding + Customer Linking
Simultaneously with classification:
- **Embedding:** Each feedback item gets embedded via Mistral Embed API (mistral-embed, 1024 dimensions). Stored as a vector for semantic search.
- **Customer linking:** The author/sender is fuzzy-matched against the customer database. If matched, the feedback is linked to that customer's profile (ARR, health score, renewal date, segment).

### Step 5: Explore + Search
PM can:
- **Browse** all feedback with ML badges (sentiment, product area, team, urgency, noise toggle)
- **Filter** by product, feature area, source, sentiment, segment, date range
- **Semantic search** — "payment problems" finds "checkout losing cart", "Amex failing", "got charged twice" even though they don't share keywords. Powered by Mistral Embed + cosine similarity.

### Step 6: Ask Questions (Multi-Agent Chat)
PM talks to an AI agent in the chat panel. The system has 3 specialized agents orchestrated by LangGraph:

**Analyst Agent** — Answers questions about patterns, trends, and priorities across all feedback:
- "What are the top issues this month?"
- "How's sentiment trending for checkout?"
- "Compare enterprise vs SMB feedback"
- "How much ARR is tied to mobile complaints?"
- Returns RICE-scored priorities, not just raw data

**Customer Agent** — Answers questions about specific customers and segments:
- "Which customers are at risk?"
- "Tell me about BigRetail Co"
- "Who's renewing in the next 30 days with complaints?"
- "What has Acme Corp been saying about our API?"

**Spec Writer Agent** — Generates engineering specs:
- "Generate specs for checkout issues"
- Does NOT query data directly
- LangGraph first routes to Analyst (get patterns) and Customer (get impact), then passes both outputs to Spec Writer
- Produces 4 documents grounded in real data

LangGraph routes PM questions to the right agent automatically. For spec generation, it orchestrates the chain: Analyst → Customer → Spec Writer.

All agent activity is traced in **LangSmith** — judges can see which agent handled what, which tools were called, what data was returned.

### Step 7: Generate Specs
When the PM asks for specs, the multi-agent chain produces 4 documents:

1. **PRD** — Problem statement, user stories, requirements (P0-P3), success metrics, out of scope, open questions. Every requirement traces to real feedback. Specific customer names and ARR cited.
2. **Architecture Brief** — Technical approach, data model changes, API changes, dependencies, migration strategy, performance and security considerations.
3. **Engineering Rules** — Constraints, edge cases, non-negotiables, accessibility, testing requirements.
4. **Implementation Plan** — Phases, team assignments, timeline, dependencies, rollout strategy.

Every recommendation cites real feedback with real dollar amounts. An engineer can take this and start building.

### Step 8: Dashboard
Real-time overview with widgets:
- Feedback volume over time
- Sentiment breakdown (positive / negative / neutral)
- Top issues ranked by RICE score
- Top issues by ARR impact
- At-risk customers (low health + upcoming renewal + complaints)
- Recent feedback stream
- Source distribution
- Product area breakdown
- Customer segment breakdown

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
│  │                                              │    │
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
│  │         Classification Pipeline              │    │
│  │  Mistral Chat (JSON mode) → classify         │    │
│  │  Mistral Embed → 1024-dim vectors            │    │
│  │  Fuzzy Match → link to customer              │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐      │
│  │  SQLite  │  │ LangSmith│  │ MCP (stretch) │      │
│  │  Database│  │ Tracing  │  │ Slack, Jira,  │      │
│  │          │  │          │  │ CRM           │      │
│  └──────────┘  └──────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────┘
```

### Single Docker Container
Everything runs in one Docker container:
- FastAPI serves the API on port 8000
- React frontend built as static files, served by FastAPI (or nginx)
- SQLite database as a file inside the container
- Background tasks for MCP polling (if enabled)
- No external infrastructure except Mistral API + LangSmith API

---

## Data Models

### Feedback Item
```json
{
  "id": "fb_001",
  "org_id": "org_acme",
  "text": "Your checkout flow is confusing. I got stuck at the payment step twice.",
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
  "rating": 2,
  "customer_id": "cust_042",
  "customer_name": "TechFlow Inc",
  "customer_segment": "enterprise",
  "tags": ["payment", "confusion"],
  "embedding": [0.023, -0.118, ...],
  "created_at": "2026-02-10T14:30:00Z",
  "ingested_at": "2026-02-10T14:31:00Z",
  "ingestion_method": "csv_upload"
}
```

### Customer Profile
```json
{
  "id": "cust_042",
  "org_id": "org_acme",
  "company_name": "TechFlow Inc",
  "segment": "enterprise",
  "plan": "Enterprise Pro",
  "mrr": 2500,
  "arr": 30000,
  "account_manager": "Sarah Chen",
  "renewal_date": "2026-04-15",
  "health_score": 72,
  "employee_count": 450,
  "industry": "fintech",
  "created_at": "2025-03-10T00:00:00Z"
}
```

### Product Context (from wizard — stored per section type)
```json
{
  "id": "pc_001",
  "org_id": "org_acme",
  "section": "product_area",
  "data": {
    "name": "Checkout Flow",
    "product_area": "checkout",
    "team": "Payments Team",
    "team_lead": "Mike Rodriguez",
    "description": "Multi-step purchase and payment flow"
  }
}
```

Product context sections: product_basics, product_area, business_goal, customer_segment, pricing_tier, competitor, roadmap_item, team, tech_stack

### Generated Spec
```json
{
  "id": "spec_001",
  "org_id": "org_acme",
  "topic": "Checkout Form State Loss",
  "status": "draft",
  "prd": "## Problem Statement\n...",
  "architecture": "## System Overview\n...",
  "rules": "## Engineering Rules\n...",
  "plan": "## Implementation Plan\n...",
  "feedback_ids": ["fb_001", "fb_007", "fb_023"],
  "customer_ids": ["cust_042", "cust_015"],
  "arr_impacted": 266000,
  "rice_score": 87,
  "created_at": "2026-02-28T15:30:00Z"
}
```

---

## SQLite Schema

```sql
-- Users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'pm',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Organizations
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Feedback
CREATE TABLE feedback (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    text TEXT NOT NULL,
    source TEXT,
    author_name TEXT,
    is_feedback BOOLEAN DEFAULT 1,
    feedback_type TEXT,
    sentiment TEXT,
    sentiment_score REAL,
    product TEXT,
    feature_area TEXT,
    team TEXT,
    urgency TEXT DEFAULT 'medium',
    confidence REAL,
    rating INTEGER,
    customer_id TEXT,
    customer_name TEXT,
    customer_segment TEXT,
    tags TEXT,                  -- JSON array stored as text
    embedding BLOB,            -- numpy array bytes
    created_at TEXT,
    ingested_at TEXT DEFAULT (datetime('now')),
    ingestion_method TEXT DEFAULT 'csv_upload',
    FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Customers
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    segment TEXT,
    plan TEXT,
    mrr REAL DEFAULT 0,
    arr REAL DEFAULT 0,
    account_manager TEXT,
    renewal_date TEXT,
    health_score INTEGER DEFAULT 50,
    employee_count INTEGER,
    industry TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Product Context (all wizard sections)
CREATE TABLE product_context (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    section TEXT NOT NULL,     -- product_basics, product_area, business_goal, etc.
    data TEXT NOT NULL,        -- JSON object stored as text
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Generated Specs
CREATE TABLE specs (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    prd TEXT,
    architecture TEXT,
    rules TEXT,
    plan TEXT,
    feedback_ids TEXT,         -- JSON array stored as text
    customer_ids TEXT,         -- JSON array stored as text
    arr_impacted REAL DEFAULT 0,
    rice_score REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Conversations (agent chat history for UI display)
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    messages TEXT NOT NULL,    -- JSON array of {role, content, timestamp}
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES organizations(id)
);
```

---

## Multi-Agent System (LangChain + LangGraph + Mistral)

### Agent 1: Analyst Agent

**Model:** mistral-medium-2505
**Purpose:** Answers questions about patterns, trends, and priorities across all feedback.
**When routed to:** Questions about issues, trends, sentiment, comparisons, priorities, volume, RICE scores.

**System prompt:**
```
You are the Analyst Agent for Context Engine — a feedback intelligence platform.

You analyze customer feedback data to find patterns, trends, and priorities. You have tools that query the feedback database. Always use them — never guess or make up numbers.

## Product Context
{injected from wizard — product basics, areas, goals, segments, competitors, teams}

## Rules
- Always cite specific numbers (feedback count, sentiment scores, customer count, ARR)
- Rank issues using RICE framework: Reach (customers affected), Impact (ARR at risk + sentiment severity), Confidence (data points + classification confidence), Effort (estimated scope)
- When mentioning product areas, note which team owns them
- Connect issues to business goals when relevant
- Be specific: "15 feedback items from 5 enterprise customers worth $266K ARR" not "several customers mentioned issues"
- If you don't have enough data to answer confidently, say so
```

**Tools (7 function calls):**

| Tool | Description | Queries |
|------|-------------|---------|
| search_feedback | Search feedback by topic using semantic search + filters | Embeds query with mistral-embed, cosine similarity, optional filters |
| trend_analysis | Compare current period vs previous period | Volume change, sentiment shift, emerging/declining topics |
| top_issues | Rank issues by volume × sentiment × ARR impact | Aggregate by feature_area, join customer ARR |
| find_similar | Find feedback semantically similar to given text | Cosine similarity on embeddings |
| compare_segments | Compare metrics between customer segments | Group by segment, aggregate sentiment + volume |
| revenue_impact | Calculate total ARR tied to a specific issue | Sum ARR of affected customers for a feature_area |
| rice_scoring | Calculate RICE scores for top issues | Reach × Impact × Confidence / Effort for each issue |

### Agent 2: Customer Agent

**Model:** mistral-medium-2505
**Purpose:** Answers questions about specific customers, risk, health, and renewals.
**When routed to:** Questions about specific companies, customer risk, renewals, health scores, customer-level feedback.

**System prompt:**
```
You are the Customer Agent for Context Engine — a feedback intelligence platform.

You specialize in customer intelligence. You know customer profiles (ARR, health scores, renewal dates, segments) and their feedback history. You help PMs understand which customers need attention.

## Product Context
{injected from wizard — product basics, segments, pricing tiers}

## Rules
- Always include ARR, segment, and health score when discussing a customer
- Flag customers with: health_score < 50 AND renewal within 90 days as "at risk"
- Flag customers with: multiple negative feedback items in the last 30 days as "trending negative"
- When listing at-risk customers, sort by ARR descending (highest value at risk first)
- Include renewal dates — "renews in 23 days" is more impactful than "renews April 15"
- If asked about a customer you can't find, say so clearly
```

**Tools (5 function calls):**

| Tool | Description | Queries |
|------|-------------|---------|
| customer_lookup | Get full profile for a specific customer | Fuzzy match on company_name, return all fields |
| at_risk_customers | Find customers at risk of churn | health_score < 50 OR (negative feedback > 3 in 30 days AND renewal < 90 days) |
| customer_feedback_history | Get all feedback from a specific customer | Filter by customer_id, sorted by date |
| renewal_tracker | List upcoming renewals with health context | Renewals in next N days, joined with feedback sentiment |
| customer_comparison | Compare two or more customers | Side-by-side: ARR, health, sentiment, feedback volume |

### Agent 3: Spec Writer Agent

**Model:** mistral-large-latest
**Purpose:** Generates engineering specs from data gathered by Analyst and Customer agents.
**When routed to:** Only for spec generation requests. NEVER called directly — always receives data from the Analyst → Customer chain first.

**System prompt:**
```
You are the Spec Writer Agent for Context Engine.

You generate production-ready engineering specifications. You receive two inputs:
1. Pattern data from the Analyst Agent (top issues, trends, RICE scores, feedback examples)
2. Customer impact data from the Customer Agent (affected customers, ARR at risk, renewal urgency)

Your job is to synthesize both into 4 engineering documents.

## Product Context
{injected from wizard — full product context including tech stack, teams, roadmap}

## Output Format
Generate exactly 4 documents in markdown. Each document must:
- Cite specific feedback quotes (with customer attribution)
- Include specific dollar amounts (ARR at risk, revenue impact)
- Reference the owning team
- Connect to business goals from the product context
- Be actionable — an engineer should be able to start working from this

### Document 1: PRD
1. Problem Statement — what's broken, who's affected, business impact with real numbers
2. User Stories — derived from real feedback, cite specific customers
3. Requirements — functional requirements with priority (P0-P3)
4. Success Metrics — measurable outcomes linked to business goals
5. Out of Scope — what this intentionally excludes
6. Open Questions — unresolved items

### Document 2: Architecture Brief
1. System Overview — how this fits into existing architecture
2. Technical Approach — recommended implementation
3. Data Model Changes — new/modified schemas
4. API Changes — new/modified endpoints
5. Dependencies and Migration Strategy
6. Performance and Security Considerations

### Document 3: Engineering Rules
1. Constraints and Non-Negotiables
2. Edge Cases (derived from real feedback patterns)
3. Accessibility Requirements
4. Testing Requirements
5. Rollback Strategy

### Document 4: Implementation Plan
1. Phases with clear milestones
2. Team Assignments (from product context)
3. Timeline Estimate
4. Dependencies Between Phases
5. Rollout Strategy (canary, feature flags, etc.)
```

**Tools:** None. The Spec Writer receives all data as context from the LangGraph chain — it doesn't call any tools itself.

### LangGraph Router

The router classifies PM intent and routes to the correct agent:

```
PM message → LangGraph Router
  │
  ├── Pattern/trend/priority question → Analyst Agent → Response
  │
  ├── Customer/risk/renewal question → Customer Agent → Response
  │
  ├── Spec generation request → Analyst Agent (gather patterns)
  │                              → Customer Agent (gather impact)
  │                              → Spec Writer Agent (generate docs)
  │                              → Response (4 docs)
  │
  └── General/greeting/unclear → Respond directly (no agent needed)
```

**Intent classification:** The router uses a lightweight Mistral call (mistral-small or mistral-medium) to classify the PM's message into one of: `analyst`, `customer`, `spec_generation`, `general`. Based on the classification, it routes accordingly.

---

## Semantic Search (Mistral Embed)

**Model:** mistral-embed (1024 dimensions)

**On ingest:** Every feedback item's text is embedded and stored as a BLOB in SQLite.

**On search:** The PM's query is embedded with the same model. Cosine similarity is computed against all stored embeddings using numpy. Top-K results are returned ranked by similarity.

```python
import numpy as np

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
```

This gives us semantic search ("payment problems" → "checkout losing cart") without any vector database infrastructure.

---

## RICE Scoring

When the Analyst Agent ranks issues, each issue gets a RICE score:

**Reach** = (unique_customers_affected / total_customers) × 100 + (feedback_count / total_feedback) × 100

**Impact** = (arr_at_risk / total_arr) × 100 + (avg_sentiment_severity × 25) + (urgency_bonus)
- urgency_bonus: critical = 25, high = 15, medium = 5, low = 0

**Confidence** = (avg_classification_confidence × 50) + min(feedback_count × 5, 50)
- More data points = higher confidence, capped at 50

**Effort** = estimated from number of product areas affected and spec complexity
- 1 area = 3 (high effort score = low effort), 2-3 areas = 2, 4+ areas = 1

**RICE Score** = (Reach × Impact × Confidence) / Effort

---

## LangSmith Monitoring

**Setup:** Set environment variables, traces appear automatically.
```
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-langsmith-api-key
LANGCHAIN_PROJECT=context-engine-mistral
```

**What's traced:**
- Every agent call (which agent, input, output, latency)
- Every tool call (which tool, parameters, results, latency)
- LangGraph routing decisions (classified intent, chosen agent)
- Multi-agent chains for spec generation (full Analyst → Customer → Spec Writer flow)
- Token usage and cost per call

---

## Tech Stack

### Backend
- Python 3.11+ with FastAPI
- SQLite (only datastore — replaces Elasticsearch)
- LangChain + LangGraph for agent orchestration
- LangSmith for monitoring and tracing
- Mistral AI models: mistral-medium-2505 (classification, Analyst, Customer, routing), mistral-large-latest (Spec Writer), mistral-embed (embeddings)
- Pydantic for validation
- JWT for auth (python-jose + passlib)
- numpy for cosine similarity search
- pip with requirements.txt

### Frontend
- React 18 with TypeScript
- Vite build tool
- Tailwind CSS (dark mode via class strategy)
- Axios for API calls
- Recharts for dashboard charts
- Lucide React for icons
- React Router for navigation
- npm as package manager

### Infrastructure
- Single Docker container
- FastAPI serves API + static frontend
- SQLite file inside container

### External Services (API keys required)
- **Mistral AI** — MISTRAL_API_KEY from console.mistral.ai
- **LangSmith** — LANGCHAIN_API_KEY from smith.langchain.com

---

## Frontend Pages

| Page | Route | What It Shows |
|------|-------|-------------|
| Login | /login | Email + password login |
| Sign Up | /signup | Email, password, name, org name |
| Dashboard | /dashboard | 9 widgets with real-time data |
| Feedback | /feedback | Feedback list with ML badges, filters, search, slide-out detail |
| Customers | /customers | Customer list with health/ARR, full profile pages |
| Specs | /specs | Saved specs, 4-tab viewer (PRD, Architecture, Rules, Plan) |
| Settings | /settings | Product Wizard, Data Upload, Connectors, Account, System Status |

**Agent Chat:** Always-visible floating panel (bottom-right bubble → 400px right sidebar). Available on every page. Context-aware pre-fills from dashboard, feedback detail, customer profile.

**Theme:** Dark mode default, light mode toggle. Tailwind class strategy.

**Navigation:** Left sidebar, Jira-style with text labels. Collapsible to icons.

---

## Frontend Pages — Detailed

### Dashboard (/dashboard)
9 customizable widgets:
1. Summary cards (total feedback, avg sentiment, active customers, open issues)
2. Feedback volume over time (line chart, Recharts)
3. Sentiment breakdown (donut chart — positive/negative/neutral)
4. Top issues by RICE score (ranked list with score badges)
5. Product area breakdown (bar chart)
6. At-risk customers (table — low health + upcoming renewal + complaints)
7. Recent feedback stream (live feed of latest items)
8. Source distribution (pie chart)
9. Segment breakdown (grouped bar chart)

Each widget has: title, data, "Investigate" link (opens agent chat with pre-fill), clickable elements (filter feedback page).

### Feedback (/feedback)
- Search bar (semantic search via Mistral Embed)
- Filter pills: product, feature area, source, sentiment, segment, date range, feedback type
- Toggle: "Show noise" (dimmed items) vs "Feedback only"
- Feedback list: each item shows text preview, ML badges (sentiment color, feature area, team, urgency, confidence), source icon, customer name + segment, date
- Click item → slide-out detail panel: full text, all ML fields, customer card (ARR, health, renewal), similar feedback items, "Investigate" and "Generate Spec" buttons

### Customers (/customers)
- List view: company name, segment, plan, ARR, health score (color-coded), renewal date, feedback count, avg sentiment
- Sort by any column
- Filter by segment, health range, renewal window
- Click → full customer profile page: all fields, feedback history, sentiment trend chart, generated specs mentioning them

### Specs (/specs)
- List of generated specs: topic, status (draft/final/shared), RICE score, ARR impacted, date, feedback count
- Click → 4-tab viewer: PRD | Architecture | Rules | Plan
- Each tab: rendered markdown with clickable citations (feedback items, customer names)
- Actions: download, change status, regenerate, edit

### Settings (/settings)
Tabs:
- **Product Wizard** — same 8-step wizard, editable anytime
- **Data Upload** — feedback CSV, customer CSV, manual entry, upload history
- **Connectors** — MCP connection management (Slack, Jira, CRM — stretch goal). "Coming soon" placeholders for others.
- **Account** — email, password, theme toggle, org name
- **System Status** — replaces "Elasticsearch" tab. Shows: Mistral API status, LangSmith status, SQLite stats, agent health

---

## Ingestion Sources

| Source | Type | Now (Hackathon) | Future |
|--------|------|-----------------|--------|
| CSV Upload | Manual | ✅ Primary path | Always available |
| Manual Entry | Manual | ✅ Available | Always available |
| Slack | MCP Connector | 🔶 Stretch goal | Live sync |
| Jira | MCP Connector | 🔶 Stretch goal | Live sync |
| CRM (Salesforce/HubSpot) | MCP Connector | 🔶 Stretch goal | Live customer data |
| Sales Calls (audio) | Mistral Audio | 🔶 Stretch goal | Transcribe + classify |
| Screenshots/Images | Mistral Vision | 🔶 Stretch goal | OCR + classify |
| Support Tickets | CSV | ✅ Via CSV | Zendesk, Intercom |
| NPS / CSAT Surveys | CSV | ✅ Via CSV | Connector |
| App Store Reviews | CSV | ✅ Via CSV | Connector |
| G2 / Capterra | CSV | ✅ Via CSV | Connector |

---

## Environment Variables

```env
# Mistral AI
MISTRAL_API_KEY=your-mistral-api-key

# LangSmith
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-langsmith-api-key
LANGCHAIN_PROJECT=context-engine-mistral

# Auth
JWT_SECRET_KEY=change-this-to-a-random-64-char-string
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Database
DATABASE_URL=sqlite:///./context_engine.db

# Backend
BACKEND_CORS_ORIGINS=http://localhost:3000,http://localhost:5173
API_V1_PREFIX=/api/v1

# Frontend
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## Build Phases

| Phase | What | Key Deliverable |
|-------|------|----------------|
| 1 | Foundation + Auth + SQLite | Docker runs → login → empty dashboard |
| 2 | Product Wizard | 8-step wizard, product context in SQLite |
| 3 | Ingestion + Classification | CSV upload, Mistral classification pipeline, embeddings, customer linking |
| 4 | Frontend Core | Feedback list, search, customer page, filters |
| 5 | Agents + LangGraph | 3 agents, routing, chat UI, LangSmith |
| 6 | Spec Generation | Multi-agent chain, 4-doc output, spec viewer |
| 7 | Dashboard + RICE | Widgets, RICE scoring, at-risk customers |
| 8 | Polish + Stretch | MCP connectors, audio, monitoring UI, Docker, demo prep |

Detailed specs for each phase in docs/PHASE_X_SPEC.md.

---

## Key Differences from Elasticsearch Version

| Aspect | Elasticsearch Version | Mistral Version |
|--------|----------------------|-----------------|
| Classification | bart-large-mnli + roberta (2 models, deployed in ES) | Single Mistral call (JSON mode, all fields at once) |
| Semantic Search | ELSER inside ES | Mistral Embed + cosine similarity in numpy |
| Agent | Single ES Agent Builder agent | 3 specialized agents with LangGraph handoffs |
| Agent Tools | 7 ES|QL queries | 12 Python functions (7 analyst + 5 customer) |
| Spec Generation | ES Inference API | Spec Writer Agent chained through Analyst + Customer |
| Data Store | Elasticsearch Cloud (8GB ML nodes) | SQLite (zero config) |
| Monitoring | None | LangSmith (full traces) |
| Prioritization | Manual | RICE scoring |
| Connectors | ES Connectors (Slack, Jira) | MCP (stretch goal) |
| Multimodal | Text only | Text + Audio + Image (stretch) |
| Setup Time | 45-60 min (deploy ML models, configure ES) | 2 min (set API keys) |
| Infrastructure | Elastic Cloud trial, Kibana | Mistral API key, LangSmith API key |


