import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * PokemonManager - AVEC FIX INTÉGRÉ
 */
export class PokemonManager {
  constructor(scene, worldManager) {
    this.scene = scene;
    this.worldManager = worldManager;
    this.pokemons = [];
    this.encounterDistance = 2;
    this.pokemonDatabase = null;
  }

  async initialize() {
    try {
      const response = await fetch("data/pokemons.json");
      const data = await response.json();

      // ✅ Convertir l'objet en tableau
      this.pokemonDatabase = Object.entries(data).map(([id, pokemon]) => ({
        id: parseInt(id),
        name: pokemon.nom, // Alias pour compatibilité
        ...pokemon,
      }));

    } catch (error) {
      console.error("❌ Erreur chargement pokemons.json:", error);
      this.pokemonDatabase = [];
    }
  }
  async spawnPokemonInActiveZones(playerPosition = null) {
    if (!this.worldManager || !this.worldManager.loadedZones) return;
    if (!this.pokemonDatabase) return;

    for (const zoneName of this.worldManager.loadedZones) {
      await this.spawnPokemonInZone(zoneName, playerPosition);
    }

    // FIX: Gestion des scènes autonomes (ex: Foret Jade) qui ne sont pas dans loadedZones
    if (this.scene && this.scene.userData?.zoneData) {
        const zoneData = this.scene.userData.zoneData;
        const spawnZones = zoneData.entities?.spawnZones || zoneData.spawnZones || [];

        if (spawnZones.length > 0) {
            console.log(`🌿 PokemonManager: Tentative de spawn dans scène autonome (${zoneData.name || 'unknown'}), ${spawnZones.length} zones de spawn`);
            for (const spawnZone of spawnZones) {
                await this.spawnInZone(spawnZone, this.scene, "active_scene", playerPosition);
            }
        } else {
            console.log(`⚠️ PokemonManager: Scène autonome (${zoneData.name || 'unknown'}) n'a pas de zones de spawn`);
        }
    }
  }

  async spawnPokemonInZone(zoneName, playerPosition = null) {
    const zoneGroup = this.worldManager.zoneGroups.get(zoneName);
    if (!zoneGroup || !zoneGroup.userData.zoneData) {
        // console.warn(`Skipping spawn for ${zoneName}: No zone data`);
        return;
    }

    const zoneData = zoneGroup.userData.zoneData;
    const spawnZones = zoneData.entities?.spawnZones || zoneData.spawnZones || [];

    if (spawnZones.length === 0) return;


    for (const spawnZone of spawnZones) {
      await this.spawnInZone(spawnZone, zoneGroup, zoneName, playerPosition);
    }
  }

  async spawnInZone(spawnZone, zoneGroup, zoneName, playerPosition = null) {
    // DISTANCE CHECK
    if (playerPosition) {
        const zgPos = zoneGroup.position;
        const cX = zgPos.x + (spawnZone.center?.x || 0);
        const cZ = zgPos.z + (spawnZone.center?.z || 0);
        const dist = Math.sqrt(Math.pow(playerPosition.x - cX, 2) + Math.pow(playerPosition.z - cZ, 2));
        
        
        if (dist > 50) {
             return;
        }
    }

    const centerX = spawnZone.center?.x || 0;
    const centerZ = spawnZone.center?.z || 0;
    const width = spawnZone.size?.width || 10;
    const depth = spawnZone.size?.depth || 10;
    const pokemonCount = spawnZone.pokemonCount || 3;
    const pokemonList = spawnZone.pokemons || [];
    const zoneOffset = zoneGroup.position;

    if (pokemonList.length === 0) return;

    // Nettoyage préalable
    const existing = this.countPokemonsInZone(spawnZone, zoneGroup);
    
    // Check global limit
    if (this.pokemons.length >= 20) return;
    
    const MAX_POKEMON_PER_ZONE = 3;
    const countToSpawn = Math.min(pokemonCount, MAX_POKEMON_PER_ZONE) - existing;

    if (countToSpawn <= 0) return;

    let spawned = 0;
    let attempts = 0;
    const maxAttempts = countToSpawn * 15;
    const collisionObjects = this.worldManager.getCollisionObjects(); // Get ALL objects for safety

    while (spawned < countToSpawn && attempts < maxAttempts) {
      attempts++;

      const localX = centerX + (Math.random() - 0.5) * width;
      const localZ = centerZ + (Math.random() - 0.5) * depth;

      // GLOBAL COORDINATES
      const worldPos = new THREE.Vector3(
        zoneOffset.x + localX,
        0,
        zoneOffset.z + localZ
      );

      // CRITICAL: Get Height
      const terrainHeight = this.worldManager.getTerrainHeight(worldPos.x, worldPos.z);
      
      // Si height est 0, c'est suspect (sauf si on est vraiment à 0)
      // On va logger si ça fail à cause de la hauteur
      // if (terrainHeight === 0) console.warn(`Height 0 detected at ${worldPos.x}, ${worldPos.z}`);

      worldPos.y = terrainHeight + 0.35;

       if (!this.checkSpawnCollision(worldPos, collisionObjects)) {
        const pokemonData = this.selectPokemon(pokemonList);

        if (pokemonData) {
          // FORCE SPAWN (True) pour debugger Route 2
          const pokemon = await this.spawnPokemon(worldPos, pokemonData, true);
          if (pokemon) {
            spawned++;
          }
        }
      }
    }
    
  }

