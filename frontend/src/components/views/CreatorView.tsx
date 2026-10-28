import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { formatMicroUsd } from '../../utils/formatters';
import { Tool } from '../../types';
import {
  Hammer,
  Plus,
  DollarSign,
  Send,
  CheckCircle,
  X,
  Zap,
  Layers,
  ArrowUpRight,
} from 'lucide-react';

export const CreatorView: React.FC = () => {
  const { user, loginDemo } = useAuth();
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
  const [baseUrl, setBaseUrl] = useState('https://api.yourdomain.com');
  const [endpointPath, setEndpointPath] = useState('/v1/analyze');
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
        api.getTools(user?.id ? { creatorId: user.id } : {}).catch(() => []),
      ]);
      if (earningsData) setEarnings(earningsData);
      setMyTools(toolsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const handleRegisterTool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!user) {
        await loginDemo('creator');
      }
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
      await api.runToolTest(tool.id, { text: 'Verification test call' });
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
      if (!user) {
        await loginDemo('creator');
      }
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
            <span className="section-kicker">Developer Monetization Gateway</span>
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
              Creator Studio & Earnings.
            </h1>
            <p style={{ color: 'var(--text-dark-secondary)', maxWidth: '720px', fontSize: '1.02rem', lineHeight: 1.6 }}>
              Register your upstream endpoints, define custom input schemas, set per-call micro-USD pricing, and collect verified machine execution payouts.
            </p>
          </div>

          <button className="btn btn-primary btn-lg" onClick={() => setRegisterModalOpen(true)}>
            <Plus size={16} />
            Register New API
          </button>
        </div>

        {/* Revenue Metric Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            marginBottom: '36px',
          }}
        >
          <div className="card-dark" style={{ padding: '24px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Gross Volume Incurred
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-mono)', margin: '6px 0' }}>
              {formatMicroUsd(earnings?.grossEarningsMicroUsd || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dark-muted)' }}>All-time execution billing</div>
          </div>

          <div className="card-dark" style={{ padding: '24px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Platform Commission (10%)
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--status-amber)', fontFamily: 'var(--font-mono)', margin: '6px 0' }}>
              {formatMicroUsd(earnings?.platformFeeMicroUsd || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dark-muted)' }}>1,000 basis points platform fee</div>
          </div>

          <div className="card-dark" style={{ padding: '24px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Net Creator Revenue
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34D399', fontFamily: 'var(--font-mono)', margin: '6px 0' }}>
              {formatMicroUsd(earnings?.netEarningsMicroUsd || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dark-muted)' }}>Net credited to creator ledger</div>
          </div>

          <div className="card-dark highlight-orange" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Available For Withdrawal
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)', margin: '6px 0' }}>
                {formatMicroUsd(earnings?.availablePayoutMicroUsd || 0)}
              </div>
            </div>
            <button
              className="btn btn-outline-orange btn-sm"
              style={{ width: '100%', marginTop: '10px' }}
              onClick={() => setPayoutModalOpen(true)}
            >
              <DollarSign size={14} />
              Request Payout
            </button>
          </div>
        </div>

        {/* Registered Tools Table */}
        <div className="card-dark" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF' }}>
                Registered API Endpoints ({myTools.length})
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dark-secondary)' }}>
                Lifecycle states and price per call settings
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setRegisterModalOpen(true)}>
              <Plus size={14} /> Add Endpoint
            </button>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>API Service Name</th>
                  <th>Category</th>
                  <th>Unit Rate</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myTools.map((tool) => (
                  <tr key={tool.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{tool.name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)' }}>
                        {tool.slug}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-dark-neutral">{tool.category}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFFFFF' }}>
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
                            : 'badge-dark-neutral'
                        }`}
                      >
                        {tool.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {tool.status === 'DRAFT' || tool.status === 'TESTING' ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleTestAndSubmit(tool)}
                        >
                          <Send size={13} />
                          Test & Submit
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dark-muted)' }}>
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
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Register New Monetized API
                </h3>
                <button
                  onClick={() => setRegisterModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer' }}
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
                    <label className="form-label">API Description</label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the capabilities, input formats, and accuracy..."
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
                      <label className="form-label">HTTP Method</label>
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
                        placeholder="/v1/execute"
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
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-dark-muted)' }}>
                        Equates to {formatMicroUsd(priceMicroUsd)} USD
                      </span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Input JSON Schema (Draft 7)</label>
                    <textarea
                      className="form-textarea"
                      rows={4}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
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
                    Register Endpoint Draft
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payout Modal */}
        {payoutModalOpen && (
          <div className="modal-overlay" onClick={() => setPayoutModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>Withdraw Creator Earnings</h3>
                <button
                  onClick={() => setPayoutModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleRequestPayout}>
                <div className="modal-body">
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dark-muted)' }}>Available to withdraw:</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34D399', fontFamily: 'var(--font-mono)' }}>
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
                    <div style={{ padding: '12px 16px', background: 'var(--status-emerald-bg)', border: '1px solid var(--status-emerald-border)', color: '#34D399', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
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
    </div>
  );
};
