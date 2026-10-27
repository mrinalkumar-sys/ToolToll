import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { formatMicroUsd } from '../../utils/formatters';
import { X, CreditCard, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

interface TopupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TopupModal: React.FC<TopupModalProps> = ({ isOpen, onClose }) => {
  const { wallet, refreshWallet } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState<number>(10); // USD
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentAmount = customAmount ? parseFloat(customAmount) : selectedAmount;
  const currentMicroUsd = Math.round((currentAmount || 0) * 1_000_000).toString();

  const handleDevMockTopup = async () => {
    if (!currentAmount || currentAmount <= 0) return;
    setIsProcessing(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await api.mockTopup(currentMicroUsd);
      await refreshWallet();
      setSuccessMessage(`Successfully credited $${currentAmount.toFixed(2)} to your wallet!`);
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Top-up failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayPalTopup = async () => {
    if (!currentAmount || currentAmount <= 0) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const order = await api.createPaypalOrder(currentAmount.toFixed(2));
      // In mock/sandbox mode, capture directly or redirect to PayPal approval
      if (order.approvalUrl && order.approvalUrl.startsWith('http')) {
        window.open(order.approvalUrl, '_blank');
      } else {
        // Mock capture directly
        await api.capturePaypalOrder(order.orderId);
        await refreshWallet();
        setSuccessMessage(`PayPal Mock Order ${order.orderId} captured and credited!`);
        setTimeout(() => {
          onClose();
          setSuccessMessage(null);
        }, 1500);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'PayPal order creation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} color="var(--accent-emerald)" />
            <h3 style={{ fontSize: '1.15rem' }}>Top-up Wallet Balance</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Current Balance:</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#34d399', fontFamily: 'var(--font-mono)' }}>
              {formatMicroUsd(wallet?.balance)}
            </span>
          </div>

          <label className="form-label" style={{ marginBottom: '8px' }}>Select Amount (USD)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {[5, 10, 25, 50].map((amt) => (
              <button
                key={amt}
                type="button"
                className="btn"
                style={{
                  background:
                    selectedAmount === amt && !customAmount
                      ? 'var(--accent-cyan-glow)'
                      : 'rgba(255, 255, 255, 0.04)',
                  borderColor:
                    selectedAmount === amt && !customAmount
                      ? 'var(--accent-cyan)'
                      : 'var(--border-subtle)',
                  color: selectedAmount === amt && !customAmount ? 'var(--accent-cyan-light)' : 'var(--text-primary)',
                  fontWeight: 700,
                }}
                onClick={() => {
                  setSelectedAmount(amt);
                  setCustomAmount('');
                }}
              >
                ${amt}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">Or Custom Amount ($)</label>
            <input
              type="number"
              min="1"
              max="1000"
              step="1"
              className="form-input"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="e.g. 100"
            />
          </div>

          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            Credit: <strong style={{ color: 'var(--text-primary)' }}>{(currentAmount || 0) * 1_000_000} Micro-USD (µUSD)</strong>
          </div>

          {successMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <CheckCircle size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#fb7185',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isProcessing || !currentAmount || currentAmount <= 0}
              onClick={handleDevMockTopup}
              style={{ width: '100%' }}
            >
              <Sparkles size={16} />
              {isProcessing ? 'Processing...' : `1-Click Dev Instant Top-up ($${currentAmount || 0})`}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={isProcessing || !currentAmount || currentAmount <= 0}
              onClick={handlePayPalTopup}
              style={{ width: '100%', borderColor: '#0070ba', color: '#38bdf8' }}
            >
              <CreditCard size={16} />
              Pay with PayPal Sandbox
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
