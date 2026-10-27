import React, { useState, useEffect } from 'react';
import { Agent } from '../../types';
import { api } from '../../services/api';
import { formatMicroUsd, formatDate } from '../../utils/formatters';
import {
  Bot,
  Plus,
  Key,
  Shield,
  Copy,
  Check,
  Code2,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';

export const AgentManagementView: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'agents' | 'mcp'>('agents');

  // Create Agent modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxBudget, setMaxBudget] = useState('1000000'); // $1.00
  const [dailyBudget, setDailyBudget] = useState('5000000'); // $5.00
  const [monthlyBudget, setMonthlyBudget] = useState('25000000'); // $25.00

  // Revealed Key modal state (shown ONCE)
  const [revealedKey, setRevealedKey] = useState<{ name: string; apiKey: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [generatingKeyAgentId, setGeneratingKeyAgentId] = useState<string | null>(null);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const data = await api.getAgents();
      setAgents(data);
    } catch (err) {
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAgent({
        name,
        description,
        maxBudgetMicroUsd: maxBudget,
        dailyBudgetMicroUsd: dailyBudget,
        monthlyBudgetMicroUsd: monthlyBudget,
      });
      setCreateModalOpen(false);
      setName('');
      setDescription('');
      fetchAgents();
    } catch (err: any) {
      alert(err?.message || 'Failed to create agent');
    }
  };

  const handleGenerateCredential = async (agent: Agent) => {
    setGeneratingKeyAgentId(agent.id);
    try {
      const cred = await api.createAgentCredential(agent.id, `${agent.name} Primary Key`);
      setRevealedKey({ name: cred.name, apiKey: cred.apiKey });
      fetchAgents();
    } catch (err: any) {
      alert(err?.message || 'Failed to generate credential');
    } finally {
      setGeneratingKeyAgentId(null);
    }
  };

  const handleRevokeCredential = async (agentId: string, credentialId: string) => {
    if (!confirm('Are you sure you want to revoke this agent credential? Any active workflows using it will immediately be rejected.')) return;
    try {
      await api.revokeAgentCredential(agentId, credentialId);
      fetchAgents();
    } catch (err: any) {
      alert(err?.message || 'Failed to revoke credential');
    }
  };

  const handleCopyKey = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const mcpConfigJson = JSON.stringify(
    {
      mcpServers: {
        tooltoll: {
          command: "node",
          args: ["/path/to/ToolToll/backend/dist/mcp/stdio.js"],
          env: {
            TOOLTOLL_AGENT_KEY: revealedKey?.apiKey || "tt_live_your_agent_key_here",
          },
        },
      },
    },
    null,
    2
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <div className="badge badge-cyan" style={{ marginBottom: '8px' }}>
            <Bot size={13} />
            Identity & Governance
          </div>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>Autonomous Agent Registry</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '750px' }}>
            Create isolated agent identities, assign granular spending budgets, generate high-entropy credentials, and connect your agents to Claude Desktop or Cursor via the Model Context Protocol (MCP).
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
          <Plus size={16} />
          Create New Agent
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '24px',
        }}
      >
        <button
          className="btn btn-sm"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'agents' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            color: activeTab === 'agents' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            borderRadius: 0,
            paddingBottom: '10px',
          }}
          onClick={() => setActiveTab('agents')}
        >
          <Bot size={15} />
          Registered Agents ({agents.length})
        </button>

        <button
          className="btn btn-sm"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'mcp' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            color: activeTab === 'mcp' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            borderRadius: 0,
            paddingBottom: '10px',
          }}
          onClick={() => setActiveTab('mcp')}
        >
          <Code2 size={15} />
          Model Context Protocol (MCP) Setup
        </button>
      </div>

      {activeTab === 'agents' ? (
        loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            Loading registered agents...
          </div>
        ) : agents.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '50px 20px' }}>
            <Bot size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <h3>No agents registered yet</h3>
            <p style={{ marginTop: '6px', marginBottom: '20px' }}>
              Create your first autonomous agent identity to begin executing paid marketplace tools.
            </p>
            <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
              <Plus size={16} />
              Create First Agent
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {agents.map((agent) => (
              <div key={agent.id} className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <h3 style={{ fontSize: '1.25rem' }}>{agent.name}</h3>
                      <span className="badge badge-emerald">{agent.status}</span>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      {agent.description || 'General-purpose autonomous agent with marketplace execution permissions.'}
                    </p>
                  </div>

                  <button
                    className="btn btn-outline-cyan btn-sm"
                    disabled={generatingKeyAgentId === agent.id}
                    onClick={() => handleGenerateCredential(agent)}
                  >
                    <Key size={14} />
                    {generatingKeyAgentId === agent.id ? 'Generating...' : 'Issue New Key'}
                  </button>
                </div>

                {/* Budget Limit Badges */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PER-CALL LIMIT</div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan-light)' }}>
                      {formatMicroUsd(agent.maxBudgetMicroUsd)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DAILY BUDGET CAP</div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {formatMicroUsd(agent.dailyBudgetMicroUsd)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MONTHLY BUDGET CAP</div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {formatMicroUsd(agent.monthlyBudgetMicroUsd)}
                    </div>
                  </div>
                </div>

                {/* Credentials List */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Active Credentials & API Keys ({agent.credentials?.length || 0})
                  </div>

                  {agent.credentials && agent.credentials.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {agent.credentials.map((cred) => (
                        <div
                          key={cred.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Key size={14} color="var(--accent-cyan)" />
                            <span style={{ fontWeight: 600 }}>{cred.name}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              Prefix: {cred.prefix}••••••••
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Issued: {formatDate(cred.createdAt)}
                            </span>
                            <button
                              className="btn btn-danger btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                              onClick={() => handleRevokeCredential(agent.id, cred.id)}
                            >
                              <Trash2 size={12} />
                              Revoke
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No active credentials. Click "Issue New Key" above to generate a high-entropy key for this agent.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* MCP Setup Guide Tab */
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Code2 size={22} color="var(--accent-cyan)" />
            Model Context Protocol (MCP) Integration
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            The ToolToll MCP Server gives autonomous LLM clients like Claude Desktop, Cursor, and Windsurf native tool access to search tools, check prices, inspect wallet balances, and execute paid tools.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(6, 182, 212, 0.05)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-cyan-light)', marginBottom: '6px' }}>
                Claude Desktop Configuration File:
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Add this block to your <code>claude_desktop_config.json</code>:
              </div>
              <pre
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-sm)',
                  background: '#040711',
                  color: '#38bdf8',
                  fontSize: '0.85rem',
                  overflowX: 'auto',
                }}
              >
                {mcpConfigJson}
              </pre>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: '0.92rem', marginBottom: '8px' }}>Transport 1: Local STDIO</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Launch local sub-process reading agent key securely from environment variable:
                </p>
                <code style={{ display: 'block', marginTop: '8px', padding: '6px 10px', background: '#000', borderRadius: '4px', fontSize: '0.78rem' }}>
                  npm run mcp:stdio
                </code>
              </div>

              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: '0.92rem', marginBottom: '8px' }}>Transport 2: Streamable HTTP (SSE)</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Connect over SSE port 4001 with Bearer token authentication:
                </p>
                <code style={{ display: 'block', marginTop: '8px', padding: '6px 10px', background: '#000', borderRadius: '4px', fontSize: '0.78rem' }}>
                  http://localhost:4001/sse (Authorization: Bearer [KEY])
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Agent Modal */}
      {createModalOpen && (
        <div className="modal-overlay" onClick={() => setCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem' }}>Register New Agent Identity</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateAgent}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Agent Name</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Translation & Verification Agent"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Purpose</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what tasks this agent autonomously undertakes..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Max Cost Per Tool Call (µUSD)</label>
                  <input
                    type="number"
                    required
                    className="form-input"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {formatMicroUsd(maxBudget)} limit per invocation
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Daily Budget Limit (µUSD)</label>
                  <input
                    type="number"
                    required
                    className="form-input"
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(e.target.value)}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {formatMicroUsd(dailyBudget)} limit per 24-hour cycle
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revealed Key Modal (Shown ONCE) */}
      {revealedKey && (
        <div className="modal-overlay" onClick={() => setRevealedKey(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="var(--accent-amber)" />
                <h3 style={{ fontSize: '1.15rem' }}>Agent Key Issued — Copy Now</h3>
              </div>
              <button
                onClick={() => setRevealedKey(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#fbbf24',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '16px',
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Security Guarantee:</strong> This raw secret key will <strong>NEVER</strong> be shown again. It is hashed with high-entropy salt before storing in PostgreSQL. Copy it now and save it in your environment or secrets vault.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{revealedKey.name} Plaintext Secret:</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', background: '#02040a', color: '#38bdf8' }}
                    value={revealedKey.apiKey}
                  />
                  <button className="btn btn-primary" onClick={handleCopyKey}>
                    {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                    {copiedKey ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setRevealedKey(null)}>
                I have securely saved this key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
