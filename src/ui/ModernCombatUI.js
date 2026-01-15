/**
 * ModernCombatUI.js - Interface de combat moderne
 * Glassmorphism, animations fluides, UX améliorée
 */

export class ModernCombatUI {
  constructor(combatManager, uiManager) {
    this.combatManager = combatManager;
    this.uiManager = uiManager;
    this.container = null;
    this.isVisible = false;

    // Injecter le CSS moderne
    this.injectCSS();
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

    // CSS spécifique au combat
    if (!document.getElementById('combat-ui-styles')) {
      const style = document.createElement('style');
      style.id = 'combat-ui-styles';
      style.textContent = `
        #modern-combat-ui {
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
          z-index: 1000;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          animation: combatUISlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes combatUISlideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .combat-pokemon-info {
          position: fixed;
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9));
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          min-width: 240px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
          animation: pokemonInfoFadeIn 0.5s ease;
        }

        @keyframes pokemonInfoFadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .combat-pokemon-info.enemy {
          top: 80px;
          left: 40px;
        }

        .combat-pokemon-info.player {
          top: 80px;
          right: 40px;
        }

        .combat-pokemon-name {
          font-size: 16px;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 4px;
        }

        .combat-pokemon-level {
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 12px;
        }

        .combat-hp-container {
          background: rgba(0, 0, 0, 0.4);
          border-radius: 999px;
          padding: 3px;
          margin-bottom: 6px;
        }

        .combat-hp-bar {
          height: 14px;
          border-radius: 999px;
          background: linear-gradient(90deg, #10b981, #34d399);
          transition: width 0.5s ease, background 0.3s ease;
          position: relative;
        }

        .combat-hp-bar::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,0.3), transparent);
          border-radius: 999px 999px 0 0;
        }

        .combat-hp-bar.low {
          background: linear-gradient(90deg, #f59e0b, #fbbf24);
        }

        .combat-hp-bar.critical {
          background: linear-gradient(90deg, #ef4444, #f87171);
          animation: hpCriticalPulse 0.5s ease-in-out infinite;
        }

        @keyframes hpCriticalPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .combat-hp-text {
          font-size: 11px;
          color: #94a3b8;
          font-family: 'JetBrains Mono', monospace;
        }

        .combat-xp-bar {
          height: 6px;
          margin-top: 8px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 999px;
          overflow: hidden;
        }

        .combat-xp-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #818cf8);
          transition: width 0.5s ease;
        }

        .combat-menu-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 16px 20px 20px;
        }

        .combat-dialogue-box {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9));
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px 16px 0 0;
          padding: 16px 24px;
          margin-bottom: -1px;
        }

        .combat-dialogue-text {
          font-size: 15px;
          color: #f8fafc;
          line-height: 1.6;
        }

        .combat-actions-container {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95));
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0 0 20px 20px;
          padding: 20px;
        }

        .combat-actions-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .combat-action-btn {
          padding: 18px 24px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.05));
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 12px;
          color: #f8fafc;
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          gap: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .combat-action-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(99, 102, 241, 0.15));
          border-color: #6366f1;
          transform: scale(1.02);
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
        }

        .combat-action-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .combat-action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .combat-action-btn.attack {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1));
          border-color: rgba(239, 68, 68, 0.4);
        }

        .combat-action-btn.attack:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.2));
          border-color: #ef4444;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
        }

        .combat-action-btn.bag {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1));
          border-color: rgba(245, 158, 11, 0.4);
        }

        .combat-action-btn.bag:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(245, 158, 11, 0.2));
          border-color: #f59e0b;
          box-shadow: 0 0 20px rgba(245, 158, 11, 0.3);
        }

        .combat-action-btn.pokemon {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1));
          border-color: rgba(16, 185, 129, 0.4);
        }

        .combat-action-btn.pokemon:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.2));
          border-color: #10b981;
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
        }

        .combat-action-icon {
          font-size: 22px;
        }

        /* Moves Grid */
        .combat-moves-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .combat-move-btn {
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #f8fafc;
          font-family: inherit;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.25s ease;
          text-align: left;
        }

        .combat-move-btn:hover {
          background: rgba(99, 102, 241, 0.2);
          border-color: #6366f1;
          transform: translateY(-2px);
        }

        .combat-move-name {
          font-weight: 600;
          margin-bottom: 4px;
          text-transform: uppercase;
        }

        .combat-move-info {
          font-size: 11px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .combat-move-type {
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .combat-move-power {
          color: #f59e0b;
          font-weight: 600;
        }

        /* Type colors */
        .type-normal { background: rgba(168, 168, 120, 0.3); color: #a8a878; }
        .type-fire, .type-feu { background: rgba(240, 128, 48, 0.3); color: #f08030; }
        .type-water, .type-eau { background: rgba(104, 144, 240, 0.3); color: #6890f0; }
        .type-grass, .type-plante { background: rgba(120, 200, 80, 0.3); color: #78c850; }
        .type-electric, .type-electrik { background: rgba(248, 208, 48, 0.3); color: #f8d030; }
        .type-ice, .type-glace { background: rgba(152, 216, 216, 0.3); color: #98d8d8; }
        .type-fighting, .type-combat { background: rgba(192, 48, 40, 0.3); color: #c03028; }
        .type-poison { background: rgba(160, 64, 160, 0.3); color: #a040a0; }
        .type-ground, .type-sol { background: rgba(224, 192, 104, 0.3); color: #e0c068; }
        .type-flying, .type-vol { background: rgba(168, 144, 240, 0.3); color: #a890f0; }
        .type-psychic, .type-psy { background: rgba(248, 88, 136, 0.3); color: #f85888; }
        .type-bug, .type-insecte { background: rgba(168, 184, 32, 0.3); color: #a8b820; }
        .type-rock, .type-roche { background: rgba(184, 160, 56, 0.3); color: #b8a038; }
        .type-ghost, .type-spectre { background: rgba(112, 88, 152, 0.3); color: #705898; }
        .type-dragon { background: rgba(112, 56, 248, 0.3); color: #7038f8; }

        .combat-back-btn {
          grid-column: span 2;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #94a3b8;
          font-family: inherit;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
        }

        .combat-back-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #f8fafc;
        }

        /* Pokemon Selection */
        .combat-pokemon-select {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .combat-pokemon-card {
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.25s ease;
          text-align: center;
        }

        .combat-pokemon-card:hover:not(.fainted) {
          background: rgba(99, 102, 241, 0.2);
          border-color: #6366f1;
          transform: translateY(-4px);
        }

        .combat-pokemon-card.fainted {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .combat-pokemon-card.active {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
        }

        /* Items */
        .combat-items-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .combat-item-btn {
          padding: 14px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #f8fafc;
          font-family: inherit;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.25s ease;
          text-align: center;
        }

        .combat-item-btn:hover {
          background: rgba(245, 158, 11, 0.2);
          border-color: #f59e0b;
        }

        .combat-item-count {
          color: #f59e0b;
          font-weight: 700;
          margin-top: 4px;
        }

        @media (max-width: 768px) {
          .combat-actions-grid {
            grid-template-columns: 1fr;
          }

          .combat-moves-grid {
            grid-template-columns: 1fr;
          }

          .combat-pokemon-info {
            min-width: 180px;
            padding: 12px 16px;
          }

          .combat-pokemon-info.enemy {
            left: 20px;
          }

          .combat-pokemon-info.player {
            right: 20px;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Affiche l'UI de combat moderne
   */
  show(playerPokemon, enemyPokemon, isTrainerBattle = false) {
    this.playerPokemon = playerPokemon;
    this.enemyPokemon = enemyPokemon;
    this.isTrainerBattle = isTrainerBattle;
    this.isVisible = true;

    // Supprimer l'ancien UI si existe
    this.hide();

    // Créer le conteneur principal
    this.container = document.createElement('div');
    this.container.id = 'modern-combat-ui';
    this.container.className = 'modern-ui';

    // Info Pokémon ennemi (haut gauche)
    this.enemyInfo = this.createPokemonInfo(enemyPokemon, 'enemy');
    document.body.appendChild(this.enemyInfo);

    // Info Pokémon joueur (haut droite)
    this.playerInfo = this.createPokemonInfo(playerPokemon, 'player', true);
    document.body.appendChild(this.playerInfo);

    // Menu de combat (bas)
    const menuContainer = document.createElement('div');
    menuContainer.className = 'combat-menu-container';

    // Dialogue
    this.dialogueBox = document.createElement('div');
    this.dialogueBox.className = 'combat-dialogue-box';
    this.dialogueBox.innerHTML = `
      <div class="combat-dialogue-text" id="combat-dialogue-text">
        Que va faire ${this.getPokemonName(playerPokemon)} ?
      </div>
    `;
    menuContainer.appendChild(this.dialogueBox);

    // Actions
    this.actionsContainer = document.createElement('div');
    this.actionsContainer.className = 'combat-actions-container';
    this.actionsContainer.innerHTML = this.renderMainMenu();
    menuContainer.appendChild(this.actionsContainer);

    this.container.appendChild(menuContainer);
    document.body.appendChild(this.container);

    // Setup events
    this.setupEvents();
  }

  /**
   * Crée l'info box d'un Pokémon
   */
  createPokemonInfo(pokemon, type, showXP = false) {
    const hp = this.getPokemonHp(pokemon);
    const maxHp = this.getPokemonMaxHp(pokemon);
    const hpPercent = (hp / maxHp) * 100;
    const hpClass = hpPercent < 25 ? 'critical' : hpPercent < 50 ? 'low' : '';

    const div = document.createElement('div');
    div.className = `combat-pokemon-info ${type}`;
    div.id = `combat-${type}-info`;

    let html = `
      <div class="combat-pokemon-name">${this.getPokemonName(pokemon)}</div>
      <div class="combat-pokemon-level">Niv. ${this.getPokemonLevel(pokemon)}</div>
      <div class="combat-hp-container">
        <div class="combat-hp-bar ${hpClass}" style="width: ${hpPercent}%"></div>
      </div>
      <div class="combat-hp-text">PV: ${hp} / ${maxHp}</div>
    `;

    if (showXP && pokemon.xp !== undefined) {
      const xpPercent = (pokemon.xp / (pokemon.xpToNextLevel || 100)) * 100;
      html += `
        <div class="combat-xp-bar">
          <div class="combat-xp-fill" style="width: ${Math.min(100, xpPercent)}%"></div>
        </div>
      `;
    }

    div.innerHTML = html;
    return div;
  }

  /**
   * Rend le menu principal
   */
  renderMainMenu() {
    const runDisabled = this.isTrainerBattle;
    const runText = this.isTrainerBattle ? '🚫 DUEL' : '🏃 FUITE';

    return `
      <div class="combat-actions-grid" id="combat-actions">
        <button class="combat-action-btn attack" data-action="attack">
          <span class="combat-action-icon">⚔️</span>
          <span>ATTAQUE</span>
        </button>
        <button class="combat-action-btn bag" data-action="bag">
          <span class="combat-action-icon">🎒</span>
          <span>SAC</span>
        </button>
        <button class="combat-action-btn pokemon" data-action="pokemon">
          <span class="combat-action-icon">🔄</span>
          <span>ÉQUIPE</span>
        </button>
        <button class="combat-action-btn" data-action="run" ${runDisabled ? 'disabled' : ''}>
          <span class="combat-action-icon">${this.isTrainerBattle ? '🚫' : '🏃'}</span>
          <span>${runText}</span>
        </button>
      </div>
    `;
  }

  /**
   * Rend le menu des attaques
   */
  renderAttackMenu() {
    const moves = this.playerPokemon.attaques || this.playerPokemon.moves || [];
    const moveManager = this.combatManager.moveManager;

    let movesHtml = moves.map((moveId, index) => {
      if (!moveId) return '';

      const move = moveManager ? moveManager.getMove(moveId) : null;
      const moveName = move?.nom || moveId.replace(/_/g, ' ');
      const moveType = move?.type || 'normal';
      const movePower = move?.puissance || '—';

      return `
        <button class="combat-move-btn" data-action="use_move" data-move-id="${moveId}" data-move-index="${index}">
          <div class="combat-move-name">${moveName}</div>
          <div class="combat-move-info">
            <span class="combat-move-type type-${moveType}">${moveType}</span>
            <span class="combat-move-power">${movePower > 0 ? `PWR ${movePower}` : 'STATUT'}</span>
          </div>
        </button>
      `;
    }).join('');

    return `
      <div class="combat-moves-grid" id="combat-actions">
        ${movesHtml}
        <button class="combat-back-btn" data-action="back">← RETOUR</button>
      </div>
    `;
  }

  /**
   * Rend le menu du sac
   */
  renderBagMenu() {
    const bag = this.uiManager.playerData.bag;
    const usableItems = ['pokeball', 'superball', 'hyperball', 'masterball', 'potion', 'super_potion', 'hyper_potion', 'potion_max'];

    let itemsHtml = '';
    for (const [key, count] of Object.entries(bag)) {
      if (count <= 0) continue;
      if (!usableItems.some(item => key.includes(item))) continue;

      const displayName = key.replace(/_/g, ' ').toUpperCase();
      itemsHtml += `
        <button class="combat-item-btn" data-action="use_item" data-item-key="${key}">
          <div>${displayName}</div>
          <div class="combat-item-count">×${count}</div>
        </button>
      `;
    }

    if (!itemsHtml) {
      itemsHtml = '<div style="grid-column: span 3; text-align: center; color: #64748b; padding: 20px;">Aucun objet utilisable</div>';
    }

    return `
      <div class="combat-items-grid" id="combat-actions">
        ${itemsHtml}
        <button class="combat-back-btn" data-action="back" style="grid-column: span 3;">← RETOUR</button>
      </div>
    `;
  }

  /**
   * Rend le menu de changement de Pokémon
   */
  renderPokemonMenu() {
    const team = this.uiManager.playerData.team;

    let pokemonHtml = team.map((pokemon, index) => {
      if (!pokemon) return '';

      const hp = this.getPokemonHp(pokemon);
      const maxHp = this.getPokemonMaxHp(pokemon);
      const hpPercent = (hp / maxHp) * 100;
      const isFainted = hp <= 0;
      const isActive = pokemon.name === this.playerPokemon.name;
      const hpClass = hpPercent < 25 ? 'critical' : hpPercent < 50 ? 'low' : '';

      return `
        <div class="combat-pokemon-card ${isFainted ? 'fainted' : ''} ${isActive ? 'active' : ''}"
             data-action="${!isFainted && !isActive ? 'switch_pokemon' : ''}"
             data-pokemon-index="${index}">
          <div style="font-size: 13px; font-weight: 600; color: #f8fafc; margin-bottom: 4px;">
            ${this.getPokemonName(pokemon)}
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
            Niv. ${this.getPokemonLevel(pokemon)}
          </div>
          <div class="combat-hp-container" style="height: 8px;">
            <div class="combat-hp-bar ${hpClass}" style="width: ${hpPercent}%; height: 100%;"></div>
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
            ${hp}/${maxHp}
          </div>
          ${isActive ? '<div style="font-size: 9px; color: #f59e0b; margin-top: 4px;">EN COMBAT</div>' : ''}
          ${isFainted ? '<div style="font-size: 9px; color: #ef4444; margin-top: 4px;">K.O.</div>' : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="combat-pokemon-select" id="combat-actions">
        ${pokemonHtml}
        <button class="combat-back-btn" data-action="back" style="grid-column: span 3;">← RETOUR</button>
      </div>
    `;
  }

  /**
   * Setup les event listeners
   */
  setupEvents() {
    this.actionsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      this.handleAction(action, btn.dataset);
    });
  }

  /**
   * Gère les actions
   */
  handleAction(action, data) {
    switch (action) {
      case 'attack':
        this.showAttackMenu();
        break;
      case 'bag':
        this.showBagMenu();
        break;
      case 'pokemon':
        this.showPokemonMenu();
        break;
      case 'run':
        if (!this.isTrainerBattle) {
          this.combatManager.attemptRun();
        }
        break;
      case 'use_move':
        this.combatManager.executePlayerMove(data.moveId);
        this.showMainMenu();
        break;
      case 'use_item':
        this.combatManager.useCombatItem(data.itemKey);
        this.showMainMenu();
        break;
      case 'switch_pokemon':
        const index = parseInt(data.pokemonIndex);
        if (!isNaN(index)) {
          this.combatManager.switchPokemon(index);
          this.showMainMenu();
        }
        break;
      case 'back':
        this.showMainMenu();
        break;
    }
  }

  /**
   * Affiche le menu principal
   */
  showMainMenu() {
    this.actionsContainer.innerHTML = this.renderMainMenu();
    this.setupEvents();
    this.setDialogue(`Que va faire ${this.getPokemonName(this.playerPokemon)} ?`);
  }

  /**
   * Affiche le menu d'attaque
   */
  showAttackMenu() {
    this.actionsContainer.innerHTML = this.renderAttackMenu();
    this.setupEvents();
    this.setDialogue('Quelle attaque utiliser ?');
  }

  /**
   * Affiche le menu du sac
   */
  showBagMenu() {
    this.actionsContainer.innerHTML = this.renderBagMenu();
    this.setupEvents();
    this.setDialogue('Quel objet utiliser ?');
  }

  /**
   * Affiche le menu de changement de Pokémon
   */
  showPokemonMenu() {
    this.actionsContainer.innerHTML = this.renderPokemonMenu();
    this.setupEvents();
    this.setDialogue('Quel Pokémon envoyer ?');
  }

  /**
   * Met à jour le dialogue
   */
  setDialogue(text) {
    const el = document.getElementById('combat-dialogue-text');
    if (el) {
      el.innerHTML = text;
    }
  }

  /**
   * Met à jour les barres de PV
   */
  updateHP() {
    // Ennemi
    const enemyHp = this.getPokemonHp(this.enemyPokemon);
    const enemyMaxHp = this.getPokemonMaxHp(this.enemyPokemon);
    const enemyPercent = (enemyHp / enemyMaxHp) * 100;
    const enemyHpClass = enemyPercent < 25 ? 'critical' : enemyPercent < 50 ? 'low' : '';

    const enemyInfo = document.getElementById('combat-enemy-info');
    if (enemyInfo) {
      const hpBar = enemyInfo.querySelector('.combat-hp-bar');
      const hpText = enemyInfo.querySelector('.combat-hp-text');
      if (hpBar) {
        hpBar.style.width = `${enemyPercent}%`;
        hpBar.className = `combat-hp-bar ${enemyHpClass}`;
      }
      if (hpText) {
        hpText.textContent = `PV: ${enemyHp} / ${enemyMaxHp}`;
      }
    }

    // Joueur
    const playerHp = this.getPokemonHp(this.playerPokemon);
    const playerMaxHp = this.getPokemonMaxHp(this.playerPokemon);
    const playerPercent = (playerHp / playerMaxHp) * 100;
    const playerHpClass = playerPercent < 25 ? 'critical' : playerPercent < 50 ? 'low' : '';

    const playerInfo = document.getElementById('combat-player-info');
    if (playerInfo) {
      const hpBar = playerInfo.querySelector('.combat-hp-bar');
      const hpText = playerInfo.querySelector('.combat-hp-text');
      if (hpBar) {
        hpBar.style.width = `${playerPercent}%`;
        hpBar.className = `combat-hp-bar ${playerHpClass}`;
      }
      if (hpText) {
        hpText.textContent = `PV: ${playerHp} / ${playerMaxHp}`;
      }
    }
  }

  /**
   * Cache l'UI de combat
   */
  hide() {
    this.isVisible = false;

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    if (this.enemyInfo) {
      this.enemyInfo.remove();
      this.enemyInfo = null;
    }
    if (this.playerInfo) {
      this.playerInfo.remove();
      this.playerInfo = null;
    }

    // Supprimer aussi l'ancien UI s'il existe
    const oldUI = document.getElementById('combat-ui');
    if (oldUI) oldUI.remove();
  }

  // Helpers
  getPokemonName(pokemon) {
    return pokemon?.surnom || pokemon?.nom || pokemon?.name || '???';
  }

  getPokemonLevel(pokemon) {
    return pokemon?.niveau || pokemon?.level || 5;
  }

  getPokemonHp(pokemon) {
    return pokemon?.stats?.hp ?? pokemon?.hp ?? 0;
  }

  getPokemonMaxHp(pokemon) {
    return pokemon?.stats?.hpMax ?? pokemon?.maxHp ?? 1;
  }
}
