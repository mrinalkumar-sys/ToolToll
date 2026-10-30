# ToolToll — AI-Powered Pay-Per-Use API Marketplace & Monetization Protocol

ToolToll is an AI-powered marketplace where API developers can register, monetize, and distribute their APIs, and autonomous AI agents can discover, rank, and pay for those APIs dynamically whenever a user's task requires them.

---

## 1. Product Vision & Architecture

### Traditional API Workflow
1. Developer manually searches a catalogue of APIs.
2. Reads documentation, registers an app, and manually implements authentication.
3. Pays $50–$500/month recurring subscriptions for APIs used only occasionally.
4. AI agents are limited to hardcoded, static tools.

### The ToolToll Autonomous Workflow
1. **API Creators**: Register endpoints, HTTP methods, JSON Schemas, pricing, and encrypted upstream credentials.
2. **Platform Moderation & SSRF Guard**: ToolToll validates schema integrity, blocks private/cloud-metadata addresses (SSRF), executes controlled tests, and approves tools.
3. **AI Agents & MCP**: AI agents connect to ToolToll via the official Python Model Context Protocol (MCP 2.x) standard (STDIO or Streamable HTTP).
4. **Natural-Language Discovery**: A user describes a task (e.g., *"Translate this suspicious SMS into English, check whether it might be a scam, and summarize the warning signs"*).
5. **Autonomous Planning & Ranking**: The agent identifies required capabilities, queries ToolToll's tool registry, compares prices and measured empirical reliability, and builds a plan.
6. **Atomic Ledger Billing**: ToolToll verifies agent permissions, checks spending limits (per-call, daily, monthly), reserves funds atomically via PostgreSQL/SQLite double-entry ledger, executes the API securely, and commits charges upon verified quality.
7. **Creator Revenue Share**: ToolToll transfers 85% net earnings to the API creator, retaining 15% platform infrastructure fee.

---

## 2. Technology Stack

- **Backend**: Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.x (Asyncio), Greenlet, Alembic, PostgreSQL / SQLite (aiosqlite), Argon2id password hashing, PyJWT, Cryptography (Fernet AES-256), HTTPX.
- **Frontend**: React 19, JavaScript (JSX), Vite, Tailwind CSS v4, Lucide Icons, React Router v7, TanStack Query, React Hook Form.
- **Agent Integration**: Official Python MCP SDK 2.x (`mcp.server.mcpserver.MCPServer`), exposing 7 discovery & execution tools over STDIO and Streamable HTTP.
- **Payments**: PayPal Orders API (v2) in Sandbox mode, idempotent webhook receiver, and simulated mock payment adapter for zero-friction local development.
- **Single-Folder Architecture**: All frontend and backend files are organized directly in a single root folder with unified build and runner scripts.

---

## 3. Single-Folder Project Layout

```
tooltoll/
├── app/                  # FastAPI backend routes, models, schemas, and services
│   ├── api/              # Auth, agents, tools, wallet, execution, admin endpoints
│   ├── core/             # Database, config, security (Argon2id/Fernet), SSRF protection
│   ├── models/           # SQLAlchemy 2.x models (User, Agent, Tool, Wallet, Ledger)
│   ├── schemas/          # Pydantic v2 request/response validation
│   └── services/         # Ledger, PayPal, tool execution, quality tracking
├── src/                  # React + Vite + JavaScript UI source
│   ├── components/       # Layout, Navbar, Badges, Modals
│   ├── context/          # AuthContext with persistent JWT session state
│   ├── pages/            # All 10 dashboard pages (Playground, Marketplace, Wallet, etc.)
│   └── services/         # Axios/Fetch API client
├── public/               # Static assets & SVG icons
├── dist/                 # Production compiled frontend build
├── migrations/           # Alembic database schema migrations
├── tests/                # 8 comprehensive pytest suites
├── index.html            # Single page app entrypoint
├── package.json          # Frontend dependencies & unified npm scripts
├── vite.config.js        # Vite config with custom port (5185) and /api proxy
├── requirements.txt      # Python backend dependencies
├── mcp_server.py         # Official Python MCP SDK 2.x server
├── tooltoll.db           # SQLite database with pre-seeded demo data
├── run.py                # Cross-platform runner for backend + frontend
├── start.bat             # Windows 1-click launcher
├── build.bat             # Windows 1-click frontend build
├── pytest.ini            # Pytest configuration
└── alembic.ini           # Alembic migration configuration
```

---

## 4. Quick Start (Single Folder)

### Prerequisites
- Node.js (v18+) and npm
- Python (v3.11+)

### Option A: Run Both with the Unified Python Runner
```bash
python run.py
```
This launches:
- **Frontend**: `http://127.0.0.1:5200`
- **Backend API**: `http://127.0.0.1:8090` (with `/api` proxying)
- **API Docs**: `http://127.0.0.1:8090/docs`

### Option B: Windows 1-Click Launcher
Double-click `start.bat` or run:
```cmd
start.bat
```

