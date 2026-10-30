import React, { useState, useEffect } from 'react';
import {
  Wallet as WalletIcon,
  Plus,
  ShieldCheck,
  Clock,
  History,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import { Modal } from '../components/Modal.jsx';

export const WalletPage = () => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);

  // Top Up Modal State
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('25.00');
  const [provider, setProvider] = useState('mock');
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      const [w, txs] = await Promise.all([api.getWallet(), api.getTransactions(50)]);
      setWallet(w);
      setTransactions(txs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTopUp = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setStatusMessage(null);
    try {
      const amountNum = parseFloat(topUpAmount);
      const res = await api.createPayPalOrder(amountNum, provider);

      if (provider === 'mock' || res.mode === 'mock') {
        // Auto-capture mock payment
        await api.capturePayPalOrder(res.order_id);
        setStatusMessage(`Successfully topped up $${amountNum.toFixed(2)} via Mock Payment Adapter!`);
        await loadWalletData();
        setTimeout(() => setIsTopUpOpen(false), 1500);
      } else {
        // Real PayPal Sandbox redirect
        window.open(res.approval_url, '_blank');
        setStatusMessage(`PayPal Sandbox order created (${res.order_id}). Complete approval in the PayPal window.`);
      }
    } catch (err) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-900">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Wallet & Ledger Accounting</h1>
          <p className="text-xs text-slate-400">
            Immutable PostgreSQL double-entry transaction ledger with PayPal Sandbox top-ups.
          </p>
        </div>
        <button
          onClick={() => {
            setIsTopUpOpen(true);
            setStatusMessage(null);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md shadow-emerald-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Top Up Wallet
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Available Balance */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-800/50 space-y-2 shadow-xl shadow-indigo-950/20">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-indigo-300">Available to Spend</span>
            <WalletIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">
            ${Number(wallet?.available_balance || 0).toFixed(4)}
          </div>
          <p className="text-[11px] text-slate-400">
            Funds ready for automatic agent API tool calls.
          </p>
        </div>

        {/* Reserved Funds */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Active Pre-Authorizations</span>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-amber-400 font-mono">
            ${Number(wallet?.reserved_balance || 0).toFixed(4)}
          </div>
          <p className="text-[11px] text-slate-500">
            Atomic reservation holds for currently executing tools.
          </p>
        </div>

        {/* Total Ledger Balance */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Gross Ledger Total</span>
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold text-slate-200 font-mono">
            ${Number(wallet?.balance || 0).toFixed(4)}
          </div>
          <p className="text-[11px] text-slate-500">
            Available + reserved balances on record.
          </p>
        </div>
      </div>

      {/* Ledger Transactions Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden space-y-4">
        <div className="p-6 pb-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-sm text-white">Full Ledger Transaction Audit Trail</h3>
          </div>
          <button
            onClick={loadWalletData}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No transactions recorded on your ledger yet.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Balance After</th>
                  <th className="px-6 py-3">Reference</th>
                  <th className="px-6 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {transactions.map((tx) => {
                  const isCredit = tx.type === 'credit_topup' || tx.type === 'reversal_refund' || tx.type === 'creator_earning';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-6 py-3.5">
                        <Badge
                          variant={
                            tx.type === 'credit_topup'
                              ? 'success'
                              : tx.type === 'debit_tool_call'
                              ? 'default'
                              : tx.type === 'reversal_refund'
                              ? 'warning'
                              : tx.type === 'reservation_hold'
                              ? 'cyan'
                              : 'purple'
                          }
                          className="capitalize text-[10px]"
                        >
                          {tx.type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-3.5 font-medium text-slate-200">{tx.description}</td>
                      <td className={`px-6 py-3.5 font-mono font-bold ${isCredit ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {isCredit ? '+' : '-'}${Number(tx.amount).toFixed(4)}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-400">
                        ${Number(tx.balance_after).toFixed(4)}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-[10px] text-slate-500">
                        {tx.reference_id || 'N/A'}
                      </td>
                      <td className="px-6 py-3.5 text-slate-500">
                        {new Date(tx.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Top-up Modal */}
      <Modal isOpen={isTopUpOpen} onClose={() => setIsTopUpOpen(false)} title="Top Up ToolToll Balance">
        <form onSubmit={handleCreateTopUp} className="space-y-4 text-xs">
          {statusMessage && (
            <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-800 text-indigo-300 text-xs">
              {statusMessage}
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Top-Up Amount (USD)</label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {['10.00', '25.00', '50.00', '100.00'].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTopUpAmount(amt)}
                  className={`py-2 rounded-lg border font-mono font-semibold transition cursor-pointer ${
                    topUpAmount === amt
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="5"
              max="1000"
              step="1"
              required
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 font-mono text-sm outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Payment Adapter</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider('mock')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  provider === 'mock'
                    ? 'bg-indigo-950/50 border-indigo-600 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <span className="font-bold text-xs text-indigo-300">Instant Mock Adapter</span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  Instant deposit without external PayPal sandbox credentials.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setProvider('paypal')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  provider === 'paypal'
                    ? 'bg-indigo-950/50 border-indigo-600 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <span className="font-bold text-xs text-cyan-300">PayPal Sandbox</span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  Official PayPal Orders API in Sandbox mode.
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={processing}
            className="w-full py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50 mt-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            {processing ? 'Processing Payment...' : `Deposit $${parseFloat(topUpAmount || '0').toFixed(2)} USD`}
          </button>
        </form>
      </Modal>
    </div>
  );
};
