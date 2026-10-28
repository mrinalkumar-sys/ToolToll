import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Agent } from '../../types';
import { api } from '../../services/api';
import { formatMicroUsd, formatDate } from '../../utils/formatters';
import {
  Bot,
  Plus,
  Key,
  Copy,
  Check,
  Code2,
  Trash2,
  AlertTriangle,
  X,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';

export const AgentManagementView: React.FC = () => {
  const { isAuthenticated, loginDemo } = useAuth();
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
      if (!isAuthenticated) {
        await loginDemo('consumer');
      }
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
      if (!isAuthenticated) {
        await loginDemo('consumer');
      }
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
    <div className="section-dark" style={{ minHeight: '85vh', paddingTop: '40px' }}>
      <div className="container-editorial">
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '24px',
            marginBottom: '36px',
          }}
        >
          <div>
            <span className="section-kicker">Autonomous Agent Governance</span>
            <h1
              style={{
                fontSize: 'clamp(1.5rem, 3.8vw, 3.2rem)',
                maxWidth: '100%',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                fontWeight: 900,
                letterSpacing: '-0.035em',
                color: '#FFFFFF',
                marginBottom: '12px',
              }}
            >
              Agent Management & Keys.
            </h1>
            <p style={{ color: 'var(--text-dark-secondary)', maxWidth: '720px', fontSize: '1.02rem', lineHeight: 1.6 }}>
              Issue cryptographically isolated agent identities, assign granular spending boundaries, and connect directly to Claude Desktop or Cursor over Model Context Protocol (MCP).
            </p>
          </div>

          <button className="btn btn-primary btn-lg" onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} />
            Register New Agent
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-dark)',
            marginBottom: '32px',
          }}
        >
          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'agents' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'agents' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'agents' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 18px',
              fontSize: '0.9rem',
            }}
            onClick={() => setActiveTab('agents')}
          >
            <Bot size={16} />
            Registered Agents ({agents.length})
          </button>

          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'mcp' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'mcp' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'mcp' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 18px',
              fontSize: '0.9rem',
            }}
            onClick={() => setActiveTab('mcp')}
          >
            <Code2 size={16} />
            Model Context Protocol (MCP) Setup
          </button>
        </div>

        {activeTab === 'agents' ? (
          loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dark-muted)' }}>
              Loading registered agent fleet...
            </div>
          ) : agents.length === 0 ? (
            <div className="card-dark" style={{ textAlign: 'center', padding: '64px 24px' }}>
              <Bot size={44} style={{ color: 'var(--text-dark-muted)', margin: '0 auto 16px' }} />
              <h3 style={{ color: '#FFFFFF', marginBottom: '8px' }}>No agents registered yet</h3>
              <p style={{ color: 'var(--text-dark-secondary)', marginBottom: '24px' }}>
                Create your first agent identity to configure budget limits and issue MCP keys.
              </p>
              <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
                <Plus size={16} />
                Register First Agent
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {agents.map((agent) => (
                <div key={agent.id} className="card-dark highlight-orange" style={{ padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF' }}>{agent.name}</h3>
                        <span className="badge badge-emerald">{agent.status}</span>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-dark-secondary)', maxWidth: '680px' }}>
                        {agent.description || 'Autonomous agent configured with marketplace execution permissions.'}
                      </p>
                    </div>

                    <button
                      className="btn btn-outline-orange btn-sm"
                      disabled={generatingKeyAgentId === agent.id}
                      onClick={() => handleGenerateCredential(agent)}
                    >
                      <Key size={14} />
                      {generatingKeyAgentId === agent.id ? 'Generating 256-Bit Key...' : 'Issue New API Key'}
                    </button>
                  </div>

                  {/* Budget Limit Row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '14px',
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-dark)',
                      marginBottom: '20px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        PER-CALL LIMIT
                      </div>
                      <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontSize: '1.1rem', marginTop: '2px' }}>
                        {formatMicroUsd(agent.maxBudgetMicroUsd)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        DAILY BUDGET CAP
                      </div>
                      <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontSize: '1.1rem', marginTop: '2px' }}>
                        {formatMicroUsd(agent.dailyBudgetMicroUsd)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        MONTHLY BUDGET CAP
                      </div>
                      <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontSize: '1.1rem', marginTop: '2px' }}>
                        {formatMicroUsd(agent.monthlyBudgetMicroUsd)}
                      </div>
                    </div>
                  </div>

                  {/* Credentials Section */}
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-dark-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Active Credentials ({agent.credentials?.length || 0})
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
                              padding: '10px 16px',
                              borderRadius: 'var(--radius-xs)',
                              background: 'rgba(0, 0, 0, 0.35)',
                              border: '1px solid var(--border-dark)',
                              fontSize: '0.84rem',
                              flexWrap: 'wrap',
                              gap: '10px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <Key size={14} color="var(--brand-orange)" />
                              <span style={{ fontWeight: 700, color: '#FFFFFF' }}>{cred.name}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dark-muted)', fontSize: '0.78rem' }}>
                                Prefix: {cred.prefix}••••••••
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-dark-muted)' }}>
                                Created: {formatDate(cred.createdAt)}
                              </span>
                              <button
                                className="btn btn-sm"
                                style={{
                                  background: 'var(--status-rose-bg)',
                                  color: '#F87171',
                                  borderColor: 'var(--status-rose-border)',
                                  padding: '4px 10px',
                                  fontSize: '0.74rem',
                                }}
                                onClick={() => handleRevokeCredential(agent.id, cred.id)}
                              >
                                <Trash2 size={13} />
                                Revoke
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-dark-muted)', fontStyle: 'italic' }}>
                        No active keys. Click "Issue New API Key" above to generate a 256-bit credential for this agent.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* MCP Setup Guide Tab */
          <div className="card-dark" style={{ padding: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <Code2 size={24} color="var(--brand-orange)" />
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FFFFFF' }}>
                Model Context Protocol (MCP) Integration
              </h2>
            </div>
            <p style={{ color: 'var(--text-dark-secondary)', marginBottom: '28px', maxWidth: '800px', lineHeight: 1.6 }}>
              The ToolToll MCP Server gives autonomous LLM clients like Claude Desktop, Cursor, and Windsurf direct tool access to discover tools, inspect prices, check balances, and execute paid tools.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div
                style={{
                  padding: '20px 24px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 85, 0, 0.04)',
                  border: '1px solid var(--brand-orange-border)',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#FFFFFF', marginBottom: '6px' }}>
                  Claude Desktop Configuration (claude_desktop_config.json):
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-dark-secondary)', marginBottom: '14px' }}>
                  Paste this snippet into your Claude Desktop configuration file:
                </div>
                <pre
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-xs)',
                    background: '#040508',
                    color: '#38BDF8',
                    fontSize: '0.85rem',
                    overflowX: 'auto',
                    border: '1px solid var(--border-dark)',
                  }}
                >
                  {mcpConfigJson}
                </pre>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '20px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-dark)' }}>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                    Transport 1: Local STDIO Subprocess
                  </h4>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-dark-secondary)', lineHeight: 1.5 }}>
                    Spawns a local node process communicating over standard input/output with zero exposed ports:
                  </p>
                  <code style={{ display: 'block', marginTop: '10px', padding: '8px 12px', background: '#000', borderRadius: '4px', fontSize: '0.8rem', color: '#34D399' }}>
                    npm run mcp:stdio
                  </code>
                </div>

                <div style={{ padding: '20px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-dark)' }}>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                    Transport 2: Streamable HTTP (SSE)
                  </h4>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-dark-secondary)', lineHeight: 1.5 }}>
                    Connect remote containerized agents over Server-Sent Events with Bearer header authentication:
                  </p>
                  <code style={{ display: 'block', marginTop: '10px', padding: '8px 12px', background: '#000', borderRadius: '4px', fontSize: '0.8rem', color: '#38BDF8' }}>
                    http://localhost:4001/sse (Authorization: Bearer KEY)
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Agent Modal */}
        {createModalOpen && (
          <div className="modal-overlay" onClick={() => setCreateModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>Register New Agent Identity</h3>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer' }}
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
                      placeholder="e.g. Production Triage Agent"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Agent Description / Scopes</label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what automated tasks this agent handles..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Max Budget Per Call (µUSD)</label>
                    <input
                      type="number"
                      required
                      className="form-input"
                      value={maxBudget}
                      onChange={(e) => setMaxBudget(e.target.value)}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-dark-muted)' }}>
                      Limit: {formatMicroUsd(maxBudget)} per tool invocation
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Daily Budget Cap (µUSD)</label>
                    <input
                      type="number"
                      required
                      className="form-input"
                      value={dailyBudget}
                      onChange={(e) => setDailyBudget(e.target.value)}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-dark-muted)' }}>
                      Limit: {formatMicroUsd(dailyBudget)} per 24 hours
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Monthly Budget Cap (µUSD)</label>
                    <input
                      type="number"
                      required
                      className="form-input"
                      value={monthlyBudget}
                      onChange={(e) => setMonthlyBudget(e.target.value)}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-dark-muted)' }}>
                      Limit: {formatMicroUsd(monthlyBudget)} per calendar month
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
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Key size={18} color="var(--brand-orange)" />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>Agent Key Issued — Copy Now</h3>
                </div>
                <button
                  onClick={() => setRevealedKey(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--status-amber-bg)',
                    border: '1px solid var(--status-amber-border)',
                    color: '#FBBF24',
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    marginBottom: '20px',
                    lineHeight: 1.5,
                  }}
                >
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Security Notice:</strong> This 256-bit API key will <strong>NEVER</strong> be displayed again. Only its hash and prefix are stored in PostgreSQL. Save it now in your environment variables or secrets store.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{revealedKey.name} Plaintext Key:</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      readOnly
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', background: '#020306', color: '#38BDF8' }}
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
    </div>
  );
};
