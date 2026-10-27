# ToolToll: Product Requirements Document

**Version 1.0** · Pay-per-use API marketplace for AI agents · Written to be handed to an agentic IDE (Antigravity) and built in one working session

---

## 0. Read first: conflicts resolved

The source material had two conflicting backend plans. This PRD settles them so the agent does not stall.

- **Stack is final:** Node.js + TypeScript + Express + Prisma + PostgreSQL. The earlier Python/FastAPI spec is used only as the source of requirements. Mapping: FastAPI to Express, Pydantic to Zod, SQLAlchemy/Alembic to Prisma Client/Migrate, HTTPX to undici/fetch, pytest to Vitest + Supertest, Python MCP SDK to the TypeScript MCP SDK. Do not write Python backend code.
- **AI layer:** for the MVP the planner, ranker and evaluator live inside the backend (`ai-integration` module) behind a provider interface, with a deterministic fallback when no LLM key exists. A separate `ai-service/` (Python allowed) is optional later and must use the same contract. It must never touch wallets or prices.
- **MCP ownership:** the MCP server lives in `backend/src/mcp`, runs as its own process, and reuses the backend service layer. It has no billing logic of its own.
- **Missing credentials:** anything needing PayPal, LLM or payout credentials ships behind an adapter interface with a clearly labeled mock, and the build continues.

---

## 1. Vision

ToolToll is a marketplace where API developers register and monetize APIs, and AI agents discover and pay for those APIs automatically while completing a user's task.

Traditional flow: search for an API, read docs, integrate, handle auth, pricing and billing by hand. ToolToll flow: the creator registers a tool, ToolToll validates and publishes it, an agent connects over MCP, the user states a task in natural language, the agent discovers and selects tools, ToolToll checks permissions, price, balance and limits, executes the API securely, records usage and pays the creator.

ToolToll does not replace API providers. It helps them distribute and monetize their APIs to agents.

---

## 2. Goals and non-goals

**Goals:** a working end-to-end MVP: creator registers and publishes a tool, consumer funds a wallet, an agent discovers and calls the tool under budget controls, the ledger splits money correctly, the creator sees earnings, tests prove the security and billing invariants.

**Non-goals for the MVP:** real PayPal payouts (mock adapter, labeled simulated), OAuth 2.1 for remote MCP (documented follow-up), arbitrary user code execution (never allowed), fake testimonials or fabricated reliability numbers.

---

## 3. Roles

- **API Creator:** registers and manages tool listings, stores upstream credentials, tests and submits for approval, views usage, gross earnings, fees, reversals and net earnings, pauses or retires listings. Cannot see other creators' credentials or earnings.
- **Consumer / Agent Owner:** creates agents, issues, rotates and revokes agent credentials, assigns allowed tools or categories, sets per-call, daily and monthly limits, sets auto-approval rules and a human-approval threshold, tops up the wallet, reviews usage and why each tool was chosen.
- **Administrator:** reviews submissions, approves, rejects, suspends or disables tools, reviews abuse reports and failed calls, sets platform commission, sees usage and reconciliation reports. Can never read plaintext upstream credentials.

A user can hold both creator and consumer roles. Model roles as flags or a join table, not a single enum.

---

## 4. Final tech stack

| Layer | Choice |
| :--- | :--- |
| **Frontend** | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query, React Hook Form + Zod, a chart library (Recharts) |
| **Backend** | Node.js 20+, TypeScript, Express, Zod, Prisma ORM, PostgreSQL, pino logging, helmet, cors, express-rate-limit |
| **Auth** | Argon2id (preferred) or bcrypt for passwords; JWT in httpOnly secure cookies; CSRF protection for cookie auth |
| **Outbound calls** | undici/fetch with custom DNS-pinned dispatcher |
| **Crypto** | Node crypto, AES-256-GCM with versioned keys from env |
| **AI** | Provider-independent LLM adapter (env-configured) plus deterministic fallback |
| **MCP** | Official TypeScript MCP SDK: STDIO (local) and Streamable HTTP (remote) |
| **Payments** | PayPal Orders API (Sandbox), verified webhooks, mock adapter for dev and tests |
| **Testing** | Vitest, Supertest, mocked external services |
| **DevOps** | Docker Compose (postgres + backend + frontend), GitHub Actions, Vercel (frontend), Render/Railway (backend), managed Postgres |

Pin dependency versions and commit lock files.

---

## 5. Non-negotiable invariants

Every phase must preserve these. Tests must prove them.

