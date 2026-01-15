/**
 * ModernHUD.js - HUD et Pokégear modernes
 * Interface glassmorphism avec animations fluides
 */

export class ModernHUD {
  constructor(uiManager) {
    this.ui = uiManager;
    this.pokegearVisible = false;
    this.currentMenu = null;

    // Injecter le CSS moderne
    this.injectCSS();

    // Remplacer l'ancien HUD
    this.createModernHUD();

    // Créer le Pokégear moderne
    this.createModernPokegear();

    // Mettre à jour l'horloge
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
  }

  /**
   * Injecte le CSS moderne
   */
  injectCSS() {
    if (!document.getElementById('modern-ui-css')) {
      const link = document.createElement('link');
      link.id = 'modern-ui-css';
      link.rel = 'stylesheet';
      link.href = 'assets/css/modern-ui.css';
      document.head.appendChild(link);
    }
    
    // Injecter Google Material Symbols
    if (!document.getElementById('material-icons')) {
        const link = document.createElement('link');
        link.id = 'material-icons';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0';
        document.head.appendChild(link);
    }
  }

  /**
   * Crée le HUD moderne
   */
  createModernHUD() {
    // Masquer l'ancien HUD
    const oldHUD = document.getElementById('hud');
    if (oldHUD) {
      oldHUD.style.display = 'none';
    }

    // Créer le nouveau HUD
    this.hud = document.createElement('div');
    this.hud.id = 'modern-hud';
    this.hud.className = 'modern-ui';
    this.hud.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
    `;

    // Info joueur (haut gauche)
    this.playerInfo = document.createElement('div');
    this.playerInfo.id = 'modern-player-info';
    this.playerInfo.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      padding: 16px 20px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.85));
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      min-width: 200px;
      pointer-events: auto;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    this.playerInfo.innerHTML = `
      <div id="modern-player-name" style="
        font-size: 16px;
        font-weight: 600;
        color: #f8fafc;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <span style="width: 8px; height: 8px; background: #10b981; border-radius: 999px; box-shadow: 0 0 8px #10b981;"></span>
        DRESSEUR
      </div>
      <div id="modern-player-money" style="
        font-size: 14px;
        color: #f59e0b;
        font-weight: 600;
        font-family: 'JetBrains Mono', monospace;
      ">3000 ¥</div>
    `;
    this.hud.appendChild(this.playerInfo);

    // Indice d'interaction (bas centre)
    this.interactionHint = document.createElement('div');
    this.interactionHint.id = 'modern-interaction-hint';
    this.interactionHint.style.cssText = `
      position: absolute;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      padding: 14px 24px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9));
      backdrop-filter: blur(12px);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 999px;
      color: #f8fafc;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      display: none;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
      pointer-events: none;
      animation: hintPulse 2s ease-in-out infinite;
    `;
    this.interactionHint.innerHTML = `
      <span style="margin-right: 8px;">Appuie sur</span>
      <kbd style="
        background: rgba(99, 102, 241, 0.3);
        padding: 4px 10px;
        border-radius: 6px;
        font-family: 'JetBrains Mono', monospace;
        font-weight: 600;
      ">E</kbd>
    `;

    // Ajouter l'animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes hintPulse {
        0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.2); }
        50% { box-shadow: 0 0 30px rgba(99, 102, 241, 0.4); }
      }
    `;
    document.head.appendChild(style);

    this.hud.appendChild(this.interactionHint);

    document.body.appendChild(this.hud);
  }

  /**
   * Crée le Pokégear moderne
   */
  createModernPokegear() {
    // Masquer l'ancien Pokégear
    const oldPokegear = document.getElementById('watch-container');
    if (oldPokegear) {
      oldPokegear.style.display = 'none';
    }

    // Créer le nouveau Pokégear
    this.pokegear = document.createElement('div');
    this.pokegear.id = 'modern-pokegear';
    this.pokegear.className = 'modern-ui';
    this.pokegear.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 200;
      pointer-events: auto;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    `;

    // Bouton toggle
    this.pokegearToggle = document.createElement('button');
    this.pokegearToggle.id = 'pokegear-toggle';
    this.pokegearToggle.style.cssText = `
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border: none;
      border-radius: 999px;
      color: white;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 10px 40px rgba(99, 102, 241, 0.4);
      transition: all 0.25s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    this.pokegearToggle.innerHTML = '<span class="material-symbols-rounded">smartphone</span>';
    this.pokegearToggle.title = 'Pokégear (TAB)';
    this.pokegear.appendChild(this.pokegearToggle);

    // Menu du Pokégear
    this.pokegearMenu = document.createElement('div');
    this.pokegearMenu.id = 'pokegear-menu';
    this.pokegearMenu.style.cssText = `
      position: absolute;
      bottom: 70px;
      left: 0;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95));
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 16px;
      min-width: 240px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      opacity: 0;
      visibility: hidden;
      transform: translateY(20px) scale(0.95);
      transition: all 0.25s ease;
    `;

    // Horloge
    this.pokegearMenu.innerHTML = `
      <div id="pokegear-time" style="
        text-align: center;
        padding: 16px;
        margin-bottom: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 24px;
        font-weight: 600;
        color: #f8fafc;
      ">12:00</div>
      <div id="pokegear-buttons" style="display: flex; flex-direction: column; gap: 8px;">
        <!-- Boutons ajoutés dynamiquement -->
      </div>
    `;
    this.pokegear.appendChild(this.pokegearMenu);

    document.body.appendChild(this.pokegear);

    // Ajouter les boutons
    this.updatePokegearButtons();

    // Events
    this.pokegearToggle.addEventListener('click', () => this.togglePokegear());

    // Hover effect
    this.pokegearToggle.addEventListener('mouseenter', () => {
      this.pokegearToggle.style.transform = 'scale(1.1)';
      this.pokegearToggle.style.boxShadow = '0 10px 50px rgba(99, 102, 241, 0.6)';
    });
    this.pokegearToggle.addEventListener('mouseleave', () => {
      this.pokegearToggle.style.transform = 'scale(1)';
      this.pokegearToggle.style.boxShadow = '0 10px 40px rgba(99, 102, 241, 0.4)';
    });
  }

  /**
   * Met à jour les boutons du Pokégear
   */
  updatePokegearButtons() {
    const container = document.getElementById('pokegear-buttons');
    if (!container) return;

    const buttons = [
      { id: 'team', icon: 'group', label: 'ÉQUIPE', locked: !this.ui.unlockedFeatures.team },
      { id: 'bag', icon: 'backpack', label: 'SAC', locked: false },
      { id: 'pokedex', icon: 'menu_book', label: 'POKÉDEX', locked: !this.ui.unlockedFeatures.pokedex },
      { id: 'storage', icon: 'inventory_2', label: 'STOCKAGE', locked: !this.ui.unlockedFeatures.team },
      { id: 'save', icon: 'save', label: 'SAUVER', locked: false, special: 'save' },
      { id: 'settings', icon: 'settings', label: 'OPTIONS', locked: false },
    ];

    container.innerHTML = buttons.map(btn => {
      const lockedStyle = btn.locked ? 'opacity: 0.4; cursor: not-allowed;' : '';
      const specialStyle = btn.special === 'save' ? `
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1));
        border-color: rgba(16, 185, 129, 0.4);
        color: #10b981;
      ` : '';

      return `
        <button class="pokegear-btn" data-menu="${btn.id}" ${btn.locked ? 'disabled' : ''} style="
          width: 100%;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #f8fafc;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          gap: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          ${lockedStyle}
          ${specialStyle}
        ">
          <span class="material-symbols-rounded" style="font-size: 20px;">${btn.icon}</span>
          <span>${btn.label}</span>
          ${btn.locked ? '<span class="material-symbols-rounded" style="margin-left: auto; font-size: 16px;">lock</span>' : ''}
        </button>
      `;
    }).join('');

    // Events pour les boutons
    container.querySelectorAll('.pokegear-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const menu = btn.dataset.menu;
        if (btn.disabled) {
          this.showLockedMessage(menu);
          return;
        }
        this.handleMenuAction(menu);
      });

      // Hover effect
      btn.addEventListener('mouseenter', () => {
        if (!btn.disabled) {
          btn.style.background = 'rgba(99, 102, 241, 0.2)';
          btn.style.borderColor = '#6366f1';
          btn.style.transform = 'translateX(4px)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = btn.dataset.menu === 'save'
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))'
          : 'rgba(255, 255, 255, 0.05)';
        btn.style.borderColor = btn.dataset.menu === 'save'
          ? 'rgba(16, 185, 129, 0.4)'
          : 'rgba(255, 255, 255, 0.1)';
        btn.style.transform = 'translateX(0)';
      });
    });
  }

  /**
   * Toggle le Pokégear
   */
  togglePokegear() {
    this.pokegearVisible = !this.pokegearVisible;

    if (this.pokegearVisible) {
      this.pokegearMenu.style.opacity = '1';
      this.pokegearMenu.style.visibility = 'visible';
      this.pokegearMenu.style.transform = 'translateY(0) scale(1)';
      this.pokegearToggle.style.background = 'linear-gradient(135deg, #ec4899, #db2777)';
      this.pokegearToggle.innerHTML = '<span class="material-symbols-rounded">close</span>';
    } else {
      this.pokegearMenu.style.opacity = '0';
      this.pokegearMenu.style.visibility = 'hidden';
      this.pokegearMenu.style.transform = 'translateY(20px) scale(0.95)';
      this.pokegearToggle.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)';
      this.pokegearToggle.innerHTML = '<span class="material-symbols-rounded">smartphone</span>';

      // Fermer les menus ouverts
      this.closeAllMenus();
    }
  }

  /**
   * Gère les actions du menu
   */
  handleMenuAction(menu) {
    this.togglePokegear();

    switch (menu) {
      case 'team':
        this.ui.openMenu('team');
        break;
      case 'bag':
        this.ui.openMenu('bag');
        break;
      case 'pokedex':
        this.ui.openMenu('pokedex');
        break;
      case 'storage':
        this.ui.showPC();
        break;
      case 'save':
        this.ui.saveGame();
        break;
      case 'settings':
        this.ui.openMenu('settings');
        break;
    }
  }

  /**
   * Affiche un message pour feature verrouillée
   */
  showLockedMessage(feature) {
    const messages = {
      team: "Obtiens d'abord un Pokémon !",
      pokedex: "Obtiens d'abord le Pokédex !",
      storage: "Obtiens d'abord un Pokémon !",
    };
    this.showNotification(messages[feature] || "Non disponible", "error");
  }

  /**
   * Met à jour l'horloge
   */
  updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('pokegear-time');
    if (timeEl) {
      timeEl.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
  }

  /**
   * Met à jour les infos du joueur
   */
  updatePlayerInfo(name, money) {
    const nameEl = document.getElementById('modern-player-name');
    const moneyEl = document.getElementById('modern-player-money');

    if (nameEl) {
      nameEl.innerHTML = `
        <span style="width: 8px; height: 8px; background: #10b981; border-radius: 999px; box-shadow: 0 0 8px #10b981;"></span>
        ${name.toUpperCase()}
      `;
    }
    if (moneyEl) {
      moneyEl.textContent = `${money} ¥`;
    }
  }

  /**
   * Affiche l'indice d'interaction
   */
  showInteractionHint(text = null) {
    if (text) {
      this.interactionHint.innerHTML = `
        <span style="margin-right: 8px;">${text}</span>
        <kbd style="
          background: rgba(99, 102, 241, 0.3);
          padding: 4px 10px;
          border-radius: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 600;
        ">E</kbd>
      `;
    }
    this.interactionHint.style.display = 'block';
  }

  /**
   * Cache l'indice d'interaction
   */
  hideInteractionHint() {
    this.interactionHint.style.display = 'none';
  }

  /**
   * Ferme tous les menus
   */
  closeAllMenus() {
    document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('visible'));
    this.currentMenu = null;
  }

  /**
   * Affiche une notification moderne
   */
  showNotification(message, type = 'success') {
    // Supprimer les anciennes notifications
    document.querySelectorAll('.modern-notification').forEach(n => n.remove());

    const notif = document.createElement('div');
    notif.className = `modern-notification ${type}`;
    notif.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      padding: 16px 28px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9));
      backdrop-filter: blur(16px);
      border: 1px solid ${type === 'error' ? 'rgba(239, 68, 68, 0.5)' : type === 'info' ? 'rgba(99, 102, 241, 0.5)' : 'rgba(16, 185, 129, 0.5)'};
      border-radius: 999px;
      color: #f8fafc;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      opacity: 0;
      animation: notifSlideIn 0.4s ease forwards;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    `;

    const icon = type === 'error' ? 'error' : type === 'info' ? 'info' : 'check_circle';
    const iconColor = type === 'error' ? '#ef4444' : type === 'info' ? '#6366f1' : '#10b981';

    notif.innerHTML = `
      <span class="material-symbols-rounded" style="color: ${iconColor}; font-weight: bold;">${icon}</span>
      <span>${message}</span>
    `;

    // Ajouter l'animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes notifSlideIn {
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notif);

    // Auto-remove
    setTimeout(() => {
      notif.style.opacity = '0';
      notif.style.transform = 'translateX(-50%) translateY(-20px)';
      notif.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        notif.remove();
        style.remove();
      }, 300);
    }, 2500);
  }

  /**
   * Rafraîchit les boutons après un déverrouillage
   */
  refresh() {
    this.updatePokegearButtons();
  }
}
