import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet as WalletIcon,
  Bot,
  Zap,
  Activity,
  Sparkles,
  CheckCircle2,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';

export const ConsumerDashboard = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [agents, setAgents] = useState([]);
  const [recentCalls, setRecentCalls] = useState([]);
  const [topTools, setTopTools] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [w, a, c, t] = await Promise.all([
          api.getWallet(),
          api.getAgents(),
          api.getCallHistory(10),
          api.getTools(),
        ]);
        setWallet(w);
        setAgents(a);
        setRecentCalls(c);
        setTopTools(t.slice(0, 3));
      } catch (err) {
        console.error(err);
      }
    }
    loadData();
  }, []);

  const totalSpent = recentCalls
    .filter((c) => c.status === 'success')
    .reduce((acc, c) => acc + Number(c.price_charged || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-900">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome back, {user?.full_name}
          </h1>
          <p className="text-xs text-slate-400">
            Consumer & Agent Command Center • Autonomous Pay-Per-Use Tool Execution
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/playground"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/20"
          >
            <Sparkles className="w-4 h-4 text-cyan-300" />
            Launch AI Playground
          </Link>
          <Link
            to="/wallet"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition"
          >
            <WalletIcon className="w-4 h-4 text-emerald-400" />
            Top Up Balance
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Wallet Balance */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Available Balance</span>
            <WalletIcon className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            ${Number(wallet?.available_balance || 0).toFixed(4)}{' '}
            <span className="text-xs text-slate-500 font-normal">USD</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Reserved hold:</span>
            <span className="text-amber-400 font-mono">${Number(wallet?.reserved_balance || 0).toFixed(4)}</span>
          </div>
        </div>

        {/* Total Calls */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Recorded Tool Calls</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {recentCalls.length}
          </div>
          <p className="text-[11px] text-slate-500">Autonomous & manual invocations</p>
        </div>

        {/* Active Agents */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Registered Agents</span>
            <Bot className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {agents.length}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">MCP credentials active</span>
            <Link to="/agents" className="text-cyan-400 hover:underline">Manage &rarr;</Link>
          </div>
        </div>

        {/* Total Spent in Session */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Recent Spend</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            ${totalSpent.toFixed(4)}
          </div>
          <p className="text-[11px] text-slate-500">100% auditable on-ledger charges</p>
        </div>
      </div>

      {/* Grid: Recent Executions + Featured Marketplace Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Executions Table (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              <h3 className="font-semibold text-sm text-white">Recent Paid Tool Executions</h3>
            </div>
            <Link to="/wallet" className="text-xs text-indigo-400 hover:underline">
              View all transactions &rarr;
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            {recentCalls.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No tool calls executed yet. Try asking the Agent Playground to perform a task!
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/50 text-slate-400 font-medium border-b border-slate-800/80">
                  <tr>
                    <th className="px-6 py-3">Tool Name</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Price</th>
                    <th className="px-6 py-3">Latency</th>
                    <th className="px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {recentCalls.map((c) => (
                    <tr key={c.call_id} className="hover:bg-slate-800/30 transition">
                      <td className="px-6 py-3.5 font-medium text-white flex items-center gap-2">
                        <span>{c.tool_name}</span>
                        {c.quality_status === 'pass' && (
                          <span title="Quality verified">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <Badge
                          variant={
                            c.status === 'success'
                              ? 'success'
                              : c.status === 'reversed'
                              ? 'warning'
                              : 'danger'
                          }
                        >
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-200">
                        ${Number(c.price_charged).toFixed(4)}
                      </td>
                      <td className="px-6 py-3.5 text-slate-400 font-mono">
                        {Number(c.duration_ms).toFixed(0)}ms
                      </td>
                      <td className="px-6 py-3.5 text-slate-500">
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Featured Marketplace Tools (1 col) */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-white">Popular Tools</h3>
              <Link to="/marketplace" className="text-xs text-indigo-400 hover:underline">
                Marketplace &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {topTools.map((t) => (
                <Link
                  key={t.id}
                  to={`/marketplace`}
                  className="block p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-white group-hover:text-indigo-400 transition">
                      {t.name}
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-emerald-400">
                      ${Number(t.price_per_call).toFixed(3)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                    {t.short_desc}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="purple" className="text-[9px] py-0">
                      {t.category}
                    </Badge>
                    <span className="text-[10px] text-slate-500">
                      {t.total_calls} calls verified
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick CTA to Playground */}
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/50 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Prompt Your Agent</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Describe any task in natural language. The agent chooses and coordinates the best tools automatically.
            </p>
            <Link
              to="/playground"
              className="inline-block text-xs font-semibold text-cyan-300 hover:underline pt-1"
            >
              Open AI Playground &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
