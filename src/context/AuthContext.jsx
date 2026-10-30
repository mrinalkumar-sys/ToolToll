import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('tooltoll_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const u = await api.getMe();
        setUser(u);
      } catch (err) {
        console.error('Session expired or invalid:', err);
        localStorage.removeItem('tooltoll_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email, pass) => {
    const data = await api.login({ email, password: pass });
    localStorage.setItem('tooltoll_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  };

  const register = async (email, pass, name, role) => {
    const data = await api.register({ email, password: pass, full_name: name, role });
    localStorage.setItem('tooltoll_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('tooltoll_token');
    setToken(null);
    setUser(null);
  };

  const quickSwitchUser = async (email, pass) => {
    await login(email, pass);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, quickSwitchUser }}>
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
