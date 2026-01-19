/**
 * ModernUIInit.js - Initialisation de l'UI moderne
 * Ce fichier facilite l'intégration des nouveaux modules UI
 */

import { ModernBagUI } from './ModernBagUI.js';
import { ModernCombatUI } from './ModernCombatUI.js';
import { ModernDialogueSystem } from './ModernDialogueSystem.js';
import { ModernHUD } from './ModernHUD.js';
import { ModernPokedexUI } from './ModernPokedexUI.js';
import { ModernSettingsUI } from './ModernSettingsUI.js';
import { ModernStorageUI } from './ModernStorageUI.js';
import { ModernTeamUI } from './ModernTeamUI.js';
import { TutorialSystem } from './TutorialSystem.js';

/**
 * Initialise tous les systèmes UI modernes
 * @param {Object} game - Instance du jeu principal
 */
export function initModernUI(game) {
  console.log('🎨 Initialisation de l\'UI moderne...');

  const ui = game.ui;

  // 1. Système de tutoriels
  game.tutorialSystem = new TutorialSystem(ui);
  console.log('✅ TutorialSystem initialisé');

  // 2. Système de dialogue moderne (remplace DialogueSystem)
  game.modernDialogue = new ModernDialogueSystem(ui);
  console.log('✅ ModernDialogueSystem initialisé');

  // Connecter les callbacks du dialogue moderne à ceux du jeu
  game.modernDialogue.onDialogueComplete = (npc, key) => {
    if (game.dialogueSystem && game.dialogueSystem.onDialogueComplete) {
      // Déléguer au système existant pour la compatibilité
    }
    // Réactiver les contrôles
    if (game.inputManager) {
      game.inputManager.locked = false;
    }
  };

  game.modernDialogue.onSpecialEvent = (eventType, data) => {
    console.log(`[ModernDialogue] Event: ${eventType}`, data);
    handleSpecialEvent(game, eventType, data);
  };

  // 3. HUD moderne
  game.modernHUD = new ModernHUD(ui);
  // FIX: Attacher le HUD moderne à l'UI Manager pour y accéder depuis CombatManager
  ui.modernHUD = game.modernHUD;
  console.log('✅ ModernHUD initialisé');

  // Synchroniser le HUD avec les données du joueur
  if (game.saveManager && game.saveManager.saveData) {
    const playerData = game.saveManager.saveData.joueur;
    game.modernHUD.updatePlayerInfo(playerData.nom, playerData.argent);
  }

  // 4. UI de combat moderne (sera utilisé par CombatManager)
  // On ne l'initialise pas ici, mais on le prépare pour CombatManager
  game.ModernCombatUI = ModernCombatUI;
  console.log('✅ ModernCombatUI prêt');

  // 5. Connecter les événements de mise à jour
  setupUIUpdates(game);
  
  // 6. Initialiser Team, Bag et Storage UIs
  game.modernTeamUI = new ModernTeamUI(ui);
  game.modernBagUI = new ModernBagUI(ui);
  game.modernStorageUI = new ModernStorageUI(ui);
  game.modernSettingsUI = new ModernSettingsUI(ui);
  game.modernPokedexUI = new ModernPokedexUI(ui);
  console.log('✅ All Modern UIs initialized');

  // Override de ui.openMenu
  const originalOpenMenu = ui.openMenu.bind(ui);
  ui.openMenu = function(menuName) {
    if (menuName === 'team') {
        game.modernTeamUI.show();
    } else if (menuName === 'bag') {
        game.modernBagUI.show();
    } else if (menuName === 'storage') {
        game.modernStorageUI.show();
    } else if (menuName === 'settings') {
        game.modernSettingsUI.show();
    } else if (menuName === 'pokedex') {
        game.modernPokedexUI.show();
    } else {
        originalOpenMenu(menuName);
    }
  };

  // Override de ui.showPC pour utiliser la nouvelle interface
  ui.showPC = function() {
      if (game.modernStorageUI) {
          game.modernStorageUI.show();
      } else {
          // Fallback old PC if needed, but we replace it
          console.warn("ModernStorageUI not ready");
      }
  };
  
  // Override de ui.closeAllMenus pour inclure les nouveaux menus
  const originalCloseAllMenus = ui.closeAllMenus.bind(ui);
  ui.closeAllMenus = function() {
      // Fermer les menus modernes
      if (game.modernTeamUI) game.modernTeamUI.hide();
      if (game.modernBagUI) game.modernBagUI.hide();
      if (game.modernStorageUI) game.modernStorageUI.hide();
      if (game.modernSettingsUI) game.modernSettingsUI.hide();
      if (game.modernPokedexUI) game.modernPokedexUI.hide();
      if (game.modernHUD) game.modernHUD.closeAllMenus();
      
      originalCloseAllMenus();
  };

  // 7. Afficher le tutoriel de bienvenue si c'est une nouvelle partie
  if (game.saveManager && game.saveManager.isNewGame) {
    setTimeout(() => {
      game.tutorialSystem.showIfNotSeen('welcome');
    }, 1000);
  }

  console.log('🎨 UI moderne initialisée avec succès !');

  return {
    tutorialSystem: game.tutorialSystem,
    modernDialogue: game.modernDialogue,
    modernHUD: game.modernHUD
  };
}

