import * as THREE from "three";
// FORCE REBUILD: 2026-01-19 05:08

export class CombatManager {
  constructor(scene, camera, uiManager, pokemonManager, typeManager, moveManager, xpManager) {
    this.scene = scene;
    this.camera = camera;
    this.uiManager = uiManager;
    this.pokemonManager = pokemonManager; // Injected
    this.typeManager = typeManager;
    this.moveManager = moveManager;
    this.xpManager = xpManager;

    // FIX: Fallback si MoveManager est mal injecté
    if (!this.moveManager || typeof this.moveManager.getMove !== 'function') {
        console.error("🚨 CRITICAL: MoveManager non valide !", this.moveManager);
        this.moveManager = {
            getMove: (id) => {
                console.warn(`⚠️ MoveManager Fallback used for ${id}`);
                return {
                    nom: "Charge",
                    type: "normal",
                    puissance: 40,
                    precision: 100,
                    description: "Attaque de secours"
                };
            },
            init: () => {}
        };
    }

    console.log("🛠️ CombatManager Dependencies:", {
        pokemonManager,
        typeManager,
        moveManager,
        moveManagerHasGetMove: moveManager?.getMove ? "YES" : "NO",
        xpManager
    });

    this.isInCombat = false;
    this.playerPokemon = null;
    this.wildPokemon = null;
    this.playerPokemonEntity = null;

    // Position des Pokémon pendant le combat
    this.playerPokemonPosition = new THREE.Vector3();
    this.wildPokemonPosition = new THREE.Vector3();

    // États du combat
    this.combatState = "IDLE";
    this.turnQueue = [];

    this.combatUI = null;

    // Mode caméra
    this.freeCameraMode = true;
    this.setupCameraToggle();

    // FIX: Sauvegarder la position originale du joueur AVANT le combat
    this.originalPlayerPosition = new THREE.Vector3();
    this.originalPlayerRotation = new THREE.Euler();

    // FIX: Système d'occlusion - objets rendus invisibles
    this.hiddenObjects = [];
    this.raycaster = new THREE.Raycaster();

    // Callback de fin de combat
    this.onCombatEndCallback = null;
  }

  startCombat(playerPokemon, wildPokemon, playerPokemonEntity, trainer = null, enemyTeam = [], respawnPosition = null) {
    console.log(
      `⚔️ Combat started: ${playerPokemon.name} vs ${wildPokemon.name} (Trainer: ${trainer?.nom})`
    );

    this.isInCombat = true;
    this.currentTrainer = trainer; // Stocker le dresseur
    this.enemyTeam = enemyTeam;    // Stocker l'équipe complète
    this.currentEnemyIndex = 0;    // Index du Pokémon actuel

    // Si c'est un dresseur, wildPokemon est le premier de l'équipe
    this.wildPokemon = wildPokemon; 
    
    this.playerPokemon = playerPokemon;
    this.playerPokemonEntity = playerPokemonEntity;

    // Bloquer le Pokémon sauvage
    this.wildPokemon.inCombat = true;

    // Bloquer le Pokémon du joueur
    if (this.playerPokemonEntity) {
      this.playerPokemonEntity.inCombat = true;
    }

    // FIX: Sauvegarder la position ORIGINALE du joueur
    if (respawnPosition) {
        this.originalPlayerPosition.copy(respawnPosition);
    } else {
        this.originalPlayerPosition.copy(this.camera.position);
    }
    this.originalPlayerRotation.copy(this.camera.rotation);

    // Sauvegarder aussi pour le toggle caméra
    this.savedCameraPosition = this.camera.position.clone();
    this.savedCameraRotation = this.camera.rotation.clone();

    // Tuto Combat
    if (this.uiManager.tutorialSystem) {
         if (trainer) {
             this.uiManager.tutorialSystem.showIfNotSeen('trainers');
         } else {
             this.uiManager.tutorialSystem.showIfNotSeen('combat');
         }
    }

    // Positionner les Pokémon face à face
    this.setupCombatPositions();

    // Démarrer en mode caméra de combat
    this.freeCameraMode = false;
    this.setCombatCamera();

    // Initialiser l'UI de combat
    console.log("🔍 startCombat: About to call showCombatUI()...");
    console.log("🔍 typeof this.showCombatUI:", typeof this.showCombatUI);
    console.log("🔍 this.showCombatUI exists?", !!this.showCombatUI);
    
    if (typeof this.showCombatUI === 'function') {
        this.showCombatUI();
    } else {
        console.error("❌ showCombatUI is NOT a function! Type:", typeof this.showCombatUI);
    }
    if (this.uiManager) {
      this.uiManager.showDialogue(`Un ${this.getPokemonName(wildPokemon)} sauvage apparaît !`);
    }
    
    // Configurer la caméra pour le combat
    this.setCombatCamera();
    this.combatState = "PLAYER_TURN";
    // console.log("C'est votre tour !");
    
    // FIX: Masquer le HUD au démarrage du combat
    if (this.uiManager && this.uiManager.modernHUD) {
        this.uiManager.modernHUD.hideForCombat();
    }
  }

  setupCombatPositions() {
    // Position du Pokémon sauvage (ne bouge pas)
    this.wildPokemonPosition = this.wildPokemon.model.position.clone();
    // FIX: Ne pas forcer Y=0 car on peut être en hauteur sur la map
    // this.wildPokemonPosition.y = 0; 

    // Position du Pokémon joueur : à mi-chemin entre le joueur et le Pokémon sauvage
    const dirToWild = new THREE.Vector3()
      .subVectors(this.wildPokemonPosition, this.camera.position)
      .normalize();

    const distanceToWild = this.camera.position.distanceTo(
      this.wildPokemonPosition
    );

    const middleDistance = Math.max(distanceToWild * 0.4, 2.5);
    this.playerPokemonPosition = this.camera.position
      .clone()
      .add(dirToWild.clone().multiplyScalar(middleDistance));
    
    // FIX: Ajuster la hauteur à celle du Pokémon sauvage (supprime le bug du vide)
    this.playerPokemonPosition.y = this.wildPokemonPosition.y;

    // Positionner le Pokémon joueur
    const positionPlayerPokemon = () => {
      if (this.playerPokemonEntity && this.playerPokemonEntity.model) {
        const model = this.playerPokemonEntity.model;
        
        // 1. Position de base (au sol théorique)
        model.position.copy(this.playerPokemonPosition);

        // 2. Rotation avec lookAt
        model.lookAt(this.wildPokemonPosition.x, model.position.y, this.wildPokemonPosition.z);

        // 3. AUTO-GROUNDING (Cale-pied automatique)
        // On calcule la Bounding Box pour trouver le point le plus bas du modèle
        const box = new THREE.Box3().setFromObject(model);
        const heightOffset = -box.min.y; // Si min.y est -10, on doit monter de +10
        
        // Si le modèle est "centré" (min.y < 0), on le remonte
        // Si le min.y est > 0 (flotte), on le descend (offset sera négatif ? non, min.y serait > heightOffset serait négatif.. wait)
        // Correction : On doit annuler le décalage actuel par rapport à 0.
        // Mais box.min.y est en World Coordinates !
        // Si model.position.y = 0, et box.min.y = -50, c'est qu'il est enterré. Il faut ajouter 50.
        // Offset = 0 - box.min.y
        
        if (Math.abs(heightOffset) > 0.01) {
             model.position.y += heightOffset;
             console.log(`📏 Auto-Grounding: Décalage de ${heightOffset.toFixed(3)} pour toucher le sol.`);
        }

        console.log(
          `✅ Pokémon joueur positionné à (${this.playerPokemonPosition.x.toFixed(
            1
          )}, ${this.playerPokemonPosition.z.toFixed(1)})`
        );
      } else {
        setTimeout(positionPlayerPokemon, 100);
      }
    };
    positionPlayerPokemon();

    // FIX: Faire regarder le Pokémon JOUEUR par le Pokémon sauvage (pas la caméra du player)
    // Utilisation de lookAt pour garantir l'orientation correcte
    if (this.wildPokemon.model) {
        this.wildPokemon.model.lookAt(this.playerPokemonPosition.x, this.wildPokemon.model.position.y, this.playerPokemonPosition.z);
    }

    /* 
    const dirToPlayerPokemon = new THREE.Vector3()
      .subVectors(this.playerPokemonPosition, this.wildPokemonPosition)
      .normalize();

    // FIX: Angle corrigé pour faire face au Pokémon joueur
    const angleWild = Math.atan2(-dirToPlayerPokemon.x, -dirToPlayerPokemon.z);
    this.wildPokemon.model.rotation.y = angleWild;

    console.log(
      `🔄 Pokémon sauvage regarde vers Pokémon joueur, angle=${angleWild.toFixed(
        2
      )}`
    );
    */
  }

