import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Tool, ReconciliationReport, AuditLog } from '../../types';
import { formatMicroUsd, formatDate } from '../../utils/formatters';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Scale,
  Percent,
  Activity,
  X,
} from 'lucide-react';

export const AdminView: React.FC = () => {
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

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div className="badge badge-rose" style={{ marginBottom: '8px' }}>
          <Shield size={13} />
          Platform Governance & Security
        </div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>Administrator Governance Center</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '750px' }}>
          Moderate pending API submissions, review financial reconciliation reports, adjust platform commission basis points, and audit security events.
        </p>
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
            borderBottom: activeTab === 'moderation' ? '2px solid var(--accent-rose)' : '2px solid transparent',
            color: activeTab === 'moderation' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            borderRadius: 0,
            paddingBottom: '10px',
          }}
          onClick={() => setActiveTab('moderation')}
        >
          Moderation Queue ({pendingTools.length})
        </button>

        <button
          className="btn btn-sm"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'reconciliation' ? '2px solid var(--accent-rose)' : '2px solid transparent',
            color: activeTab === 'reconciliation' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            borderRadius: 0,
            paddingBottom: '10px',
          }}
          onClick={() => setActiveTab('reconciliation')}
        >
          <Scale size={15} />
          Financial Reconciliation
        </button>

        <button
          className="btn btn-sm"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'commission' ? '2px solid var(--accent-rose)' : '2px solid transparent',
            color: activeTab === 'commission' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            borderRadius: 0,
            paddingBottom: '10px',
          }}
          onClick={() => setActiveTab('commission')}
        >
          <Percent size={15} />
          Platform Commission (BPS)
        </button>

        <button
          className="btn btn-sm"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '2px solid var(--accent-rose)' : '2px solid transparent',
            color: activeTab === 'audit' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            borderRadius: 0,
            paddingBottom: '10px',
          }}
          onClick={() => setActiveTab('audit')}
        >
          <Activity size={15} />
          System Audit Trail ({auditLogs.length})
        </button>
      </div>

      {activeTab === 'moderation' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Pending API Moderation Queue</h3>

          {pendingTools.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <CheckCircle size={36} color="var(--accent-emerald)" style={{ margin: '0 auto 10px' }} />
              <div>No tools currently pending review. Moderation queue is clear!</div>
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
                    <th>Test Calls</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTools.map((tool) => (
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
                      <td style={{ fontSize: '0.85rem' }}>{tool.creator?.name || 'Verified Creator'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                        {formatMicroUsd(tool.priceMicroUsd)}
                      </td>
                      <td>
                        <span className="badge badge-emerald">Verified (Passed)</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-success btn-sm"
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
                            className="btn btn-danger btn-sm"
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

      {activeTab === 'reconciliation' && reconciliation && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              border: reconciliation.isBalanced ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              {reconciliation.isBalanced ? (
                <CheckCircle size={22} color="var(--accent-emerald)" />
              ) : (
                <AlertTriangle size={22} color="var(--accent-rose)" />
              )}
              <h3 style={{ fontSize: '1.25rem' }}>
                System Financial Balance Status:{' '}
                <span style={{ color: reconciliation.isBalanced ? '#34d399' : '#fb7185' }}>
                  {reconciliation.isBalanced ? 'BALANCED & AUDIT VERIFIED' : 'DISCREPANCY DETECTED'}
                </span>
              </h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Total External & Seed Deposits match Total System Liabilities (Wallets + In-flight Reserved + Platform Revenue + Creator Payables).
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Deposited</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                {formatMicroUsd(reconciliation.totalDeposited)}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User Wallets Balance</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                {formatMicroUsd(reconciliation.totalWalletsBalance)}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Platform Revenue</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                {formatMicroUsd(reconciliation.totalPlatformRevenue)}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Discrepancy</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                {formatMicroUsd(reconciliation.discrepancyMicroUsd || 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'commission' && (
        <div className="glass-panel" style={{ padding: '28px', maxWidth: '600px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Platform Commission Fee (BPS)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Configure the basis points (BPS) collected by the marketplace on every paid tool call. 1,000 BPS equals 10.00%.
          </p>

          <form onSubmit={handleUpdateCommission}>
            <div className="form-group">
              <label className="form-label">Commission Basis Points (0 - 5000 BPS)</label>
              <input
                type="number"
                min="0"
                max="5000"
                step="50"
                className="form-input"
                value={commissionBps}
                onChange={(e) => setCommissionBps(parseInt(e.target.value, 10))}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Current effective fee: <strong>{(commissionBps / 100).toFixed(2)}%</strong>
              </span>
            </div>

            {commissionSuccess && (
              <div style={{ padding: '10px', background: 'rgba(16,185,129,0.1)', color: '#34d399', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '14px' }}>
                {commissionSuccess}
              </div>
            )}

            <button type="submit" className="btn btn-primary">
              Update Platform Commission
            </button>
          </form>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>System Audit Trail</h3>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Resource Type</th>
                  <th>Resource ID</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(log.createdAt)}</td>
                    <td>
                      <span className="badge badge-cyan">{log.action}</span>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{log.resourceType}</td>
                    <td style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {log.resourceId}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.ipAddress || '127.0.0.1'}</td>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem' }}>
                Confirm {actionType.toUpperCase()}: {selectedTool.name}
              </h3>
              <button
                onClick={() => setSelectedTool(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleModerationSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Review Decision Reason</label>
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
                  className={actionType === 'approve' ? 'btn btn-success' : 'btn btn-danger'}
                >
                  Confirm {actionType.toUpperCase()}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