  countPokemonsInZone(spawnZone, zoneGroup) {
    let count = 0;
    const zonePos = zoneGroup.position;
    const centerX = zonePos.x + (spawnZone.center?.x || 0);
    const centerZ = zonePos.z + (spawnZone.center?.z || 0);
    const width = spawnZone.size?.width || 10;
    const depth = spawnZone.size?.depth || 10;
    const radius = Math.max(width, depth) / 2;

    this.scene.traverse((child) => {
      if (child.userData?.isPokemon) {
        // Vérifier si dans la zone
        const dist = Math.sqrt(
          Math.pow(child.position.x - centerX, 2) + 
          Math.pow(child.position.z - centerZ, 2)
        );
        if (dist < radius) count++;
      }
    });
    return count;
  }

  static cleanScene(scene) {
    const toRemove = [];
    scene.traverse((child) => {
      if (child.userData?.isPokemon) {
        toRemove.push(child);
      }
    });

    toRemove.forEach(mesh => {
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
        else mesh.material.dispose();
      }
    });
  }

  selectPokemon(pokemonList) {
    if (!pokemonList || pokemonList.length === 0) {
      console.warn("⚠️ Liste de Pokémon vide");
      return null;
    }

    const totalWeight = pokemonList.reduce(
      (sum, p) => sum + (p.weight || p.spawnRate || 1),
      0
    );

    let random = Math.random() * totalWeight;

    for (const pokemonEntry of pokemonList) {
      const weight = pokemonEntry.weight || pokemonEntry.spawnRate || 1;
      random -= weight;

      if (random <= 0) {
        const fullData = this.pokemonDatabase.find(
          (p) => p.id === pokemonEntry.id
        );

        if (fullData) {
          return {
            ...fullData,
            minLevel: pokemonEntry.minLevel || 5,
            maxLevel: pokemonEntry.maxLevel || 10,
            spawnRate: weight,
          };
        } else {
          console.warn(
            `⚠️ Pokémon #${pokemonEntry.id} non trouvé dans la base`
          );
        }
      }
    }

    const fallback = pokemonList[0];
    const fullData = this.pokemonDatabase.find((p) => p.id === fallback.id);

    if (fullData) {
      return {
        ...fullData,
        minLevel: fallback.minLevel || 5,
        maxLevel: fallback.maxLevel || 10,
        spawnRate: fallback.weight || fallback.spawnRate || 1,
      };
    }

    return null;
  }

  async spawnPokemon(position, pokemonData, force = false) {
    if (!pokemonData) return null;

    // FIX: Utiliser le niveau fourni si présent (pour les dresseurs)
    let level = pokemonData.level;
    
    if (!level) {
        // SCALING: Niveau sauvage basé sur le joueur si dispo
        let scaled = false;
        if (this.uiManager?.playerData?.team?.length > 0) {
           const team = this.uiManager.playerData.team.filter(p => p && p.level);
           if (team.length > 0) {
               const playerAvg = Math.round(team.reduce((sum, p) => sum + (p.level || 5), 0) / team.length);
               // Scaling: Moyenne -3 à +1 (un peu plus faible que le joueur pour que ce soit farmable)
               const min = Math.max(2, playerAvg - 3);
               const max = Math.max(min, playerAvg + 1);
               level = Math.floor(Math.random() * (max - min + 1)) + min;
               scaled = true;
           }
        }

        if (!scaled) {
          const min = pokemonData.minLevel || 5;
          const max = pokemonData.maxLevel || 10;
          level = Math.floor(Math.random() * (max - min + 1)) + min;
        }
    }

    // Vérification collision seulement si pas forcé
    if (!force) {
        // Obtenir les collisions potentiels
        const zoneGroup = this.worldManager ? this.worldManager.zoneGroups.get(this.worldManager.activeZone?.scene || "world") : this.scene;
        const collisionObjects = zoneGroup ? this.getZoneCollisionObjects(zoneGroup) : [];
        
        if (this.checkSpawnCollision(position, collisionObjects)) {
            console.warn(`⚠️ Spawn annulé pour ${pokemonData.name}: Collision`);
            return null;
        }
    }

    const pokemon = new WildPokemon(
      this.scene,
      pokemonData,
      position,
      level,
      this.worldManager
    );

    await pokemon.loadModel();
    this.pokemons.push(pokemon);

    return pokemon;
  }

  getZoneCollisionObjects(zoneGroup) {
    const objects = [];
    zoneGroup.traverse((child) => {
      if (
        child.isMesh &&
        (child.userData?.hasCollision || child.name.includes("_flange"))
      ) {
        objects.push(child);
      }
    });
    return objects;
  }

  checkSpawnCollision(position, collisionObjects, minRadius = 1.5) {
    const spawnSphere = new THREE.Sphere(position, minRadius);

    for (const obj of collisionObjects) {
      const box = new THREE.Box3().setFromObject(obj);
      if (box.intersectsSphere(spawnSphere)) {
        return true;
      }
    }

    for (const pokemon of this.pokemons) {
      if (pokemon.model) {
        const dist = pokemon.model.position.distanceTo(position);
        if (dist < minRadius * 2) {
          return true;
        }
      }
    }

    return false;
  }

  update(delta, playerPosition) {
    if (!playerPosition) return;

    const collisionObjects = this.worldManager
      ? this.worldManager.getCollisionObjects()
      : [];

    // OPTIMISATION: Parcourir à l'envers pour pouvoir supprimer des éléments (Despawn)
    for (let i = this.pokemons.length - 1; i >= 0; i--) {
        const pokemon = this.pokemons[i];
        
        // Calcul distance
        const dist = pokemon.getDistanceToPlayer(playerPosition);
        
        // 1. CULLING: Si trop loin (> 60m), on despawn pour libérer la mémoire (sauf si combat/dresseur)
        if (dist > 60 && !pokemon.inCombat && !pokemon.isTrainerPokemon) {
            pokemon.remove(); // Nettoyage 3D
            this.pokemons.splice(i, 1);
            continue;
        }

        // 2. OPTIMISATION UPDATE: Si assez loin (> 40m), on ne met pas à jour l'IA (mouvement, etc)
        if (dist > 40 && !pokemon.inCombat) {
            continue; 
        }

        // Sinon update normal
        pokemon.update(delta, playerPosition, collisionObjects);
    }

    // SPAWN SYSTEM (2s interval)
    if (!this.lastSpawnCheck || Date.now() - this.lastSpawnCheck > 2000) {
        this.lastSpawnCheck = Date.now();
        this.spawnPokemonInActiveZones(playerPosition).catch(e => {});
    }

    this.checkEncounters(playerPosition);
  }

  checkEncounters(playerPosition) {
    for (const pokemon of this.pokemons) {
      // FIX: Ignorer les Pokémon de dresseurs (qui ne sont pas sauvages)
      if (pokemon.isTrainerPokemon) continue;

      const distance = pokemon.getDistanceToPlayer(playerPosition);

      if (distance < this.encounterDistance && !pokemon.inCombat) {
        // TODO: triggerEncounter should be provided as a callback
        // this.triggerEncounter(pokemon);
        if (this.onEncounter) {
          this.onEncounter(pokemon);
        }
        break;
      }
    }
  }

  removePokemon(pokemon) {
    const index = this.pokemons.indexOf(pokemon);
    if (index > -1) {
      this.pokemons.splice(index, 1);
      pokemon.remove();
    }
  }

  clearAll() {
    this.pokemons.forEach((p) => p.remove());
    this.pokemons = [];
  }

  // Méthode utilitaire pour calculer les stats d'un Pokémon (utilisée par CombatManager)
  calculateStats(baseStats, level) {
    const baseFn = (statName) => {
        if (baseStats && baseStats[statName]) return baseStats[statName];
        return 50; // Moyenne par défaut
    };

    const attack = baseFn('attack');
    const defense = baseFn('defense');
    const speed = baseFn('speed');
    const special = baseFn('special');
    const hp = baseFn('hp');

    // Formule simple Gen 1 (sans EVs)
    // Stat = floor(((Base * 2 + IV) * Level) / 100) + 5
    const calc = (base) => Math.floor(((base * 2 + 15) * level) / 100) + 5;
    
    // HP spécial : floor(((Base * 2 + IV) * Level) / 100) + Level + 10
    const hpMax = Math.floor(((hp * 2 + 15) * level) / 100) + level + 10;

    return {
        hp: hpMax,
        hpMax: hpMax,
        attack: calc(attack),
        defense: calc(defense),
        speed: calc(speed),
        special: calc(special),
        level: level
    };
  }
}

