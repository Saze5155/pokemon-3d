export class XPManager {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.pokemonDatabase = null;
    this.movesetDatabase = null;
    this.init();
  }

  async init() {
      // Les données sont chargées par SaveManager, on attend juste qu'elles soient dispos
      // ou on accède directement via uiManager.saveManager
  }

  /**
   * Calcule le gain d'XP après avoir vaincu un Pokémon
   */
  gainXP(playerPokemon, wildPokemon) {
    const isWild = true; 
    const a = isWild ? 1.0 : 1.5;
    const b = wildPokemon.xpBase || 64; 
    const L = wildPokemon.level || 5;
    
    // Formule
    const xpGain = Math.floor((a * b * L) / 7);

    // Ajouter l'XP
    if (!playerPokemon.xp) playerPokemon.xp = 0;
    const oldLevel = this.getLevel(playerPokemon.xp);
    
    playerPokemon.xp += xpGain;
    const newLevel = this.getLevel(playerPokemon.xp);

    console.log(`🎓 Gain XP: +${xpGain} (Total: ${playerPokemon.xp})`);

    let levelUp = false;
    let evolutionOccurred = false;

    if (newLevel > oldLevel) {
        levelUp = true;
        playerPokemon.level = newLevel;
        this.recalculateStats(playerPokemon);
        
        // Vérifier apprentissage d'attaques
        this.checkNewMoves(playerPokemon, newLevel);

        // Vérifier évolution
        evolutionOccurred = this.checkEvolution(playerPokemon);
    }

    return {
        xpGained: xpGain,
        leveledUp: levelUp,
        newLevel: newLevel,
        evolved: evolutionOccurred
    };
  }

  checkEvolution(pokemon) {
      // Utiliser la DB du SaveManager si dispo, sinon celle locale (vide maintenant)
      const db = this.uiManager.saveManager?.pokemonDatabase || this.pokemonDatabase;
      if (!db) return false;

      const speciesId = pokemon.speciesId || pokemon.id;
      // Note: pokemonDatabase dans SaveManager est un tableau [{id:1, ...}], pas un objet map
      // Mais dans XPManager init() c'était un JSON objet. 
      // SaveManager.pokemonDatabase est un array.
      // On va chercher dans le tableau.
      const speciesData = db.find(p => p.id == speciesId);

      if (speciesData && speciesData.evolution) {
          if (pokemon.level >= speciesData.evolution.niveau) {
              const newSpeciesId = speciesData.evolution.vers;
              const newSpeciesData = db.find(p => p.id == newSpeciesId);

              if (newSpeciesData) {
                  console.log(`✨ ${pokemon.nom} évolue en ${newSpeciesData.nom} !`);
                  
                  // Mettre à jour les données
                  const oldName = pokemon.nom;
                  pokemon.speciesId = newSpeciesId;
                  pokemon.species = newSpeciesData.nom;
                  pokemon.nom = newSpeciesData.nom; 
                  pokemon.name = newSpeciesData.nom;
                  pokemon.baseStats = newSpeciesData.stats;
                  pokemon.types = newSpeciesData.types;

                  this.uiManager.showDialogue(`Quoi ? ${oldName} évolue !`);
                  setTimeout(() => {
                      this.uiManager.showDialogue(`Félicitations ! Votre ${oldName} est devenu un ${newSpeciesData.nom} !`);
                      this.recalculateStats(pokemon); 
                      
                      // MAJ Pokedex
                      if (this.uiManager.playerData.pokedex && this.uiManager.playerData.pokedex.captures) {
                          if (!this.uiManager.playerData.pokedex.captures.includes(newSpeciesId)) {
                              this.uiManager.playerData.pokedex.captures.push(newSpeciesId);
                              this.uiManager.updatePokedex();
                              console.log(`📖 Pokedex mis à jour : ${newSpeciesData.nom} ajouté.`);
                          }
                      }
                      
                      // MAJ Team UI
                      this.uiManager.updateTeam();
                      this.uiManager.updateTeamSelector();
                      this.uiManager.saveGame(); // Sauvegarde auto
                  }, 2000);

                  return true;
              }
          }
      }
      return false;
  }

  checkNewMoves(pokemon, level) {
      const db = this.uiManager.saveManager?.movesetDatabase || this.movesetDatabase;
      if (!db) return;

      const speciesId = pokemon.speciesId || pokemon.id;
      const movesetData = db[speciesId];

      if (movesetData && movesetData.attaquesParNiveau) {
          const movesToLearn = movesetData.attaquesParNiveau[String(level)];
          
          if (movesToLearn && Array.isArray(movesToLearn)) {
              movesToLearn.forEach(moveName => {
                  this.learnMove(pokemon, moveName);
              });
          }
      }
  }
  
  learnMove(pokemon, moveName) {
      if (!pokemon.attaques) pokemon.attaques = [null, null, null, null];
      
      // Vérifier si déjà connue
      if (pokemon.attaques.includes(moveName)) return;

      console.log(`💡 ${pokemon.nom} veut apprendre ${moveName}`);
      
      // Chercher un slot vide
      const emptySlotIndex = pokemon.attaques.findIndex(m => m === null);
      
      if (emptySlotIndex !== -1) {
          pokemon.attaques[emptySlotIndex] = moveName;
          this.uiManager.showNotification(`${pokemon.nom} apprend ${moveName} !`);
          this.uiManager.showDialogue(`${pokemon.nom} apprend ${moveName} !`);
      } else {
          // Slot plein : NE PAS REMPLACER AUTO
          // Notification "Nouvelle attaque dispo"
          this.uiManager.showNotification(`Nouvelle attaque débloquée : ${moveName} !`);
          this.uiManager.showDialogue(`${pokemon.nom} a débloqué ${moveName}. Allez dans 'Équipe' pour l'équiper.`);
      }
  }

  getLevel(xp) {
    const level = Math.floor(Math.cbrt(xp));
    return Math.max(1, level); 
  }

  recalculateStats(pokemon) {
      const IV = 15;
      const EV = 0;
      const Level = pokemon.level;
      
      let stats = { hp: 45, attack: 49, defense: 49, special: 65, speed: 45 };
      if (this.pokemonDatabase && (pokemon.speciesId || pokemon.id)) {
          const data = this.pokemonDatabase[pokemon.speciesId || pokemon.id];
          if (data) stats = data.stats;
      } else if (pokemon.baseStats) {
          stats = pokemon.baseStats;
      }
      
      if (!pokemon.stats) pokemon.stats = {};

      pokemon.stats.hpMax = Math.floor((((stats.hp + IV) * 2 + (EV / 4)) * Level / 100) + Level + 10);
      
      ['attack', 'defense', 'special', 'speed'].forEach(statName => {
        const base = stats[statName];
        pokemon.stats[statName] = Math.floor((((base + IV) * 2 + (EV / 4)) * Level / 100) + 5);
      });

      console.log(`📈 Stats recalculées (Niv. ${Level}):`, pokemon.stats);
  }
}
