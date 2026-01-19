/**
 * SaveManager.js
 * Gère les sauvegardes du jeu Pokémon
 * - 3 slots de sauvegarde
 * - Sauvegarde/Chargement des données joueur
 * - Gestion des Pokémon capturés
 */

import { PATHS } from '../config/paths.js';
import { handleError, ErrorSeverity } from '../utils/ErrorHandler.js';

export class SaveManager {
  constructor() {
    this.currentSlot = null; // 1, 2 ou 3
    this.saveData = null;
    this.myPokemon = {};
    this.nextPokemonId = 1;

    // Données en mémoire
    this.allSaves = {
      sauvegarde_1: null,
      sauvegarde_2: null,
      sauvegarde_3: null,
    };

    this.allMyPokemon = {
      sauvegarde_1: {},
      sauvegarde_2: {},
      sauvegarde_3: {},
    };
  }

  /**
   * Initialise le SaveManager en chargeant les fichiers
   */
  async init() {
    try {
      // Charger les sauvegardes depuis le serveur (Cache busting)
      const saveResponse = await fetch(`${PATHS.API.LOAD_SAVE}?t=${Date.now()}`);
      if (saveResponse.ok) {
        this.allSaves = await saveResponse.json();
      }

      const pokemonResponse = await fetch(
        `${PATHS.API.LOAD_MYPOKEMON}?t=${Date.now()}`
      );
      if (pokemonResponse.ok) {
        this.allMyPokemon = await pokemonResponse.json();
      }

      // ✅ FIX: Charger la base de données des Pokémon pour les stats
      const dbResponse = await fetch(PATHS.DATA.POKEMON);
      if (dbResponse.ok) {
          const data = await dbResponse.json();
          // Convertir en tableau
          this.pokemonDatabase = Object.entries(data).map(([id, pokemon]) => ({
            id: parseInt(id),
            ...pokemon,
          }));
          console.log(`[SaveManager] DB Pokémon chargée: ${this.pokemonDatabase.length} entrées`);
      } else {
          console.warn("[SaveManager] Impossible de charger pokemons.json");
          this.pokemonDatabase = [];
      }

      // ✅ FIX: Charger les movesets pour l'apprentissage
      const movesetsResponse = await fetch(PATHS.DATA.MOVESETS);
      if (movesetsResponse.ok) {
          this.movesetDatabase = await movesetsResponse.json();
          console.log(`[SaveManager] Movesets chargés, ${Object.keys(this.movesetDatabase).length} entrées`);
      } else {
          console.warn("[SaveManager] Impossible de charger movesets.json");
          this.movesetDatabase = {};
      }

      // ✅ FIX: Charger les objets pour la boutique
      const itemsResponse = await fetch(PATHS.DATA.ITEMS);
      if (itemsResponse.ok) {
          this.itemsDatabase = await itemsResponse.json();
          console.log(`[SaveManager] Objets chargés`);
      } else {
          console.warn("[SaveManager] Impossible de charger objets.json");
          this.itemsDatabase = {};
      }

      console.log("[SaveManager] Sauvegardes chargées");
      return true;
    } catch (error) {
      handleError(
        error,
        ErrorSeverity.WARNING,
        'SaveManager.init'
      );
      console.warn("[SaveManager] Utilisation des valeurs par défaut");
      return false;
    }
  }

  /**
   * Retourne les infos des 3 slots pour l'écran de sélection
   */
  getSlotsInfo() {
    const slots = [];

    for (let i = 1; i <= 3; i++) {
      const key = `sauvegarde_${i}`;
      const save = this.allSaves[key];

      if (save) {
        // Récupérer les IDs des Pokémon de l'équipe
        const teamIds = save.equipe
          .filter((id) => id !== null)
          .map((uniqueId) => {
            const pokemon = this.allMyPokemon[key]?.[uniqueId];
            return pokemon?.speciesId || null;
          })
          .filter((id) => id !== null);

        slots.push({
          slot: i,
          empty: false,
          playerName: save.joueur.nom,
          badges: save.joueur.badges.filter((b) => b).length,
          pokedex: save.pokedex.captures.length,
          tempsJeu: this.formatPlayTime(save.joueur.tempsJeu),
          dateSauvegarde: save.dateSauvegarde,
          team: teamIds, // Ajouter les IDs d'espèce pour les sprites
        });
      } else {
        slots.push({
          slot: i,
          empty: true,
        });
      }
    }

    return slots;
  }

