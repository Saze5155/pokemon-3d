/**
 * UI.js - Système d'interface utilisateur
 *
 * Features:
 * - Écran titre obligatoire au démarrage (choix partie + nom)
 * - Bouton SAUVER dans le menu principal (avec Équipe, Sac, Pokédex...)
 * - Team selector caché si pas de Pokémon
 * - Sprites depuis spritesheets
 */

import { TutorialSystem } from './TutorialSystem.js';

export class UIManager {
  constructor() {
    this.watchVisible = false;
    this.currentMenu = null;
    this.selectedPokemonIndex = 0;

    // Référence au SaveManager (sera injectée)
    this.saveManager = null;
    
    // Système de tutoriels
    this.tutorialSystem = new TutorialSystem(this);

    // Configuration des sprites
    this.spriteConfig = {
      pokemon: {
        src: "../../assets/sprites/sprite_pokemon.png",
        width: 70,
        height: 58,
        cols: 10,
      },
      items: {
        src: "../../assets/sprites/sprite_objet.png",
        width: 34,
        height: 34,
        cols: 10,
      },
    };

    // Données du joueur
    this.playerData = {
      name: "Dresseur",
      money: 3000,
      team: [],
      bag: {},
      pokedex: { vus: [], captures: [] },
    };

    // État des déverrouillages
    this.unlockedFeatures = {
      team: false,
      bag: true, // Toujours dispo
      pokedex: false,
      map: false,
      save: true, // Toujours dispo
      settings: true, // Toujours dispo
    };

    // Callbacks
    this.onSaveSelected = null;
    this.onSaveGame = null;

    // Initialisation
    this.initSaveSelectionScreen();
    this.initUI();
    this.initTeamSelector();
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
  }

  // ==================== SAVE MANAGER ====================

  setSaveManager(saveManager) {
    this.saveManager = saveManager;
  }

  syncFromSaveManager() {
    if (!this.saveManager || !this.saveManager.saveData) return;

    const save = this.saveManager.saveData;

    this.playerData.name = save.joueur.nom;
    this.playerData.money = save.joueur.argent;
    this.playerData.pokedex = save.pokedex || { vus: [], captures: [] };
    this.playerData.bag = this.flattenBag(save.sac);
    this.playerData.team = this.saveManager.getTeam() || [];

    this.updateUnlocks(save.drapeaux);
    this.refreshAllDisplays();

    console.log("[UI] Sync:", {
      name: this.playerData.name,
      teamSize: this.playerData.team.length,
      flags: save.drapeaux,
    });
  }

  flattenBag(sac) {
    const flat = {};
    if (!sac) return flat;
    for (const [category, items] of Object.entries(sac)) {
      if (typeof items === "object" && !Array.isArray(items)) {
        Object.assign(flat, items);
      }
    }
    return flat;
  }

  updateUnlocks(flags) {
    if (!flags) return;

    // Utiliser !! pour convertir en boolean (accepte true, 1, "true", etc.)
    this.unlockedFeatures.team = !!(
      flags.premier_pokemon || flags.starter_choisi || (this.playerData.team && this.playerData.team.length > 0)
    );
    this.unlockedFeatures.pokedex = !!flags.pokedex_obtenu;
    this.unlockedFeatures.map = !!flags.carte_obtenue;

    // Save et settings toujours débloqués
    this.unlockedFeatures.save = true;
    this.unlockedFeatures.settings = true;
    this.unlockedFeatures.bag = true;
    
    // Le stockage se débloque en même temps que l'équipe
    this.unlockedFeatures.storage = this.unlockedFeatures.team;

    console.log("[UI] Flags reçus:", flags);
    console.log("[UI] Unlocks résultants:", this.unlockedFeatures);
    this.updateWatchButtons();
  }

  refreshAllDisplays() {
    this.updatePlayerInfo();
    this.updateTeam();
    this.updateBag();
    this.updatePokedex();
    this.updateTeamSelector();
    this.updateWatchButtons();
  }

  // ==================== SPRITES ====================

  getPokemonSpriteStyle(pokemonId) {
    const config = this.spriteConfig.pokemon;

    // Les Mégas/variantes sont intercalés APRÈS ces Pokémon dans le spritesheet
    // Chaque entrée ajoute +1 à l'offset pour tous les Pokémon suivants
    const POKEMON_WITH_EXTRA = [
      3, // Méga-Florizarre
      6, // Méga-Dracaufeu
      9, // Méga-Tortank
      15, // Méga-Dardargnan
      18, // Méga-Roucarnage
      19, // Rattata Alola
      20, // Rattatac Alola
      25, // Pikachu Let's Go
      26, // Raichu Alola
      27, // Sabelette Alola
      28, // Sablaireau Alola
      37, // Goupix Alola
      38, // Feunard Alola
      50, // Taupiqueur Alola
      51, // Triopikeur Alola
      52, // Miaouss Alola
      53, // Persian Alola
      65, // Méga-Alakazam
      74, // Racaillou Alola
      75, // Gravalanch Alola
      76, // Grolem Alola
      80, // Méga-Flagadoss
      88, // Tadmorv Alola
      89, // Grotadmorv Alola
      94, // Méga-Ectoplasma
      102, // Noeunoeuf Alola
      103, // Noadkoko Alola
      105, // Ossatueur Alola
      115, // Méga-Kangourex
      127, // Méga-Scarabrute
      130, // Méga-Léviator
      133, // Évoli Let's Go
      142, // Méga-Ptéra
      150, // Méga-Mewtwo
    ];

    // Calculer l'offset : nombre de Mégas/variantes AVANT ce Pokémon
    let offset = 0;
    for (const megaId of POKEMON_WITH_EXTRA) {
      if (pokemonId > megaId) {
        offset++;
      }
    }

    const index = pokemonId - 1 + offset;
    const col = index % config.cols;
    const row = Math.floor(index / config.cols);

    return `
      background-image: url('${config.src}');
      background-position: -${col * config.width}px -${row * config.height}px;
      background-size: ${config.cols * config.width}px auto;
      width: ${config.width}px;
      height: ${config.height}px;
      image-rendering: pixelated;
    `;
  }

  getItemSpriteStyle(itemIndex) {
    const config = this.spriteConfig.items;
    const col = itemIndex % config.cols;
    const row = Math.floor(itemIndex / config.cols);

    return `
      background-image: url('${config.src}');
      background-position: -${col * config.width}px -${row * config.height}px;
      background-size: ${config.cols * config.width}px auto;
      width: ${config.width}px;
      height: ${config.height}px;
      image-rendering: pixelated;
    `;
  }

  getItemConfig() {
    return {
      pokeball: { name: "Poké Ball", spriteIndex: 0 },
      superball: { name: "Super Ball", spriteIndex: 1 },
      hyperball: { name: "Hyper Ball", spriteIndex: 2 },
      masterball: { name: "Master Ball", spriteIndex: 3 },
      potion: { name: "Potion", spriteIndex: 17 },
      super_potion: { name: "Super Potion", spriteIndex: 18 },
      hyper_potion: { name: "Hyper Potion", spriteIndex: 19 },
      potion_max: { name: "Potion Max", spriteIndex: 20 },
      antidote: { name: "Antidote", spriteIndex: 27 },
      anti_brule: { name: "Anti-Brûle", spriteIndex: 28 },
      antigel: { name: "Antigel", spriteIndex: 29 },
      reveil: { name: "Réveil", spriteIndex: 30 },
      anti_para: { name: "Anti-Para", spriteIndex: 31 },
      total_soin: { name: "Total Soin", spriteIndex: 32 },
      rappel: { name: "Rappel", spriteIndex: 21 },
      rappel_max: { name: "Rappel Max", spriteIndex: 22 },
      ether: { name: "Éther", spriteIndex: 23 },
      ether_max: { name: "Éther Max", spriteIndex: 24 },
      elixir: { name: "Élixir", spriteIndex: 25 },
      pierre_feu: { name: "Pierre Feu", spriteIndex: 80 },
      pierre_eau: { name: "Pierre Eau", spriteIndex: 81 },
      pierre_foudre: { name: "Pierre Foudre", spriteIndex: 82 },
      pierre_plante: { name: "Pierre Plante", spriteIndex: 83 },
      pierre_lune: { name: "Pierre Lune", spriteIndex: 84 },
      repousse: { name: "Repousse", spriteIndex: 70 },
      super_repousse: { name: "Super Repousse", spriteIndex: 71 },
      max_repousse: { name: "Max Repousse", spriteIndex: 72 },
      corde_sortie: { name: "Corde Sortie", spriteIndex: 73 },
    };
  }

  // ==================== ÉCRAN TITRE ====================