1. The backend alone decides prices, permissions, balances and approvals. The frontend, the LLM and MCP clients can never supply an authoritative price, approve spending, or change a balance.
2. Owner and agent identity come from the authenticated credential, never from request bodies.
3. Money is stored as integers in minor units. Because per-call prices can be fractions of a cent, use micro-USD (1 USD = 1,000,000 units) stored as BigInt. No floats anywhere in money paths.
4. The ledger is append-only. Corrections are compensating entries, never edits or deletes.
5. Reserve funds atomically before execution (row-level lock or serializable transaction). Concurrent calls must never overspend.
6. Every paid call has a unique ID and idempotency key. Replaying a key returns the original result and never double-charges.
7. Tool descriptions, creator docs, upstream responses and external content are untrusted data. They never override system instructions or authorization.
8. Upstream secrets are encrypted at rest, never logged, never returned by any API after submission.
9. Outbound requests are SSRF-guarded (section 7.4).
10. No claim of accuracy or reliability without measured evidence. Seed or demo data is labeled as demo.
11. A real payout or payment is never reported as complete unless the provider confirms it.

---

## 6. Architecture

React frontend talks to the Express backend over REST. The backend owns auth, registry, execution gateway, wallet, ledger, payments and admin. Prisma talks to PostgreSQL. PayPal is reached only from the backend. The AI planner and the MCP server both call the backend service layer; they are clients of the same billing path, so no interface can bypass billing. Registered upstream APIs are called only through the execution gateway.

---

## 7. Functional requirements

### 7.1 Authentication and identity
- Register, login, logout, `GET /me`, session expiry handling, password rules (min length, breach-resistant policy), friendly errors.
- Agents belong to an owner. Agent credentials are high-entropy (at least 256 bits), shown once at creation, stored only as a hash plus a short lookup prefix, support optional expiry, rotation and revocation, and carry scopes.
- An authenticated agent never has unlimited wallet access: it is bound by its own limits.
- Server-side rate limiting on auth, execution and MCP endpoints. Audit log entries for credential creation, rotation, revocation and paid calls.

### 7.2 Tool registration (core feature)
- Fields: name, short and detailed description, category and tags, base URL, endpoint path, HTTP method, input JSON Schema, expected output schema (optional), auth method, upstream credential, price per successful call (micro-USD) and currency, timeout, rate limit, terms and permitted use cases, support contact.
- Auth methods in the MVP: none, API key in header (configurable header name), bearer token. Design the auth field as an extensible discriminated union.
- Registration pipeline: validate URL and schema, encrypt the secret, run a controlled test call with a sample input, validate response shape and timeout behavior, SSRF-check, submit for admin approval, publish only when all checks and moderation pass. Statuses: `draft`, `testing`, `pending_review`, `approved`, `rejected`, `suspended`, `paused`, `retired`. Tool edits create a new `tool_version`; price changes are recorded as history and apply to future calls only.

### 7.3 Discovery and ranking
- Search and filter by query, category, tags, max price, input/output format, and capability.
- Ranking score combines text relevance, task fit, price, measured success rate, measured latency and user preference weights. Measured metrics come only from real execution records. Creator claims are shown separately and labeled unverified. Metrics with too few samples show as insufficient data.

### 7.4 Secure execution gateway
- Per paid call, in this order: authenticate agent, check agent is active and tool is in its allowed set, load authoritative price from the database, validate input against the tool's JSON Schema, check per-call, daily and monthly limits, check the approval threshold (return an approval-required state if exceeded), check idempotency key, reserve funds atomically, execute with bounded resources, run deterministic quality checks, finalize or reverse, write ledger entries and audit log.
- SSRF protection: allow only http(s) and ports 80/443 by default; resolve DNS, reject loopback, private, link-local, multicast, CGNAT and cloud metadata ranges (including IPv6 and IPv4-mapped forms); connect to the validated IP directly (DNS pinning); do not auto-follow redirects, or re-validate every hop; enforce request and response size limits and timeouts; strip hop-by-hop and sensitive headers; recommend network-level egress rules in deployment docs. Arbitrary user code is never executed.

### 7.5 Wallet and ledger
- Track available balance, reserved funds, creator earnings (pending and payable), platform commission, reversals, refunds, payouts and reconciliation events. Use double-entry style ledger accounts (user wallet, reserved, creator payable, platform revenue, payout clearing, external PayPal). Wallet reservation lifecycle: reserved, captured, released. Commission is configurable by admin (basis points) and snapshotted onto each call so history is stable.
- Reversal policy (configurable): automatic reversal only for objective failures (timeout, upstream 5xx, invalid JSON, schema mismatch, missing required fields, empty response, size exceeded); uncertain cases go to manual review; no automatic reversal for subjective poor quality; user-requested refunds are a separate reviewed flow. An LLM verdict is advisory only and cannot move money.

### 7.6 PayPal
- Server-side order creation, client approval through PayPal's flow, server-side capture, verification of amount, currency, status and intended user, webhook signature verification, idempotent webhook processing (unique event ID), wallet credited only after verified success, safe handling of pending, failed, cancelled and duplicate events. Secrets stay on the backend. Microtransactions use the internal ledger, never one PayPal transaction per call. Payouts use an adapter: real PayPal Payouts if eligible, otherwise a mock adapter labeled simulated.

