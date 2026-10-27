# ToolToll MVP Implementation Checklist

Status: `[ ] Not Implemented` | `[~] Partial` | `[x] Implemented`

---

## 1. Non-Negotiable Invariants
- [ ] 1. Backend alone decides prices, permissions, balances, and approvals (no client/LLM authoritative pricing).
- [ ] 2. Owner and agent identity come strictly from authenticated credentials (never request bodies).
- [ ] 3. Micro-USD (1 USD = 1,000,000 units) stored as `BigInt` (no floats in money paths).
- [ ] 4. Append-only ledger; corrections are compensating entries, never edits or deletes.
- [ ] 5. Atomic fund reservation before execution (row-level lock / serializable transaction, no concurrent overspend).
- [ ] 6. Unique call ID and idempotency key per paid call (replays return original result, no double-charge).
- [ ] 7. Untrusted data handling: tool descriptions, docs, upstream responses treated as untrusted, never overriding system instructions.
- [ ] 8. Upstream secrets encrypted at rest (AES-256-GCM), never logged, never returned by APIs.
- [ ] 9. Strict SSRF protection on outbound calls (DNS pinning, private/loopback/cloud IP rejection, no auto-redirects, size & timeout limits).
- [ ] 10. No unverified reliability/accuracy claims; seed/demo data clearly labeled.
- [ ] 11. Payments/payouts never marked complete without verified provider confirmation.

---

## 2. Roles & Authentication (PRD 3 & 7.1)
- [ ] Multi-role support (User can be Creator, Consumer, and/or Admin).
- [ ] Register (`POST /api/auth/register`), Login (`POST /api/auth/login`), Logout (`POST /api/auth/logout`), Current User (`GET /api/auth/me`).
- [ ] Argon2id/bcrypt password hashing with breach-resistant strength validation.
- [ ] JWT authentication in httpOnly secure cookies with CSRF protection + Bearer fallback for agents.
- [ ] High-entropy agent credentials (>=256-bit entropy), stored as hash + prefix, shown once at creation.
- [ ] Agent credential rotation, expiry, revocation, and scoped permissions.
- [ ] Agent spending limits: per-call, daily, and monthly budget enforcement.
- [ ] Rate limiting on auth, execution, and MCP endpoints.
- [ ] Audit logging for credential lifecycle and paid execution events.

---

## 3. Tool Registration & Lifecycle (PRD 7.2)
- [ ] Tool model with name, descriptions, category, tags, base URL, endpoint path, method, input JSON Schema, output schema, auth config, price (micro-USD), timeout, rate limit.
- [ ] Extensible discriminated union for upstream auth (None, Header API Key, Bearer Token).
- [ ] Tool secret AES-256-GCM encryption with versioned environment keys.
- [ ] Registration pipeline: URL validation, schema checks, SSRF verification, sample test-run invocation.
- [ ] Tool status lifecycle: `draft`, `testing`, `pending_review`, `approved`, `rejected`, `suspended`, `paused`, `retired`.
- [ ] Tool versioning (`tool_version`) on updates and immutable historical pricing for past executions.

---

## 4. Discovery & Ranking (PRD 7.3)
- [ ] Search and filter by query, category, tags, max price, input/output formats, and capabilities.
- [ ] Hybrid ranking combining text match, task fit, price, measured real latency, and measured success rate.
- [ ] Distinction between verified measured metrics and unverified creator claims (with "insufficient data" label for low samples).

---

## 5. Execution Gateway & SSRF Guard (PRD 7.4)
- [ ] Execution pipeline in exact order:
  - Agent authentication
  - Check active status & allowed tools
  - Authoritative price loading from DB
  - Input JSON Schema validation
  - Per-call, daily, and monthly limit verification
  - Approval threshold check (return approval-required if exceeded)
  - Idempotency key lookup
  - Atomic wallet reservation
  - Sandboxed execution with timeout and size bounds
  - Deterministic quality checks
  - Finalize capture or compensating reversal
  - Ledger and audit log commit
- [ ] Custom undici/fetch DNS-pinned SSRF guard rejecting private, loopback, link-local, multicast, CGNAT, and cloud metadata (IPv4 & IPv6).
- [ ] Prohibition of arbitrary user code execution.

---

## 6. Wallet & Ledger System (PRD 7.5)
- [ ] Double-entry style accounts: user wallet, reserved, creator payable, platform revenue, payout clearing, external PayPal.
- [ ] Reservation lifecycle: `reserved` -> `captured` or `released`.
- [ ] Configurable platform commission in basis points, snapshotted per call.
- [ ] Automated reversal policy for objective failures (5xx, timeout, schema mismatch, malformed JSON, empty response).
- [ ] Manual review queue for subjective or uncertain complaints; LLM advice strictly advisory.

---

