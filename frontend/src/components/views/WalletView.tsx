import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { formatMicroUsd, formatDate } from '../../utils/formatters';
import { LedgerEntry } from '../../types';
import {
  Wallet,
  Plus,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Zap,
  Lock,
  Layers,
} from 'lucide-react';

interface WalletViewProps {
  onOpenTopup: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ onOpenTopup }) => {
  const { wallet, refreshWallet, isAuthenticated, loginDemo } = useAuth();
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await api.getTransactions();
      setTransactions(data);
    } catch (err) {
      console.error('Failed to load wallet transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

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
              Auditable double-entry accounting operating with integer micro-USD precision. Funds are atomically reserved before execution and captured upon verified completion.
            </p>
          </div>

          <button className="btn btn-primary btn-lg" onClick={onOpenTopup}>
            <Plus size={16} strokeWidth={3} />
            Add Funds to Wallet
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
                Open Top-up
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  if (!isAuthenticated) {
                    await loginDemo('consumer');
                  }
                  await api.mockTopup('10000000'); // $10
                  await refreshWallet();
                  fetchTransactions();
                }}
              >
                + Quick $10
              </button>
            </div>
          </div>
        </div>

        {/* Ledger Transactions Table */}
        <div className="card-dark" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF' }}>
                Append-Only Ledger Audit Trail
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dark-secondary)' }}>
                Immutable sequence of deposits, reservations, captures, and compensating refunds
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchTransactions}>
              Refresh Ledger
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-dark-muted)' }}>
              Loading ledger entries...
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-dark-muted)' }}>
              No transaction records yet. Fund your wallet or execute an agent workflow to populate the ledger.
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Entry Type</th>
                    <th>Reference</th>
                    <th>Amount (USD)</th>
                    <th>Running Balance</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-dark-muted)' }}>
                        {formatDate(tx.createdAt)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            tx.entryType === 'CREDIT' ? 'badge-emerald' : 'badge-rose'
                          }`}
                        >
                          {tx.entryType === 'CREDIT' ? (
                            <ArrowDownLeft size={12} />
                          ) : (
                            <ArrowUpRight size={12} />
                          )}
                          {tx.entryType}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#FFFFFF' }}>
                          {tx.referenceType}
                        </span>
                      </td>
                      <td
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          color: tx.entryType === 'CREDIT' ? '#34D399' : '#F87171',
                        }}
                      >
                        {tx.entryType === 'CREDIT' ? '+' : '-'}
                        {formatMicroUsd(tx.amount)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontWeight: 600 }}>
                        {formatMicroUsd(tx.runningBalance)}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-dark-secondary)' }}>
                        {tx.description || tx.referenceId || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
