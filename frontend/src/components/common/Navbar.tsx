import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatMicroUsd } from '../../utils/formatters';
import {
  Sparkles,
  Bot,
  Store,
  Wallet,
  Shield,
  Hammer,
  Brain,
  LogIn,
  LogOut,
  PlusCircle,
} from 'lucide-react';

export type NavTab =
  | 'marketplace'
  | 'playground'
  | 'agents'
  | 'creator'
  | 'wallet'
  | 'admin'
  | 'ai';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAuth: () => void;
  onOpenTopup: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuth,
  onOpenTopup,
}) => {
  const { user, wallet, isAuthenticated, logout, activeRole, setActiveRole } = useAuth();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(6, 9, 19, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '0 24px',
          height: '70px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
        }}
      >
        {/* Brand Logo */}
        <div
          onClick={() => onSelectTab('marketplace')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <Sparkles size={20} color="#050a17" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '1.25rem',
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(to right, #ffffff, #94a3b8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                ToolToll
              </span>
              <span className="badge badge-cyan" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>
                MVP
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              API Marketplace for AI Agents
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '4px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            className="btn btn-sm"
            style={{
              background: currentTab === 'marketplace' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: currentTab === 'marketplace' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
            }}
            onClick={() => onSelectTab('marketplace')}
          >
            <Store size={15} />
            Marketplace
          </button>

          <button
            className="btn btn-sm"
            style={{
              background: currentTab === 'playground' ? 'var(--accent-purple-glow)' : 'transparent',
              color: currentTab === 'playground' ? 'var(--accent-purple-light)' : 'var(--text-secondary)',
              border: currentTab === 'playground' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
            }}
            onClick={() => onSelectTab('playground')}
          >
            <Bot size={15} />
            Playground
          </button>

          <button
            className="btn btn-sm"
            style={{
              background: currentTab === 'agents' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: currentTab === 'agents' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
            }}
            onClick={() => onSelectTab('agents')}
          >
            <Bot size={15} />
            My Agents
          </button>

          <button
            className="btn btn-sm"
            style={{
              background: currentTab === 'creator' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: currentTab === 'creator' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
            }}
            onClick={() => onSelectTab('creator')}
          >
            <Hammer size={15} />
            Creator Studio
          </button>

          <button
            className="btn btn-sm"
            style={{
              background: currentTab === 'wallet' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: currentTab === 'wallet' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
            }}
            onClick={() => onSelectTab('wallet')}
          >
            <Wallet size={15} />
            Wallet
          </button>

          {user?.isAdmin && (
            <button
              className="btn btn-sm"
              style={{
                background: currentTab === 'admin' ? 'rgba(244, 63, 94, 0.15)' : 'transparent',
                color: currentTab === 'admin' ? '#fb7185' : 'var(--text-secondary)',
                border: currentTab === 'admin' ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid transparent',
              }}
              onClick={() => onSelectTab('admin')}
            >
              <Shield size={15} />
              Admin
            </button>
          )}

          <button
            className="btn btn-sm"
            style={{
              background: currentTab === 'ai' ? 'var(--accent-cyan-glow)' : 'transparent',
              color: currentTab === 'ai' ? 'var(--accent-cyan-light)' : 'var(--text-secondary)',
              border: currentTab === 'ai' ? '1px solid var(--border-accent)' : '1px solid transparent',
            }}
            onClick={() => onSelectTab('ai')}
          >
            <Brain size={15} />
            AI Service
          </button>
        </nav>

        {/* Right Actions: Wallet & User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {isAuthenticated ? (
            <>
              {/* Wallet Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '4px 6px 4px 12px',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Balance
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                    {formatMicroUsd(wallet?.balance)}
                  </div>
                </div>
                <button
                  className="btn btn-success btn-sm"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={onOpenTopup}
                  title="Add funds to wallet"
                >
                  <PlusCircle size={14} />
                  Top-up
                </button>
              </div>

              {/* Role Badge Switcher */}
              <select
                className="form-select"
                style={{
                  padding: '6px 10px',
                  fontSize: '0.8rem',
                  width: 'auto',
                  background: 'rgba(255, 255, 255, 0.04)',
                }}
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value as any)}
              >
                <option value="consumer">Role: Consumer</option>
                <option value="creator">Role: Creator</option>
                {user?.isAdmin && <option value="admin">Role: Admin</option>}
              </select>

              {/* User Dropdown / Logout */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{user?.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={logout}
                  title="Sign out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={onOpenAuth}>
              <LogIn size={15} />
              Sign In / Demo
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
