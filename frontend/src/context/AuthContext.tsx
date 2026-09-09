import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

/**
 * Vérifie si le jeton JWT est présent et non expiré
 */
function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    // payload.exp est en secondes, Date.now() en millisecondes
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return false; // Jeton expiré
    }
    return true;
  } catch {
    return false;
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    const saved = localStorage.getItem('token');
    if (saved && isTokenValid(saved)) {
      return saved;
    }
    if (saved) {
      localStorage.removeItem('token');
    }
    return null;
  });

  const login = useCallback((newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
  }, []);

  useEffect(() => {
    // Synchronisation automatique entre onglets
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        const val = e.newValue;
        if (val && isTokenValid(val)) {
          setToken(val);
        } else {
          setToken(null);
        }
      }
    };

    // Déconnexion propre si l'API renvoie 401 (non autorisé)
    const handleUnauthorized = () => {
      localStorage.removeItem('token');
      setToken(null);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('camfire_unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('camfire_unauthorized', handleUnauthorized);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
};
