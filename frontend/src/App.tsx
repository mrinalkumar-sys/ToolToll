import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar, NavTab } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { AuthModal } from './components/common/AuthModal';
import { AuthPromptModal } from './components/common/AuthPromptModal';
import { TopupModal } from './components/common/TopupModal';
import { MarketplaceView } from './components/views/MarketplaceView';
import { PlaygroundView } from './components/views/PlaygroundView';
import { AgentManagementView } from './components/views/AgentManagementView';
import { CreatorView } from './components/views/CreatorView';
import { WalletView } from './components/views/WalletView';
import { AdminView } from './components/views/AdminView';
import { AiIntelligenceView } from './components/views/AiIntelligenceView';
import { Tool } from './types';

function MainApp() {
  const { user, isAuthenticated, activeRole } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('marketplace');
  const [selectedToolForPlayground, setSelectedToolForPlayground] = useState<Tool | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [authPromptAction, setAuthPromptAction] = useState<string | undefined>(undefined);
  const [topupModalOpen, setTopupModalOpen] = useState(false);

  const isActualAdmin = Boolean(
    user?.isAdmin || String((user as any)?.role).toLowerCase() === 'admin'
  );

  // Securely enforce role and auth boundaries across navigation
  useEffect(() => {
    if (!isAuthenticated) {
      if (
        currentTab === 'admin' ||
        currentTab === 'admin-listing' ||
        currentTab === 'admin-moderation' ||
        currentTab === 'admin-earnings' ||
        currentTab === 'creator' ||
        currentTab === 'wallet' ||
        currentTab === 'agents'
      ) {
        setCurrentTab('marketplace');
      }
    } else if (isActualAdmin) {
      // Admin only has the 3 tabs: admin-listing, admin-moderation, admin-earnings
      if (
        currentTab !== 'admin-listing' &&
        currentTab !== 'admin-moderation' &&
        currentTab !== 'admin-earnings'
      ) {
        setCurrentTab('admin-listing');
      }
    } else {
      // Non-admins cannot access admin tabs
      if (
        currentTab === 'admin' ||
        currentTab === 'admin-listing' ||
        currentTab === 'admin-moderation' ||
        currentTab === 'admin-earnings'
      ) {
        setCurrentTab('marketplace');
      } else if (currentTab === 'creator' && activeRole !== 'creator') {
        setCurrentTab('marketplace');
      } else if (currentTab === 'agents' && activeRole === 'creator' && !user?.isConsumer) {
        setCurrentTab('creator');
      } else if (currentTab === 'wallet' && activeRole === 'creator') {
        setCurrentTab('creator');
      }
    }
  }, [isAuthenticated, isActualAdmin, activeRole, user, currentTab]);

  const handleSelectToolForPlayground = (tool: Tool) => {
    setSelectedToolForPlayground(tool);
    setCurrentTab('playground');
  };

  const handleOpenAuth = (tab: 'login' | 'register' = 'login') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const handleRequireAuth = (actionName: string) => {
    setAuthPromptAction(actionName);
    setAuthPromptOpen(true);
  };

  return (
    <div className="app-container">
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAuth={handleOpenAuth}
        onOpenTopup={() => setTopupModalOpen(true)}
      />

      <main className="main-content">
        {currentTab === 'marketplace' && (
          <MarketplaceView
            onSelectToolForPlayground={handleSelectToolForPlayground}
            onOpenAuth={() => handleOpenAuth('login')}
          />
        )}

        {currentTab === 'playground' && (
          <PlaygroundView
            initialTool={selectedToolForPlayground}
            onRequireAuth={handleRequireAuth}
          />
        )}

        {currentTab === 'agents' && isAuthenticated && (activeRole === 'consumer' || user?.isAdmin || user?.isConsumer) && (
          <AgentManagementView />
        )}

        {currentTab === 'creator' && isAuthenticated && (activeRole === 'creator' || user?.isAdmin || user?.isCreator) && (
          <CreatorView />
        )}

        {currentTab === 'wallet' && isAuthenticated && (
          <WalletView onOpenTopup={() => setTopupModalOpen(true)} />
        )}

        {(currentTab === 'admin' ||
          currentTab === 'admin-listing' ||
          currentTab === 'admin-moderation' ||
          currentTab === 'admin-earnings') && (
          <AdminView
            activeSection={
              currentTab === 'admin-moderation'
                ? 'moderation'
                : currentTab === 'admin-earnings'
                ? 'earnings'
                : 'listing'
            }
            onSelectSection={(section) => {
              if (section === 'listing') setCurrentTab('admin-listing');
              else if (section === 'moderation') setCurrentTab('admin-moderation');
              else if (section === 'earnings') setCurrentTab('admin-earnings');
            }}
          />
        )}

        {currentTab === 'ai' && (
          <AiIntelligenceView
            onSelectTab={setCurrentTab}
            onRequireAuth={handleRequireAuth}
          />
        )}
      </main>

      <Footer />

      <AuthPromptModal
        isOpen={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        actionTitle={authPromptAction}
        onSignIn={() => {
          setAuthPromptOpen(false);
          handleOpenAuth('login');
        }}
        onCreateAccount={() => {
          setAuthPromptOpen(false);
          handleOpenAuth('register');
        }}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authModalTab}
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
