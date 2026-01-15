import * as THREE from "three";
import { ActivePokemon } from "../entities/ActivePokemon.js";

export class PokeballPhysics {
  constructor(scene, camera, player, uiManager, pokemonManager, saveManager, inputManager = null) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.uiManager = uiManager;
    this.pokemonManager = pokemonManager;
    this.saveManager = saveManager; // ✅ Stocker le SaveManager
    this.inputManager = inputManager; // ✅ Référence à l'InputManager pour vérifier le pointer lock

    // État du lancer
    this.isCharging = false;
    this.chargeStartTime = 0;
    this.maxChargeTime = 1500;
    this.minThrowForce = 10;
    this.maxThrowForce = 30;
    this.activePokemon = null;
    this.activePokemon = null;
    this.onCombatStart = null;
    this.onCaptureComplete = null; // ✅ Init explicit

    // Callback pour terminer le combat (capture réussie)
    this.onCombatEnd = null;

    // Visée
    this.aimIndicator = this.createAimIndicator();
    this.trajectoryPreview = null;

    // Pokéballs actives en vol
    this.activeThrows = [];

    // Raycaster pour la détection du sol
    this.groundRaycaster = new THREE.Raycaster();
    this.groundRaycaster.far = 50;
    this.downDirection = new THREE.Vector3(0, -1, 0);

    // Cache des meshes de sol (pour performance)
    this.groundMeshes = [];
    this.buildGroundCache();

    // Debug mode
    this.debug = true;

