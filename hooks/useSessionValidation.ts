/**
 * Session Validation Hook
 *
 * Periodically validates the current session against the server.
 * If the session is invalid, it logs the user out.
 */

import { useEffect } from 'react';
import { validateSession } from '../services/sessionService';
import { useAuth } from '../contexts/AuthContext';

const VALIDATION_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useSessionValidation() {
  const { logout, user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const validateCurrentSession = async () => {
      const sessionData = localStorage.getItem('wif_auth_session');
      if (!sessionData) return;

      try {
        const session = JSON.parse(sessionData);
        const userId = await validateSession(session.token);

        if (!userId) {
          // Session invalid on server, logout
          console.warn('Session validation failed - logging out');
          await logout();
        }
      } catch (error) {
        console.error('Session validation error:', error);
        // Don't logout on validation errors (network issues, etc.)
      }
    };

    // Validate on mount
    validateCurrentSession();

    // Validate periodically
    const interval = setInterval(validateCurrentSession, VALIDATION_INTERVAL);

    return () => clearInterval(interval);
  }, [logout, user]);
}
