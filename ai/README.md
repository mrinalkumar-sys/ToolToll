# ToolToll AI Service (Groq & Claude Powered)

**ToolToll AI Service** is the specialized Python FastAPI service powering intelligence across the **ToolToll API Marketplace & Monetization Gateway**.

It features native support for ultra-fast inference with **Groq** (`llama-3.3-70b-versatile` & `llama-3.1-8b-instant`) as well as **Anthropic Claude**.

---

## Capabilities

1. **Tool Discovery (`/api/v1/tools/discover`)**: Natural-language semantic discovery & BM25 ranking across approved marketplace tools.
2. **Agent Planner (`/api/v1/agent/plan`)**: Groq/Claude-powered structured planning with parameter schema validation, circular dependency prevention, and budget caps.
3. **Quality Judge (`/api/v1/judge/evaluate`)**: Two-stage evaluation (Stage-1 deterministic rules + Stage-2 Groq/Claude semantic checks with SRS fail-open fallback) to safeguard agent spending.
4. **Price Advisor (`/api/v1/advisor/suggest-price`)**: Intelligence-driven per-call pricing recommendations based on marketplace comparables and capability complexity.
5. **API Onboarding (`/api/v1/onboarding/draft`)**: Automated conversion of unstructured documentation or OpenAPI specifications into schema-compliant tool drafts with SSRF security verification.
6. **Demo Agent Workflow (`/api/v1/agent/run`)**: End-to-end autonomous agent workflow discovering tools, planning steps, executing paid calls through the main backend gateway, evaluating output quality, and synthesizing results.

---

## Quick Start from VS Code Terminal

### 1. Set Your Groq API Key in `.env`
Run this one-line command (replace `gsk_YOUR_KEY` with your actual key):
```powershell
cd C:\Users\Hp\Downloads\tooltoll-ai-service
(Get-Content .env) -replace 'GROQ_API_KEY=.*', 'GROQ_API_KEY=gsk_YOUR_KEY' | Set-Content .env
```

### 2. Run the Service
```powershell
python run.py
```

### 3. Open in Browser
- **Interactive Swagger UI**: [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs)
- **Health Check**: [http://127.0.0.1:8001/health](http://127.0.0.1:8001/health)
