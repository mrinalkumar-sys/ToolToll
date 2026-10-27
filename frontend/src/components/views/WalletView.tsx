import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { formatMicroUsd, formatDate } from '../../utils/formatters';
import { LedgerEntry } from '../../types';
import {
  Wallet,
  PlusCircle,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';

interface WalletViewProps {
  onOpenTopup: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ onOpenTopup }) => {
  const { wallet, refreshWallet } = useAuth();
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
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <div className="badge badge-emerald" style={{ marginBottom: '8px' }}>
            <Wallet size={13} />
            Double-Entry Ledger & Balances
          </div>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>Wallet & Financial Ledger</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '750px' }}>
            Auditable double-entry accounting with integer micro-USD precision. Funds are atomically reserved before execution and captured only upon verified quality completion, with instant compensating reversals.
          </p>
        </div>

        <button className="btn btn-primary" onClick={onOpenTopup}>
          <PlusCircle size={16} />
          Add Funds
        </button>
      </div>

      {/* Balance Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        <div className="glass-panel glow-cyan" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Available Balance</span>
            <span className="badge badge-emerald">Ready for calls</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
            {formatMicroUsd(wallet?.balance)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Integer precision: {Number(wallet?.balance || 0).toLocaleString()} µUSD
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>In-Flight Reserved</span>
            <span className="badge badge-amber">Locked in execution</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
            {formatMicroUsd(wallet?.reservedBalance || 0)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Safeguards against concurrent overspending
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Instant Funding Options
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Add credits immediately using our simulated 1-click developer top-up or PayPal Sandbox.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button className="btn btn-outline-cyan btn-sm" style={{ flex: 1 }} onClick={onOpenTopup}>
              <CreditCard size={14} />
              Open Top-up
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
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
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>Append-Only Ledger Transactions</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Complete immutable record of all deposits, call reservations, captures, and reversals.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchTransactions}>
            Refresh Ledger
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            Loading ledger entries...
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
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
                  <th>Audit Reference</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
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
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {tx.referenceType}
                      </span>
                    </td>
                    <td
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: tx.entryType === 'CREDIT' ? '#34d399' : '#fb7185',
                      }}
                    >
                      {tx.entryType === 'CREDIT' ? '+' : '-'}
                      {formatMicroUsd(tx.amount)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {formatMicroUsd(tx.runningBalance)}
                    </td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {tx.referenceId ? `${tx.referenceId.slice(0, 16)}...` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
