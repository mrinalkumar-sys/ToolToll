import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Lock, Sparkles, LogIn, ShoppingCart, Hammer, Shield } from 'lucide-react';

interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onCreateAccount: () => void;
  actionTitle?: string;
}

export const AuthPromptModal: React.FC<AuthPromptModalProps> = ({
  isOpen,
  onClose,
  onSignIn,
  onCreateAccount,
  actionTitle,
}) => {
  const { loginDemo, isLoading } = useAuth();

  if (!isOpen) return null;

  const handleDemo = async (role: 'consumer' | 'creator' | 'admin') => {
    try {
      await loginDemo(role);
      onClose();
    } catch (err: any) {
      console.error('Demo login failed:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '460px',
          background: '#0d0f15',
          border: '1px solid rgba(255, 85, 0, 0.35)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.8), 0 0 24px rgba(255, 85, 0, 0.15)',
          padding: '28px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-xs)',
                background: 'rgba(255, 85, 0, 0.12)',
                border: '1px solid var(--brand-orange)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(255, 85, 0, 0.3)',
              }}
            >
              <Lock size={20} color="var(--brand-orange)" strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em', margin: 0 }}>
                Sign in to continue
              </h3>
              {actionTitle && (
                <div style={{ fontSize: '0.72rem', color: 'var(--brand-orange)', fontWeight: 700, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Action: {actionTitle}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dark-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
            aria-label="Close authentication modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Description */}
        <p style={{ color: 'var(--text-dark-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '22px' }}>
          Create an account or sign in to run AI services and execute tools.
        </p>

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
          <button
            className="btn btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '12px',
              fontWeight: 800,
              fontSize: '0.92rem',
            }}
            onClick={onSignIn}
          >
            <LogIn size={16} />
            Sign In
          </button>

          <button
            className="btn btn-secondary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '12px',
              fontWeight: 700,
              fontSize: '0.92rem',
              borderColor: 'rgba(255, 255, 255, 0.18)',
              color: '#FFFFFF',
            }}
            onClick={onCreateAccount}
          >
            <Sparkles size={16} color="var(--brand-orange)" />
            Create Account
          </button>
        </div>

        {/* 1-Click Instant Demo Roles */}
        <div
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-xs)',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-dark)',
          }}
        >
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: 'var(--text-dark-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '10px',
              textAlign: 'center',
            }}
          >
            Or Continue Instantly with 1-Click Demo
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleDemo('consumer')}
              disabled={isLoading}
              style={{ padding: '8px 4px', fontSize: '0.74rem', justifyContent: 'center' }}
            >
              <ShoppingCart size={13} color="#10B981" />
              Consumer
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleDemo('creator')}
              disabled={isLoading}
              style={{ padding: '8px 4px', fontSize: '0.74rem', justifyContent: 'center' }}
            >
              <Hammer size={13} color="var(--brand-orange)" />
              Creator
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleDemo('admin')}
              disabled={isLoading}
              style={{ padding: '8px 4px', fontSize: '0.74rem', justifyContent: 'center' }}
            >
              <Shield size={13} color="#38BDF8" />
              Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
