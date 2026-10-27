import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
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
  const [currentTab, setCurrentTab] = useState<NavTab>('marketplace');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);

  const handleSelectToolForPlayground = (tool: Tool) => {
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

        {currentTab === 'playground' && <PlaygroundView />}

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