/**
 * WildPokemon - AVEC FIX MATERIAL INTÉGRÉ
 */
class WildPokemon {
  constructor(scene, pokemonData, position, level, worldManager) {
    this.scene = scene;
    this.pokemonData = pokemonData;
    this.position = position.clone();
    this.level = level;
    this.worldManager = worldManager;

    this.model = null;
    this.species = pokemonData.nom || pokemonData.name;
    // FIX: Aliases pour la compatibilité avec UI/CombatManager
    this.name = this.species;
    this.nom = this.species;
    
    this.collisionRadius = 0.5;

    this.maxHp = this.calculateHP(pokemonData, level);
    this.hp = this.maxHp;
    
    // CALCUL DES STATS (Pour le combat)
    this.stats = this.calculateStats(pokemonData, level);

    this.isMoving = false;
    this.moveSpeed = 0.8;
    this.target = position.clone();
    this.patrolTimer = 0;
    this.patrolInterval = 4 + Math.random() * 3;
    this.idleTime = 2 + Math.random() * 2;
    this.isIdle = false;

    this.jumpTimer = 0;
    this.jumpHeight = 0;
    this.baseHeight = position.y;

    this.inCombat = false;
  }

  calculateHP(pokemonData, level) {
    const baseHP = pokemonData.stats?.hp || 50;
    return Math.floor(((2 * baseHP + 31) * level) / 100) + level + 10;
  }

