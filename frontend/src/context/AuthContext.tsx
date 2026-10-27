import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Wallet, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  wallet: Wallet | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role?: 'consumer' | 'creator') => Promise<void>;
  logout: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  loginDemo: (role: 'admin' | 'creator' | 'consumer') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeRole, setActiveRole] = useState<UserRole>('consumer');

  const refreshProfile = useCallback(async () => {
    if (!api.getToken()) {
      setUser(null);
      setWallet(null);
      setIsLoading(false);
      return;
    }
    try {
      const data = await api.getCurrentUser();
      setUser(data.user);
      setWallet(data.wallet);
      if (data.user.isAdmin) {
        setActiveRole('admin');
      } else if (data.user.isCreator) {
        setActiveRole('creator');
      } else {
        setActiveRole('consumer');
      }
    } catch {
      api.setToken(null);
      setToken(null);
      setUser(null);
      setWallet(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshWallet = useCallback(async () => {
    if (!api.getToken()) return;
    try {
      const w = await api.getWallet();
      setWallet(w);
    } catch (err) {
      console.error('Failed to refresh wallet:', err);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      setUser(res.user);
      setWallet(res.wallet);
      setToken(res.token);
      if (res.user.isAdmin) {
        setActiveRole('admin');
      } else if (res.user.isCreator) {
        setActiveRole('creator');
      } else {
        setActiveRole('consumer');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    role: 'consumer' | 'creator' = 'consumer'
  ) => {
    setIsLoading(true);
    try {
      const res = await api.register(email, password, name, role);
      setUser(res.user);
      setWallet(res.wallet);
      setToken(res.token);
      setActiveRole(role);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
    } finally {
      setUser(null);
      setWallet(null);
      setToken(null);
      setActiveRole('consumer');
      setIsLoading(false);
    }
  };

  const loginDemo = async (role: 'admin' | 'creator' | 'consumer') => {
    const creds = {
      admin: { email: 'admin@tooltoll.com', password: 'Password123!' },
      creator: { email: 'creator@tooltoll.com', password: 'Password123!' },
      consumer: { email: 'consumer@tooltoll.com', password: 'Password123!' },
    }[role];

    await login(creds.email, creds.password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        wallet,
        token,
        isAuthenticated: !!user,
        isLoading,
        activeRole,
        setActiveRole,
        login,
        register,
        logout,
        refreshWallet,
        refreshProfile,
        loginDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
