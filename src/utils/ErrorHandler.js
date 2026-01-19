/**
 * ErrorHandler.js
 * Système unifié de gestion d'erreurs
 *
 * Usage:
 *   import { handleError, ErrorSeverity } from './utils/ErrorHandler.js';
 *
 *   try {
 *     // code
 *   } catch (error) {
 *     handleError(error, ErrorSeverity.WARNING, 'SaveManager');
 *   }
 */

export const ErrorSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
};

class ErrorManager {
  constructor() {
    this.errors = [];
    this.maxErrors = 100; // Limite pour éviter les fuites mémoire
    this.listeners = [];
  }

  /**
   * Enregistre et affiche une erreur
   */
  handle(error, severity = ErrorSeverity.ERROR, context = 'Unknown') {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      severity,
      context,
      message: error.message || String(error),
      stack: error.stack,
    };

    // Stocker l'erreur (avec limite)
    this.errors.push(errorEntry);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Afficher selon la sévérité
    const logMessage = `[${severity}] ${context}: ${errorEntry.message}`;

    switch (severity) {
      case ErrorSeverity.INFO:
        console.info(logMessage);
        break;
      case ErrorSeverity.WARNING:
        console.warn(logMessage);
        break;
      case ErrorSeverity.ERROR:
        console.error(logMessage);
        if (error.stack) console.error(error.stack);
        break;
      case ErrorSeverity.CRITICAL:
        console.error(`🔥 ${logMessage}`);
        if (error.stack) console.error(error.stack);
        // Pour les erreurs critiques, on pourrait notifier l'utilisateur
        this.notifyCriticalError(errorEntry);
        break;
    }

    // Notifier les listeners (pour UI, analytics, etc.)
    this.notifyListeners(errorEntry);

    return errorEntry;
  }

  /**
   * Ajoute un listener pour être notifié des erreurs
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Notifie tous les listeners
   */
  notifyListeners(errorEntry) {
    this.listeners.forEach(listener => {
      try {
        listener(errorEntry);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }

  /**
   * Affiche une notification à l'utilisateur pour les erreurs critiques
   */
  notifyCriticalError(errorEntry) {
    // TODO: Intégrer avec le système de notification du jeu
    if (typeof window !== 'undefined' && window.game?.uiManager) {
      window.game.uiManager.showNotification(
        `Erreur critique: ${errorEntry.message}`,
        'error'
      );
    }
  }

  /**
   * Récupère toutes les erreurs enregistrées
   */
  getErrors(severity = null) {
    if (severity) {
      return this.errors.filter(e => e.severity === severity);
    }
    return this.errors;
  }

  /**
   * Efface l'historique des erreurs
   */
  clear() {
    this.errors = [];
  }
}

// Instance singleton
export const errorManager = new ErrorManager();

/**
 * Helper function pour gérer les erreurs
 */
export function handleError(error, severity = ErrorSeverity.ERROR, context = 'Unknown') {
  return errorManager.handle(error, severity, context);
}

/**
 * Wrapper pour les fonctions async qui gère automatiquement les erreurs
 */
export function withErrorHandling(fn, context) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, ErrorSeverity.ERROR, context);
      throw error; // Re-throw pour que l'appelant puisse gérer si nécessaire
    }
  };
}

// Exposer dans window pour debugging
if (typeof window !== 'undefined') {
  window.errorManager = errorManager;
}
