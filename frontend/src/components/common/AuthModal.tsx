import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Shield, Hammer, ShoppingCart, Sparkles, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, loginDemo, isLoading } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.15rem' }}>
              {tab === 'login' ? 'Sign In to ToolToll' : 'Create an Account'}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Quick 1-Click Demo Accounts */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(6, 182, 212, 0.05)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              marginBottom: '20px',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan-light)', marginBottom: '8px' }}>
              ⚡ 1-CLICK INSTANT DEMO ACCOUNTS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDemoLogin('consumer')}
                disabled={isLoading}
                style={{ flexDirection: 'column', padding: '10px 4px', gap: '4px' }}
              >
                <ShoppingCart size={16} color="var(--accent-cyan)" />
                <span style={{ fontSize: '0.75rem' }}>Consumer</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>$50 Bal</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDemoLogin('creator')}
                disabled={isLoading}
                style={{ flexDirection: 'column', padding: '10px 4px', gap: '4px' }}
              >
                <Hammer size={16} color="var(--accent-amber)" />
                <span style={{ fontSize: '0.75rem' }}>Creator</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>$25 Bal</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDemoLogin('admin')}
                disabled={isLoading}
                style={{ flexDirection: 'column', padding: '10px 4px', gap: '4px' }}
              >
                <Shield size={16} color="var(--accent-rose)" />
                <span style={{ fontSize: '0.75rem' }}>Admin</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Full Access</span>
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '16px',
            }}
          >
            <button
              type="button"
              onClick={() => setTab('login')}
              style={{
                flex: 1,
                padding: '8px',
                background: 'none',
                border: 'none',
                borderBottom: tab === 'login' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                color: tab === 'login' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              style={{
                flex: 1,
                padding: '8px',
                background: 'none',
                border: 'none',
                borderBottom: tab === 'register' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                color: tab === 'register' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Register
            </button>
          </div>

          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#fb7185',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
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
                    <option value="consumer">Consumer (Deploy agents & use APIs)</option>
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
              style={{ width: '100%', marginTop: '8px' }}
            >
              {isLoading ? 'Authenticating...' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
