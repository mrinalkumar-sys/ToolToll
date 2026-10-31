import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Cpu,
  Layers,
  Sparkles,
  Bot,
  Wallet as WalletIcon,
  Code2,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Coins,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { Badge } from './Badge.jsx';

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [walletBalance, setWalletBalance] = useState('0.00');

  useEffect(() => {
    if (user && user.role !== 'admin') {
      api.getWallet()
        .then((w) => setWalletBalance(Number(w.available_balance || 0).toFixed(2)))
        .catch(() => {});
    }
  }, [user, location.pathname]);

  // Admin gets STRICTLY the three requested nav bars; all other nav bars are removed
  const navItems = user?.role === 'admin'
    ? [
        { name: 'Listing', path: '/admin?tab=listing', icon: Layers },
        { name: 'Moderation queue', path: '/admin?tab=moderation', icon: Clock },
        { name: 'Earnings', path: '/admin?tab=earnings', icon: TrendingUp },
      ]
    : [
        { name: 'Dashboard', path: '/dashboard', icon: Layers },
        { name: 'Marketplace', path: '/marketplace', icon: Cpu },
        { name: 'Agent Playground', path: '/playground', icon: Sparkles },
        { name: 'My Agents', path: '/agents', icon: Bot },
        { name: 'Wallet & Ledger', path: '/wallet', icon: WalletIcon },
        { name: 'Creator Studio', path: '/creator', icon: Code2 },
      ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link to={user?.role === 'admin' ? '/admin?tab=listing' : '/'} className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center group-hover:bg-slate-900 transition">
                  <Coins className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition duration-200" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  ToolToll
                </span>
                <span className="text-[10px] tracking-wider uppercase text-cyan-400 font-semibold -mt-1">
                  Pay-Per-Use Protocol
                </span>
              </div>
            </Link>

            {/* Navigation tabs */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const currentFull = location.pathname + location.search;
                const isActive = location.pathname === item.path || currentFull === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Wallet Balance Pill (hidden for admin) */}
                {user.role !== 'admin' && (
                  <Link
                    to="/wallet"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition group shadow-sm"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-slate-400 font-medium">Balance:</span>
                    <span className="text-sm font-semibold text-emerald-400 font-mono">
                      ${walletBalance}
                    </span>
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 group-hover:bg-indigo-500/20">
                      + Top Up
                    </span>
                  </Link>
                )}

                {/* User Role Badge (Role switching removed) */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300">
                  <span className="capitalize">{user.role}</span>
                </div>

                {/* User menu / Logout */}
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/20"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <span>ToolToll Protocol MVP</span>
            <span>•</span>
            <span>PayPal Sandbox Enabled</span>
            <span>•</span>
            <span>Official Python MCP 2.x SDK</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span className="hover:text-slate-400 transition">SSRF Guard Active</span>
            <span>•</span>
            <span className="hover:text-slate-400 transition">Argon2id + AES-256</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
