import { UserRole } from '../../types';
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
  onOpenAuth: (tab?: 'login' | 'register') => void;
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

  // Detect currently authenticated user's actual role from the session
  const actualRole: UserRole = user?.isAdmin
    ? 'admin'
    : ((user as any)?.role
        ? String((user as any).role).toLowerCase() === 'creator'
        : user?.isCreator)
    ? 'creator'
    : 'consumer';

  const isActualCreator = actualRole === 'creator';

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

  // Derive navigation strictly from authenticated user state and active role
  const navItems: { id: NavTab; label: string; icon: React.FC<{ size?: number }> }[] = [];

  if (!isAuthenticated) {
    // A. Guest / Logged-Out User: show only Marketplace, Playground, AI Service
    navItems.push(
      { id: 'marketplace', label: 'Marketplace', icon: Store },
      { id: 'playground', label: 'Playground', icon: Bot },
      { id: 'ai', label: 'AI Service', icon: Brain }
    );
  } else if (actualRole === 'creator') {
    // C. Creator Navigation: show Marketplace, Playground, Creator Studio, AI Service
    navItems.push(
      { id: 'marketplace', label: 'Marketplace', icon: Store },
      { id: 'playground', label: 'Playground', icon: Bot },
      { id: 'creator', label: 'Creator Studio', icon: Hammer },
      { id: 'ai', label: 'AI Service', icon: Brain }
    );
  } else if (actualRole === 'admin') {
    // D. Admin Navigation: full platform oversight and management controls
    navItems.push(
      { id: 'marketplace', label: 'Marketplace', icon: Store },
      { id: 'playground', label: 'Playground', icon: Bot },
      { id: 'agents', label: 'My Agents', icon: Bot },
      { id: 'creator', label: 'Creator Studio', icon: Hammer },
      { id: 'wallet', label: 'Wallet', icon: Wallet },
      { id: 'ai', label: 'AI Service', icon: Brain },
      { id: 'admin', label: 'Admin', icon: Shield }
    );
  } else {
    // B. Consumer Navigation: show Marketplace, Playground, My Agents, Wallet, AI Service
    navItems.push(
      { id: 'marketplace', label: 'Marketplace', icon: Store },
      { id: 'playground', label: 'Playground', icon: Bot },
      { id: 'agents', label: 'My Agents', icon: Bot },
      { id: 'wallet', label: 'Wallet', icon: Wallet },
      { id: 'ai', label: 'AI Service', icon: Brain }
    );
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(9, 10, 14, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-dark)',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        className="navbar-main-container"
        style={{
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '0 24px',
          gap: '16px',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* ========================================================= */}
        {/* 1. LEFT SECTION: ToolToll Brand Logo                       */}
        {/* ========================================================= */}
        <div
          className="navbar-brand-section"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            flex: isActualCreator ? '1 0 200px' : undefined,
            justifyContent: 'flex-start',
          }}
        >
          <div
            onClick={() => handleTabClick('marketplace')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--brand-orange)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-orange)',
                transition: 'transform 0.2s ease',
                flexShrink: 0,
              }}
            >
              <Sparkles size={18} color="#FFFFFF" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: '1.28rem',
                    letterSpacing: '-0.03em',
                    color: '#FFFFFF',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                  }}
                >
                  TOOLTOLL
                </span>
                <span
                  className="badge badge-orange"
                  style={{ fontSize: '0.60rem', padding: '1px 5px', fontWeight: 800, lineHeight: 1.2 }}
                >
                  PRO
                </span>
              </div>
              <div
                className="brand-subtitle"
                style={{
                  fontSize: '0.62rem',
                  color: 'var(--text-dark-muted)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginTop: '3px',
                  lineHeight: 1,
                }}
              >
                Machine Economy Gateway
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. CENTER SECTION: Flexible Navigation Menu               */}
        {/* ========================================================= */}
        <div
          className="navbar-nav-section"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: isActualCreator ? '0 1 680px' : '1 1 auto',
            width: isActualCreator ? '100%' : 'auto',
            maxWidth: isActualCreator ? '680px' : 'none',
            minWidth: 0,
            padding: '0 4px',
          }}
        >
          <nav
            className="navbar-nav-pill"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isActualCreator ? 'stretch' : 'center',
              gap: isActualCreator ? '8px' : (navItems.length <= 3 ? '6px' : '4px'),
              background: 'rgba(255, 255, 255, 0.03)',
              padding: isActualCreator ? '5px 8px' : '4px 6px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-dark)',
              width: '100%',
              maxWidth: isActualCreator ? '680px' : 'max-content',
              boxShadow: '0 2px 14px rgba(0, 0, 0, 0.25)',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              boxSizing: 'border-box',
            }}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  className="btn btn-sm nav-tab-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: isActualCreator ? '8px' : '7px',
                    flex: isActualCreator ? '1 1 0' : '0 0 auto',
                    minWidth: 0,
                    padding: isActualCreator
                      ? '8px 16px'
                      : (navItems.length <= 3
                        ? '7px 16px'
                        : navItems.length <= 5
                        ? '6px 12px'
                        : '6px 9px'),
                    background: isActive ? 'rgba(255, 255, 255, 0.09)' : 'transparent',
                    color: isActive ? '#FFFFFF' : 'var(--text-dark-secondary)',
                    border: isActive ? '1px solid var(--border-dark-hover)' : '1px solid transparent',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: isActualCreator ? '0.84rem' : (navItems.length <= 3 ? '0.84rem' : '0.81rem'),
                    position: 'relative',
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                  }}
                  onClick={() => handleTabClick(item.id)}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                  {isActive && (
                    <span
                      className="nav-active-indicator"
                      style={{
                        position: 'absolute',
                        bottom: '-3px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: isActualCreator ? '36px' : '24px',
                        height: '2px',
                        backgroundColor: 'var(--brand-orange)',
                        borderRadius: '2px',
                        boxShadow: '0 0 8px rgba(255, 85, 0, 0.8)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ========================================================= */}
        {/* 3. RIGHT SECTION: Balance, Top Up & Role Controls          */}
        {/* ========================================================= */}
        <div
          className="navbar-actions-section"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            flexShrink: 0,
            flex: isActualCreator ? '1 0 200px' : undefined,
          }}
        >
          {isAuthenticated ? (
            <>
              {/* Micro Balance & Top Up Container (Hidden for Creator role) */}
              {!isActualCreator && (
                <div
                  className="navbar-balance-pill"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-dark)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px 4px 12px',
                    gap: '10px',
                    flexShrink: 0,
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.60rem',
                        color: 'var(--text-dark-muted)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        lineHeight: 1,
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--status-emerald)',
                          boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
                          flexShrink: 0,
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
                        letterSpacing: '-0.01em',
                        marginTop: '2px',
                        lineHeight: 1.1,
                      }}
                    >
                      {formatMicroUsd(wallet?.balance)}
                    </div>
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    style={{
                      padding: '4px 9px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: 'var(--radius-xs)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0,
                    }}
                    onClick={onOpenTopup}
                    title="Add Micro-USD to wallet"
                  >
                    <Plus size={12} strokeWidth={3} />
                    Top Up
                  </button>
                </div>
              )}

              {/* Role Indicator Section */}
              <div className="navbar-role-wrapper" style={{ flexShrink: 0 }}>
                <RoleSelector
                  actualRole={actualRole}
                  isAdmin={Boolean(user?.isAdmin)}
                  isCreator={actualRole === 'creator'}
                  isConsumer={actualRole === 'consumer'}
                  onLogout={handleLogout}
                  isLoggingOut={isLoggingOut}
                />
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: 600, padding: '7px 14px', flexShrink: 0, fontSize: '0.82rem' }}
                onClick={() => onOpenAuth('login')}
              >
                <LogIn size={14} />
                Sign In
              </button>
              <button
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 700, padding: '7px 16px', flexShrink: 0, fontSize: '0.82rem' }}
                onClick={() => onOpenAuth('register')}
              >
                <Sparkles size={14} />
                Sign Up
              </button>
            </div>
          )}

          {/* Mobile Menu Hamburger (Visible only on small mobile screens < 820px) */}
          <button
            className="btn btn-secondary btn-sm mobile-menu-btn"
            style={{ padding: '7px', flexShrink: 0 }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div
          style={{
            borderTop: '1px solid var(--border-dark)',
            backgroundColor: 'var(--bg-dark-surface)',
            padding: '16px 20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {isAuthenticated && !isActualCreator && (
            <div
              className="mobile-wallet-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-dark)',
                marginBottom: '6px',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.64rem',
                    color: 'var(--text-dark-muted)',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--status-emerald)',
                    }}
                  />
                  Micro Balance
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '0.96rem',
                    color: '#FFFFFF',
                    fontFamily: 'var(--font-mono)',
                    marginTop: '2px',
                  }}
                >
                  {formatMicroUsd(wallet?.balance)}
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ padding: '5px 12px', fontSize: '0.76rem', fontWeight: 700 }}
                onClick={() => {
                  onOpenTopup();
                  setMobileMenuOpen(false);
                }}
              >
                <Plus size={12} strokeWidth={3} />
                Top Up
              </button>
            </div>
          )}

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
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.88rem',
                }}
                onClick={() => handleTabClick(item.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>
                <ChevronRight size={15} />
              </button>
            );
          })}

          {isAuthenticated && (
            <div style={{ marginTop: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-dark)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dark-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Role
                </span>
                <span className="badge badge-orange">{actualRole.toUpperCase()}</span>
              </div>

              <div>
                <RoleSelector
                  actualRole={actualRole}
                  isAdmin={Boolean(user?.isAdmin)}
                  isCreator={actualRole === 'creator'}
                  isConsumer={actualRole === 'consumer'}
                  onLogout={handleLogout}
                  isLoggingOut={isLoggingOut}
                />
              </div>
            </div>
          )}

          {!isAuthenticated && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-dark)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="btn btn-secondary w-full"
                onClick={() => {
                  onOpenAuth('login');
                  setMobileMenuOpen(false);
                }}
              >
                <LogIn size={14} />
                Sign In
              </button>
              <button
                className="btn btn-primary w-full"
                onClick={() => {
                  onOpenAuth('register');
                  setMobileMenuOpen(false);
                }}
              >
                <Sparkles size={14} />
                Sign Up
              </button>
            </div>
          )}
        </div>
      )}

      {/* Responsive Breakpoints & Clean Styling */}
      <style>{`
        /* Hide scrollbars for clean aesthetic */
        .navbar-nav-pill::-webkit-scrollbar {
          display: none;
        }

        /* Desktop & Tablet: >= 820px keep all 3 sections side by side in ONE horizontal row */
        @media (min-width: 820px) {
          .navbar-nav-section {
            display: flex !important;
          }
          .mobile-menu-btn {
            display: none !important;
          }
        }

        /* 1280px - 1440px+ (Standard Desktop) */
        @media (min-width: 1280px) {
          .navbar-main-container {
            padding: 0 28px !important;
            gap: 16px !important;
          }
        }

        /* 1024px - 1279px (Tablet Landscape / Compact Desktop) */
        @media (min-width: 820px) and (max-width: 1279px) {
          .navbar-main-container {
            padding: 0 16px !important;
            gap: 10px !important;
          }
          .brand-subtitle {
            display: none !important;
          }
          .navbar-balance-pill {
            padding: 3px 6px 3px 10px !important;
            gap: 8px !important;
          }
          .navbar-actions-section {
            gap: 8px !important;
          }
          .nav-tab-btn {
            padding: 6px 10px !important;
            font-size: 0.80rem !important;
            gap: 6px !important;
          }
        }

        /* Mobile Phones (< 820px) */
        @media (max-width: 819px) {
          .navbar-nav-section {
            display: none !important;
          }
          .mobile-menu-btn {
            display: inline-flex !important;
          }
          .brand-subtitle {
            display: none !important;
          }
          .navbar-main-container {
            padding: 0 16px !important;
          }
        }

        /* Extra small mobile (< 560px) */
        @media (max-width: 560px) {
          .navbar-balance-pill {
            display: none !important;
          }
        }

        .nav-tab-btn {
          transition: all 0.15s ease;
        }
        .nav-tab-btn:hover {
          background: rgba(255, 255, 255, 0.07) !important;
          color: #FFFFFF !important;
          border-color: var(--border-dark-hover) !important;
        }
      `}</style>
    </header>
  );
};
