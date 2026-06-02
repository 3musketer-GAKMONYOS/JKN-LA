import React, { createContext, useContext, useState, useEffect } from 'react';

export type Role = 'superadmin' | 'admin';

export interface User {
  id: string;
  username: string;
  role: Role;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  canAccess: (permission: string) => boolean;
  canEditOrDelete: () => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  canAccess: () => false,
  canEditOrDelete: () => false,
  isLoading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('efinance_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('efinance_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('efinance_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('efinance_user');
  };

  const canAccess = (permission: string) => {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    if (user.permissions.includes('all')) return true;
    return user.permissions.includes(permission);
  };

  const canEditOrDelete = () => {
    if (!user) return false;
    return user.role === 'superadmin';
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, canAccess, canEditOrDelete, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
