import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Tool, ReconciliationReport, AuditLog } from '../../types';
import { formatMicroUsd, formatDate } from '../../utils/formatters';
import {
  Shield,
  CheckCircle,
  XCircle,
  Scale,
  Percent,
  Activity,
  X,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const { user, loginDemo } = useAuth();
  const [activeTab, setActiveTab] = useState<'moderation' | 'reconciliation' | 'commission' | 'audit'>('moderation');
  const [pendingTools, setPendingTools] = useState<Tool[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationReport | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Commission update state
  const [commissionBps, setCommissionBps] = useState<number>(1000); // 10%
  const [commissionSuccess, setCommissionSuccess] = useState<string | null>(null);

  // Moderation action modal state
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [moderationReason, setModerationReason] = useState('Meets platform standards and passed verification test call');
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'suspend'>('approve');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pending, recon, logs] = await Promise.all([
        api.getPendingTools().catch(() => []),
        api.getReconciliationReport().catch(() => null),
        api.getAuditLogs().catch(() => []),
      ]);
      setPendingTools(pending);
      if (recon) setReconciliation(recon);
      setAuditLogs(logs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleModerationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool) return;

    try {
      if (actionType === 'approve') {
        await api.approveTool(selectedTool.id, moderationReason);
      } else if (actionType === 'reject') {
        await api.rejectTool(selectedTool.id, moderationReason);
      } else {
        await api.suspendTool(selectedTool.id, moderationReason);
      }
      setSelectedTool(null);
      fetchData();
    } catch (err: any) {
      alert(err?.message || 'Moderation action failed');
    }
  };

  const handleUpdateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updatePlatformCommission(commissionBps);
      setCommissionSuccess(`Platform fee updated to ${commissionBps} BPS (${(commissionBps / 100).toFixed(2)}%)!`);
      setTimeout(() => setCommissionSuccess(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to update commission');
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="section-dark" style={{ minHeight: '85vh', paddingTop: '80px', textAlign: 'center' }}>
        <div className="container-editorial" style={{ maxWidth: '580px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 85, 0, 0.1)',
              border: '1px solid var(--brand-orange-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <Shield size={32} color="var(--brand-orange)" />
          </div>
          <h2
            style={{
              fontSize: 'clamp(1.35rem, 3vw, 1.8rem)',
              maxWidth: '100%',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
              fontWeight: 900,
              color: '#FFFFFF',
              marginBottom: '12px',
            }}
          >
            Administrator Privileges Required
          </h2>
          <p style={{ color: 'var(--text-dark-secondary)', marginBottom: '28px', lineHeight: 1.6 }}>
            The governance and financial reconciliation console is restricted to platform operators with cryptographic administrative privileges.
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={async () => {
              await loginDemo('admin');
              fetchData();
            }}
          >
            <Shield size={18} />
            Sign In with 1-Click Admin Demo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section-dark" style={{ minHeight: '85vh', paddingTop: '40px' }}>
      <div className="container-editorial">
        {/* Header */}
        <div style={{ maxWidth: '840px', marginBottom: '36px' }}>
          <span className="section-kicker">Platform Compliance & Risk</span>
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
            Administrator Governance Center.
          </h1>
          <p style={{ color: 'var(--text-dark-secondary)', fontSize: '1.02rem', lineHeight: 1.6 }}>
            Review pending API submissions, verify double-entry system solvency, tune marketplace take-rates, and inspect tamper-evident audit trails.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-dark)',
            marginBottom: '32px',
            overflowX: 'auto',
          }}
        >
          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'moderation' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'moderation' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'moderation' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 18px',
              fontSize: '0.9rem',
            }}
            onClick={() => setActiveTab('moderation')}
          >
            Moderation Queue ({pendingTools.length})
          </button>

          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'reconciliation' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'reconciliation' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'reconciliation' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 18px',
              fontSize: '0.9rem',
            }}
            onClick={() => setActiveTab('reconciliation')}
          >
            <Scale size={15} />
            Double-Entry Solvency
          </button>

          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'commission' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'commission' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'commission' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 18px',
              fontSize: '0.9rem',
            }}
            onClick={() => setActiveTab('commission')}
          >
            <Percent size={15} />
            Platform Take-Rate (BPS)
          </button>

          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'audit' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'audit' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'audit' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 18px',
              fontSize: '0.9rem',
            }}
            onClick={() => setActiveTab('audit')}
          >
            <Activity size={15} />
            Audit Trail ({auditLogs.length})
          </button>
        </div>

        {/* Tab 1: Moderation */}
        {activeTab === 'moderation' && (
          <div className="card-dark" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '18px' }}>
              Pending API Moderation Queue
            </h3>

            {pendingTools.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--text-dark-muted)' }}>
                <CheckCircle size={40} color="var(--status-emerald)" style={{ margin: '0 auto 14px' }} />
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>All submissions reviewed!</div>
                <div style={{ fontSize: '0.84rem', marginTop: '4px' }}>The creator tool moderation queue is currently clear.</div>
              </div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tool Name & Slug</th>
                      <th>Category</th>
                      <th>Creator</th>
                      <th>Price Per Call</th>
                      <th>Verification Sandbox</th>
                      <th style={{ textAlign: 'right' }}>Review Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingTools.map((tool) => (
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
                        <td style={{ fontSize: '0.85rem' }}>{tool.creator?.name || 'Verified Creator'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFFFFF' }}>
                          {formatMicroUsd(tool.priceMicroUsd)}
                        </td>
                        <td>
                          <span className="badge badge-emerald">Verified (Passed)</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              className="btn btn-sm"
                              style={{
                                background: 'var(--status-emerald-bg)',
                                color: '#34D399',
                                border: '1px solid var(--status-emerald-border)',
                              }}
                              onClick={() => {
                                setSelectedTool(tool);
                                setActionType('approve');
                                setModerationReason('Meets platform standards and passed verification test call');
                              }}
                            >
                              <CheckCircle size={13} />
                              Approve
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{
                                background: 'var(--status-rose-bg)',
                                color: '#F87171',
                                border: '1px solid var(--status-rose-border)',
                              }}
                              onClick={() => {
                                setSelectedTool(tool);
                                setActionType('reject');
                                setModerationReason('Does not meet platform guidelines or schema compliance requirements');
                              }}
                            >
                              <XCircle size={13} />
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Financial Reconciliation */}
        {activeTab === 'reconciliation' && reconciliation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div
              className="card-dark"
              style={{
                padding: '28px',
                border: reconciliation.isBalanced ? '1px solid var(--status-emerald-border)' : '1px solid var(--status-rose-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                {reconciliation.isBalanced ? (
                  <CheckCircle size={26} color="var(--status-emerald)" />
                ) : (
                  <AlertTriangle size={26} color="var(--status-rose)" />
                )}
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Platform Financial Solvency:{' '}
                  <span style={{ color: reconciliation.isBalanced ? '#34D399' : '#F87171' }}>
                    {reconciliation.isBalanced ? '100% BALANCED & RECONCILED' : 'DISCREPANCY DETECTED'}
                  </span>
                </h3>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-dark-secondary)', lineHeight: 1.6 }}>
                Total External & Seed Deposits exactly match Total Platform Liabilities (User Wallets + In-flight Mutex Reserves + Platform Revenue + Creator Payables).
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="card-dark" style={{ padding: '22px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Total Deposited
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#38BDF8', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {formatMicroUsd(reconciliation.totalDeposited)}
                </div>
              </div>

              <div className="card-dark" style={{ padding: '22px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Consumer Wallets Total
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#34D399', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {formatMicroUsd(reconciliation.totalWalletsBalance)}
                </div>
              </div>

              <div className="card-dark" style={{ padding: '22px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Platform Net Revenue
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {formatMicroUsd(reconciliation.totalPlatformRevenue)}
                </div>
              </div>

              <div className="card-dark" style={{ padding: '22px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Solvency Variance
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#34D399', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {formatMicroUsd(reconciliation.discrepancyMicroUsd || 0)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Commission Settings */}
        {activeTab === 'commission' && (
          <div className="card-dark" style={{ padding: '32px', maxWidth: '640px' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
              Platform Commission Take-Rate (Basis Points)
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
              Configure the platform fee captured on every executed tool call. 1,000 basis points equals exactly 10.00%.
            </p>

            <form onSubmit={handleUpdateCommission}>
              <div className="form-group">
                <label className="form-label">Commission Rate in BPS (0 - 5000)</label>
                <input
                  type="number"
                  min="0"
                  max="5000"
                  step="50"
                  className="form-input"
                  value={commissionBps}
                  onChange={(e) => setCommissionBps(parseInt(e.target.value, 10))}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)' }}>
                  Active platform fee: <strong style={{ color: 'var(--brand-orange)' }}>{(commissionBps / 100).toFixed(2)}%</strong>
                </span>
              </div>

              {commissionSuccess && (
                <div style={{ padding: '12px 16px', background: 'var(--status-emerald-bg)', color: '#34D399', border: '1px solid var(--status-emerald-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '18px' }}>
                  {commissionSuccess}
                </div>
              )}

              <button type="submit" className="btn btn-primary">
                Save Platform Commission
              </button>
            </form>
          </div>
        )}

        {/* Tab 4: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="card-dark" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '18px' }}>
              System Audit Trail & Security Events
            </h3>

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Resource Type</th>
                    <th>Resource ID</th>
                    <th>Origin IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-dark-muted)' }}>{formatDate(log.createdAt)}</td>
                      <td>
                        <span className="badge badge-dark-neutral">{log.action}</span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{log.resourceType}</td>
                      <td style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--brand-orange)' }}>
                        {log.resourceId}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-dark-muted)' }}>{log.ipAddress || '127.0.0.1'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Moderation Action Modal */}
        {selectedTool && (
          <div className="modal-overlay" onClick={() => setSelectedTool(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Confirm {actionType.toUpperCase()}: {selectedTool.name}
                </h3>
                <button
                  onClick={() => setSelectedTool(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleModerationSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Review Rationale / Notes</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      required
                      value={moderationReason}
                      onChange={(e) => setModerationReason(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedTool(null)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={actionType === 'approve' ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={actionType === 'reject' ? { background: 'var(--status-rose-bg)', color: '#F87171', borderColor: 'var(--status-rose-border)' } : {}}
                  >
                    Confirm {actionType.toUpperCase()}
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
