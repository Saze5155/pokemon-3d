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
    // Styles gérés par CSS (#modern-hud)

    // Info joueur (haut gauche)
    this.playerInfo = document.createElement('div');
    this.playerInfo.id = 'modern-player-info';
    // Styles gérés par CSS (#modern-player-info)
    
    this.playerInfo.innerHTML = `
      <div id="modern-player-name">
        <span style="width: 10px; height: 10px; background: #10b981; border: 2px solid #fff;"></span>
        DRESSEUR
      </div>
      <div id="modern-player-money">3000 ¥</div>
    `;
    this.hud.appendChild(this.playerInfo);

    // Indice d'interaction (bas centre)
    this.interactionHint = document.createElement('div');
    this.interactionHint.id = 'modern-interaction-hint';
    // Styles gérés par CSS (#modern-interaction-hint)

    this.interactionHint.innerHTML = `
      <span style="margin-right: 8px;">INTERAGIR :</span>
      <kbd style="border: 2px solid #fff; padding: 2px 6px;">E</kbd>
    `;

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
    // Styles gérés par CSS (#modern-pokegear)

    // Bouton toggle
    this.pokegearToggle = document.createElement('button');
    this.pokegearToggle.id = 'pokegear-toggle';
    // Styles gérés par CSS (#pokegear-toggle)
    
    this.pokegearToggle.innerHTML = '<span class="material-symbols-rounded">smartphone</span>';
    this.pokegearToggle.title = 'Pokégear (TAB)';
    this.pokegear.appendChild(this.pokegearToggle);

    // Menu du Pokégear
    this.pokegearMenu = document.createElement('div');
    this.pokegearMenu.id = 'pokegear-menu';
    // Styles gérés par CSS (#pokegear-menu)

    // Horloge
    this.pokegearMenu.innerHTML = `
      <div id="pokegear-time" style="
        text-align: center;
        padding: 5px;
        margin-bottom: 10px;
        background: #000;
        border: 2px solid #fff;
        font-family: 'VT323', monospace;
        font-size: 32px;
        color: var(--theme-blue);
      ">12:00</div>
      <div id="pokegear-buttons">
        <!-- Boutons ajoutés dynamiquement -->
      </div>
    `;
    this.pokegear.appendChild(this.pokegearMenu);

    document.body.appendChild(this.pokegear);

    // Ajouter les boutons
    this.updatePokegearButtons();

    // Events
    this.pokegearToggle.addEventListener('click', () => this.togglePokegear());
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
      return `
        <button class="pokegear-btn" data-menu="${btn.id}" ${btn.locked ? 'disabled' : ''}>
          <span class="material-symbols-rounded">${btn.icon}</span>
          <span>${btn.label}</span>
          ${btn.locked ? '<span class="material-symbols-rounded" style="margin-left: auto;">lock</span>' : ''}
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
      // Hover effects removed (handled by CSS)
    });
  }

  /**
   * Toggle le Pokégear
   */
  togglePokegear() {
    this.pokegearVisible = !this.pokegearVisible;

    if (this.pokegearVisible) {
      this.pokegearMenu.classList.add('visible');
      this.pokegearToggle.innerHTML = '<span class="material-symbols-rounded">close</span>';
    } else {
      this.pokegearMenu.classList.remove('visible');
      this.pokegearToggle.innerHTML = '<span class="material-symbols-rounded">smartphone</span>';
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
    document.querySelectorAll('.menu-screen, .modern-menu-overlay').forEach(s => s.classList.remove('visible'));
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
  /**
   * Masque les éléments du HUD pendant le combat
   */
  hideForCombat() {
      if (this.hud) {
          this.hud.style.opacity = '0';
          this.hud.style.pointerEvents = 'none';
          this.hud.style.transition = 'opacity 0.3s ease';
      }
      if (this.pokegear) {
          this.pokegear.style.opacity = '0';
          this.pokegear.style.pointerEvents = 'none';
          this.pokegear.style.transition = 'opacity 0.3s ease';
      }
  }

  /**
   * Réaffiche les éléments du HUD après le combat
   */
  showAfterCombat() {
      if (this.hud) {
          this.hud.style.opacity = '1';
          this.hud.style.pointerEvents = 'all';
      }
      if (this.pokegear) {
          this.pokegear.style.opacity = '1';
          this.pokegear.style.pointerEvents = 'all';
      }
  }

  showResumeOverlay() {
      const overlay = document.createElement('div');
      overlay.id = 'resume-overlay';
      overlay.style.cssText = `
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 99999;
          cursor: pointer;
      `;
      overlay.innerHTML = `
          <div style="
              background: rgba(0, 0, 0, 0.8);
              padding: 20px 40px;
              border: 2px solid white;
              border-radius: 10px;
              color: white;
              font-family: 'Press Start 2P', monospace;
              font-size: 16px;
              text-align: center;
              animation: blink 1.5s infinite;
          ">
              CLIQUEZ POUR REPRENDRE
          </div>
      `;
      
      const style = document.createElement('style');
      style.textContent = `@keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`;
      document.head.appendChild(style);
      
      document.body.appendChild(overlay);
      
      overlay.addEventListener('click', () => {
          overlay.remove();
          style.remove();
          // FIX: Forcer le lock directement via l'InputManager
          if (this.ui && this.ui.game && this.ui.game.inputManager) {
              console.log("🔒 Tentative de verrouillage forcé du pointeur...");
              this.ui.game.inputManager.controls.lock();
          }
      });
  }
}