    this.setupInputs();
  }

  /**
   * Construit le cache des meshes de sol (_ground, _floor, etc.)
   */
  buildGroundCache() {
    this.groundMeshes = [];

    this.scene.traverse((child) => {
      if (!child.isMesh) return;

      const name = child.name.toLowerCase();
      const parentName = child.parent?.name?.toLowerCase() || "";

      // Détecter les meshes de sol
      if (
        name.includes("_ground") ||
        name.includes("_floor") ||
        name.includes("_sol") ||
        parentName.includes("_ground") ||
        parentName.includes("_floor") ||
        parentName.includes("_sol") ||
        name.includes("ground") ||
        name.includes("floor") ||
        name.includes("terrain")
      ) {
        child.updateMatrixWorld(true);
        this.groundMeshes.push(child);
      }
    });

    console.log(
      `🎯 PokeballPhysics: ${this.groundMeshes.length} meshes de sol détectés`
    );
  }

  /**
   * Rafraîchit le cache (à appeler si la scène change)
   */
  refreshGroundCache() {
    this.buildGroundCache();
  }

  /**
   * Met à jour la scène (pour changement de zone)
   */
  setScene(newScene) {
    this.scene = newScene;

    // Retirer l'indicateur de visée de l'ancienne scène et l'ajouter à la nouvelle
    if (this.aimIndicator.parent) {
      this.aimIndicator.parent.remove(this.aimIndicator);
    }
    this.scene.add(this.aimIndicator);

    // Reconstruire le cache
    this.buildGroundCache();
  }

  /**
   * Obtient la hauteur du sol à une position donnée
   */
  getGroundHeight(position) {
    // Partir au-dessus de la position
    const rayOrigin = new THREE.Vector3(
      position.x,
      position.y + 10,
      position.z
    );

    this.groundRaycaster.set(rayOrigin, this.downDirection);

    // D'abord essayer avec le cache de sol
    if (this.groundMeshes.length > 0) {
      const intersects = this.groundRaycaster.intersectObjects(
        this.groundMeshes,
        false
      );
      if (intersects.length > 0) {
        return intersects[0].point.y;
      }
    }

    // Fallback: chercher dans toute la scène les objets avec ground/floor
    const allIntersects = this.groundRaycaster.intersectObjects(
      this.scene.children,
      true
    );
    for (const hit of allIntersects) {
      const name = hit.object.name.toLowerCase();
      const parentName = hit.object.parent?.name?.toLowerCase() || "";

      if (
        name.includes("ground") ||
        name.includes("floor") ||
        name.includes("_sol") ||
        name.includes("terrain") ||
        parentName.includes("ground") ||
        parentName.includes("floor")
      ) {
        return hit.point.y;
      }
    }

    // Fallback ultime: retourner 0
    return 0;
  }

  /**
   * Vérifie si la pokéball touche le sol
   */
  checkGroundCollision(pokeball) {
    const pos = pokeball.mesh.position;
    const radius = 0.15; // Rayon de la pokéball

    // Raycast vers le bas depuis la pokéball
    const rayOrigin = new THREE.Vector3(pos.x, pos.y + 0.5, pos.z);
    this.groundRaycaster.set(rayOrigin, this.downDirection);

    // Vérifier collision avec les meshes de sol
    let groundHit = null;

    if (this.groundMeshes.length > 0) {
      const intersects = this.groundRaycaster.intersectObjects(
        this.groundMeshes,
        false
      );
      if (intersects.length > 0) {
        groundHit = intersects[0];
      }
    }

    // Fallback sur toute la scène
    if (!groundHit) {
      const allIntersects = this.groundRaycaster.intersectObjects(
        this.scene.children,
        true
      );
      for (const hit of allIntersects) {
        const name = hit.object.name.toLowerCase();
        const parentName = hit.object.parent?.name?.toLowerCase() || "";

        if (
          name.includes("ground") ||
          name.includes("floor") ||
          name.includes("_sol") ||
          name.includes("terrain") ||
          parentName.includes("ground") ||
          parentName.includes("floor")
        ) {
          groundHit = hit;
          break;
        }
      }
    }

    if (groundHit) {
      const groundY = groundHit.point.y;
      // La pokéball touche le sol si elle est assez proche
      if (pos.y - radius <= groundY + 0.05) {
        return { hit: true, groundY: groundY };
      }
    }

    // Fallback: y <= 0.15 (ancien comportement)
    if (pos.y <= radius) {
      return { hit: true, groundY: 0 };
    }

    return { hit: false, groundY: 0 };
  }

  createAimIndicator() {
    const geometry = new THREE.RingGeometry(0.1, 0.15, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const indicator = new THREE.Mesh(geometry, material);
    indicator.visible = false;
    this.scene.add(indicator);
    return indicator;
  }
  setupInputs() {
    document.addEventListener("mousedown", (e) => {
      // ✅ FIX: Ne lancer la pokéball que si le pointer lock est actif
      // Cela évite de lancer la pokéball lors des clics sur les menus UI
      const isPointerLocked = this.inputManager?.isLocked() || document.pointerLockElement !== null;

      if (e.button === 0 && isPointerLocked) {
        // e.preventDefault(); // Optionnel selon l'effet sur le PointerLock
        this.startCharging();
      }
    });

    document.addEventListener("mouseup", (e) => {
      if (e.button === 0 && this.isCharging) {
        // e.preventDefault();
        this.throwPokeball();
      }
    });

    document.addEventListener("keydown", (e) => {
      // ✅ FIX: Touche 'A' pour lancer (si pas dans un input)
      if (e.code === "KeyA" && document.activeElement.tagName !== "INPUT") {
          this.startCharging();
      }

      if (e.code === "KeyR" && this.activePokemon) {
        this.recallActivePokemon();
      }
    });

    document.addEventListener("keyup", (e) => {
        if (e.code === "KeyA" && this.isCharging) {
            this.throwPokeball();
        }
    });

    document.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  startCharging() {
    // ✅ FIX: Anti-spam Cooldown
    const now = Date.now();
    if (this.lastThrowTime && now - this.lastThrowTime < 500) return;

    if (this.isCharging) return;

    this.isCharging = true;
    this.chargeStartTime = now;
    this.aimIndicator.visible = true;
    console.log("Charging pokéball throw...");
  }

  calculateThrowForce() {
    const chargeTime = Date.now() - this.chargeStartTime;
    const normalizedCharge = Math.min(chargeTime / this.maxChargeTime, 1);
    return (
      this.minThrowForce +
      (this.maxThrowForce - this.minThrowForce) * normalizedCharge
    );
  }

  throwPokeball() {
    const selectedPokemon = this.uiManager.getSelectedPokemon();

    // ✅ FIX: Nouvelle logique
    // - Si un Pokémon est déjà sur le terrain (activePokemon) → pokéball de capture
    // - Sinon, si on a un Pokémon sélectionné avec PV > 0 → lancer pour combat

    // ✅ FIX: Auto-rappel si le Pokémon est sorti mais pas en combat
    if (this.activePokemon && !this.activePokemon.inCombat) {
      console.log("🔄 Auto-recall active pokemon for new throw");
      this.recallActivePokemon();
    }

    let pokemonToThrow = null;
    let throwType = "capture";

    // ✅ FIX: Gérer les différentes structures de données (stats.hp vs hp)
    const pokemonHp = selectedPokemon
      ? selectedPokemon.stats?.hp ?? selectedPokemon.hp ?? 0
      : 0;

    if (this.activePokemon) {
      // Un Pokémon est déjà sorti sur le terrain (et est en combat) → capture
      pokemonToThrow = null;
      throwType = "capture";
    } else if (selectedPokemon && pokemonHp > 0) {
      // Pas de Pokémon sur le terrain, en lancer un pour combat
      pokemonToThrow = selectedPokemon;
      throwType = "combat";
    }

    // Debug
    console.log("🎾 === LANCER POKÉBALL ===");
    console.log("  selectedPokemon:", selectedPokemon?.name || "aucun");
    console.log(
      "  activePokemon:",
      this.activePokemon ? "OUI (sur le terrain)" : "NON"
    );
    console.log("  throwType:", throwType);
    console.log("  pokemonToThrow:", pokemonToThrow?.name || "null (capture)");

    this.isCharging = false;
    this.aimIndicator.visible = false;

    const force = this.calculateThrowForce();
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    const startPos = this.player.position.clone();
    startPos.y += 1.5;
    startPos.add(direction.clone().multiplyScalar(0.5));

    const pokeball = this.createPokeballEntity(
      startPos,
      direction,
      force,
      pokemonToThrow
    );
    this.activeThrows.push(pokeball);

    if (pokemonToThrow) {
      this.uiManager.markPokemonAsOut(this.uiManager.selectedPokemonIndex);
      console.log(`✅ Lancer COMBAT avec ${pokemonToThrow.name}`);
    } else {
      console.log(`⚪ Lancer CAPTURE (pokéball vide)`);
    }
    
    this.lastThrowTime = Date.now();
  }

  createPokeballEntity(position, direction, force, pokemon) {
    const geometry = new THREE.SphereGeometry(0.15, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      metalness: 0.3,
      roughness: 0.7,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);

    const bandGeometry = new THREE.TorusGeometry(0.15, 0.03, 8, 32);
    const bandMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const band = new THREE.Mesh(bandGeometry, bandMaterial);
    band.rotation.x = Math.PI / 2;
    mesh.add(band);

    const buttonGeometry = new THREE.CircleGeometry(0.05, 16);
    const buttonMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
    });
    const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
    button.position.z = 0.151;
    mesh.add(button);

    this.scene.add(mesh);

    const velocity = direction.clone().multiplyScalar(force);

    return {
      mesh,
      velocity,
      angularVelocity: new THREE.Vector3(
        Math.random() * 10 - 5,
        Math.random() * 10 - 5,
        Math.random() * 10 - 5
      ),
      lifetime: 0,
      maxLifetime: 5000,
      hasHit: false,
      pokemon: pokemon,
    };
  }

  update(deltaTime) {
    if (this.isCharging) {
      this.updateAimIndicator();
    }

    if (this.activePokemon) {
      this.activePokemon.update(deltaTime);
    }

    const gravity = new THREE.Vector3(0, -9.81, 0);

    for (let i = this.activeThrows.length - 1; i >= 0; i--) {
      const pokeball = this.activeThrows[i];

      pokeball.velocity.add(gravity.clone().multiplyScalar(deltaTime));
      pokeball.mesh.position.add(
        pokeball.velocity.clone().multiplyScalar(deltaTime)
      );

      pokeball.mesh.rotation.x += pokeball.angularVelocity.x * deltaTime;
      pokeball.mesh.rotation.y += pokeball.angularVelocity.y * deltaTime;
      pokeball.mesh.rotation.z += pokeball.angularVelocity.z * deltaTime;

      // ✅ FIX: Suppression du délai de collision qui causait un bug "vol infini"
      // (Car le continue sautait l'incrémentation de lifetime)


      // ✅ Vérifier collision Pokémon EN PREMIER (avant le sol)
      if (this.checkPokemonCollision(pokeball)) {
        continue; // La pokéball a été supprimée
      }

      // ✅ FIX: Utiliser raycast pour détecter le sol
      const groundCheck = this.checkGroundCollision(pokeball);
      if (groundCheck.hit) {
        this.handleGroundCollision(pokeball, groundCheck.groundY);
      }

      pokeball.lifetime += deltaTime * 1000;
      if (pokeball.lifetime > pokeball.maxLifetime) {
        this.removePokeball(i);
      }
    }
  }

  updateAimIndicator() {
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    raycaster.set(this.camera.position, direction);

    const intersects = raycaster.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      this.aimIndicator.position.copy(point);
      this.aimIndicator.position.y += 0.1;
      this.aimIndicator.lookAt(this.camera.position);

      const charge = Math.min(
        (Date.now() - this.chargeStartTime) / this.maxChargeTime,
        1
      );
      this.aimIndicator.material.color.setHSL(charge * 0.3, 1, 0.5);
    }
  }

  handleGroundCollision(pokeball, groundY = 0) {
    if (pokeball.hasHit) return;

    const radius = 0.15;

    // Rebond
    pokeball.velocity.y *= -0.5;
    pokeball.velocity.x *= 0.7;
    pokeball.velocity.z *= 0.7;

    // ✅ FIX: Positionner sur le vrai sol
    pokeball.mesh.position.y = groundY + radius;

    pokeball.hasHit = true;

    if (pokeball.pokemon && !this.activePokemon) {
      this.spawnPokemon(pokeball.pokemon, pokeball.mesh.position.clone());
    }

    if (this.debug) {
      console.log(`🔴 Pokéball rebondit sur le sol (y=${groundY.toFixed(2)})`);
    }
  }

  spawnPokemon(pokemonData, spawnPosition) {
    // ✅ FIX: Assurer que le nom existe (récupération depuis la DB si nécessaire)
    if (!pokemonData.name && pokemonData.speciesId && this.pokemonManager) {
      // Tenter de récupérer via la DB du PokemonManager
      if (this.pokemonManager.pokemonDatabase) {
        const dbData = this.pokemonManager.pokemonDatabase.find(
          (p) => p.id === pokemonData.speciesId
        );
        if (dbData) {
          pokemonData.name = dbData.nom || dbData.name;
          console.log(
            `🔧 Nom récupéré pour ID ${pokemonData.speciesId}: ${pokemonData.name}`
          );
        }
      }
    }

    // Fallback ultime si toujours pas de nom
    if (!pokemonData.name) {
      console.warn("⚠️ Nom manquant pour le Pokémon, utilisation fallback");
      pokemonData.name = "Unknown";
    }
    const spawnLight = new THREE.PointLight(0xffffff, 3, 5);
    spawnLight.position.copy(spawnPosition);
    this.scene.add(spawnLight);

    setTimeout(() => {
      this.scene.remove(spawnLight);
    }, 500);

    this.activePokemon = new ActivePokemon(
      this.scene,
      pokemonData,
      spawnPosition
    );
    this.activePokemon.setTarget(this.player);

    console.log(`${pokemonData.name} appeared!`);
  }

  /**
   * ✅ FIX: Collision améliorée avec les Pokémon
   * - Utilise getWorldPosition() pour les coordonnées monde
   * - Calcule le rayon de collision basé sur la bounding box
   * - Prend en compte le scale des modèles
   */
  checkPokemonCollision(pokeball) {
    if (!this.pokemonManager || !this.pokemonManager.pokemons) {
      return false;
    }

    const pokeballPos = pokeball.mesh.position.clone();
    const pokeballRadius = 0.15;

    for (let i = 0; i < this.pokemonManager.pokemons.length; i++) {
      const wildPokemon = this.pokemonManager.pokemons[i];

      if (!wildPokemon.model) continue;

      // ✅ FIX: Utiliser getWorldPosition pour les coordonnées monde
      const pokemonWorldPos = new THREE.Vector3();
      wildPokemon.model.getWorldPosition(pokemonWorldPos);

      // ✅ FIX: Calculer le rayon de collision basé sur la bounding box
      const boundingBox = new THREE.Box3().setFromObject(wildPokemon.model);
      const size = new THREE.Vector3();
      boundingBox.getSize(size);

      // Rayon = moitié de la plus grande dimension horizontale
      const pokemonRadius = Math.max(size.x, size.z) / 2;

      // ✅ FIX: Rayon de collision total (pokéball + pokémon)
      const collisionRadius = pokeballRadius + Math.max(pokemonRadius, 1.5);

      // Distance 2D (ignorer Y pour être plus permissif)
      const distance2D = Math.sqrt(
        Math.pow(pokeballPos.x - pokemonWorldPos.x, 2) +
          Math.pow(pokeballPos.z - pokemonWorldPos.z, 2)
      );

      // Distance 3D
      const distance3D = pokeballPos.distanceTo(pokemonWorldPos);

      // ✅ FIX: Vérifier aussi la hauteur (la pokéball doit être à la bonne hauteur)
      const heightDiff = Math.abs(
        pokeballPos.y - (pokemonWorldPos.y + size.y / 2)
      );
      const maxHeightDiff = size.y / 2 + 1; // Tolérance de hauteur

      if (this.debug && distance2D < collisionRadius * 2) {
        console.log(
          `🎯 Distance à ${wildPokemon.species}: 2D=${distance2D.toFixed(
            2
          )}, 3D=${distance3D.toFixed(2)}, radius=${collisionRadius.toFixed(
            2
          )}, heightDiff=${heightDiff.toFixed(2)}`
        );
      }

      // Collision si proche horizontalement ET verticalement
      if (distance2D < collisionRadius && heightDiff < maxHeightDiff) {
        console.log(
          `💥 TOUCHÉ! ${wildPokemon.species} Lv.${wildPokemon.level}`
        );
        console.log(`  → pokeball.pokemon:`, pokeball.pokemon);

        if (pokeball.pokemon) {
          // Lancer avec un Pokémon = démarrer combat
          console.log(
            `  → COMBAT: ${pokeball.pokemon.name} VS ${wildPokemon.species}`
          );
          this.startCombat(pokeball.pokemon, wildPokemon);
        } else {
          // Pokéball vide = tentative de capture
          console.log(`  → CAPTURE: tentative sur ${wildPokemon.species}`);
          this.attemptCapture(wildPokemon, pokeball);
        }

        // Supprimer la pokéball
        const index = this.activeThrows.indexOf(pokeball);
        if (index > -1) {
          this.removePokeball(index);
        }

        return true;
      }
    }

    return false;
  }

  attemptCapture(wildPokemon, pokeball) {
    console.log(`🎯 Tentative de capture de ${wildPokemon.species}!`);

    const hpRatio = wildPokemon.hp / wildPokemon.maxHp;

    // ✅ FIX: Formule de capture améliorée
    // Plus les PV sont bas, plus la capture est facile
    // Base: 30% + (70% * (1 - hpRatio))
    const baseRate = 0.3;
    const hpBonus = 0.7 * (1 - hpRatio);
    const catchRate = baseRate + hpBonus;

    const randomChance = Math.random();

    console.log(
      `📊 Taux de capture: ${(catchRate * 100).toFixed(1)}% (PV: ${
        wildPokemon.hp
      }/${wildPokemon.maxHp})`
    );

    if (randomChance < catchRate) {
      // CAPTURE RÉUSSIE !
      console.log(`✅ ${wildPokemon.species} a été capturé !`);

      // Débloquer le Pokémon du combat
      wildPokemon.inCombat = false;

      // ✅ FIX: Trouver le bon ID dans la base de données
      const speciesId = wildPokemon.speciesId || wildPokemon.id || wildPokemon.pokemonData?.id;
      console.log(`[PokeballPhysics] Tentative capture - SpeciesID trouvé: ${speciesId}`, wildPokemon);

      // Ajouter à l'équipe
      // ✅ FIX: Utilisation directe du SaveManager (plus fiable que le callback)
      // ✅ FIX: Prioriser le callback externe (c'est lui qui gère le flux de fin de combat dans main.js)
      if (this.onCaptureComplete) {
          console.log(`[PokeballPhysics] Délégation de la capture au callback main.js`);
          this.onCaptureComplete({
              id: speciesId,
              species: wildPokemon.species,
              level: wildPokemon.level
          });
      }
      // Fallback: Gestion interne si pas de callback configuré (ex: hors main.js)
      else if (this.saveManager) {
          console.log(`[PokeballPhysics] Sauvegarde via SaveManager interne (Fallback)`);
          
          const newPokemonData = this.saveManager.createPokemon(speciesId, wildPokemon.level);
          
          if (newPokemonData) {
               const added = this.saveManager.addToTeam(newPokemonData.uniqueId);
               this.uiManager.showNotification(`${wildPokemon.species} a été ${added ? "ajouté à l'équipe" : "envoyé au PC"} !`);
               
               this.saveManager.save().then(() => console.log("💾 Sauvegarde terminée"));
               this.uiManager.syncFromSaveManager();
          }
           // Terminer le combat via callback générique si défini
          if (this.onCombatEnd) {
            this.onCombatEnd("capture");
          }
      } else {
        console.warn("⚠️ Ni Callback ni SaveManager défini dans PokeballPhysics !");
      }

      // Retirer le Pokémon de la scène
      if (wildPokemon.model) {
        this.scene.remove(wildPokemon.model);
      }

      // Retirer du PokemonManager
      const index = this.pokemonManager.pokemons.indexOf(wildPokemon);
      if (index > -1) {
        this.pokemonManager.pokemons.splice(index, 1);
      }

      // ❌ FIX: Ne PAS appeler onCombatEnd ici si onCaptureComplete a été appelé
      // Cela créerait un double appel de fin de combat
      if (!this.onCaptureComplete && this.onCombatEnd) {
          this.onCombatEnd("capture");
      }

      // Message de succès
      setTimeout(() => {
        alert(`${wildPokemon.species} a été ajouté à votre équipe !`);
      }, 100);
    } else {
      // CAPTURE RATÉE
      console.log(`❌ ${wildPokemon.species} s'est échappé !`);

      // Animation de saut
      if (wildPokemon.model) {
        const originalY = wildPokemon.model.position.y;
        wildPokemon.model.position.y += 0.5;
        setTimeout(() => {
          if (wildPokemon.model) {
            wildPokemon.model.position.y = originalY;
          }
        }, 300);
      }
    }
  }

  startCombat(playerPokemon, wildPokemon) {
    console.log(
      `🔥 Combat: ${playerPokemon.name} VS ${wildPokemon.species} Lv.${wildPokemon.level}!`
    );

    // Marquer le Pokémon sauvage comme en combat
    wildPokemon.inCombat = true;

    if (this.activePokemon) {
      this.activePokemon.dispose();
      this.activePokemon = null;
    }

    const spawnPos = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    spawnPos.add(dir.multiplyScalar(3));

    // ✅ FIX: Utiliser la vraie hauteur du sol
    spawnPos.y = this.getGroundHeight(spawnPos);

    this.spawnPokemon(playerPokemon, spawnPos);

    if (this.onCombatStart) {
      this.onCombatStart(playerPokemon, wildPokemon, this.activePokemon);
    }
  }

  recallActivePokemon() {
    if (this.activePokemon) {
      const pokemonData = this.activePokemon.pokemonData;

      const index = this.uiManager.playerData.team.findIndex(
        (p) => p.id === pokemonData.id && p.name === pokemonData.name
      );

      if (index !== -1) {
        this.uiManager.recallPokemon(index);
      }

      this.activePokemon.recall();
      this.activePokemon = null;
    }
  }

  removePokeball(index) {
    if (index < 0 || index >= this.activeThrows.length) return;

    const pokeball = this.activeThrows[index];
    this.scene.remove(pokeball.mesh);

    // Nettoyer les ressources
    pokeball.mesh.geometry.dispose();
    if (pokeball.mesh.material) {
      pokeball.mesh.material.dispose();
    }

    // Nettoyer les enfants (bande et bouton)
    pokeball.mesh.children.forEach((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });

    this.activeThrows.splice(index, 1);
  }

  dispose() {
    this.scene.remove(this.aimIndicator);
    this.aimIndicator.geometry.dispose();
    this.aimIndicator.material.dispose();

    this.activeThrows.forEach((pb, i) => this.removePokeball(i));
    this.activeThrows = [];

    if (this.activePokemon) {
      this.activePokemon.dispose();
      this.activePokemon = null;
    }
  }
}
