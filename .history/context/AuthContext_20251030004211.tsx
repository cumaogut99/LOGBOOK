import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { usersApi } from './api/client';
import type { User } from './types';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (username: string, passwordHash: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkUserSession = useCallback(async () => {
    try {
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            const sessionUser = await usersApi.getById(parseInt(storedUserId));
            if (sessionUser) {
                setUser(sessionUser);
            }
        }
    } catch (error) {
        console.error("Failed to restore session:", error);
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUserSession();
  }, [checkUserSession]);

  const login = async (username: string, passwordHash: string): Promise<boolean> => {
    try {
      const userFromDb = await usersApi.getByUsername(username);
      
      // NOTE: This is a direct string comparison for demo purposes.
      // In a real app, you would compare a securely hashed password.
      if (userFromDb && userFromDb.passwordHash === passwordHash) {
        setUser(userFromDb);
        localStorage.setItem('userId', userFromDb.id!.toString());
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('userId');
  };
  
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