  setupCameraToggle() {
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "a" && this.isInCombat) {
        this.toggleCameraMode();
      }
    });
  }

  toggleCameraMode() {
    this.freeCameraMode = !this.freeCameraMode;

    const combatUI = document.getElementById("combat-ui");

    if (this.freeCameraMode) {
      console.log("📷 Mode caméra libre");
      this.camera.position.copy(this.savedCameraPosition);
      this.camera.rotation.copy(this.savedCameraRotation);

      // FIX: Restaurer les objets cachés en mode libre
      this.restoreHiddenObjects();

      if (combatUI) {
        combatUI.style.display = "none";
      }
    } else {
      console.log("🎬 Mode caméra combat");
      this.setCombatCamera();

      if (combatUI) {
        combatUI.style.display = "flex";
      }
    }
  }

  setCombatCamera() {
    const p1 = this.playerPokemonPosition;
    const p2 = this.wildPokemonPosition;
    
    // Centre du combat (au sol)
    const centerPoint = new THREE.Vector3()
      .addVectors(p1, p2)
      .multiplyScalar(0.5);

    // Vecteur de l'axe de combat (Player -> Enemy)
    const combatAxis = new THREE.Vector3().subVectors(p2, p1).normalize();
    
    // Vecteur de côté (Perpendiculaire)
    const up = new THREE.Vector3(0, 1, 0);
    const sideDir = new THREE.Vector3().crossVectors(combatAxis, up).normalize();
    
    // Paramètres de la caméra
    const distanceSide = 6;  // Distance sur le côté
    const distanceBack = 3;  // Recul par rapport au centre
    const height = 4;        // Hauteur

    // Position : Centre + Côté + Recul + Hauteur
    const cameraPos = centerPoint.clone()
        .add(sideDir.multiplyScalar(distanceSide))
        .add(combatAxis.multiplyScalar(-distanceBack)) // Un peu en arrière du centre
        .add(new THREE.Vector3(0, height, 0));

    this.camera.position.copy(cameraPos);
    this.camera.lookAt(centerPoint);
    
    // Debug visuel (optionnel)
    console.log(`🎥 Caméra placée. DistSide=${distanceSide}, H=${height}`);
  }

  showCombatUI() {
    console.log("🔍 CombatManager: showCombatUI ENTRY (BEFORE TRY) - CODE VERSION: 2026-01-19-05:02");
    
    try {
        console.log("🔍 CombatManager: showCombatUI INSIDE TRY");
        
        // FIX: Support VR - Utiliser le VRPanel au lieu du DOM
        const isVR = this.uiManager && this.uiManager.game && this.uiManager.game.renderer.xr.isPresenting;
        console.log("🔍 CombatManager: showCombatUI VR Check:", {
            hasUIManager: !!this.uiManager,
            hasGame: !!this.uiManager?.game,
            hasRenderer: !!this.uiManager?.game?.renderer,
            hasXR: !!this.uiManager?.game?.renderer?.xr,
            isPresenting: this.uiManager?.game?.renderer?.xr?.isPresenting,
            finalIsVR: isVR
        });
        
        if (isVR) {
            console.log("⚔️ CombatManager: VR Mode detected -> Show VRBattlePanel");
            // Update data first
            this.uiManager.game.vrManager.updateBattlePanel({
                playerPokemon: this.playerPokemon,
                wildPokemon: this.wildPokemon,
                message: `Un ${this.getPokemonName(this.wildPokemon)} apparaît !`
            });
            this.uiManager.game.vrManager.showBattlePanel({
                playerPokemon: this.playerPokemon,
                wildPokemon: this.wildPokemon
            });
            
            // Hide standard HUD
            if (this.uiManager.modernHUD) this.uiManager.modernHUD.hideForCombat();
            
            return;
        }
    } catch (error) {
        console.error("❌ ERROR in showCombatUI:", error);
        console.error("Stack:", error.stack);
    }

    let combatContainer = document.getElementById("combat-ui");

    if (!combatContainer) {
      combatContainer = document.createElement("div");
      combatContainer.id = "combat-ui";
      document.body.appendChild(combatContainer);
    }

    combatContainer.style.cssText = `
      position: fixed;
      bottom: 2px;
      left: 0;
      right: 0;
      height: 250px;
      background: rgba(0, 0, 0, 0.8);
      border-top: 3px solid #FFD700;
      display: flex;
      flex-direction: column;
      padding: 20px;
      font-family: 'Press Start 2P', monospace;
      color: white;
      z-index: 1000;
    `;

    combatContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        <div>
          <div style="font-size: 14px; margin-bottom: 5px;">${this.getPokemonName(
            this.wildPokemon
          )} (Niv. ${this.getPokemonLevel(this.wildPokemon)})</div>
          <div class="hp-bar-combat" style="width: 200px; height: 20px; background: rgba(255,255,255,0.3); border-radius: 10px; overflow: hidden;">
            <div style="width: ${
              (this.getPokemonHp(this.wildPokemon) /
                this.getPokemonMaxHp(this.wildPokemon)) *
              100
            }%; height: 100%; background: #4CAF50;"></div>
          </div>
          <div style="font-size: 10px; margin-top: 5px;">HP: ${this.getPokemonHp(
            this.wildPokemon
          )}/${this.getPokemonMaxHp(this.wildPokemon)}</div>
        </div>
        
        <div style="text-align: right;">
          <div style="font-size: 14px; margin-bottom: 5px;">${this.getPokemonName(
            this.playerPokemon
          )} (Niv. ${this.getPokemonLevel(this.playerPokemon)})</div>
          <div class="hp-bar-combat" style="width: 200px; height: 20px; background: rgba(255,255,255,0.3); border-radius: 10px; overflow: hidden;">
            <div style="width: ${
              (this.getPokemonHp(this.playerPokemon) /
                this.getPokemonMaxHp(this.playerPokemon)) *
              100
            }%; height: 100%; background: #4CAF50;"></div>
          </div>
          <div style="font-size: 10px; margin-top: 5px;">HP: ${this.getPokemonHp(
            this.playerPokemon
          )}/${this.getPokemonMaxHp(this.playerPokemon)}</div>
        </div>
      </div>
      
      <div id="combat-menu" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <!-- Menu Principal -->
        <div id="main-menu-buttons" style="display: contents;">
            <button class="combat-button" data-action="attack">⚔️ ATTAQUE</button>
            <button class="combat-button" data-action="bag">🎒 SAC</button>
            <button class="combat-button" data-action="pokemon">📦 ÉQUIPE</button>
            <button class="combat-button" data-action="run" 
                style="${this.currentTrainer ? 'opacity: 0.5; cursor: not-allowed; background: #555;' : ''}"
            >${this.currentTrainer ? '🚫 DUEL' : '🏃 FUITE'}</button>
        </div>
        
        <!-- Sous-menu Attaques (caché par défaut) -->
        <div id="attack-menu-buttons" style="display: none; contents;">
            <!-- Sera rempli dynamiquement -->
        </div>
      </div>
    `;

    // Ajouter styles des boutons
    const style = document.createElement("style");
    style.textContent = `
      .combat-button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: 2px solid #FFD700;
        color: white;
        padding: 15px;
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        cursor: pointer;
        border-radius: 10px;
        transition: transform 0.2s;
      }
      .combat-button:hover {
        transform: scale(1.05);
        background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
      }
      .combat-button:active {
        transform: scale(0.95);
      }
    `;
    document.head.appendChild(style);

    // Ajouter event listeners
    document.querySelectorAll(".combat-button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const action = e.target.dataset.action;
        this.handleCombatAction(action);
      });
    });
  }

  handleCombatAction(action, moveId = null) {
    if (this.combatState !== "PLAYER_TURN") return;

    switch (action) {
      case "attack":
        this.showAttackMenu();
        break;
      case "use_move":
        // Support VR: moveId passé en paramètre, sinon récupérer depuis dataset (desktop)
        const actualMoveId = moveId || document.activeElement?.dataset?.moveId;
        if (actualMoveId) {
          this.executePlayerMove(actualMoveId);
        }
        break;
      case "back":
        this.showMainMenu();
        break;
      case "bag":
        this.showBagMenu();
        break;
      case "pokemon":
        this.showSwitchPokemonMenu();
        break;
      case "run":
        this.attemptRun();
        break;
    }
  }

  showBagMenu() {
      const bag = this.uiManager.playerData.bag;
      const items = Object.entries(bag).filter(([_, count]) => count > 0);

      if (items.length === 0) {
          this.uiManager.showNotification("Le sac est vide !");
          return;
      }

      // Utiliser le même container que l'attaque pour lister les objets
      const attackMenu = document.getElementById("attack-menu-buttons");
      const mainMenu = document.getElementById("main-menu-buttons");
      
      if (attackMenu && mainMenu) {
          mainMenu.style.display = "none";
          attackMenu.style.display = "grid";
          attackMenu.innerHTML = "";

          // Bouton Retour
          const backBtn = document.createElement("button");
          backBtn.className = "combat-btn";
          backBtn.textContent = "RETOUR";
          backBtn.onclick = () => this.showMainMenu();
          attackMenu.appendChild(backBtn);

          items.forEach(([itemKey, count]) => {
              const btn = document.createElement("button");
              btn.className = "combat-btn";
              btn.textContent = `${itemKey} (${count})`;
              btn.onclick = () => this.useCombatItem(itemKey);
              attackMenu.appendChild(btn);
          });
      }
  }

  useCombatItem(itemKey) {
      if (itemKey.includes("potion")) {
          // Logique soin
          const maxHp = this.getPokemonMaxHp(this.playerPokemon);
          const currentHp = this.getPokemonHp(this.playerPokemon);
          
          if (currentHp >= maxHp) {
              this.uiManager.showNotification("PV déjà au max !");
              return;
          }

          // Soin 20 PV (Potion basique)
          const healAmount = 20;
          this.playerPokemon.hp = Math.min(maxHp, currentHp + healAmount);
          
          this.uiManager.useItem(itemKey); // Décrémenter du sac
          
          this.uiManager.showDialogue(`${this.getPokemonName(this.playerPokemon)} récupère des PV !`);
          this.updateCombatUI();
          this.showMainMenu();

          // Utiliser un objet coûte un tour
          setTimeout(() => this.enemyTurn(), 1000);

      } else if (itemKey.includes("pokeball")) {
           this.uiManager.showNotification("Utilise 'F' pour lancer !");
      } else {
          this.uiManager.showNotification("Obj. inutilisable en combat");
      }
  }

  // FIX: Menu pour changer de Pokémon volontairement
  showSwitchPokemonMenu() {
    const availablePokemon = this.uiManager.playerData.team.filter(
      (p) => this.getPokemonHp(p) > 0 && p.name !== this.playerPokemon.name
    );

    if (availablePokemon.length === 0) {
      this.uiManager.showNotification("Aucun autre Pokémon valide !");
      return;
    }

    this.combatState = "SELECTING_POKEMON";

    // VR: Utiliser VRBattlePanel pour la sélection
    const isVR = this.uiManager?.game?.renderer?.xr?.isPresenting;
    if (isVR && this.uiManager?.game?.vrManager?.vrBattlePanel) {
        console.log("🎮 VR: Affichage du menu de changement de Pokémon");
        this.uiManager.game.vrManager.vrBattlePanel.showPokemonSelection((index) => {
            this.switchPokemon(index);
        });
        return;
    }

    // Masquer le menu de combat
    const combatMenu = document.getElementById("combat-menu");
    if (combatMenu) {
      combatMenu.style.display = "none";
    }

    // Créer le menu de sélection
    let selectionContainer = document.getElementById("pokemon-selection");
    if (!selectionContainer) {
      selectionContainer = document.createElement("div");
      selectionContainer.id = "pokemon-selection";
      document.body.appendChild(selectionContainer);
    }

    selectionContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      border: 4px solid #FFD700;
      border-radius: 20px;
      padding: 30px;
      z-index: 2000;
      font-family: 'Press Start 2P', monospace;
      color: white;
      min-width: 400px;
    `;

    let pokemonButtons = availablePokemon
      .map((pokemon) => {
        // Calculs HP via helpers (sûr)
        const currentHp = this.getPokemonHp(pokemon);
        const maxHp = this.getPokemonMaxHp(pokemon);
        const hpPercent = (currentHp / maxHp) * 100;
        
        let hpColor = "#4CAF50";
        if (hpPercent < 50) hpColor = "#FFC107";
        if (hpPercent < 25) hpColor = "#F44336";

        return `
        <button class="pokemon-select-btn" data-index="${this.uiManager.playerData.team.indexOf(
          pokemon
        )}" style="
          display: flex;
          align-items: center;
          gap: 15px;
          width: 100%;
          padding: 15px;
          margin: 10px 0;
          background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
          border: 2px solid #FFD700;
          border-radius: 10px;
          color: white;
          font-family: 'Press Start 2P', monospace;
          font-size: 12px;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        ">
          <div style="
            width: 50px;
            height: 50px;
            background: #667eea;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
          ">🔴</div>
          <div style="flex: 1; text-align: left;">
            <div style="margin-bottom: 8px;">${this.getPokemonName(pokemon)} (Niv. ${this.getPokemonLevel(pokemon)})</div>
            <div style="
              width: 100%;
              height: 8px;
              background: rgba(255,255,255,0.3);
              border-radius: 4px;
              overflow: hidden;
            ">
              <div style="width: ${hpPercent}%; height: 100%; background: ${hpColor};"></div>
            </div>
            <div style="font-size: 10px; margin-top: 5px;">HP: ${currentHp}/${maxHp}</div>
          </div>
        </button>
      `;
      })
      .join("");

    selectionContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 14px;">Changer de Pokémon :</div>
        <div style="font-size: 10px; color: #bdc3c7; margin-top: 5px;">(Coûte votre tour)</div>
      </div>
      ${pokemonButtons}
      <button id="cancel-switch" style="
        width: 100%;
        padding: 12px;
        margin-top: 15px;
        background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);
        border: 2px solid #FFD700;
        border-radius: 10px;
        color: white;
        font-family: 'Press Start 2P', monospace;
        font-size: 11px;
        cursor: pointer;
      ">❌ ANNULER</button>
    `;

    // Event listeners
    selectionContainer
      .querySelectorAll(".pokemon-select-btn")
      .forEach((btn) => {
        btn.addEventListener("mouseenter", () => {
          btn.style.transform = "scale(1.02)";
          btn.style.background =
            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.transform = "scale(1)";
          btn.style.background =
            "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)";
        });
        btn.addEventListener("click", (e) => {
          const index = parseInt(e.currentTarget.dataset.index);
          this.switchPokemon(index);
        });
      });

    // Bouton annuler
    document.getElementById("cancel-switch").addEventListener("click", () => {
      this.cancelSwitch();
    });
  }

  // FIX: Changer de Pokémon (coûte un tour)
  async switchPokemon(index) {
    const newPokemon = this.uiManager.playerData.team[index];
    if (!newPokemon || this.getPokemonHp(newPokemon) <= 0) return;

    console.log(
      `🔄 ${this.playerPokemon.name} revient ! ${newPokemon.name} entre en combat !`
    );

    // 1. Fermer le menu
    const selectionContainer = document.getElementById("pokemon-selection");
    if (selectionContainer) selectionContainer.remove();

    // 2. Mettre à jour les données
    this.playerPokemon = newPokemon;
    
    // 3. Mettre à jour le modèle 3D
    // Nettoyer l'ancien
    if (this.playerPokemonEntity) {
        if (this.playerPokemonEntity.model) {
            this.scene.remove(this.playerPokemonEntity.model);
        }
    }
    
    // Spawner le nouveau
    // On doit récupérer ou recréer l'entité. 
    // Pour simplifier, on utilise PokemonManager.spawnPokemon comme pour l'ennemi
    const spawnPos = this.playerPokemonPosition.clone();
    // On veut le modèle visuel. Il faut les données de base pour le spawn
    const speciesId = newPokemon.speciesId || newPokemon.id;
    const baseData = this.pokemonManager.pokemonDatabase.find(p => p.id === speciesId);
    
    if (baseData) {
        this.playerPokemonEntity = await this.pokemonManager.spawnPokemon(spawnPos, {
            ...baseData,
            level: newPokemon.level
        }, true);
        
        // Appliquer HP actuels à l'entité visuelle
        this.playerPokemonEntity.hp = this.getPokemonHp(newPokemon);
        this.playerPokemonEntity.maxHp = this.getPokemonMaxHp(newPokemon);
        this.playerPokemonEntity.isPlayerPokemon = true;

        // Orienter vers l'ennemi
        if (this.wildPokemon && this.wildPokemon.model) {
            this.playerPokemonEntity.model.lookAt(this.wildPokemon.model.position);
        }
    }

    // 4. Mettre à jour l'UI
    this.uiManager.showDialogue(`À toi ${this.getPokemonName(newPokemon)} !`);
    this.updateCombatUI();
    this.showMainMenu();
    this.combatState = "OPPONENT_TURN"; // Le nom est trompeur, nextTurn() gère l'alternance
    
    // Le changement coûte un tour
    setTimeout(() => {
        this.enemyTurn();
    }, 1500);
  }


  // FIX: Annuler le changement
  cancelSwitch() {
    const selectionContainer = document.getElementById("pokemon-selection");
    if (selectionContainer) {
      selectionContainer.remove();
    }

    const combatMenu = document.getElementById("combat-menu");
    if (combatMenu) {
      combatMenu.style.display = "grid";
    }

    this.combatState = "PLAYER_TURN";
  }

  enemyTurn() {
    // FIX: Vérifier si le combat est fini ou si le Pokémon est KO avant d'attaquer
    if (this.combatState !== "OPPONENT_TURN" || 
        this.combatState === "VICTORY" || 
        this.combatState === "DEFEAT") return;

    if (!this.wildPokemon || this.getPokemonHp(this.wildPokemon) <= 0) {
        console.warn("⚠️ Enemy turn skipped: Pokemon is dead or null");
        return;
    }

    // IA Simple: Choisir une attaque au hasard
    const moves = this.wildPokemon.attaques || ["charge"];
    const randomMoveId = moves[Math.floor(Math.random() * moves.length)];
    
    // Si l'ID est un objet (legacy), on prend son nom ou ID
    const moveId = (typeof randomMoveId === 'string') ? randomMoveId : String(randomMoveId).toLowerCase();

    const move = this.moveManager.getMove(moveId);
    
    if (move) {
        // Menu reste visible
        // this.showMainMenu(false); 

        console.log(`Ennemi utilise ${move.nom}`);
        this.uiManager.showDialogue(`${this.getPokemonName(this.wildPokemon)} utilise ${move.nom} !`);

        if (move.categorie !== "statut") {
            const damageInfo = this.calculateDamage(this.wildPokemon, this.playerPokemon, move);
            
            setTimeout(() => {
                this.applyDamage(this.playerPokemon, damageInfo.damage);
                
                if (damageInfo.effectiveness > 1) this.uiManager.showNotification("C'est super efficace !");
                if (damageInfo.effectiveness < 1 && damageInfo.effectiveness > 0) this.uiManager.showNotification("Ce n'est pas très efficace...");
                if (damageInfo.critical) this.uiManager.showNotification("Coup critique !");

                this.nextTurn();
            }, 1000);
        } else {
            setTimeout(() => {
                this.uiManager.showNotification("L'ennemi rate son statut !");
                this.nextTurn();
            }, 1000);
        }
    } else {
        // Fallback si pas d'attaque trouvée
        console.warn("Pas d'attaque trouvée pour l'ennemi, passe son tour.");
        this.nextTurn();
    }
  }

  attemptRun() {
    console.log("Tentative de fuite...");

    if (Math.random() > 0.5) {
      console.log("✅ Fuite réussie!");
      this.endCombat(true); // FIX: Passer true pour indiquer une fuite
    } else {
      console.log("❌ Impossible de fuir!");
      this.enemyTurn();
    }
  }

  victory() {
    console.log("🎉 Victoire!");
    this.combatState = "VICTORY";

    if (this.xpManager) {
        const result = this.xpManager.gainXP(this.playerPokemon, this.wildPokemon);
        console.log(`+${result.xpGained} XP`);
        
        let message = `Gagné ! +${result.xpGained} XP.`;
        if (result.leveledUp) {
            message += ` Niveau ${result.newLevel} atteint !`;
            this.uiManager.showNotification(`Niveau ${result.newLevel} atteint !`, "success");
        }
        
        this.uiManager.showNotification(message);
    } else {
        // Fallback legacy
        const xpGained = Math.floor(this.wildPokemon.level * 10);
        console.log(`+${xpGained} XP (Legacy)`);
    }

    // Nettoyage: Si c'est un Pokémon sauvage (ou entity dresseur)
    // On le retire de la scène
    if (this.wildPokemon && this.wildPokemon.remove) {
         this.wildPokemon.remove(); 
    } else if (this.wildPokemon && this.wildPokemon.model) {
        this.scene.remove(this.wildPokemon.model);
    }

    // VR: Pas de délai, fin immédiate (pas de "click to continue")
    const isVR = this.uiManager?.game?.renderer?.xr?.isPresenting;
    if (isVR) {
        // IMPORTANT: Appeler le callback de victoire s'il existe (pour le dresseur)
        if (this.onVictory) {
            this.onVictory();
        }
        this.endCombat(false); // false = pas fuite
    } else {
        setTimeout(() => {
          // IMPORTANT: Appeler le callback de victoire s'il existe (pour le dresseur)
          if (this.onVictory) {
              this.onVictory();
          }
          this.endCombat(false); // false = pas fuite
        }, 2000);
    }
  }

  defeat() {
    console.log("💀 Défaite...");
    this.combatState = "DEFEAT";

    // VR: Pas de délai, fin immédiate
    const isVR = this.uiManager?.game?.renderer?.xr?.isPresenting;
    if (isVR) {
        // Cooldown aussi en cas de défaite pour éviter le spam
        if (this.currentTrainer) {
            this.currentTrainer.battleCooldown = Date.now() + 5000;
            this.currentTrainer.isBattling = false; // Reset lock
        }
        this.endCombat(false);
    } else {
        setTimeout(() => {
          // Cooldown aussi en cas de défaite pour éviter le spam
          if (this.currentTrainer) {
              this.currentTrainer.battleCooldown = Date.now() + 5000;
              this.currentTrainer.isBattling = false; // Reset lock
          }
          this.endCombat(false);
        }, 2000);
    }
  }

  // FIX: Nouvelle méthode pour gérer le KO d'un Pokémon
  handlePlayerPokemonFainted() {
    console.log(`💀 ${this.getPokemonName(this.playerPokemon)} est K.O. !`);
    
    this.uiManager.showDialogue(`${this.getPokemonName(this.playerPokemon)} est K.O. !`);

    // Retirer le Pokémon actif de la scène
    if (this.playerPokemonEntity) {
      if (this.playerPokemonEntity.model) {
        this.scene.remove(this.playerPokemonEntity.model);
      }
      if (typeof this.playerPokemonEntity.dispose === 'function') {
        this.playerPokemonEntity.dispose();
      }
      this.playerPokemonEntity = null;
    }

    // Vérifier s'il reste des Pokémon disponibles (utiliser le helper HP)
    const team = this.uiManager?.playerData?.team || [];
    const availablePokemon = team.filter(
      (p) => this.getPokemonHp(p) > 0 && this.getPokemonName(p) !== this.getPokemonName(this.playerPokemon)
    );

    setTimeout(() => {
      if (availablePokemon.length === 0) {
        // Plus de Pokémon disponibles = défaite totale
        this.defeat();
      } else {
        // Afficher le menu de sélection obligatoire
        this.showForcedSwitchMenu(availablePokemon);
      }
    }, 1500);
  }

  // FIX: Menu de changement forcé (quand le Pokémon est KO)
  showForcedSwitchMenu(availablePokemon) {
    this.combatState = "SELECTING_POKEMON";

    // VR: Utiliser VRBattlePanel pour la sélection forcée
    const isVR = this.uiManager?.game?.renderer?.xr?.isPresenting;
    if (isVR && this.uiManager?.game?.vrManager?.vrBattlePanel) {
        console.log("🎮 VR: Affichage du menu de changement forcé (KO)");
        this.uiManager.game.vrManager.vrBattlePanel.combatMessage = "Pokémon K.O. ! Choisissez un remplaçant !";
        this.uiManager.game.vrManager.vrBattlePanel.showPokemonSelection((index) => {
            this.forcedSwitchPokemon(index);
        }, true); // true = isForced, pas de bouton ANNULER
        return;
    }

    // Masquer le menu de combat
    const combatMenu = document.getElementById("combat-menu");
    if (combatMenu) {
      combatMenu.style.display = "none";
    }

    // Créer le menu de sélection
    let selectionContainer = document.getElementById("pokemon-selection");
    if (!selectionContainer) {
      selectionContainer = document.createElement("div");
      selectionContainer.id = "pokemon-selection";
      document.body.appendChild(selectionContainer);
    }

    selectionContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      border: 4px solid #FF4444;
      border-radius: 20px;
      padding: 30px;
      z-index: 2000;
      font-family: 'Press Start 2P', monospace;
      color: white;
      min-width: 400px;
    `;

    let pokemonButtons = availablePokemon
      .map((pokemon) => {
        const currentHp = this.getPokemonHp(pokemon);
        const maxHp = this.getPokemonMaxHp(pokemon);
        const hpPercent = (currentHp / maxHp) * 100;
        
        let hpColor = "#4CAF50";
        if (hpPercent < 50) hpColor = "#FFC107";
        if (hpPercent < 25) hpColor = "#F44336";

        return `
        <button class="pokemon-select-btn" data-index="${this.uiManager?.playerData?.team?.indexOf(pokemon) ?? 0}" style="
          display: flex;
          align-items: center;
          gap: 15px;
          width: 100%;
          padding: 15px;
          margin: 10px 0;
          background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
          border: 2px solid #FFD700;
          border-radius: 10px;
          color: white;
          font-family: 'Press Start 2P', monospace;
          font-size: 12px;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        ">
          <div style="flex: 1; text-align: left;">
            <div style="margin-bottom: 8px;">${this.getPokemonName(pokemon)} (Niv. ${this.getPokemonLevel(pokemon)})</div>
            <div style="
              width: 100%;
              height: 8px;
              background: rgba(255,255,255,0.3);
              border-radius: 4px;
              overflow: hidden;
            ">
              <div style="width: ${hpPercent}%; height: 100%; background: ${hpColor};"></div>
            </div>
            <div style="font-size: 10px; margin-top: 5px;">HP: ${currentHp}/${maxHp}</div>
          </div>
        </button>
      `;
      })
      .join("");

    selectionContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 14px; color: #FF4444;">Choisissez un Pokémon !</div>
        <div style="font-size: 10px; color: #bdc3c7; margin-top: 5px;">(Obligatoire)</div>
      </div>
      ${pokemonButtons}
    `;

    // Event listeners
    selectionContainer.querySelectorAll(".pokemon-select-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.forcedSwitchPokemon(index);
      });
    });
  }

  // FIX: Changer de Pokémon après KO (ne coûte pas de tour)
  async forcedSwitchPokemon(index) {
    const newPokemon = this.uiManager.playerData.team[index];
    if (!newPokemon || this.getPokemonHp(newPokemon) <= 0) return;

    console.log(`🔄 ${this.getPokemonName(newPokemon)} entre en combat !`);

    // Fermer le menu
    const selectionContainer = document.getElementById("pokemon-selection");
    if (selectionContainer) selectionContainer.remove();

    // Mettre à jour les données
    this.playerPokemon = newPokemon;
    
    // Spawner le nouveau modèle
    const spawnPos = this.playerPokemonPosition.clone();
    const speciesId = newPokemon.speciesId || newPokemon.id;
    const baseData = this.pokemonManager.pokemonDatabase.find(p => p.id === speciesId);
    
    if (baseData) {
        this.playerPokemonEntity = await this.pokemonManager.spawnPokemon(spawnPos, {
            ...baseData,
            level: newPokemon.level
        }, true);
        
        this.playerPokemonEntity.hp = this.getPokemonHp(newPokemon);
        this.playerPokemonEntity.maxHp = this.getPokemonMaxHp(newPokemon);
        this.playerPokemonEntity.isPlayerPokemon = true;

        if (this.wildPokemon && this.wildPokemon.model) {
            this.playerPokemonEntity.model.lookAt(this.wildPokemon.model.position);
        }
    }

    // Mettre à jour l'UI
    this.uiManager.showDialogue(`À toi ${this.getPokemonName(newPokemon)} !`);
    this.updateCombatUI();
    
    // Le switch après KO ne coûte pas de tour, c'est au joueur de jouer
    this.combatState = "PLAYER_TURN";
    setTimeout(() => {
      this.showMainMenu();
    }, 1500);
  }

  // FIX: Afficher le menu de sélection de Pokémon
  showPokemonSelectionMenu(availablePokemon) {
    this.combatState = "SELECTING_POKEMON";

    // Masquer le menu de combat normal
    const combatMenu = document.getElementById("combat-menu");
    if (combatMenu) {
      combatMenu.style.display = "none";
    }

    // Créer le menu de sélection
    let selectionContainer = document.getElementById("pokemon-selection");
    if (!selectionContainer) {
      selectionContainer = document.createElement("div");
      selectionContainer.id = "pokemon-selection";
      document.body.appendChild(selectionContainer);
    }

    selectionContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      border: 4px solid #FFD700;
      border-radius: 20px;
      padding: 30px;
      z-index: 2000;
      font-family: 'Press Start 2P', monospace;
      color: white;
      min-width: 400px;
    `;

    let pokemonButtons = availablePokemon
      .map((pokemon, index) => {
        const hpPercent = (pokemon.hp / pokemon.maxHp) * 100;
        let hpColor = "#4CAF50";
        if (hpPercent < 50) hpColor = "#FFC107";
        if (hpPercent < 25) hpColor = "#F44336";

        return `
        <button class="pokemon-select-btn" data-index="${this.uiManager.playerData.team.indexOf(
          pokemon
        )}" style="
          display: flex;
          align-items: center;
          gap: 15px;
          width: 100%;
          padding: 15px;
          margin: 10px 0;
          background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
          border: 2px solid #FFD700;
          border-radius: 10px;
          color: white;
          font-family: 'Press Start 2P', monospace;
          font-size: 12px;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        ">
          <div style="
            width: 50px;
            height: 50px;
            background: #667eea;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
          ">🔴</div>
          <div style="flex: 1; text-align: left;">
            <div style="margin-bottom: 8px;">${pokemon.name} (Niv. ${
          pokemon.level
        })</div>
            <div style="
              width: 100%;
              height: 8px;
              background: rgba(255,255,255,0.3);
              border-radius: 4px;
              overflow: hidden;
            ">
              <div style="width: ${hpPercent}%; height: 100%; background: ${hpColor};"></div>
            </div>
            <div style="font-size: 10px; margin-top: 5px;">HP: ${pokemon.hp}/${
          pokemon.maxHp
        }</div>
          </div>
        </button>
      `;
      })
      .join("");

    selectionContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 16px; color: #FF6B6B; margin-bottom: 10px;">
          💀 ${this.playerPokemon.name} est K.O. !
        </div>
        <div style="font-size: 14px;">Choisissez un Pokémon :</div>
      </div>
      ${pokemonButtons}
    `;

    // Event listeners pour les boutons
    selectionContainer
      .querySelectorAll(".pokemon-select-btn")
      .forEach((btn) => {
        btn.addEventListener("mouseenter", () => {
          btn.style.transform = "scale(1.02)";
          btn.style.background =
            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.transform = "scale(1)";
          btn.style.background =
            "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)";
        });
        btn.addEventListener("click", (e) => {
          const index = parseInt(e.currentTarget.dataset.index);
          this.selectNewPokemon(index);
        });
      });
  }

  // FIX: Sélectionner et envoyer un nouveau Pokémon
  selectNewPokemon(index) {
    const newPokemon = this.uiManager.playerData.team[index];
    if (!newPokemon || newPokemon.hp <= 0) return;

    console.log(`🔄 ${newPokemon.name} entre en combat !`);

    // Retirer le menu de sélection
    const selectionContainer = document.getElementById("pokemon-selection");
    if (selectionContainer) {
      selectionContainer.remove();
    }

    // Mettre à jour le Pokémon actif
    this.playerPokemon = newPokemon;
    this.uiManager.markPokemonAsOut(index);
    this.uiManager.selectedPokemonIndex = index;

    // Faire apparaître le nouveau Pokémon
    this.spawnPlayerPokemon();

    // Réafficher le menu de combat
    const combatMenu = document.getElementById("combat-menu");
    if (combatMenu) {
      combatMenu.style.display = "grid";
    }

    // Mettre à jour l'UI
    this.updateCombatUI();

    // Tour de l'ennemi (le changement coûte un tour)
    setTimeout(() => {
      this.enemyTurn();
    }, 1000);
  }

  // FIX: Faire apparaître le Pokémon du joueur
  spawnPlayerPokemon() {
    // Importer dynamiquement ActivePokemon si nécessaire
    import("../entities/ActivePokemon.js").then(({ ActivePokemon }) => {
      // Position de spawn : à mi-chemin vers le Pokémon sauvage
      const spawnPos = this.playerPokemonPosition.clone();

      this.playerPokemonEntity = new ActivePokemon(
        this.scene,
        this.playerPokemon,
        spawnPos
      );
      this.playerPokemonEntity.inCombat = true;

      // Attendre que le modèle charge puis l'orienter
      const orientPokemon = () => {
        if (this.playerPokemonEntity && this.playerPokemonEntity.model) {
          const dirToWild = new THREE.Vector3()
            .subVectors(this.wildPokemonPosition, this.playerPokemonPosition)
            .normalize();
          const angle = Math.atan2(-dirToWild.x, -dirToWild.z);
          this.playerPokemonEntity.model.rotation.y = angle;
        } else {
          setTimeout(orientPokemon, 100);
        }
      };
      orientPokemon();
    });
  }

  endCombat(wasEscape = false) {
    this.isInCombat = false;

    // Réafficher le HUD
    if (this.uiManager && this.uiManager.modernHUD) {
        this.uiManager.modernHUD.showAfterCombat();
        // FIX: Forcer l'interaction utilisateur pour relancer le PointerLock
        setTimeout(() => this.uiManager.modernHUD.showResumeOverlay(), 100);
    }

    // FIX: Restaurer tous les objets cachés par l'occlusion
    this.restoreHiddenObjects();

    // Nettoyer la référence au Pokémon sauvage
    if (this.wildPokemon) {
      this.wildPokemon.inCombat = false;
      // ✅ FIX: Supprimer le modèle de la scène pour éviter la duplication
      if (this.wildPokemon.model) {
        // Suppression robuste: retirer du parent quel qu'il soit
        if(this.wildPokemon.model.parent) {
             this.wildPokemon.model.parent.remove(this.wildPokemon.model);
        } else {
             this.scene.remove(this.wildPokemon.model);
        }
      }
      // Nettoyage complet
      if(typeof this.wildPokemon.dispose === 'function') {
          this.wildPokemon.dispose();
      }
    }

    // Débloquer le Pokémon du joueur
    if (this.playerPokemonEntity) {
      this.playerPokemonEntity.inCombat = false;
    }

    // FIX: TOUJOURS restaurer la position originale du joueur
    this.camera.position.copy(this.originalPlayerPosition);
    this.camera.rotation.copy(this.originalPlayerRotation);

    console.log(
      `📍 Position joueur restaurée: (${this.originalPlayerPosition.x.toFixed(
        1
      )}, ${this.originalPlayerPosition.y.toFixed(
        1
      )}, ${this.originalPlayerPosition.z.toFixed(1)})`
    );

    // Retirer UI
    const combatUI = document.getElementById("combat-ui");
    if (combatUI) {
      combatUI.remove();
    }

    // FIX: Retirer aussi l'UI moderne (ModernCombatUI)
    const modernCombatUI = document.getElementById("modern-combat-ui");
    if (modernCombatUI) {
      if (typeof modernCombatUI.timeoutId !== 'undefined') clearTimeout(modernCombatUI.timeoutId);
      modernCombatUI.remove();
    }

    // VR: Cacher le VRBattlePanel
    if (this.uiManager?.game?.vrManager) {
        this.uiManager.game.vrManager.hideBattlePanel();
    }

    // FIX: Retirer les infos flottantes (HP bars)
    document.querySelectorAll('.combat-pokemon-info').forEach(el => el.remove());

    // Masquer le dialogue de combat
    if (this.uiManager) {
        this.uiManager.hideDialogue();
    }

    // Nettoyage spécifique de l'entité Pokemon du joueur
    if (this.playerPokemonEntity) {
        if (this.playerPokemonEntity.model && this.playerPokemonEntity.model.parent) {
            this.playerPokemonEntity.model.parent.remove(this.playerPokemonEntity.model);
        }
        if (typeof this.playerPokemonEntity.dispose === 'function') {
            this.playerPokemonEntity.dispose();
        }
        this.playerPokemonEntity = null;
    }

    // Reset état
    this.combatState = "IDLE";
    this.freeCameraMode = true;
    this.playerPokemon = null;
    this.wildPokemon = null;

    console.log("Combat terminé");

    if (this.onCombatEndCallback) {
      this.onCombatEndCallback();
    }

    // FIX: S'assurer que les inputs sont débloqués
    if (this.uiManager && this.uiManager.game && this.uiManager.game.inputManager) {
        console.log("🔓 Déblocage forcé des inputs post-combat");
        this.uiManager.game.inputManager.locked = false;
    }
  }



  handleEnemyFaint() {
      console.log(`💀 ${this.getPokemonName(this.wildPokemon)} est KO !`);
      
      if (this.uiManager) {
          this.uiManager.showDialogue(`${this.getPokemonName(this.wildPokemon)} est K.O. !`);
      }

      // Retirer le modèle ennemi de la scène
      if (this.wildPokemon && this.wildPokemon.model) {
          this.scene.remove(this.wildPokemon.model);
      }

      setTimeout(() => {
          // Si c'est un dresseur et qu'il lui reste des Pokémon
          if (this.currentTrainer && this.enemyTeam && this.enemyTeam.length > this.currentEnemyIndex + 1) {
              const nextIndex = this.currentEnemyIndex + 1;
              const nextPokemonData = this.enemyTeam[nextIndex];

              console.log(`🔄 Le dresseur va envoyer le Pokémon suivant (Index ${nextIndex})`);
              
              const nextPokemonName = nextPokemonData.nom || "Pokémon";
              
              // Afficher le prompt de changement
              this.showSwitchPrompt(nextPokemonName, nextIndex);

          } else {
              // Fin du combat (Victoire finale)
              this.victory();
          }
      }, 1500);
  }

  // Afficher le prompt "Voulez-vous changer de Pokémon ?"
  showSwitchPrompt(nextEnemyName, nextEnemyIndex) {
      // VR Hook - utiliser isPresenting au lieu de isVR
      const isVR = this.uiManager?.game?.renderer?.xr?.isPresenting;
      if (isVR && this.uiManager?.game?.vrManager?.vrBattlePanel) {
          this.uiManager.game.vrManager.vrBattlePanel.showSwitchPrompt(
              () => {
                   // OUI
                   const availablePokemon = this.uiManager.playerData.team.filter(
                      (p) => this.getPokemonHp(p) > 0 && this.getPokemonName(p) !== this.getPokemonName(this.playerPokemon)
                   );
                   if (availablePokemon.length > 0) {
                      this.showVoluntarySwitchForEnemyKO(availablePokemon, nextEnemyIndex);
                   } else {
                      this.switchEnemyPokemon(nextEnemyIndex);
                   }
              },
              () => {
                   // NON
                   this.switchEnemyPokemon(nextEnemyIndex);
              }
          );
          return;
      }

      // Masquer le menu de combat
      const combatMenu = document.getElementById("combat-menu");
      if (combatMenu) {
        combatMenu.style.display = "none";
      }

      // Créer le prompt
      let promptContainer = document.getElementById("switch-prompt");
      if (!promptContainer) {
        promptContainer = document.createElement("div");
        promptContainer.id = "switch-prompt";
        document.body.appendChild(promptContainer);
      }

      promptContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        border: 4px solid #FFD700;
        border-radius: 20px;
        padding: 30px;
        z-index: 2000;
        font-family: 'Press Start 2P', monospace;
        color: white;
        min-width: 400px;
        text-align: center;
      `;

      promptContainer.innerHTML = `
        <div style="font-size: 12px; margin-bottom: 20px;">
          ${this.currentTrainer?.nom || "Le dresseur"} va envoyer ${nextEnemyName}.<br><br>
          Voulez-vous changer de Pokémon ?
        </div>
        <div style="display: flex; gap: 20px; justify-content: center;">
          <button id="switch-yes" style="
            padding: 15px 30px;
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
            border: 2px solid #FFD700;
            border-radius: 10px;
            color: white;
            font-family: 'Press Start 2P', monospace;
            font-size: 12px;
            cursor: pointer;
          ">OUI</button>
          <button id="switch-no" style="
            padding: 15px 30px;
            background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);
            border: 2px solid #FFD700;
            border-radius: 10px;
            color: white;
            font-family: 'Press Start 2P', monospace;
            font-size: 12px;
            cursor: pointer;
          ">NON</button>
        </div>
      `;

      // Event listeners
      document.getElementById("switch-yes").addEventListener("click", () => {
        promptContainer.remove();
        // Afficher le menu de sélection
        const availablePokemon = this.uiManager.playerData.team.filter(
          (p) => this.getPokemonHp(p) > 0 && this.getPokemonName(p) !== this.getPokemonName(this.playerPokemon)
        );
        if (availablePokemon.length > 0) {
          this.showVoluntarySwitchForEnemyKO(availablePokemon, nextEnemyIndex);
        } else {
          // Pas d'autre Pokémon, on enchaîne
          this.switchEnemyPokemon(nextEnemyIndex);
        }
      });

      document.getElementById("switch-no").addEventListener("click", () => {
        promptContainer.remove();
        // Enchaîner directement
        this.switchEnemyPokemon(nextEnemyIndex);
      });
  }

  // Menu de switch volontaire après KO ennemi (ne coûte pas de tour)
  showVoluntarySwitchForEnemyKO(availablePokemon, nextEnemyIndex) {
    // VR Hook - utiliser isPresenting au lieu de isVR
    const isVR = this.uiManager?.game?.renderer?.xr?.isPresenting;
    if (isVR && this.uiManager?.game?.vrManager?.vrBattlePanel) {
         console.log("🎮 VR: Affichage du menu de changement après KO ennemi");
         this.uiManager.game.vrManager.vrBattlePanel.combatMessage = "Changer de Pokémon ?";
         this.uiManager.game.vrManager.vrBattlePanel.showPokemonSelection(
             (index) => {
                  this.doVoluntarySwitchThenEnemySwitches(index, nextEnemyIndex);
             }
         );
         return;
    }

    this.combatState = "SELECTING_POKEMON";

    let selectionContainer = document.getElementById("pokemon-selection");
    if (!selectionContainer) {
      selectionContainer = document.createElement("div");
      selectionContainer.id = "pokemon-selection";
      document.body.appendChild(selectionContainer);
    }

    selectionContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      border: 4px solid #FFD700;
      border-radius: 20px;
      padding: 30px;
      z-index: 2000;
      font-family: 'Press Start 2P', monospace;
      color: white;
      min-width: 400px;
    `;

    let pokemonButtons = availablePokemon
      .map((pokemon) => {
        const currentHp = this.getPokemonHp(pokemon);
        const maxHp = this.getPokemonMaxHp(pokemon);
        const hpPercent = (currentHp / maxHp) * 100;
        
        let hpColor = "#4CAF50";
        if (hpPercent < 50) hpColor = "#FFC107";
        if (hpPercent < 25) hpColor = "#F44336";

        return `
        <button class="pokemon-select-btn" data-index="${this.uiManager.playerData.team.indexOf(pokemon)}" style="
          display: flex;
          width: 100%;
          padding: 15px;
          margin: 10px 0;
          background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
          border: 2px solid #FFD700;
          border-radius: 10px;
          color: white;
          font-family: 'Press Start 2P', monospace;
          font-size: 12px;
          cursor: pointer;
        ">
          <div style="flex: 1; text-align: left;">
            <div style="margin-bottom: 8px;">${this.getPokemonName(pokemon)} (Niv. ${this.getPokemonLevel(pokemon)})</div>
            <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.3); border-radius: 4px; overflow: hidden;">
              <div style="width: ${hpPercent}%; height: 100%; background: ${hpColor};"></div>
            </div>
            <div style="font-size: 10px; margin-top: 5px;">HP: ${currentHp}/${maxHp}</div>
          </div>
        </button>
      `;
      })
      .join("");

    selectionContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 14px;">Choisissez un Pokémon :</div>
      </div>
      ${pokemonButtons}
    `;

    selectionContainer.querySelectorAll(".pokemon-select-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        selectionContainer.remove();
        await this.doVoluntarySwitchThenEnemySwitches(index, nextEnemyIndex);
      });
    });
  }

  async doVoluntarySwitchThenEnemySwitches(playerPokemonIndex, nextEnemyIndex) {
    const newPokemon = this.uiManager.playerData.team[playerPokemonIndex];
    if (!newPokemon || this.getPokemonHp(newPokemon) <= 0) {
      this.switchEnemyPokemon(nextEnemyIndex);
      return;
    }

    console.log(`🔄 ${this.getPokemonName(newPokemon)} entre en combat !`);

    // Retirer l'ancien modèle
    if (this.playerPokemonEntity && this.playerPokemonEntity.model) {
      this.scene.remove(this.playerPokemonEntity.model);
    }

    // Mettre à jour les données
    this.playerPokemon = newPokemon;
    
    // Spawner le nouveau modèle
    const spawnPos = this.playerPokemonPosition.clone();
    const speciesId = newPokemon.speciesId || newPokemon.id;
    const baseData = this.pokemonManager?.pokemonDatabase?.find(p => p.id === speciesId);
    
    if (baseData) {
        this.playerPokemonEntity = await this.pokemonManager.spawnPokemon(spawnPos, {
            ...baseData,
            level: newPokemon.level
        }, true);
        
        if (this.playerPokemonEntity) {
            this.playerPokemonEntity.hp = this.getPokemonHp(newPokemon);
            this.playerPokemonEntity.maxHp = this.getPokemonMaxHp(newPokemon);
            this.playerPokemonEntity.isPlayerPokemon = true;
        }
    }

    if (this.uiManager) {
        this.uiManager.showDialogue(`À toi ${this.getPokemonName(newPokemon)} !`);
    }
    this.updateCombatUI();

    // Maintenant faire entrer le Pokémon ennemi suivant
    setTimeout(() => {
      this.switchEnemyPokemon(nextEnemyIndex);
    }, 1500);
  }

  async switchEnemyPokemon(index) {
      // 1. Nettoyer l'ancien modèle
      if (this.wildPokemon.model) {
          // Animation de rappel ? (TODO)
          this.scene.remove(this.wildPokemon.model);
          // Si c'est une entité PokemonManager, on laisse le manager gérer ?
          // Ici on supprime juste visuellement pour l'instant
      }
      
      this.currentEnemyIndex = index;
      const nextRawData = this.enemyTeam[index];
      
      // FIX: Robustesse des données (supporte {pokemon: ID}, {id: ID} ou juste ID)
      let nextPokemonID, level;
      
      if (typeof nextRawData === 'object' && nextRawData !== null) {
          nextPokemonID = nextRawData.pokemon || nextRawData.id;
          level = nextRawData.niveau || nextRawData.level || 5;
      } else {
          // Cas où c'est juste un ID (ex: [4, 16])
          nextPokemonID = nextRawData;
          level = 5; // Niveau par défaut
      }

      console.log(`🔍 Chargement Enemy #${index}: RawData=`, nextRawData, "ID=", nextPokemonID);

      const baseData = this.pokemonManager.pokemonDatabase.find(p => p.id == nextPokemonID); // Loose equality pour string/int
      if (!baseData) {
          console.error("🚨 Impossible de charger le prochain Pokemon:", nextPokemonID);
          this.victory(); // Fallback
          return;
      }

      const nextPokemon = {
          ...baseData,
          level: level,
          uuid: `trainer_${this.currentTrainer.id}_p${index}`,
          stats: this.pokemonManager.calculateStats(baseData.stats, level),
      };
      // Init HP : ActivePokemon utilise la propriété .hp, pas seulement .stats.hp
      nextPokemon.stats.hp = nextPokemon.stats.hpMax;
      nextPokemon.hp = nextPokemon.stats.hpMax;
      nextPokemon.maxHp = nextPokemon.stats.hpMax;
      // nextPokemon.name est déjà défini par PokemonManager (alias de nom)

      console.log(`✨ Envoi de ${nextPokemon.name} Niv.${level}`);
      this.uiManager.showDialogue(`${this.currentTrainer.nom} envoie ${nextPokemon.name} !`);

      // 3. Spawner le modèle
      // On réutilise la position de l'ancien
      const spawnPos = this.wildPokemonPosition.clone();
      
      // Utiliser PokemonManager pour spawner proprement
      // isTrainerPokemon=true pour éviter qu'il se balade
      const newEntity = await this.pokemonManager.spawnPokemon(spawnPos, nextPokemon, true);
      
      if (newEntity) {
        newEntity.isTrainerPokemon = true;
        
        // Mettre à jour la référence
        this.wildPokemon = newEntity;
        
        // Orienter vers le joueur
        if (this.playerPokemonEntity && this.playerPokemonEntity.model) {
             newEntity.model.lookAt(this.playerPokemonEntity.model.position);
        } else {
             newEntity.model.lookAt(this.camera.position);
        }
        
        this.wildPokemonPosition = spawnPos;

        // Mettre à jour l'UI
        this.updateCombatUI();
        
        // VR: Forcer la mise à jour du VRBattlePanel avec le nouveau Pokemon
        if (this.uiManager?.game?.renderer?.xr?.isPresenting && this.uiManager?.game?.vrManager?.vrBattlePanel) {
            this.uiManager.game.vrManager.vrBattlePanel.updateCombatState({
                playerPokemon: this.playerPokemon,
                wildPokemon: newEntity,
                message: `${this.currentTrainer.nom} envoie ${nextPokemon.name} !`
            });
        }
        
        // Reprendre le tour du joueur
        this.combatState = "PLAYER_TURN";
        this.showMainMenu();
      } else {
          console.error("Echec du spawn du nouveau Pokémon adverse");
          this.victory();
      }
  }

  // FIX: Nouvelle méthode pour terminer le combat après capture
  endCombatByCapture() {
    console.log("🎊 Combat terminé par capture !");
    this.endCombat(false);
  }

  // FIX: Vérifier et masquer les objets qui bloquent la vue
  updateOcclusion() {
    // ⚠️ DISABLING OCCLUSION TEMPORARILY - CAUSING TRANSPARENCY ISSUES
    // Le système rendait tout transparent, on le désactive pour le moment
    return;
    
    // ==== CODE DÉSACTIVÉ ====
    /*
    if (!this.isInCombat || this.freeCameraMode) {
      this.restoreHiddenObjects();
      return;
    }

    const targetPoints = [
      this.playerPokemonPosition.clone().add(new THREE.Vector3(0, 0.5, 0)),
      this.wildPokemonPosition.clone().add(new THREE.Vector3(0, 0.5, 0)),
      new THREE.Vector3()
        .addVectors(this.playerPokemonPosition, this.wildPokemonPosition)
        .multiplyScalar(0.5)
        .add(new THREE.Vector3(0, 0.5, 0)),
    ];

    const cameraPos = this.camera.position.clone();
    const objectsToHide = new Set();

    for (const target of targetPoints) {
      const direction = new THREE.Vector3()
        .subVectors(target, cameraPos)
        .normalize();
      const distance = cameraPos.distanceTo(target);

      this.raycaster.set(cameraPos, direction);
      this.raycaster.far = distance;

      const intersects = this.raycaster.intersectObjects(
        this.scene.children,
        true
      );

      for (const intersect of intersects) {
        const obj = intersect.object;
        if (this.isPokemonMesh(obj)) continue;
        if (this.isGroundMesh(obj)) continue;
        if (obj.userData.isPortal) continue;
        objectsToHide.add(this.getRootObject(obj));
      }
    }

    for (let i = this.hiddenObjects.length - 1; i >= 0; i--) {
      const hiddenObj = this.hiddenObjects[i];
      if (!objectsToHide.has(hiddenObj.object)) {
        this.restoreObject(hiddenObj);
        this.hiddenObjects.splice(i, 1);
      }
    }

    for (const obj of objectsToHide) {
      if (!this.hiddenObjects.find((h) => h.object === obj)) {
        this.hideObject(obj);
      }
    }
    */
  }

  // FIX: Vérifier si c'est un mesh de Pokémon
  isPokemonMesh(obj) {
    let current = obj;
    while (current) {
      if (current.userData && current.userData.isPokemon) return true;
      if (
        this.playerPokemonEntity &&
        current === this.playerPokemonEntity.model
      )
        return true;
      current = current.parent;
    }
    return false;
  }

  // FIX: Vérifier si c'est le sol
  isGroundMesh(obj) {
    // Le sol est généralement un plan horizontal
    if (obj.geometry && obj.geometry.type === "PlaneGeometry") {
      return Math.abs(obj.rotation.x + Math.PI / 2) < 0.1;
    }
    return false;
  }

  // FIX: Récupérer l'objet racine (parent le plus haut)
  getRootObject(obj) {
    let current = obj;
    while (current.parent && current.parent !== this.scene) {
      current = current.parent;
    }
    return current;
  }

  // FIX: Masquer un objet (le rendre transparent)
  hideObject(obj) {
    const originalMaterials = new Map();

    obj.traverse((child) => {
      if (child.isMesh && child.material) {
        // Sauvegarder le matériau original
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        originalMaterials.set(
          child,
          materials.map((m) => ({
            transparent: m.transparent,
            opacity: m.opacity,
            depthWrite: m.depthWrite,
          }))
        );

        // Rendre transparent
        materials.forEach((m) => {
          m.transparent = true;
          m.opacity = 0.15;
          m.depthWrite = false;
          m.needsUpdate = true;
        });
      }
    });

    this.hiddenObjects.push({
      object: obj,
      originalMaterials: originalMaterials,
    });

    console.log(`👁️ Objet masqué: ${obj.name || obj.type}`);
  }

  // FIX: Restaurer un objet spécifique
  restoreObject(hiddenObj) {
    hiddenObj.object.traverse((child) => {
      if (
        child.isMesh &&
        child.material &&
        hiddenObj.originalMaterials.has(child)
      ) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const originals = hiddenObj.originalMaterials.get(child);

        materials.forEach((m, i) => {
          if (originals[i]) {
            m.transparent = originals[i].transparent;
            m.opacity = originals[i].opacity;
            m.depthWrite = originals[i].depthWrite;
            m.needsUpdate = true;
          }
        });
      }
    });

    console.log(
      `👁️ Objet restauré: ${hiddenObj.object.name || hiddenObj.object.type}`
    );
  }

  // FIX: Restaurer tous les objets cachés
  restoreHiddenObjects() {
    for (const hiddenObj of this.hiddenObjects) {
      this.restoreObject(hiddenObj);
    }
    this.hiddenObjects = [];
  }

  update(deltaTime) {
    // FIX: Mettre à jour l'occlusion en mode combat
    this.updateOcclusion();

    // FIX: Continuer à faire regarder les Pokémon entre eux pendant le combat
    if (
      this.isInCombat &&
      this.playerPokemonEntity &&
      this.playerPokemonEntity.model &&
      this.wildPokemon &&
      this.wildPokemon.model
    ) {
      // Pokémon joueur regarde le Pokémon sauvage
      this.playerPokemonEntity.model.lookAt(
          this.wildPokemon.model.position.x,
          this.playerPokemonEntity.model.position.y,
          this.wildPokemon.model.position.z
      );

      // Pokémon sauvage regarde le Pokémon joueur
      this.wildPokemon.model.lookAt(
          this.playerPokemonEntity.model.position.x,
          this.wildPokemon.model.position.y,
          this.playerPokemonEntity.model.position.z
      );
    }
  }

  // ============================================
  // ✅ HELPERS DATAS (Gestion des structures mixtes)
  // ============================================

  getPokemonName(pokemon) {
    return pokemon.surnom || pokemon.name || pokemon.species || "Unknown";
  }

  getPokemonHp(pokemon) {
    if (pokemon.stats && pokemon.stats.hp !== undefined) {
      return pokemon.stats.hp;
    }
    return pokemon.hp || 0;
  }

  getPokemonMaxHp(pokemon) {
    if (pokemon.stats && pokemon.stats.hpMax !== undefined) {
      return pokemon.stats.hpMax;
    }
    return pokemon.maxHp || pokemon.hp || 100;
  }

  setPokemonHp(pokemon, value) {
    if (pokemon.stats && pokemon.stats.hp !== undefined) {
      pokemon.stats.hp = value;
    } else {
      pokemon.hp = value;
    }
  }

  getPokemonLevel(pokemon) {
    if (pokemon.stats && pokemon.stats.level !== undefined) {
      return pokemon.stats.level;
    }
    return pokemon.level || 1;
  }



  showMainMenu(visible = true) {
    // VR: Réinitialiser le menu du VRBattlePanel
    if (this.uiManager?.game?.renderer?.xr?.isPresenting && this.uiManager?.game?.vrManager?.vrBattlePanel) {
        if (visible) {
            this.uiManager.game.vrManager.vrBattlePanel.setMenuState("MAIN");
            this.uiManager.game.vrManager.vrBattlePanel.combatMessage = "";
            this.uiManager.game.vrManager.vrBattlePanel.draw();
        }
        return;
    }

    const mainMenu = document.getElementById("main-menu-buttons");
    const attackMenu = document.getElementById("attack-menu-buttons");

    if (mainMenu && attackMenu) {
        if (!visible) {
            mainMenu.style.display = "none";
            attackMenu.style.display = "none";
        } else {
            mainMenu.style.display = "grid";
            attackMenu.style.display = "none";
            attackMenu.innerHTML = ""; // Nettoyer
        }
    }
  }

  showAttackMenu() {
    const mainMenu = document.getElementById("main-menu-buttons");
    const attackMenu = document.getElementById("attack-menu-buttons");
    
    if (mainMenu && attackMenu) {
        mainMenu.style.display = "none";
        // FIX: Force le Grid sur le container directement au lieu de 'contents'
        attackMenu.style.display = "grid";
        attackMenu.style.gridTemplateColumns = "1fr 1fr";
        attackMenu.style.gridColumn = "1 / -1"; // Prend toute la largeur
        attackMenu.style.gap = "10px";
        attackMenu.style.width = "100%";
        
        // Générer les boutons d'après les attaques du Pokémon
        const moves = this.playerPokemon.attaques || ["charge"];
        
        let html = "";
        moves.forEach(moveId => {
            if (!moveId) return; // Slot vide
            
            // Si moveId est un objet (legacy), on prend son nom normalisé
            const id = (typeof moveId === 'string') ? moveId : String(moveId).toLowerCase(); 
            
            const moveData = this.moveManager.getMove(id);
            if (!moveData) return;

            html += `
                <button class="combat-button" data-action="use_move" data-move-id="${id}">
                    ${moveData.nom} <br>
                    <span style="font-size: 10px; color: #ddd;">${moveData.categorie === "statut" ? "STATUT" : "Puis: " + moveData.puissance}</span>
                </button>
            `;
        });

        // Bouton Retour
        html += `<button class="combat-button" data-action="back" style="background: #e74c3c;">↩️ RETOUR</button>`;
        
        attackMenu.innerHTML = html;

        // Re-attacher les listeners
        attackMenu.querySelectorAll(".combat-button").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                // Remonter jusqu'au bouton pour avoir le dataset correct
                const button = e.target.closest("button");
                const action = button.dataset.action;
                
                // Hack pour passer le moveId
                if (action === "use_move") {
                    document.activeElement.dataset.moveId = button.dataset.moveId;
                }
                
                this.handleCombatAction(action);
            });
        });
    }
  }

  executePlayerMove(moveId) {
      if (this.isActionInProgress) return;
      
      const move = this.moveManager.getMove(moveId);
      if (!move) return;

      this.isActionInProgress = true;

      // Cacher le menu pendant l'attaque
      // this.showMainMenu(false);

      console.log(`Joueur utilise ${move.nom}`);
      this.uiManager.showNotification(`${this.getPokemonName(this.playerPokemon)} utilise ${move.nom} !`);

      // Calcul des dégâts
      if (move.categorie !== "statut") {
        const damageInfo = this.calculateDamage(this.playerPokemon, this.wildPokemon, move);
        
        // Appliquer les dégâts (Animation TODO)
        setTimeout(() => {
            this.applyDamage(this.wildPokemon, damageInfo.damage);
            
            if (damageInfo.effectiveness > 1) this.uiManager.showNotification("C'est super efficace !");
            if (damageInfo.effectiveness < 1 && damageInfo.effectiveness > 0) this.uiManager.showNotification("Ce n'est pas très efficace...");
            if (damageInfo.critical) this.uiManager.showNotification("Coup critique !");

            this.nextTurn();
            this.isActionInProgress = false;
        }, 1000);
      } else {
        // Logique Statut (TODO)
        setTimeout(() => {
            this.uiManager.showNotification("Mais cela échoue ! (Statut non implémenté)");
            this.nextTurn();
            this.isActionInProgress = false;
        }, 1000);
      }
  }

  applyDamage(target, amount) {
      // FIX: Utiliser le helper pour modifier les HP (gère .stats.hp vs .hp)
      const currentHp = this.getPokemonHp(target);
      const newHp = Math.max(0, currentHp - amount);
      this.setPokemonHp(target, newHp);
      
      // Si c'est le joueur, on met à jour l'équipe dans l'UI Manager
      if (target === this.playerPokemon && this.uiManager) {
        const teamPokemon = this.uiManager.playerData.team.find(p => p.uniqueId === target.uniqueId) || 
                            this.uiManager.playerData.team.find(p => p.name === target.name);
        if (teamPokemon) {
            teamPokemon.hp = newHp;
        }
      }

      this.updateCombatUI(); // Mettre à jour les barres de vie
  }

  updateCombatUI() {
      // FIX: VR Update
      if (this.uiManager && this.uiManager.game && this.uiManager.game.renderer.xr.isPresenting) {
            this.uiManager.game.vrManager.updateBattlePanel({
                playerPokemon: this.playerPokemon,
                wildPokemon: this.wildPokemon
                // message updated separately via showMessage if needed
            });
            return;
      }

      // Re-rend le UI complet (un peu bourrin mais sûr)
      this.showCombatUI();
  }

  calculateDamage(attacker, defender, move) {
      // Formule Gen 1
      // ((2 * Level / 5 + 2) * Power * A / D) / 50 + 2
      
      const level = attacker.level || 5;
      const power = move.puissance || 40;
      
      // Choix stats (Physique vs Spécial)
      let A, D;
      if (move.categorie === "physique") {
          A = attacker.stats?.attack || 10;
          D = defender.stats?.defense || 10;
      } else {
          A = attacker.stats?.special || 10;
          D = defender.stats?.special || 10;
      }

      // 1. Coup Critique (Base Vitesse / 512)
      const isCritical = Math.random() < ((attacker.stats?.speed || 50) / 512);
      const critMultiplier = isCritical ? 2 : 1;
      
      // 2. Random (0.85 à 1.0)
      const random = 0.85 + Math.random() * 0.15;

      // 3. STAB (Same Type Attack Bonus)
      // On assume que le Pokémon a ses types dans .types (array)
      // Si on ne les a pas, on suppose Normal
      const attackerTypes = attacker.types || ["normal"]; 
      // Le type du move est maintenant disponible !
      const moveType = move.type || "normal";
      
      const isSTAB = attackerTypes.includes(moveType);
      const stabMultiplier = isSTAB ? 1.5 : 1;

      // 4. Type Effectiveness
      // On assume que defender.types existe (ex: ["plante", "poison"])
      // Il faut récupérer le type du Pokémon défenseur
      const defenderTypes = defender.types || ["normal"];
      
      const typeMultiplier = this.typeManager.getEffectiveness(moveType, defenderTypes);

      let damage = (((2 * level / 5 + 2) * power * A / D) / 50) + 2;
      damage = damage * critMultiplier * random * stabMultiplier * typeMultiplier;

      return {
          damage: Math.floor(damage),
          critical: isCritical,
          effectiveness: typeMultiplier
      };
  }
  nextTurn() {
    // Vérifier si combat terminé
    if (this.getPokemonHp(this.wildPokemon) <= 0) {
      this.handleEnemyFaint();
      return;
    }
    if (this.getPokemonHp(this.playerPokemon) <= 0) {
      this.handlePlayerPokemonFainted(); // Utiliser la méthode dédiée pour gérer le switch
      return;
    }

    if (this.combatState === "PLAYER_TURN") {
      this.combatState = "OPPONENT_TURN";
      if (this.uiManager) {
        this.uiManager.showNotification(`À l'ennemi !`);
      }
      
      setTimeout(() => {
        this.enemyTurn();
      }, 1500);
    } else {
      this.combatState = "PLAYER_TURN";
      if (this.uiManager) {
        this.uiManager.showNotification(`À vous !`);
      }
      this.showMainMenu();
    }
  }
}
