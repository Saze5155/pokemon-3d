import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { CombatManager } from "./combat/CombatManager.js";
import { ItemManager } from "./combat/ItemManager.js";
import { MoveManager } from "./combat/MoveManager.js";
import { PokeballPhysics } from "./combat/PokeballPhysics.js";
import { TypeManager } from "./combat/TypeManager.js";
import { AudioManager } from "./core/AudioManager.js";
import { InputManager } from "./core/InputManager.js";
import { OptimizationManager } from "./core/OptimizationManager.js";
import { SaveManager } from "./core/SaveManager.js";
import { SceneManager } from "./core/SceneManager.js";
import { VRManager } from "./core/VRManager.js";
import { WeatherManager } from "./core/WeatherManager.js";
import { WorldManager } from "./core/WorldManager.js";
import { XPManager } from "./core/XPManager.js";
import { NPCManager } from "./entities/NPCManager.js";
import { PokemonManager } from "./entities/PokemonManager.js";
import { ModernDialogueSystem } from "./ui/ModernDialogueSystem.js";
import { hookCombatUI, initModernUI } from "./ui/ModernUIInit.js";
import { UIManager } from "./ui/UI.js";
import { Portal } from "./world/Portal.js";

function fixAllMaterials(scene, name = "scene") {
  let fixed = 0;
  scene.traverse((obj) => {
    if (obj.isMesh && obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        const props = [
          "map",
          "normalMap",
          "bumpMap",
          "specularMap",
          "emissiveMap",
          "alphaMap",
          "aoMap",
          "lightMap",
          "envMap",
          "displacementMap",
          "roughnessMap",
          "metalnessMap",
        ];
        let changed = false;
        props.forEach((prop) => {
          if (mat.hasOwnProperty(prop) && mat[prop] === null) {
            delete mat[prop];
            changed = true;
          }
        });
        if (changed) {
          mat.needsUpdate = true;
          fixed++;
        }
      });
    }
  });
  if (fixed > 0) console.log(`ðŸ”§ ${name}: ${fixed} matÃ©riaux rÃ©parÃ©s`);
}

function cleanMaterial(material) {
  if (!material) return;

  const textureProps = [
    "map",
    "normalMap",
    "bumpMap",
    "specularMap",
    "emissiveMap",
    "alphaMap",
    "aoMap",
    "lightMap",
    "envMap",
    "displacementMap",
    "roughnessMap",
    "metalnessMap",
  ];

  textureProps.forEach((prop) => {
    if (material[prop] === null) {
      delete material[prop];
    }
  });

  material.needsUpdate = true;
}

function cleanAllScenes(sceneManager, worldManager) {
  console.log("ðŸ”§ Nettoyage global des matÃ©riaux...");
  let totalCleaned = 0;

  // Nettoyer les scÃ¨nes classiques
  if (sceneManager && sceneManager.scenes) {
    for (const [name, scene] of sceneManager.scenes) {
      scene.traverse((child) => {
        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          materials.forEach((mat) => {
            cleanMaterial(mat);
            totalCleaned++;
          });
        }
      });
    }
  }

  // Nettoyer la worldmap
  if (worldManager && worldManager.worldScene) {
    worldManager.worldScene.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((mat) => {
          cleanMaterial(mat);
          totalCleaned++;
        });
      }
    });
  }

  console.log(`âœ… ${totalCleaned} matÃ©riaux nettoyÃ©s`);
}

/**
 * PokemonGame - Classe principale du jeu
 * Orchestre tous les systÃ¨mes via les managers
 */