### 7.7 Quality evaluation
- Layer A (deterministic, authoritative for objective policy): timeout, HTTP error, invalid JSON, schema mismatch, missing fields, empty response, size limit.
- Layer B (optional semantic, advisory): pass, fail or uncertain with a reason. Record evidence and the policy decision in the audit trail.

### 7.8 AI agent workflow
- Plan: understand task, identify capabilities, query registry, rank eligible tools, check permissions and budget, estimate total cost, request approval if required, execute via the gateway, pass outputs between tools only when needed and permitted, handle errors and timeouts, summarize results with tools used and charges.
- Two modes: deterministic search-and-rank, and LLM-assisted planning. The LLM receives only tool metadata and returns a structured plan validated by Zod; the backend re-checks every step. Record why each tool was selected.

### 7.9 MCP server
- Tools: `search_tools(query, category, max_price, limit)`, `get_tool_details(tool_id)`, `get_tool_price(tool_id)`, `get_wallet_balance()`, `call_paid_tool(tool_id, input, idempotency_key)`, `get_call_status(call_id)`, `get_usage_history(limit)`.
- STDIO for local use (credential read from environment, never from command-line args or source).
- Streamable HTTP for hosted use with bearer authentication.
- The MVP uses the agent credential as the bearer token and documents that this is not a full OAuth 2.1 flow; OAuth is a listed follow-up. Return structured results and clear errors. Never log or echo credentials. Include client configuration docs and integration tests.

### 7.10 Admin
- Pending queue, approve, reject (with reason), suspend, disable; abuse reports and failed-call review; platform commission setting; usage stats; financial reconciliation report (ledger totals versus PayPal records); audit trail viewer. Admin sees credential metadata only, never plaintext.

---

## 8. Frontend pages

Landing; register, login, logout and session-expiry handling; consumer dashboard (balance, calls, recent transactions, agent spend, tools); marketplace (search, filters, tool detail, verified-versus-claimed metrics); creator dashboard (create, edit, price, validate, submit, usage and earnings charts); agent management (create agent, allowed tools, budgets, credentials shown once, MCP setup instructions); agent playground (task input, plan, selected tools, price estimate, approval prompt, execution timeline, results and per-tool cost, clear errors); wallet and transactions (PayPal Sandbox top-up, available versus reserved versus creator earnings, pending items); earnings and payouts; admin panel (pending listings, tool status, stats, abuse reports, audit trail).

Design: professional dark navy or neutral base with one restrained accent, clean type, responsive, accessible (keyboard, contrast), useful empty and loading states, tool cards with price, capabilities, status and measured metrics. No hardcoded data in the UI: everything comes from backend APIs. Seed scripts may supply labeled demo data.

---

## 9. Data model (Prisma)

`users`, `agents`, `agent_credentials`, `agent_permissions`, `tools`, `tool_versions`, `tool_test_runs`, `wallets`, `wallet_reservations`, `ledger_entries`, `tool_calls`, `creator_earnings`, `topups`, `paypal_orders`, `webhook_events`, `payout_requests`, `quality_reviews`, `audit_logs`, `admin_reviews`, `abuse_reports`, `platform_settings`. Use foreign keys, indexes, unique constraints (idempotency key per agent, webhook event ID, PayPal order ID), timestamps, JSON columns for schemas, BigInt for money, and ownership checks in every query.

---

## 10. API surface

- **Auth:** `POST /api/auth/register`, `/login`, `/logout`; `GET /api/auth/me`
- **Agents:** `POST` and `GET /api/agents`; `GET /api/agents/:id`; `POST /api/agents/:id/credentials`; `DELETE /api/agents/:id/credentials/:credentialId`; `PUT /api/agents/:id/permissions`
- **Tools:** `GET /api/tools`; `GET /api/tools/search`; `GET /api/tools/:id`; `POST /api/tools`; `PUT /api/tools/:id`; `POST /api/tools/:id/test`; `POST /api/tools/:id/submit`; `POST /api/tools/:id/calls`
- **Wallet and billing:** `GET /api/wallet`; `GET /api/wallet/transactions`; `POST /api/wallet/topups`; `POST /api/paypal/orders`; `POST /api/paypal/orders/:orderId/capture`; `POST /api/webhooks/paypal`; `GET /api/calls`; `GET /api/calls/:callId`; `GET /api/creator/earnings`; `POST /api/creator/payouts`
- **Agent:** `POST /api/agent/plan`; `POST /api/agent/execute`
- **Admin:** `GET /api/admin/tools/pending`; `POST /api/admin/tools/:id/approve`, `/reject`, `/suspend`

