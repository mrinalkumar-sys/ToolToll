import React, { useState, useEffect } from 'react';
import {
  Send,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Modal } from '../components/Modal.jsx';

export const CreatorEarningsPage = () => {
  const [earnings, setEarnings] = useState(null);

  // Payout Modal
  const [isPayoutOpen, setIsPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('10.00');
  const [payoutEmail, setPayoutEmail] = useState('creator@paypal.sandbox');
  const [payoutProvider, setPayoutProvider] = useState('mock');
  const [payoutProcessing, setPayoutProcessing] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState(null);

  useEffect(() => {
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
    try {
      const data = await api.getCreatorEarnings();
      setEarnings(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestPayout = async (e) => {
    e.preventDefault();
    setPayoutProcessing(true);
    setPayoutMessage(null);
    try {
      await api.requestCreatorPayout({
        amount: parseFloat(payoutAmount),
        payout_destination: payoutEmail,
        payout_provider: payoutProvider,
      });
      setPayoutMessage('Payout request successfully submitted and processed!');
      await loadEarnings();
      setTimeout(() => setIsPayoutOpen(false), 1500);
    } catch (err) {
      setPayoutMessage(`Error: ${err.message}`);
    } finally {
      setPayoutProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-900">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Creator Earnings & Payouts</h1>
          <p className="text-xs text-slate-400">
            Automated 85% revenue-sharing policy on all executed paid tool calls.
          </p>
        </div>
        <button
          onClick={() => {
            setIsPayoutOpen(true);
            setPayoutMessage(null);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/20 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          Request Payout
        </button>
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Net Payable Earnings</span>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            ${Number(earnings?.net_earnings || 0).toFixed(4)}
          </div>
          <span className="text-[11px] text-slate-500">Available to withdraw</span>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Gross Call Revenue</span>
          <div className="text-2xl font-bold text-slate-200 font-mono">
            ${Number(earnings?.gross_earnings || 0).toFixed(4)}
          </div>
          <span className="text-[11px] text-slate-500">100% total client billings</span>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Platform Fee (15%)</span>
          <div className="text-2xl font-bold text-indigo-400 font-mono">
            ${Number(earnings?.platform_fees || 0).toFixed(4)}
          </div>
          <span className="text-[11px] text-slate-500">Protocol infrastructure fee</span>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Total Paid Calls</span>
          <div className="text-2xl font-bold text-cyan-400 font-mono">
            {earnings?.total_calls || 0}
          </div>
          <span className="text-[11px] text-slate-500">Settled API calls</span>
        </div>
      </div>

      {/* Payout Policy Explainer */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Transparent Creator Payout Protocol
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          ToolToll automatically calculates and reserves creator earnings the millisecond an API call successfully passes quality and output schema checks. Payouts can be transferred directly to PayPal Sandbox or simulated via our local development adapter.
        </p>
      </div>

      {/* Request Payout Modal */}
      <Modal isOpen={isPayoutOpen} onClose={() => setIsPayoutOpen(false)} title="Request Creator Payout">
        <form onSubmit={handleRequestPayout} className="space-y-4 text-xs">
          {payoutMessage && (
            <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-800 text-indigo-300">
              {payoutMessage}
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Payout Amount (USD)</label>
            <input
              type="number"
              step="0.01"
              min="1"
              required
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 font-mono outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">PayPal Account Email</label>
            <input
              type="email"
              required
              value={payoutEmail}
              onChange={(e) => setPayoutEmail(e.target.value)}
              placeholder="creator-account@example.com"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Payout Adapter</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPayoutProvider('mock')}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                  payoutProvider === 'mock'
                    ? 'bg-indigo-950/50 border-indigo-600 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-semibold text-xs text-indigo-300">Mock Payout Adapter</div>
                <div className="text-[10px] text-slate-500">Immediate simulated settlement</div>
              </button>

              <button
                type="button"
                onClick={() => setPayoutProvider('paypal')}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                  payoutProvider === 'paypal'
                    ? 'bg-indigo-950/50 border-indigo-600 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-semibold text-xs text-cyan-300">PayPal Payouts</div>
                <div className="text-[10px] text-slate-500">Batch payouts endpoint</div>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={payoutProcessing}
            className="w-full py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 mt-2 cursor-pointer"
          >
            {payoutProcessing ? 'Transferring...' : `Confirm Withdrawal of $${parseFloat(payoutAmount || '0').toFixed(2)}`}
          </button>
        </form>
      </Modal>
    </div>
  );
};
