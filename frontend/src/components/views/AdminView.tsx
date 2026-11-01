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
  DataGrid,
  ColDef,
  StatusCellRenderer,
  MethodCellRenderer,
  MicroUsdCellRenderer,
  DateCellRenderer,
} from '../common/DataGrid';
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

  // AG Grid Column Definitions for Admin Console
  const moderationColumnDefs: ColDef<Tool>[] = [
    {
      headerName: 'API Name & Route',
      field: 'name',
      flex: 1.8,
      minWidth: 280,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (params: any) => {
        const tool = params.data;
        if (!tool) return '—';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center', padding: '8px 0', width: '100%' }}>
            <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.84rem', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: 1.35 }}>
              {tool.name}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#FF6C37', fontFamily: 'var(--font-mono)', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
              {tool.slug}
            </div>
            {tool.description && (
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-dark-muted)',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  whiteSpace: 'normal',
                  lineHeight: 1.35,
                  marginTop: '2px',
                }}
                title={tool.description}
              >
                {tool.description}
              </div>
            )}
          </div>
        );
      },
    },
    {
      headerName: 'Category',
      field: 'category',
      width: 150,
      minWidth: 140,
      cellRenderer: (params: any) => (
        <span className="badge badge-dark-neutral" style={{ fontSize: '0.72rem', padding: '3px 8px', whiteSpace: 'nowrap' }}>
          {params.value}
        </span>
      ),
    },
    {
      headerName: 'Creator',
      field: 'creator.name' as any,
      valueGetter: (params: any) => params.data?.creator?.name || 'Verified Creator',
      width: 200,
      minWidth: 180,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (params: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center', padding: '6px 0', width: '100%' }}>
          <div style={{ fontWeight: 600, color: '#FFFFFF', fontSize: '0.82rem', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
            {params.value}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
            {params.data?.creator?.email || ''}
          </div>
        </div>
      ),
    },
    {
      headerName: 'Method',
      field: 'httpMethod',
      width: 105,
      minWidth: 95,
      cellRenderer: MethodCellRenderer,
    },
    {
      headerName: 'Endpoint Path',
      field: 'endpointPath',
      flex: 1.4,
      minWidth: 200,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (params: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.80rem', color: '#FFFFFF', wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'normal', padding: '6px 0', display: 'block' }}>
          {params.value || '/'}
        </span>
      ),
    },
    {
      headerName: 'Price / Call',
      field: 'priceMicroUsd',
      width: 140,
      minWidth: 130,
      cellRenderer: MicroUsdCellRenderer,
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 140,
      minWidth: 130,
      cellRenderer: StatusCellRenderer,
    },
    {
      headerName: 'Moderator Actions',
      field: 'id',
      width: 220,
      minWidth: 210,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const tool = params.data;
        if (!tool) return null;
        return (
          <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', height: '100%' }}>
            <button
              className="btn btn-sm"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34D399',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                fontWeight: 700,
                padding: '5px 10px',
                fontSize: '0.76rem',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
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
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#F87171',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                fontWeight: 700,
                padding: '5px 10px',
                fontSize: '0.76rem',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
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
        );
      },
    },
  ];

  const consumersColumnDefs: ColDef<AdminConsumerListing>[] = [
    {
      headerName: 'Consumer Profile',
      field: 'name',
      flex: 1.5,
      minWidth: 240,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (params: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center', padding: '6px 0', width: '100%' }}>
          <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.84rem', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
            {params.value}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-dark-muted)', wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
            {params.data?.email}
          </div>
        </div>
      ),
    },
    {
      headerName: 'Joined Date',
      field: 'createdAt',
      width: 165,
      minWidth: 155,
      cellRenderer: DateCellRenderer,
    },
    {
      headerName: 'Wallet Balance',
      field: 'walletBalanceMicroUsd',
      width: 150,
      minWidth: 140,
      cellRenderer: MicroUsdCellRenderer,
    },
    {
      headerName: 'Reserved Mutex',
      field: 'walletReservedMicroUsd',
      width: 150,
      minWidth: 140,
      cellRenderer: MicroUsdCellRenderer,
    },
    {
      headerName: 'Active Agents',
      field: 'agentsCount',
      width: 140,
      minWidth: 130,
      cellRenderer: (params: any) => (
        <span className="badge badge-dark-neutral" style={{ fontSize: '0.72rem', padding: '3px 8px', whiteSpace: 'nowrap' }}>
          {params.value} {params.value === 1 ? 'Agent' : 'Agents'}
        </span>
      ),
    },
    {
      headerName: 'Total Calls',
      field: 'totalCallsCount',
      width: 130,
      minWidth: 120,
      cellRenderer: (params: any) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFFFFF', fontSize: '0.84rem' }}>
          {params.value || 0}
        </span>
      ),
    },
    {
      headerName: 'Total Spent',
      field: 'totalSpentMicroUsd' as any,
      valueGetter: (params: any) => params.data?.totalSpentMicroUsd || '0',
      width: 150,
      minWidth: 140,
      cellRenderer: MicroUsdCellRenderer,
    },
  ];

  const creatorsColumnDefs: ColDef<AdminCreatorListing>[] = [
    {
      headerName: 'Creator Name & Email',
      field: 'name',
      flex: 1.5,
      minWidth: 240,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (params: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center', padding: '6px 0', width: '100%' }}>
          <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.84rem', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
            {params.value}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-dark-muted)', wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
            {params.data?.email}
          </div>
        </div>
      ),
    },
    {
      headerName: 'Joined Date',
      field: 'createdAt',
      width: 165,
      minWidth: 155,
      cellRenderer: DateCellRenderer,
    },
    {
      headerName: 'Registered APIs',
      field: 'totalTools',
      width: 150,
      minWidth: 140,
      cellRenderer: (params: any) => (
        <span className="badge badge-dark-neutral" style={{ fontSize: '0.72rem', padding: '3px 8px', whiteSpace: 'nowrap' }}>
          {params.value} {params.value === 1 ? 'API' : 'APIs'}
        </span>
      ),
    },
    {
      headerName: 'Gross Earnings',
      field: 'totalGrossEarningsMicroUsd',
      width: 160,
      minWidth: 150,
      cellRenderer: MicroUsdCellRenderer,
    },
    {
      headerName: 'Net Creator Payout',
      field: 'totalNetEarningsMicroUsd',
      width: 170,
      minWidth: 160,
      cellRenderer: (params: any) => (
        <span style={{ color: '#34D399', fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
          {formatMicroUsd(params.value)}
        </span>
      ),
    },
    {
      headerName: 'Actions',
      field: 'id',
      width: 140,
      minWidth: 130,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const creatorId = params.value;
        const isExpanded = expandedCreatorId === creatorId;
        return (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setExpandedCreatorId(isExpanded ? null : creatorId)}
            style={{ padding: '5px 10px', fontSize: '0.74rem', whiteSpace: 'nowrap' }}
          >
            {isExpanded ? 'Hide APIs' : 'View APIs'}
          </button>
        );
      },
    },
  ];

  const transactionsColumnDefs: ColDef<AdminTransaction>[] = [
    {
      headerName: 'Timestamp',
      field: 'createdAt',
      width: 175,
      minWidth: 165,
      cellRenderer: DateCellRenderer,
      sort: 'desc',
    },
    {
      headerName: 'API Tool Called',
      field: 'toolName',
      flex: 1.5,
      minWidth: 230,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (params: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center', padding: '6px 0', width: '100%' }}>
          <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.84rem', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
            {params.value}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#FF6C37', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
            {params.data?.toolSlug}
          </div>
        </div>
      ),
    },
    {
      headerName: 'Consumer Caller',
      field: 'consumerName',
      width: 190,
      minWidth: 180,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (params: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', justifyContent: 'center', padding: '6px 0', width: '100%' }}>
          <div style={{ fontWeight: 600, color: '#FFFFFF', fontSize: '0.82rem', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
            {params.value}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
            {params.data?.consumerEmail}
          </div>
        </div>
      ),
    },
    {
      headerName: 'Creator',
      field: 'creatorName',
      width: 190,
      minWidth: 180,
      cellRenderer: (params: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', justifyContent: 'center' }}>
          <div style={{ fontWeight: 600, color: '#FFFFFF', fontSize: '0.82rem' }}>{params.value}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{params.data?.creatorEmail}</div>
        </div>
      ),
    },
    {
      headerName: 'Gross Price',
      field: 'priceMicroUsd',
      width: 140,
      minWidth: 130,
      cellRenderer: MicroUsdCellRenderer,
    },
    {
      headerName: 'Creator Net',
      field: 'creatorEarningsMicroUsd',
      width: 140,
      minWidth: 130,
      cellRenderer: MicroUsdCellRenderer,
    },
    {
      headerName: 'Admin Profit (Fee)',
      field: 'platformFeeMicroUsd',
      width: 165,
      minWidth: 155,
      cellRenderer: (params: any) => (
        <span style={{ color: 'var(--brand-orange)', fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
          {formatMicroUsd(params.value)}
        </span>
      ),
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 135,
      minWidth: 125,
      cellRenderer: StatusCellRenderer,
    },
  ];

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

            {/* Sub-view A: Creators and their respective listed APIs (AG GRID) */}
            {listingSubTab === 'creators' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <DataGrid<AdminCreatorListing>
                  rowData={filteredCreators}
                  columnDefs={creatorsColumnDefs}
                  title="Creator Organizations & Authors"
                  subtitle="Registered API providers, listed endpoints count, and double-entry ledger earnings"
                  loading={loading}
                  emptyMessage={`No creators found matching "${searchQuery}".`}
                  rowHeight={58}
                  headerHeight={48}
                  exportCsv={true}
                  csvFileName="tooltoll-admin-creators"
                  height="460px"
                />

                {expandedCreatorId && (() => {
                  const creator = creators.find((c) => c.id === expandedCreatorId);
                  if (!creator) return null;
                  return (
                    <div
                      className="card-dark"
                      style={{
                        padding: '24px',
                        border: '1px solid var(--brand-orange-border)',
                        animation: 'fadeIn 0.2s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '16px',
                          flexWrap: 'wrap',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                            {creator.name} — Registered API Endpoints ({creator.tools.length})
                          </h4>
                          <p style={{ fontSize: '0.80rem', color: 'var(--text-dark-muted)', margin: '4px 0 0' }}>
                            {creator.email} • Joined {formatDate(creator.createdAt)}
                          </p>
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setExpandedCreatorId(null)}
                        >
                          <X size={14} /> Close Inspection
                        </button>
                      </div>

                      {creator.tools.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dark-muted)' }}>
                          No tools registered under this creator account yet.
                        </div>
                      ) : (
                        <div className="data-table-container">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>API Tool</th>
                                <th>Category</th>
                                <th>Route</th>
                                <th>Price</th>
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
                  );
                })()}
              </div>
            )}

            {/* Sub-view B: Consumers Data and Wallets (AG GRID) */}
            {listingSubTab === 'consumers' && (
              <DataGrid<AdminConsumerListing>
                rowData={filteredConsumers}
                columnDefs={consumersColumnDefs}
                title="Registered Consumers & Wallets"
                subtitle="Active client agents, micro-USD wallet balances, and lifetime API consumption"
                loading={loading}
                emptyMessage={`No consumers found matching "${searchQuery}".`}
                rowHeight={58}
                headerHeight={48}
                exportCsv={true}
                csvFileName="tooltoll-admin-consumers"
                height="480px"
              />
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 2) TAB: MODERATION QUEUE                                  */}
        {/* ========================================================= */}
        {activeTab === 'moderation' && (
          <DataGrid<Tool>
            rowData={pendingTools}
            columnDefs={moderationColumnDefs}
            title="API Moderation & Review Queue"
            subtitle="Verify security, rate limits, schema integrity, and approve creator APIs for marketplace publishing"
            loading={loading}
            emptyMessage="Moderation queue is clear! All creator tool submissions have been thoroughly evaluated and approved."
            rowHeight={64}
            headerHeight={48}
            exportCsv={true}
            csvFileName="tooltoll-moderation-queue"
            height="500px"
          />
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

            {/* API Call Transaction History requested by user (AG GRID) */}
            <DataGrid<AdminTransaction>
              rowData={filteredTransactions}
              columnDefs={transactionsColumnDefs}
              title="API Execution & Admin Profit Ledger"
              subtitle="Every API execution showing which tool was called and exact platform fee profit captured"
              loading={loading}
              emptyMessage="No transaction history recorded yet."
              rowHeight={58}
              headerHeight={48}
              exportCsv={true}
              csvFileName="tooltoll-platform-transactions"
              height="500px"
            />
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
