import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { formatMicroUsd } from '../../utils/formatters';
import { Tool } from '../../types';
import {
  Hammer,
  Plus,
  DollarSign,
  TrendingUp,
  Shield,
  Layers,
  Send,
  Play,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';

export const CreatorView: React.FC = () => {
  const [earnings, setEarnings] = useState<{
    grossEarningsMicroUsd: string;
    platformFeeMicroUsd: string;
    netEarningsMicroUsd: string;
    withdrawnMicroUsd: string;
    pendingPayoutMicroUsd: string;
    availablePayoutMicroUsd: string;
  } | null>(null);

  const [myTools, setMyTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Register Tool modal state
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [toolName, setToolName] = useState('');
  const [toolSlug, setToolSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('NLP');
  const [baseUrl, setBaseUrl] = useState('http://localhost:4000');
  const [endpointPath, setEndpointPath] = useState('/api/demo/sentiment');
  const [httpMethod, setHttpMethod] = useState('POST');
  const [priceMicroUsd, setPriceMicroUsd] = useState('5000'); // $0.005
  const [inputSchemaStr, setInputSchemaStr] = useState('{\n  "type": "object",\n  "properties": {\n    "text": { "type": "string" }\n  },\n  "required": ["text"]\n}');
  const [authType, setAuthType] = useState('NONE');
  const [secretKey, setSecretKey] = useState('');

  // Payout modal state
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutEmail, setPayoutEmail] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [earningsData, toolsData] = await Promise.all([
        api.getCreatorEarnings().catch(() => null),
        api.getTools().catch(() => []),
      ]);
      if (earningsData) setEarnings(earningsData);
      setMyTools(toolsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRegisterTool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let inputSchema = {};
      try {
        inputSchema = JSON.parse(inputSchemaStr);
      } catch {
        alert('Input Schema must be valid JSON');
        return;
      }

      await api.createTool({
        name: toolName,
        slug: toolSlug || toolName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        description,
        category,
        tags: [category.toLowerCase(), 'api'],
        baseUrl,
        endpointPath,
        httpMethod,
        priceMicroUsd,
        timeoutMs: 15000,
        rateLimitRpm: 60,
        inputSchema,
        authConfig: {
          type: authType,
          headerName: authType === 'HEADER_KEY' ? 'X-API-Key' : undefined,
          secret: secretKey || undefined,
        },
      });

      setRegisterModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err?.message || 'Tool registration failed');
    }
  };

  const handleTestAndSubmit = async (tool: Tool) => {
    try {
      // 1. Run verification test call
      await api.runToolTest(tool.id, { text: 'Verification test call' });
      // 2. Submit for admin review
      await api.submitToolForReview(tool.id);
      alert(`Tool "${tool.name}" submitted for admin review!`);
      fetchData();
    } catch (err: any) {
      alert(`Submission failed: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!earnings?.availablePayoutMicroUsd) return;
    try {
      await api.requestPayout(earnings.availablePayoutMicroUsd, payoutEmail);
      setPayoutSuccess('Simulated payout request processed and ledger updated!');
      setTimeout(() => {
        setPayoutModalOpen(false);
        setPayoutSuccess(null);
        fetchData();
      }, 1500);
    } catch (err: any) {
      alert(err?.message || 'Payout request failed');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <div className="badge badge-amber" style={{ marginBottom: '8px' }}>
            <Hammer size={13} />
            Monetization & API Studio
          </div>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>Creator Studio</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '750px' }}>
            Register your high-performance APIs, configure integer micro-USD pricing, run automated verification test-calls, and withdraw earnings. Upstream secrets are encrypted at rest with AES-256-GCM.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setRegisterModalOpen(true)}>
          <Plus size={16} />
          Register New API Tool
        </button>
      </div>

      {/* Earnings Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gross Earnings</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
            {formatMicroUsd(earnings?.grossEarningsMicroUsd || 0)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>All-time execution billing</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Platform Fee (10%)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
            {formatMicroUsd(earnings?.platformFeeMicroUsd || 0)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>1,000 basis points snapshotted</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Creator Earnings</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
            {formatMicroUsd(earnings?.netEarningsMicroUsd || 0)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Creator net payable balance</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Available Payout</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-cyan-light)', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
              {formatMicroUsd(earnings?.availablePayoutMicroUsd || 0)}
            </div>
          </div>
          <button
            className="btn btn-outline-cyan btn-sm"
            style={{ width: '100%', marginTop: '8px' }}
            onClick={() => setPayoutModalOpen(true)}
          >
            <DollarSign size={14} />
            Request Payout
          </button>
        </div>
      </div>

      {/* Creator's Tools Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Registered API Tools & Lifecycle</h3>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tool Name & Slug</th>
                <th>Category</th>
                <th>Price Per Call</th>
                <th>Version</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {myTools.map((tool) => (
                <tr key={tool.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{tool.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {tool.slug}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-cyan">{tool.category}</span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                    {formatMicroUsd(tool.priceMicroUsd)}
                  </td>
                  <td>v{tool.version}</td>
                  <td>
                    <span
                      className={`badge ${
                        tool.status === 'APPROVED'
                          ? 'badge-emerald'
                          : tool.status === 'PENDING_REVIEW'
                          ? 'badge-amber'
                          : 'badge-gray'
                      }`}
                    >
                      {tool.status}
                    </span>
                  </td>
                  <td>
                    {tool.status === 'DRAFT' || tool.status === 'TESTING' ? (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleTestAndSubmit(tool)}
                      >
                        <Send size={13} />
                        Test & Submit
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Live in marketplace
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Tool Modal */}
      {registerModalOpen && (
        <div className="modal-overlay" onClick={() => setRegisterModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem' }}>Register New API on ToolToll</h3>
              <button
                onClick={() => setRegisterModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRegisterTool}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">API Name</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={toolName}
                      onChange={(e) => setToolName(e.target.value)}
                      placeholder="e.g. Real-Time Translation API"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="NLP">NLP</option>
                      <option value="Translation">Translation</option>
                      <option value="Security">Security</option>
                      <option value="Data">Data</option>
                      <option value="Utility">Utility</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Clear description of what this API provides and returns..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Base URL</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://api.yourdomain.com"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Method</label>
                    <select
                      className="form-select"
                      value={httpMethod}
                      onChange={(e) => setHttpMethod(e.target.value)}
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Endpoint Path</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={endpointPath}
                      onChange={(e) => setEndpointPath(e.target.value)}
                      placeholder="/v1/translate"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price Per Call (µUSD)</label>
                    <input
                      type="number"
                      required
                      className="form-input"
                      value={priceMicroUsd}
                      onChange={(e) => setPriceMicroUsd(e.target.value)}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Equals {formatMicroUsd(priceMicroUsd)} USD
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Input JSON Schema</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                    value={inputSchemaStr}
                    onChange={(e) => setInputSchemaStr(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRegisterModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register Tool Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {payoutModalOpen && (
        <div className="modal-overlay" onClick={() => setPayoutModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem' }}>Withdraw Creator Earnings</h3>
              <button
                onClick={() => setPayoutModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRequestPayout}>
              <div className="modal-body">
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Available to withdraw:</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                    {formatMicroUsd(earnings?.availablePayoutMicroUsd || 0)}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">PayPal Email for Transfer</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={payoutEmail}
                    onChange={(e) => setPayoutEmail(e.target.value)}
                    placeholder="creator-paypal@example.com"
                  />
                </div>

                {payoutSuccess && (
                  <div style={{ padding: '10px', background: 'rgba(16,185,129,0.1)', color: '#34d399', borderRadius: '4px', fontSize: '0.85rem' }}>
                    {payoutSuccess}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPayoutModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Simulated Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
