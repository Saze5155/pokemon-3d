import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * NPCManager - Gestionnaire des Personnages Non Joueurs
 * Gère le chargement des modèles 3D, les interactions et les combats de dresseurs
 */
export class NPCManager {
  constructor(sceneManager, combatManager = null, worldManager = null) {
    this.sceneManager = sceneManager;
    this.combatManager = combatManager;
    this.worldManager = worldManager;

    this.gltfLoader = new GLTFLoader();

    // Données des PNJ (chargées depuis pnj.json)
    this.pnjDatabase = {};
    this.categories = {};

    // PNJ actifs par scène
    this.npcs = new Map(); // Map<sceneName, Array<NPC>>

    // État des interactions
    this.defeatedTrainers = new Set(); // IDs des dresseurs vaincus
    this.talkedNPCs = new Map(); // Map<npcId, dialogueState>
    this.storyFlags = new Set(); // Flags de progression

    // Configuration
    this.interactionDistance = 2.5; // Distance pour parler
    this.trainerVisionDistance = 8; // Réduit de 15 à 8 pour éviter le "sniping"
    this.trainerVisionAngle = 120; // Augmenté de 60 à 120

    // Cooldown pour éviter les détections multiples
    this.lastTrainerSpotted = null;
    this.trainerSpotCooldown = 0;

    // Callbacks
    this.onDialogueStart = null;
    this.onDialogueEnd = null;
    this.onTrainerBattle = null;

    // Référence à la caméra pour les raycasts (nécessaire pour les sprites)
    this.camera = null;
  }

  /**
   * Définit la caméra pour les raycasts (nécessaire pour intersect avec sprites)
   */
  setCamera(camera) {
    this.camera = camera;
  }

  async loadPNJDatabase() {
    try {
      const response = await fetch("data/pnj.json");
      const data = await response.json();

      this.pnjDatabase = data.pnj || {};
      this.categories = data.categories || {};

      this.pnjDatabase = data.pnj;
      this.categories = data.categories || {};
      
      console.log(`Debug PNJ keys:`, Object.keys(this.pnjDatabase));

      console.log(
        `👥 Base PNJ chargée: ${
          Object.keys(this.pnjDatabase).length
        } personnages`
      );
      return true;
    } catch (error) {
      console.error("Erreur chargement base PNJ:", error);
      this.pnjDatabase = {};
      this.categories = {};
      return false;
    }
  }

  /**
   * Charge les PNJ d'une scène depuis ses données
   */
  async loadNPCsForScene(sceneName, sceneData) {
    if (!sceneData.entities?.pnj || sceneData.entities.pnj.length === 0) {
      return;
    }

    const scene = this.sceneManager.scenes.get(sceneName);

    // Nettoyer les anciens PNJ de cette scène pour éviter les doublons
    this.clearNPCsForScene(sceneName);

    if (!scene) {
      console.warn(`Scene "${sceneName}" non trouvée pour charger les PNJ`);
      return;
    }

    const sceneNPCs = [];

    for (const pnjData of sceneData.entities.pnj) {
      const npc = await this.createNPC(pnjData, scene, sceneName);
      if (npc) {
        sceneNPCs.push(npc);
      }
    }

    this.npcs.set(sceneName, sceneNPCs);
    console.log(`👥 ${sceneNPCs.length} PNJ chargés pour "${sceneName}"`);
    
    // Force le snapping au sol après chargement
    // IMPORTANT: Nécessaire pour les intérieurs qui ne passent pas par WorldManager.loadZone
    this.snapNPCsToGround(sceneName);
  }

  /**
   * Supprime les PNJ d'une scène
   */
  clearNPCsForScene(sceneName) {
    if (this.npcs.has(sceneName)) {
      const oldNPCs = this.npcs.get(sceneName);
      console.log(`🧹 Nettoyage de ${oldNPCs.length} anciens PNJ pour ${sceneName}`);
      
      oldNPCs.forEach(npc => {
        if (npc.mesh) {
          if (npc.mesh.parent) {
            npc.mesh.parent.remove(npc.mesh);
          }
          // Nettoyer geometria/material si besoin, mais ThreeJS gère souvent ça
          npc.mesh = null;
        }
      });
      
      this.npcs.delete(sceneName);
    }
  }

