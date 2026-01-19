/**
 * Debug.js
 * Système de logging conditionnel pour le développement
 *
 * Usage:
 *   import { debug } from './utils/Debug.js';
 *   debug.log('message');
 *   debug.warn('warning');
 *   debug.error('error'); // Toujours affiché
 */

class DebugLogger {
  constructor() {
    // Activer le debug en mode développement
    // Pour désactiver en production, mettre à false
    this.enabled = true;

    // Catégories de logs activées
    this.categories = {
      combat: true,
      pokemon: true,
      save: true,
      ui: true,
      vr: true,
      world: true,
      npc: true,
      items: true,
      performance: false, // Désactivé par défaut
    };
  }

  /**
   * Active/désactive le debug globalement
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Active/désactive une catégorie spécifique
   */
  setCategory(category, enabled) {
    this.categories[category] = enabled;
  }

  /**
   * Log standard (seulement si debug activé)
   */
  log(message, ...args) {
    if (this.enabled) {
      console.log(message, ...args);
    }
  }

  /**
   * Log avec catégorie
   */
  logCategory(category, message, ...args) {
    if (this.enabled && this.categories[category]) {
      console.log(`[${category.toUpperCase()}]`, message, ...args);
    }
  }

  /**
   * Warning (seulement si debug activé)
   */
  warn(message, ...args) {
    if (this.enabled) {
      console.warn(message, ...args);
    }
  }

  /**
   * Erreur (TOUJOURS affichée)
   */
  error(message, ...args) {
    console.error(message, ...args);
  }

  /**
   * Performance timing
   */
  time(label) {
    if (this.enabled && this.categories.performance) {
      console.time(label);
    }
  }

  timeEnd(label) {
    if (this.enabled && this.categories.performance) {
      console.timeEnd(label);
    }
  }
}

// Instance singleton
export const debug = new DebugLogger();

// Exposer dans window pour pouvoir désactiver dans la console
if (typeof window !== 'undefined') {
  window.debugLogger = debug;
}
