import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatMicroUsd } from '../../utils/formatters';
import { RoleSelector } from './RoleSelector';
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
  Plus,
  Menu,
  X,
  ChevronRight,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      onSelectTab('marketplace');
      setMobileMenuOpen(false);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const navItems: { id: NavTab; label: string; icon: React.FC<{ size?: number }> }[] = [
    { id: 'marketplace', label: 'Marketplace', icon: Store },
    { id: 'playground', label: 'Playground', icon: Bot },
    { id: 'agents', label: 'My Agents', icon: Bot },
    { id: 'creator', label: 'Creator Studio', icon: Hammer },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'ai', label: 'AI Service', icon: Brain },
  ];

  if (user?.isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin', icon: Shield });
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(9, 10, 14, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-dark)',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        className="container-editorial"
        style={{
          height: '74px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        {/* Brand Logo - Inspired by Editorial Wordmarks */}
        <div
          onClick={() => handleTabClick('marketplace')}
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
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--brand-orange)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-orange)',
              transition: 'transform 0.2s ease',
            }}
          >
            <Sparkles size={19} color="#FFFFFF" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: '1.35rem',
                  letterSpacing: '-0.04em',
                  color: '#FFFFFF',
                  textTransform: 'uppercase',
                }}
              >
                TOOLTOLL
              </span>
              <span
                className="badge badge-orange"
                style={{ fontSize: '0.62rem', padding: '1px 6px', fontWeight: 800 }}
              >
                PRO
              </span>
            </div>
            <div
              className="brand-subtitle"
              style={{
                fontSize: '0.66rem',
                color: 'var(--text-dark-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Machine Economy Gateway
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '2px',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-dark)',
          }}
          className="desktop-nav"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                className="btn btn-sm"
                style={{
                  background: isActive ? 'rgba(255, 255, 255, 0.09)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--text-dark-secondary)',
                  border: isActive ? '1px solid var(--border-dark-hover)' : '1px solid transparent',
                  fontWeight: isActive ? 700 : 500,
                  position: 'relative',
                }}
                onClick={() => handleTabClick(item.id)}
              >
                <Icon size={14} />
                {item.label}
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-5px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '16px',
                      height: '2px',
                      backgroundColor: 'var(--brand-orange)',
                      borderRadius: '2px',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Section: Wallet, Role & Auth Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
        >
          {isAuthenticated ? (
            <>
              {/* Wallet Pill - Monospace Micro-USD with Emerald Indicator */}
              <div
                className="desktop-wallet-pill"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-dark)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 6px 4px 10px',
                  gap: '8px',
                  flexShrink: 0,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.62rem',
                      color: 'var(--text-dark-muted)',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--status-emerald)',
                        boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
                      }}
                    />
                    Micro Balance
                  </div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      color: '#FFFFFF',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {formatMicroUsd(wallet?.balance)}
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-sm"
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    borderRadius: 'var(--radius-xs)',
                  }}
                  onClick={onOpenTopup}
                  title="Add Micro-USD to wallet"
                >
                  <Plus size={12} strokeWidth={3} />
                  Top Up
                </button>
              </div>

              {/* Custom Dark Navy Role Selector Dropdown with Integrated Logout Option */}
              <div className="role-selector-wrapper" style={{ flexShrink: 0 }}>
                <RoleSelector
                  activeRole={activeRole}
                  onSelectRole={(newRole) => {
                    setActiveRole(newRole);
                    if (newRole === 'creator') onSelectTab('creator');
                    else if (newRole === 'admin') onSelectTab('admin');
                    else onSelectTab('marketplace');
                  }}
                  isAdmin={Boolean(user?.isAdmin)}
                  onLogout={handleLogout}
                  isLoggingOut={isLoggingOut}
                />
              </div>
            </>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 700, padding: '9px 18px', flexShrink: 0 }}
              onClick={onOpenAuth}
            >
              <LogIn size={15} />
              Sign In / Demo
            </button>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            className="btn btn-secondary btn-sm mobile-menu-btn"
            style={{ padding: '8px', flexShrink: 0 }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div
          style={{
            borderTop: '1px solid var(--border-dark)',
            backgroundColor: 'var(--bg-dark-surface)',
            padding: '16px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                className="btn"
                style={{
                  justifyContent: 'space-between',
                  background: isActive ? 'var(--brand-orange-subtle)' : 'transparent',
                  color: isActive ? 'var(--brand-orange)' : 'var(--text-dark-primary)',
                  border: isActive ? '1px solid var(--brand-orange-border)' : '1px solid transparent',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                }}
                onClick={() => handleTabClick(item.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>
                <ChevronRight size={16} />
              </button>
            );
          })}

          {isAuthenticated && (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-dark)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>{user?.name}</div>
                </div>
                <span className="badge badge-orange">{activeRole.toUpperCase()}</span>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Active Role
                </div>
                <RoleSelector
                  activeRole={activeRole}
                  onSelectRole={(newRole) => {
                    setActiveRole(newRole);
                    if (newRole === 'creator') onSelectTab('creator');
                    else if (newRole === 'admin') onSelectTab('admin');
                    else onSelectTab('marketplace');
                    setMobileMenuOpen(false);
                  }}
                  isAdmin={Boolean(user?.isAdmin)}
                  onLogout={handleLogout}
                  isLoggingOut={isLoggingOut}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inline styles for media query handling */}
      <style>{`
        @media (min-width: 1100px) {
          .desktop-nav { display: flex !important; }
          .mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 1099px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: inline-flex !important; }
        }
        @media (max-width: 600px) {
          .desktop-wallet-pill { display: none !important; }
        }
        .btn-logout-prominent {
          display: inline-flex !important;
        }
      `}</style>
    </header>
  );
};