  setFlag(flagName, value = true) {
    if (!this.saveData || !this.saveData.drapeaux) return false;

    this.saveData.drapeaux[flagName] = value;
    console.log(`[SaveManager] Drapeau ${flagName} = ${value}`);
    return true;
  }

  // Méthode pour vérifier un drapeau
  getFlag(flagName) {
    if (!this.saveData || !this.saveData.drapeaux) return false;
    return this.saveData.drapeaux[flagName] || false;
  }

  // Méthode pour obtenir tous les drapeaux
  getFlags() {
    if (!this.saveData) return {};
    return this.saveData.drapeaux || {};
  }

  onStarterChosen(pokemonId) {
    this.setFlag("starter_choisi", true);
    this.setFlag("premier_pokemon", true);
    this.setFlag("pokedex_obtenu", true); // Le Prof donne le Pokédex

    // Créer le Pokémon starter
    const starter = this.createPokemon(pokemonId, 5, {
      lieu: "Labo Prof. Chen",
    });
    this.addToTeam(starter.uniqueId);

    return starter;
  }

  // Quand le rival est battu au laboratoire
  onRivalDefeatedLab() {
    this.setFlag("rival_battu_labo", true);
    this.setFlag("carte_obtenue", true); // Le joueur reçoit la carte
  }

  // Quand la livraison est faite
  onDeliveryComplete() {
    this.setFlag("livraison_chen_faite", true);
    this.setFlag("pokeballs_debloquees", true);

    // Donner 5 Poké Balls
    this.addItem("pokeballs", "pokeball", 5);
  }

  /**
   * Formate le temps de jeu en heures:minutes
   */
  formatPlayTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  /**
   * Crée une nouvelle partie
   */
  createNewGame(slot, playerName) {
    const key = `sauvegarde_${slot}`;
    const now = new Date().toISOString();

    // Générer un ID unique pour le dresseur
    const trainerId = Math.floor(Math.random() * 65536);

    this.allSaves[key] = {
      joueur: {
        nom: playerName,
        idDresseur: trainerId,
        argent: 3000,
        badges: [false, false, false, false, false, false, false, false],
        tempsJeu: 0,
        position: {
          map: "maisonetage",
          x: 5,
          y: 1.8,
          z: 5,
          direction: "south",
        },
      },
      equipe: [null, null, null, null, null, null],
      pc: [],
      sac: {
        pokeballs: {},
        soins: { potion: 1 },
        pierres: {},
        boosts: {},
        cles: [],
      },
      pokedex: {
        vus: [],
        captures: [],
      },
      drapeaux: {
        intro_complete: false,
        starter_choisi: false,
        rival_battu_labo: false,
        pokedex_obtenu: false, // Obtenu après avoir choisi le starter
        carte_obtenue: false, // Obtenue après avoir battu le rival au labo
        pokeballs_debloquees: false, // Débloquées après avoir battu le rival au labo
        premier_pokemon: false,
        livraison_chen_faite: false,
        rival_battu_route22: false,
        foret_jade_traversee: false,

        // Badges et objectifs majeurs
        badge_roche: false, // Pierre (Argenta)
      },
      dresseursVaincus: [], // Liste des IDs de dresseurs battus
      dateCreation: now,
      dateSauvegarde: now,
    };

    // Réinitialiser les Pokémon de ce slot
    this.allMyPokemon[key] = {};

    // Sélectionner ce slot
    this.currentSlot = slot;
    this.saveData = this.allSaves[key];
    this.myPokemon = this.allMyPokemon[key];
    this.nextPokemonId = 1;

    console.log(
      `[SaveManager] Nouvelle partie créée dans le slot ${slot} pour ${playerName}`
    );

    return this.saveData;
  }

  /**
   * Charge une partie existante
   */
  loadGame(slot) {
    const key = `sauvegarde_${slot}`;

    if (!this.allSaves[key]) {
      console.error(`[SaveManager] Slot ${slot} vide!`);
      return null;
    }

    this.currentSlot = slot;
    this.saveData = this.allSaves[key];
    this.myPokemon = this.allMyPokemon[key] || {};

    // Trouver le prochain ID disponible
    const ids = Object.keys(this.myPokemon).map((id) => parseInt(id));
    this.nextPokemonId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    console.log(`[SaveManager] Partie chargée depuis le slot ${slot}`);

    return this.saveData;
  }

