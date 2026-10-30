import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Coins,
  CheckCircle2,
  Terminal,
  Search,
} from 'lucide-react';
import { Badge } from '../components/Badge.jsx';

export const LandingPage = () => {
  return (
    <div className="space-y-24 py-8">
      {/* Hero Section */}
      <section className="relative text-center max-w-4xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-xs font-medium text-indigo-300 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>The Next-Generation Pay-Per-Use API Protocol for Autonomous Agents</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Where APIs Get <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">Monetized</span> &
          AI Agents Discover Them <span className="underline decoration-indigo-500/60 decoration-wavy">Instantly</span>.
        </h1>

        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          API developers publish endpoints and get paid per call. AI agents autonomously discover, rank,
          and pay for tools as required by user tasks — protected by atomic ledger holds, SSRF guardrails, and PayPal.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            to="/playground"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30 hover:scale-[1.02]"
          >
            <Sparkles className="w-5 h-5 text-cyan-300" />
            Try Agent Playground
          </Link>
          <Link
            to="/marketplace"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition"
          >
            <Search className="w-5 h-5 text-indigo-400" />
            Explore Marketplace
          </Link>
          <Link
            to="/creator"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 border border-slate-800/80 transition"
          >
            <Coins className="w-5 h-5 text-amber-400" />
            Monetize an API
          </Link>
        </div>
      </section>

      {/* Workflow Comparison */}
      <section className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Traditional Workflow vs. ToolToll</h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Why manual integration and static subscriptions slow down autonomous agent intelligence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Traditional */}
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <h3 className="text-lg font-bold text-slate-300">Traditional API Integration</h3>
            </div>
            <ul className="space-y-4 text-sm text-slate-400">
              <li className="flex items-start gap-3">
                <span className="text-rose-400 font-bold">1.</span>
                Developer manually searches search engines for specialized APIs.
              </li>
              <li className="flex items-start gap-3">
                <span className="text-rose-400 font-bold">2.</span>
                Reads lengthy documentation, creates test apps, and handles custom auth.
              </li>
              <li className="flex items-start gap-3">
                <span className="text-rose-400 font-bold">3.</span>
                Commits to rigid $50–$500/month subscriptions for tools used only occasionally.
              </li>
              <li className="flex items-start gap-3">
                <span className="text-rose-400 font-bold">4.</span>
                Agents are restricted to hardcoded tools; unable to discover new capabilities on demand.
              </li>
            </ul>
          </div>

          {/* ToolToll */}
          <div className="p-8 rounded-2xl bg-gradient-to-b from-indigo-950/40 to-slate-900/80 border border-indigo-800/50 space-y-6 shadow-xl shadow-indigo-950/30">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-lg font-bold text-white">ToolToll Autonomous Protocol</h3>
            </div>
            <ul className="space-y-4 text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Instant Discovery:</strong> AI agent parses natural language intent and matches registered tools automatically.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>True Pay-Per-Use:</strong> Microtransactions ($0.0100 – $0.0250) billed directly against atomic wallet ledger.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Official MCP Standard:</strong> Connects to Cursor, Claude Desktop, and LangChain via MCP 2.x standard.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Empirical Telemetry:</strong> Creators earn 85% revenue share with measured reliability and automatic failure reversals.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Terminal className="w-5 h-5" />
          </div>
          <h4 className="text-base font-semibold text-white">Official MCP 2.x Server</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Exposes discovery, tool pricing, wallet balance, and paid execution tools over both STDIO and Streamable HTTP.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Coins className="w-5 h-5" />
          </div>
          <h4 className="text-base font-semibold text-white">Atomic Ledger & PayPal</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            High-precision Decimal balance checks, pre-authorization reservation holds, and PayPal Sandbox order capture.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="text-base font-semibold text-white">SSRF Defense & Secret Vault</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Rigorous DNS resolution checks blocking loopbacks and cloud metadata endpoints. Upstream secrets encrypted via AES-256.
          </p>
        </div>
      </section>

      {/* Interactive Quick Demonstration Banner */}
      <section className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-800/60 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-3 max-w-lg">
          <Badge variant="cyan">Instant Interactive Demo</Badge>
          <h3 className="text-2xl font-bold text-white">
            Experience Autonomous Multi-Tool Execution Now
          </h3>
          <p className="text-sm text-slate-300">
            Send an SMS to be translated and scanned for phishing risks. Watch the agent plan, reserve funds, execute tools, and summarize results in real time.
          </p>
        </div>
        <Link
          to="/playground"
          className="px-6 py-3.5 rounded-xl font-bold bg-white text-slate-950 hover:bg-slate-200 transition shadow-xl shrink-0 flex items-center gap-2"
        >
          Open AI Playground <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
};
