import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { formatMicroUsd } from '../../utils/formatters';
import { X, CreditCard, Sparkles, CheckCircle, AlertCircle, Zap } from 'lucide-react';

interface TopupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TopupModal: React.FC<TopupModalProps> = ({ isOpen, onClose }) => {
  const { wallet, refreshWallet, isAuthenticated, loginDemo } = useAuth();
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
      if (!isAuthenticated) {
        await loginDemo('consumer');
      }
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
      if (order.approvalUrl && order.approvalUrl.startsWith('http')) {
        window.open(order.approvalUrl, '_blank');
      } else {
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--brand-orange)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CreditCard size={16} color="#FFFFFF" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>Top Up Wallet Balance</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Current Balance Row */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-dark)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '22px',
            }}
          >
            <span style={{ fontSize: '0.86rem', color: 'var(--text-dark-secondary)' }}>Current Balance:</span>
            <span style={{ fontWeight: 800, fontSize: '1.3rem', color: '#34D399', fontFamily: 'var(--font-mono)' }}>
              {formatMicroUsd(wallet?.balance)}
            </span>
          </div>

          <label className="form-label" style={{ marginBottom: '10px' }}>Select Deposit Amount (USD)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '18px' }}>
            {[5, 10, 25, 50].map((amt) => {
              const isSelected = selectedAmount === amt && !customAmount;
              return (
                <button
                  key={amt}
                  type="button"
                  className="btn"
                  style={{
                    background: isSelected ? 'var(--brand-orange)' : 'rgba(255, 255, 255, 0.04)',
                    borderColor: isSelected ? 'var(--brand-orange)' : 'var(--border-dark)',
                    color: isSelected ? '#FFFFFF' : 'var(--text-dark-primary)',
                    fontWeight: 800,
                    borderRadius: 'var(--radius-xs)',
                    padding: '12px 6px',
                    fontSize: '1rem',
                  }}
                  onClick={() => {
                    setSelectedAmount(amt);
                    setCustomAmount('');
                  }}
                >
                  ${amt}
                </button>
              );
            })}
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
              fontSize: '0.84rem',
              color: 'var(--text-dark-secondary)',
              marginBottom: '22px',
              textAlign: 'center',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-dark)',
            }}
          >
            Credit to Ledger:{' '}
            <strong style={{ color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)' }}>
              {((currentAmount || 0) * 1_000_000).toLocaleString()} Micro-USD (µUSD)
            </strong>
          </div>

          {successMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--status-emerald-bg)',
                border: '1px solid var(--status-emerald-border)',
                color: '#34D399',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '18px',
              }}
            >
              <CheckCircle size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--status-rose-bg)',
                border: '1px solid var(--status-rose-border)',
                color: '#F87171',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '18px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isProcessing || !currentAmount || currentAmount <= 0}
              onClick={handleDevMockTopup}
              style={{ width: '100%', padding: '12px' }}
            >
              <Zap size={16} />
              {isProcessing ? 'Processing Deposit...' : `1-Click Instant Deposit ($${currentAmount || 0})`}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={isProcessing || !currentAmount || currentAmount <= 0}
              onClick={handlePayPalTopup}
              style={{ width: '100%', padding: '12px' }}
            >
              <CreditCard size={16} />
              Checkout with PayPal Sandbox
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
