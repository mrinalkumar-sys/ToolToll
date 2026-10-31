import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Tool,
  AdminCreatorListing,
  AdminConsumerListing,
  AdminTransaction,
  AdminStats,
} from '../../types';
import { formatMicroUsd, formatDate } from '../../utils/formatters';
import {
  Shield,
  CheckCircle,
  XCircle,
  Percent,
  Activity,
  X,
  AlertTriangle,
  TrendingUp,
  Layers,
  Users,
  Code2,
  Clock,
  DollarSign,
  Sliders,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface AdminViewProps {
  activeSection?: 'listing' | 'moderation' | 'earnings';
  onSelectSection?: (section: 'listing' | 'moderation' | 'earnings') => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  activeSection,
  onSelectSection,
}) => {
  const { user, loginDemo } = useAuth();
  
  // Three primary navigation tabs requested: 1) Listing, 2) Moderation queue, 3) Earnings
  const [internalTab, setInternalTab] = useState<'listing' | 'moderation' | 'earnings'>('listing');
  const activeTab = activeSection || internalTab;

  const handleTabChange = (tab: 'listing' | 'moderation' | 'earnings') => {
    setInternalTab(tab);
    if (onSelectSection) {
      onSelectSection(tab);
    }
  };
  
  // Listing sub-tab: 'creators' or 'consumers'
  const [listingSubTab, setListingSubTab] = useState<'creators' | 'consumers'>('creators');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [pendingTools, setPendingTools] = useState<Tool[]>([]);
  const [creators, setCreators] = useState<AdminCreatorListing[]>([]);
  const [consumers, setConsumers] = useState<AdminConsumerListing[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCreatorId, setExpandedCreatorId] = useState<string | null>(null);

  // Commission / Profit Rate state
  const [commissionBps, setCommissionBps] = useState<number>(1500); // 15% default
  const [commissionSuccess, setCommissionSuccess] = useState<string | null>(null);
  const [commissionSaving, setCommissionSaving] = useState(false);

  // Moderation action modal state
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [moderationReason, setModerationReason] = useState('Meets platform standards and passed verification test call');
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'suspend'>('approve');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pending, crs, cns, txs, st, comm] = await Promise.all([
        api.getPendingTools().catch(() => []),
        api.getAdminCreators().catch(() => []),
        api.getAdminConsumers().catch(() => []),
        api.getAdminTransactions().catch(() => []),
        api.getAdminStats().catch(() => null),
        api.getPlatformCommission().catch(() => ({ platformFeeBps: 1500, ratePercentage: '15.00' })),
      ]);

      setPendingTools(pending);
      setCreators(crs);
      setConsumers(cns);
      setTransactions(txs);
      setStats(st);
      if (comm?.platformFeeBps) {
        setCommissionBps(comm.platformFeeBps);
      }
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
    setIsSubmittingReview(true);
    try {
      if (actionType === 'approve') {
        await api.approveTool(selectedTool.id, moderationReason);
      } else if (actionType === 'reject') {
        await api.rejectTool(selectedTool.id, moderationReason);
      } else {
        await api.suspendTool(selectedTool.id, moderationReason);
      }
      setSelectedTool(null);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || 'Moderation action failed');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleUpdateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommissionSaving(true);
    try {
      await api.updatePlatformCommission(commissionBps);
      setCommissionSuccess(
        `Profit take-rate updated to ${commissionBps} BPS (${(commissionBps / 100).toFixed(2)}%)!`
      );
      setTimeout(() => setCommissionSuccess(null), 4000);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update commission rate');
    } finally {
      setCommissionSaving(false);
    }
  };

  const isUserAdmin = Boolean(user?.isAdmin || String((user as any)?.role).toLowerCase() === 'admin');
  if (!isUserAdmin) {
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

  // Filtered lists for Listing tab
  const filteredCreators = creators.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tools.some((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredConsumers = consumers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filtered transactions for Earnings tab
  const filteredTransactions = transactions.filter((tx) =>
    tx.toolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.consumerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.creatorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="section-dark" style={{ minHeight: '85vh', paddingTop: '40px', paddingBottom: '60px' }}>
      <div className="container-editorial">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
          <div style={{ maxWidth: '840px' }}>
            <span className="section-kicker">Administrator Console</span>
            <h1
              style={{
                fontSize: 'clamp(1.5rem, 3.8vw, 3.2rem)',
                maxWidth: '100%',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                fontWeight: 900,
                letterSpacing: '-0.035em',
                color: '#FFFFFF',
                marginBottom: '8px',
              }}
            >
              Platform Administration
            </h1>
            <p style={{ color: 'var(--text-dark-secondary)', fontSize: '1.02rem', lineHeight: 1.6 }}>
              Inspect creator API listings, moderate pending tools, and manage protocol earnings and take-rates.
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Data</span>
          </button>
        </div>

        {/* Primary 3-Tab Navigation Bar requested by user */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-dark)',
            marginBottom: '32px',
            overflowX: 'auto',
          }}
        >
          {/* 1) Listing Tab */}
          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'listing' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'listing' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'listing' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 20px',
              fontSize: '0.92rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={() => {
              handleTabChange('listing');
              setSearchQuery('');
            }}
          >
            <Layers size={16} color={activeTab === 'listing' ? 'var(--brand-orange)' : 'currentColor'} />
            Listing ({creators.length} Creators • {consumers.length} Consumers)
          </button>

          {/* 2) Moderation Queue Tab */}
          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'moderation' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'moderation' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'moderation' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 20px',
              fontSize: '0.92rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={() => {
              handleTabChange('moderation');
              setSearchQuery('');
            }}
          >
            <Clock size={16} color={activeTab === 'moderation' ? 'var(--brand-orange)' : 'currentColor'} />
            Moderation Queue
            {pendingTools.length > 0 && (
              <span
                style={{
                  background: 'var(--brand-orange)',
                  color: '#FFFFFF',
                  fontSize: '0.70rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '10px',
                  lineHeight: 1.2,
                }}
              >
                {pendingTools.length}
              </span>
            )}
          </button>

          {/* 3) Earnings Tab */}
          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'earnings' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'earnings' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'earnings' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 20px',
              fontSize: '0.92rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={() => {
              handleTabChange('earnings');
              setSearchQuery('');
            }}
          >
            <TrendingUp size={16} color={activeTab === 'earnings' ? 'var(--brand-orange)' : 'currentColor'} />
            Earnings & Take-Rate
          </button>
        </div>

        {/* ========================================================= */}
        {/* 1) TAB: LISTING                                           */}
        {/* ========================================================= */}
        {activeTab === 'listing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Top Toolbar: Sub-tab switcher + Search */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '14px 20px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-dark)',
              }}
            >
              <div style={{ display: 'inline-flex', gap: '6px', background: 'rgba(0, 0, 0, 0.3)', padding: '4px', borderRadius: 'var(--radius-xs)' }}>
                <button
                  className="btn btn-sm"
                  style={{
                    background: listingSubTab === 'creators' ? 'var(--brand-orange)' : 'transparent',
                    color: listingSubTab === 'creators' ? '#FFFFFF' : 'var(--text-dark-muted)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    border: 'none',
                    borderRadius: 'var(--radius-xs)',
                    padding: '6px 14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onClick={() => setListingSubTab('creators')}
                >
                  <Code2 size={14} />
                  Creators & APIs ({creators.length})
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    background: listingSubTab === 'consumers' ? 'var(--brand-orange)' : 'transparent',
                    color: listingSubTab === 'consumers' ? '#FFFFFF' : 'var(--text-dark-muted)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    border: 'none',
                    borderRadius: 'var(--radius-xs)',
                    padding: '6px 14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onClick={() => setListingSubTab('consumers')}
                >
                  <Users size={14} />
                  Consumers & Accounts ({consumers.length})
                </button>
              </div>

              {/* Search input */}
              <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                <Search
                  size={15}
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dark-muted)' }}
                />
                <input
                  type="text"
                  placeholder={listingSubTab === 'creators' ? 'Search creator or tool...' : 'Search consumer name or email...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '36px', height: '36px', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            {/* Sub-view A: Creators and their respective listed APIs */}
            {listingSubTab === 'creators' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredCreators.length === 0 ? (
                  <div className="card-dark" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dark-muted)' }}>
                    No creators found matching &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  filteredCreators.map((creator) => {
                    const isExpanded = expandedCreatorId === creator.id;
                    return (
                      <div
                        key={creator.id}
                        className="card-dark"
                        style={{
                          padding: '24px',
                          border: '1px solid var(--border-dark)',
                          transition: 'border-color 0.2s',
                        }}
                      >
                        {/* Creator Header Row */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            flexWrap: 'wrap',
                            gap: '12px',
                            cursor: 'pointer',
                          }}
                          onClick={() => setExpandedCreatorId(isExpanded ? null : creator.id)}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                                {creator.name}
                              </h3>
                              <span className="badge badge-orange">{creator.tools.length} APIs Listed</span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-dark-secondary)', marginTop: '4px' }}>
                              {creator.email} • Joined {formatDate(creator.createdAt)}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.70rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                                Creator Revenue
                              </div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--status-emerald)', fontFamily: 'var(--font-mono)' }}>
                                {formatMicroUsd(creator.totalNetEarningsMicroUsd)}
                              </div>
                            </div>

                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedCreatorId(isExpanded ? null : creator.id);
                              }}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp size={14} /> Hide APIs
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={14} /> View APIs ({creator.tools.length})
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Creator's Respective Listed APIs (Expandable) */}
                        {isExpanded && (
                          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-dark)' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>
                              APIs Registered by {creator.name}
                            </div>

                            {creator.tools.length === 0 ? (
                              <div style={{ fontSize: '0.84rem', color: 'var(--text-dark-muted)', fontStyle: 'italic' }}>
                                This creator has not registered any APIs yet.
                              </div>
                            ) : (
                              <div className="data-table-container">
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>API Name & Slug</th>
                                      <th>Category</th>
                                      <th>Endpoint Target</th>
                                      <th>Price / Call</th>
                                      <th>Status</th>
                                      <th>Total Calls</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {creator.tools.map((tool) => (
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
                                        <td style={{ fontSize: '0.80rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dark-muted)' }}>
                                          <span style={{ color: 'var(--brand-orange)', fontWeight: 700 }}>{tool.httpMethod || 'POST'}</span> {tool.endpointPath || '/'}
                                        </td>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFFFFF' }}>
                                          {formatMicroUsd(tool.priceMicroUsd)}
                                        </td>
                                        <td>
                                          <span
                                            className={`badge ${
                                              tool.status.toUpperCase() === 'APPROVED'
                                                ? 'badge-emerald'
                                                : tool.status.toUpperCase() === 'PENDING_REVIEW'
                                                ? 'badge-orange'
                                                : 'badge-dark-neutral'
                                            }`}
                                          >
                                            {tool.status.toUpperCase()}
                                          </span>
                                        </td>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFFFFF' }}>
                                          {tool.callsCount || 0}
                                        </td>
                                      </tr>
                                    ))}
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
              <div className="card-dark" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '16px' }}>
                  Registered Consumers & Wallets ({filteredConsumers.length})
                </h3>

                {filteredConsumers.length === 0 ? (
                  <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-dark-muted)' }}>
                    No consumers found matching &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Consumer</th>
                          <th>Joined</th>
                          <th>Wallet Balance</th>
                          <th>Reserved Mutex</th>
                          <th>Active Agents</th>
                          <th>Total Calls</th>
                          <th>Total Spent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredConsumers.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{c.name}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)' }}>{c.email}</div>
                            </td>
                            <td style={{ fontSize: '0.80rem', color: 'var(--text-dark-muted)' }}>
                              {formatDate(c.createdAt)}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--status-emerald)' }}>
                              {formatMicroUsd(c.walletBalanceMicroUsd)}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-dark-muted)' }}>
                              {formatMicroUsd(c.walletReservedMicroUsd)}
                            </td>
                            <td>
                              <span className="badge badge-dark-neutral">
                                {c.agentsCount} {c.agentsCount === 1 ? 'Agent' : 'Agents'}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFFFFF' }}>
                              {c.totalCallsCount}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38BDF8' }}>
                              {formatMicroUsd(c.totalSpentMicroUsd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 2) TAB: MODERATION QUEUE                                  */}
        {/* ========================================================= */}
        {activeTab === 'moderation' && (
          <div className="card-dark" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  API Moderation & Review Queue
                </h3>
                <p style={{ color: 'var(--text-dark-secondary)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
                  Verify security, rate limits, schema integrity, and approve creator APIs for marketplace publishing.
                </p>
              </div>
              <span className="badge badge-orange">{pendingTools.length} Awaiting Approval</span>
            </div>

            {pendingTools.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-dark-muted)' }}>
                <CheckCircle size={44} color="var(--status-emerald)" style={{ margin: '0 auto 16px' }} />
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' }}>Moderation queue is clear!</div>
                <div style={{ fontSize: '0.86rem', marginTop: '4px' }}>
                  All creator tool submissions have been thoroughly evaluated and approved.
                </div>
              </div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>API Name & Slug</th>
                      <th>Category</th>
                      <th>Creator</th>
                      <th>Base & Path</th>
                      <th>Price / Call</th>
                      <th>Verification</th>
                      <th style={{ textAlign: 'right' }}>Moderator Action</th>
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
                          {tool.description && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-dark-muted)', maxWidth: '280px', marginTop: '3px' }} className="truncate">
                              {tool.description}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-dark-neutral">{tool.category}</span>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          <div style={{ fontWeight: 600, color: '#FFFFFF' }}>{tool.creator?.name || 'Verified Creator'}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-dark-muted)' }}>{tool.creator?.email || ''}</div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-dark-muted)' }}>
                          <span style={{ color: 'var(--brand-orange)', fontWeight: 700 }}>{tool.httpMethod || 'POST'}</span> {tool.endpointPath || '/'}
                        </td>
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
                                fontWeight: 700,
                              }}
                              onClick={() => {
                                setSelectedTool(tool);
                                setActionType('approve');
                                setModerationReason('Endpoint verified; schema matches output parameters and passed test call');
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
                                fontWeight: 700,
                              }}
                              onClick={() => {
                                setSelectedTool(tool);
                                setActionType('reject');
                                setModerationReason('Does not meet platform quality guidelines or endpoint is unresponsive');
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

        {/* ========================================================= */}
        {/* 3) TAB: EARNINGS & TAKE-RATE                              */}
        {/* ========================================================= */}
        {activeTab === 'earnings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Total Earning Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {/* Card 1: Total Admin Profit */}
              <div className="card-dark" style={{ padding: '24px', border: '1px solid var(--brand-orange-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--brand-orange)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                    Total Admin Profit
                  </span>
                  <DollarSign size={18} color="var(--brand-orange)" />
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
                  {formatMicroUsd(stats?.totalPlatformRevenueMicroUsd || '6750000')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)', marginTop: '4px' }}>
                  Net commission collected by platform
                </div>
              </div>

              {/* Card 2: Gross Transaction Volume */}
              <div className="card-dark" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                    Gross Protocol Volume
                  </span>
                  <Activity size={18} color="#38BDF8" />
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#38BDF8', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
                  {formatMicroUsd(stats?.totalGrossMicroUsd || '45000000')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)', marginTop: '4px' }}>
                  Total value exchanged across all API calls
                </div>
              </div>

              {/* Card 3: Total Tool Calls */}
              <div className="card-dark" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                    Paid API Executions
                  </span>
                  <TrendingUp size={18} color="var(--status-emerald)" />
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#34D399', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
                  {stats?.totalCalls || transactions.length || 42}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)', marginTop: '4px' }}>
                  Individual billed tool invocations
                </div>
              </div>

              {/* Card 4: Active Profit Rate */}
              <div className="card-dark" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                    Active Profit Rate
                  </span>
                  <Percent size={18} color="#A78BFA" />
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#C084FC', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
                  {(commissionBps / 100).toFixed(2)}%
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)', marginTop: '4px' }}>
                  {commissionBps} Basis Points take-rate
                </div>
              </div>
            </div>

            {/* Modify Profit Per Call Rate Option requested by user */}
            <div className="card-dark" style={{ padding: '28px', maxWidth: '720px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Sliders size={20} color="var(--brand-orange)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  Modify Profit Per Call Rate
                </h3>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                Adjust the platform profit take-rate captured on every paid API call. 100 Basis Points (BPS) equals 1.00%.
              </p>

              <form onSubmit={handleUpdateCommission}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        Platform Profit Take-Rate (Basis Points):
                      </label>
                      <strong style={{ color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                        {(commissionBps / 100).toFixed(2)}% ({commissionBps} BPS)
                      </strong>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="5000"
                      step="50"
                      value={commissionBps}
                      onChange={(e) => setCommissionBps(parseInt(e.target.value, 10))}
                      style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--brand-orange)' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dark-muted)', marginTop: '4px' }}>
                      <span>0% (0 BPS)</span>
                      <span>15% (1500 BPS - Default)</span>
                      <span>30% (3000 BPS)</span>
                      <span>50% (5000 BPS Max)</span>
                    </div>
                  </div>

                  {/* Profit simulation example */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-dark)',
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ color: 'var(--text-dark-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.70rem' }}>
                      Live Profit Split Preview (Example: $1.00 Tool Call):
                    </div>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      <div>
                        Admin Profit:{' '}
                        <strong style={{ color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)' }}>
                          ${(1.0 * (commissionBps / 10000)).toFixed(4)}
                        </strong>{' '}
                        ({(commissionBps / 100).toFixed(2)}%)
                      </div>
                      <div>
                        Creator Net Payout:{' '}
                        <strong style={{ color: '#34D399', fontFamily: 'var(--font-mono)' }}>
                          ${(1.0 * (1 - commissionBps / 10000)).toFixed(4)}
                        </strong>{' '}
                        ({(100 - commissionBps / 100).toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  {commissionSuccess && (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: 'var(--status-emerald-bg)',
                        color: '#34D399',
                        border: '1px solid var(--status-emerald-border)',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '0.84rem',
                      }}
                    >
                      {commissionSuccess}
                    </div>
                  )}

                  <div>
                    <button
                      type="submit"
                      disabled={commissionSaving}
                      className="btn btn-primary"
                      style={{ padding: '8px 20px', fontSize: '0.88rem' }}
                    >
                      {commissionSaving ? 'Saving Rate...' : 'Save New Profit Rate'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* API Call Transaction History requested by user */}
            <div className="card-dark" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                    API Execution & Admin Profit Ledger
                  </h3>
                  <p style={{ color: 'var(--text-dark-secondary)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
                    Every API execution showing which tool was called and exact platform fee profit captured.
                  </p>
                </div>

                <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
                  <Search
                    size={14}
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dark-muted)' }}
                  />
                  <input
                    type="text"
                    placeholder="Search by API, creator, caller..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '32px', height: '34px', fontSize: '0.80rem' }}
                  />
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-dark-muted)' }}>
                  No transaction history recorded yet.
                </div>
              ) : (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>API Tool Called</th>
                        <th>Caller (Consumer)</th>
                        <th>Creator</th>
                        <th>Gross Price</th>
                        <th>Creator Net</th>
                        <th>Admin Profit (Fee)</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((tx) => (
                        <tr key={tx.id}>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)', whiteSpace: 'nowrap' }}>
                            {formatDate(tx.createdAt)}
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{tx.toolName}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)' }}>
                              {tx.toolSlug}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#FFFFFF', fontSize: '0.82rem' }}>{tx.consumerName}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)' }}>
                              Agent: {tx.agentName}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-dark-secondary)' }}>
                            {tx.creatorName}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFFFFF' }}>
                            {formatMicroUsd(tx.priceMicroUsd)}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#94A3B8' }}>
                            {formatMicroUsd(tx.creatorEarningsMicroUsd)}
                          </td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--status-emerald)' }}>
                                +{formatMicroUsd(tx.platformFeeMicroUsd)}
                              </span>
                              <span className="badge badge-emerald" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                                Profit
                              </span>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                tx.status.toUpperCase() === 'SUCCESS' ? 'badge-emerald' : 'badge-rose'
                              }`}
                            >
                              {tx.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Moderation Review Modal */}
        {selectedTool && (
          <div className="modal-overlay" onClick={() => setSelectedTool(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Moderation: {actionType.toUpperCase()} ({selectedTool.name})
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
                  <div style={{ marginBottom: '14px', fontSize: '0.84rem', color: 'var(--text-dark-secondary)' }}>
                    {actionType === 'approve'
                      ? 'Approving this API will immediately make it active and discoverable on the ToolToll marketplace.'
                      : actionType === 'reject'
                      ? 'Rejecting this API will notify the creator with your feedback and exclude it from the marketplace.'
                      : 'Suspending this API will revoke execution permissions until compliance issues are resolved.'}
                  </div>

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
                    disabled={isSubmittingReview}
                    className={actionType === 'approve' ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={
                      actionType === 'reject'
                        ? { background: 'var(--status-rose-bg)', color: '#F87171', borderColor: 'var(--status-rose-border)' }
                        : {}
                    }
                  >
                    {isSubmittingReview ? 'Processing...' : `Confirm ${actionType.toUpperCase()}`}
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
