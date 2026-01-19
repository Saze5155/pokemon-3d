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

      // Styles inline supplémentaires pour les statuts
      const style = document.createElement('style');
      style.innerHTML = `
        .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
            color: white;
            text-transform: uppercase;
            margin-left: 8px;
            vertical-align: middle;
            text-shadow: 1px 1px 0 rgba(0,0,0,0.5);
        }
        .status-poison { background-color: #a040a0; }
        .status-paralysis { background-color: #f8d030; color: #444; text-shadow: none; }
        .status-sleep { background-color: #8c888c; }
        .status-burn { background-color: #f08030; }
        .status-freeze { background-color: #98d8d8; color: #444; text-shadow: none; }
      `;
      document.head.appendChild(style);
    }
  }

  show(playerPokemon, enemyPokemon, isTrainerBattle = false) {
    this.playerPokemon = playerPokemon;
    this.enemyPokemon = enemyPokemon;
    this.isTrainerBattle = isTrainerBattle;
    this.isVisible = true;

    this.hide();

    this.container = document.createElement('div');
    this.container.id = 'modern-combat-ui';
    this.container.className = 'modern-ui';

    // HUDs
    this.enemyInfo = this.createPokemonInfo(enemyPokemon, 'enemy');
    document.body.appendChild(this.enemyInfo);

    this.playerInfo = this.createPokemonInfo(playerPokemon, 'player', true);
    document.body.appendChild(this.playerInfo);

    // Bottom Screen (Gen 5 Touch Screen)
    const bottomScreen = document.createElement('div');
    bottomScreen.id = 'gen5-bottom-screen';

    // Dialogue Box (Overlay text on bottom screen)
    this.dialogueBox = document.createElement('div');
    this.dialogueBox.className = 'combat-dialogue-box';
    this.dialogueBox.innerHTML = `
      <div class="combat-dialogue-text" id="combat-dialogue-text">
        Que va faire ${this.getPokemonName(playerPokemon)} ?
      </div>
    `;
    bottomScreen.appendChild(this.dialogueBox);

    // Actions Container (The Grid)
    this.actionsContainer = document.createElement('div');
    this.actionsContainer.className = 'combat-actions-container';
    this.actionsContainer.innerHTML = this.renderMainMenu();
    bottomScreen.appendChild(this.actionsContainer);

    this.container.appendChild(bottomScreen);
    document.body.appendChild(this.container);

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

    // Gestion du statut
    let statusHtml = '';
    if (pokemon.status) {
        // Mappage code statut -> libellé court
        const statusLabels = {
            'poison': 'PSN',
            'paralysis': 'PAR',
            'sleep': 'SLP',
            'burn': 'BRN',
            'freeze': 'FRZ'
        };
        const label = statusLabels[pokemon.status] || pokemon.status.toUpperCase().substring(0, 3);
        const colorClass = pokemon.status.toLowerCase(); // CSS pour couleur (via css status-poison, etc.)
        statusHtml = `<span class="status-badge status-${colorClass}">${label}</span>`;
    }

    let html = `
      <div class="combat-pokemon-name">${this.getPokemonName(pokemon)} ${statusHtml}</div>
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
    const runText = this.isTrainerBattle ? 'DUEL' : 'FUITE';

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
    // FIX: Utiliser le standard 'inventory' et non 'bag' (le SaveManager utilise inventory)
    const inventory = this.uiManager.playerData.inventory || {};
    const itemManager = this.combatManager.itemManager; // On a besoin de l'ItemManager pour les noms et infos

    console.log("🎒 [ModernCombatUI] renderBagMenu - Inventory:", inventory);
    console.log("📋 [ModernCombatUI] ItemManager exists?", !!itemManager);

    // Liste des items utilisables en combat (pourrait être dans ItemManager.getBattleItems())
    // On itère sur l'inventaire et on vérifie si l'item existe
    let itemsHtml = '';
    
    for (const [itemId, count] of Object.entries(inventory)) {
      console.log(`🔍 Checking item: ${itemId}, count: ${count}`);
      if (count <= 0) continue;
      
      const item = itemManager ? itemManager.getItem(itemId) : null;
      console.log(`   -> Found in Manager?`, item ? `YES (Cat: ${item.category})` : "NO");

      // FIX: Check plurals and singulars (Match objets.json keys!)
      // Categories in JSON: "pokeballs", "soins", "pierres", "boosts_combat", "vitamines", "repousses", "peche", "divers"
      const validCategories = [
          "soin", "soins", 
          "statut", "status", 
          "ball", "balls", "pokeballs", // objets.json uses "pokeballs"
          "combat", "boosts_combat"     // objets.json uses "boosts_combat"
      ];
      
      if (item && validCategories.includes(item.category)) {
          itemsHtml += `
            <button class="combat-item-btn" data-action="use_item" data-item-id="${itemId}">
              <div class="combat-item-icon">💊</div>
              <div class="combat-item-details">
                  <div class="combat-item-name">${item.nom}</div>
                  <div class="combat-item-desc">${item.description || "Objet"}</div>
              </div>
              <div class="combat-item-count">×${count}</div>
            </button>
          `;
      }
    }

    if (!itemsHtml) {
      itemsHtml = '<div style="grid-column: span 2; text-align: center; color: #64748b; padding: 20px;">Sac vide</div>';
    }

    return `
      <div class="combat-items-grid" id="combat-actions">
        ${itemsHtml}
        <button class="combat-back-btn" data-action="back" style="grid-column: span 2;">← RETOUR</button>
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
        // FIX: useItem attend itemId
        this.combatManager.useItem(data.itemId);
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
    // FIX: Utiliser la référence à jour du CombatManager
    const enemyPokemon = this.combatManager.wildPokemon || this.enemyPokemon;
    const enemyHp = this.getPokemonHp(enemyPokemon);
    const enemyMaxHp = this.getPokemonMaxHp(enemyPokemon);
    const enemyPercent = (enemyHp / enemyMaxHp) * 100;
    const enemyHpClass = enemyPercent < 25 ? 'critical' : enemyPercent < 50 ? 'low' : '';

    const enemyInfo = document.getElementById('combat-enemy-info');
    if (enemyInfo) {
      const hpBar = enemyInfo.querySelector('.combat-hp-bar');
      const hpText = enemyInfo.querySelector('.combat-hp-text');
      // FIX: Update Name and Level
      const nameText = enemyInfo.querySelector('.combat-pokemon-name');
      const levelText = enemyInfo.querySelector('.combat-pokemon-level');

      if (hpBar) {
        hpBar.style.width = `${enemyPercent}%`;
        hpBar.className = `combat-hp-bar ${enemyHpClass}`;
      }
      if (hpText) {
        hpText.textContent = `PV: ${enemyHp} / ${enemyMaxHp}`;
      }
      // FIX: Force update text content with status
      if (nameText) {
          let statusHtml = '';
          if (enemyPokemon.status) {
              const statusLabels = { 'poison': 'PSN', 'paralysis': 'PAR', 'sleep': 'SLP', 'burn': 'BRN', 'freeze': 'FRZ' };
              const label = statusLabels[enemyPokemon.status] || enemyPokemon.status.toUpperCase().substring(0, 3);
              const colorClass = enemyPokemon.status.toLowerCase();
              statusHtml = `<span class="status-badge status-${colorClass}">${label}</span>`;
          }
          nameText.innerHTML = `${this.getPokemonName(enemyPokemon)} ${statusHtml}`;
      }
      if (levelText) levelText.textContent = `Niv. ${this.getPokemonLevel(enemyPokemon)}`;
    }

    // Joueur
    // FIX: Utiliser la référence à jour du CombatManager
    const playerPokemon = this.combatManager.playerPokemon || this.playerPokemon;
    const playerHp = this.getPokemonHp(playerPokemon);
    const playerMaxHp = this.getPokemonMaxHp(playerPokemon);
    const playerPercent = (playerHp / playerMaxHp) * 100;
    const playerHpClass = playerPercent < 25 ? 'critical' : playerPercent < 50 ? 'low' : '';

    const playerInfo = document.getElementById('combat-player-info');
    if (playerInfo) {
      const hpBar = playerInfo.querySelector('.combat-hp-bar');
      const hpText = playerInfo.querySelector('.combat-hp-text');
       // FIX: Update Name and Level
      const nameText = playerInfo.querySelector('.combat-pokemon-name');
      const levelText = playerInfo.querySelector('.combat-pokemon-level');

      if (hpBar) {
        hpBar.style.width = `${playerPercent}%`;
        hpBar.className = `combat-hp-bar ${playerHpClass}`;
      }
      if (hpText) {
        hpText.textContent = `PV: ${playerHp} / ${playerMaxHp}`;
      }
      // FIX: Force update text content with status
      if (nameText) {
          let statusHtml = '';
          if (playerPokemon.status) {
              const statusLabels = { 'poison': 'PSN', 'paralysis': 'PAR', 'sleep': 'SLP', 'burn': 'BRN', 'freeze': 'FRZ' };
              const label = statusLabels[playerPokemon.status] || playerPokemon.status.toUpperCase().substring(0, 3);
              const colorClass = playerPokemon.status.toLowerCase();
              statusHtml = `<span class="status-badge status-${colorClass}">${label}</span>`;
          }
          nameText.innerHTML = `${this.getPokemonName(playerPokemon)} ${statusHtml}`;
      }
      if (levelText) levelText.textContent = `Niv. ${this.getPokemonLevel(playerPokemon)}`;
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
    // FIX: Préférer .level (mis à jour par XPManager) à .niveau
    return pokemon?.level || pokemon?.niveau || 5;
  }

  getPokemonHp(pokemon) {
    return pokemon?.stats?.hp ?? pokemon?.hp ?? 0;
  }

  getPokemonMaxHp(pokemon) {
    return pokemon?.stats?.hpMax ?? pokemon?.maxHp ?? 1;
  }
}