  initSaveSelectionScreen() {
    const overlay = document.createElement("div");
    overlay.id = "save-selection-overlay";
    overlay.innerHTML = `
      <div class="save-selection-container">
        <div class="save-selection-title">
          <h1>POKÉMON</h1>
          <p class="subtitle">3D EDITION</p>
        </div>
        
        <div class="save-slots-container" id="save-slots"></div>

        <div class="save-selection-footer">
          <p>↑↓ Naviguer • ENTRÉE Sélectionner</p>
        </div>
      </div>

      <div class="new-game-modal" id="new-game-modal">
        <div class="new-game-content">
          <h2>NOUVELLE PARTIE</h2>
          <p>Quel est ton nom ?</p>
          <input type="text" id="player-name-input" maxlength="10" placeholder="RED" autocomplete="off">
          <div class="new-game-buttons">
            <button id="confirm-new-game" class="pixel-btn">OK</button>
            <button id="cancel-new-game" class="pixel-btn cancel">RETOUR</button>
          </div>
        </div>
      </div>

      <div class="delete-modal" id="delete-modal">
        <div class="delete-content">
          <h2>ATTENTION !</h2>
          <p>Supprimer cette sauvegarde ?</p>
          <p class="warning">Cette action est irréversible !</p>
          <div class="delete-buttons">
            <button id="confirm-delete" class="pixel-btn danger">SUPPRIMER</button>
            <button id="cancel-delete" class="pixel-btn">ANNULER</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    this.addAllStyles();

    this.selectedSlotIndex = 0;
    this.slotsData = [];
    this.pendingDeleteSlot = null;
    this.saveSelectionKeyHandler = (e) => this.handleSaveSelectionKeys(e);
  }

  addAllStyles() {
    const style = document.createElement("style");
    style.id = "ui-styles";
    style.textContent = `
      /* ==================== ÉCRAN TITRE ==================== */
      #save-selection-overlay {
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: 'Press Start 2P', monospace;
      }

      #save-selection-overlay.visible { display: flex; }

      .save-selection-container {
        width: 90%;
        max-width: 650px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 25px;
      }

      .save-selection-title h1 {
        font-size: 38px;
        color: #FFD700;
        text-shadow: 3px 3px 0 #B8860B, 0 0 30px rgba(255, 215, 0, 0.5);
        margin: 0;
        letter-spacing: 5px;
        animation: titleGlow 2s ease-in-out infinite;
        text-align: center;
      }

      .save-selection-title .subtitle {
        font-size: 12px;
        color: #87CEEB;
        margin-top: 8px;
        letter-spacing: 3px;
        text-align: center;
      }

