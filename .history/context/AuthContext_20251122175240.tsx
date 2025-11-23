import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext } from 'react';
import axios from 'axios';
import type { User } from '../types';

const API_BASE_URL = 'http://localhost:5001/api';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    fullName: string;
    role: string;
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Export useAuth hook directly from here
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Configure axios interceptor to add JWT token to all requests
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const storedToken = localStorage.getItem('jwtToken');
        if (storedToken && config.headers) {
          config.headers.Authorization = `Bearer ${storedToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, []);

  const checkUserSession = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem('jwtToken');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedUser) {
        // Verify token is still valid
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/verify`, {}, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          
          if (response.data.valid) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          } else {
            // Token invalid, clear storage
            localStorage.removeItem('jwtToken');
            localStorage.removeItem('user');
          }
        } catch (error) {
          // Token verification failed, clear storage
          localStorage.removeItem('jwtToken');
          localStorage.removeItem('user');
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

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await axios.post<LoginResponse>(`${API_BASE_URL}/auth/login`, {
        username,
        password
      });

      const { token: jwtToken, user: userData } = response.data;

      // Store token and user data
      localStorage.setItem('jwtToken', jwtToken);
      localStorage.setItem('user', JSON.stringify(userData));

      setToken(jwtToken);
      setUser(userData as User);

      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('user');
    // Also clear old userId if exists
    localStorage.removeItem('userId');
  };
  
  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