  /**
   * Crée un PNJ avec son modèle 3D
   */
  async createNPC(pnjData, scene, sceneName) {
    const pnjInfo = this.pnjDatabase[pnjData.pnjId];
    if (!pnjInfo) {
      console.warn(`PNJ "${pnjData.pnjId}" non trouvé dans la base`);
      // Créer quand même avec des infos minimales
    }

    const npc = {
      id: pnjData.id,
      pnjId: pnjData.pnjId,
      nom: pnjData.nom || pnjInfo?.nom || "PNJ",
      categorie: pnjData.categorie || pnjInfo?.categorie || "villageois",
      position: { ...pnjData.position },
      rotation: pnjData.rotation || 0,
      info: pnjInfo || { dialogues: { default: ["..."] } },
      sceneName: sceneName,
      mesh: null,
      model: null,
      mixer: null,
      animations: {},
      isTrainer: pnjInfo?.combat === true,
      isDefeated: this.defeatedTrainers.has(pnjData.id),
      currentDialogueState: this.talkedNPCs.get(pnjData.id) || "default",
      interactionDistance: pnjData.interactionDistance || pnjInfo?.interactionDistance || null,
    };
    
    console.log(`🤖 Création PNJ ${npc.id} (${npc.nom}): Combat=${npc.isTrainer ? "OUI" : "NON"}, PNJInfo.combat=${pnjInfo?.combat}`);

    // Déterminer le chemin du modèle
    const modelPath = this.getModelPath(pnjData.pnjId, pnjInfo);

    // Charger le modèle 3D
    try {
      const model = await this.loadModel(modelPath);
      if (model) {
        npc.model = model;

        // Positionner le modèle
        let positionY = pnjData.position.y || 0;
        let finalScene = scene;
        let worldOffset = { x: 0, z: 0 };
        let useLocalCoordinates = false;

        // LOGIQUE WORLDMAP
        if (this.worldManager && this.worldManager.zones) {
            const zone = this.worldManager.zones.find(z => z.scene === sceneName);
            if (zone) {
                // Essayer de trouver le groupe de la zone déjà instancié
                console.log(`🔍 Recherche ZoneGroup pour '${sceneName}'. Dispos:`, Array.from(this.worldManager.zoneGroups.keys()));
                const zoneGroup = this.worldManager.zoneGroups.get(sceneName);
                
                if (zoneGroup) {
                    // CAS IDÉAL : On ajoute le PNJ dans le groupe de la zone
                    // Il bougera avec la zone et utilisera ses coordonnées locales
                    finalScene = zoneGroup;
                    useLocalCoordinates = true;
                    // On a quand même besoin de l'offset pour le calcul de hauteur (Raycast World)
                    worldOffset.x = zone.worldX;
                    worldOffset.z = zone.worldZ;
                    console.log(`🌍 PNJ ${pnjData.pnjId} ajouté au GROUPE DE ZONE ${sceneName}`);
                } else {

                    // Fallback IMPORTANT : Le groupe de zone n'est pas dispo
                    // On sait que c'est une zone du monde (car if(zone) est true au dessus)
                    // On force l'ajout au WorldScene pour garantir la visibilité en mode World
                    if (this.worldManager && this.worldManager.worldScene) {
                        finalScene = this.worldManager.worldScene;
                        useLocalCoordinates = false;
                        worldOffset.x = zone.worldX;
                        worldOffset.z = zone.worldZ;
                        console.log(`🌍 ZoneGroup introuvable -> Fallback: FORCE WORLD SCENE (Global Coords)`);
                    } else {
                        // Si le WorldScene n'est pas prêt, on doit rester en local (tant pis pour la visibilité World)
                        finalScene = scene;
                        useLocalCoordinates = true;
                        worldOffset.x = 0;
                        worldOffset.z = 0;
                        console.warn(`⚠️ WorldScene indisponible pour ${pnjData.pnjId} -> Repli LOCAL (risque invisibilité)`);
                    }
                }
            }
        }

        // FIX: Respecter Y manuel s'il est défini (!= 0) pour permettre le placement custom (ex: Pierre)
        if (pnjData.position.y === 0 && this.sceneManager && this.sceneManager.getTerrainHeight) {
             try {
                // Coordonnées pour le check terrain
                const checkX = pnjData.position.x + worldOffset.x;
                const checkZ = pnjData.position.z + worldOffset.z;

                // Tenter de récupérer la hauteur
                let terrainHeight = -1000;
                
                if (this.worldManager && worldOffset.x !== 0) {
                     terrainHeight = this.worldManager.getTerrainHeight(checkX, checkZ);
                } else {
                     terrainHeight = this.sceneManager.getTerrainHeight(pnjData.position.x, pnjData.position.z);
                }
                
                if (terrainHeight > -900) {
                    positionY = terrainHeight; 
                }
            } catch (e) {
                // Silecieux si échec
            }
        }

        // Ajustement simple (retour à la version qui marchait)
        positionY += 0.5;

        if (useLocalCoordinates) {
            // Position LOCALE dans le ZoneGroup
            model.position.set(
              pnjData.position.x,
              positionY, 
              pnjData.position.z
            );
        } else {
            // Position GLOBALE dans le WorldScene
            model.position.set(
              pnjData.position.x + worldOffset.x,
              positionY, 
              pnjData.position.z + worldOffset.z
            );
        }

        // Rotation (en radians)
        model.rotation.y = ((pnjData.rotation || 0) * Math.PI) / 180;

        // Configurer les ombres
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
          }
        });

