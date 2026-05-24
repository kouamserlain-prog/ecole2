"use client";

import { useCallback, useEffect, useState } from 'react';
import Card from './ui/Card';
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import api from '../services/api';

const ServerConnectionError: React.FC = () => {
  const [isServerDown, setIsServerDown] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncOffline = () => setBrowserOffline(!navigator.onLine);
    syncOffline();
    window.addEventListener('online', syncOffline);
    window.addEventListener('offline', syncOffline);
    return () => {
      window.removeEventListener('online', syncOffline);
      window.removeEventListener('offline', syncOffline);
    };
  }, []);

  const checkServerConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const response = await api.get('/health');
      if (response.status === 200) {
        setIsServerDown(false);
      }
    } catch (error: unknown) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (code === 'ERR_NETWORK' || code === 'ECONNREFUSED') {
        setIsServerDown(true);
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkServerConnection();
  }, [checkServerConnection]);

  if (!isServerDown || browserOffline) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <Card className="bg-red-50 border-2 border-red-200 shadow-lg">
        <div className="flex items-start space-x-3">
          <FiAlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-1">Serveur backend non disponible</h3>
            <p className="text-sm text-red-700 mb-3">
              Le serveur backend ne répond pas. Veuillez démarrer le serveur pour utiliser l'application.
            </p>
            <div className="space-y-2 text-xs text-red-600 mb-3">
              <p><strong>Pour démarrer le serveur :</strong></p>
              <code className="block bg-red-100 px-2 py-1 rounded">
                cd server && npm run dev
              </code>
            </div>
            <button
              onClick={checkServerConnection}
              disabled={isChecking}
              className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiRefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Vérification...' : 'Réessayer'}</span>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ServerConnectionError;

