import React, { useState, useEffect } from 'react';
import {
  Bot,
  Plus,
  Key,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Sliders,
  Terminal,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import { Modal } from '../components/Modal.jsx';

export const AgentManagementPage = () => {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Agent Modal
  const [isCreateAgentOpen, setIsCreateAgentOpen] = useState(false);
  const [agentForm, setAgentForm] = useState({
    name: '',
    description: '',
    per_call_limit: '1.0000',
    daily_limit: '25.0000',
    monthly_limit: '500.0000',
    auto_approval_max: '0.1000',
  });

  // New Credential Display Modal (Shown only once!)
  const [newRawKeyModal, setNewRawKeyModal] = useState({
    isOpen: false,
    rawToken: '',
    agentName: '',
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      loadCredentials(selectedAgent.id);
    }
  }, [selectedAgent]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const data = await api.getAgents();
      setAgents(data);
      if (data.length > 0 && !selectedAgent) {
        setSelectedAgent(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCredentials = async (agentId) => {
    try {
      const data = await api.getAgentCredentials(agentId);
      setCredentials(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    try {
      const res = await api.createAgent({
        name: agentForm.name,
        description: agentForm.description || undefined,
        per_call_limit: parseFloat(agentForm.per_call_limit),
        daily_limit: parseFloat(agentForm.daily_limit),
        monthly_limit: parseFloat(agentForm.monthly_limit),
        auto_approval_max: parseFloat(agentForm.auto_approval_max),
      });

      setIsCreateAgentOpen(false);
      await loadAgents();
      setSelectedAgent(res.agent);

      // Open Show-Once Credential Modal
      setNewRawKeyModal({
        isOpen: true,
        rawToken: res.initial_credential.raw_token,
        agentName: res.agent.name,
      });
    } catch (err) {
      alert(err.message || 'Failed to create agent');
    }
  };

  const handleGenerateNewKey = async () => {
    if (!selectedAgent) return;
    try {
      const res = await api.issueAgentCredential(selectedAgent.id, {
        name: `Key generated ${new Date().toLocaleDateString()}`,
        expires_in_days: 90,
      });
      await loadCredentials(selectedAgent.id);
      setNewRawKeyModal({
        isOpen: true,
        rawToken: res.raw_token,
        agentName: selectedAgent.name,
      });
    } catch (err) {
      alert(err.message || 'Failed to issue credential');
    }
  };

  const handleRevokeKey = async (credId) => {
    if (!selectedAgent) return;
    if (!confirm('Are you sure you want to revoke this agent credential immediately?')) return;
    try {
      await api.revokeAgentCredential(selectedAgent.id, credId);
      await loadCredentials(selectedAgent.id);
    } catch (err) {
      alert(err.message || 'Failed to revoke credential');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-900">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Agent Identities & MCP Access</h1>
          <p className="text-xs text-slate-400">
            Configure agent permissions, spending ceilings, and high-entropy credentials for MCP clients.
          </p>
        </div>
        <button
          onClick={() => setIsCreateAgentOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create New Agent
        </button>
      </div>

      {/* Main Layout: Left Agent List, Right Configuration Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Agents List */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Your Registered Agents ({agents.length})
          </span>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading agents...</div>
          ) : agents.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
              No agents created yet. Click "Create New Agent" to deploy your first agent.
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((ag) => (
                <button
                  key={ag.id}
                  onClick={() => setSelectedAgent(ag)}
                  className={`w-full text-left p-4 rounded-xl border transition flex items-center justify-between group cursor-pointer ${
                    selectedAgent?.id === ag.id
                      ? 'bg-indigo-950/40 border-indigo-600 shadow-md shadow-indigo-950/40'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-indigo-400">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition">
                        {ag.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Per-call limit: ${Number(ag.per_call_limit).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <Badge variant={ag.is_active ? 'success' : 'default'} className="text-[9px]">
                    {ag.is_active ? 'Active' : 'Disabled'}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Selected Agent Controls */}
        {selectedAgent ? (
          <div className="lg:col-span-2 space-y-6">
            {/* Spending Limits Card */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">
                    Spending Limits & Guardrails ({selectedAgent.name})
                  </h3>
                </div>
                <Badge variant="cyan">Policy Active</Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Per-Call Limit</span>
                  <div className="text-base font-bold text-white font-mono">
                    ${Number(selectedAgent.per_call_limit).toFixed(2)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Daily Limit</span>
                  <div className="text-base font-bold text-white font-mono">
                    ${Number(selectedAgent.daily_limit).toFixed(2)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Monthly Limit</span>
                  <div className="text-base font-bold text-white font-mono">
                    ${Number(selectedAgent.monthly_limit).toFixed(2)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Auto-Approve Max</span>
                  <div className="text-base font-bold text-emerald-400 font-mono">
                    ${Number(selectedAgent.auto_approval_max).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* MCP Credentials List */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Agent High-Entropy Credentials</h3>
                </div>
                <button
                  onClick={handleGenerateNewKey}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Generate New Key
                </button>
              </div>

              <div className="space-y-2">
                {credentials.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4 text-center">
                    No active credentials. Generate a key to connect this agent via MCP.
                  </div>
                ) : (
                  credentials.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{c.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {c.key_prefix}...
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Created: {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {c.revoked_at ? (
                        <Badge variant="danger" className="text-[10px]">
                          Revoked
                        </Badge>
                      ) : (
                        <button
                          onClick={() => handleRevokeKey(c.id)}
                          className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition cursor-pointer"
                          title="Revoke Credential"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* MCP Client Setup Instructions */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Connecting MCP-Compatible Clients</h3>
              </div>
              <p className="text-xs text-slate-400">
                Configure Claude Desktop, Cursor, or your local agent harness to access ToolToll APIs via STDIO or Streamable HTTP.
              </p>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-300">
                  Claude Desktop (`claude_desktop_config.json`) / Cursor snippet:
                </span>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
{JSON.stringify(
  {
    mcpServers: {
      tooltoll: {
        command: "python",
        args: ["-m", "mcp_server", "--transport", "stdio"],
        env: {
          TOOLTOLL_AGENT_KEY: credentials[0] ? `${credentials[0].key_prefix}...` : "YOUR_AGENT_KEY",
          TOOLTOLL_API_URL: "http://localhost:8088/api",
        },
      },
    },
  },
  null,
  2
)}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
            Select an agent from the list or create a new one to view and edit settings.
          </div>
        )}
      </div>

      {/* Create Agent Modal */}
      <Modal
        isOpen={isCreateAgentOpen}
        onClose={() => setIsCreateAgentOpen(false)}
        title="Deploy New Agent Identity"
      >
        <form onSubmit={handleCreateAgent} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Agent Name</label>
            <input
              type="text"
              required
              value={agentForm.name}
              onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
              placeholder="e.g. Threat Intelligence Agent"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Description</label>
            <textarea
              rows={2}
              value={agentForm.description}
              onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })}
              placeholder="Autonomous agent analyzing suspicious messages and market signals"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Per-Call Spending Limit ($)</label>
              <input
                type="number"
                step="0.05"
                min="0.01"
                required
                value={agentForm.per_call_limit}
                onChange={(e) => setAgentForm({ ...agentForm, per_call_limit: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Daily Budget Ceiling ($)</label>
              <input
                type="number"
                step="1"
                min="1"
                required
                value={agentForm.daily_limit}
                onChange={(e) => setAgentForm({ ...agentForm, daily_limit: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Monthly Budget Ceiling ($)</label>
              <input
                type="number"
                step="10"
                min="5"
                required
                value={agentForm.monthly_limit}
                onChange={(e) => setAgentForm({ ...agentForm, monthly_limit: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Auto-Approval Threshold ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={agentForm.auto_approval_max}
                onChange={(e) => setAgentForm({ ...agentForm, auto_approval_max: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition mt-2 cursor-pointer"
          >
            Create Agent & Generate Key
          </button>
        </form>
      </Modal>

      {/* Show Once Credential Modal */}
      <Modal
        isOpen={newRawKeyModal.isOpen}
        onClose={() => setNewRawKeyModal({ ...newRawKeyModal, isOpen: false })}
        title="Agent Credential Created"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800/80 text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Important Security Notice:</span>
              <p className="mt-0.5">
                This credential is only displayed <strong>once</strong>. Store it safely in your environment variables or key vault. It cannot be recovered once this modal is closed.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">High-Entropy Agent Token:</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={newRawKeyModal.rawToken}
                className="flex-1 px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs select-all outline-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(newRawKeyModal.rawToken)}
                className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setNewRawKeyModal({ ...newRawKeyModal, isOpen: false })}
            className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition mt-2 cursor-pointer"
          >
            I have safely stored this credential
          </button>
        </div>
      </Modal>
    </div>
  );
};