        // Ajouter un userData pour identifier le PNJ
        model.userData.isNPC = true;
        model.userData.npcId = pnjData.id;
        model.userData.npcData = npc;
        
        // Ajouter à la scène finale (Locale ou Monde)
        finalScene.add(model);

        npc.mesh = model;


        // Debug Bounding Box
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        console.log(`📏 Taille PNJ ${npc.nom}:`, { x: size.x, y: size.y, z: size.z });

        console.log(`✅ Modèle chargé pour ${npc.nom}`);
      }
    } catch (error) {
      console.warn(
        `Impossible de charger le modèle pour ${pnjData.pnjId}, utilisation placeholder`
      );
      // Créer un placeholder
      this.createPlaceholderMesh(npc, scene);
    }

    // Créer l'indicateur visuel
    this.createNPCIndicator(npc, scene);



    // Créer l'indicateur visuel
    this.createNPCIndicator(npc, scene);

    // Créer l'indicateur visuel
    this.createNPCIndicator(npc, scene);

    return npc;
  }

  /**
   * Recalcule la hauteur des PNJ en cherchant spécifiquement le mesh "_ground"
   */
  snapNPCsToGround(sceneName) {
      if (!this.npcs.has(sceneName)) return;

      const npcs = this.npcs.get(sceneName);
      console.log(`⚓ Snapping ${npcs.length} PNJ sur '_ground' pour ${sceneName}...`);

      const raycaster = new THREE.Raycaster();
      const down = new THREE.Vector3(0, -1, 0);

      npcs.forEach(npc => {
          if (!npc.mesh) return;

          // 1. Trouver les meshes de sol (_ground) dans la scène parente
          const parent = npc.mesh.parent;
          if (!parent) {
             console.warn(`❌ PNJ ${npc.nom} n'a pas de parent!`);
             return;
          }

          // Force l'update de la matrice du parent (pour avoir les bonnes positions World)
          parent.updateMatrixWorld(true);

          const groundMeshes = [];
          
          parent.traverse(child => {
              if (child.isMesh) {
                  if (child.name.toLowerCase().includes('ground') || child.name.toLowerCase().includes('floor') || child.name.toLowerCase().includes('terrain') || child.name.toLowerCase().includes('sol')) {
                      groundMeshes.push(child);
                  }
              }
          });

          if (groundMeshes.length === 0) {
              console.warn(`⚠️ Aucun mesh 'ground/floor/terrain/sol' trouvé dans ${sceneName} pour ${npc.nom}`);
              return;
          }

          // 2. Raycast en WORLD SPACE
          // Récupérer la position exacte du PNJ dans le monde
          const worldPos = new THREE.Vector3();
          npc.mesh.getWorldPosition(worldPos);

          const checkPos = worldPos.clone();
          checkPos.y += 50; // On part de 50 unités au dessus du PNJ
          
          raycaster.set(checkPos, down);

          const intersects = raycaster.intersectObjects(groundMeshes, true);
          
          if (intersects.length > 0) {
              const hit = intersects[0];
              // Convertir le point d'impact (World) en Local pour le PNJ
              const localTarget = parent.worldToLocal(hit.point.clone());
              
              const oldY = npc.mesh.position.y;
              npc.mesh.position.y = localTarget.y + 0.5; // +0.5 offset

              console.log(`  -> ✅ ${npc.nom} snappé sur ${hit.object.name}. Y World: ${hit.point.y.toFixed(2)} -> Y Local: ${npc.mesh.position.y.toFixed(2)} (Avant: ${oldY.toFixed(2)})`);
          } else {
               console.warn(`  -> ❌ ${npc.nom} RAYCAST FAIL (World check: X=${checkPos.x.toFixed(1)}, Z=${checkPos.z.toFixed(1)})`);
          }
      });
  }

  /**
   * Détermine le chemin du modèle 3D pour un PNJ
   */
  getModelPath(pnjId, pnjInfo) {
    const basePath = "assets/sprites/pnj";

    // Mapping des PNJ spéciaux
    const specialMappings = {
      chen: `${basePath}/Chen/Chen.glb`,
      rival: `${basePath}/Blue/Blue.glb`,
      mere: `${basePath}/Mere/Mere.glb`,
      // Champions
      pierre: `${basePath}/champions/Pierre/Pierre.glb`,
      ondine: `${basePath}/champions/Ondine/Ondine.glb`,
      major_bob: `${basePath}/champions/MajorBob/MajorBob.glb`,
      erika: `${basePath}/champions/Erika/Erika.glb`,
      koga: `${basePath}/champions/Koga/Koga.glb`,
      morgane: `${basePath}/champions/Morgane/Morgane.glb`,
      auguste: `${basePath}/champions/Auguste/Auguste.glb`,
      giovanni: `${basePath}/champions/Giovanni/Giovanni.glb`,
      // Conseil des 4
      olga: `${basePath}/conseil4/Olga/Olga.glb`,
      aldo: `${basePath}/conseil4/Aldo/Aldo.glb`,
      agatha: `${basePath}/conseil4/Agatha/Agatha.glb`,
      peter: `${basePath}/conseil4/Peter/Peter.glb`,
    };

    if (specialMappings[pnjId]) {
      return specialMappings[pnjId];
    }

    // Pour les PNJ génériques, utiliser la catégorie
    const categorie = pnjInfo?.categorie || "villageois";

    // Mapping des catégories vers les modèles génériques
    const categoryModels = {
      dresseurs_insecte: `${basePath}/dresseurs/Insecte.glb`,
      dresseurs_shorts: `${basePath}/dresseurs/Short.glb`,
      montagnards: `${basePath}/dresseurs/Montagnard.glb`,
      pokemaniacs: `${basePath}/dresseurs/Pokemaniac.glb`,
      super_nerds: `${basePath}/dresseurs/SuperNerd.glb`,
      beautes: `${basePath}/dresseurs/Beaute.glb`,
      gentlemen: `${basePath}/dresseurs/Gentleman.glb`,
      scientifiques: `${basePath}/dresseurs/Scientifique.glb`,
      rockers: `${basePath}/dresseurs/Rocker.glb`,
      pecheurs: `${basePath}/dresseurs/Pecheur.glb`,
      nageurs: `${basePath}/dresseurs/Nageur.glb`,
      karateka: `${basePath}/dresseurs/Karateka.glb`,
      ceinture_noire: `${basePath}/dresseurs/CeintureNoire.glb`,
      team_rocket: `${basePath}/TeamRocket/Sbire.glb`,
      infirmieres: `${basePath}/Infirmiere/Infirmiere.glb`,
      marchands: `${basePath}/Marchand/Marchand.glb`,
      villageois: `${basePath}/Villageois/Villageois.glb`,
      cooltrainers: `${basePath}/dresseurs/Cooltrainer.glb`,
      psychics: `${basePath}/dresseurs/Medium.glb`,
      channelers: `${basePath}/dresseurs/Mystimaniac.glb`,
    };

    return categoryModels[categorie] || `${basePath}/Villageois/Villageois.glb`;
  }

  /**
   * Charge un modèle 3D GLB
   */
  loadModel(path) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          console.log(`📦 Modèle chargé avec succès: ${path}`);
          const model = gltf.scene;

          // Appliquer une échelle (ajuster selon tes modèles)
          model.scale.set(0.01, 0.01, 0.01);

          // Stocker les animations si présentes
          if (gltf.animations && gltf.animations.length > 0) {
            model.userData.animations = gltf.animations;
          }

          resolve(model);
        },
        undefined,
        (error) => {
          console.error(`❌ Erreur chargement modèle [${path}]:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Crée un mesh placeholder si le modèle n'est pas disponible
   */
  createPlaceholderMesh(npc, scene) {
    const color = this.categories[npc.categorie]?.color || "#6366f1";

    // Corps (cylindre)
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.8,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);

    // Tête (sphère)
    const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xffdbac,
      roughness: 0.8,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1;

    // Groupe
    const group = new THREE.Group();
    group.add(body);
    group.add(head);

    // Indicateur de direction (flèche blanche)
    const arrowGeometry = new THREE.ConeGeometry(0.15, 0.3, 4);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.rotation.x = Math.PI / 2;
    arrow.position.z = 0.4;
    arrow.position.y = 0.5;
    group.add(arrow);

    // Positionner
    group.position.set(
      npc.position.x,
      (npc.position.y || 0) + 0.75,
      npc.position.z
    );
    group.rotation.y = ((npc.rotation || 0) * Math.PI) / 180;

    // Métadonnées
    group.userData.isNPC = true;
    group.userData.npcId = npc.id;
    group.userData.npcData = npc;

    group.castShadow = true;

    npc.mesh = group;
    npc.model = group;
    scene.add(group);
  }

  /**
   * Crée un indicateur visuel au-dessus du PNJ
   */
  createNPCIndicator(npc, scene) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");

    // Fond semi-transparent arrondi
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.beginPath();
    ctx.roundRect(10, 5, 236, 54, 10);
    ctx.fill();

    // Icône selon le type
    ctx.font = "28px Arial";
    ctx.textAlign = "center";

    let icon = "💬";
    if (npc.isTrainer && !npc.isDefeated) {
      icon = "⚔️";
    } else if (npc.info?.donne_starter) {
      icon = "🎁";
    } else if (npc.info?.soigne_equipe || npc.info?.soigne) {
      icon = "💗";
    } else if (npc.info?.champion) {
      icon = "🏆";
    } else if (npc.info?.marchand) {
      icon = "🛒";
    }

    ctx.fillText(icon, 40, 42);

    // Nom
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";

    // Tronquer le nom si trop long
    let displayName = npc.nom;
    if (displayName.length > 15) {
      displayName = displayName.substring(0, 14) + "...";
    }
    ctx.fillText(displayName, 65, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 0.5, 1);

    // Positionner au-dessus du PNJ
    const height = npc.model ? 2.5 : 2.2;
    sprite.position.set(
      npc.position.x,
      (npc.position.y || 0) + height,
      npc.position.z
    );

    sprite.userData.isNPCIndicator = true;
    sprite.userData.npcId = npc.id;
    sprite.renderOrder = 999;
    npc.indicator = sprite;

    scene.add(sprite);
  }

  /**
   * Met à jour l'indicateur d'un PNJ (après victoire par exemple)
   */
  updateNPCIndicator(npc) {
    if (!npc.indicator) return;

    const scene = this.sceneManager.scenes.get(npc.sceneName);
    if (scene && npc.indicator.parent) {
      scene.remove(npc.indicator);
    }

    npc.indicator.material.dispose();
    npc.indicator.material.map?.dispose();

    if (scene) {
      this.createNPCIndicator(npc, scene);
    }
  }

  /**
   * Vérifie les interactions possibles avec les PNJ
   */
  checkInteractions(playerPosition, playerDirection) {
    // FIX ROBUSTE: Ne pas dépendre de activeZone (au cas où le joueur soit dans un "trou")
    // On veut trouver le PNJ le plus proche quoi qu'il arrive
    let candidates = [];

    const sceneName = this.sceneManager.activeSceneName;

    // 1. D'abord les PNJ de la scène active (fallback pour intérieurs)
    const activeSceneNPCs = this.npcs.get(sceneName);
    if (activeSceneNPCs) candidates.push({ npcs: activeSceneNPCs, offset: {x:0, z:0} });

    // 2. Si on est en mode World, scanner TOUTES les zones chargées
    if (sceneName === "world" && this.worldManager) {
        // Vider la liste par défaut car on va tout scanner proprement
        candidates = []; 
        for (const zone of this.worldManager.zones) {
            // Optimisation: ne checker que si on est pas trop loin du centre de la zone (ex: 500m)
            const dx = playerPosition.x - zone.worldX;
            const dz = playerPosition.z - zone.worldZ;
            // On prend large (500m) pour être sûr
            if (dx*dx + dz*dz < 250000) { 
                const zoneNPCs = this.npcs.get(zone.scene);
                if (zoneNPCs) {
                    candidates.push({ npcs: zoneNPCs, offset: {x: zone.worldX, z: zone.worldZ} });
                }
            }
        }
    }

    let nearestNPC = null;
    let nearestDistance = Infinity;

    // Parcourir tous les candidats de toutes les zones potentielles
    for (const group of candidates) {
        for (const npc of group.npcs) {
             // Calcul Position Monde
             const npcGlobalX = npc.position.x + group.offset.x;
             const npcGlobalZ = npc.position.z + group.offset.z;

             const dx = npcGlobalX - playerPosition.x;
             const dz = npcGlobalZ - playerPosition.z;
             const distance = Math.sqrt(dx * dx + dz * dz);
             
             const maxDist = npc.interactionDistance || this.interactionDistance;

             // Debug light
             // if (distance < 10) console.log(`🔍 Scan ${npc.nom} (WorldDist: ${distance.toFixed(1)})`);

             if (distance < maxDist && distance < nearestDistance) {
               nearestDistance = distance;
               nearestNPC = npc;
             }
        }
    }

    if (nearestNPC) {
         console.log(`🎯 Interaction trouvée: ${nearestNPC.nom}`);
    } else {
         console.warn("⚠️ Aucune interaction trouvée (Scan World complet)");
    }

    return nearestNPC;
  }

  update(delta, playerPosition) {
    if (Math.random() < 0.05) console.log(`🔄 NPC Update Running (Scene=${this.sceneManager.activeSceneName})`);

    // Si dialogue ou combat en cours, ne rien faire
    if (this.sceneManager.isPaused || this.combatManager?.isInCombat) return;
    
    // ✅ FIX: Vérifier si le système de dialogue moderne est actif
    const dialogueSystem = this.sceneManager.ui?.dialogueSystem;
    if (dialogueSystem && dialogueSystem.isActive) return;

    // Fallback Legacy
    if (document.getElementById("dialogue-container")?.style.display === "block") return;

    // Vérifier la vision des dresseurs
    const spottedTrainer = this.checkTrainerVision(playerPosition, delta);
    
    if (spottedTrainer) {
      this.handleTrainerEncounter(spottedTrainer);
    }
  }

  handleTrainerEncounter(npc) {
    console.log(`❗ Dresseur repéré : ${npc.nom}`);
    
    // 1. Jouer le son / animation "!"
    if (this.sceneManager.ui?.dialogueSystem) {
        this.sceneManager.ui.dialogueSystem.showTrainerAlert();
    }

    // 2. Bloquer le jeu (à faire via SceneManager ou InputManager)
    // this.sceneManager.pauseGame(); // Si cette méthode existe

    // 3. Délai avant le dialogue
    setTimeout(() => {
        // Déclencher le dialogue "before_combat"
        this.sceneManager.ui.startDialogue(npc, "before_combat");
    }, 1000);
  }

  /**
   * Vérifie si un dresseur détecte le joueur
   */
  checkTrainerVision(playerPosition, delta = 0) {
    // Dans le mode WorldMap, les PNJ sont stockés par zone ("route1", etc.) mais la scène active est "world".
    // On doit donc vérifier TOUS les PNJ chargés.
    
    // DEBUG HEARTBEAT (every ~2 seconds)
    if (!this._lastDebugTime || Date.now() - this._lastDebugTime > 2000) {
        this._lastDebugTime = Date.now();
        let totalNPCs = 0;
        for (const list of this.npcs.values()) totalNPCs += list.length;
        
        console.log(`💓 NPC Heartbeat (Global): Loaded Scenes=${this.npcs.size}, Total NPCs=${totalNPCs}`);
    }

    // Gestion du cooldown
    if (this.trainerSpotCooldown > 0) {
      this.trainerSpotCooldown -= delta;
      return null;
    }

    // Parcourir toutes les listes de PNJ chargées
    for (const [sceneKey, sceneNPCs] of this.npcs) {
        if (!sceneNPCs) continue;

        // Calculer l'offset de zone si on est en WorldMap
        let worldOffset = { x: 0, z: 0 };
        const activeScene = this.sceneManager.activeSceneName;

        // SCENE PARITY CHECK (Critique pour éviter vision à travers les murs des maisons)
        if (activeScene !== "world") {
            // mode INTERIEUR: on ne checke QUE les PNJ de la scène active
            if (sceneKey !== activeScene) continue;
        } else {
            // mode WORLD: on checke les zones de l'outside, mais on ignore les intérieurs
            // On vérifie si la sceneKey correspond à une zone connue
            if (this.worldManager) {
                const zone = this.worldManager.zones.find(z => z.scene === sceneKey);
                if (!zone) continue; // Ignore les scènes qui ne sont pas des zones du monde
                worldOffset = { x: zone.worldX, z: zone.worldZ };
            }
        }

        for (const npc of sceneNPCs) {
          if (!npc.isTrainer || npc.isDefeated) continue;
          if (npc.isBattling) continue;
          if (npc.info?.champion === true || npc.isChampion === true) continue;
          if (npc.id === this.lastTrainerSpotted) continue;

          // Position Monde PNJ (Manuel pour robustesse)
          const npcWorldX = npc.position.x + worldOffset.x;
          const npcWorldZ = npc.position.z + worldOffset.z;

          // Distance Euclidienne Simple (First Pass)
          const dx = playerPosition.x - npcWorldX;
          const dz = playerPosition.z - npcWorldZ;
          const distance = Math.sqrt(dx * dx + dz * dz);

          // Si trop loin, next
          if (distance > this.trainerVisionDistance) continue;

          // --- LOGIQUE "VISION BOX" MANUELLE ---
          // On évite worldToLocal car le mesh peut être mal attaché en WorldMap
          const npcRotation = ((npc.rotation || 0) * Math.PI) / 180;
          
          // Rotation inverse pour mettre le joueur dans le référentiel PNJ
          // PNJ regarde vers -Z localement (ou +Z selon modèle, à vérifier)
          // Standard Pokemon 3D: Rotation 0 = Sud (+Z)? ou Nord (-Z)?
          // On assume que le modèle regarde vers sa rotation.
          
          // Math: Rotation du vecteur (dx, dz) par -npcRotation
          const angle = -npcRotation;
          const localX = dx * Math.cos(angle) - dz * Math.sin(angle);
          const localZ = dx * Math.sin(angle) + dz * Math.cos(angle);

          // Vérification Box
          // Zone de vision: Rectangle devant le PNJ
          // Z doit être positif (devant) et < distance
          // X doit être petit (largeur)
          
          // Note: Selon l'orientation du modèle, "Devant" peut être +Z ou -Z.
          // En ThreeJS standard, Forward est souvent -Z. Mais ici on teste +Z dans le code original context. 
          // Code orig: playerLocalPos.z > 0. Donc Devant = +Z local.
          
          // Debug Orientation
          // console.log(`📐 ${npc.nom}: Rot=${npc.rotation}, Angle=${angle.toFixed(2)}, Local=(${localX.toFixed(2)}, ${localZ.toFixed(2)})`);

          // FIX: On vérifie juste la distance et la largeur pour l'instant (360° vision si proche)
          // Cela corrige le cas où le modèle est orienté à l'envers
          const inZone = Math.abs(localZ) < this.trainerVisionDistance;
          const inWidth = Math.abs(localX) < 2.0; 

          if (inZone && inWidth) {
             // --- RAYCAST CHECK (Line of Sight) ---
             const eyeHeight = 1.5;
             const start = new THREE.Vector3(npcWorldX, npc.position.y + eyeHeight, npcWorldZ);
             const end = new THREE.Vector3(playerPosition.x, playerPosition.y + eyeHeight, playerPosition.z);
             const direction = new THREE.Vector3().subVectors(end, start).normalize();
             
             const raycaster = new THREE.Raycaster(start, direction, 0, distance);

             // FIX: Définir la caméra pour que les sprites puissent être raycastés
             if (this.camera) {
                 raycaster.camera = this.camera;
             }

             let obstacles = [];
             const activeSceneObj = this.sceneManager.scenes.get(this.sceneManager.activeSceneName);
             
             if (this.worldManager && this.sceneManager.activeSceneName === "world") {
                 if (this.worldManager.worldScene) obstacles.push(this.worldManager.worldScene);
             } else if (activeSceneObj) {
                 obstacles.push(activeSceneObj); 
             }
             
             let visible = true;
             
             if (obstacles.length > 0) {
                 const intersects = raycaster.intersectObjects(obstacles, true);
                 
                 for (const hit of intersects) {
                     // Ignorer le joueur
                     if (hit.object.userData.isPlayer) continue;

                     // Ignorer le PNJ lui-même (et ses enfants)
                     // On remonte la hiérarchie pour voir si l'objet appartient au PNJ
                     let isSelf = false;
                     let obj = hit.object;
                     while(obj) {
                         if (obj.uuid === npc.mesh?.uuid || obj.userData.isNPC) {
                             isSelf = true;
                             break;
                         }
                         obj = obj.parent;
                     }
                     if (isSelf) continue;
                     
                     // Si on touche un obstacle
                     const name = hit.object.name.toLowerCase();
                     const isIgnorable = name.includes("grass") || name.includes("water") || name.includes("trigger") || name.includes("zone");
                     
                     if (!isIgnorable) {
                         console.log(`🧱 Vue bloquée par ${hit.object.name} (${hit.distance.toFixed(1)}m)`);
                         visible = false;
                         break;
                     }
                 }
             }

             if (visible) {
                 console.log(`👀 ${npc.nom} vous a vu !`);
                 this.lastTrainerSpotted = npc.id;
                 this.trainerSpotCooldown = 3;
                 return npc;
             }
          }
        }
    }

    return null;

  }

  /**
   * Déclenche un dialogue avec un PNJ
   */
  startDialogue(npc) {
    const dialogueKey = this.getDialogueKey(npc);
    const dialogues = npc.info?.dialogues?.[dialogueKey] ||
      npc.info?.dialogues?.default || ["..."];

    return {
      npc: npc,
      dialogues: Array.isArray(dialogues) ? dialogues : [dialogues],
      key: dialogueKey,
      index: 0,
    };
  }

  /**
   * Détermine quelle ligne de dialogue utiliser
   */
  getDialogueKey(npc) {
    const info = npc.info;
    if (!info) return "default";

    // Vérifier les flags de progression
    if (info.champion && this.storyFlags.has(`badge_${info.badge}`)) {
      return "after_badge";
    }

    if (npc.isTrainer && npc.isDefeated) {
      return "after_defeat";
    }

    if (info.donne_starter && this.storyFlags.has("starter_choisi")) {
      return "apres_starter";
    }

    if (!this.storyFlags.has("starter_choisi") && info.donne_starter) {
      console.log(`[NPCManager] getDialogueKey: Offering starter (Key: choix_starter)`);
      return "choix_starter";
    }

    // Combat de dresseur
    if (npc.isTrainer && !npc.isDefeated) {
      return "before_combat";
    }

    // Soins
    if (info.soigne_equipe || info.soigne) {
      return "soin";
    }

    // Marchand
    if (info.marchand) {
      return "accueil";
    }

    return "default";
  }

  /**
   * Prépare les données pour un combat de dresseur
   */
  getTrainerBattleData(npc) {
    if (!npc.isTrainer || npc.isDefeated) return null;

    return {
      npc: npc,
      equipe: npc.info.equipe || npc.info.equipes?.default || [],
      argent: this.calculateMoney(npc),
      isChampion: npc.info.champion === true,
      badge: npc.info.badge || null,
      recompenses: npc.info.recompenses || null,
    };
  }

  /**
   * Calcule l'argent gagné contre un dresseur
   */
  calculateMoney(npc) {
    const baseRate = npc.info.argent_base || 20;
    const equipe = npc.info.equipe || [];
    const maxLevel = Math.max(...equipe.map((p) => p.niveau || 5), 5);

    return baseRate * maxLevel;
  }

  /**
   * Marque un dresseur comme vaincu
   */
  defeatTrainer(npcId) {
    this.defeatedTrainers.add(npcId);

    // Mettre à jour le PNJ
    for (const [sceneName, npcs] of this.npcs) {
      const npc = npcs.find((n) => n.id === npcId);
      if (npc) {
        npc.isDefeated = true;
        this.updateNPCIndicator(npc);
        break;
      }
    }

    // Reset le cooldown pour permettre de parler après victoire
    this.lastTrainerSpotted = null;
    this.trainerSpotCooldown = 0;
  }

  /**
   * Ajoute un flag de progression
   */
  addStoryFlag(flag) {
    this.storyFlags.add(flag);
    console.log(`📜 Flag ajouté: ${flag}`);
  }

  /**
   * Vérifie si un flag est actif
   */
  hasStoryFlag(flag) {
    return this.storyFlags.has(flag);
  }

  /**
   * Met à jour les PNJ (animations, indicateurs flottants)
   */
  update(delta) {
    const sceneName = this.sceneManager.activeSceneName;
    const sceneNPCs = this.npcs.get(sceneName);

    if (!sceneNPCs) return;

    const time = Date.now() * 0.003;

    for (const npc of sceneNPCs) {
      // Mettre à jour les animations
      if (npc.mixer) {
        npc.mixer.update(delta);
      }

      // Faire flotter l'indicateur légèrement
      if (npc.indicator) {
        const baseY = (npc.position.y || 0) + (npc.model ? 2.5 : 2.2);
        npc.indicator.position.y =
          baseY + Math.sin(time + npc.position.x) * 0.1;
      }
    }
  }

  /**
   * Fait tourner un PNJ vers le joueur
   */
  lookAtPlayer(npc, playerPosition) {
    if (!npc.model) return;

    const dx = playerPosition.x - npc.position.x;
    const dz = playerPosition.z - npc.position.z;
    const angle = Math.atan2(dx, dz);

    npc.model.rotation.y = angle;
    npc.rotation = (angle * 180) / Math.PI;
  }

  /**
   * Sauvegarde l'état des PNJ
   */
  getSaveData() {
    return {
      defeatedTrainers: Array.from(this.defeatedTrainers),
      talkedNPCs: Object.fromEntries(this.talkedNPCs),
      storyFlags: Array.from(this.storyFlags),
    };
  }

  /**
   * Charge l'état des PNJ
   */
  loadSaveData(data) {
    if (!data) return;

    this.defeatedTrainers = new Set(data.defeatedTrainers || []);
    this.talkedNPCs = new Map(Object.entries(data.talkedNPCs || {}));
    this.storyFlags = new Set(data.storyFlags || []);

    // Mettre à jour les PNJ chargés
    for (const [sceneName, npcs] of this.npcs) {
      for (const npc of npcs) {
        npc.isDefeated = this.defeatedTrainers.has(npc.id);
        npc.currentDialogueState = this.talkedNPCs.get(npc.id) || "default";
      }
    }
  }

  /**
   * Nettoie les ressources d'une scène
   */
  cleanupScene(sceneName) {
    const sceneNPCs = this.npcs.get(sceneName);
    if (!sceneNPCs) return;

    const scene = this.sceneManager.scenes.get(sceneName);

    for (const npc of sceneNPCs) {
      if (npc.model && scene) {
        scene.remove(npc.model);
      }
      if (npc.indicator && scene) {
        scene.remove(npc.indicator);
        npc.indicator.material.dispose();
        npc.indicator.material.map?.dispose();
      }
    }

    this.npcs.delete(sceneName);
  }
}
