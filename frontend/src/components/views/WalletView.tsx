import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { formatMicroUsd } from '../../utils/formatters';
import { LedgerEntry, ToolCall } from '../../types';
import {
  DataGrid,
  ColDef,
  StatusCellRenderer,
  MicroUsdCellRenderer,
  DateCellRenderer,
} from '../common/DataGrid';
import {
  Plus,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet,
  Activity,
  History,
} from 'lucide-react';

interface WalletViewProps {
  onOpenTopup: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ onOpenTopup }) => {
  const { wallet, refreshWallet, isAuthenticated, loginDemo } = useAuth();
  const [activeTab, setActiveTab] = useState<'ledger' | 'calls'>('ledger');
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [calls, setCalls] = useState<ToolCall[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      const data = await api.getTransactions();
      setTransactions(data);
    } catch (err) {
      console.error('Failed to load wallet transactions:', err);
    }
  };

  const fetchCalls = async () => {
    try {
      const callsData = await api.getUserCalls();
      setCalls(callsData || []);
    } catch (err) {
      console.error('Failed to load user calls:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchTransactions(), fetchCalls()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [wallet?.balance]);

  // Handle PayPal return redirects (from popup or direct redirect)
  useEffect(() => {
    const search = window.location.search;
    if (!search) return;
    const params = new URLSearchParams(search);
    const status = params.get('status');
    const token = params.get('token');

    if (status === 'paypal_success' && token) {
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'PAYPAL_ORDER_APPROVED', orderId: token }, '*');
          window.close();
          return;
        } catch {
          // Fall through to capture locally if cross-window postMessage fails
        }
      }

      api.capturePaypalOrder(token)
        .then(() => refreshWallet())
        .catch((err) => console.error('Auto-capture error from return URL:', err))
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, []);

  // AG Grid column definitions for Double-Entry Ledger
  const ledgerColumnDefs: ColDef<LedgerEntry>[] = [
    {
      headerName: 'Timestamp',
      field: 'createdAt',
      cellRenderer: DateCellRenderer,
      sort: 'desc',
      width: 175,
      minWidth: 165,
      filter: 'agDateColumnFilter',
    },
    {
      headerName: 'Entry Type',
      field: 'entryType',
      cellRenderer: (params: any) => {
        const isCredit = params.value === 'CREDIT';
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              background: isCredit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: isCredit ? '#10B981' : '#EF4444',
              border: `1px solid ${isCredit ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            {isCredit ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
            {params.value}
          </span>
        );
      },
      width: 140,
      minWidth: 130,
    },
    {
      headerName: 'Reference Type',
      field: 'referenceType',
      width: 165,
      minWidth: 150,
      cellRenderer: (params: any) => (
        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#FFFFFF' }}>
          {params.value || '—'}
        </span>
      ),
    },
    {
      headerName: 'Amount',
      field: 'amount',
      width: 150,
      minWidth: 140,
      cellRenderer: (params: any) => {
        const isCredit = params.data?.entryType === 'CREDIT';
        return (
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 800,
              color: isCredit ? '#34D399' : '#F87171',
            }}
          >
            {isCredit ? '+' : '-'}
            {formatMicroUsd(params.value)}
          </span>
        );
      },
    },
    {
      headerName: 'Running Balance',
      field: 'runningBalance',
      width: 165,
      minWidth: 155,
      cellRenderer: MicroUsdCellRenderer,
    },
    {
      headerName: 'Description / Audit Note',
      field: 'description',
      flex: 1.6,
      minWidth: 260,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (params: any) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-dark-secondary)', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: 1.35, display: 'block', padding: '6px 0' }}>
          {params.value || params.data?.referenceId || '—'}
        </span>
      ),
    },
  ];

  // AG Grid column definitions for Consumer API Executions
  const callsColumnDefs: ColDef<ToolCall>[] = [
    {
      headerName: 'Timestamp',
      field: 'createdAt',
      cellRenderer: DateCellRenderer,
      sort: 'desc',
      width: 175,
      minWidth: 165,
    },
    {
      headerName: 'API / Tool',
      field: 'tool.name' as any,
      valueGetter: (params: any) => params.data?.tool?.name || params.data?.toolId || 'Unknown Tool',
      flex: 1.5,
      minWidth: 220,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (params: any) => (
        <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.84rem', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: 1.35, display: 'block', padding: '6px 0' }}>
          {params.value}
        </span>
      ),
    },
    {
      headerName: 'Agent Caller',
      field: 'agent.name' as any,
      valueGetter: (params: any) => params.data?.agent?.name || params.data?.agentId || 'Direct Invocation',
      width: 190,
      minWidth: 175,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (params: any) => (
        <span style={{ fontSize: '0.82rem', color: '#E2E8F0', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: 1.35, display: 'block', padding: '6px 0' }}>
          {params.value}
        </span>
      ),
    },
    {
      headerName: 'Status',
      field: 'status',
      cellRenderer: StatusCellRenderer,
      width: 135,
      minWidth: 125,
    },
    {
      headerName: 'HTTP Code',
      field: 'httpStatus',
      width: 115,
      minWidth: 105,
      cellRenderer: (params: any) => {
        const code = params.value;
        if (!code) return <span style={{ color: 'var(--text-dark-muted)' }}>—</span>;
        const is2xx = code >= 200 && code < 300;
        return (
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              fontSize: '0.80rem',
              color: is2xx ? '#34D399' : '#EF4444',
            }}
          >
            {code}
          </span>
        );
      },
    },
    {
      headerName: 'Latency',
      field: 'latencyMs',
      width: 115,
      minWidth: 105,
      cellRenderer: (params: any) =>
        params.value != null ? (
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.82rem', color: '#FFFFFF' }}>
            {params.value}ms
          </span>
        ) : (
          '—'
        ),
    },
    {
      headerName: 'Cost',
      field: 'priceMicroUsd',
      width: 140,
      minWidth: 130,
      cellRenderer: MicroUsdCellRenderer,
    },
    {
      headerName: 'Call ID',
      field: 'id',
      width: 150,
      minWidth: 140,
      cellRenderer: (params: any) => (
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.74rem',
            color: 'var(--text-dark-muted)',
          }}
        >
          {params.value?.slice(0, 10)}...
        </span>
      ),
    },
  ];

  return (
    <div className="section-dark" style={{ minHeight: '85vh', paddingTop: '40px', paddingBottom: '60px' }}>
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
            <span className="section-kicker">Double-Entry Financial Accounting</span>
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
              Wallet & Ledger Records.
            </h1>
            <p style={{ color: 'var(--text-dark-secondary)', maxWidth: '720px', fontSize: '1.02rem', lineHeight: 1.6 }}>
              Auditable double-entry accounting operating with integer micro-USD precision. Funds are atomically reserved before execution and captured upon verified completion. Powered by AG Grid interactive tabular analysis.
            </p>
          </div>

          <button className="btn btn-primary btn-lg" onClick={onOpenTopup}>
            <CreditCard size={18} strokeWidth={2.5} />
            PayPal Sandbox Top-Up
          </button>
        </div>

        {/* Balance Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '20px',
            marginBottom: '36px',
          }}
        >
          <div className="card-dark highlight-orange" style={{ padding: '26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Available Balance
              </span>
              <span className="badge badge-emerald">Ready For Calls</span>
            </div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#34D399', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
              {formatMicroUsd(wallet?.balance)}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)' }}>
              Integer precision: {Number(wallet?.balance || 0).toLocaleString()} µUSD
            </div>
          </div>

          <div className="card-dark" style={{ padding: '26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                In-Flight Mutex Reserved
              </span>
              <span className="badge badge-amber">Locked in Execution</span>
            </div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--status-amber)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
              {formatMicroUsd(wallet?.reservedBalance || 0)}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)' }}>
              Prevents concurrent agent overdraws
            </div>
          </div>

          <div className="card-dark" style={{ padding: '26px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
                Instant Funding Rails
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-dark-secondary)', lineHeight: 1.5 }}>
                Top up immediately using our simulated developer quick-deposit or PayPal Sandbox.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn btn-outline-orange btn-sm" style={{ flex: 1 }} onClick={onOpenTopup}>
                <CreditCard size={14} />
                PayPal Sandbox Checkout
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  if (!isAuthenticated) {
                    await loginDemo('consumer');
                  }
                  await api.mockTopup('10000000'); // $10
                  await refreshWallet();
                  loadData();
                }}
              >
                + Quick $10
              </button>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '12px',
          }}
        >
          <button
            onClick={() => setActiveTab('ledger')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'ledger' ? '1px solid var(--accent-orange, #FF5500)' : '1px solid transparent',
              background: activeTab === 'ledger' ? 'rgba(255, 85, 0, 0.12)' : 'transparent',
              color: activeTab === 'ledger' ? '#FFFFFF' : 'var(--text-dark-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <History size={16} color={activeTab === 'ledger' ? '#FF5500' : 'currentColor'} />
            Ledger Audit Trail ({transactions.length})
          </button>

          <button
            onClick={() => setActiveTab('calls')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'calls' ? '1px solid var(--accent-orange, #FF5500)' : '1px solid transparent',
              background: activeTab === 'calls' ? 'rgba(255, 85, 0, 0.12)' : 'transparent',
              color: activeTab === 'calls' ? '#FFFFFF' : 'var(--text-dark-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Activity size={16} color={activeTab === 'calls' ? '#FF5500' : 'currentColor'} />
            Recent API Executions ({calls.length})
          </button>

          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-secondary btn-sm" onClick={loadData}>
              Refresh Data
            </button>
          </div>
        </div>

        {/* AG Grid Displays */}
        {activeTab === 'ledger' ? (
          <DataGrid<LedgerEntry>
            rowData={transactions}
            columnDefs={ledgerColumnDefs}
            title="Append-Only Ledger Audit Trail"
            subtitle="Immutable sequence of deposits, reservations, captures, and compensating refunds"
            loading={loading}
            emptyMessage="No ledger records yet. Fund your wallet or execute an agent workflow to populate the ledger."
            pageSize={10}
            rowHeight={58}
            headerHeight={48}
            exportCsv={true}
            csvFileName="tooltoll-wallet-ledger"
            height="520px"
          />
        ) : (
          <DataGrid<ToolCall>
            rowData={calls}
            columnDefs={callsColumnDefs}
            title="Consumer API Executions"
            subtitle="Real-time log of paid tool invocations, execution latencies, and transaction statuses"
            loading={loading}
            emptyMessage="No tool calls recorded yet. Execute an API via the Marketplace or AI Planner."
            pageSize={10}
            rowHeight={58}
            headerHeight={48}
            exportCsv={true}
            csvFileName="tooltoll-api-calls"
            height="520px"
          />
        )}
      </div>
    </div>
  );
};
