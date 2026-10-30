import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  History,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import { Modal } from '../components/Modal.jsx';

export const AdminPage = () => {
  const [stats, setStats] = useState(null);
  const [pendingTools, setPendingTools] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Review Modal
  const [reviewModal, setReviewModal] = useState({
    isOpen: false,
    tool: null,
    action: 'approve',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const [s, p, a] = await Promise.all([
        api.getAdminStats(),
        api.getPendingTools(),
        api.getAdminAuditLogs(20),
      ]);
      setStats(s);
      setPendingTools(p);
      setAuditLogs(a);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenReview = (tool, action) => {
    setReviewModal({
      isOpen: true,
      tool,
      action,
      reason:
        action === 'approve'
          ? 'Endpoint response verified; schema matches output parameters'
          : action === 'reject'
          ? 'Fails quality guidelines or incomplete description'
          : 'Suspended due to rate of failure or abuse reports',
    });
  };

  const handleConfirmReview = async () => {
    if (!reviewModal.tool) return;
    setSubmitting(true);
    try {
      await api.reviewTool(reviewModal.tool.id, reviewModal.action, reviewModal.reason);
      setReviewModal({ ...reviewModal, isOpen: false });
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-900">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            Platform Administration & Moderation
          </h1>
          <p className="text-xs text-slate-400">
            Audit logs, tool listing reviews, and financial reconciliation.
          </p>
        </div>
        <button
          onClick={loadAdminData}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Platform Health Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Total Registered Users</span>
          <div className="text-2xl font-bold text-white font-mono">{stats?.total_users || 0}</div>
          <span className="text-[10px] text-slate-500">
            {stats?.total_consumers} consumers, {stats?.total_creators} creators
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Marketplace Tools</span>
          <div className="text-2xl font-bold text-cyan-400 font-mono">{stats?.total_tools || 0}</div>
          <span className="text-[10px] text-amber-400 font-semibold">
            {stats?.pending_tools || 0} pending review
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Total Gross Volume</span>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            ${Number(stats?.gross_volume || 0).toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500">{stats?.total_calls || 0} tool calls</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Platform Fee Revenue (15%)</span>
          <div className="text-2xl font-bold text-indigo-400 font-mono">
            ${Number(stats?.platform_revenue || 0).toFixed(4)}
          </div>
          <span className="text-[10px] text-slate-500">Protocol commission collected</span>
        </div>
      </div>

      {/* Pending Listings Review Queue */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden space-y-4">
        <div className="p-6 pb-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-sm text-white">Pending Tool Submissions ({pendingTools.length})</h3>
          </div>
          <span className="text-xs text-slate-500">Manual inspection queue</span>
        </div>

        <div className="overflow-x-auto">
          {pendingTools.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No submissions currently waiting in the moderation queue.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Tool Name</th>
                  <th className="px-6 py-3">Endpoint URL</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Price</th>
                  <th className="px-6 py-3 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {pendingTools.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 font-semibold text-white">
                      <div>{t.name}</div>
                      <div className="text-[10px] text-slate-400">{t.short_desc}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                      {t.base_url}{t.endpoint_path}
                    </td>
                    <td className="px-6 py-4 capitalize text-slate-400">{t.category}</td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-400">
                      ${Number(t.price_per_call).toFixed(4)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenReview(t, 'approve')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition text-[11px] cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleOpenReview(t, 'reject')}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition text-[11px] cursor-pointer"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden space-y-4">
        <div className="p-6 pb-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-sm text-white">System Audit Log Trail</h3>
          </div>
          <span className="text-xs text-slate-500">Security & billing audit entries</span>
        </div>

        <div className="overflow-x-auto">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No audit logs recorded yet.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Entity Type</th>
                  <th className="px-6 py-3">Details</th>
                  <th className="px-6 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-3 font-semibold text-white">
                      <Badge variant="cyan" className="text-[10px]">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 capitalize text-slate-400">{log.entity_type}</td>
                    <td className="px-6 py-3 font-mono text-[10px] text-slate-400 max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                    <td className="px-6 py-3 text-slate-500">
                      {new Date(log.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Moderation Review Modal */}
      {reviewModal.tool && (
        <Modal
          isOpen={reviewModal.isOpen}
          onClose={() => setReviewModal({ ...reviewModal, isOpen: false })}
          title={`Moderation Action: ${reviewModal.action.toUpperCase()} (${reviewModal.tool.name})`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-400">
              Provide an audit log rationale for this moderation decision:
            </p>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Moderator Rationale / Reason:</label>
              <textarea
                rows={3}
                value={reviewModal.reason}
                onChange={(e) => setReviewModal({ ...reviewModal, reason: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleConfirmReview}
              disabled={submitting}
              className={`w-full py-2.5 rounded-xl font-bold text-white transition disabled:opacity-50 cursor-pointer ${
                reviewModal.action === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              {submitting ? 'Submitting Decision...' : `Confirm ${reviewModal.action.toUpperCase()}`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
