import React, { useState, useEffect } from 'react';
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

function MainApp() {
  const { isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('marketplace');
  const [selectedToolForPlayground, setSelectedToolForPlayground] = useState<Tool | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);

  // If user logs out, securely redirect protected pages back to marketplace
  useEffect(() => {
    if (!isAuthenticated && (currentTab === 'admin' || currentTab === 'creator' || currentTab === 'wallet' || currentTab === 'agents')) {
      setCurrentTab('marketplace');
    }
  }, [isAuthenticated, currentTab]);

  const handleSelectToolForPlayground = (tool: Tool) => {
    setSelectedToolForPlayground(tool);
    setCurrentTab('playground');
  };

  return (
    <div className="app-container">
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
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
