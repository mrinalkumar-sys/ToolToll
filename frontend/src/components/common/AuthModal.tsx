import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Shield, Hammer, ShoppingCart, Sparkles, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialTab = 'login' }) => {
  const { login, register, loginDemo, isLoading } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);

  React.useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setError(null);
    }
  }, [isOpen, initialTab]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'consumer' | 'creator'>('consumer');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name, role);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check credentials.');
    }
  };

  const handleDemoLogin = async (roleType: 'admin' | 'creator' | 'consumer') => {
    setError(null);
    try {
      await loginDemo(roleType);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Demo login failed');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
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
              <Sparkles size={16} color="#FFFFFF" strokeWidth={2.5} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
              {tab === 'login' ? 'Sign In to ToolToll' : 'Create Machine Account'}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Quick 1-Click Demo Accounts */}
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 85, 0, 0.05)',
              border: '1px solid var(--brand-orange-border)',
              marginBottom: '22px',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-orange)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              ⚡ 1-CLICK INSTANT DEMO ROLES
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDemoLogin('consumer')}
                disabled={isLoading}
                style={{ flexDirection: 'column', padding: '12px 6px', gap: '6px' }}
              >
                <ShoppingCart size={18} color="var(--brand-orange)" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF' }}>Consumer</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dark-muted)' }}>Agent Owner</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDemoLogin('creator')}
                disabled={isLoading}
                style={{ flexDirection: 'column', padding: '12px 6px', gap: '6px' }}
              >
                <Hammer size={18} color="#FBBF24" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF' }}>Creator</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dark-muted)' }}>API Dev</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDemoLogin('admin')}
                disabled={isLoading}
                style={{ flexDirection: 'column', padding: '12px 6px', gap: '6px' }}
              >
                <Shield size={18} color="#34D399" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF' }}>Admin</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dark-muted)' }}>Full Access</span>
              </button>
            </div>
          </div>

          {/* Form Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-dark)',
              marginBottom: '20px',
            }}
          >
            <button
              type="button"
              onClick={() => setTab('login')}
              style={{
                flex: 1,
                padding: '10px',
                background: 'none',
                border: 'none',
                borderBottom: tab === 'login' ? '2px solid var(--brand-orange)' : '2px solid transparent',
                color: tab === 'login' ? '#FFFFFF' : 'var(--text-dark-muted)',
                fontWeight: tab === 'login' ? 800 : 600,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              style={{
                flex: 1,
                padding: '10px',
                background: 'none',
                border: 'none',
                borderBottom: tab === 'register' ? '2px solid var(--brand-orange)' : '2px solid transparent',
                color: tab === 'register' ? '#FFFFFF' : 'var(--text-dark-muted)',
                fontWeight: tab === 'register' ? 800 : 600,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--status-rose-bg)',
                border: '1px solid var(--status-rose-border)',
                color: '#F87171',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '18px',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {tab === 'register' && (
              <>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alice Developer"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Primary Account Purpose</label>
                  <select
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                  >
                    <option value="consumer">Consumer (Deploy agents & invoke APIs)</option>
                    <option value="creator">Creator (Register & monetize APIs)</option>
                  </select>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ width: '100%', marginTop: '10px', padding: '12px' }}
            >
              {isLoading ? 'Authenticating...' : tab === 'login' ? 'Sign In to Dashboard' : 'Complete Registration'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