Publish OpenAPI/Swagger docs. Consistent error shape and response envelope. Zod validation on every input.

---

## 11. Demo tools (local, labeled demo)

1. **Text Translator** (small local dictionary or phrase-based demo, clearly labeled as limited).
2. **Scam Message Risk Analyzer:** heuristic risk score with reasons. Output must state it is a risk assessment, not a determination that a message or person is fraudulent.
3. **Sentiment Analyzer:** lexicon-based.

They are exposed as local HTTP endpoints inside the app so they are registered through the same pipeline as any real API and can be swapped for real ones. Seed script also creates demo users (admin, creator, consumer) with documented dev-only passwords, never enabled in production.

---

## 12. Testing requirements

Registration and login; credential validation, rotation and revocation; tool registration and approval; discovery and ranking; permission enforcement; insufficient balance; price tampering; concurrent calls without overspend; idempotent calls; timeouts and malformed responses; eligible reversals; duplicate PayPal webhooks; PayPal verification; ownership and access-control violations; SSRF blocklist (including redirects and DNS rebinding cases); MCP discovery and invocation. All external services mocked. No real credentials needed to run the suite.

---

## 13. Environment

`.env.example` with: `DATABASE_URL`, `AUTH_SECRET_KEY`, `CREDENTIAL_ENCRYPTION_KEY` (plus key version), `APP_ENV`, `FRONTEND_URL`, `BACKEND_URL`, `CORS_ORIGINS`, `LLM_PROVIDER`, `LLM_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL`, `PAYPAL_WEBHOOK_ID`, `PLATFORM_FEE_BPS`, `TOOL_EXECUTION_TIMEOUT_MS`, `MAX_REQUEST_SIZE`, `PAYMENT_ADAPTER` (mock or paypal), `PAYOUT_ADAPTER`. Validate with Zod at startup; refuse insecure defaults when `APP_ENV` is production. Never commit real secrets.

---

## 14. Repository structure

`backend/` follows the agreed layout: `prisma/` (schema, seed, migrations), `src/` with `config`, `middleware`, `modules` (auth, users, agents, tools, execution, wallet, ledger, payments, creator, earnings, admin, ai-integration), `mcp` (server, tools, auth, stdio and http entry points), `lib`, `utils`, `types`; `tests/`. Plus `frontend/` (pages, components, features, services, hooks), optional `ai-service/`, `docs/`, root `docker-compose.yml`, `.gitignore`, `README`. If files already exist, inspect and preserve useful work. Empty placeholder files are expected: fill them, do not recreate the tree.

---

## 15. Build phases and exit criteria

After each phase: run tests, run the build, fix errors, summarize files changed, state how to verify, then continue without waiting.

1. **Foundation:** package.json, tsconfig, env validation, Prisma schema and first migration, Express app and server, logger, error handler, Docker Compose, health endpoint. *Exit: server boots against Postgres, migration applies.*
2. **Auth, roles, tool registry, marketplace UI:** register and login, role guards, tool CRUD, versions, discovery, frontend shell with auth and marketplace. *Exit: creator creates a draft tool, marketplace lists approved tools.*
3. **Agents and playground (deterministic):** agents, credentials, permissions, budgets, plan endpoint with deterministic ranking, playground UI. *Exit: plan returns ranked tools with cost estimate.*
4. **Execution gateway and SSRF guard:** validation, tool executor, test-run flow, encryption. *Exit: a test call to a demo tool succeeds, blocked destinations fail.*
5. **Ledger and billing:** wallet, reservations, atomic charging, creator earnings, commission, reversals, idempotency. *Exit: concurrency and idempotency tests pass.*
6. **MCP server:** all seven tools over STDIO and Streamable HTTP, using the shared services. *Exit: MCP integration tests pass.*
7. **PayPal:** orders, capture, webhooks, mock adapter, top-up UI. *Exit: mock top-up credits once, duplicate webhook is ignored.*
8. **Quality, admin, hardening, docs:** evaluators, admin panel, reconciliation report, rate limits, OpenAPI, README, deploy notes, final end-to-end run.

---

## 16. Acceptance criteria

The MVP is done only when this works end to end: creator registers a tool and submits it; admin approves; consumer creates an agent with limits; consumer funds the wallet (PayPal Sandbox or labeled dev adapter); consumer gives a natural-language task; the agent discovers and ranks tools by itself; the backend verifies identity, permissions, budget, balance and live price; the tool runs; the ledger records the charge, creator earning and platform fee; eligible failures are reversed per policy; the creator sees usage and earnings; automated tests cover the security and billing invariants; the README lets another developer run everything locally.

Maintain `docs/CHECKLIST.md` with every feature marked implemented, partial or not implemented. Never silently drop a requirement.
