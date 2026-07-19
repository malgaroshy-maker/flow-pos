import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { getStoredToken, getStoredUser, setStoredAuth, clearStoredAuth } from '../lib/api';

interface AuthContextType {
  token: string | null;
  currentUser: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateCurrentUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());

  const login = (newToken: string, newUser: User) => {
    setStoredAuth(newToken, newUser);
    setToken(newToken);
    setCurrentUser(newUser);
  };

  const logout = () => {
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    clearStoredAuth();
    setToken(null);
    setCurrentUser(null);
  };

  const updateCurrentUser = (user: User) => {
    setCurrentUser(user);
    if (token) {
      setStoredAuth(token, user);
    }
  };

  return (
    <AuthContext.Provider value={{ token, currentUser, login, logout, updateCurrentUser }}>
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