  /**
   * Supprime une sauvegarde
   */
  async deleteGame(slot) {
    const key = `sauvegarde_${slot}`;

    this.allSaves[key] = null;
    this.allMyPokemon[key] = {};

    if (this.currentSlot === slot) {
      this.currentSlot = null;
      this.saveData = null;
      this.myPokemon = {};
    }

    await this.saveToServer();

    console.log(`[SaveManager] Slot ${slot} supprimé`);
  }

  /**
   * Met à jour la position du joueur dans la sauvegarde
   */
  updatePlayerPosition(sceneName, x, y, z, direction = "south") {
    if (!this.saveData || !this.saveData.joueur) return false;

    this.saveData.joueur.position = {
      map: sceneName,
      x: x,
      y: y,
      z: z,
      direction: direction,
    };

    return true;
  }

  /**
   * Sauvegarde la partie actuelle
   */
  async save(playerPosition = null) {
    if (!this.currentSlot || !this.saveData) {
      console.error("[SaveManager] Aucune partie en cours!");
      return false;
    }

    // Mettre à jour la position du joueur si fournie
    if (playerPosition) {
      this.updatePlayerPosition(
        playerPosition.map,
        playerPosition.x,
        playerPosition.y,
        playerPosition.z,
        playerPosition.direction
      );
    }

    const key = `sauvegarde_${this.currentSlot}`;

    // Mettre à jour la date de sauvegarde
    this.saveData.dateSauvegarde = new Date().toISOString();

    // Synchroniser
    this.allSaves[key] = this.saveData;
    this.allMyPokemon[key] = this.myPokemon;

    return await this.saveToServer();
  }