### Option C: Run Services Independently from the Single Folder
In Terminal 1 (Backend):
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8090
```

In Terminal 2 (Frontend):
```bash
npm run dev
```

### Option D: Build Production Frontend
```cmd
npm run build
```
Builds the optimized production assets directly into `./dist/`.

---

## 5. Seeded Accounts for Testing

The application automatically seeds the database on startup with ready-to-use accounts:

| Role | Email | Password | Initial Balance |
| :--- | :--- | :--- | :--- |
| **Consumer (Agent Owner)** | `consumer@tooltoll.io` | `ConsumerPass123!` | **$50.00 USD** (Ready to test) |
| **API Creator** | `creator@tooltoll.io` | `CreatorPass123!` | **$0.00 USD** |
| **Administrator** | `admin@tooltoll.io` | `AdminPass123!` | **$100.00 USD** |

*Note: The frontend top navigation includes a convenient **Role Switcher** dropdown for 1-click switching between these roles.*

---

## 4. Safe Pre-Seeded Demo Tools

ToolToll comes pre-configured with 3 safe, approved demo tools:

1. **Neural Text Translator** (`text-translator`)
   - Category: `translation`
   - Price: `$0.0150` / call
   - Translates text between English, Spanish, French, German, and Japanese.
2. **Scam & Phishing Risk Analyzer** (`scam-risk-analyzer`)
   - Category: `security`
   - Price: `$0.0250` / call
   - Analyzes SMS, emails, and chat messages for financial urgency, suspicious links, and banking impersonation. *Disclaimer: Heuristic risk assessment signal, not a legal fraud determination.*
3. **Sentiment & Emotion Analyzer** (`sentiment-analyzer`)
   - Category: `nlp`
   - Price: `$0.0100` / call
   - Analyzes sentiment polarity and dominant emotional tone.

---

## 5. Quick Start (Local Development)

### Prerequisites
- Node.js (v18+) and npm
- Python (v3.11+)

### A. Start the Backend API

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run database migrations (optional, lifespan runs automatically)
alembic upgrade head

# Launch FastAPI development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be live at: `http://127.0.0.1:8000/docs`

### B. Start the Frontend Dashboard

```bash
cd frontend

# Install packages
npm install --legacy-peer-deps

# Start Vite dev server
npm run dev
```
Open your browser at: `http://localhost:5173`

---

## 6. Running the Automated Test Suite

A comprehensive test suite validates all security, ledger, and billing invariants:

```bash
cd backend
pytest -v
```

### Test Coverage Summary:
- `tests/test_auth.py`: User registration, Argon2id hashing, and JWT tokens.
- `tests/test_agents.py`: Agent creation, high-entropy credential generation, rotation, and revocation.
- `tests/test_tools.py`: Marketplace search, SSRF defense (blocking `169.254.169.254`), controlled testing, and admin approval.
- `tests/test_wallet_ledger.py`: Atomic reservation holds, double-entry ledger entries, and mock PayPal top-ups.
- `tests/test_execution_security.py`: Paid tool execution, authoritative price enforcement, and idempotency protection (preventing duplicate billing).
- `tests/test_paypal.py`: PayPal order creation, server-side capture, and duplicate webhook idempotency.
- `tests/test_mcp.py`: Official MCP server discovery and tool execution via Python SDK.
- `tests/test_e2e_scenario.py`: Complete Section 20 end-to-end acceptance flow.

---

## 7. Connecting MCP-Compatible Clients (Cursor, Claude Desktop, Python)

ToolToll implements the Model Context Protocol (MCP 2.x).

### Exposed MCP Tools:
- `search_tools(query, category, max_price, limit)`
- `get_tool_details(tool_id)`
- `get_tool_price(tool_id)`
- `get_wallet_balance()`
- `call_paid_tool(tool_id, input_json, idempotency_key)`
- `get_call_status(call_id)`
- `get_usage_history(limit)`

### Connecting Claude Desktop or Cursor:
Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tooltoll": {
      "command": "python",
      "args": ["-m", "mcp_server", "--transport", "stdio"],
      "env": {
        "TOOLTOLL_AGENT_KEY": "tt_agent_your_generated_agent_key_here",
        "TOOLTOLL_API_URL": "http://localhost:8000/api"
      }
    }
  }
}
```

Or run the MCP server over remote Streamable HTTP / SSE:
```bash
python mcp_server.py --transport http --port 8001
```

---

## 8. Security Guardrails

1. **SSRF Mitigation (`app/core/ssrf.py`)**:
   - URL scheme whitelist: `http`, `https` only.
   - Host DNS is resolved before dispatching requests.
   - Rejects loopback (`127.0.0.0/8`, `::1`), link-local / cloud metadata (`169.254.169.254`), private IP networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and non-routable CIDR blocks.
2. **Encrypted Secret Storage**:
   - Upstream API keys and bearer tokens are encrypted at rest using AES-256 (Fernet) using keys supplied via environment secrets. Secrets are never transmitted back to browsers or callers.
3. **High-Entropy Agent Credentials**:
   - Agent credentials (`tt_agent_<token>`) are stored as cryptographic SHA-256 hashes. Plaintext keys are shown strictly once upon creation.
4. **Authoritative Price & Atomic Ledger Holds**:
   - Prices are read strictly from the database. Client or LLM price tampering is mathematically impossible.
   - Pre-authorization reservations atomically increment `reserved_balance` before outbound requests, eliminating race conditions and concurrent double-spending.
5. **Quality Review & Automatic Reversals**:
   - Deterministic checks (timeout, 5xx, schema mismatch) trigger automatic release of reservation holds or ledger reversal refunds.

---

## 9. Deployment Guide

### Docker Compose
Run the entire production-grade stack (PostgreSQL 16, FastAPI backend, Nginx frontend):

```bash
docker compose up --build -d
```

### Deploy Backend to Render / Railway
1. Set Environment Variables:
   - `DATABASE_URL`: Managed PostgreSQL async connection string (`postgresql+asyncpg://...`)
   - `AUTH_SECRET_KEY`: Random 64-character secret
   - `AGENT_CREDENTIAL_ENCRYPTION_KEY`: 32-byte urlsafe Fernet key
   - `PAYPAL_MODE`: `sandbox`
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Deploy Frontend to Vercel
1. Set Root Directory to `frontend`.
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Set Environment Variable: `VITE_API_URL` pointing to hosted backend.

---

## License
MIT License. Built for the autonomous agent economy.
