import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

export type UserRole =
  | 'admin'
  | 'production_manager'
  | 'sales_staff'
  | 'inventory_manager';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  branchId: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  loginAs: (role: UserRole) => Promise<void>;
  logout: () => void;
  canAccess: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_ACCOUNTS: Record<UserRole, { email: string; token: string; fullName: string }> = {
  admin: {
    email: 'admin@mahatir.com',
    token: 'demo-admin',
    fullName: 'Bilal Ahmad (Founder & Master Perfumer)',
  },
  production_manager: {
    email: 'production@mahatir.com',
    token: 'demo-production',
    fullName: 'Farhan Malik (Lab & Batch Lead)',
  },
  inventory_manager: {
    email: 'inventory@mahatir.com',
    token: 'demo-inventory',
    fullName: 'Tariq Al-Mansoor (Oils & Materials Custodian)',
  },
  sales_staff: {
    email: 'sales@mahatir.com',
    token: 'demo-sales',
    fullName: 'Amina Zahra (Senior Fragrance Consultant)',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to Admin in initial load for developer convenience
  const [user, setUser] = useState<User | null>({
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@mahatir.com',
    fullName: 'Bilal Ahmad (Founder & Master Perfumer)',
    role: 'admin',
    branchId: '00000000-0000-0000-0000-000000000001',
  });
  const [token, setToken] = useState<string | null>('demo-admin');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('mahatir_token');
    const savedUser = localStorage.getItem('mahatir_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (_e) {
        // use default
      }
    }
  }, []);

  const login = async (email: string, pass: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await apiClient<{ token: string; user: User }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      });

      if (res.data) {
        setUser(res.data.user);
        setToken(res.data.token);
        localStorage.setItem('mahatir_token', res.data.token);
        localStorage.setItem('mahatir_user', JSON.stringify(res.data.user));
        return true;
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginAs = async (role: UserRole): Promise<void> => {
    const account = DEMO_ACCOUNTS[role];
    const newUser: User = {
      id: `usr-${role}`,
      email: account.email,
      fullName: account.fullName,
      role,
      branchId: '00000000-0000-0000-0000-000000000001',
    };
    setUser(newUser);
    setToken(account.token);
    localStorage.setItem('mahatir_token', account.token);
    localStorage.setItem('mahatir_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('mahatir_token');
    localStorage.removeItem('mahatir_user');
  };

  const canAccess = (module: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    switch (module) {
      case 'users':
      case 'audit':
      case 'settings':
        return false;
      case 'raw_materials':
        return user.role === 'inventory_manager' || user.role === 'production_manager';
      case 'purchases':
      case 'suppliers':
        return user.role === 'inventory_manager';
      case 'formulas':
      case 'batches':
      case 'dilution':
        return user.role === 'production_manager';
      case 'bottling':
        return user.role === 'production_manager' || user.role === 'inventory_manager';
      case 'pos':
        return user.role === 'sales_staff';
      case 'reports':
        return true;
      default:
        return true;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        loginAs,
        logout,
        canAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