/**
 * Gère les événements spéciaux des dialogues
 */
function handleSpecialEvent(game, eventType, data) {
  switch (eventType) {
    case 'heal_team':
      healTeam(game);
      break;

    case 'receive_starter':
      receiveStarter(game, data);
      break;

    case 'receive_pokedex':
      receivePokedex(game);
      break;

    case 'trainer_battle':
      startTrainerBattle(game, data);
      break;

    case 'open_shop':
      game.ui.showShop();
      break;

    default:
      console.log(`[Event] Non géré: ${eventType}`);
  }
}

/**
 * Soigne l'équipe du joueur
 */
function healTeam(game) {
  if (!game.saveManager) return;

  const team = game.saveManager.getTeam();
  team.forEach(pokemon => {
    if (pokemon && pokemon.stats) {
      pokemon.stats.hp = pokemon.stats.hpMax;
      pokemon.hp = pokemon.stats.hpMax;
    }
  });

  game.saveManager.save();
  game.ui.syncFromSaveManager();
  game.modernHUD?.showNotification('Ton équipe a été soignée !', 'success');

  // Afficher le tutoriel équipe si c'est la première fois
  if (game.tutorialSystem && team.length > 0) {
    game.tutorialSystem.showIfNotSeen('team');
  }
}

/**
 * Reçoit un Pokémon starter
 */
function receiveStarter(game, data) {
  if (!game.saveManager || !data.pokemon) return;

  const starterData = data.pokemon;

  // Créer le Pokémon
  const newPokemon = {
    uniqueId: `starter_${starterData.id}_${Date.now()}`,
    speciesId: starterData.id,
    surnom: starterData.name,
    nom: starterData.name,
    name: starterData.name,
    level: 5,
    niveau: 5,
    xp: 0,
    attaques: getStarterMoves(starterData.id),
    stats: calculateStarterStats(starterData.id, 5),
    hp: 0, // Sera mis à max après
  };
  newPokemon.hp = newPokemon.stats.hpMax;
  newPokemon.stats.hp = newPokemon.stats.hpMax;

  // Ajouter à l'équipe
  game.saveManager.registerPokemon(newPokemon);
  game.saveManager.addToTeam(newPokemon.uniqueId);

  // Mettre les flags
  game.saveManager.setFlag('starter_choisi', true);
  game.saveManager.setFlag('premier_pokemon', true);

  // Sauvegarder
  game.saveManager.save();

  // Sync UI
  game.ui.syncFromSaveManager();
  game.ui.unlockFeature('team');

  // ✅ FIX: Mettre à jour la variable pour les dialogues suivants
  if (game.modernDialogue) {
      game.modernDialogue.setVariable('POKEMON', starterData.name);
      console.log(`[ModernUI] Variable dialogue mise à jour: {POKEMON} = ${starterData.name}`);
  }

  // Notification
  game.modernHUD?.showNotification(`Tu as reçu ${starterData.name} !`, 'success');

  // Tutoriel premier Pokémon
  setTimeout(() => {
    game.tutorialSystem?.start('firstPokemon');
  }, 500);
}

/**
 * Reçoit le Pokédex
 */
function receivePokedex(game) {
  if (!game.saveManager) return;

  game.saveManager.setFlag('pokedex_obtenu', true);
  game.saveManager.save();

  game.ui.syncFromSaveManager();
  game.ui.unlockFeature('pokedex');

  game.modernHUD?.showNotification('Tu as reçu le Pokédex !', 'success');
}

/**
 * Démarre un combat de dresseur
 */
