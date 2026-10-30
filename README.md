# ToolToll: Pay-per-Use API Marketplace for AI Agents

ToolToll is an API marketplace where developers register and monetize APIs, and autonomous AI agents discover, evaluate, and pay for those APIs automatically while completing tasks.

---

## Architecture & Tech Stack

- **Backend:** Node.js 22+, TypeScript, Express, Prisma ORM, PostgreSQL.
- **Outbound Execution & Security:** Undici, strict DNS-pinned SSRF guard (blocking private, loopback, CGNAT, and cloud metadata ranges), AES-256-GCM secret encryption at rest.
- **Billing & Ledger:** Integer minor units (`BigInt` micro-USD, 1 USD = 1,000,000 units), double-entry append-only ledger with compensating reversals, atomic reservations using row-level locking.
- **Agent Integration & MCP:** Model Context Protocol (MCP) server supporting both STDIO (local) and Streamable HTTP (remote) transports with bearer authentication.
- **Payments:** PayPal Sandbox Orders & Capture API, idempotent webhook handling with deduplication, pluggable mock payment adapters for local testing.

---

## Quickstart: Running Locally

### 1. Database (PostgreSQL)

You can use the provided Docker Compose service or an existing PostgreSQL instance:

```bash
docker compose up -d postgres
```

Database default connection: `postgresql://tooltoll:tooltoll@localhost:5432/tooltoll_db?schema=public`

### 2. Backend Setup

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Run migrations
npm run prisma:generate
npm run prisma:migrate

# 3. Seed demo accounts & tools
npm run prisma:seed

# 4. Start the server
npm run dev
```

The server will be available at:
- **API Base:** `http://localhost:4000`
- **Health Check:** `http://localhost:4000/health`
- **Swagger Documentation:** `http://localhost:4000/api/docs`

---

## Seed Accounts (Local Dev & Testing)

| Role | Email | Password | Initial Balance | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@tooltoll.com` | `Password123!` | $100.00 | Moderation, reconciliation reports, commission settings |
| **Creator** | `creator@tooltoll.com` | `Password123!` | $25.00 | API registration, versioning, earnings, and simulated payouts |
| **Consumer** | `consumer@tooltoll.com` | `Password123!` | $50.00 | Agent creation, budget management, playground execution |

**Demo Agent Key:**
`tt_live_demo1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

---

## Built-in Demo Tools

1. **Text Translator:** `POST /api/demo/translate` (Category: Translation)
2. **Scam Message Risk Analyzer:** `POST /api/demo/scam-risk` (Category: Security)
3. **Sentiment Analyzer:** `POST /api/demo/sentiment` (Category: NLP)

---

## Running the Automated Test Suite

The test suite validates all 11 non-negotiable invariants, security guards, atomic reservations, idempotency deduplication, and MCP operations:

```bash
cd backend
npm test
```

---

## Model Context Protocol (MCP) Server

### STDIO Transport (Local Claude / Cursor integration)

Set the agent key in your environment and launch:

```bash
export TOOLTOLL_AGENT_KEY="tt_live_demo1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
npm run mcp:stdio
```

### Streamable HTTP Transport

```bash
npm run mcp:http
# Listens on port 4001: SSE endpoint at http://localhost:4001/sse with Bearer token authentication
```

---

## Key API Endpoints

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- **Agents:** `GET /api/agents`, `POST /api/agents`, `POST /api/agents/:id/credentials`
- **Marketplace:** `GET /api/tools`, `GET /api/tools/search`, `POST /api/tools`
- **Execution:** `POST /api/tools/:id/calls` (requires `X-Agent-Key` and `Idempotency-Key`)
- **AI Planning:** `POST /api/agent/plan`, `POST /api/agent/execute`
- **Wallet & Billing:** `GET /api/wallet`, `GET /api/wallet/transactions`, `POST /api/wallet/topups`
- **Admin:** `GET /api/admin/tools/pending`, `POST /api/admin/tools/:id/approve`, `GET /api/admin/reconciliation`
