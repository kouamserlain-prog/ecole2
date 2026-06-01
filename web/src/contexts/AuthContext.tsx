"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { authApi } from '../services/api';
import {
  clearAllOfflineCaches,
  loadUserSnapshot,
  saveUserSnapshot,
} from '../lib/offline-storage';
import toast from 'react-hot-toast';
import {
  applyDocumentTheme,
  parseUserUiPreferences,
  type UserUiPreferences,
} from '@/lib/userUiPreferences';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string | null;
  avatar?: string | null;
  isActive?: boolean;
  uiPreferences?: UserUiPreferences | null;
  studentProfile?: {
    enrollmentStatus?: 'ACTIVE' | 'SUSPENDED' | 'GRADUATED';
    [key: string]: unknown;
  };
}

export type ProfileUpdatePayload = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatar?: string | null;
  uiPreferences?: UserUiPreferences;
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (
    email: string,
    password: string,
    twoFactorCode?: string
  ) => Promise<{ token: string; user: User; twoFactorEnabled?: boolean }>;
  logout: () => void;
  loading: boolean;
  /** Recharge le profil depuis l’API (sans message de succès). */
  refreshUser: () => Promise<void>;
  /** Met à jour le profil via PUT /auth/me puis recharge l’utilisateur. */
  updateProfile: (data: ProfileUpdatePayload) => Promise<void>;
  /** Préférences interface (thème, fuseau horaire, etc.). */
  uiPreferences: UserUiPreferences;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        await fetchUser();
      } else {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const uiPreferences = useMemo(
    () => parseUserUiPreferences(user?.uiPreferences),
    [user?.uiPreferences]
  );

  useEffect(() => {
    if (!user) return;
    applyDocumentTheme(uiPreferences.theme);
    document.documentElement.lang = uiPreferences.language;
  }, [user, uiPreferences.theme, uiPreferences.language]);

  const fetchUser = async () => {
    try {
      const userData = await authApi.getMe();
      if (userData) {
        setUser(userData as User);
        await saveUserSnapshot(userData);
      }
    } catch (error: any) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
      const network =
        error.code === 'ERR_NETWORK' ||
        error.code === 'ECONNREFUSED' ||
        error.message === 'Network Error';
      if (network) {
        const offlineUser = await loadUserSnapshot<User>();
        if (offlineUser?.id) {
          setUser(offlineUser);
          return;
        }
      }
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authApi.getMe();
      if (userData) {
        setUser(userData as User);
        await saveUserSnapshot(userData);
      }
    } catch (error: any) {
      console.error('Erreur refreshUser:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      }
    }
  };

  const updateProfile = async (data: ProfileUpdatePayload) => {
    try {
      await authApi.updateMe(data);
      await refreshUser();
      toast.success('Profil mis à jour');
    } catch (error: any) {
      const msg =
        error.response?.data?.error ||
        error.message ||
        'Impossible de mettre à jour le profil';
      toast.error(typeof msg === 'string' ? msg : 'Impossible de mettre à jour le profil');
      throw error;
    }
  };

  const login = async (email: string, password: string, twoFactorCode?: string) => {
    try {
      const response = await authApi.login(email, password, twoFactorCode);
      if (response && response.token && response.user) {
        setToken(response.token);
        setUser(response.user as User);
        localStorage.setItem('token', response.token);
        await saveUserSnapshot(response.user);
        toast.success('Connexion réussie');
        return response;
      } else {
        throw new Error('Réponse invalide du serveur');
      }
    } catch (error: any) {
      let errorMessage = 'Erreur de connexion';
      
      if (error.response) {
        // Erreur avec réponse du serveur
        errorMessage = error.response.data?.error || error.message || 'Erreur de connexion';
        
        // Messages plus explicites selon le code d'erreur
        if (error.response.status === 401) {
          if (error.response.data?.code === 'TWO_FACTOR_REQUIRED') {
            errorMessage = 'Code 2FA requis.';
          } else if (error.response.data?.code === 'TWO_FACTOR_INVALID') {
            errorMessage = 'Code 2FA invalide.';
          } else if (errorMessage.includes('désactivé')) {
            errorMessage = 'Votre compte a été désactivé. Contactez l\'administrateur.';
          } else {
            errorMessage = 'Email ou mot de passe incorrect. Vérifiez vos identifiants.';
          }
        } else if (error.response.status === 403) {
          if (error.response.data?.code === 'ENROLLMENT_SUSPENDED') {
            errorMessage =
              error.response.data?.error ||
              'Votre inscription est suspendue. Contactez l’administration.';
          } else {
            errorMessage = error.response.data?.error || 'Accès refusé.';
          }
        } else if (error.response.status === 400) {
          errorMessage = 'Veuillez vérifier que tous les champs sont correctement remplis.';
        } else if (error.response.status >= 500) {
          const serverMsg =
            typeof error.response.data?.error === 'string'
              ? error.response.data.error
              : null;
          errorMessage =
            serverMsg ||
            'Erreur serveur. Vérifiez la console du backend et la connexion à la base de données.';
        }
      } else if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Impossible de se connecter au serveur. Vérifiez que le backend est démarré.';
      }
      
      toast.error(errorMessage);
      console.error('Erreur de connexion:', error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    void clearAllOfflineCaches();
    toast.success('Déconnexion réussie');
    // Rediriger vers la page d'accueil
    window.location.href = '/home';
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, loading, refreshUser, updateProfile, uiPreferences }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

