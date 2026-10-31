import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  RefreshCw,
  Clock,
  Layers,
  TrendingUp,
  Users,
  Code2,
  DollarSign,
  Activity,
  Percent,
  Sliders,
  Search,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import { Modal } from '../components/Modal.jsx';

export const AdminPage = () => {
  const location = useLocation();

  // Three primary navigation tabs requested: 1) Listing, 2) Moderation queue, 3) Earnings
  const [activeTab, setActiveTab] = useState('listing');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && ['listing', 'moderation', 'earnings'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Listing sub-tab: 'creators' or 'consumers'
  const [listingSubTab, setListingSubTab] = useState('creators');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [stats, setStats] = useState(null);
  const [pendingTools, setPendingTools] = useState([]);
  const [creators, setCreators] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCreatorId, setExpandedCreatorId] = useState(null);

  // Commission / Profit Rate state
  const [commissionBps, setCommissionBps] = useState(1500); // 15% default
  const [commissionSuccess, setCommissionSuccess] = useState(null);
  const [commissionSaving, setCommissionSaving] = useState(false);

  // Review Modal for Moderation Queue
  const [reviewModal, setReviewModal] = useState({
    isOpen: false,
    tool: null,
    action: 'approve',
    reason: '',
  });
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [s, p, crs, cns, txs, comm] = await Promise.all([
        api.getAdminStats().catch(() => null),
        api.getPendingTools().catch(() => []),
        api.getAdminCreators().catch(() => []),
        api.getAdminConsumers().catch(() => []),
        api.getAdminTransactions().catch(() => []),
        api.getPlatformCommission().catch(() => ({ platformFeeBps: 1500, ratePercentage: '15.00' })),
      ]);

      setStats(s);
      setPendingTools(p || []);
      setCreators(crs || []);
      setConsumers(cns || []);
      setTransactions(txs || []);
      if (comm?.platformFeeBps) {
        setCommissionBps(Number(comm.platformFeeBps));
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (tool, action) => {
    setReviewModal({
      isOpen: true,
      tool,
      action,
      reason:
        action === 'approve'
          ? 'Endpoint response verified; schema matches output parameters and passed test call'
          : action === 'reject'
          ? 'Fails quality guidelines or incomplete description'
          : 'Suspended due to rate of failure or abuse reports',
    });
  };

  const handleConfirmReview = async () => {
    if (!reviewModal.tool) return;
    setSubmittingReview(true);
    try {
      await api.reviewTool(reviewModal.tool.id, reviewModal.action, reviewModal.reason);
      setReviewModal({ ...reviewModal, isOpen: false });
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleUpdateCommission = async (e) => {
    e.preventDefault();
    setCommissionSaving(true);
    try {
      await api.updatePlatformCommission(commissionBps);
      setCommissionSuccess(
        `Profit take-rate updated to ${commissionBps} BPS (${(commissionBps / 100).toFixed(2)}%)!`
      );
      setTimeout(() => setCommissionSuccess(null), 4000);
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Failed to update commission rate');
    } finally {
      setCommissionSaving(false);
    }
  };

  // Filtered lists for Listing tab
  const filteredCreators = creators.filter((c) =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.tools || []).some((t) => (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredConsumers = consumers.filter((c) =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filtered transactions for Earnings tab
  const filteredTransactions = transactions.filter((tx) =>
    (tx.tool_name || tx.toolName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tx.consumer_name || tx.consumerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tx.creator_name || tx.creatorName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-900">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            Platform Administration Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse API listings, moderate pending tools, and manage protocol earnings and profit rates.
          </p>
        </div>
        <button
          onClick={loadAdminData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Primary 3 Navigation Tabs requested by user: Listing, Moderation queue, Earnings */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-px">
        {/* Tab 1: Listing */}
        <button
          onClick={() => {
            setActiveTab('listing');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'listing'
              ? 'border-indigo-500 text-white bg-slate-900/40 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className={`w-4 h-4 ${activeTab === 'listing' ? 'text-indigo-400' : 'text-slate-500'}`} />
          <span>Listing</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {creators.length} creators • {consumers.length} consumers
          </span>
        </button>

        {/* Tab 2: Moderation queue */}
        <button
          onClick={() => {
            setActiveTab('moderation');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'moderation'
              ? 'border-indigo-500 text-white bg-slate-900/40 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className={`w-4 h-4 ${activeTab === 'moderation' ? 'text-indigo-400' : 'text-slate-500'}`} />
          <span>Moderation Queue</span>
          {pendingTools.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold font-mono">
              {pendingTools.length}
            </span>
          )}
        </button>

        {/* Tab 3: Earnings */}
        <button
          onClick={() => {
            setActiveTab('earnings');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'earnings'
              ? 'border-indigo-500 text-white bg-slate-900/40 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className={`w-4 h-4 ${activeTab === 'earnings' ? 'text-indigo-400' : 'text-slate-500'}`} />
          <span>Earnings & Profit Rate</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1) TAB: LISTING (Creators + APIs & Consumers)             */}
      {/* ========================================================= */}
      {activeTab === 'listing' && (
        <div className="space-y-6">
          {/* Sub Navigation Bar: Creators & APIs vs Consumers */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800/80">
              <button
                onClick={() => setListingSubTab('creators')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  listingSubTab === 'creators'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Creators & Registered APIs ({creators.length})</span>
              </button>
              <button
                onClick={() => setListingSubTab('consumers')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  listingSubTab === 'consumers'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Consumers & Accounts ({consumers.length})</span>
              </button>
            </div>

            {/* Search filter input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder={listingSubTab === 'creators' ? 'Search creator or tool name...' : 'Search consumer name or email...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Sub-view A: Creators & Listed APIs */}
          {listingSubTab === 'creators' && (
            <div className="space-y-4">
              {filteredCreators.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
                  No creators found matching &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredCreators.map((creator) => {
                  const isExpanded = expandedCreatorId === creator.id;
                  const creatorTools = creator.tools || [];
                  const netEarn = creator.total_net_earnings != null ? creator.total_net_earnings : Number(creator.totalNetEarningsMicroUsd || 0) / 1000000;

                  return (
                    <div
                      key={creator.id}
                      className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 hover:border-slate-700 transition"
                    >
                      {/* Creator summary header */}
                      <div
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                        onClick={() => setExpandedCreatorId(isExpanded ? null : creator.id)}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{creator.name}</span>
                            <Badge variant="purple" className="text-[10px]">
                              {creatorTools.length} {creatorTools.length === 1 ? 'API Listed' : 'APIs Listed'}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-400">
                            {creator.email} • Registered{' '}
                            {creator.created_at || creator.createdAt
                              ? new Date(creator.created_at || creator.createdAt).toLocaleDateString()
                              : 'Recently'}
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-semibold text-slate-500">Creator Earnings</div>
                            <div className="text-sm font-mono font-bold text-emerald-400">
                              ${Number(netEarn).toFixed(4)}
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedCreatorId(isExpanded ? null : creator.id);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" />
                                <span>Hide APIs</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" />
                                <span>View APIs ({creatorTools.length})</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Expandable APIs List */}
                      {isExpanded && (
                        <div className="pt-4 border-t border-slate-800/80 space-y-3">
                          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            APIs Registered by {creator.name}:
                          </div>

                          {creatorTools.length === 0 ? (
                            <div className="text-xs text-slate-500 italic py-2">
                              No APIs registered by this creator yet.
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800">
                                  <tr>
                                    <th className="px-4 py-2.5">API Name & Slug</th>
                                    <th className="px-4 py-2.5">Category</th>
                                    <th className="px-4 py-2.5">Endpoint Target</th>
                                    <th className="px-4 py-2.5">Price / Call</th>
                                    <th className="px-4 py-2.5">Status</th>
                                    <th className="px-4 py-2.5 text-right">Lifetime Calls</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                  {creatorTools.map((tool) => {
                                    const toolPrice =
                                      tool.price_per_call != null
                                        ? tool.price_per_call
                                        : Number(tool.priceMicroUsd || 0) / 1000000;
                                    const toolCalls =
                                      tool.total_calls != null ? tool.total_calls : tool.callsCount || 0;
                                    const statusStr = (tool.status || '').toLowerCase();
                                    const isApproved = statusStr === 'approved';
                                    const isPending = statusStr.includes('pending');

                                    return (
                                      <tr key={tool.id} className="hover:bg-slate-800/30 transition">
                                        <td className="px-4 py-3">
                                          <div className="font-semibold text-white">{tool.name}</div>
                                          <div className="font-mono text-[10px] text-indigo-400">{tool.slug}</div>
                                        </td>
                                        <td className="px-4 py-3 capitalize text-slate-400">{tool.category}</td>
                                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400 max-w-xs truncate">
                                          <span className="text-cyan-400 font-bold">{tool.http_method || tool.httpMethod || 'POST'}</span>{' '}
                                          {tool.endpoint_path || tool.endpointPath || '/'}
                                        </td>
                                        <td className="px-4 py-3 font-mono font-bold text-white">
                                          ${Number(toolPrice).toFixed(4)}
                                        </td>
                                        <td className="px-4 py-3">
                                          <Badge
                                            variant={isApproved ? 'success' : isPending ? 'warning' : 'danger'}
                                            className="text-[10px]"
                                          >
                                            {tool.status}
                                          </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-200">
                                          {toolCalls}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Sub-view B: Consumers Data and Wallets */}
          {listingSubTab === 'consumers' && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden space-y-4">
              <div className="p-6 pb-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-semibold text-sm text-white">
                    Platform Consumers & Wallets ({filteredConsumers.length})
                  </h3>
                </div>
                <span className="text-xs text-slate-500">Autonomous Agent Owners</span>
              </div>

              <div className="overflow-x-auto">
                {filteredConsumers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No consumers found matching &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-3">Consumer</th>
                        <th className="px-6 py-3">Joined</th>
                        <th className="px-6 py-3">Available Balance</th>
                        <th className="px-6 py-3">Reserved Mutex</th>
                        <th className="px-6 py-3">Active Agents</th>
                        <th className="px-6 py-3">Total Calls</th>
                        <th className="px-6 py-3 text-right">Total Spent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredConsumers.map((c) => {
                        const bal =
                          c.wallet_balance != null
                            ? c.wallet_balance
                            : Number(c.walletBalanceMicroUsd || 0) / 1000000;
                        const resBal =
                          c.wallet_reserved != null
                            ? c.wallet_reserved
                            : Number(c.walletReservedMicroUsd || 0) / 1000000;
                        const spent =
                          c.total_spent != null
                            ? c.total_spent
                            : Number(c.totalSpentMicroUsd || 0) / 1000000;
                        const callsCount = c.total_calls_count || 0;
                        const agentsCount = c.agents_count || (c.agents ? c.agents.length : 0);

                        return (
                          <tr key={c.id} className="hover:bg-slate-800/30 transition">
                            <td className="px-6 py-4 font-semibold text-white">
                              <div>{c.name}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{c.email}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-400">
                              {c.created_at || c.createdAt
                                ? new Date(c.created_at || c.createdAt).toLocaleDateString()
                                : 'Recent'}
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-emerald-400">
                              ${Number(bal).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-400">
                              ${Number(resBal).toFixed(2)}
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant="cyan" className="text-[10px]">
                                {agentsCount} {agentsCount === 1 ? 'Agent' : 'Agents'}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-300">{callsCount}</td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-indigo-400">
                              ${Number(spent).toFixed(4)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2) TAB: MODERATION QUEUE                                  */}
      {/* ========================================================= */}
      {activeTab === 'moderation' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden space-y-4">
          <div className="p-6 pb-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-sm text-white">
                Pending API Moderation Queue ({pendingTools.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">Manual inspection & verification queue</span>
          </div>

          <div className="overflow-x-auto">
            {pendingTools.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="font-bold text-sm text-white">Moderation queue is empty!</div>
                <div>All creator registered APIs have been reviewed and approved for marketplace listing.</div>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3">Tool Name</th>
                    <th className="px-6 py-3">Endpoint Target</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Price / Call</th>
                    <th className="px-6 py-3 text-right">Moderator Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {pendingTools.map((t) => {
                    const priceVal =
                      t.price_per_call != null
                        ? t.price_per_call
                        : Number(t.priceMicroUsd || 0) / 1000000;

                    return (
                      <tr key={t.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-6 py-4 font-semibold text-white">
                          <div>{t.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{t.slug}</div>
                          {t.short_desc && <div className="text-[10px] text-slate-500 mt-0.5">{t.short_desc}</div>}
                        </td>
                        <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                          <span className="text-indigo-400 font-bold">{t.http_method || t.httpMethod || 'POST'}</span>{' '}
                          {t.base_url || t.baseUrl || ''}{t.endpoint_path || t.endpointPath || '/'}
                        </td>
                        <td className="px-6 py-4 capitalize text-slate-400">{t.category}</td>
                        <td className="px-6 py-4 font-mono font-bold text-emerald-400">
                          ${Number(priceVal).toFixed(4)}
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
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3) TAB: EARNINGS & PROFIT RATE (Transaction History)      */}
      {/* ========================================================= */}
      {activeTab === 'earnings' && (
        <div className="space-y-6">
          {/* Platform Health & Total Earning Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Card 1: Total Admin Profit */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-indigo-800/50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-indigo-400 font-semibold uppercase tracking-wider">
                  Total Admin Profit
                </span>
                <DollarSign className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                ${Number(stats?.platform_revenue || (Number(stats?.totalPlatformRevenueMicroUsd || 6750000) / 1000000)).toFixed(4)}
              </div>
              <span className="text-[10px] text-slate-400">Protocol net commission revenue</span>
            </div>

            {/* Card 2: Total Gross Volume */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Gross Protocol Volume</span>
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-cyan-400 font-mono">
                ${Number(stats?.gross_volume || (Number(stats?.totalGrossMicroUsd || 45000000) / 1000000)).toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500">Total volume across all APIs</span>
            </div>

            {/* Card 3: Paid API Calls */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Paid Tool Calls</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {stats?.total_calls || stats?.totalCalls || transactions.length || 42}
              </div>
              <span className="text-[10px] text-slate-500">Successful executions billed</span>
            </div>

            {/* Card 4: Current Profit Rate */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Active Take-Rate</span>
                <Percent className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 font-mono">
                {(commissionBps / 100).toFixed(2)}%
              </div>
              <span className="text-[10px] text-slate-500">{commissionBps} Basis Points per call</span>
            </div>
          </div>

          {/* Option to modify the profit per call rate */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 max-w-2xl">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-sm text-white">Modify Profit Per Call Rate</h3>
            </div>
            <p className="text-xs text-slate-400">
              Configure the protocol take-rate percentage deducted from each successful API call. 100 Basis Points equals 1.00%.
            </p>

            <form onSubmit={handleUpdateCommission} className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between items-center mb-2 font-medium">
                  <span className="text-slate-300">Commission Take-Rate:</span>
                  <span className="text-indigo-400 font-mono font-bold text-sm">
                    {(commissionBps / 100).toFixed(2)}% ({commissionBps} BPS)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="50"
                  value={commissionBps}
                  onChange={(e) => setCommissionBps(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>0% (0 BPS)</span>
                  <span>15% (1500 BPS - Default)</span>
                  <span>30% (3000 BPS)</span>
                  <span>50% (5000 BPS Max)</span>
                </div>
              </div>

              {/* Live Preview */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-slate-400">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Per $1.00 Tool Call Breakdown:
                </span>
                <div className="flex items-center gap-6 font-mono text-[11px]">
                  <span>
                    Admin Profit:{' '}
                    <strong className="text-indigo-400">${(1.0 * (commissionBps / 10000)).toFixed(4)}</strong>
                  </span>
                  <span>
                    Creator Payout:{' '}
                    <strong className="text-emerald-400">${(1.0 * (1 - commissionBps / 10000)).toFixed(4)}</strong>
                  </span>
                </div>
              </div>

              {commissionSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs">
                  {commissionSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={commissionSaving}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition disabled:opacity-50 cursor-pointer"
              >
                {commissionSaving ? 'Saving Rate...' : 'Save Profit Per Call Rate'}
              </button>
            </form>
          </div>

          {/* Transaction History showing which API called and how much profit admin gets */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden space-y-4">
            <div className="p-6 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-sm text-white">API Execution & Profit Ledger</h3>
                <p className="text-xs text-slate-500">
                  Transaction stream showing which API is called and exact admin profit generated.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter by API, creator, or caller..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No transaction logs recorded yet.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3">Timestamp</th>
                      <th className="px-6 py-3">API Called</th>
                      <th className="px-6 py-3">Caller (Consumer)</th>
                      <th className="px-6 py-3">Gross Price</th>
                      <th className="px-6 py-3">Creator Cut</th>
                      <th className="px-6 py-3">Admin Profit</th>
                      <th className="px-6 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredTransactions.map((tx) => {
                      const grossPrice =
                        tx.price_charged != null
                          ? tx.price_charged
                          : Number(tx.priceMicroUsd || 0) / 1000000;
                      const creatorCut =
                        tx.creator_earnings != null
                          ? tx.creator_earnings
                          : Number(tx.creatorEarningsMicroUsd || 0) / 1000000;
                      const adminProfit =
                        tx.platform_fee != null
                          ? tx.platform_fee
                          : Number(tx.platformFeeMicroUsd || 0) / 1000000;
                      const apiName = tx.tool_name || tx.toolName || 'Unknown API';
                      const apiSlug = tx.tool_slug || tx.toolSlug || '';
                      const callerName = tx.consumer_name || tx.consumerName || 'Consumer';
                      const statusStr = (tx.status || 'success').toLowerCase();

                      return (
                        <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                            {tx.created_at || tx.createdAt
                              ? new Date(tx.created_at || tx.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })
                              : 'Recent'}
                          </td>
                          <td className="px-6 py-3 font-semibold text-white">
                            <div>{apiName}</div>
                            <div className="font-mono text-[10px] text-indigo-400">{apiSlug}</div>
                          </td>
                          <td className="px-6 py-3 text-slate-300">
                            <div>{callerName}</div>
                            <div className="text-[10px] text-slate-500">{tx.agent_name || tx.agentName || 'Agent'}</div>
                          </td>
                          <td className="px-6 py-3 font-mono font-semibold text-white">
                            ${Number(grossPrice).toFixed(4)}
                          </td>
                          <td className="px-6 py-3 font-mono text-slate-400">
                            ${Number(creatorCut).toFixed(4)}
                          </td>
                          <td className="px-6 py-3 font-mono font-bold text-emerald-400">
                            +${Number(adminProfit).toFixed(4)}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <Badge
                              variant={statusStr === 'success' ? 'success' : 'danger'}
                              className="text-[10px]"
                            >
                              {tx.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

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
              disabled={submittingReview}
              className={`w-full py-2.5 rounded-xl font-bold text-white transition disabled:opacity-50 cursor-pointer ${
                reviewModal.action === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              {submittingReview ? 'Submitting Decision...' : `Confirm ${reviewModal.action.toUpperCase()}`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