function startTrainerBattle(game, npc) {
  if (!game.combatManager || !npc) return;

  // Afficher l'alerte
  game.modernDialogue?.showTrainerAlert();

    // Déclencher le combat après un délai
  setTimeout(async () => { // Async pour spawn
    console.log('[Battle] Démarrage combat dresseur:', npc.nom);
    
    // 1. Préparer l'équipe du joueur
    // On prend le premier Pokémon non-KO
    const playerTeam = game.saveManager.getTeam();
    const playerPokemon = playerTeam.find(p => (p.hp || p.stats.hp) > 0);
    
    if (!playerPokemon) {
        game.modernHUD?.showNotification("Ton équipe est K.O. !", "error");
        return;
    }
    
    // 2. Préparer l'équipe adverse
    // npc.info.pokemon est censé être un tableau d'IDs ou d'objets {id, level}
    const enemyTeamIds = npc.info.pokemon || npc.info.equipe || [19]; // Fallback Rattata
    
    // 3. Spawner le premier Pokémon adverse
    if (game.combatManager && game.combatManager.pokemonManager) {
        const firstEnemyData = enemyTeamIds[0];
        let firstEnemyId = (typeof firstEnemyData === 'object') ? (firstEnemyData.id || firstEnemyData.pokemon) : firstEnemyData;
        let firstEnemyLevel = (typeof firstEnemyData === 'object') ? (firstEnemyData.level || firstEnemyData.niveau || 5) : 5;
        
        // Charger les données de base
        const baseData = game.combatManager.pokemonManager.pokemonDatabase.find(p => p.id == firstEnemyId);
        
        if (baseData) {
            // Créer l'entité visuelle
            const spawnPos = npc.mesh.position.clone().add(new THREE.Vector3(2, 0, 2)); // Position temporaire
            
            // Créer l'objet Pokémon complet
            const firstEnemyPokemon = {
                ...baseData,
                level: firstEnemyLevel,
                stats: game.combatManager.pokemonManager.calculateStats(baseData.stats, firstEnemyLevel)
            };
            // Init HP
            firstEnemyPokemon.stats.hp = firstEnemyPokemon.stats.hpMax;
            firstEnemyPokemon.hp = firstEnemyPokemon.stats.hpMax;
            firstEnemyPokemon.maxHp = firstEnemyPokemon.stats.hpMax;

            // Spawn
            const enemyEntity = await game.combatManager.pokemonManager.spawnPokemon(spawnPos, firstEnemyPokemon, true);
            
            if (enemyEntity) {
                enemyEntity.isTrainerPokemon = true;
                
                // 4. Lancer le combat via CombatManager
                // startCombat(playerPokemon, wildPokemon, playerPokemonEntity, trainer, enemyTeam)
                // Note: playerPokemonEntity sera géré/spawn par le CombatManager s'il est null ici, 
                // mais idéalement on devrait avoir l'entité du joueur déjà là ou recréée.
                // CombatManager s'attend à recevoir 'wildPokemon' comme entité active (enemyEntity)
                
                // On doit récupérer l'entité du joueur s'il en a une sortie ?
                // Sinon null, CombatManager la créera
                const playerEntity = null; 
                
                // Marquer le PNJ comme étant en combat pour éviter le spam de détection
                npc.isBattling = true;

                // Attacher le callback de victoire pour marquer le dresseur vaincu
                game.combatManager.onVictory = () => {
                     console.log(`🏆 Victoire contre ${npc.nom} !`);
                     npc.isDefeated = true;
                     npc.isBattling = false;
                     npc.isTrainer = false; // Plus de combat
                     
                     // Mettre à jour le NPCManager
                     if (game.npcManager) {
                         game.npcManager.defeatedTrainers.add(npc.id);
                         game.saveManager?.setFlag(`trainer_${npc.id}_defeated`, true);
                         game.npcManager.updateNPCIndicator(npc);
                     }
                     
                     // Nettoyer le callback
                     game.combatManager.onVictory = null;
                };
                
                // Attacher un callback de défaite/fuite pour reset le flag isBattling
                // Note: CombatManager n'a pas forcément de onDefeat exposé de la même manière,
                // mais on peut hooker endCombat si besoin. Pour l'instant on suppose que
                // si on perd, on respawn/reload.
                
                game.combatManager.startCombat(
                    playerPokemon, 
                    enemyEntity, 
                    playerEntity, 
                    npc, 
                    enemyTeamIds
                );
            }
        } else {
             console.error("Impossible de trouver les données du Pokémon ID:", firstEnemyId);
        }
    }
  }, 800);
}

/**
 * Configure les mises à jour automatiques de l'UI
 */