      @keyframes titleGlow {
        0%, 100% { text-shadow: 3px 3px 0 #B8860B, 0 0 20px rgba(255, 215, 0, 0.3); }
        50% { text-shadow: 3px 3px 0 #B8860B, 0 0 40px rgba(255, 215, 0, 0.7); }
      }

      .save-slots-container {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
      }

      .save-slot {
        background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
        border: 4px solid #34495e;
        border-radius: 10px;
        padding: 15px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      }

      .save-slot.selected {
        border-color: #FFD700;
        box-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
        transform: scale(1.02);
      }

      .save-slot.empty {
        border-style: dashed;
        opacity: 0.7;
      }

      .save-slot.empty:hover { opacity: 1; }

      .slot-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }

      .slot-number { font-size: 11px; color: #FFD700; }

      .slot-badges { display: flex; gap: 3px; }

      .badge-icon {
        width: 16px; height: 16px;
        background: #4a5568;
        border-radius: 50%;
        font-size: 7px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .badge-icon.earned {
        background: linear-gradient(135deg, #FFD700, #FFA500);
      }

      .slot-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .slot-info { color: #ecf0f1; }

      .player-name {
        font-size: 14px;
        color: #fff;
        margin-bottom: 5px;
      }

      .slot-stats {
        font-size: 8px;
        color: #95a5a6;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .slot-team { display: flex; gap: 3px; }

      .slot-team-pokemon {
        width: 32px; height: 26px;
        background: rgba(255,255,255,0.1);
        border-radius: 5px;
        border: 2px solid #4a5568;
        overflow: hidden;
      }

      .empty-slot-content {
        text-align: center;
        color: #7f8c8d;
        padding: 12px;
      }

      .empty-slot-content .plus {
        font-size: 24px;
        color: #FFD700;
        margin-bottom: 6px;
      }

      .delete-btn {
        position: absolute;
        top: 6px; right: 6px;
        background: rgba(231, 76, 60, 0.8);
        border: none;
        color: white;
        width: 24px; height: 24px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 12px;
        display: none;
        align-items: center;
        justify-content: center;
      }

      .save-slot:hover .delete-btn { display: flex; }
      .delete-btn:hover { background: #e74c3c; }

      .save-selection-footer {
        color: #7f8c8d;
        font-size: 8px;
        animation: blink 1.5s ease-in-out infinite;
      }

      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      /* Modals */
      .new-game-modal, .delete-modal {
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 10001;
      }

      .new-game-modal.visible, .delete-modal.visible { display: flex; }

      .new-game-content, .delete-content {
        background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
        border: 4px solid #FFD700;
        border-radius: 12px;
        padding: 30px;
        text-align: center;
        max-width: 350px;
      }

      .new-game-content h2, .delete-content h2 {
        color: #FFD700;
        font-size: 16px;
        margin-bottom: 15px;
      }

      .new-game-content p, .delete-content p {
        color: #ecf0f1;
        font-size: 10px;
        margin-bottom: 15px;
      }

      .delete-content .warning { color: #e74c3c; font-size: 8px; }

      #player-name-input {
        width: 100%;
        padding: 12px;
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
        text-align: center;
        background: #1a252f;
        border: 3px solid #34495e;
        border-radius: 6px;
        color: #fff;
        outline: none;
        text-transform: uppercase;
        margin-bottom: 15px;
      }

      #player-name-input:focus { border-color: #FFD700; }

      .new-game-buttons, .delete-buttons {
        display: flex;
        gap: 10px;
        justify-content: center;
      }

      .pixel-btn {
        font-family: 'Press Start 2P', monospace;
        font-size: 9px;
        padding: 10px 18px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        background: linear-gradient(135deg, #27ae60, #1e8449);
        color: white;
        box-shadow: 0 3px 0 #145a32;
        transition: all 0.1s;
      }

      .pixel-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 0 #145a32; }
      .pixel-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #145a32; }

      .pixel-btn.cancel {
        background: linear-gradient(135deg, #7f8c8d, #5d6d7e);
        box-shadow: 0 3px 0 #4a5568;
      }

      .pixel-btn.danger {
        background: linear-gradient(135deg, #e74c3c, #c0392b);
        box-shadow: 0 3px 0 #922b21;
      }

      /* ==================== BOUTONS MENU ==================== */
      .watch-button.locked {
        opacity: 0.4;
        cursor: not-allowed;
        position: relative;
      }

      .watch-button.locked::after {
        content: '🔒';
        position: absolute;
        top: 2px;
        right: 2px;
        font-size: 8px;
      }

      /* ==================== TEAM SELECTOR ==================== */
      #team-selector {
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: none;
        flex-direction: row;
        gap: 6px;
        pointer-events: none;
        z-index: 100;
      }

      #team-selector.visible { display: flex; }

      /* ==================== NOTIFICATIONS ==================== */
      .game-notification {
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.9);
        color: #fff;
        padding: 12px 25px;
        border-radius: 6px;
        font-size: 11px;
        font-family: 'Press Start 2P', monospace;
        z-index: 10000;
        animation: notifAppear 0.3s ease-out;
      }

      @keyframes notifAppear {
        from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }

      .game-notification.success { border: 2px solid #27ae60; }
      .game-notification.error { border: 2px solid #e74c3c; }

      .unlock-notification {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
        border: 4px solid #FFD700;
        border-radius: 12px;
        padding: 25px 40px;
        text-align: center;
        z-index: 10000;
        animation: notificationAppear 0.3s ease-out;
        font-family: 'Press Start 2P', monospace;
      }

      @keyframes notificationAppear {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }

      .unlock-notification h3 { color: #FFD700; font-size: 12px; margin-bottom: 8px; }
      .unlock-notification p { color: #fff; font-size: 9px; }
    `;
    document.head.appendChild(style);
  }

  showSaveSelection(slots, callback) {
    this.slotsData = slots;
    this.onSaveSelected = callback;
    this.selectedSlotIndex = 0;

    const overlay = document.getElementById("save-selection-overlay");
    const slotsContainer = document.getElementById("save-slots");

    slotsContainer.innerHTML = "";
    slots.forEach((slot, index) => {
      slotsContainer.appendChild(this.createSaveSlotElement(slot, index));
    });

    this.updateSlotSelection();
    overlay.classList.add("visible");
    document.addEventListener("keydown", this.saveSelectionKeyHandler);
    this.setupModalListeners();
  }

  createSaveSlotElement(slot, index) {
    const slotEl = document.createElement("div");
    slotEl.className = `save-slot ${slot.empty ? "empty" : ""} ${
      index === this.selectedSlotIndex ? "selected" : ""
    }`;
    slotEl.dataset.index = index;

    if (slot.empty) {
      slotEl.innerHTML = `
        <div class="empty-slot-content">
          <div class="plus">+</div>
          <div>NOUVELLE PARTIE</div>
        </div>
      `;
    } else {
      let badgesHtml = "";
      for (let i = 0; i < 8; i++) {
        badgesHtml += `<div class="badge-icon ${
          slot.badges > i ? "earned" : ""
        }">🏅</div>`;
      }

      let teamHtml = "";
      if (slot.team && slot.team.length > 0) {
        teamHtml = '<div class="slot-team">';
        slot.team.forEach((pokemonId) => {
          if (pokemonId) {
            teamHtml += `<div class="slot-team-pokemon" style="${this.getPokemonSpriteStyle(
              pokemonId
            )}; transform: scale(0.45); transform-origin: top left;"></div>`;
          }
        });
        teamHtml += "</div>";
      }

      slotEl.innerHTML = `
        <button class="delete-btn" data-slot="${slot.slot}">✕</button>
        <div class="slot-header">
          <span class="slot-number">FICHIER ${slot.slot}</span>
          <div class="slot-badges">${badgesHtml}</div>
        </div>
        <div class="slot-content">
          <div class="slot-info">
            <div class="player-name">${slot.playerName}</div>
            <div class="slot-stats">
              <span>🕐 ${slot.tempsJeu}</span>
              <span>📖 Pokédex: ${slot.pokedex}/151</span>
            </div>
          </div>
          ${teamHtml}
        </div>
      `;

      const deleteBtn = slotEl.querySelector(".delete-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.showDeleteModal(slot.slot);
        });
      }
    }

    slotEl.addEventListener("click", () => {
      this.selectedSlotIndex = index;
      this.updateSlotSelection();
      this.selectCurrentSlot();
    });

    return slotEl;
  }

  updateSlotSelection() {
    document.querySelectorAll(".save-slot").forEach((slot, index) => {
      slot.classList.toggle("selected", index === this.selectedSlotIndex);
    });
  }

  handleSaveSelectionKeys(e) {
    if (
      document
        .getElementById("new-game-modal")
        ?.classList.contains("visible") ||
      document.getElementById("delete-modal")?.classList.contains("visible")
    ) {
      return;
    }

    switch (e.code) {
      case "ArrowUp":
      case "KeyW":
      case "KeyZ":
        e.preventDefault();
        this.selectedSlotIndex = Math.max(0, this.selectedSlotIndex - 1);
        this.updateSlotSelection();
        break;
      case "ArrowDown":
      case "KeyS":
        e.preventDefault();
        this.selectedSlotIndex = Math.min(
          this.slotsData.length - 1,
          this.selectedSlotIndex + 1
        );
        this.updateSlotSelection();
        break;
      case "Enter":
      case "Space":
        e.preventDefault();
        this.selectCurrentSlot();
        break;
    }
  }

  selectCurrentSlot() {
    const slot = this.slotsData[this.selectedSlotIndex];
    if (slot.empty) {
      this.showNewGameModal(slot.slot);
    } else {
      this.hideSaveSelection();
      if (this.onSaveSelected) {
        this.onSaveSelected({ action: "load", slot: slot.slot });
      }
    }
  }

  showNewGameModal(slotNumber) {
    const modal = document.getElementById("new-game-modal");
    const input = document.getElementById("player-name-input");
    modal.classList.add("visible");
    input.value = "";
    setTimeout(() => input.focus(), 100);
    modal.dataset.slot = slotNumber;
  }

  hideNewGameModal() {
    document.getElementById("new-game-modal").classList.remove("visible");
  }

  showDeleteModal(slotNumber) {
    document.getElementById("delete-modal").classList.add("visible");
    this.pendingDeleteSlot = slotNumber;
  }

  hideDeleteModal() {
    document.getElementById("delete-modal").classList.remove("visible");
    this.pendingDeleteSlot = null;
  }

  setupModalListeners() {
    document.getElementById("confirm-new-game").onclick = () => {
      const input = document.getElementById("player-name-input");
      const modal = document.getElementById("new-game-modal");
      const playerName = input.value.trim().toUpperCase() || "RED";
      const slot = parseInt(modal.dataset.slot);

      this.hideNewGameModal();
      this.hideSaveSelection();

      if (this.onSaveSelected) {
        this.onSaveSelected({ action: "new", slot, playerName });
      }
    };

    document.getElementById("cancel-new-game").onclick = () =>
      this.hideNewGameModal();

    document.getElementById("confirm-delete").onclick = () => {
      if (this.pendingDeleteSlot && this.onSaveSelected) {
        this.onSaveSelected({ action: "delete", slot: this.pendingDeleteSlot });
      }
      this.hideDeleteModal();
    };

    document.getElementById("cancel-delete").onclick = () =>
      this.hideDeleteModal();

    document
      .getElementById("player-name-input")
      ?.addEventListener("keydown", (e) => {
        if (e.code === "Enter") {
          document.getElementById("confirm-new-game").click();
        } else if (e.code === "Escape") {
          this.hideNewGameModal();
        }
      });
  }

  hideSaveSelection() {
    document
      .getElementById("save-selection-overlay")
      ?.classList.remove("visible");
    document.removeEventListener("keydown", this.saveSelectionKeyHandler);
  }

  isSaveMenuOpen() {
    return document.getElementById("save-selection-overlay")?.classList.contains("visible");
  }

  refreshSaveSelection(slots) {
    this.slotsData = slots;
    const container = document.getElementById("save-slots");
    container.innerHTML = "";
    slots.forEach((slot, index) => {
      container.appendChild(this.createSaveSlotElement(slot, index));
    });
    this.updateSlotSelection();
  }

  // ==================== MENU PRINCIPAL (MONTRE) ====================

  // ==================== SYNC SAUVEGARDE ====================



  initUI() {
    // Créer les boutons dynamiques
    this.ensureSaveButton();
    this.ensureStorageButton();

    document.addEventListener("keydown", (e) => {
      if (e.code === "KeyM" || e.code === "Tab") {
        e.preventDefault();
        this.toggleWatch();
      }
      if (e.code === "Escape") {
        this.closeAllMenus();
      }
    });

    // Délégation d'événement pour gérer les boutons ajoutés dynamiquement
    document.getElementById("watch-menu").addEventListener("click", (e) => {
        const btn = e.target.closest(".watch-button");
        if (!btn) return;

        const menu = btn.dataset.menu;

        // Bouton SAUVER
        if (menu === "save") {
          this.saveGame();
          return;
        }

        // Bouton STOCKAGE
        if (menu === "storage") {
            this.showPC();
            return;
        }

        // Vérifier déverrouillage
        if (this.unlockedFeatures[menu] === false) {
          this.showLockedMessage(menu);
          return;
        }

        this.openMenu(menu);
    });

    document.querySelectorAll(".menu-close").forEach((btn) => {
      btn.addEventListener("click", () => this.closeAllMenus());
    });

    this.updatePlayerInfo();
    this.updateTeam();
    this.updateBag();
    this.updatePokedex();
    this.updateWatchButtons();
  }

  /**
   * S'assure que le bouton SAUVER existe dans le menu
   */
  ensureSaveButton() {
    const menu = document.getElementById("watch-menu");
    if (!menu) return;
    if (menu.querySelector('[data-menu="save"]')) return;

    const saveBtn = document.createElement("button");
    saveBtn.className = "watch-button";
    saveBtn.dataset.menu = "save";
    saveBtn.textContent = "SAUVER";
    saveBtn.style.cssText = `background: linear-gradient(135deg, #4CAF50, #388E3C); color: #fff; border-color: #2E7D32;`;
    
    // Insérer avant le bouton Options s'il existe
    const optionsBtn = menu.querySelector('[data-menu="settings"]');
    if (optionsBtn) menu.insertBefore(saveBtn, optionsBtn);
    else menu.appendChild(saveBtn);
  }

  ensureStorageButton() {
    const menu = document.getElementById("watch-menu");
    if (!menu) return;
    if (menu.querySelector('[data-menu="storage"]')) return;

    const btn = document.createElement("button");
    btn.className = "watch-button";
    btn.dataset.menu = "storage";
    btn.textContent = "STOCKAGE";
    btn.style.cssText = `background: linear-gradient(135deg, #9C27B0, #7B1FA2); color: white; border-color: #7B1FA2;`;
    
    // Insérer après Equipe
    const teamBtn = menu.querySelector('[data-menu="team"]');
    // Ou avant Save
     const saveBtn = menu.querySelector('[data-menu="save"]');

    if (saveBtn) menu.insertBefore(btn, saveBtn);
    else if (teamBtn && teamBtn.nextSibling) menu.insertBefore(btn, teamBtn.nextSibling);
    else menu.appendChild(btn);
  }

  // ==================== PC SYSTEM ====================

  showPC() {
      let pcOverlay = document.getElementById("pc-overlay");
      if (!pcOverlay) {
          pcOverlay = document.createElement("div");
          pcOverlay.id = "pc-overlay";
          pcOverlay.style.cssText = `
              position: fixed; top: 0; left: 0; width: 100%; height: 100%;
              background: rgba(0,0,0,0.9); z-index: 12000;
              display: none; justify-content: center; align-items: center;
              font-family: 'Press Start 2P', monospace; color: white;
          `;
          document.body.appendChild(pcOverlay);
      }

      // State interne pour le PC
      let selectedTeamSlot = null;
      let selectedPCSlot = null;

      const renderPC = () => {
          if (!this.saveManager || !this.saveManager.saveData) return;

          const team = this.saveManager.getTeam(); // Array of Objects
          const teamIds = this.saveManager.saveData.equipe; // Array of IDs (slots)
          const pcIds = this.saveManager.saveData.pc || []; // Array of IDs in PC

          pcOverlay.innerHTML = `
            <div style="
                width: 900px; height: 600px; background: #34495e; border: 4px solid #bdc3c7;
                border-radius: 10px; display: flex; flex-direction: column; overflow: hidden;
            ">
                <!-- HEADER -->
                <div style="
                    padding: 15px; background: #2c3e50; border-bottom: 2px solid #bdc3c7;
                    display: flex; justify-content: space-between; align-items: center;
                ">
                    <div style="color: #3498db; font-size: 14px;">PC DE ${this.playerData.name.toUpperCase()}</div>
                    <button id="close-pc" style="
                        background: #e74c3c; color: white; border: none; padding: 10px 20px;
                        font-family: inherit; cursor: pointer; border-radius: 5px;
                    ">FERMER</button>
                </div>

                <div style="flex: 1; display: flex; padding: 20px; gap: 20px;">
                    <!-- COLONNE GAUCHE : EQUIPE -->
                    <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-content: start;">
                        <div style="grid-column: span 2; text-align: center; color: #FFD700; margin-bottom: 5px;">ÉQUIPE (${teamIds.filter(x => x!==null).length}/6)</div>
                        ${[0,1,2,3,4,5].map(i => {
                            const pId = teamIds[i];
                            const p = pId ? this.saveManager.getPokemon(pId) : null;
                            const isSelected = selectedTeamSlot === i;
                            const bg = isSelected ? "#e67e22" : (p ? "#27ae60" : "#2c3e50");
                            
                            return `
                            <div class="pc-team-slot" data-index="${i}" style="
                                background: ${bg}; padding: 5px; border-radius: 5px;
                                border: 2px solid ${isSelected ? "white" : "#2ecc71"};
                                cursor: pointer; height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center;
                            ">
                                ${p ? `
                                    <div style="${this.getPokemonSpriteStyle(p.speciesId)} transform: scale(0.7); margin-bottom: 2px;"></div>
                                    <div style="font-size: 8px; text-align: center; white-space: nowrap; overflow: hidden; max-width: 100%;">${(p.surnom || p.name || this.getPokemonName(p.speciesId || p.id)).substring(0,8)}</div>
                                    <div style="font-size: 6px; color: #eee;">Niv. ${p.niveau}</div>
                                ` : '<div style="font-size:8px; color:#7f8c8d;">VIDE</div>'}
                            </div>`;
                        }).join("")}
                    </div>

                    <!-- ACTIONS CENTRALES -->
                    <div style="width: 100px; display: flex; flex-direction: column; justify-content: center; gap: 15px;">
                        <button id="btn-deposit" style="padding: 10px; font-family: inherit; font-size: 8px; cursor: pointer;">>> DÉPOSER >></button>
                        <button id="btn-withdraw" style="padding: 10px; font-family: inherit; font-size: 8px; cursor: pointer;"><< RETIRER <<</button>
                        <div style="text-align: center; font-size: 8px; color: #bdc3c7; margin-top: 20px;">
                            Sélectionne un slot de chaque côté
                        </div>
                    </div>

                    <!-- COLONNE DROITE : BOITE PC -->
                    <div style="flex: 2; background: #2c3e50; padding: 10px; border-radius: 5px; display: flex; flex-direction: column;">
                        <div style="text-align: center; color: #3498db; margin-bottom: 10px;">BOÎTE 1 (${pcIds.length})</div>
                        <div class="pc-box-grid" style="
                            display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;
                            overflow-y: auto; max-height: 400px; padding-right: 5px;
                        ">
                            ${pcIds.map((pId, idx) => {
                                const p = this.saveManager.getPokemon(pId);
                                const isSelected = selectedPCSlot === idx;
                                return `
                                <div class="pc-box-slot" data-index="${idx}" style="
                                    background: ${isSelected ? "#e67e22" : "#34495e"}; 
                                    border: 1px solid ${isSelected ? "white" : "#7f8c8d"};
                                    aspect-ratio: 1; border-radius: 5px; cursor: pointer;
                                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                                ">
                                    <div style="${this.getPokemonSpriteStyle(p.speciesId)} transform: scale(0.6);"></div>
                                    <div style="font-size: 6px; margin-top: 2px; text-align: center;">${(p.surnom || p.name || this.getPokemonName(p.speciesId || p.id)).substring(0,8)}</div>
                                </div>`;
                            }).join("")}
                            ${pcIds.length === 0 ? '<div style="grid-column: span 4; text-align: center; font-size: 8px; color: #7f8c8d; padding: 20px;">Boîte vide</div>' : ''}
                        </div>
                    </div>
                </div>
            </div>
          `;

          // EVENTS =================
          pcOverlay.querySelector("#close-pc").onclick = () => {
              pcOverlay.style.display = "none";
              this.syncFromSaveManager(); // Refresh main UI
          };

          // Select Team Slot
          pcOverlay.querySelectorAll(".pc-team-slot").forEach(slot => {
              slot.onclick = () => {
                  const idx = parseInt(slot.dataset.index);
                  selectedTeamSlot = (selectedTeamSlot === idx) ? null : idx;
                  renderPC();
              };
          });

          // Select PC Slot
          pcOverlay.querySelectorAll(".pc-box-slot").forEach(slot => {
              slot.onclick = () => {
                  const idx = parseInt(slot.dataset.index);
                  selectedPCSlot = (selectedPCSlot === idx) ? null : idx;
                  renderPC();
              };
          });

          // DEPOSIT
          pcOverlay.querySelector("#btn-deposit").onclick = () => {
              if (selectedTeamSlot === null) return;
              const teamId = teamIds[selectedTeamSlot];
              if (!teamId) return;

              // Check if last pokemon
              const teamCount = teamIds.filter(x => x!==null).length;
              if (teamCount <= 1) {
                  this.showNotification("Impossible de retirer le dernier Pokémon !");
                  return;
              }

              // Exec
              this.saveManager.addToPC(teamId);
              this.saveManager.removeFromTeam(teamId);
              this.saveManager.save();
              
              selectedTeamSlot = null;
              renderPC();
          };

          // WITHDRAW
          pcOverlay.querySelector("#btn-withdraw").onclick = () => {
              if (selectedPCSlot === null) return;
              const pcId = pcIds[selectedPCSlot];
              
              // Exec
              if (this.saveManager.addToTeam(pcId)) {
                  this.saveManager.removeFromPC(pcId);
                  this.saveManager.save();
                  selectedPCSlot = null;
                  renderPC();
              } else {
                  this.showNotification("Équipe pleine !");
              }
          };
      };

      renderPC();
      pcOverlay.style.display = "flex";
  }

  updateWatchButtons() {
    document.querySelectorAll(".watch-button").forEach((btn) => {
      const menu = btn.dataset.menu;

      // Ces boutons ne sont JAMAIS verrouillés
      if (menu === "save" || menu === "settings" || menu === "bag") {
        btn.classList.remove("locked");
        btn.disabled = false;
        return; // Important: sortir ici
      }

      // Pour les autres, vérifier le déverrouillage
      if (this.unlockedFeatures[menu]) {
        btn.classList.remove("locked");
        btn.disabled = false;
      } else {
        btn.classList.add("locked");
        btn.disabled = true;
      }
    });
  }

  showLockedMessage(feature) {
    const messages = {
      team: "Obtiens d'abord un Pokémon !",
      pokedex: "Obtiens d'abord le Pokédex !",
      map: "Obtiens d'abord la Carte !",
    };
    this.showNotification(messages[feature] || "Non disponible", "error");
  }

  async saveGame() {
    console.log("[UI] saveGame() appelé");
    this.closeAllMenus();

    let success = false;

    if (this.onSaveGame) {
      console.log("[UI] Utilisation de onSaveGame callback");
      success = await this.onSaveGame();
    } else if (this.saveManager) {
      console.log("[UI] Utilisation directe de saveManager");
      success = await this.saveManager.save();
    } else {
      console.warn("[UI] Pas de saveManager configuré !");
      this.showNotification("Erreur: SaveManager non configuré", "error");
      return;
    }

    this.showNotification(
      success ? "✓ Sauvegardé !" : "✗ Erreur",
      success ? "success" : "error"
    );
  }

  showNotification(message, type = "success") {
    // Si la boîte de dialogue de combat est visible, on l'utilise
    const dialogueContainer = document.getElementById("combat-dialogue-container");
    if (dialogueContainer && dialogueContainer.style.display !== "none") {
        this.showDialogue(message);
        return;
    }

    document.querySelector(".game-notification")?.remove();

    const notif = document.createElement("div");
    notif.className = `game-notification ${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);

    setTimeout(() => {
      notif.style.opacity = "0";
      notif.style.transition = "opacity 0.3s";
      setTimeout(() => notif.remove(), 300);
    }, 2000);
  }

  showDialogue(text, autoHide = false) {
  // VR: Envoyer le message au VRBattlePanel si en mode VR combat
  if (this.game?.renderer?.xr?.isPresenting && this.game?.vrManager?.vrBattlePanel?.isVisible) {
      this.game.vrManager.vrBattlePanel.showMessage(text);
      return;
  }

  // FIX: Utiliser le système de dialogue moderne s'il est disponible
  if (this.modernHUD && this.game && this.game.modernDialogue) {
      if (autoHide) {
          this.game.modernDialogue.showQuickMessage(text, 2000);
      } else {
          // Utiliser showQuickMessage même pour le non-autohide dans le contexte combat simple
          // ou implémenter une méthode spécifique pour les logs de combat persistants
          this.game.modernDialogue.showQuickMessage(text, 3000);
      }
      return;
  }

  const container = document.getElementById("combat-dialogue-container");
  const textBox = document.getElementById("combat-dialogue-text");
  
  if (container && textBox) {
      container.style.display = "block";
      textBox.textContent = text;
      
      // Effet de frappe (optionnel, pour l'instant direct)
      
      if (autoHide) {
        setTimeout(() => {
          container.style.display = "none";
        }, 2000);
      }
  }
}

  hideDialogue() {
    const container = document.getElementById("combat-dialogue-container");
    if (container) {
        container.style.display = "none";
    }
  }

  showNotification(message, type = "success") {
    // VR: Envoyer le message au VRBattlePanel si en mode VR combat
    if (this.game?.renderer?.xr?.isPresenting && this.game?.vrManager?.vrBattlePanel?.isVisible) {
        this.game.vrManager.vrBattlePanel.showMessage(message);
        return;
    }

    // Si combat en cours, utiliser la boîte de dialogue de combat
    const combatContainer = document.getElementById("combat-dialogue-container");
    if (combatContainer && combatContainer.style.display !== "none") {
        this.showDialogue(message);
        // Auto-close le dialogue de combat après 2s si c'est une notification
        setTimeout(() => {
            if (this.currentDialogueText === message) {
                combatContainer.style.display = "none";
            }
        }, 2000);
        return;
    }

    // Sinon, toast notification standard
    const notification = document.createElement("div");
    notification.className = `toast-notification ${type}`;
    notification.innerHTML = message;
    notification.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8); color: white; padding: 15px 30px;
        border-radius: 30px; border: 2px solid ${type === "error" ? "#e74c3c" : "#2ecc71"};
        font-family: 'Press Start 2P', monospace; font-size: 12px;
        z-index: 10000; opacity: 0; transition: opacity 0.3s;
        pointer-events: none;
    `;
    
    document.body.appendChild(notification);

    // Animation
    requestAnimationFrame(() => notification.style.opacity = "1");

    // Auto-remove
    setTimeout(() => {
        notification.style.opacity = "0";
        setTimeout(() => notification.remove(), 300);
    }, 2500);
  }

  showUnlockNotification(featureName) {
    const notification = document.createElement("div");
    notification.className = "unlock-notification";
    notification.innerHTML = `<h3>🔓 DÉBLOQUÉ !</h3><p>${featureName}</p>`;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transition = "all 0.3s ease-out";
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  unlockFeature(feature, showNotification = true) {
    if (this.unlockedFeatures[feature]) return;
    this.unlockedFeatures[feature] = true;
    this.updateWatchButtons();

    // IMPORTANT: Mettre à jour le flag correspondant dans SaveManager
    if (this.saveManager) {
      const flagMap = {
        team: "premier_pokemon",
        pokedex: "pokedex_obtenu",
        map: "carte_obtenue",
      };

      if (flagMap[feature]) {
        this.saveManager.setFlag(flagMap[feature], true);
        console.log(
          `[UI] Flag ${flagMap[feature]} mis à true dans SaveManager`
        );
      }
    }

    if (showNotification) {
      const labels = { team: "ÉQUIPE", pokedex: "POKÉDEX", map: "CARTE" };
      this.showUnlockNotification(labels[feature] || feature);
    }
  }

  /**
   * Débloque le Pokédex (appelé quand le Prof Chen le donne)
   */
  unlockPokedex() {
    this.unlockFeature("pokedex");
  }

  /**
   * Débloque la carte (appelé après avoir battu le rival au labo)
   */
  unlockMap() {
    this.unlockFeature("map");
  }

  /**
   * Appelé quand le joueur reçoit son starter du Prof Chen
   * Débloque: Équipe + Pokédex
   * @param {Object} pokemon - Le Pokémon starter à ajouter
   */
  onStarterReceived(pokemon) {
    console.log("[UI] Starter reçu:", pokemon);

    // Ajouter le Pokémon à l'équipe (ça débloque l'équipe automatiquement)
    this.addPokemonToTeam(pokemon);

    // Débloquer le Pokédex (le Prof Chen le donne avec le starter)
    this.unlockFeature("pokedex");

    // Mettre aussi le flag starter_choisi
    if (this.saveManager) {
      this.saveManager.setFlag("starter_choisi", true);
      this.saveManager.setFlag("pokedex_obtenu", true);
    }

    console.log("[UI] Starter configuré, flags mis à jour");
  }

  /**
   * Appelé quand le joueur bat le rival au laboratoire
   * Débloque: Carte
   */
  onRivalDefeatedAtLab() {
    this.unlockFeature("map");

    if (this.saveManager) {
      this.saveManager.setFlag("rival_battu_labo", true);
      this.saveManager.setFlag("carte_obtenue", true);
    }

    this.showNotification("📍 Carte obtenue !");
  }

  toggleWatch() {
    this.watchVisible = !this.watchVisible;
    const watch = document.getElementById("watch");
    watch?.classList.toggle("visible", this.watchVisible);
    if (!this.watchVisible) this.closeAllMenus();
  }

  openMenu(menuName) {
    this.closeAllMenus();
    this.currentMenu = menuName;
    document.getElementById(`${menuName}-screen`)?.classList.add("visible");
    document.exitPointerLock?.();
  }

  closeAllMenus() {
    document
      .querySelectorAll(".menu-screen")
      .forEach((s) => s.classList.remove("visible"));
    this.currentMenu = null;
  }

  updateClock() {
    const now = new Date();
    const el = document.getElementById("watch-time");
    if (el)
      el.textContent = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
  }

  // ==================== AFFICHAGES ====================

  updatePlayerInfo() {
    const nameEl = document.querySelector("#player-info .name");
    const moneyEl = document.querySelector("#player-info .money");
    if (nameEl) nameEl.textContent = this.playerData.name.toUpperCase();
    if (moneyEl) moneyEl.textContent = `${this.playerData.money} ¥`;
  }

  updateTeam() {
    const teamList = document.getElementById("team-list");
    if (!teamList) return;

    teamList.innerHTML = "";

    if (this.playerData.team.length === 0) {
      teamList.innerHTML = '<div class="empty-message">Aucun Pokémon</div>';
      return;
    }

    this.playerData.team.forEach((pokemon) => {
      if (!pokemon) return;

      const hp = pokemon.stats?.hp ?? pokemon.hp ?? 0;
      const maxHp = pokemon.stats?.hpMax ?? pokemon.maxHp ?? 1;
      const hpPercent = (hp / maxHp) * 100;
      const hpClass = hpPercent < 25 ? "critical" : hpPercent < 50 ? "low" : "";

      // Récupérer le nom: surnom > nom > name > getPokemonName(speciesId)
      const pokemonName =
        pokemon.surnom ||
        pokemon.nom ||
        pokemon.name ||
        this.getPokemonName(pokemon.speciesId || pokemon.id);

      const card = document.createElement("div");
      card.className = "pokemon-card";

      card.innerHTML = `
        <div class="pokemon-sprite-container">
          <div class="pokemon-card-sprite" style="${this.getPokemonSpriteStyle(
            pokemon.speciesId || pokemon.id || 1
          )}"></div>
        </div>
        <div class="pokemon-info">
          <div class="pokemon-name">${pokemonName}</div>
          <div class="pokemon-level">Niv. ${
            pokemon.niveau || pokemon.level || 5
          }</div>
          <div class="hp-bar">
            <div class="hp-fill ${hpClass}" style="width: ${hpPercent}%"></div>
          </div>
          <div style="font-size: 9px; color: #333; margin-top: 4px;">PV: ${hp}/${maxHp}</div>
        </div>
      `;
      
      // Ajouter event click pour détails (gestion des attaques)
      card.style.cursor = "pointer";
      card.addEventListener("click", () => this.showPokemonDetail(pokemon));
      
      teamList.appendChild(card);
    });
  }

  updateBag() {
    const bagContent = document.getElementById("bag-content");
    if (!bagContent) return;

    bagContent.innerHTML = "";
    const itemConfig = this.getItemConfig();
    let hasItems = false;
    
    console.log("[UI] updateBag - Bag Content:", this.playerData.bag);

    for (const [key, count] of Object.entries(this.playerData.bag)) {
      if (count <= 0) continue;
      
      const config = itemConfig[key];
      if (!config) {
          console.warn(`[UI] Item caché (pas de config): ${key}`);
          continue;
      }
      
      hasItems = true;

      const card = document.createElement("div");
      card.className = "item-card";

      card.innerHTML = `
        <div class="bag-item-sprite" style="${this.getItemSpriteStyle(
          config.spriteIndex
        )}"></div>
        <div class="item-name">${config.name}</div>
        <div class="item-count">${count}</div>
      `;
      card.addEventListener("click", () => this.useItem(key));
      bagContent.appendChild(card);
    }

    if (!hasItems) {
      bagContent.innerHTML = '<div class="empty-message">Sac vide</div>';
    }
  }

  updatePokedex() {
    const pokedexList = document.getElementById("pokedex-list");
    if (!pokedexList) return;

    pokedexList.innerHTML = "";

    for (let id = 1; id <= 151; id++) {
      const captured = this.playerData.pokedex.captures?.includes(id) || false;
      const seen = this.playerData.pokedex.vus?.includes(id) || captured;

      const entry = document.createElement("div");
      entry.className = `pokedex-entry ${!seen ? "unknown" : ""}`;

      entry.innerHTML = `
        <div class="pokedex-sprite">
          <div class="pokedex-entry-sprite" style="${this.getPokemonSpriteStyle(
            id
          )}"></div>
        </div>
        <div class="pokedex-number">#${id.toString().padStart(3, "0")}</div>
        <div class="pokedex-name">${
          seen ? this.getPokemonName(id) : "???"
        }</div>
      `;

      pokedexList.appendChild(entry);
    }
  }

  getPokemonName(id) {
    const names = {
      1: "Bulbizarre",
      2: "Herbizarre",
      3: "Florizarre",
      4: "Salamèche",
      5: "Reptincel",
      6: "Dracaufeu",
      7: "Carapuce",
      8: "Carabaffe",
      9: "Tortank",
      10: "Chenipan",
      11: "Chrysacier",
      12: "Papilusion",
      13: "Aspicot",
      14: "Coconfort",
      15: "Dardargnan",
      16: "Roucool",
      17: "Roucoups",
      18: "Roucarnage",
      19: "Rattata",
      20: "Rattatac",
      21: "Piafabec",
      22: "Rapasdepic",
      23: "Abo",
      24: "Arbok",
      25: "Pikachu",
      26: "Raichu",
      27: "Sabelette",
      28: "Sablaireau",
      29: "Nidoran♀",
      30: "Nidorina",
      31: "Nidoqueen",
      32: "Nidoran♂",
      33: "Nidorino",
      34: "Nidoking",
      35: "Mélofée",
      36: "Mélodelfe",
      37: "Goupix",
      38: "Feunard",
      39: "Rondoudou",
      40: "Grodoudou",
      41: "Nosferapti",
      42: "Nosferalto",
      43: "Mystherbe",
      44: "Ortide",
      45: "Rafflesia",
      46: "Paras",
      47: "Parasect",
      48: "Mimitoss",
      49: "Aéromite",
      50: "Taupiqueur",
      51: "Triopikeur",
      52: "Miaouss",
      53: "Persian",
      54: "Psykokwak",
      55: "Akwakwak",
      56: "Férosinge",
      57: "Colossinge",
      58: "Caninos",
      59: "Arcanin",
      60: "Ptitard",
      61: "Têtarte",
      62: "Tartard",
      63: "Abra",
      64: "Kadabra",
      65: "Alakazam",
      66: "Machoc",
      67: "Machopeur",
      68: "Mackogneur",
      69: "Chétiflor",
      70: "Boustiflor",
      71: "Empiflor",
      72: "Tentacool",
      73: "Tentacruel",
      74: "Racaillou",
      75: "Gravalanch",
      76: "Grolem",
      77: "Ponyta",
      78: "Galopa",
      79: "Ramoloss",
      80: "Flagadoss",
      81: "Magnéti",
      82: "Magnéton",
      83: "Canarticho",
      84: "Doduo",
      85: "Dodrio",
      86: "Otaria",
      87: "Lamantine",
      88: "Tadmorv",
      89: "Grotadmorv",
      90: "Kokiyas",
      91: "Crustabri",
      92: "Fantominus",
      93: "Spectrum",
      94: "Ectoplasma",
      95: "Onix",
      96: "Soporifik",
      97: "Hypnomade",
      98: "Krabby",
      99: "Krabboss",
      100: "Voltorbe",
      101: "Électrode",
      102: "Noeunoeuf",
      103: "Noadkoko",
      104: "Osselait",
      105: "Ossatueur",
      106: "Kicklee",
      107: "Tygnon",
      108: "Excelangue",
      109: "Smogo",
      110: "Smogogo",
      111: "Rhinocorne",
      112: "Rhinoféros",
      113: "Leveinard",
      114: "Saquedeneu",
      115: "Kangourex",
      116: "Hypotrempe",
      117: "Hypocéan",
      118: "Poissirène",
      119: "Poissoroy",
      120: "Stari",
      121: "Staross",
      122: "M. Mime",
      123: "Insécateur",
      124: "Lippoutou",
      125: "Élektek",
      126: "Magmar",
      127: "Scarabrute",
      128: "Tauros",
      129: "Magicarpe",
      130: "Léviator",
      131: "Lokhlass",
      132: "Métamorph",
      133: "Évoli",
      134: "Aquali",
      135: "Voltali",
      136: "Pyroli",
      137: "Porygon",
      138: "Amonita",
      139: "Amonistar",
      140: "Kabuto",
      141: "Kabutops",
      142: "Ptéra",
      143: "Ronflex",
      144: "Artikodin",
      145: "Électhor",
      146: "Sulfura",
      147: "Minidraco",
      148: "Draco",
      149: "Dracolosse",
      150: "Mewtwo",
      151: "Mew",
    };
    return names[id] || `#${id}`;
  }

  // ==================== TEAM SELECTOR ====================

  initTeamSelector() {
    document.addEventListener("wheel", (e) => {
      if (this.isMenuOpen()) return;
      if (this.playerData.team.length === 0) return;

      if (e.deltaY > 0) {
        this.selectedPokemonIndex =
          (this.selectedPokemonIndex + 1) % this.playerData.team.length;
      } else {
        this.selectedPokemonIndex =
          (this.selectedPokemonIndex - 1 + this.playerData.team.length) %
          this.playerData.team.length;
      }
      this.updateTeamSelector();
    });
  }

  updateTeamSelector() {
    let selector = document.getElementById("team-selector");

    if (!selector) {
      selector = document.createElement("div");
      selector.id = "team-selector";
      document.body.appendChild(selector);
    }

    // CACHER si pas de Pokémon
    if (this.playerData.team.length === 0) {
      selector.classList.remove("visible");
      selector.innerHTML = "";
      return;
    }

    selector.classList.add("visible");
    selector.innerHTML = "";

    this.playerData.team.forEach((pokemon, index) => {
      if (!pokemon) return;
      selector.appendChild(this.createPokemonSlot(pokemon, index));
    });
  }

  createPokemonSlot(pokemon, index) {
    const slot = document.createElement("div");
    const isSelected = index === this.selectedPokemonIndex;
    const hp = pokemon.stats?.hp ?? pokemon.hp ?? 0;
    const maxHp = pokemon.stats?.hpMax ?? pokemon.maxHp ?? 1;
    const isAvailable = hp > 0 && !pokemon.isOut;

    slot.style.cssText = `
      width: 60px;
      height: 80px;
      background: ${
        isSelected ? "rgba(255, 215, 0, 0.3)" : "rgba(0, 0, 0, 0.6)"
      };
      border: 3px solid ${isSelected ? "#FFD700" : "#444"};
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px;
      opacity: ${isAvailable ? 1 : 0.4};
      transform: ${isSelected ? "scale(1.1) translateY(-5px)" : "scale(1)"};
      box-shadow: ${isSelected ? "0 5px 15px rgba(255, 215, 0, 0.5)" : "none"};
      position: relative;
      transition: all 0.2s;
    `;

    const spriteContainer = document.createElement("div");
    spriteContainer.style.cssText =
      "width: 42px; height: 35px; overflow: hidden; display: flex; align-items: center; justify-content: center;";

    const sprite = document.createElement("div");
    sprite.style.cssText = this.getPokemonSpriteStyle(
      pokemon.speciesId || pokemon.id || 1
    );
    sprite.style.transform = "scale(0.6)";
    spriteContainer.appendChild(sprite);
    slot.appendChild(spriteContainer);

    const name = document.createElement("div");
    const pokemonName =
      pokemon.surnom ||
      pokemon.nom ||
      pokemon.name ||
      this.getPokemonName(pokemon.speciesId || pokemon.id);
    name.textContent = (pokemonName || "???").substring(0, 6);
    name.style.cssText =
      "font-size: 6px; color: white; font-family: 'Press Start 2P', monospace; text-align: center; text-shadow: 1px 1px 2px black; margin-bottom: 2px;";
    slot.appendChild(name);

    const hpBar = document.createElement("div");
    hpBar.style.cssText =
      "width: 85%; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;";

    const hpPercent = (hp / maxHp) * 100;
    const hpFill = document.createElement("div");
    hpFill.style.cssText = `width: ${hpPercent}%; height: 100%; background: ${
      hpPercent < 25 ? "#F44336" : hpPercent < 50 ? "#FFC107" : "#4CAF50"
    };`;
    hpBar.appendChild(hpFill);
    slot.appendChild(hpBar);

    if (pokemon.isOut) {
      const outBadge = document.createElement("div");
      outBadge.textContent = "OUT";
      outBadge.style.cssText =
        "position: absolute; top: 2px; right: 2px; background: rgba(255,0,0,0.9); color: white; font-size: 5px; padding: 1px 2px; border-radius: 2px; font-family: 'Press Start 2P', monospace;";
      slot.appendChild(outBadge);
    }

    return slot;
  }

  getSelectedPokemon() {
    return this.playerData.team[this.selectedPokemonIndex] || null;
  }

  canThrowSelectedPokemon() {
    const selected = this.getSelectedPokemon();
    if (!selected) return false;
    const hp = selected.stats?.hp ?? selected.hp ?? 0;
    return hp > 0 && !selected.isOut;
  }

  markPokemonAsOut(index) {
    if (this.playerData.team[index]) {
      this.playerData.team[index].isOut = true;
      this.updateTeamSelector();
    }
  }

  recallPokemon(index) {
    if (this.playerData.team[index]) {
      this.playerData.team[index].isOut = false;
      this.updateTeamSelector();
    }
  }

  // ==================== ACTIONS ====================

  addPokemonToTeam(pokemon) {
    if (this.playerData.team.length >= 6) return false;
    if (!pokemon.isOut) pokemon.isOut = false;

    this.playerData.team.push(pokemon);
    this.updateTeam();
    this.updateTeamSelector();

    if (!this.unlockedFeatures.team) this.unlockFeature("team");

    const pokemonId = pokemon.speciesId || pokemon.id;
    if (pokemonId) {
      if (!this.playerData.pokedex.captures)
        this.playerData.pokedex.captures = [];
      if (!this.playerData.pokedex.captures.includes(pokemonId)) {
        this.playerData.pokedex.captures.push(pokemonId);
        this.updatePokedex();
      }
    }

    return true;
  }

  useItem(itemKey) {
    if (!this.playerData.bag[itemKey] || this.playerData.bag[itemKey] <= 0)
      return;
    console.log(`Utilisation: ${itemKey}`);
    this.playerData.bag[itemKey]--;
    this.updateBag();
  }

  addMoney(amount) {
    this.playerData.money += amount;
    this.updatePlayerInfo();
  }

  removeMoney(amount) {
    if (this.playerData.money >= amount) {
      this.playerData.money -= amount;
      this.updatePlayerInfo();
      return true;
    }
    return false;
  }

  addItem(itemKey, amount = 1) {
    if (!this.playerData.bag[itemKey]) this.playerData.bag[itemKey] = 0;
    this.playerData.bag[itemKey] += amount;
    this.updateBag();
  }

  showInteractionHint(text) {
    const hint = document.getElementById("interaction-hint");
    if (hint) {
      hint.textContent = text;
      hint.style.display = "block";
    }
  }

  hideInteractionHint() {
    const hint = document.getElementById("interaction-hint");
    if (hint) hint.style.display = "none";
  }

  isMenuOpen() {
    return (
      this.currentMenu !== null ||
      document.getElementById("save-selection-overlay")?.classList.contains("visible")
    );
  }

  // ==================== DÉTAILS POKÉMON & ATTAQUES ====================

  showPokemonDetail(pokemon) {
      let detailOverlay = document.getElementById("pokemon-detail-overlay");
      if (!detailOverlay) {
          detailOverlay = document.createElement("div");
          detailOverlay.id = "pokemon-detail-overlay";
          detailOverlay.style.cssText = `
              position: fixed; top: 0; left: 0; width: 100%; height: 100%;
              background: rgba(0,0,0,0.85); z-index: 12000;
              display: none; justify-content: center; align-items: center;
              font-family: 'Press Start 2P', monospace; color: white;
          `;
          document.body.appendChild(detailOverlay);
      }

      // State
      this.selectedMoveIndex = null;
      this.selectedAvailableMove = null;

      const renderDetail = () => {
          const stats = pokemon.stats || {};
          const moves = pokemon.attaques || [null, null, null, null];
          
          // --- CALCUL DES ATTAQUES DISPONIBLES ---
          const movesetDB = this.saveManager?.movesetDatabase || {};
          const speciesId = pokemon.speciesId || pokemon.id;
          const moveset = movesetDB[speciesId];
          
          const knownMoves = new Set();
          if (moveset && moveset.attaquesParNiveau) {
              Object.entries(moveset.attaquesParNiveau).forEach(([lvl, mList]) => {
                  if (parseInt(lvl) <= (pokemon.level || 5)) {
                     mList.forEach(m => knownMoves.add(m));
                  }
              });
          }
          
          // Exclure celles déjà équipées
          const currentAttacks = moves.filter(m => m !== null);
          const availableMovesList = Array.from(knownMoves).filter(m => !currentAttacks.includes(m));

          // Génération HTML pour la liste des attaques actuelles
          const activeMovesHTML = moves.map((moveId, index) => {
              const moveName = moveId ? moveId.replace(/_/g, " ").toUpperCase() : "--- VIDE ---";
              const isSelected = this.selectedMoveIndex === index;
              const border = isSelected ? "2px solid #e74c3c" : "2px solid #34495e";
              const bg = isSelected ? "#34495e" : "#1a252f";
              
              return `
              <div data-index="${index}" class="move-slot" style="
                  padding: 10px; background: ${bg}; border: ${border};
                  border-radius: 5px; cursor: pointer;
                  font-size: 10px; text-align: center;
              ">
                  ${moveName}
              </div>`;
          }).join("");

          // Génération HTML pour la liste des attaques disponibles
          const availableMovesHTML = availableMovesList.length === 0 
              ? '<div style="font-size:8px; color:#777; text-align:center;">Aucune autre attaque</div>'
              : availableMovesList.map((moveId) => {
                  const moveName = moveId.replace(/_/g, " ").toUpperCase();
                  const isSelected = this.selectedAvailableMove === moveId;
                  const border = isSelected ? "2px solid #3498db" : "1px solid #555";
                  const bg = isSelected ? "#2980b9" : "#2c3e50";

                  return `
                  <div data-move="${moveId}" class="available-move" style="
                      padding: 8px; background: ${bg}; border: ${border};
                      border-radius: 5px; cursor: pointer;
                      font-size: 9px;
                  ">
                      ${moveName}
                  </div>`;
              }).join("");

          detailOverlay.innerHTML = `
              <div style="
                  width: 850px; background: #2c3e50; border: 4px solid #FFD700;
                  padding: 20px; border-radius: 15px; position: relative;
                  display: flex; gap: 20px;
              ">
                  <button id="close-detail" style="
                      position: absolute; top: 10px; right: 10px;
                      background: #e74c3c; border: none; color: white;
                      font-family: inherit; cursor: pointer; padding: 5px 10px;
                  ">X</button>

                  <!-- COL 1: Info & Stats -->
                  <div style="flex: 1; padding-right: 10px; border-right: 2px dashed #555;">
                      <div style="text-align: center; margin-bottom: 20px;">
                          <div style="${this.getPokemonSpriteStyle(pokemon.speciesId || pokemon.id)} transform: scale(2); image-rendering: pixelated; margin: 0 auto 20px auto;"></div>
                          <div style="font-size: 18px; color: #FFD700;">${pokemon.surnom || pokemon.name}</div>
                          <div style="font-size: 10px; color: #aaa;">Niv. ${pokemon.level || 5}</div>
                      </div>

                      <div style="font-size: 10px; line-height: 1.6; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px;">
                          <div>PV: ${pokemon.hp}/${stats.hpMax}</div>
                          <div>ATTAQUE: ${stats.attack}</div>
                          <div>DÉFENSE: ${stats.defense}</div>
                          <div>SPÉCIAL: ${stats.special}</div>
                          <div>VITESSE: ${stats.speed}</div>
                          <div style="margin-top: 10px; color: #4CAF50;">XP: ${pokemon.xp || 0}</div>
                      </div>
                  </div>

                  <!-- COL 2: Attaques Actuelles -->
                  <div style="flex: 1; display: flex; flex-direction: column;">
                      <div style="text-align: center; margin-bottom: 10px; color: #FFD700;">ACTUELLES</div>
                      <div style="font-size: 8px; color: #aaa; text-align: center; margin-bottom: 10px;">(Clique slot pour modif)</div>
                      
                      <div id="active-moves-list" style="display: flex; flex-direction: column; gap: 10px;">
                          ${activeMovesHTML}
                      </div>
                  </div>

                  <!-- COL 3: Attaques Disponibles -->
                  <div style="flex: 1; display: flex; flex-direction: column; padding-left: 10px; border-left: 2px dashed #555;">
                      <div style="text-align: center; margin-bottom: 10px; color: #3498db;">RÉSERVE</div>
                      <div style="font-size: 8px; color: #aaa; text-align: center; margin-bottom: 10px;">(Sélectionne slot + réserve)</div>

                      <div id="available-moves-list" style="
                          display: flex; flex-direction: column; gap: 5px; 
                          overflow-y: auto; max-height: 300px;
                      ">
                          ${availableMovesHTML}
                      </div>
                  </div>
              </div>
          `;

          // Events
          document.getElementById("close-detail").addEventListener("click", () => {
              detailOverlay.style.display = "none";
          });

          // 1. Click sur Atq Actuelle
          document.querySelectorAll(".move-slot").forEach(slot => {
              slot.addEventListener("click", (e) => {
                  const index = parseInt(slot.dataset.index);

                  if (this.selectedAvailableMove) {
                      // CAS A: On a une atq de réserve sélectionnée -> On remplace slot actuel
                      pokemon.attaques[index] = this.selectedAvailableMove;
                      this.selectedAvailableMove = null;
                      this.selectedMoveIndex = null;
                      if (this.saveManager) this.saveManager.save();
                      renderDetail();
                  } else {
                      // CAS B: Interne (Swap 2 slots actifs)
                      if (this.selectedMoveIndex === null) {
                          this.selectedMoveIndex = index;
                      } else if (this.selectedMoveIndex === index) {
                          this.selectedMoveIndex = null; // Deselect
                      } else {
                          // Swap
                          const temp = pokemon.attaques[this.selectedMoveIndex];
                          pokemon.attaques[this.selectedMoveIndex] = pokemon.attaques[index];
                          pokemon.attaques[index] = temp;
                          this.selectedMoveIndex = null;
                          if (this.saveManager) this.saveManager.save();
                      }
                      renderDetail();
                  }
              });
          });

          // 2. Click sur Atq Réserve
          document.querySelectorAll(".available-move").forEach(slot => {
              slot.addEventListener("click", (e) => {
                  const moveId = slot.dataset.move;
                  
                  if (this.selectedMoveIndex !== null) {
                      // CAS C: Slot Actif sélectionné -> On remplace par celle-ci
                      pokemon.attaques[this.selectedMoveIndex] = moveId;
                      this.selectedMoveIndex = null;
                      if (this.saveManager) this.saveManager.save();
                      renderDetail();
                  } else {
                      // CAS D: Juste sélection
                       if (this.selectedAvailableMove === moveId) {
                           this.selectedAvailableMove = null;
                       } else {
                           this.selectedAvailableMove = moveId;
                       }
                       renderDetail();
                  }
              });
          });
      };

      renderDetail();
      detailOverlay.style.display = "flex";
  }
  // ==================== BOUTIQUE ====================

  showShop() {
    // 1. Injecter le CSS si nécessaire
    if (!document.getElementById("shop-css")) {
        const link = document.createElement("link");
        link.id = "shop-css";
        link.rel = "stylesheet";
        link.href = "assets/css/shop.css";
        document.head.appendChild(link);
    }

    // 2. Créer le conteneur si nécessaire
    let shopContainer = document.getElementById("shop-container");
    if (!shopContainer) {
        shopContainer = document.createElement("div");
        shopContainer.id = "shop-container";
        shopContainer.innerHTML = `
            <div id="shop-header">
                <span>BOUTIQUE POKÉMON</span>
                <span id="shop-money">0 ₽</span>
            </div>
            <div id="shop-tabs">
                <div class="shop-tab active" data-tab="buy">ACHETER</div>
                <div class="shop-tab" data-tab="sell">VENDRE</div>
            </div>
            <div class="shop-content">
                <div id="shop-list">
                    <!-- Liste des objets -->
                </div>
                <div id="shop-details-panel">
                    <div id="shop-selected-icon"></div>
                    <div id="shop-selected-name">Sélectionnez un objet</div>
                    <div id="shop-selected-desc"></div>
                    
                    <div id="shop-actions">
                        <div class="quantity-selector">
                            <button class="quantity-btn" id="shop-minus">-</button>
                            <span class="quantity-display" id="shop-quantity">1</span>
                            <button class="quantity-btn" id="shop-plus">+</button>
                        </div>
                        <button id="shop-confirm-btn" disabled>CONFIRMER</button>
                    </div>
                </div>
            </div>
            <button id="shop-close" style="position:absolute; top:10px; right:150px; background:red; color:white; border:none; padding:5px 10px; cursor:pointer;">X</button>
        `;
        document.body.appendChild(shopContainer);

        // Bind Events
        shopContainer.querySelector("#shop-close").onclick = () => {
            shopContainer.style.display = "none";
            // Réactiver les contrôles de jeu si nécessaire
        };

        const tabs = shopContainer.querySelectorAll(".shop-tab");
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                this.refreshShopList(tab.dataset.tab);
            };
        });

        document.getElementById("shop-minus").onclick = () => this.updateShopQuantity(-1);
        document.getElementById("shop-plus").onclick = () => this.updateShopQuantity(1);
        document.getElementById("shop-confirm-btn").onclick = () => this.confirmShopTransaction();
    }

    // 3. Afficher et initialiser
    shopContainer.style.display = "flex";
    this.currentShopTab = "buy";
    this.currentShopItem = null;
    this.currentShopQuantity = 1;
    this.refreshShopList("buy");
    this.updateShopMoney();
  }

  updateShopMoney() {
    const moneyEl = document.getElementById("shop-money");
    if (moneyEl && this.saveManager) {
        moneyEl.textContent = `${this.saveManager.saveData.joueur.argent} ₽`;
    }
  }

  refreshShopList(mode) {
    this.currentShopTab = mode;
    const listEl = document.getElementById("shop-list");
    listEl.innerHTML = "";
    this.currentShopItem = null;
    this.updateShopDetails();

    if (!this.saveManager || !this.saveManager.itemsDatabase) {
        console.warn("[UI] itemsDatabase manquant ou SaveManager inexistant");
        return;
    }
    
    console.log("[UI] itemsDatabase keys:", Object.keys(this.saveManager.itemsDatabase));

    let itemsToShow = [];

    if (mode === "buy") {
        // Liste définie d'objets achetables (ou depuis pnj.json si on voulait être dynamique)
        // Pour l'instant on hardcode une liste standard
        const standardItems = [
            "pokeball", "superball", "hyperball",
            "potion", "super_potion", "hyper_potion",
            "antidote", "anti_para", "anti_brule", "reveil", "antigel", "total_soin",
            "corde_sortie", "repousse", "super_repousse", "repousse_max"
        ];

        // On parcourt la DB pour trouver ces items
        for (const [category, items] of Object.entries(this.saveManager.itemsDatabase)) {
            for (const [id, itemData] of Object.entries(items)) {
                if (standardItems.includes(id) && itemData.prix > 0) {
                    itemsToShow.push({ id, ...itemData, category });
                }
            }
        }
    } else {
        // Mode Vente : Contenu du sac
        const bag = this.saveManager.saveData.sac;
        for (const [category, items] of Object.entries(bag)) {
             // Skip clés et objets spéciaux si nécessaire
             if (category === "cles") continue;
             
             for (const [id, qty] of Object.entries(items)) {
                 // Retrouver les infos de l'objet dans la DB
                 const dbCategory = this.saveManager.itemsDatabase[category] || this.saveManager.itemsDatabase["divers"];
                 const itemData = dbCategory ? dbCategory[id] : { nom: id, prixVente: 0 };
                 
                 if (itemData && itemData.prixVente > 0) {
                     itemsToShow.push({ id, ...itemData, category, quantity: qty });
                 }
             }
        }
    }

    // Générer le HTML
    itemsToShow.forEach(item => {
        const el = document.createElement("div");
        el.className = "shop-item";
        el.innerHTML = `
            <div class="shop-item-icon"></div>
            <div class="shop-item-details">
                <div style="font-weight:bold">${item.nom}</div>
                <div style="font-size:12px; color:#666">${mode === 'sell' ? 'x'+item.quantity : ''}</div>
            </div>
            <div class="shop-item-price">${mode === 'buy' ? item.prix : item.prixVente} ₽</div>
        `;
        el.onclick = () => this.selectShopItem(item, el);
        listEl.appendChild(el);
    });
  }

  selectShopItem(item, el) {
    // Highlight
    document.querySelectorAll(".shop-item").forEach(i => i.classList.remove("selected"));
    el.classList.add("selected");

    this.currentShopItem = item;
    this.currentShopQuantity = 1;
    this.updateShopDetails();
  }

  updateShopQuantity(delta) {
    if (!this.currentShopItem) return;
    
    const newQty = this.currentShopQuantity + delta;
    if (newQty < 1) return;
    
    // En mode vente, pas plus que ce qu'on a
    if (this.currentShopTab === "sell" && newQty > this.currentShopItem.quantity) return;

    // En mode achat, pas plus que ce qu'on peut payer (optionnel, mais UX sympa)
    if (this.currentShopTab === "buy") {
        const maxAffordable = Math.floor(this.saveManager.saveData.joueur.argent / this.currentShopItem.prix);
        if (newQty > maxAffordable && maxAffordable > 0) {
            // On laisse l'utilisateur monter mais le bouton sera désactivé ou rouge
        }
    }

    this.currentShopQuantity = newQty;
    this.updateShopDetails();
  }

  updateShopDetails() {
    const nameEl = document.getElementById("shop-selected-name");
    const descEl = document.getElementById("shop-selected-desc");
    const qtyDisplay = document.getElementById("shop-quantity");
    const btn = document.getElementById("shop-confirm-btn");

    if (!this.currentShopItem) {
        nameEl.textContent = "Sélectionnez un objet";
        descEl.textContent = "";
        qtyDisplay.textContent = "1";
        btn.disabled = true;
        btn.textContent = "CONFIRMER";
        return;
    }

    nameEl.textContent = this.currentShopItem.nom;
    descEl.textContent = this.currentShopItem.description || "";
    qtyDisplay.textContent = this.currentShopQuantity;

    const unitPrice = this.currentShopTab === "buy" ? this.currentShopItem.prix : this.currentShopItem.prixVente;
    const total = unitPrice * this.currentShopQuantity;
    
    btn.textContent = `${this.currentShopTab === "buy" ? "ACHETER" : "VENDRE"} pour ${total} ₽`;

    // Validation
    if (this.currentShopTab === "buy") {
        btn.disabled = this.saveManager.saveData.joueur.argent < total;
    } else {
        btn.disabled = false;
    }
  }

  confirmShopTransaction() {
    if (!this.currentShopItem) return;

    const success = this.currentShopTab === "buy" 
        ? this.saveManager.buyItem(this.currentShopItem.id, this.currentShopQuantity, this.currentShopItem.prix)
        : this.saveManager.sellItem(this.currentShopItem.id, this.currentShopQuantity, this.currentShopItem.prixVente);

    if (success) {
        this.showNotification(`Transaction réussie !`);
        this.updateShopMoney();
        this.refreshShopList(this.currentShopTab); // Refresh pour update les quantités
        
        // Mettre à jour l'HUD principal (argent)
        this.syncFromSaveManager();
        this.updatePlayerInfo();
    } else {
        this.showNotification("Échec de la transaction", "error");
    }
  }
}
  