class PokemonGame {
  constructor() {
    // Clock pour le delta time
    this.clock = new THREE.Clock();

    // Tracking des portails
    this.lastPlayerSide = {};

    // Timer de jeu (incrémenté chaque seconde)
    this.gameTimer = 0;
    this.lastTimerUpdate = Date.now();

    // Initialisation des systÃ¨mes de base
    this.initRenderer();
    this.initCamera();

    this.optimizationManager = new OptimizationManager(
      this.renderer,
      this.camera
    );

    // Stats debug
    this.showDebug = false;
    this.debugPanel = this.createDebugPanel();

    // Toggle avec F3
    window.addEventListener("keydown", (e) => {
      if (e.code === "F3") {
        this.showDebug = !this.showDebug;
        this.debugPanel.style.display = this.showDebug ? "block" : "none";
      }
      
      // Cheat: 'L' pour Level Up
      if (e.key.toLowerCase() === "l") {
         if (this.combatManager && this.combatManager.isInCombat) {
             const result = this.xpManager.gainXP(this.combatManager.playerPokemon, { xpBase: 100, level: this.combatManager.playerPokemon.level });
             this.ui.showNotification(`Cheat XP: +${result.xpGained}`);
             
             if (result.leveledUp) {
                 this.ui.showNotification(`Niveau ${result.newLevel} !`, "success");
                 this.combatManager.updateCombatUI();
             }
         } else if (this.saveManager && this.saveManager.myPokemon && this.saveManager.myPokemon.length > 0) {
             // Hors combat
             const firstPokemon = this.saveManager.myPokemon[0];
             const result = this.xpManager.gainXP(firstPokemon, { xpBase: 100, level: firstPokemon.level }); 
             this.ui.showNotification(`Cheat: ${firstPokemon.nom} +${result.xpGained} XP`);
         }
      }
      // Cheat: 'T' pour Test Mode (Objets + Statut)
      if (e.key.toLowerCase() === "t") {
          console.log("🧪 ACTIVATION MODE TEST");
          
          // 1. Ajouter des objets
          if (this.ui.playerData && !this.ui.playerData.inventory) {
              this.ui.playerData.inventory = {};
          }
          const inv = this.ui.playerData.inventory;
          inv['potion'] = (inv['potion'] || 0) + 5;
          inv['super_potion'] = (inv['super_potion'] || 0) + 2;
          inv['antidote'] = (inv['antidote'] || 0) + 3;
          inv['attaque_plus'] = (inv['attaque_plus'] || 0) + 2;
          inv['total_soin'] = (inv['total_soin'] || 0) + 1;
          
          this.ui.showNotification("TEST: Objets ajoutés ! (Potion, Antidote, etc.)", "success");

          // 2. Si en combat, infliger poison au joueur
          if (this.combatManager && this.combatManager.isInCombat) {
              const pkm = this.combatManager.playerPokemon;
              if (pkm && this.combatManager.statusManager) {
                  this.combatManager.statusManager.applyStatus(pkm, this.combatManager.statusManager.STATUS.POISON);
                  this.combatManager.updateCombatUI();
                  this.ui.showNotification("TEST: Votre Pokémon est empoisonné !", "warning");
              }
          }
      }
    });

    // Managers
    this.sceneManager = new SceneManager(this.renderer);
    this.worldManager = new WorldManager(this.sceneManager);
    this.inputManager = new InputManager(this.camera, this.renderer.domElement);
    this.ui = new UIManager();
    this.ui.game = this; // Permettre l'accès au jeu depuis l'UI
    this.saveManager = new SaveManager();
    this.typeManager = new TypeManager();
    this.moveManager = new MoveManager();
    this.itemManager = new ItemManager(this);
    this.xpManager = new XPManager(this.ui);
    this.xpManager = new XPManager(this.ui);
    this.audioManager = new AudioManager();
    this.weatherManager = new WeatherManager(this);

    // Gestionnaire VR
    this.vrManager = new VRManager(this);
    document.body.appendChild(VRButton.createButton(this.renderer));
    this.vrManager.init();



    this.ui.setSaveManager(this.saveManager);

    this.ui.onSaveGame = async () => {
      // Récupérer la position actuelle du joueur
      // FIX VR: En mode VR, utiliser la position mondiale de la caméra
      let posX, posY, posZ;
      if (this.useVR && this.vrManager && this.camera) {
        const worldPos = new THREE.Vector3();
        this.camera.getWorldPosition(worldPos);
        posX = worldPos.x;
        posY = worldPos.y;
        posZ = worldPos.z;
        console.log(`💾 VR Save: World position (${posX.toFixed(2)}, ${posY.toFixed(2)}, ${posZ.toFixed(2)})`);
      } else {
        posX = this.camera.position.x;
        posY = this.camera.position.y;
        posZ = this.camera.position.z;
      }

      const playerPosition = {
        map: this.sceneManager.activeSceneName,
        x: posX,
        y: posY,
        z: posZ,
        direction: "south", // TODO: calculer la direction réelle
      };

      return await this.saveManager.save(playerPosition);
    };

    // NE PAS charger le jeu immédiatement !
    // Afficher d'abord l'écran de sélection de sauvegarde
    // this.showTitleScreen();

    // Mode de jeu (worldmap ou classique)
    this.useWorldMap = false;

    // Systèmes de jeu (initialisés après chargement des scènes)
    this.pokemonManager = null;
    this.pokeballPhysics = null;
    this.combatManager = null;
    this.npcManager = null;
    this.dialogueSystem = null;
    this.lastInteriorScene = null;
    this.isJumping = false;
    this.jumpStartY = 0;
    this.jumpTargetY = 0;
    this.jumpProgress = 0;

    // Configuration des managers
    this.setupManagers();

    // Afficher l'écran titre (sélection de sauvegarde)
    // Le chargement du monde se fera APRES la sélection
    this.showTitleScreen();

    // Gestion du resize
    this.setupResize();

    // Démarrer la boucle de jeu
    this.animate();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.6, 5);
  }

  createDebugPanel() {
    const panel = document.createElement("div");
    panel.id = "debug-panel";
    panel.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0,0,0,0.8);
    color: #0f0;
    font-family: monospace;
    font-size: 12px;
    padding: 10px;
    z-index: 10000;
    pointer-events: none;
    display: none;
    min-width: 300px;
  `;
    document.body.appendChild(panel);
    return panel;
  }

  // ==============================================================
  // Affiche l'écran des commandes pour les nouveaux joueurs
  // ==============================================================
  
  showControlsOverlay(onComplete) {
      const overlay = document.getElementById("controls-overlay");
      if (!overlay) {
          console.warn("Controls overlay not found");
          if (onComplete) onComplete();
          return;
      }

      overlay.style.display = "flex";

      const okBtn = document.getElementById("controls-ok-btn");
      if (okBtn) {
          const handler = () => {
              overlay.style.display = "none";
              okBtn.removeEventListener("click", handler);
              if (onComplete) onComplete();
          };
          okBtn.addEventListener("click", handler);
      }
  }

  // ==============================================================
  // NOUVELLE MÉTHODE: showTitleScreen()
  // ==============================================================

  async showTitleScreen() {
    // Initialiser le SaveManager (charger les sauvegardes existantes)
    await this.saveManager.init();

    // Récupérer les infos des 3 slots
    const slots = this.saveManager.getSlotsInfo();

    // Cacher l'écran de chargement initial (s'il est là)
    // Mais on veut d'abord afficher la sélection
    const titleScreen = document.getElementById("title-screen");
    if (titleScreen) {
         // Petite transition
         titleScreen.style.opacity = "0";
         setTimeout(() => {
             if (this.ui.isSaveMenuOpen()) {
                titleScreen.style.display = "none";
                titleScreen.style.opacity = "1"; // Reset pour la prochaine fois
             }
         }, 500);
    }

    // Afficher l'écran de sélection
    this.ui.showSaveSelection(slots, async (result) => {
      await this.handleSaveSelection(result);
    });

    // Note: La musique sera lancée après le clic utilisateur (voir startBtn.addEventListener)
  }

  // ==============================================================
  // NOUVELLE MÉTHODE: handleSaveSelection()
  // ==============================================================

  async handleSaveSelection(result) {
    switch (result.action) {
      case "new":
        // Créer nouvelle partie
        this.saveManager.createNewGame(result.slot, result.playerName);
        await this.saveManager.save();
        
        // Afficher l'écran des commandes pour les nouveaux joueurs
        this.showControlsOverlay(() => {
            this.startGame();
        });
        break;

      case "load":
        // Charger partie existante
        this.saveManager.loadGame(result.slot);
        this.startGame();
        break;

      case "delete":
        // Supprimer et rafraîchir l'écran
        await this.saveManager.deleteGame(result.slot);
        const slots = this.saveManager.getSlotsInfo();
        this.ui.refreshSaveSelection(slots);
        break;
    }
  }

  // ==============================================================
  // NOUVELLE MÉTHODE: startGame()
  // ==============================================================

  startGame() {
    // Réafficher l'écran de chargement
    const titleScreen = document.getElementById("title-screen");
    const loadingMsg = document.getElementById("loading-msg");
    const startBtn = document.getElementById("start-btn");

    if (titleScreen && loadingMsg) {
        titleScreen.style.display = "flex";
        loadingMsg.style.display = "block";
        if (startBtn) startBtn.style.display = "none";
    }

    // Initialiser le timer de jeu depuis la sauvegarde
    if (this.saveManager.saveData?.joueur?.tempsJeu) {
      this.gameTimer = this.saveManager.saveData.joueur.tempsJeu;
      this.lastTimerUpdate = Date.now();
    }

    // Synchroniser l'UI avec les données de sauvegarde
    this.ui.syncFromSaveManager();
    
    // FIX: S'assurer que le joueur a des objets de départ
    if (!this.saveManager.saveData.joueur.inventory) {
        this.saveManager.saveData.joueur.inventory = {};
    }
    const inv = this.saveManager.saveData.joueur.inventory;
    if (Object.keys(inv).length === 0) {
        console.log("🎒 Inventaire vide détecté : Ajout du kit de départ !");
        inv['potion'] = 5;
        inv['super_potion'] = 2;
        inv['antidote'] = 3;
        inv['parl_healer'] = 3; // Anti-Para
        inv['pokeball'] = 10;
        this.saveManager.save(); // Sauvegarder immédiatement
        this.ui.showNotification("Kit de départ reçu (Potions, Balls, etc.) !");
    }

    this.syncNPCFlagsFromSave();

    // Initialiser l'UI moderne (tutoriels, dialogue moderne, HUD)
    initModernUI(this);

    // Charger les scènes et démarrer le jeu

    // FIX: Détection proactive du mode WorldMap
    // Si la sauvegarde indique une zone seamless, on active le mode AVANT de charger
    const savedMap = this.saveManager.saveData?.joueur?.position?.map;
    const seamlessMaps = ["world", "argenta", "route1", "bourg-palette", "route2", "jadeto2", "foret-jade"];
    
    if (savedMap && seamlessMaps.includes(savedMap)) {
         console.log(`🌍 Sauvegarde détectée dans une zone Seamless (${savedMap}) -> Activation WorldMap`);
         this.useWorldMap = true;
    }

    // FIX: Configurer les callbacks AVANT le chargement pour ne rien rater
    this.worldManager.onPortalsLoaded = (newPortals) => {
        this.createPortalsForZone(newPortals);
    };

    this.worldManager.onZoneChange = (newZone, oldZone) => {
        console.log(`[Main] Changement de zone détecté: ${oldZone} -> ${newZone}`);
        this.audioManager.playMusic(newZone);
        this.sceneManager.activeSceneName = newZone;
    };

    this.loadGameWithWorldMap();

    // Positionner le joueur selon la sauvegarde
    const pos = this.saveManager.saveData?.joueur?.position;
    if (pos) {
      // Marquer la position de départ pour le chargement
      this.startPosition = pos;
    }

    // TENTER D'AFFICHER LE TUTORIEL DE BIENVENUE
    setTimeout(() => {
        if (this.ui && this.ui.tutorialSystem) {
             this.ui.tutorialSystem.showIfNotSeen('welcome');
        }
    }, 2000); // Petit délai pour laisser le monde charger
  }
  syncNPCFlagsFromSave() {
    if (!this.npcManager || !this.saveManager) return;

    const flags = this.saveManager.getFlags();
    if (flags) {
      for (const [flag, value] of Object.entries(flags)) {
        if (value) {
          this.npcManager.addStoryFlag(flag);
        }
      }

      // ✅ FIX: Restaurer la variable {POKEMON} pour les dialogues (Prof Chen)
      // Sinon ça affiche "Carapuce" ou vide par défaut si on recharge la page
      if (flags.starter_choisi && this.dialogueSystem) {
           const team = this.saveManager.getTeam();
           // Le starter est généralement le premier Pokémon (slot 0)
           if (team && team.length > 0 && team[0] !== null) {
               const uniqueId = team[0];
               // saveManager.myPokemon stores actual objects
               const pkm = this.saveManager.myPokemon[this.saveManager.currentSlot ? `sauvegarde_${this.saveManager.currentSlot}` : Object.keys(this.saveManager.myPokemon)[0]]?.[uniqueId] 
                           || (this.saveManager.myPokemon[uniqueId]); // Fallback access

               // Access via saveManager helper is cleaner
               const pokemonObj = this.saveManager.getPokemon(uniqueId);
               
               if (pokemonObj) {
                   const name = pokemonObj.surnom || pokemonObj.name || pokemonObj.species;
                   
                   // Legacy System
                   this.dialogueSystem.setVariable("POKEMON", name);
                   
                   // Modern System
                   if (this.game?.modernDialogue) {
                        this.game.modernDialogue.setVariable("POKEMON", name);
                   } else if (this.modernDialogue) { 
                        this.modernDialogue.setVariable("POKEMON", name);
                   }

                   console.log(`[Main] Variable dialogue restaurée: {POKEMON} = ${name}`);
               }
           }
      }
    }

    // Synchroniser les dresseurs vaincus
    const defeatedTrainers = this.saveManager.getDefeatedTrainers();
    if (defeatedTrainers && defeatedTrainers.length > 0) {
      console.log(`[Main] Syncing ${defeatedTrainers.length} defeated trainers from save`);
      for (const trainerId of defeatedTrainers) {
        this.npcManager.defeatTrainer(trainerId);
      }
    }
  }
  setupManagers() {
    // Condition pour le lock (pas de lock si menu ouvert)
    this.inputManager.setCanLockCondition(() => !this.ui.isMenuOpen());

    // Callback changement de scène (musique)
    // NOTE: Le callback pour la WorldMap sera ajouté plus tard dans setupWorldMapTransition
    this.sceneManager.onSceneChange = (sceneName) => {
        // Mettre à jour la musique si nécessaire
        this.audioManager.playMusic(sceneName);
    };

    // Configuration des options
    this.setupSettings();
  }

  setupSettings() {
    // Gestion du volume de la musique
    const musicVolumeSlider = document.getElementById('music-volume');
    if (musicVolumeSlider) {
      musicVolumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        this.audioManager.volume = volume;
        if (this.audioManager.currentMusic) {
          this.audioManager.currentMusic.volume = volume;
        }
      });
    }

    // Gestion de la sensibilité de la souris
    const sensitivitySlider = document.getElementById('mouse-sensitivity');
    if (sensitivitySlider) {
      sensitivitySlider.addEventListener('input', (e) => {
        const sensitivity = e.target.value;
        // Plage: 1-20, avec multiplicateur 0.05 = sensibilité de 0.05 à 1.0
        this.inputManager.mouseSensitivity = sensitivity * 0.05;
        this.inputManager.controls.pointerSpeed = sensitivity * 0.05;
      });
    }
  }

  async loadGame() {
    // RÃƒÂ©cupÃƒÂ©rer la liste des scÃƒÂ¨nes depuis le serveur
    const scenesResponse = await fetch("/list-scenes");
    const scenesData = await scenesResponse.json();

    // Charger chaque scÃƒÂ¨ne
    for (const sceneName of scenesData.scenes) {
      // Charger les donnÃƒÂ©es de la scÃƒÂ¨ne
      const response = await fetch(
        `/load-scene/${sceneName}`
      );
      const data = await response.json();

      // CrÃƒÂ©er la scÃƒÂ¨ne avec la bonne config
      this.sceneManager.createScene(sceneName, {
        background: data.isInterior ? 0xf5deb3 : 0x87ceeb,
        fog: data.isInterior ? null : { color: 0x87ceeb, near: 50, far: 200 },
        isInterior: data.isInterior || false,
      });

      // Charger les donnÃƒÂ©es
      await this.sceneManager.loadSceneFromServer(
        sceneName,
        `/load-scene/${sceneName}`
      );
    }

    // CrÃƒÂ©er les portails aprÃƒÂ¨s chargement
    setTimeout(async () => {
      this.sceneManager.createPortals();
      await this.initGameSystems();
    }, 2000);
  }

  async loadGameWithWorldMap() {
    // 1. Initialiser le NPCManager et charger la base PNJ AVANT de charger les scènes
    if (!this.npcManager) {
        // ✅ PASSAGE DU WORLDMANAGER
        this.npcManager = new NPCManager(this.sceneManager, null, this.worldManager);
        this.sceneManager.npcManager = this.npcManager; // ✅ FIX: Lien pour le WorldManager
        await this.npcManager.loadPNJDatabase();
    }

    // Charger la worldmap en arrière-plan (pour les zones extérieures)
    const hasWorldMap = await this.worldManager.loadWorldMap();

    // ✅ FIX CRITIQUE: Initialiser le container WorldScene TOUT DE SUITE
    // Le NPCManager en a besoin pour placer les PNJ des zones dans le monde
    if (hasWorldMap) {
        // On initialise sans zone de départ spécifique pour l'instant
        await this.worldManager.initWorld();
        console.log("🌍 WorldScene initialisée prématurément pour le NPCManager");
        
        // Initialiser la météo pour le monde extérieur
        this.weatherManager.init(this.worldManager.worldScene, this.camera);
    }

    // Toujours charger les scènes en mode classique d'abord
    const scenesResponse = await fetch("/list-scenes");
    const scenesData = await scenesResponse.json();
    console.log("📂 Scènes disponibles sur le serveur:", scenesData.scenes);

    // Charger chaque scÃ¨ne
    for (const sceneName of scenesData.scenes) {
      const response = await fetch(
        `/load-scene/${sceneName}`
      );
      const data = await response.json();

      this.sceneManager.createScene(sceneName, {
        background: data.isInterior ? 0xf5deb3 : 0x87ceeb,
        fog: data.isInterior ? null : { color: 0x87ceeb, near: 50, far: 200 },
        isInterior: data.isInterior || false,
      });

      await this.sceneManager.loadSceneFromServer(
        sceneName,
        `/load-scene/${sceneName}`
      );
    }

    // Démarrer selon la sauvegarde ou position par défaut
    let startScene = "maisonetage";
    let startX = 5, startY = 1.8, startZ = 5;

    // Si une position de départ est définie dans la sauvegarde
    if (this.startPosition) {
      startScene = this.startPosition.map || startScene;
      startX = this.startPosition.x || startX;
      startY = this.startPosition.y || startY;
      startZ = this.startPosition.z || startZ;
    }

    console.log(`🎬 Scène de départ demandée: "${startScene}"`);
    
    // FIX: Gestion intelligente du mode WorldMap
    // Si la scène demandée (ex: "argenta") fait partie de la WorldMap, on force le mode "world"
    const targetZone = this.worldManager.zones.find(z => z.scene === startScene);
    
    // FIX: Cas spécial "world" - Le joueur a sauvé dans le monde seamless
    if (startScene === "world" || targetZone) {
         console.log(`🌍 Mode WorldMap activé (startScene: ${startScene})`);
         this.sceneManager.activeSceneName = "world";
         this.useWorldMap = true; // Activer le flag

         // Correction auto des coordonnées (Local -> Global)
         // SEULEMENT si on a une targetZone (pas si startScene === "world")
         if (targetZone) {
             const distToOrigin = Math.sqrt(startX*startX + startZ*startZ);

             // Si on est proche de l'origine locale (0,0) mais que la zone est loin -> Save locale
             if (distToOrigin < 200 && Math.abs(targetZone.worldZ) > 200) {
                 console.log("⚠️ Détection save Locale : Conversion en Global Coordinates");
                 startX += targetZone.worldX;
                 startZ += targetZone.worldZ;
             }
             this.audioManager.playMusic(startScene); // Musique de la zone
         } else {
             // startScene === "world" : les coordonnées sont déjà globales
             console.log("🌍 Coordonnées globales utilisées directement");
         }

         // FIX VR: En mode VR, la position doit être appliquée au playerRig, pas à la caméra
         if (this.useVR && this.vrManager && this.vrManager.playerRig) {
           // En VR, startY est la hauteur des yeux (desktop), mais le rig doit être au sol
           const rigY = Math.max(0, startY - 1.6);
           this.vrManager.playerRig.position.set(startX, rigY, startZ);
           console.log(`📍 VR: PlayerRig positioned at (${startX.toFixed(2)}, ${rigY.toFixed(2)}, ${startZ.toFixed(2)})`);
         } else {
           this.camera.position.set(startX, startY, startZ);
         }

    } else if (this.sceneManager.scenes.has(startScene)) {
      // Fallback: Mode Classique (Intérieur, etc.)
      this.sceneManager.activeSceneName = startScene;
      this.audioManager.playMusic(startScene);
      // FIX VR: En mode VR, appliquer la position au playerRig
      if (this.useVR && this.vrManager && this.vrManager.playerRig) {
        const rigY = Math.max(0, startY - 1.6);
        this.vrManager.playerRig.position.set(startX, rigY, startZ);
        console.log(`📍 VR Interior: PlayerRig positioned at (${startX.toFixed(2)}, ${rigY.toFixed(2)}, ${startZ.toFixed(2)})`);
      } else {
        this.camera.position.set(startX, startY, startZ);
      }
    } else {
       console.warn(`⚠️ Scène "${startScene}" introuvable. Fallback sur maisonetage.`);
       if (this.sceneManager.scenes.has("maisonetage")) {
           this.sceneManager.activeSceneName = "maisonetage";
           // FIX VR: En mode VR, appliquer la position au playerRig
           if (this.useVR && this.vrManager && this.vrManager.playerRig) {
             const rigY = Math.max(0, 1.8 - 1.6); // 0.2m au-dessus du sol
             this.vrManager.playerRig.position.set(5, rigY, 5);
             console.log(`📍 VR Fallback: PlayerRig positioned at (5, ${rigY.toFixed(2)}, 5)`);
           } else {
             this.camera.position.set(5, 1.8, 5);
           }
       }
    }

    // Créer les portails après chargement
    setTimeout(async () => {
      this.sceneManager.createPortals();

      //  FIX: Réparer TOUS les matériaux avant init
      console.log("🔧 Réparation des matériaux...");
      for (const [name, scene] of this.sceneManager.scenes) {
        fixAllMaterials(scene, name);
      }
      if (this.worldManager?.worldScene) {
        fixAllMaterials(this.worldManager.worldScene, "worldmap");
      }

      await this.initGameSystems(); // Wait for systems

      // ✅ FIX: Synchroniser les flags APRES l'initialisation des systèmes
      this.syncNPCFlagsFromSave();
      this.ui.syncFromSaveManager();

      // Configurer la transition WorldMap
      const hasWorldMap = this.worldManager.zones.length > 0;
      if (hasWorldMap) {
        this.setupWorldMapTransition();
      }

        const sortedZones = this.worldManager.zones.sort((a,b) => {
            const da = (startX-a.worldX)**2 + (startZ-a.worldZ)**2;
            const db = (startX-b.worldX)**2 + (startZ-b.worldZ)**2;
            return da - db;
        });

        if (sortedZones.length > 0) {
            const nearest = sortedZones[0];
            console.log(`🌍 Zone la plus proche au démarrage: ${nearest.scene}`);
            // Force update zone
            this.worldManager.activeZone = nearest;
        }

      // ✅ FIN DU CHARGEMENT (UI)
      const titleScreen = document.getElementById("title-screen");
      if (titleScreen) {
          titleScreen.style.transition = "opacity 1s";
          titleScreen.style.opacity = "0";
          setTimeout(() => {
              titleScreen.style.display = "none";
          }, 1000);
      }
      console.log("🚀 Jeu démarré et chargement terminé !");
    }, 2000);
  }

  /**
   * Configure le basculement vers le mode WorldMap quand on sort dehors
   */
  setupWorldMapTransition() {
    // Sauvegarder le callback original (musique)
    const originalOnSceneChange = this.sceneManager.onSceneChange;

    // Remplacer par un callback qui gère TOUT
    this.sceneManager.onSceneChange = (sceneName) => {
      // 1. Appeler le callback original (musique)
      if (originalOnSceneChange) {
        originalOnSceneChange(sceneName);
      }

      // 2. Vérifier si c'est une scène extérieure dans la worldmap
      // 2. Vérifier si c'est une scène extérieure dans la worldmap
      const zone = this.worldManager.zones.find((z) => z.scene === sceneName);

      // FIX: Utiliser les métadonnées de la zone (WorldManager) plutôt que sceneData (SceneManager)
      // car la scène n'est peut-être pas encore chargée dans SceneManager
      if (zone && !zone.isInterior) {
        console.log(`🌍 Transition vers WorldMap détectée pour ${sceneName}`);
        this.transitionToWorldMap(sceneName);
      }
    };
  }

  /**
   * Bascule vers le mode WorldMap
   */
  async transitionToWorldMap(startZoneName) {
    // Activer le mode worldmap
    this.useWorldMap = true;

    // Initialiser le monde avec la zone de destination
    await this.worldManager.initWorld(startZoneName);

    if (this.sceneManager.portals.length === 0) {
      this.sceneManager.createPortals();
    }

    this.createWorldMapPortals();

    // RÃ©cupÃ©rer la zone
    const zone = this.worldManager.zones.find((z) => z.scene === startZoneName);

    if (zone) {
      const portalInZone = this.sceneManager.portals.find(
        (p) =>
          p.sourceScene === startZoneName &&
          p.targetScene === this.lastInteriorScene
      );

      // Fallback: premier portail qui mÃ¨ne vers un intÃ©rieur
      const fallbackPortal = this.sceneManager.portals.find(
        (p) => p.sourceScene === startZoneName && p.targetScene !== "world"
      );

      const portalToUse = portalInZone || fallbackPortal;

      if (portalToUse?.portal?.portalMesh) {
        // Position du portail (locale Ã  la zone) + offset de la zone dans le monde
        const portalLocalPos = portalToUse.portal.portalMesh.position;
        const portalRot = portalToUse.portal.portalMesh.rotation.y;

        // Offset pour spawner devant le portail
        const offset = new THREE.Vector3(0, 0, 2);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), portalRot);

        this.camera.position.x = zone.worldX + portalLocalPos.x + offset.x;
        this.camera.position.z = zone.worldZ + portalLocalPos.z + offset.z;
        this.camera.rotation.set(0, portalRot + Math.PI, 0);
      } else {
        // Fallback: centre de la zone
        this.camera.position.x = zone.worldX;
        this.camera.position.z = zone.worldZ;
      }

      // Ajuster la hauteur
      const terrainHeight = this.worldManager.getTerrainHeight(
        this.camera.position.x,
        this.camera.position.z
      );
      this.camera.position.y = terrainHeight + 1.6;
    }

    // RÃ©initialiser les systÃ¨mes de jeu pour le monde ouvert
    this.initGameSystemsWorldMap();
  }

  createWorldMapPortals() {
    const worldScene = this.worldManager.worldScene;
    const portalsData = this.worldManager.getPortalsForSceneManager();

    for (const portalData of portalsData) {
      // ScÃ¨ne cible
      const targetScene = this.sceneManager.scenes.get(portalData.targetScene);
      if (!targetScene) {
        console.warn(
          `Scene cible "${portalData.targetScene}" non trouvÃ©e pour portail`
        );
        continue;
      }

      // Position en coordonnÃ©es monde
      const worldPos = new THREE.Vector3(
        portalData.zoneOffset.x + portalData.position.x,
        portalData.position.y,
        portalData.zoneOffset.z + portalData.position.z
      );

      // Importer Portal si pas dÃ©jÃ  fait
      const portal = new Portal(
        worldScene,
        this.renderer,
        worldPos,
        new THREE.Euler(
          portalData.rotation?.x || 0,
          portalData.rotation?.y || 0,
          portalData.rotation?.z || 0
        ),
        {
          width: portalData.size?.width || 2,
          height: portalData.size?.height || 3,
        },
        targetScene
      );

      // Trouver le portail liÃ© pour le rendu
      const linkedPortal = this.sceneManager.portals.find(
        (p) =>
          p.sourceScene === portalData.targetScene &&
          p.targetScene === portalData.sourceZone
      );

      if (linkedPortal?.portal?.portalMesh) {
        portal.setLinkedPortal(
          linkedPortal.portal.portalMesh.position.clone(),
          new THREE.Euler(0, linkedPortal.portal.portalMesh.rotation.y, 0)
        );
      }

      // Stocker dans sceneManager pour la logique de traversÃ©e
      this.sceneManager.portals.push({
        portal,
        name: portalData.name,
        sourceScene: "world",
        targetScene: portalData.targetScene,
        linkedPortalName: portalData.linkedPortalName || "",
        spawnPosition: portalData.spawnPosition,
        spawnRotation: portalData.spawnRotation,
        sourceZone: portalData.sourceZone,
        zoneOffset: portalData.zoneOffset,
      });
    }
  }

  handleWorldMapPortalCrossing(portalInfo) {
    // Basculer en mode classique
    this.lastInteriorScene = portalInfo.targetScene;
    this.useWorldMap = false;
    this.sceneManager.activeSceneName = portalInfo.targetScene;

    // Pour les portails WorldMap, sourceZone contient la zone d'origine
    const sourceZone = portalInfo.sourceZone || portalInfo.sourceScene;

    // Chercher le portail de destination dans la scÃ¨ne cible
    const destPortal = this.sceneManager.portals.find(
      (p) =>
        p.sourceScene === portalInfo.targetScene &&
        (p.targetScene === sourceZone || p.linkedPortalName === portalInfo.name)
    );

    if (destPortal?.portal?.portalMesh) {
      const destPos = destPortal.portal.portalMesh.position.clone();
      const destRot = destPortal.portal.portalMesh.rotation.y;

      // Offset pour spawner devant le portail
      const offset = new THREE.Vector3(0, 0, 1.5);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), destRot);
      destPos.add(offset);
      destPos.y = 1.6;

      this.camera.position.copy(destPos);
      this.camera.rotation.set(0, destRot + Math.PI, 0);
    } else if (portalInfo.spawnPosition) {
      // Fallback: utiliser spawnPosition du portail
      this.camera.position.set(
        portalInfo.spawnPosition.x || 0,
        portalInfo.spawnPosition.y || 1.6,
        portalInfo.spawnPosition.z || 0
      );
    } else {
      this.camera.position.set(0, 1.6, 0);
    }

    // Ajuster FOV pour intÃ©rieur
    this.camera.fov = 85;
    this.camera.updateProjectionMatrix();

    if (this.sceneManager.onSceneChange) {
      this.sceneManager.onSceneChange(portalInfo.targetScene);
    }
  }

  async initGameSystemsWorldMap() {
    cleanAllScenes(this.sceneManager, this.worldManager);
    const worldScene = this.worldManager.worldScene;
    
    // Nettoyer les anciens Pokémon orphelins AVANT de créer le nouveau manager
    if (this.pokemonManager) {
        this.pokemonManager.clearAll();
    } else {
        // Cas où le manager a été écrasé par celui de l'intérieur
        PokemonManager.cleanScene(worldScene);
    }

    // Manager PokÃ©mon avec WorldManager
    this.pokemonManager = new PokemonManager(worldScene, this.worldManager);

    await this.pokemonManager.initialize();

    // âœ… Spawner les PokÃ©mon dans toutes les zones actives (avec leurs spawn zones JSON)
    await this.pokemonManager.spawnPokemonInActiveZones();

    // SystÃ¨me de PokÃ©ball
    this.pokeballPhysics = new PokeballPhysics(
      worldScene,
      this.camera,
      this.camera,
      this.ui,
      this.pokemonManager,
      this.saveManager, // ✅ INJECTION DEPENDANCE (2ème instance)
      this.inputManager // ✅ Passer l'InputManager pour vérifier le pointer lock
    );


    // Lier le lancer de PokÃ©ball au dÃ©marrage du combat
    // Lier le lancer de Pokeball au démarrage du combat
    this.pokeballPhysics.onCombatStart = (
      playerPokemon,
      wildPokemon,
      playerPokemonEntity
    ) => {
      // 🎵 Musique de combat sauvage
      if (this.audioManager) {
        this.audioManager.playMusic("battle-wild");
      }

      this.combatManager.startCombat(
        playerPokemon,
        wildPokemon,
        playerPokemonEntity
      );
    };

    // ✅ FIX: Assigner le callback onCaptureComplete (Manquant précédemment)
    this.pokeballPhysics.onCaptureComplete = (capturedPokemon) => {
      console.log(`🎯 Capture confirmée (WorldMap) : ${capturedPokemon.species}`);
      
      this.isCaptureSequence = true;
      this.audioManager.playMusic('capture-success', false, false);  
      
      setTimeout(() => {
          const currentZone = this.worldManager.activeZone ? this.worldManager.activeZone.scene : "world";
          this.audioManager.playMusic(currentZone);
      }, 4000);

      if (!this.saveManager) return;

      const newPokemonData = this.saveManager.createPokemon(
        capturedPokemon.id, 
        capturedPokemon.level
      );

      if (newPokemonData) {
          const addedToTeam = this.saveManager.addToTeam(newPokemonData.uniqueId);
          if (addedToTeam) {
            this.ui.showDialogue(`${capturedPokemon.species} a été ajouté à l'équipe !`);
          } else {
            this.ui.showDialogue(`${capturedPokemon.species} a été envoyé au PC !`);
          }

          this.saveManager.save();
          this.ui.syncFromSaveManager();
          this.combatManager.endCombatByCapture();
          
          if (this.tutorialSystem) {
            setTimeout(() => {
              this.tutorialSystem.showIfNotSeen('capture');
            }, 2000);
          }
      }
    };

    // Callback de fin de combat : nettoyer l'état de PokeballPhysics
    this.combatManager.onCombatEndCallback = () => {
      console.log("🔄 Synchronisation fin de combat : Reset activePokemon");
      if (this.pokeballPhysics) {
        // Si le pokemon est encore référencé mais a été nettoyé par CombatManager, on le détache
        this.pokeballPhysics.activePokemon = null;
      }

      // 🎵 Rétablir la musique de la zone actuelle
      if (this.audioManager) {
        const currentZone = this.worldManager.activeZone ? this.worldManager.activeZone.scene : "world";
        this.audioManager.playMusic(currentZone);
      }
    };
  }

  async initGameSystems() {
    const exteriorScene = this.sceneManager.scenes.get("bourg-palette");
    const collisionObjects = this.sceneManager.getCollisionObjects();

    // Manager PokÃƒÂ©mon
    this.pokemonManager = new PokemonManager(exteriorScene, null);
    this.pokemonManager.uiManager = this.ui;

    await this.pokemonManager.initialize();

    // Initialiser les données de combat
    await this.typeManager.init();
    await this.moveManager.init();

    // Système de Pokéball
    this.pokeballPhysics = new PokeballPhysics(
      exteriorScene,
      this.camera,
      this.camera,
      this.ui,
      this.pokemonManager,
      this.saveManager, // ✅ INJECTION_DEPENDANCE
      this.inputManager // ✅ Passer l'InputManager pour vérifier le pointer lock
    );

    // Système de combat
    console.log("🔍 Main.js - Pre-CombatManager Check:", {
        moveManager: this.moveManager,
        hasGetMove: typeof this.moveManager?.getMove,
        isMoveManagerInstance: this.moveManager?.constructor?.name
    });

    this.combatManager = new CombatManager(
        exteriorScene,
        this.camera,
        this.ui,
        this.pokemonManager,
        this.typeManager,
        this.moveManager,
        this.xpManager,
        this.itemManager // ✅ INJECTION ITEM MANAGER
    );

    // Hook l'UI de combat moderne
    hookCombatUI(this.combatManager, this.ui);

    // Lier le lancer de Pokéball au démarrage du combat
    this.pokeballPhysics.onCombatStart = (
      playerPokemon,
      wildPokemon,
      playerPokemonEntity
    ) => {
      this.combatManager.startCombat(
        playerPokemon,
        wildPokemon,
        playerPokemonEntity
      );

      // Musique de combat sauvage
      this.audioManager.playMusic('battle-wild');

      // Tutoriel de combat (première fois)
      if (this.tutorialSystem) {
        setTimeout(() => {
          this.tutorialSystem.showIfNotSeen('combat');
        }, 1500);
      }
    };

    // ✅ FIX: Gérer la sauvegarde après une capture
    console.log("[Main] Assignation du callback onCaptureComplete à PokeballPhysics");
    this.pokeballPhysics.onCaptureComplete = (capturedPokemon) => {
      console.log(`🎯 Capture confirmée : ${capturedPokemon.species} (ID: ${capturedPokemon.id})`);
      
      // FIX MUSIQUE: Jouer le jingle SANS BOUCLE
      // false = forceRestart, false = loop
      this.isCaptureSequence = true;
      this.audioManager.playMusic('capture-success', false, false);  
      
      // Reprendre la musique d'ambiance après le jingle (approx 4s)
      setTimeout(() => {
          this.audioManager.playMusic(this.sceneManager.activeSceneName || "bourg-palette");
      }, 4000);

      if (!this.saveManager) return;

      // 1. Créer les données du Pokémon pour la sauvegarde
      const newPokemonData = this.saveManager.createPokemon(
        capturedPokemon.id, 
        capturedPokemon.level
      );

      if (!newPokemonData) {
        console.error("❌ ERREUR: Impossible de créer les données du Pokémon capturé !");
        return;
      }

      // 2. Ajouter à l'équipe
      // ✅ FIX: Passer uniquement l'ID unique (entier)
      const addedToTeam = this.saveManager.addToTeam(newPokemonData.uniqueId);
      
      if (addedToTeam) {
        this.ui.showDialogue(`${capturedPokemon.species} a été ajouté à l'équipe !`);
      } else {
        this.ui.showDialogue(`${capturedPokemon.species} a été envoyé au PC !`);
      }

      // 3. Sauvegarder immédiatement ET forcer l'écriture
      this.saveManager.save().then(success => {
          if (success) console.log("💾 Sauvegarde post-capture réussie");
          else console.error("❌ Echec de la sauvegarde post-capture");
      });

      // 4. Mettre à jour l'interface
      this.ui.updateTeamUI();

      // 5. Mettre à jour la ceinture VR si active
      this.vrManager?.vrBelt?.refreshData();

      // 5. Nettoyer le combat
      this.combatManager.endCombatByCapture();

      // 6. Tutoriel de capture (première fois)
      if (this.tutorialSystem) {
        setTimeout(() => {
          this.tutorialSystem.showIfNotSeen('capture');
        }, 2000);
      }
    };

    // Callback de fin de combat : nettoyer l'état de PokeballPhysics
    this.combatManager.onCombatEndCallback = () => {
      console.log("🔄 Synchronisation fin de combat : Reset activePokemon");
      if (this.pokeballPhysics) {
        // Si le pokemon est encore référencé mais a été nettoyé par CombatManager, on le détache
        // Si le pokemon est encore référencé mais a été nettoyé par CombatManager, on le détache
        this.pokeballPhysics.activePokemon = null;
      }

      // Rétablir la musique de la scène (sauf si c'est une capture qui gère sa propre musique)
      if (!this.isCaptureSequence) {
           const sceneName = this.sceneManager.activeSceneName || "bourg-palette";
           this.audioManager.playMusic(sceneName);
      } else {
          // Reset du flag pour la prochaine fois
          this.isCaptureSequence = false;
      }
    };

    // Système de PNJ
    await this.initNPCSystem();
  }

  /**
   * Initialise le système de PNJ
   */
  async initNPCSystem() {
    // Si le manager existe déjà (pré-chargé), on met juste à jour le CombatManager
    if (this.npcManager) {
        this.npcManager.combatManager = this.combatManager;
    } else {
        // Sinon création complète (fallback)
        this.npcManager = new NPCManager(this.sceneManager, this.combatManager);
        await this.npcManager.loadPNJDatabase();
    }

    this.dialogueSystem = new ModernDialogueSystem(this.ui);

    // Charger la base de données des PNJ (si pas déjà fait)
    if (Object.keys(this.npcManager.pnjDatabase).length === 0) {
        await this.npcManager.loadPNJDatabase();
    }

    // Charger les PNJ de chaque scène
    console.log("🔄 Début du chargement des PNJ pour les scènes chargées...");
    for (const [sceneName, scene] of this.sceneManager.scenes) {
      const sceneData = this.sceneManager.sceneData.get(sceneName);
      console.log(`🔍 Inspection scène "${sceneName}": Données=${!!sceneData}, Entités=${!!sceneData?.entities}, PNJ=${sceneData?.entities?.pnj?.length || 0}`);
      
      if (sceneData?.entities?.pnj && sceneData.entities.pnj.length > 0) {
        console.log(`📥 Chargement des PNJ pour "${sceneName}"...`);
        await this.npcManager.loadNPCsForScene(sceneName, sceneData);
      } else {
        console.warn(`⚠️ Pas de PNJ trouvés dans les données de "${sceneName}"`);
      }
    }

    // Configurer les callbacks
    this.setupNPCCallbacks();

    // Ajouter l'écouteur pour l'interaction (touche E)
    this.setupInteractionInput();

    console.log("✅ Système PNJ initialisé");
  }

  setupNPCCallbacks() {
    // Quand un dialogue se termine
    this.dialogueSystem.onDialogueComplete = (npc, dialogueKey) => {
      console.log(
        `💬 Dialogue terminé avec ${npc?.nom || "PNJ"} (${dialogueKey})`
      );

      // Si c'était le dialogue d'intro de combat, on lance le combat !
      if (dialogueKey === "before_combat") {
          console.log("⚔️ Lancement du combat après dialogue !");
          this.startTrainerBattle(npc);
      }
    };

    // Événements spéciaux
    this.dialogueSystem.onSpecialEvent = (eventType, data) => {
      console.log("[Main] Événement spécial:", eventType, data);

      switch (eventType) {
        case "heal_team":
          // Soigner via SaveManager
          if (this.saveManager) {
            this.saveManager.healTeam();
          }
          this.ui.syncFromSaveManager();
          this.showNotification("💗 Vos Pokémon sont en pleine forme !");
          break;


        case "receive_starter":
          // ============================================
          // CRÉER LE POKÉMON DANS SAVEMANAGER !
          // ============================================
          const starterData = data.pokemon;
          console.log("[Main] Création du starter:", starterData);

          if (this.saveManager) {
            // 1. Créer le Pokémon avec toutes ses stats
            const pokemon = this.saveManager.createPokemon(starterData.id, 5, {
            });

            // 2. Ajouter à l'équipe
            // ✅ FIX: Passer uniquement l'ID unique (entier), pas l'objet entier !
            const addedToTeam = this.saveManager.addToTeam(pokemon.uniqueId);
            
            if (addedToTeam) {
              // Mettre les flags
              this.saveManager.setFlag("starter_choisi", true);
              this.saveManager.setFlag("premier_pokemon", true);
              this.saveManager.setFlag("pokedex_obtenu", true);

              this.ui.syncFromSaveManager();

              // Mettre à jour la ceinture VR si active
              this.vrManager?.vrBelt?.refreshData();
            }

            // 5. SAUVEGARDER !
            this.saveManager.save().then(() => {
              console.log("[Main] Starter sauvegardé !");
            });

            console.log("[Main] Pokémon créé:", pokemon);
            console.log("[Main] Équipe:", this.saveManager.getTeam());
          }

          // Flags NPCManager (pour les dialogues)
          this.npcManager?.addStoryFlag("has_starter");
          this.npcManager?.addStoryFlag("starter_choisi"); // Sync with SaveManager flag
          this.npcManager?.addStoryFlag("has_pokedex");

          this.dialogueSystem.setVariable("POKEMON", starterData.name);
          this.showNotification(`🎉 ${starterData.name} + Pokédex obtenus !`);
          break;

        case "receive_pokedex":
          // Si jamais cet événement est appelé séparément
          console.log("[Main] Pokédex reçu");

          if (this.saveManager) {
            this.saveManager.setFlag("pokedex_obtenu", true);
            this.ui.syncFromSaveManager();
            this.saveManager.save();
          }

          this.npcManager?.addStoryFlag("has_pokedex");
          this.showNotification("📖 Vous avez reçu le Pokédex !");
          break;

        case "trainer_battle":
          this.startTrainerBattle(data);
          break;

        case "open_shop":
          console.log("[Main] Ouverture de la boutique");
          this.ui.showShop();
          break;
      }
    };

    // Choix de dialogue
    this.dialogueSystem.onChoiceMade = (index, choice, npc) => {
      console.log(`Choix ${index} fait avec ${npc?.nom}:`, choice.text);
    };
  }

  /**
   * Configure l'input pour interagir avec les PNJ (touche E)
   */
  setupInteractionInput() {
    document.addEventListener("keydown", (e) => {
      if (e.code === "KeyE" && !e.repeat) {
        console.log("🎹 Touche E pressée ! Tentative d'interaction...");
        this.handleNPCInteraction();
      }
    });
  }

  /**
   * Gère l'interaction avec un PNJ (touche E)
   */
  handleNPCInteraction() {
    console.log("🔍 handleNPCInteraction: Vérification...");
    
    // Vérifier qu'on n'est pas déjà en dialogue ou combat
    if (this.dialogueSystem?.isDialogueActive()) {
        console.log("❌ Interaction bloquée: Dialogue actif");
        return;
    }
    if (this.combatManager?.isInCombat) {
        console.log("❌ Interaction bloquée: Combat en cours");
        return;
    }
    if (this.ui?.isMenuOpen()) {
        console.log("❌ Interaction bloquée: Menu ouvert");
        return;
    }

    console.log(`📍 Position Joueur: x=${this.camera.position.x.toFixed(2)}, z=${this.camera.position.z.toFixed(2)} | Scène: ${this.sceneManager.activeSceneName}`);

    // Vérifier s'il y a un PNJ proche
    const nearbyNPC = this.npcManager?.checkInteractions(
      this.camera.position,
      this.camera.getWorldDirection(new THREE.Vector3())
    );

    if (nearbyNPC) {
      console.log(`✅ PNJ trouvé: ${nearbyNPC.nom} (Dist ${nearbyNPC.lastDistance?.toFixed(2)})`);
      // Faire tourner le PNJ vers le joueur
      this.npcManager.lookAtPlayer(nearbyNPC, this.camera.position);

      // Démarrer le dialogue
      const dialogue = this.npcManager.startDialogue(nearbyNPC);
      console.log("💬 Démarrage dialogue:", dialogue.key);
      this.dialogueSystem.start(nearbyNPC, dialogue.dialogues, dialogue.key);
    } else {
        console.log("⚠️ Aucun PNJ trouvé à proximité.");
        // Debug avancé : lister les PNJ de la scène
        const sceneNPCs = this.npcManager?.npcs.get(this.sceneManager.activeSceneName);
        console.log(`📋 PNJ dans la scène "${this.sceneManager.activeSceneName}":`, sceneNPCs ? sceneNPCs.map(n => `${n.nom} (${n.position.x}/${n.position.z})`) : "AUCUN");
    }
  }

    /**
   * Lance un combat contre un dresseur
   */
  async startTrainerBattle(npc) {
    const battleData = this.npcManager.getTrainerBattleData(npc);
    if (!battleData) return;

    console.log(`⚔️ Combat contre ${npc.nom} !`);

    // Musique de combat dresseur
    const musicKey = battleData.isChampion ? 'battle-gym' : 'battle-trainer';
    this.audioManager.playMusic(musicKey);

    // 1. Récupérer le premier Pokémon adverse
    if (!battleData.equipe || battleData.equipe.length === 0) {
        console.error("❌ Équipe du dresseur vide !");
        return;
    }
    
    // Ajuster les niveaux des Pokémon ennemis selon le niveau moyen du joueur
    const scaledTeam = this.scaleTrainerLevels(battleData.equipe);
    battleData.equipe = scaledTeam; // Mettre à jour l'équipe avec les niveaux ajustés
    
    const firstEnemy = scaledTeam[0];
    
    // Correction: pnj.json peut utiliser 'id' ou 'pokemon'
    const enemyPokemonID = firstEnemy.pokemon || firstEnemy.id;
    console.log(`[Main] startTrainerBattle: Enemy ID=${enemyPokemonID} (Type: ${typeof enemyPokemonID})`);

    const baseData = this.pokemonManager.pokemonDatabase.find(p => p.id == enemyPokemonID);
    
    if (!baseData) {
        console.error("❌ Données du Pokémon adverse introuvables:", enemyPokemonID);
        console.log("Database sample:", this.pokemonManager.pokemonDatabase.slice(0, 3));
        return;
    }

    // Fusionner les données pour le spawn
    const enemyLevel = firstEnemy.niveau || 5;
    const enemyData = {
        ...baseData,
        level: enemyLevel,
        uuid: `trainer_${npc.id}_p1`
    };

    console.log(`⚔️ Ennemi: ${baseData.name} Niv.${enemyLevel}`);

    // 2. Faire apparaître le modèle (Entity)
    // On le place un peu devant le dresseur
    const spawnPos = npc.mesh ? npc.mesh.position.clone().add(new THREE.Vector3(0, 0, 2)) : this.camera.position.clone().add(new THREE.Vector3(0, 0, 5));
    
    // Ajuster au sol
    if (this.worldManager) {
        spawnPos.y = this.worldManager.getTerrainHeight(spawnPos.x, spawnPos.z);
    }
    
    // Force spawn (true) pour éviter que les collisions bloquent l'apparition
    const enemyEntity = await this.pokemonManager.spawnPokemon(spawnPos, enemyData, true);
    
    if (enemyEntity) {
        enemyEntity.isTrainerPokemon = true;
        // FIX HP INCOMPLETS: Forcer les HP au max à l'apparition
        enemyEntity.hp = enemyEntity.maxHp; 
        
        enemyEntity.model.lookAt(this.camera.position);
    }
    

    // 3. Récupérer le Pokémon actif du joueur
    if (!this.saveManager) {
        console.error("❌ SaveManager non disponible dans startTrainerBattle");
        return;
    }

    const playerTeam = this.saveManager.getTeam();

    const playerIndex = playerTeam.findIndex(p => {
        const currentHp = (p.hp !== undefined) ? p.hp : p.stats.hp;
        return currentHp > 0;
    });

    const playerPokemon = playerTeam[playerIndex];

    if (!playerPokemon) {
        this.showNotification("Tous vos Pokémon sont KO !");
        return; 
    }

    if (playerPokemon.hp === undefined) {
        playerPokemon.hp = playerPokemon.stats.hp; // Fallback max HP
    }

    console.log(`✅ Pokémon joueur prêt: ${playerPokemon.name} (HP: ${playerPokemon.hp})`);

    // 3b. Faire apparaître le Pokémon du joueur
    let playerEntity = null;
    
    if (this.pokeballPhysics && this.pokeballPhysics.activePokemon) {
        playerEntity = this.pokeballPhysics.activePokemon;
    } else {
        console.log("Spawn du Pokémon joueur pour le combat...");
        
        // Spawn légèrement devant la caméra
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const spawnPosPlayer = this.camera.position.clone().add(forward.multiplyScalar(3)); 
        
        if (this.worldManager) {
             spawnPosPlayer.y = this.worldManager.getTerrainHeight(spawnPosPlayer.x, spawnPosPlayer.z);
        }

        const speciesId = playerPokemon.speciesId || playerPokemon.id;
        const basePlayerData = this.pokemonManager.pokemonDatabase.find(p => p.id === speciesId);
        
        if (basePlayerData) {
             console.log(`✨ Spawn visuel: ${basePlayerData.name}`);
             // Force spawn (true)
             playerEntity = await this.pokemonManager.spawnPokemon(spawnPosPlayer, {
                 ...basePlayerData,
                 level: playerPokemon.level
             }, true);

             // Forcer les stats actuelles sur l'entité visuelle
             playerEntity.hp = playerPokemon.hp;
             playerEntity.maxHp = playerPokemon.stats?.hp || 100;
        } else {
            console.error(`❌ Impossible de trouver les données de base pour speciesId=${speciesId}`);
        }
    }

    // 4. Lancer le combat
    // On passe l'équipe complète (battleData.equipe) pour gérer les switchs
    // FIX: Passer la position de respawn sûre
    this.combatManager.startCombat(playerPokemon, enemyEntity, playerEntity, npc, battleData.equipe, this.lastSafePosition);

    // 5. Connecter la logique de victoire
    // 5. Connecter la logique de victoire
    // 5. Connecter la logique de victoire
    this.combatManager.onVictory = () => {
        console.log(`🏆 Victoire confirmée contre ${npc.nom} (ID: ${npc.id}) !`);
        
        // 1. Musique
        try {
            this.audioManager.playMusic('victory-trainer', false, false);
        } catch (e) {
            console.warn("Erreur lecture musique victoire:", e);
        }

        // 2. Marquer le dresseur comme vaincu (NPC local + Sauvegarde persistante)
        npc.isDefeated = true; 
        this.npcManager.defeatTrainer(npc.id);
        if (this.saveManager) {
            this.saveManager.defeatTrainer(npc.id);
        }
        npc.isBattling = false; 

        // 3. UI
        if (this.ui.combatMenu) {
            this.ui.combatMenu.style.display = 'none';
        }
        
        // Cooldown de sécurité (5s) pour ce PNJ spécifique
        npc.battleCooldown = Date.now() + 5000;

        // 4. Argent & Badges
        const money = battleData.argent || 0;
        if (money > 0) {
            if (this.saveManager) this.saveManager.addMoney(money);
            this.showNotification(`🏆 Victoire ! Vous gagnez ${money}₽`);
        } else {
             this.showNotification(`🏆 Victoire !`);
        }

        if (battleData.isChampion && battleData.badge) {
            this.npcManager.addStoryFlag(`badge_${battleData.badge}`);
            // Enregistrer le badge dans la sauvegarde
            if (this.saveManager) {
                const badgeIndex = this.getBadgeIndex(battleData.badge);
                if (badgeIndex >= 0) {
                    this.saveManager.earnBadge(badgeIndex);
                }
            }
            this.showNotification(`🎖️ Badge ${battleData.badge} obtenu !`);
        }

        // 5. Sauvegarde
        if (this.saveManager) {
            this.saveManager.save();
        }

        // 6. Nettoyage Entités Combat (SAFE)
        // On ne retire PAS playerEntity ici car il est géré par CombatManager.endCombat -> onCombatEndCallback
        // Mais par sécurité on peut nettoyer l'ennemi
        if (enemyEntity) {
            this.pokemonManager.removePokemon(enemyEntity);
        }
        
        // 7. Dialogue de fin & Interaction
        this.npcManager.updateNPCIndicator(npc);
        this.npcManager.lookAtPlayer(npc, this.camera.position);

        setTimeout(() => {
            // Dialogue "After Defeat"
            this.ui.showDialogue(`${npc.nom}: J'ai perdu... Tu es fort !`);
            
            // On peut aussi déclencher le dialogue formel via NPCManager si défini
            /*
            const postDialogue = this.npcManager.startDialogue(npc);
            if (postDialogue && postDialogue.key === 'after_defeat') {
                 this.dialogueSystem.start(npc, postDialogue.dialogues, postDialogue.key);
            }
            */
        }, 500);

        // Nettoyer le callback
        this.combatManager.onVictory = null;
    };

  }

  /**
   * Affiche une notification temporaire
   */
  showNotification(message) {
    // Si ton UI a déjà cette méthode, utilise-la
    if (this.ui?.showNotification) {
      this.ui.showNotification(message);
      return;
    }

    // Sinon, créer une notification simple
    const notif = document.createElement("div");
    notif.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.85);
      color: #fff;
      padding: 15px 30px;
      border-radius: 8px;
      font-size: 16px;
      font-family: 'Segoe UI', Arial, sans-serif;
      z-index: 10000;
      animation: notifSlide 0.3s ease-out;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    notif.textContent = message;
    document.body.appendChild(notif);

    // Ajouter animation si pas déjà présente
    if (!document.getElementById("notif-style")) {
      const style = document.createElement("style");
      style.id = "notif-style";
      style.textContent = `
        @keyframes notifSlide {
          from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => {
      notif.style.opacity = "0";
      notif.style.transition = "opacity 0.3s";
      setTimeout(() => notif.remove(), 300);
    }, 3000);
  }

  setupResize() {
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  updateMovement() {
    // Vérifier si on peut bouger
    if (!this.inputManager.isLocked()) return;
    if (this.ui.isMenuOpen()) return;

    // Bloquer en mode combat (sauf caméra libre)
    if (this.combatManager?.isInCombat && !this.combatManager.freeCameraMode) {
      return;
    }

    // Bloquer pendant les dialogues
    if (this.dialogueSystem?.isDialogueActive()) {
      return;
    }

    // Calculer le mouvement
    const move = this.inputManager.getMovementVector();

    let moveTarget = this.camera;
    if (this.useVR && this.vrManager && this.vrManager.playerRig) {
        moveTarget = this.vrManager.playerRig;
    }

    const newPosition = moveTarget.position.clone().add(move);

    // RÃ©cupÃ©rer les hauteurs du terrain
    const currentTerrainHeight = this.sceneManager.getTerrainHeight(
      moveTarget.position.x,
      moveTarget.position.z
    );
    const newTerrainHeight = this.sceneManager.getTerrainHeight(
      newPosition.x,
      newPosition.z
    );

    // Calculer la pente
    const horizontalDistance = Math.sqrt(
      Math.pow(newPosition.x - moveTarget.position.x, 2) +
        Math.pow(newPosition.z - moveTarget.position.z, 2)
    );

    const heightDifference = newTerrainHeight - currentTerrainHeight;
    const slope =
      horizontalDistance > 0.001 ? heightDifference / horizontalDistance : 0;

    const maxSlope = 0.8;
    const canClimb = slope <= maxSlope;

    // Fonction helper pour vÃ©rifier si un mouvement est valide
    const canMoveTo = (pos) => {
      const collision = this.checkCollision(pos);
      const flange = this.sceneManager.checkFlangeCollision(
        moveTarget.position,
        pos
      );
      return !collision && !flange;
    };

    // VÃ©rifier les collisions ET la pente ET les flanges
    if (canMoveTo(newPosition) && canClimb) {
      moveTarget.position.copy(newPosition);
    } else {
      // Essayer de glisser sur X
      const slideX = moveTarget.position.clone();
      slideX.x = newPosition.x;
      const slideXHeight = this.sceneManager.getTerrainHeight(
        slideX.x,
        slideX.z
      );
      const slopeX =
        Math.abs(newPosition.x - moveTarget.position.x) > 0.001
          ? (slideXHeight - currentTerrainHeight) /
            Math.abs(newPosition.x - moveTarget.position.x)
          : 0;

      if (canMoveTo(slideX) && slopeX <= maxSlope) {
        moveTarget.position.copy(slideX);
      }

      // Essayer de glisser sur Z
      const slideZ = moveTarget.position.clone();
      slideZ.z = newPosition.z;
      const slideZHeight = this.sceneManager.getTerrainHeight(
        slideZ.x,
        slideZ.z
      );
      const slopeZ =
        Math.abs(newPosition.z - moveTarget.position.z) > 0.001
          ? (slideZHeight - currentTerrainHeight) /
            Math.abs(newPosition.z - moveTarget.position.z)
          : 0;

      if (canMoveTo(slideZ) && slopeZ <= maxSlope) {
        moveTarget.position.copy(slideZ);
      }
    }

    // Ajuster la hauteur du joueur
    const finalTerrainHeight = this.sceneManager.getTerrainHeight(
      moveTarget.position.x,
      moveTarget.position.z
    );
    
    // En VR, le Rig est au sol. En Desktop, la Caméra est à 1.6m.
    const isVRRig = (this.useVR && this.vrManager && moveTarget === this.vrManager.playerRig);
    const heightOffset = isVRRig ? 0 : 1.6;
    
    moveTarget.position.y = finalTerrainHeight + heightOffset;

    // VÃ©rifier traversÃ©e de portail
    const crossedPortal = this.sceneManager.checkPortalCrossing(
      moveTarget.position,
      this.lastPlayerSide
    );

    if (crossedPortal) {
      console.log("🚪 TRAVERSÉE DE PORTAIL DÉTECTÉE:", crossedPortal);
      this.sceneManager.teleportToScene(crossedPortal, moveTarget, this);
      console.log("✅ Téléportation effectuée vers:", crossedPortal.targetScene);

      // Vérifier si on retourne vers le monde (bourg-palette = partie du worldmap)
      const worldMapZones = ["bourg-palette", "route1", "argenta", "route2", "jadeto2", "foret-jade"];
      if (worldMapZones.includes(crossedPortal.targetScene) && this.worldManager?.worldScene) {
          console.log("🌍 Retour vers le monde - Réactivation WorldMap");
          this.useWorldMap = true;
      }
    }
  }

  checkCollision(position) {
    const playerRadius = 0.3;
    const playerHeight = 1.6;

    if (this.sceneManager.isNearPortal(position)) {
      return false;
    }

    const activeScene = this.sceneManager.getActiveScene();
    if (!activeScene) return false;

    // RÃƒÂ©cupÃƒÂ©rer les infos de la scÃƒÂ¨ne UNE SEULE FOIS
    const sceneData = this.sceneManager.sceneData.get(
      this.sceneManager.activeSceneName
    );
    const isInterior = sceneData?.isInterior || false;

    const playerBox = new THREE.Box3(
      new THREE.Vector3(
        position.x - playerRadius,
        position.y,
        position.z - playerRadius
      ),
      new THREE.Vector3(
        position.x + playerRadius,
        position.y + playerHeight,
        position.z + playerRadius
      )
    );

    let hasCollision = false;

    activeScene.traverse((child) => {
      if (hasCollision) return;
      if (!child.isMesh) return;
      if (!child.userData?.hasCollision) return;

      // En intÃƒÂ©rieur, seulement les mesh _colli
      if (isInterior && !child.userData?.isCollisionMesh) {
        return;
      }

      const box = new THREE.Box3().setFromObject(child);
      box.expandByScalar(playerRadius);

      if (box.intersectsBox(playerBox)) {
        hasCollision = true;
      }
    });

    return hasCollision;
  }

  update(delta) {
    const perfStart = performance.now();

    // Mode WorldMap
    if (this.useWorldMap) {
      const t1 = performance.now();
      this.updateWorldMapMode(delta);
      const t2 = performance.now();

      if (!this._perfLog) this._perfLog = { count: 0, total: 0 };
      this._perfLog.count++;
      this._perfLog.total += t2 - t1;

      return;
    }

    // Mode classique
    this.updateMovement();
    this.sceneManager.updatePortals(this.camera);

    // FIX: Autoriser la mise à jour pour toutes les scènes de jeu (Foret Jade, Argenta, etc.)
    const activeScene = this.sceneManager.activeSceneName;
    const ignoredScenes = ["title_screen", "menu", "loading"];

    if (activeScene && !ignoredScenes.includes(activeScene)) {
      // 1. Synchronisation de la scène active pour les managers (pour le spawn/rendu)
      const currentSceneObj = this.sceneManager.scenes.get(activeScene);
      if (currentSceneObj) {
          if (this.pokemonManager) this.pokemonManager.scene = currentSceneObj;
          if (this.npcManager) this.npcManager.scene = currentSceneObj;
          // CombatManager gère sa scène via startCombat, pas besoin de forcer ici
      }

      const collisionObjects = this.sceneManager.getCollisionObjects();

      if (this.pokemonManager) {
        this.pokemonManager.update(
          delta,
          this.camera.position,
          collisionObjects
        );
      }

      if (this.pokeballPhysics) {
        this.pokeballPhysics.update(delta);
      }

      // Update VR Pokeballs physics
      if (this.activePhysicsObjects && this.activePhysicsObjects.length > 0) {
        for (let i = this.activePhysicsObjects.length - 1; i >= 0; i--) {
          const vrPokeball = this.activePhysicsObjects[i];
          vrPokeball.update(delta);

          // Nettoyer les pokeballs qui ont atterri après un délai
          if (vrPokeball.state === 'LANDED') {
            if (!vrPokeball.landedTime) vrPokeball.landedTime = 0;
            vrPokeball.landedTime += delta;

            // Supprimer après 3 secondes au sol
            if (vrPokeball.landedTime > 3) {
              this.sceneManager.getActiveScene()?.remove(vrPokeball.mesh);
              this.activePhysicsObjects.splice(i, 1);
            }
          }
        }
      }

      if (this.combatManager) {
        this.combatManager.update(delta);
      }

      // Système de PNJ - Update et détection des dresseurs
      if (
        this.npcManager &&
        !this.dialogueSystem?.isDialogueActive() &&
        !this.combatManager?.isInCombat
      ) {
        this.npcManager.update(delta);

        // Vérifier si un dresseur repère le joueur
        // FIX VR: Utiliser getWorldPosition() pour obtenir la position mondiale de la caméra
        let detectionPos = this.camera.position;
        if (this.useVR && this.vrManager && this.camera) {
          const camWorldPos = new THREE.Vector3();
          this.camera.getWorldPosition(camWorldPos);
          detectionPos = camWorldPos;
        }
        const spottingTrainer = this.npcManager.checkTrainerVision(
          detectionPos,
          delta
        );
        if (spottingTrainer) {
          console.log(`👀 ${spottingTrainer.nom} vous a repéré !`);

          // FIX: Sauvegarder la position exacte AVANT le dialogue/combat
          // FIX VR: Utiliser detectionPos qui contient déjà la position mondiale correcte
          this.lastSafePosition = detectionPos.clone();

          // LOCK IMMÉDIAT pour éviter les déclenchements multiples
          spottingTrainer.isBattling = true;

          // Afficher l'alerte "!"
          this.dialogueSystem.showTrainerAlert();

          // Après un court délai, lancer le dialogue
          setTimeout(() => {
            // Note: on garde le lock, il sera géré par la fin du combat
            if (!this.dialogueSystem.isDialogueActive()) {
              this.npcManager.lookAtPlayer(
                spottingTrainer,
                detectionPos
              );
              const dialogue = this.npcManager.startDialogue(spottingTrainer);
              this.dialogueSystem.start(
                spottingTrainer,
                dialogue.dialogues,
                dialogue.key
              );
            }
          }, 800);
        }
      }
    }

    this.cacheCleanTimer = (this.cacheCleanTimer || 0) + delta;
    if (this.cacheCleanTimer > 5) {
      if (this.useWorldMap) {
        this.worldManager.collisionCache.cleanTerrainCache();
      } else {
        this.sceneManager.collisionCache.cleanTerrainCache();
      }
      this.cacheCleanTimer = 0;
    }
  }

 updateWorldMapMode(delta) {
  // Vérifier si on peut bouger
  if (!this.inputManager.isLocked()) return;
  if (this.ui.isMenuOpen()) return;

  // Bloquer en mode combat
  if (this.combatManager?.isInCombat && !this.combatManager.freeCameraMode) {
    return;
  }

  // Bloquer pendant les dialogues
  if (this.dialogueSystem?.isDialogueActive()) {
    return;
  }

  // ✅ Déterminer la cible de mouvement (Rig VR ou Caméra)
  let moveTarget = this.camera;
  if (this.useVR && this.vrManager && this.vrManager.playerRig) {
    moveTarget = this.vrManager.playerRig;
  }

  if (this.isJumping) {
    this.jumpProgress += delta * 3;

    if (this.jumpProgress >= 1) {
      moveTarget.position.x = this.jumpTargetX;
      moveTarget.position.z = this.jumpTargetZ;
      moveTarget.position.y = this.jumpTargetY + 1.6;
      this.isJumping = false;
    } else {
      const arc = Math.sin(this.jumpProgress * Math.PI) * 1.5;
      moveTarget.position.x =
        this.jumpStartX +
        (this.jumpTargetX - this.jumpStartX) * this.jumpProgress;
      moveTarget.position.z =
        this.jumpStartZ +
        (this.jumpTargetZ - this.jumpStartZ) * this.jumpProgress;
      const currentY =
        this.jumpStartY +
        (this.jumpTargetY - this.jumpStartY) * this.jumpProgress;
      moveTarget.position.y = currentY + 1.6 + arc;
    }

    this.worldManager.update(moveTarget.position);
    return;
  }

  const perfTimers = {};
  let t = performance.now();

  // Calculer le mouvement
  const move = this.inputManager.getMovementVector();
  const newPosition = moveTarget.position.clone().add(move);

  perfTimers.movement = performance.now() - t;
  t = performance.now();

  // Gestion des PNJ en mode WorldMap
  if (this.npcManager && !this.dialogueSystem?.isDialogueActive()) {
    // FIX VR: Utiliser la position réelle de la tête (projetée au sol) pour la détection
    // Cela permet de détecter le joueur même s'il marche physiquement (Room Scale) loin du centre du Rig
    let detectionPos = moveTarget.position;
    
    if (this.useVR && this.vrManager && this.camera) {
        const camWorldPos = new THREE.Vector3();
        this.camera.getWorldPosition(camWorldPos);
        // On projette au sol (hauteur du Rig) pour que la logique "EyeHeight + 1.5" du NPCManager reste valide
        detectionPos = new THREE.Vector3(camWorldPos.x, moveTarget.position.y, camWorldPos.z);
    }

    this.npcManager.update(delta, detectionPos);

    // Vérifier vision dresseurs
    const spottingTrainer = this.npcManager.checkTrainerVision(detectionPos, delta);
    if (spottingTrainer) {
      console.log(`👀 ${spottingTrainer.nom} vous a repéré (WorldMap)!`);
      this.dialogueSystem.showTrainerAlert();

      setTimeout(() => {
        if (!this.dialogueSystem.isDialogueActive()) {
          this.npcManager.lookAtPlayer(spottingTrainer, moveTarget.position);
          const dialogue = this.npcManager.startDialogue(spottingTrainer);
          this.dialogueSystem.start(spottingTrainer, dialogue.dialogues, dialogue.key);
        }
      }, 800);
    }
  }

  // Update portails
  this.sceneManager.updatePortals(this.camera);

  perfTimers.portals = performance.now() - t;
  t = performance.now();

  // Check portal crossing
  const zonePortal = this.sceneManager.checkPortalCrossing(
    moveTarget.position,
    this.lastPlayerSide
  );

  if (zonePortal) {
    console.log("🚪 (WorldMap) TRAVERSÉE DE PORTAIL:", zonePortal.name);
    
    this.lastInteriorScene = zonePortal.targetScene;
    this.useWorldMap = false; // Désactiver mode WorldMap car on rentre (souvent)
    
    // Utiliser la méthode centralisée du SceneManager
    this.sceneManager.teleportToScene(zonePortal, moveTarget, this);
    
    // FIX: Forcer le chargement des PNJ pour la scène cible (si ce n'est pas déjà fait par teleportToScene -> onSceneChange)
    if (this.npcManager) {
      const targetSceneData = this.sceneManager.sceneData.get(zonePortal.targetScene);
      if (targetSceneData) {
        this.npcManager.loadNPCsForScene(zonePortal.targetScene, targetSceneData).catch(e => console.warn(e));
      }
    }

    this.camera.fov = 85;
    this.camera.updateProjectionMatrix();
    return;
  }

  perfTimers.portalCheck = performance.now() - t;
  t = performance.now();

  // Vérifier si on peut sauter d'un rebord
  const forward = new THREE.Vector3();
  this.camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const flangeCheck = this.worldManager.isAboveFlange(
    moveTarget.position,
    forward
  );

  perfTimers.flangeCheck = performance.now() - t;
  t = performance.now();

  if (flangeCheck.canJump && this.inputManager.isJumpPressed()) {
    this.isJumping = true;
    this.jumpStartY = moveTarget.position.y - 1.6;
    this.jumpTargetY = flangeCheck.landingY;
    this.jumpStartX = moveTarget.position.x;
    this.jumpStartZ = moveTarget.position.z;
    this.jumpTargetX = flangeCheck.landingX;
    this.jumpTargetZ = flangeCheck.landingZ;
    this.jumpProgress = 0;

    return;
  }

  // Vérifications collisions
  const nearPortal = this.sceneManager.isNearPortal(newPosition);
  const hasCollision = this.worldManager.checkCollision(newPosition);

  perfTimers.collision = performance.now() - t;
  t = performance.now();

  const currentHeight = this.worldManager.getTerrainHeight(
    moveTarget.position.x,
    moveTarget.position.z
  );
  const newHeight = this.worldManager.getTerrainHeight(
    newPosition.x,
    newPosition.z
  );

  perfTimers.terrainHeight = performance.now() - t;
  t = performance.now();

  const hasFlangeBlock = this.worldManager.checkFlangeCollision(
    moveTarget.position,
    newPosition
  );

  perfTimers.flangeCollision = performance.now() - t;
  t = performance.now();

  // Peut bouger si : près d'un portail OU (pas de collision ET pas de flange)
  if (nearPortal || (!hasCollision && !hasFlangeBlock)) {
    moveTarget.position.copy(newPosition);
  } else {
    // Glissement
    const slideX = moveTarget.position.clone();
    slideX.x = newPosition.x;
    const slideXBlocked =
      this.worldManager.checkCollision(slideX) ||
      this.worldManager.checkFlangeCollision(moveTarget.position, slideX);
    if (!slideXBlocked) {
      moveTarget.position.x = slideX.x;
    }

    const slideZ = moveTarget.position.clone();
    slideZ.z = newPosition.z;
    const slideZBlocked =
      this.worldManager.checkCollision(slideZ) ||
      this.worldManager.checkFlangeCollision(moveTarget.position, slideZ);
    if (!slideZBlocked) {
      moveTarget.position.z = slideZ.z;
    }
  }

  perfTimers.sliding = performance.now() - t;
  t = performance.now();

  // Ajuster la hauteur sur le _floor
  const finalHeight = this.worldManager.getTerrainHeight(
    moveTarget.position.x,
    moveTarget.position.z
  );
  // En VR, le Rig est au sol (0). En Desktop, la Caméra est à 1.6m.
  const isVRRig = (this.useVR && this.vrManager && moveTarget === this.vrManager.playerRig);
  const heightOffset = isVRRig ? 0 : 1.6;
  moveTarget.position.y = finalHeight + heightOffset;

  perfTimers.finalHeight = performance.now() - t;
  t = performance.now();

  // Mettre à jour le chargement des zones
  this.worldManager.update(moveTarget.position);

  perfTimers.worldUpdate = performance.now() - t;
  t = performance.now();

  const collisionObjects = this.worldManager.getCollisionObjects();

  if (this.pokemonManager) {
    this.pokemonManager.update(delta, moveTarget.position, collisionObjects);
  }

  if (this.pokeballPhysics) {
    this.pokeballPhysics.update(delta);
  }

  if (this.combatManager) {
    this.combatManager.update(delta);
  }

  if (this.npcManager) {
    this.npcManager.update(delta, moveTarget.position);
  }

  perfTimers.gameSystems = performance.now() - t;

  // Log des perfs toutes les 60 frames
  if (!this._perfFrameCount) this._perfFrameCount = 0;
  this._perfFrameCount++;
}
  checkWorldMapPortals() {
    const playerPos = this.camera.position;
    const playerRadius = 1;

    for (const [sceneName, zoneGroup] of this.worldManager.zoneGroups) {
      const zone = this.worldManager.zones.find((z) => z.scene === sceneName);
      if (!zone) continue;

      for (const child of zoneGroup.children) {
        if (!child.userData.isPortal) continue;

        const portalData = child.userData.portalData;

        // Position du portail en coordonnÃ©es monde
        const portalWorldPos = new THREE.Vector3(
          zone.worldX + child.position.x,
          child.position.y,
          zone.worldZ + child.position.z
        );

        // Distance au portail
        const dx = playerPos.x - portalWorldPos.x;
        const dz = playerPos.z - portalWorldPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < playerRadius) {
          return { portalData, zone, portalWorldPos };
        }
      }
    }
    return null;
  }

  handleWorldMapPortal(portal) {
    const { portalData, zone } = portal;
    const targetScene = portalData.targetScene;

    // VÃ©rifier si c'est un intÃ©rieur (pas dans la worldmap)
    const targetZone = this.worldManager.zones.find(
      (z) => z.scene === targetScene
    );

    if (!targetZone) {
      // C'est un intÃ©rieur - basculer en mode classique
      this.useWorldMap = false;
      this.sceneManager.activeSceneName = targetScene;

      // TÃ©lÃ©porter Ã  la position de spawn
      this.camera.position.set(
        portalData.spawnPosition?.x || 0,
        portalData.spawnPosition?.y || 1.6,
        portalData.spawnPosition?.z || 0
      );
    } else {
      // C'est une autre zone extÃ©rieure
      const spawnX = targetZone.worldX + (portalData.spawnPosition?.x || 0);
      const spawnZ = targetZone.worldZ + (portalData.spawnPosition?.z || 0);

      this.camera.position.x = spawnX;
      this.camera.position.z = spawnZ;

      const terrainHeight = this.worldManager.getTerrainHeight(spawnX, spawnZ);
      this.camera.position.y = terrainHeight + 1.6;
    }
  }

  animate() {
    this.renderer.setAnimationLoop(() => {
        this.renderFrame();
    });
  }

  renderFrame() {
    // requestAnimationFrame(() => this.animate()); // REMPLACÉ par setAnimationLoop


    // Consommer le temps pour éviter un gros saut à la reprise
    const delta = this.clock.getDelta();

    // Si pas de scène active (Menu Principal / Chargement), on skip update/render
    if (!this.useWorldMap && !this.sceneManager.activeSceneName) {
        return;
    }

    // Incrémenter le timer de jeu (chaque seconde)
    const currentTime = Date.now();
    if (currentTime - this.lastTimerUpdate >= 1000) {
      this.gameTimer++;
      this.lastTimerUpdate = currentTime;

      // Mettre à jour le temps de jeu dans la sauvegarde
      if (this.saveManager && this.saveManager.saveData) {
        this.saveManager.saveData.joueur.tempsJeu = this.gameTimer;
      }
    }

    if (!this._hasCleanedMaterials) {
      cleanAllScenes(this.sceneManager, this.worldManager);
      this._hasCleanedMaterials = true;
    }

    // RESET les stats du renderer
    this.renderer.info.reset();

    const frameStart = performance.now();

    // Update
    this.update(delta);
    
    // Update VR
    if (this.vrManager) {
        this.vrManager.update(delta);
    }

    // Update Météo (Seulement si WorldMap active)
    if (this.weatherManager && this.useWorldMap) {
        let playerPos = this.camera.position;
        if (this.vrManager && this.vrManager.playerRig) {
            playerPos = this.vrManager.playerRig.position;
        }
        this.weatherManager.update(delta, playerPos);
    }

    const updateTime = performance.now() - frameStart;
    const renderStart = performance.now();

    // Render
    if (this.useWorldMap && this.worldManager.worldScene) {
      this.renderer.render(this.worldManager.worldScene, this.camera);
    } else {
      this.sceneManager.render(this.camera);
    }

    const renderTime = performance.now() - renderStart;

    // Stats dÃ©taillÃ©es
    if (!this._fpsData) {
      this._fpsData = {
        frames: 0,
        lastTime: performance.now(),
        fps: 0,
      };
    }

    this._fpsData.frames++;

    const now = performance.now();
    if (now - this._fpsData.lastTime > 1000) {
      this._fpsData.fps = this._fpsData.frames;

      const info = this.renderer.info;

      this._fpsData.frames = 0;
      this._fpsData.lastTime = now;
    }

    // Update debug panel si activÃ©
    if (this.showDebug && this.debugPanel) {
      const info = this.renderer.info;
      const zones = this.useWorldMap ? this.worldManager.loadedZones.size : 1;
      const totalZones = this.useWorldMap ? this.worldManager.zones.length : 1;

      this.debugPanel.innerHTML = `
      SCENE: ${this.sceneManager.activeSceneName}<br>
      POS: ${this.camera.position.x.toFixed(1)}, ${this.camera.position.y.toFixed(1)}, ${this.camera.position.z.toFixed(1)}<br>
      FPS: ${this._fpsData.fps}<br>
      Update: ${updateTime.toFixed(1)}ms<br>
      Render: ${renderTime.toFixed(1)}ms<br>
      Draw Calls: ${info.render.calls}<br>
      Triangles: ${info.render.triangles}<br>
      Geometries: ${info.memory.geometries}<br>
      Textures: ${info.memory.textures}<br>
      Zones: ${zones}/${totalZones}<br>
      Portals: ${this.sceneManager.portals.length}<br>
      Mode: ${this.useWorldMap ? "WorldMap" : "Classic"}<br>
    `;
    }
  }

  createPortalsForZone(portalsData) {
    const worldScene = this.worldManager.worldScene;
    if (!worldScene) return;

    for (const portalData of portalsData) {
      const exists = this.sceneManager.portals.some(
        (p) =>
          p.name === portalData.name && p.sourceZone === portalData.sourceZone
      );
      if (exists) continue;

      // ScÃ¨ne cible
      const targetScene = this.sceneManager.scenes.get(portalData.targetScene);
      if (!targetScene) {
        console.warn(
          `Scene cible "${portalData.targetScene}" non trouvÃ©e pour portail`
        );
        continue;
      }

      // Position en coordonnÃ©es monde
      const worldPos = new THREE.Vector3(
        portalData.zoneOffset.x + portalData.position.x,
        portalData.position.y,
        portalData.zoneOffset.z + portalData.position.z
      );

      const portal = new Portal(
        worldScene,
        this.renderer,
        worldPos,
        new THREE.Euler(
          portalData.rotation?.x || 0,
          portalData.rotation?.y || 0,
          portalData.rotation?.z || 0
        ),
        {
          width: portalData.size?.width || 2,
          height: portalData.size?.height || 3,
        },
        targetScene
      );

      // Trouver le portail liÃ© pour le rendu
      const linkedPortal = this.sceneManager.portals.find(
        (p) =>
          p.sourceScene === portalData.targetScene &&
          p.targetScene === portalData.sourceZone
      );

      if (linkedPortal?.portal?.portalMesh) {
        portal.setLinkedPortal(
          linkedPortal.portal.portalMesh.position.clone(),
          new THREE.Euler(0, linkedPortal.portal.portalMesh.rotation.y, 0)
        );
      }

      this.sceneManager.portals.push({
        portal,
        name: portalData.name,
        sourceScene: "world",
        targetScene: portalData.targetScene,
        linkedPortalName: portalData.linkedPortalName || "",
        spawnPosition: portalData.spawnPosition,
        spawnRotation: portalData.spawnRotation,
        sourceZone: portalData.sourceZone,
        zoneOffset: portalData.zoneOffset,
      });
    }
  }

  // ==================== HELPERS ====================

  /**
   * Retourne l'index du badge (0-7) à partir de son nom
   */
  getBadgeIndex(badgeName) {
    const badges = [
      'roche',     // Pierre - Argenta
      'cascade',   // Ondine - Azuria
      'foudre',    // Major Bob - Carmin
      'prisme',    // Erika - Celadopole
      'ame',       // Koga - Parmanie
      'marais',    // Jeannine - Safrania
      'volcan',    // Auguste - Cramois Ile
      'terre'      // Giovanni - Jadielle
    ];
    return badges.indexOf(badgeName.toLowerCase());
  }

  /**
   * Calcule le niveau moyen de l'équipe du joueur
   */
  getPlayerTeamAverageLevel() {
    if (!this.ui?.playerData?.team) return 5;
    
    const team = this.ui.playerData.team.filter(p => p && p.level);
    if (team.length === 0) return 5;
    
    const totalLevel = team.reduce((sum, p) => sum + (p.level || 5), 0);
    return Math.round(totalLevel / team.length);
  }

  /**
   * Ajuste le niveau des Pokémon d'un dresseur selon le niveau moyen du joueur
   */
  scaleTrainerLevels(trainerTeam) {
    const playerAvg = this.getPlayerTeamAverageLevel();
    
    return trainerTeam.map(pokemon => ({
      ...pokemon,
      niveau: Math.max(2, playerAvg + Math.floor(Math.random() * 5) - 2)
    }));
  }
}

const originalRender = THREE.WebGLRenderer.prototype.render;
let crashingObject = null;

THREE.WebGLRenderer.prototype.render = function (scene, camera) {
  try {
    originalRender.call(this, scene, camera);
  } catch (error) {
    if (error.message.includes("Cannot read properties of undefined")) {
      console.error("ðŸš¨ CRASH DÃ‰TECTÃ‰ - Identification de l'objet...");

      // Parcourir tous les objets pour trouver le coupable
      scene.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          try {
            const mats = Array.isArray(obj.material)
              ? obj.material
              : [obj.material];
            mats.forEach((mat, idx) => {
              // VÃ©rifier si ce matÃ©riau a des props null
              const badProps = [];
              [
                "map",
                "normalMap",
                "bumpMap",
                "specularMap",
                "emissiveMap",
                "alphaMap",
                "aoMap",
                "lightMap",
                "envMap",
                "displacementMap",
                "roughnessMap",
                "metalnessMap",
              ].forEach((prop) => {
                if (mat.hasOwnProperty(prop) && mat[prop] === null) {
                  badProps.push(prop);
                }
              });

              if (badProps.length > 0) {
                console.error(`ðŸŽ¯ OBJET COUPABLE TROUVÃ‰:
  Nom: ${obj.name || "sans nom"}
  Type: ${obj.type}
  Parent: ${obj.parent?.name || "root"}
  MatÃ©riau ${idx}: ${mat.type}
  PropriÃ©tÃ©s corrompues: ${badProps.join(", ")}
  Position: x=${obj.position.x.toFixed(2)}, y=${obj.position.y.toFixed(
                  2
                )}, z=${obj.position.z.toFixed(2)}`);

                // RÃ‰PARER IMMÃ‰DIATEMENT
                badProps.forEach((prop) => delete mat[prop]);
                mat.needsUpdate = true;

                console.log("âœ… Objet rÃ©parÃ©, tentative de re-render...");
                crashingObject = obj;
              }
            });
          } catch (e) {
            // Continuer
          }
        }
      });

      if (crashingObject) {
        // Retry le render
        try {
          originalRender.call(this, scene, camera);
          console.log("âœ… Render rÃ©ussi aprÃ¨s rÃ©paration!");
        } catch (e2) {
          console.error("âŒ Ã‰chec mÃªme aprÃ¨s rÃ©paration:", e2);
        }
      } else {
        console.error("âŒ Impossible d'identifier l'objet coupable");
        throw error;
      }
    }
  }
}

// Démarrage avec interaction utilisateur (Click to Start)
const startBtn = document.getElementById('start-btn');
if (startBtn) {
    startBtn.addEventListener('click', () => {
        // Init Game
        const game = new PokemonGame();

        // Lancer la musique du titre après l'interaction utilisateur
        game.audioManager.playMusic('title');

        // UI Feedback immédiat (sera géré par showTitleScreen ensuite)
        startBtn.innerText = "CHARGEMENT...";
    });
} else {
    // Fallback si pas d'index.html à jour
    new PokemonGame();
}