  calculateStats(pokemonData, level) {
      // Récupérer les stats de base
      // Supporte format { stats: { attack: ... } } ou { attack: ... }
      const baseFn = (statName) => {
          if (pokemonData.stats && pokemonData.stats[statName]) return pokemonData.stats[statName];
          if (pokemonData[statName]) return pokemonData[statName];
          return 50; // Moyenne par défaut
      };

      const attack = baseFn('attack');
      const defense = baseFn('defense');
      const speed = baseFn('speed');
      const special = baseFn('special');

      // Formule simple Gen 1 (sans EVs)
      // Stat = floor(((Base * 2 + IV) * Level) / 100) + 5
      const calc = (base) => Math.floor(((base * 2 + 15) * level) / 100) + 5;

      return {
          hp: this.maxHp, // redondant mais utile
          hpMax: this.maxHp,
          attack: calc(attack),
          defense: calc(defense),
          speed: calc(speed),
          special: calc(special),
          level: level
      };
  }

  async loadModel() {
    const loader = new GLTFLoader();

    const filename = (this.pokemonData.nom || this.pokemonData.name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const modelPath = `assets/sprites/pokemons/${filename}.glb`;

    return new Promise((resolve) => {
      loader.load(
        modelPath,
        (gltf) => {
          this.model = gltf.scene;
          this.model.position.copy(this.position);
          this.model.scale.set(6, 6, 6);
          this.model.rotation.y = Math.PI;

          // ✅ FIX INTÉGRÉ - Nettoyer les matériaux IMMÉDIATEMENT
          this.model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;

              // Réparer le matériau
              if (child.material) {
                const mats = Array.isArray(child.material)
                  ? child.material
                  : [child.material];
                mats.forEach((mat) => {
                  // Supprimer TOUTES les propriétés null
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
                    if (mat.hasOwnProperty(prop) && mat[prop] === null) {
                      delete mat[prop];
                    }
                  });

                  mat.needsUpdate = true;
                });
              }
            }
          });

          this.model.userData = {
            isPokemon: true,
            pokemon: this,
            hasCollision: true,
          };

          this.scene.add(this.model);
          resolve(this);
        },
        undefined,
        (error) => {
          console.error(`❌ Erreur chargement ${this.species}:`, error);
          this.createFallbackModel();
          resolve(this);
        }
      );
    });
  }

  createFallbackModel() {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff,
    });

    this.model = new THREE.Mesh(geometry, material);
    this.model.position.copy(this.position);
    this.model.castShadow = true;
    this.model.receiveShadow = true;

    this.model.userData = {
      isPokemon: true,
      pokemon: this,
      hasCollision: true,
    };

    this.scene.add(this.model);
  }

  update(delta, playerPosition, collisionObjects) {
    if (!this.model) return;

    if (this.inCombat) {
      if (playerPosition) {
        const direction = new THREE.Vector3().subVectors(
          playerPosition,
          this.model.position
        );
        direction.y = 0;
        direction.normalize();

        const angle = Math.atan2(-direction.x, -direction.z);
        this.model.rotation.y = angle;
      }
      return;
    }

    if (!this.isIdle) {
      this.patrolTimer += delta;
      if (this.patrolTimer > this.patrolInterval) {
        this.patrolTimer = 0;
        this.setRandomTarget(collisionObjects);
      }
    } else {
      this.patrolTimer += delta;
      if (this.patrolTimer > this.idleTime) {
        this.isIdle = false;
        this.patrolTimer = 0;
      }
    }

    if (this.isMoving) {
      const direction = new THREE.Vector3().subVectors(
        this.target,
        this.model.position
      );
      direction.y = 0;
      const distance = direction.length();
      direction.normalize();

      if (distance > 0.1) {
        const moveDistance = this.moveSpeed * delta;
        const newPosition = this.model.position.clone();
        newPosition.add(direction.multiplyScalar(moveDistance));

        const hasCollision = this.checkWorldCollision(newPosition);

        if (
          !hasCollision &&
          !this.checkCollision(newPosition, collisionObjects)
        ) {
          this.model.position.x = newPosition.x;
          this.model.position.z = newPosition.z;

          this.jumpTimer += delta * 6;
          this.jumpHeight = Math.abs(Math.sin(this.jumpTimer)) * 0.25;
          this.model.position.y = this.baseHeight + this.jumpHeight;

          const angle = Math.atan2(-direction.x, -direction.z) + Math.PI;
          this.model.rotation.y = angle;
        } else {
          this.isMoving = false;
          this.isIdle = true;
          this.patrolTimer = 0;
        }
      } else {
        this.isMoving = false;
        this.isIdle = true;
        this.patrolTimer = 0;
        this.model.position.y = this.baseHeight;
        this.jumpTimer = 0;
      }
    } else if (!this.isIdle && playerPosition) {
      const direction = new THREE.Vector3().subVectors(
        playerPosition,
        this.model.position
      );
      direction.y = 0;
      direction.normalize();

      const angleToPlayer = Math.atan2(-direction.x, -direction.z) + Math.PI;
      const currentRotation = this.model.rotation.y;
      let rotationDiff = angleToPlayer - currentRotation;

      while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
      while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

      this.model.rotation.y += rotationDiff * delta * 3;
    }
  }

  checkWorldCollision(position) {
    if (!this.worldManager) return false;

    const currentPos = this.model.position.clone();
    return this.worldManager.checkFlangeCollision(currentPos, position, 0.5);
  }

  checkCollision(position, collisionObjects) {
    const pokemonSphere = new THREE.Sphere(position, this.collisionRadius);

    for (const obj of collisionObjects) {
      if (!obj || obj === this.model) continue;
      if (!obj.userData || !obj.userData.hasCollision) continue;

      const box = new THREE.Box3().setFromObject(obj);
      if (box.intersectsSphere(pokemonSphere)) {
        return true;
      }
    }

    return false;
  }

  setRandomTarget(collisionObjects = []) {
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 1 + Math.random() * 2;

      const testTarget = new THREE.Vector3(
        this.position.x + Math.cos(angle) * distance,
        this.baseHeight,
        this.position.z + Math.sin(angle) * distance
      );

      if (!this.checkCollision(testTarget, collisionObjects)) {
        this.target.copy(testTarget);
        this.isMoving = true;
        this.jumpTimer = 0;
        return;
      }
    }

    this.isIdle = true;
    this.patrolTimer = 0;
  }

  takeDamage(damage) {
    this.hp = Math.max(0, this.hp - damage);

    if (this.model) {
      this.model.traverse((child) => {
        if (child.isMesh && child.material) {
          const originalColor = child.material.color.clone();
          child.material.color.set(0xff0000);
          setTimeout(() => {
            if (child.material) child.material.color.copy(originalColor);
          }, 100);
        }
      });
    }

    if (this.hp <= 0) {
      this.faint();
    }
  }

  faint() {
    if (!this.model) return;

    let fallSpeed = 0;
    const fallInterval = setInterval(() => {
      if (!this.model) {
        clearInterval(fallInterval);
        return;
      }

      fallSpeed += 0.02;
      this.model.rotation.x += fallSpeed;
      this.model.position.y -= fallSpeed * 0.5;

      if (this.model.position.y < -2) {
        clearInterval(fallInterval);
        this.remove();
      }
    }, 16);
  }

  remove() {
    if (this.model) {
      this.scene.remove(this.model);

      this.model.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });

      this.model = null;
    }
  }

  getDistanceToPlayer(playerPosition) {
    if (!this.model) return Infinity;
    return this.model.position.distanceTo(playerPosition);
  }
}
