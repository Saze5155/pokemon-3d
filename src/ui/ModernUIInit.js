/**
 * ModernUIInit.js - Initialisation de l'UI moderne
 * Ce fichier facilite l'intégration des nouveaux modules UI
 */

import { ModernDialogueSystem } from './ModernDialogueSystem.js';
import { ModernCombatUI } from './ModernCombatUI.js';
import { ModernHUD } from './ModernHUD.js';
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

  // 6. Afficher le tutoriel de bienvenue si c'est une nouvelle partie
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
  setTimeout(() => {
    // Logique de combat dresseur à implémenter selon le jeu
    console.log('[Battle] Combat dresseur:', npc.nom);
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

  // Remplacer showCombatUI
  const originalShowCombatUI = combatManager.showCombatUI.bind(combatManager);
  combatManager.showCombatUI = function() {
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

  // Exposer pour les mises à jour
  combatManager.modernCombatUI = modernCombatUI;

  return modernCombatUI;
}
