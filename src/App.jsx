import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Layout } from './components/Layout.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { ConsumerDashboard } from './pages/ConsumerDashboard.jsx';
import { MarketplacePage } from './pages/MarketplacePage.jsx';
import { CreatorDashboard } from './pages/CreatorDashboard.jsx';
import { AgentManagementPage } from './pages/AgentManagementPage.jsx';
import { PlaygroundPage } from './pages/PlaygroundPage.jsx';
import { WalletPage } from './pages/WalletPage.jsx';
import { CreatorEarningsPage } from './pages/CreatorEarningsPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="py-20 text-center text-xs text-slate-500">Checking authentication...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/playground" element={<PlaygroundPage />} />

              {/* Authenticated routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <ConsumerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/creator"
                element={
                  <ProtectedRoute>
                    <CreatorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agents"
                element={
                  <ProtectedRoute>
                    <AgentManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/wallet"
                element={
                  <ProtectedRoute>
                    <WalletPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/earnings"
                element={
                  <ProtectedRoute>
                    <CreatorEarningsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />

              {/* Catch all fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