function setupUIUpdates(game) {
  // Observer les changements de données du joueur
  const originalSyncFromSaveManager = game.ui.syncFromSaveManager.bind(game.ui);
  game.ui.syncFromSaveManager = function() {
    originalSyncFromSaveManager();

    // Mettre à jour le HUD moderne
    if (game.modernHUD && game.saveManager?.saveData) {
      const player = game.saveManager.saveData.joueur;
      game.modernHUD.updatePlayerInfo(player.nom, player.argent);
      game.modernHUD.refresh();
    }
  };

  // Observer les déverrouillages de features
  const originalUnlockFeature = game.ui.unlockFeature.bind(game.ui);
  game.ui.unlockFeature = function(feature, showNotif = true) {
    originalUnlockFeature(feature, showNotif);

    // Rafraîchir le Pokégear moderne
    if (game.modernHUD) {
      game.modernHUD.refresh();
    }
  };

  // Remplacer showInteractionHint
  const originalShowHint = game.ui.showInteractionHint?.bind(game.ui);
  game.ui.showInteractionHint = function(text) {
    if (game.modernHUD) {
      game.modernHUD.showInteractionHint(text);
    }
    if (originalShowHint) originalShowHint(text);
  };

  const originalHideHint = game.ui.hideInteractionHint?.bind(game.ui);
  game.ui.hideInteractionHint = function() {
    if (game.modernHUD) {
      game.modernHUD.hideInteractionHint();
    }
    if (originalHideHint) originalHideHint();
  };
}

/**
 * Retourne les attaques de départ d'un starter
 */
function getStarterMoves(pokemonId) {
  const starterMoves = {
    1: ['charge', 'rugissement'], // Bulbizarre
    4: ['griffe', 'rugissement'], // Salamèche
    7: ['charge', 'mimi_queue'], // Carapuce
  };
  return starterMoves[pokemonId] || ['charge'];
}

/**
 * Calcule les stats d'un starter niveau 5
 */
function calculateStarterStats(pokemonId, level) {
  const baseStats = {
    1: { hp: 45, attack: 49, defense: 49, special: 65, speed: 45 }, // Bulbizarre
    4: { hp: 39, attack: 52, defense: 43, special: 60, speed: 65 }, // Salamèche
    7: { hp: 44, attack: 48, defense: 65, special: 50, speed: 43 }, // Carapuce
  };

  const base = baseStats[pokemonId] || { hp: 40, attack: 45, defense: 45, special: 45, speed: 45 };

  // Formule simplifiée Gen 1
  const calcStat = (baseStat) => Math.floor(((baseStat * 2) * level) / 100) + 5;
  const calcHP = (baseStat) => Math.floor(((baseStat * 2) * level) / 100) + level + 10;

  return {
    hp: calcHP(base.hp),
    hpMax: calcHP(base.hp),
    attack: calcStat(base.attack),
    defense: calcStat(base.defense),
    special: calcStat(base.special),
    speed: calcStat(base.speed),
  };
}

/**
 * Hook pour le combat: utilise l'UI moderne
 */
export function hookCombatUI(combatManager, uiManager) {
  const modernCombatUI = new ModernCombatUI(combatManager, uiManager);

  // ⚠️ UI ADAPTER PATTERN - Alternative au monkey patching direct
  // Au lieu de remplacer directement les méthodes, on utilise un adapter
  // Cela permet de garder le CombatManager testable et moins couplé
  combatManager.modernCombatUI = modernCombatUI;

  // Remplacer showCombatUI (TODO: Refactor vers Strategy Pattern)
  const originalShowCombatUI = combatManager.showCombatUI.bind(combatManager);
  combatManager.showCombatUI = function() {
    // En mode VR, utiliser l'original qui gère le VRBattlePanel
    const isVR = uiManager?.game?.renderer?.xr?.isPresenting;
    if (isVR) {
      originalShowCombatUI();
      return;
    }

    // Utiliser l'UI moderne au lieu de l'ancienne
    const isTrainer = !!combatManager.currentTrainer;
    modernCombatUI.show(
      combatManager.playerPokemon,
      combatManager.wildPokemon,
      isTrainer
    );
  };

  // Remplacer updateCombatUI
  combatManager.updateCombatUI = function() {
    modernCombatUI.updateHP();
  };

  // Remplacer hideCombatUI
  const originalHideCombatUI = combatManager.hideCombatUI?.bind(combatManager);
  combatManager.hideCombatUI = function() {
    modernCombatUI.hide();
    if (originalHideCombatUI) originalHideCombatUI();
  };

  // Intercepter endCombat pour cacher l'UI moderne
  const originalEndCombat = combatManager.endCombat.bind(combatManager);
  combatManager.endCombat = function(wasEscape = false) {
    // Cacher l'UI moderne AVANT d'appeler l'original
    modernCombatUI.hide();
    // Appeler la méthode originale
    originalEndCombat(wasEscape);
  };

  // Intercepter endCombatByCapture aussi
  if (combatManager.endCombatByCapture) {
    const originalEndCombatByCapture = combatManager.endCombatByCapture.bind(combatManager);
    combatManager.endCombatByCapture = function() {
      modernCombatUI.hide();
      originalEndCombatByCapture();
    };
  }

  // Exposer pour les mises à jour
  combatManager.modernCombatUI = modernCombatUI;

  return modernCombatUI;
}