## 7. Payments & Payouts (PayPal & Mock) (PRD 7.6)
- [ ] Server-side PayPal order creation (`POST /api/paypal/orders`).
- [ ] PayPal order capture (`POST /api/paypal/orders/:orderId/capture`).
- [ ] Webhook handler (`POST /api/webhooks/paypal`) with signature verification and idempotent event deduplication.
- [ ] Top-up credits applied only after verified capture confirmation.
- [ ] Pluggable payment adapter (`PAYMENT_ADAPTER=mock` or `paypal`).
- [ ] Pluggable payout adapter (`PAYOUT_ADAPTER=mock` or `paypal`) with clear simulated labeling in mock mode.

---

## 8. Quality Evaluation (PRD 7.7)
- [ ] Layer A: Deterministic quality checks (HTTP status, schema compliance, response format, latency/timeouts).
- [ ] Layer B: Semantic quality advisory evaluation (record reasons, non-blocking for money movements).
- [ ] Comprehensive audit log capturing inputs, outputs (sanitized), policy evaluations, and results.

---

## 9. AI Agent Workflow & Planning (PRD 7.8)
- [ ] Agent planning endpoint (`POST /api/agent/plan`): understand natural language task, match tools, rank options, compute estimated micro-USD cost.
- [ ] Agent execution endpoint (`POST /api/agent/execute`): step-by-step orchestrator with budget checking, human-approval gating, and output chaining.
- [ ] Deterministic fallback planner when no LLM key is configured.
- [ ] Provider-independent LLM adapter interface (OpenAI, Anthropic, or mock).

---

## 10. Model Context Protocol (MCP) Server (PRD 7.9)
- [ ] Runs as its own process in `backend/src/mcp` reusing backend service layer.
- [ ] Seven MCP tools:
  - `search_tools`
  - `get_tool_details`
  - `get_tool_price`
  - `get_wallet_balance`
  - `call_paid_tool`
  - `get_call_status`
  - `get_usage_history`
- [ ] STDIO transport (reads agent token from environment).
- [ ] Streamable HTTP transport with Bearer token authentication.
- [ ] Client configuration documentation and integration tests.

---

## 11. Admin Panel & Governance (PRD 7.10)
- [ ] Pending tools moderation queue with approve/reject (with reason)/suspend actions.
- [ ] Abuse reports and failed calls review queue.
- [ ] Platform commission setting (BPS).
- [ ] Financial reconciliation report (ledger totals vs PayPal transactions).
- [ ] System audit trail viewer (metadata only, no raw credentials).

---

## 12. Local Demo Tools (PRD 11)
- [ ] Demo Tool 1: Text Translator (phrase-based demo, clearly labeled limited).
- [ ] Demo Tool 2: Scam Message Risk Analyzer (heuristic risk score with disclaimer).
- [ ] Demo Tool 3: Sentiment Analyzer (lexicon-based).
- [ ] Built-in HTTP endpoints and database seed entries for immediate local testing.

---

## 13. Frontend UI (PRD 8)
- [ ] Aesthetic design system (Dark navy / neutral base, restrained cyber-cyan/amber accent, glassmorphism, responsive, keyboard accessible).
- [ ] Landing page with product overview and quick navigation.
- [ ] Auth pages: Register, Login, Session handling.
- [ ] Consumer Dashboard (balance overview, quick stats, recent calls, top tools).
- [ ] Marketplace (search, category filters, tool details, verified vs claimed metrics, run sample test).
- [ ] Creator Dashboard (register tool, edit, versioning, test-run, submit for review, earnings and usage charts).
- [ ] Agent Management (create agent, show credential once, budget limits, allowed tools, MCP setup instructions).
- [ ] Agent Playground (natural language task, plan generation, cost estimate, approval prompt, interactive execution timeline, step results).
- [ ] Wallet & Transactions (PayPal Sandbox top-up, mock top-up button in dev, balance breakdown, transaction log).
- [ ] Creator Earnings & Payouts (gross earnings, platform fees, net earnings, payout request modal).
- [ ] Admin Dashboard (pending tools queue, abuse reports, financial reconciliation, audit logs).

---

## 14. DevOps, Build & Testing (PRD 12-16)
- [ ] Root `docker-compose.yml` orchestrating PostgreSQL, Backend, and Frontend.
- [ ] Comprehensive `.env.example` with Zod validation on backend boot.
- [ ] Vitest & Supertest automated test suite covering:
  - Auth and credentials
  - Tool registration and admin approval
  - SSRF guard blocking private/loopback/cloud ranges
  - Concurrent atomic reservations without overspending
  - Idempotency deduplication
  - Reversals on failure
  - MCP stdio & http protocol operations
  - PayPal webhook deduplication
- [ ] Complete `README.md` with step-by-step instructions for running locally and with Docker.