  /**
   * Envoie les données au serveur
   */
  async saveToServer() {
    try {
      // Debug payload
      const key = `sauvegarde_${this.currentSlot}`;
      console.log(`[SaveManager] Sauvegarde Slot ${this.currentSlot}...`);
      console.log(`[SaveManager] Pokemon à sauvegarder (Memory):`, Object.keys(this.myPokemon || {}));
      console.log(`[SaveManager] Pokemon à sauvegarder (Global):`, Object.keys(this.allMyPokemon[key] || {}));

      const response = await fetch(PATHS.API.SAVE_GAME, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          saves: this.allSaves,
          pokemon: this.allMyPokemon,
        }),
      });

      if (response.ok) {
        console.log("[SaveManager] Sauvegarde réussie!");
        return true;
      } else {
        handleError(
          new Error('Erreur serveur lors de la sauvegarde'),
          ErrorSeverity.ERROR,
          'SaveManager.saveToServer'
        );
        return false;
      }
    } catch (error) {
      handleError(error, ErrorSeverity.ERROR, 'SaveManager.saveToServer');
      // Fallback: sauvegarder en localStorage
      this.saveToLocalStorage();
      return false;
    }
  }

  /**
   * Fallback: sauvegarde en localStorage
   */
  saveToLocalStorage() {
    try {
      localStorage.setItem(PATHS.STORAGE.SAVES, JSON.stringify(this.allSaves));
      localStorage.setItem(
        PATHS.STORAGE.MY_POKEMON,
        JSON.stringify(this.allMyPokemon)
      );
      console.log("[SaveManager] Sauvegarde locale effectuée (localStorage)");
    } catch (e) {
      handleError(e, ErrorSeverity.ERROR, 'SaveManager.saveToLocalStorage');
    }
  }

  /**
   * Charge depuis localStorage (fallback)
   */
  loadFromLocalStorage() {
    try {
      const saves = localStorage.getItem(PATHS.STORAGE.SAVES);
      const pokemon = localStorage.getItem(PATHS.STORAGE.MY_POKEMON);

      if (saves) this.allSaves = JSON.parse(saves);
      if (pokemon) this.allMyPokemon = JSON.parse(pokemon);

      return true;
    } catch (e) {
      return false;
    }
  }

  // ==================== GESTION DU JOUEUR ====================

  /**
   * Met à jour la position du joueur
   */
  updatePosition(map, x, y, z, direction) {
    if (!this.saveData) return;

    this.saveData.joueur.position = { map, x, y, z, direction };
  }

  /**
   * Ajoute de l'argent
   */
  addMoney(amount) {
    if (!this.saveData) return;

    this.saveData.joueur.argent += amount;
    console.log(
      `[SaveManager] +${amount}¥ (Total: ${this.saveData.joueur.argent}¥)`
    );
  }

  /**
   * Retire de l'argent
   */
  removeMoney(amount) {
    if (!this.saveData) return false;

    if (this.saveData.joueur.argent < amount) {
      return false; // Pas assez d'argent
    }

    this.saveData.joueur.argent -= amount;
    return true;
  }

  /**
   * Obtient un badge
   */
  earnBadge(badgeIndex) {
    if (!this.saveData) return;
    if (badgeIndex < 0 || badgeIndex > 7) return;

    this.saveData.joueur.badges[badgeIndex] = true;
    const badgeNames = [
      "Boulder",
      "Cascade",
      "Thunder",
      "Rainbow",
      "Soul",
      "Marsh",
      "Volcano",
      "Earth",
    ];
    console.log(`[SaveManager] Badge ${badgeNames[badgeIndex]} obtenu!`);
  }

  /**
   * Incrémente le temps de jeu
   */
  addPlayTime(seconds) {
    if (!this.saveData) return;
    this.saveData.joueur.tempsJeu += seconds;
  }

  /**
   * Active un drapeau d'événement
   */
  setFlag(flagName, value = true) {
    if (!this.saveData) return;
    this.saveData.drapeaux[flagName] = value;
  }

  /**
   * Vérifie un drapeau
   */
  getFlag(flagName) {
    if (!this.saveData) return false;
    return this.saveData.drapeaux[flagName] || false;
  }

  // ==================== GESTION DES DRESSEURS VAINCUS ====================

  /**
   * Marque un dresseur comme vaincu (persiste dans la sauvegarde)
   */
  defeatTrainer(npcId) {
    if (!this.saveData) return;
    if (!this.saveData.dresseursVaincus) {
      this.saveData.dresseursVaincus = [];
    }
    if (!this.saveData.dresseursVaincus.includes(npcId)) {
      this.saveData.dresseursVaincus.push(npcId);
      console.log(`[SaveManager] Dresseur ${npcId} marqué comme vaincu`);
    }
  }

  /**
   * Vérifie si un dresseur a été vaincu
   */
  isTrainerDefeated(npcId) {
    if (!this.saveData || !this.saveData.dresseursVaincus) return false;
    return this.saveData.dresseursVaincus.includes(npcId);
  }

  /**
   * Retourne la liste des dresseurs vaincus
   */
  getDefeatedTrainers() {
    if (!this.saveData || !this.saveData.dresseursVaincus) return [];
    return this.saveData.dresseursVaincus;
  }

  // ==================== GESTION DU SAC ====================

  /**
   * Ajoute un objet au sac
   */
  addItem(category, itemId, quantity = 1) {
    if (!this.saveData) return;

    if (!this.saveData.sac[category]) {
      this.saveData.sac[category] = {};
    }

    if (!this.saveData.sac[category][itemId]) {
      this.saveData.sac[category][itemId] = 0;
    }

    this.saveData.sac[category][itemId] += quantity;
    console.log(`[SaveManager] +${quantity} ${itemId}`);
  }

  /**
   * Retire un objet du sac
   */
  removeItem(category, itemId, quantity = 1) {
    if (!this.saveData) return false;

    if (!this.saveData.sac[category] || !this.saveData.sac[category][itemId]) {
      return false;
    }

    if (this.saveData.sac[category][itemId] < quantity) {
      return false;
    }

    this.saveData.sac[category][itemId] -= quantity;

    // Supprimer si quantité = 0
    if (this.saveData.sac[category][itemId] <= 0) {
      delete this.saveData.sac[category][itemId];
    }

    return true;
  }

  /**
   * Vérifie la quantité d'un objet
   */
  getItemCount(category, itemId) {
    if (!this.saveData) return 0;

    if (!this.saveData.sac[category]) return 0;
    return this.saveData.sac[category][itemId] || 0;
  }

  /**
   * Ajoute un objet clé
   */
  addKeyItem(itemId) {
    if (!this.saveData) return;

    if (!this.saveData.sac.cles.includes(itemId)) {
      this.saveData.sac.cles.push(itemId);
      console.log(`[SaveManager] Objet clé obtenu: ${itemId}`);
    }
  }

  /**
   * Vérifie si on a un objet clé
   */
  hasKeyItem(itemId) {
    if (!this.saveData) return false;
    return this.saveData.sac.cles.includes(itemId);
  }

  // ==================== GESTION DU POKÉDEX ====================

  /**
   * Marque un Pokémon comme vu
   */
  registerSeen(speciesId) {
    if (!this.saveData) return;

    if (!this.saveData.pokedex.vus.includes(speciesId)) {
      this.saveData.pokedex.vus.push(speciesId);
      this.saveData.pokedex.vus.sort((a, b) => a - b);
      console.log(`[SaveManager] Pokémon #${speciesId} vu!`);
    }
  }

  /**
   * Marque un Pokémon comme capturé
   */
  registerCaught(speciesId) {
    if (!this.saveData) return;

    // Aussi vu si pas déjà
    this.registerSeen(speciesId);

    if (!this.saveData.pokedex.captures.includes(speciesId)) {
      this.saveData.pokedex.captures.push(speciesId);
      this.saveData.pokedex.captures.sort((a, b) => a - b);
      console.log(`[SaveManager] Pokémon #${speciesId} capturé!`);
    }
  }

  /**
   * Stats du Pokédex
   */
  getPokedexStats() {
    if (!this.saveData) return { vus: 0, captures: 0 };

    return {
      vus: this.saveData.pokedex.vus.length,
      captures: this.saveData.pokedex.captures.length,
    };
  }

  // ==================== BOUTIQUE ====================

  /**
   * Achète un objet
   */
  buyItem(itemId, quantity, price) {
    console.log(`[SaveManager] Tentative d'achat: ${quantity}x ${itemId} à ${price}₽`);
    const totalCost = price * quantity;
    if (this.saveData.joueur.argent < totalCost) {
        console.warn(`[SaveManager] Pas assez d'argent: ${this.saveData.joueur.argent} < ${totalCost}`);
        return false;
    }

    this.saveData.joueur.argent -= totalCost;
    console.log(`[SaveManager] Argent restant: ${this.saveData.joueur.argent}`);
    
    this.addItem(itemId, quantity);
    this.save();
    return true;
  }

  /**
   * Vend un objet
   */
  sellItem(itemId, quantity, price) {
    if (!this.hasItem(itemId, quantity)) return false;

    const totalGain = price * quantity;
    this.saveData.joueur.argent += totalGain;
    this.removeItem(itemId, quantity);
    this.save();
    return true;
  }

  /**
   * Vérifie si le joueur possède un objet
   */
  hasItem(itemId, quantity = 1) {
    const category = this.getItemCategory(itemId);
    if (!category) return false;
    return this.getItemCount(category, itemId) >= quantity;
  }

  /**
   * Ajoute un objet au sac
   */
  addItem(itemId, quantity) {
    const category = this.getItemCategory(itemId);
    console.log(`[SaveManager] Ajout item: ${itemId} (Cat: ${category})`);
    
    if (!category) return;

    if (!this.saveData.sac[category]) {
        console.log(`[SaveManager] Création catégorie sac: ${category}`);
        this.saveData.sac[category] = {};
    }
    
    if (!this.saveData.sac[category][itemId]) this.saveData.sac[category][itemId] = 0;

    this.saveData.sac[category][itemId] += quantity;
    console.log(`[SaveManager] Nouveau stock ${itemId}: ${this.saveData.sac[category][itemId]}`);
  }

  /**
   * Surcharge de removeItem pour supporter l'appel avec juste (itemId, quantity)
   * ou l'ancien (category, itemId, quantity)
   */
  removeItem(arg1, arg2, arg3) {
    let category, itemId, quantity;

    if (arg3 !== undefined) {
        // Ancien format: category, itemId, quantity
        category = arg1;
        itemId = arg2;
        quantity = arg3;
    } else {
        // Nouveau format: itemId, quantity
        itemId = arg1;
        quantity = arg2;
        category = this.getItemCategory(itemId);
    }
    
    if (!this.saveData.sac[category] || !this.saveData.sac[category][itemId]) return false;
    
    this.saveData.sac[category][itemId] -= quantity;
    if (this.saveData.sac[category][itemId] <= 0) delete this.saveData.sac[category][itemId];
    
    return true;
  }


  getItemCategory(itemId) {
    if (itemId.includes("ball")) return "pokeballs";
    if (itemId.includes("potion") || itemId.includes("soin") || itemId.includes("guerison") || itemId.includes("rappel") || itemId.includes("anti") || itemId.includes("lait") || itemId.includes("eau") || itemId.includes("soda") || itemId.includes("limonade")) return "soins";
    if (itemId.includes("pierre")) return "pierres";
    if (itemId.includes("plus") || itemId.includes("spec")) return "boosts_combat";
    if (itemId.includes("repousse")) return "repousses";
    if (itemId.includes("canne")) return "peche";
    return "divers"; 
  }

  // ==================== GESTION DES POKÉMON ====================

  /**
   * Crée un nouveau Pokémon (capture ou starter)
   */
  createPokemon(speciesId, level, options = {}) {
    const pokemon = {
      uniqueId: this.nextPokemonId++,
      speciesId: speciesId,
      surnom: options.surnom || null,
      niveau: level,
      xp: this.calculateXpForLevel(level),
      xpNextLevel: this.calculateXpForLevel(level + 1),
      stats:
        options.stats || this.calculateStats(speciesId, level, options.ivs),
      ivs: options.ivs || this.generateRandomIVs(),
      evs: {
        hp: 0,
        attack: 0,
        defense: 0,
        special: 0,
        speed: 0,
      },
      attaques: options.attaques || this.getStartingMoves(speciesId, level),
      ppActuels: [],
      ppMax: [],
      objetTenu: null,
      statut: null,
      bonheur: 70,
      pokeball: options.pokeball || "pokeball",
      isShiny: options.isShiny || Math.random() < 1 / 8192,
      DO: this.saveData?.joueur.nom || "???",
      idDO: this.saveData?.joueur.idDresseur || 0,
      rencontre: {
        lieu: options.lieu || "Inconnu",
        niveau: level,
        date: new Date().toISOString(),
      },
      name: (this.pokemonDatabase && this.pokemonDatabase.find(p => p.id == speciesId)?.nom) || "Pokémon " + speciesId,
    };

    // Initialiser les PP
    pokemon.ppActuels = pokemon.attaques.map((move) =>
      move ? this.getMovePP(move) : 0
    );
    pokemon.ppMax = [...pokemon.ppActuels];

    // Stocker le Pokémon (Forcer clé string pour cohérence)
    this.myPokemon[String(pokemon.uniqueId)] = pokemon;

    // Mettre à jour le Pokédex
    this.registerCaught(speciesId);

    console.log(
      `[SaveManager] Pokémon créé: #${speciesId} Lv.${level} (ID: ${pokemon.uniqueId})`
    );

    return pokemon;
  }

  /**
   * Génère des IVs aléatoires (0-15 en Gen 1)
   */
  generateRandomIVs() {
    return {
      hp: Math.floor(Math.random() * 16),
      attack: Math.floor(Math.random() * 16),
      defense: Math.floor(Math.random() * 16),
      special: Math.floor(Math.random() * 16),
      speed: Math.floor(Math.random() * 16),
    };
  }

  /**
   * Calcule les stats d'un Pokémon
   * Formule Gen 1
   */
  calculateStats(speciesId, level, ivs) {
    // TODO: Charger les stats de base depuis pokemons.json
    // Pour l'instant, stats par défaut
    const baseData = this.pokemonDatabase ? this.pokemonDatabase.find((p) => p.id == speciesId) : null;
    
    // Fallback si baseData n'existe pas ou si stats manquantes
    let baseStats = baseData ? baseData.base : null;
    if (!baseStats && baseData) {
        // Gérer le cas où les stats sont à la racine (format parfois différent)
        baseStats = {
           hp: baseData.hp,
           attack: baseData.attack,
           defense: baseData.defense,
           special: baseData.special,
           speed: baseData.speed
        };
    }
    
    // Fallback ultime
    if (!baseStats || baseStats.hp === undefined) {
         console.warn(`[SaveManager] Stats manquantes pour ID ${speciesId}, utilisation défaut`);
         baseStats = this.getBaseStats(speciesId);
    }

    ivs = ivs || this.generateRandomIVs();
    const evs = { hp: 0, attack: 0, defense: 0, special: 0, speed: 0 };

    // Formule Gen 1 pour HP
    const hp =
      Math.floor(
        (((baseStats.hp + ivs.hp) * 2 + Math.floor(Math.sqrt(evs.hp) / 4)) *
          level) /
          100
      ) +
      level +
      10;

    // Formule Gen 1 pour les autres stats
    const calcStat = (base, iv, ev) => {
      return (
        Math.floor(
          (((base + iv) * 2 + Math.floor(Math.sqrt(ev) / 4)) * level) / 100
        ) + 5
      );
    };

    return {
      hp: hp,
      hpMax: hp,
      attack: calcStat(baseStats.attack, ivs.attack, evs.attack),
      defense: calcStat(baseStats.defense, ivs.defense, evs.defense),
      special: calcStat(baseStats.special, ivs.special, evs.special),
      speed: calcStat(baseStats.speed, ivs.speed, evs.speed),
    };
  }

  /**
   * Récupère les stats de base d'une espèce
   * TODO: Charger depuis pokemons.json
   */
  getBaseStats(speciesId) {
    // Stats par défaut des starters pour le moment
    const defaultStats = {
      1: { hp: 45, attack: 49, defense: 49, special: 65, speed: 45 }, // Bulbizarre
      4: { hp: 39, attack: 52, defense: 43, special: 60, speed: 65 }, // Salamèche
      7: { hp: 44, attack: 48, defense: 65, special: 50, speed: 43 }, // Carapuce
    };

    return (
      defaultStats[speciesId] || {
        hp: 50,
        attack: 50,
        defense: 50,
        special: 50,
        speed: 50,
      }
    );
  }

  /**
   * Calcule l'XP pour un niveau (courbe Medium Slow par défaut)
   */
  calculateXpForLevel(level) {
    // Formule Medium Slow (la plus commune)
    return Math.floor(
      (6 / 5) * Math.pow(level, 3) - 15 * Math.pow(level, 2) + 100 * level - 140
    );
  }

  /**
   * Récupère les attaques de départ d'un Pokémon
   * TODO: Charger depuis movesets.json
   */
  getStartingMoves(speciesId, level) {
    // Attaques par défaut des starters
    const defaultMoves = {
      1: ["charge", "rugissement"], // Bulbizarre
      4: ["griffe", "rugissement"], // Salamèche
      7: ["charge", "mimi_queue"], // Carapuce
    };

    const moves = defaultMoves[speciesId] || ["charge"];

    // Compléter avec null jusqu'à 4
    while (moves.length < 4) {
      moves.push(null);
    }

    return moves.slice(0, 4);
  }

  /**
   * Récupère les PP max d'une attaque
   * TODO: Charger depuis attaques.json
   */
  getMovePP(moveId) {
    const defaultPP = {
      charge: 35,
      griffe: 35,
      rugissement: 40,
      mimi_queue: 30,
      flammeche: 25,
      pistolet_a_o: 25,
      fouet_lianes: 25,
    };

    return defaultPP[moveId] || 20;
  }

  /**
   * Récupère un Pokémon par son ID unique
   */
  getPokemon(uniqueId) {
    const p = this.myPokemon[uniqueId] || this.myPokemon[String(uniqueId)] || null;
    if (p) {
        // Auto-repair name if missing or generic
        if ((!p.name || p.name.startsWith("Pokémon ") || p.name === "???") && this.pokemonDatabase) {
             const base = this.pokemonDatabase.find(db => db.id == p.speciesId);
             if (base && base.nom) {
                 p.name = base.nom;
                 console.log(`[SaveManager] Nom réparé pour ${uniqueId}: ${p.name}`);
             }
        }
    }
    return p;
  }

  /**
   * Trouve les pré-évolutions d'une espèce (pour le Move Relearner)
   * Retourne [id_base, id_intermediaire] etc.
   */
  getPreEvolutions(speciesId) {
      if (!this.pokemonDatabase) return [];
      
      const ancestors = [];
      let currentId = speciesId;
      let found = true;
      
      // Sécurité anti-boucle
      let attempts = 0;
      
      while(found && attempts < 10) {
          found = false;
          attempts++;
          
          // Chercher qui évolue vers currentId
          // C'est lourd (scan tout le tableau), mais ça va pour une action UI rare
          for (const p of this.pokemonDatabase) {
              if (p.evolution && p.evolution.vers == currentId) {
                  ancestors.unshift(p.id); // Ajouter au début (ordre chrono)
                  currentId = p.id;
                  found = true;
                  break; 
              }
          }
      }
      return ancestors;
  }

  /**
   * Met à jour un Pokémon
   */
  updatePokemon(uniqueId, updates) {
    if (!this.myPokemon[uniqueId]) return false;

    Object.assign(this.myPokemon[uniqueId], updates);
    return true;
  }

  /**
   * Ajoute un Pokémon à l'équipe
   */
  addToTeam(uniqueId) {
    if (!this.saveData) return false;

    // Trouver un slot libre (soit null, soit nouvelle case si < 6)
    let freeSlot = this.saveData.equipe.findIndex((slot) => slot === null);
    
    // Si pas de trou mais que l'équipe n'est pas complète, on prend la suite
    if (freeSlot === -1 && this.saveData.equipe.length < 6) {
        freeSlot = this.saveData.equipe.length;
    }

    if (freeSlot === -1) {
      // Équipe pleine (6 Pokémon et aucun slot null), envoyer au PC
      this.addToPC(uniqueId);
      return false;
    }

    this.saveData.equipe[freeSlot] = uniqueId;
    console.log(
      `[SaveManager] Pokemon ${uniqueId} ajouté à l'équipe (slot ${freeSlot})`
    );
    console.log("[SaveManager] Equipe après ajout:", JSON.stringify(this.saveData.equipe));
    return true;
  }

  /**
   * Retire un Pokémon de l'équipe
   */
  removeFromTeam(uniqueId) {
    if (!this.saveData) return false;

    // Trouver l'index (support string/int mixed)
    const index = this.saveData.equipe.findIndex(id => id == uniqueId);
    if (index === -1) return false;

    // Vérifier qu'on garde au moins 1 Pokémon
    const teamCount = this.saveData.equipe.filter((id) => id !== null).length;
    if (teamCount <= 1) {
      console.warn(
        "[SaveManager] Impossible de retirer le dernier Pokémon de l'équipe!"
      );
      return false;
    }

    this.saveData.equipe[index] = null;
    console.log(`[SaveManager] Pokemon ${uniqueId} retiré de l'équipe (Index: ${index})`);
    return true;
  }

  /**
   * Ajoute un Pokémon au PC
   */
  addToPC(uniqueId) {
    if (!this.saveData) return;

    if (!this.saveData.pc.includes(uniqueId)) {
      this.saveData.pc.push(uniqueId);
      console.log(`[SaveManager] Pokémon ${uniqueId} envoyé au PC`);
    }
  }

  /**
   * Retire un Pokémon du PC
   */
  removeFromPC(uniqueId) {
    if (!this.saveData) return;

    const index = this.saveData.pc.findIndex(id => id == uniqueId);
    if (index !== -1) {
      this.saveData.pc.splice(index, 1);
      console.log(`[SaveManager] Pokemon ${uniqueId} retiré du PC (Index: ${index})`);
    } else {
      console.warn(`[SaveManager] ECHEC suppression PC: ID ${uniqueId} non trouvé`);
    }
  }

  /**
   * Échange deux Pokémon dans l'équipe
   */
  swapTeamSlots(slot1, slot2) {
    if (!this.saveData) return;

    const temp = this.saveData.equipe[slot1];
    this.saveData.equipe[slot1] = this.saveData.equipe[slot2];
    this.saveData.equipe[slot2] = temp;
  }

  /**
   * Récupère l'équipe complète avec les données des Pokémon
   */
  getTeam() {
    if (!this.saveData) return [];

    return this.saveData.equipe
      .map((id) => (id ? this.getPokemon(id) : null))
      .filter((p) => p !== null);
  }

  /**
   * Récupère le premier Pokémon valide de l'équipe (non KO)
   */
  getFirstAlivePokemon() {
    const team = this.getTeam();
    return team.find((p) => p.stats.hp > 0) || null;
  }

  /**
   * Soigne toute l'équipe (Centre Pokémon)
   */
  healTeam() {
    const team = this.getTeam();

    team.forEach((pokemon) => {
      // Restaurer les PV (format standardisé)
      pokemon.stats.hp = pokemon.stats.hpMax;

      // Restaurer les PP
      pokemon.ppActuels = [...pokemon.ppMax];

      // Soigner le statut
      pokemon.statut = null;
    });
    
    this.save();
    console.log("[SaveManager] Équipe soignée et sauvegardée !");
  }

  // ==================== UTILITAIRES ====================

  /**
   * Exporte la sauvegarde actuelle (pour debug ou backup)
   */
  exportSave() {
    if (!this.currentSlot) return null;

    return {
      slot: this.currentSlot,
      save: this.saveData,
      pokemon: this.myPokemon,
    };
  }

  /**
   * Importe une sauvegarde
   */
  importSave(data, slot) {
    const key = `sauvegarde_${slot}`;

    this.allSaves[key] = data.save;
    this.allMyPokemon[key] = data.pokemon;

    console.log(`[SaveManager] Sauvegarde importée dans le slot ${slot}`);
  }
}
