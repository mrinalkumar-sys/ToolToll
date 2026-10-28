import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar, NavTab } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { AuthModal } from './components/common/AuthModal';
import { TopupModal } from './components/common/TopupModal';
import { MarketplaceView } from './components/views/MarketplaceView';
import { PlaygroundView } from './components/views/PlaygroundView';
import { AgentManagementView } from './components/views/AgentManagementView';
import { CreatorView } from './components/views/CreatorView';
import { WalletView } from './components/views/WalletView';
import { AdminView } from './components/views/AdminView';
import { AiIntelligenceView } from './components/views/AiIntelligenceView';
import { Tool } from './types';

const VALID_TABS: NavTab[] = [
  'marketplace',
  'playground',
  'agents',
  'creator',
  'wallet',
  'admin',
  'ai',
];

const PROTECTED_TABS: NavTab[] = ['agents', 'creator', 'wallet', 'admin'];

function getInitialTab(): NavTab {
  if (typeof window === 'undefined') return 'marketplace';

  // 1. Check URL hash (e.g. #wallet, #agents)
  const hash = window.location.hash.replace(/^#/, '').toLowerCase() as NavTab;
  if (VALID_TABS.includes(hash)) return hash;

  // 2. Check query parameter (e.g. ?tab=wallet)
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab')?.toLowerCase() as NavTab;
  if (VALID_TABS.includes(tabParam)) return tabParam;

  return 'marketplace';
}

function MainApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>(getInitialTab);
  const [selectedToolForPlayground, setSelectedToolForPlayground] = useState<Tool | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const wasAuthenticatedRef = useRef<boolean>(isAuthenticated);

  // Sync tab with URL hash change
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '').toLowerCase() as NavTab;
      if (VALID_TABS.includes(hash)) {
        if (!isAuthenticated && !isLoading && PROTECTED_TABS.includes(hash)) {
          setCurrentTab('marketplace');
          window.location.hash = 'marketplace';
          setAuthModalOpen(true);
        } else {
          setCurrentTab(hash);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAuthenticated, isLoading]);

  // Auth route guard:
  // - If user is unauthenticated and opens/stays on a protected tab, redirect to marketplace
  // - If unauthenticated visitor directly attempts to open a protected route, trigger auth modal
  // - Wait for isLoading so page refresh while authenticated doesn't bounce the user
  useEffect(() => {
    if (isLoading) return; // Wait until initial session verification finishes

    const isProtected = PROTECTED_TABS.includes(currentTab);

    if (!isAuthenticated && isProtected) {
      queueMicrotask(() => {
        setCurrentTab('marketplace');
      });
      if (window.location.hash) {
        window.location.hash = 'marketplace';
      }
      // If visitor was not logged in (e.g. direct URL entry or manual attempt), show login modal
      if (!wasAuthenticatedRef.current) {
        setAuthModalOpen(true);
      }
    }

    wasAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated, isLoading, currentTab]);

  const handleSelectTab = (tab: NavTab) => {
    const isProtected = PROTECTED_TABS.includes(tab);
    if (!isAuthenticated && isProtected) {
      setAuthModalOpen(true);
      return;
    }
    setCurrentTab(tab);
    if (window.location.hash || tab !== 'marketplace') {
      window.location.hash = tab;
    }
  };

  const handleSelectToolForPlayground = (tool: Tool) => {
    setSelectedToolForPlayground(tool);
    handleSelectTab('playground');
  };

  return (
    <div className="app-container">
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenTopup={() => setTopupModalOpen(true)}
      />

      <main className="main-content">
        {currentTab === 'marketplace' && (
          <MarketplaceView
            onSelectToolForPlayground={handleSelectToolForPlayground}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {currentTab === 'playground' && (
          <PlaygroundView initialTool={selectedToolForPlayground} />
        )}

        {currentTab === 'agents' && <AgentManagementView />}

        {currentTab === 'creator' && <CreatorView />}

        {currentTab === 'wallet' && (
          <WalletView onOpenTopup={() => setTopupModalOpen(true)} />
        )}

        {currentTab === 'admin' && <AdminView />}

        {currentTab === 'ai' && <AiIntelligenceView />}
      </main>

      <Footer />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <TopupModal
        isOpen={topupModalOpen}
        onClose={() => setTopupModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
