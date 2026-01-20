import * as THREE from "three";
import { CollisionCache } from "./CollisionCache.js";

/**
 * WorldManager - Gère le chargement dynamique des zones du monde
 * Charge/décharge les scènes selon la position du joueur
 */
export class WorldManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;

    // Données de la worldmap
    this.worldMapData = null;
    this.zones = []; // Zones définies dans worldmap.json

    // État du chargement
    this.loadedZones = new Set(); // Noms des zones chargées
    this.loadingZones = new Set(); // Zones en cours de chargement
    this.activeZone = null; // Zone où se trouve le joueur
    this.portals = []; // Portails du monde ouvert

    // Configuration
    // FIX: Augmenter les distances pour que les portails soient visibles de plus loin
    this.preloadDistance = 200; // Distance pour précharger une zone adjacente
    this.unloadDistance = 250; // Distance pour décharger une zone

    // Scène combinée pour le monde ouvert
    this.worldScene = null;
    this.zoneGroups = new Map(); // sceneName -> THREE.Group

    // Callback
    this.onZoneChange = null;

    // NOUVEAU : Cache de collision
    this.collisionCache = new CollisionCache();
  }

  /**
   * Charge la worldmap depuis le serveur
   */
  async loadWorldMap() {
    try {
      const response = await fetch("/load-worldmap");
      this.worldMapData = await response.json();

      if (this.worldMapData && this.worldMapData.zones) {
        this.zones = this.worldMapData.zones;
        // Charger les métadonnées de chaque zone
        for (const zone of this.zones) {
          await this.loadZoneMetadata(zone);
        }

        return true;
      }

      return false;
    } catch (err) {
      return false;
    }
  }

  /**
   * Charge les métadonnées d'une zone (taille, etc.) sans charger les objets
   */
  async loadZoneMetadata(zone) {
    try {
      const response = await fetch(
        `/load-scene/${zone.scene}`
      );
      const data = await response.json();

      zone.width = data.groundWidth || 100;
      zone.height = data.groundHeight || 100;
      zone.isInterior = data.isInterior || false;
      zone.isPrefab = data.isPrefabScene || false;
      zone.data = data;

      // Calculer les bounds de la zone en world space
      zone.bounds = {
        minX: zone.worldX - zone.width / 2,
        maxX: zone.worldX + zone.width / 2,
        minZ: zone.worldZ - zone.height / 2,
        maxZ: zone.worldZ + zone.height / 2,
      };
    } catch (err) {
      console.warn(
        `Impossible de charger les métadonnées de ${zone.scene}:`,
        err
      );
    }
  }

  /**
   * Initialise la scène du monde avec la zone de départ
   */
  async initWorld(startZoneName = null) {
    // Ne pas recréer si déjà initialisé
    if (this.worldScene) {
      console.log("🗺️ World scene déjà initialisée");
      this.sceneManager.activeSceneName = "world";
      return this.worldScene;
    }

    // Créer la scène du monde
    this.worldScene = new THREE.Scene();
    this.worldScene.background = new THREE.Color(0x87ceeb);
    this.worldScene.fog = new THREE.Fog(0x87ceeb, 50, 200); // Fog réduit

    // Lumières - Géré par WeatherManager maintenant
    // this.setupWorldLights();

    // Trouver la zone de départ
    let startZone = this.zones[0];
    if (startZoneName) {
      startZone =
        this.zones.find((z) => z.scene === startZoneName) || startZone;
    }

    if (startZone) {
      await this.loadZone(startZone.scene);
      this.activeZone = startZone;
    }

    // Enregistrer la scène dans le SceneManager
    this.sceneManager.scenes.set("world", this.worldScene);
    this.sceneManager.activeSceneName = "world";

    return this.worldScene;
  }

  /**
   * Configure les lumières de la scène monde
   * DÉSACTIVÉ: Géré par WeatherManager
   */
  setupWorldLights() {
    /*
    const ambient = new THREE.AmbientLight(0xffffff, 0.8); // Plus de lumière ambiante
    this.worldScene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.6); // Moins intense
    sun.position.set(50, 100, 50);
    sun.castShadow = true;

    // Shadow map réduite pour les perfs
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.mapSize.width = 1024; // Au lieu de 4096
    sun.shadow.mapSize.height = 1024;

    this.worldScene.add(sun);

    // Stocker pour ajuster dynamiquement
    this.sunLight = sun;
    */
  }

  /**
   * Charge une zone dans la scène monde
   */
  async loadZone(sceneName) {
    // Vérifier si déjà chargée ou en cours
    if (this.loadedZones.has(sceneName) || this.loadingZones.has(sceneName)) {
      return;
    }

    const zone = this.zones.find((z) => z.scene === sceneName);
    if (!zone || !zone.data) {
      console.warn(`Zone ${sceneName} non trouvée`);
      return;
    }

    console.log(`📥 Chargement zone: ${sceneName}`);
    this.loadingZones.add(sceneName);

    try {
      // Créer un groupe pour cette zone
      const zoneGroup = new THREE.Group();
      zoneGroup.name = `zone_${sceneName}`;
      zoneGroup.position.set(zone.worldX, 0, zone.worldZ);

      zoneGroup.frustumCulled = false;

      // Charger le contenu de la zone
      await this.loadZoneContent(zone, zoneGroup);

      // Ajouter à la scène
      this.worldScene.add(zoneGroup);
      this.zoneGroups.set(sceneName, zoneGroup);
      this.loadedZones.add(sceneName);

      // NOUVEAU : Construire le cache
      this.collisionCache.buildCacheForScene(`zone_${sceneName}`, zoneGroup);

      // ✅ FIX: Recalculer la hauteur sur _ground
      if (this.sceneManager.npcManager) {
          this.sceneManager.npcManager.snapNPCsToGround(sceneName);
      }



    } catch (err) {
      console.error(`Erreur chargement zone ${sceneName}:`, err);
    } finally {
      this.loadingZones.delete(sceneName);
    }
  }

  /**
   * Charge le contenu d'une zone dans son groupe
   */
  async loadZoneContent(zone, zoneGroup) {
    const data = zone.data;

    // Terrain
    if (!data.isPrefabScene) {
      const ground = this.createGround(data);
      zoneGroup.add(ground);
    }

    // Modèle préfab
    if (data.isPrefabScene && data.prefabModel) {
      const prefab = await this.loadPrefabModel(data);
      if (prefab) {
        zoneGroup.add(prefab);
      }
    }

    // Objets
    if (data.objects) {
      for (const objData of data.objects) {
        const obj = await this.sceneManager.loadObject(objData, zoneGroup);
      }
    }

    // Portails - stocker ET signaler qu'il faut les créer
    if (data.portals && data.portals.length > 0) {
      const newPortals = [];
      for (const portalData of data.portals) {
        const portalInfo = {
          ...portalData,
          sourceZone: zone.scene,
          zoneOffset: { x: zone.worldX, z: zone.worldZ },
        };
        this.portals.push(portalInfo);
        newPortals.push(portalInfo);
      }

      // Callback pour créer les portails dans le jeu
      if (this.onPortalsLoaded) {
        this.onPortalsLoaded(newPortals);
      }
    }

    // Stocker les données pour les collisions
    zoneGroup.userData.zoneData = data;
    zoneGroup.userData.zoneName = zone.scene;
    zoneGroup.userData.bounds = zone.bounds;

    // ✅ CHARGEMENT DES PNJ
    if (this.sceneManager.npcManager) {
        // IMPORTANT: On passe le nom de la scène (ex: "route1") et les données
        // Le NPCManager va gérer leur création et placement
        await this.sceneManager.npcManager.loadNPCsForScene(zone.scene, data);
    }
  }

  /**
   * Crée le terrain d'une zone
   */
  createGround(data) {
    const width = data.groundWidth || 100;
    const height = data.groundHeight || 100;
    const segments = data.groundSegments || 50;

    const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
    const material = new THREE.MeshStandardMaterial({
      color: data.groundColor || 0x3a9d23,
    });

    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = "terrain";
    ground.userData.isGround = true;
    ground.userData.hasCollision = false; // Le terrain ne bloque pas
    ground.frustumCulled = false;

    // Appliquer heightmap
    if (data.heightMap && data.heightMap.length > 0) {
      const positions = geometry.attributes.position;
      for (let i = 0; i < data.heightMap.length && i < positions.count; i++) {
        positions.setZ(i, data.heightMap[i]);
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      ground.userData.heightMap = data.heightMap;
    }

    return ground;
  }

  /**
   * Charge un modèle préfab
   */
  loadPrefabModel(data) {
    return new Promise((resolve) => {
      this.sceneManager.gltfLoader.load(
        data.prefabModel,
        (gltf) => {
          const prefab = gltf.scene;
          const scale = data.prefabScale || 1;
          prefab.scale.set(scale, scale, scale);

          prefab.traverse((child) => {
            if (child.name.toLowerCase().includes("flange")) {
              child.userData.isFlange = true;
            }

            if (child.isMesh) {
              child.castShadow = false; // Désactiver shadows pour perfs
              child.receiveShadow = true;
              child.frustumCulled = false;
              const name = child.name.toLowerCase();

              // Collision classique
              const isCollision =
                name.includes("_col") ||
                child.parent?.name.toLowerCase().includes("_col");

              if (isCollision) {
                child.visible = false; // GARDER INVISIBLE
                child.userData.hasCollision = true;
                child.userData.isCollisionMesh = true;
              }
            }
          });
          prefab.frustumCulled = false;
          resolve(prefab);
        },
        undefined,
        (err) => {
          console.error("Erreur chargement prefab:", err);
          resolve(null);
        }
      );
    });
  }

  /**
   * Décharge une zone de la scène
   */
  unloadZone(sceneName) {
    if (!this.loadedZones.has(sceneName)) return;

    console.log(`🗑️ Déchargement zone: ${sceneName}`);

    const zoneGroup = this.zoneGroups.get(sceneName);
    if (zoneGroup) {
      // Nettoyer les ressources
      zoneGroup.traverse((child) => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              if (m.map) m.map.dispose();
              if (m.normalMap) m.normalMap.dispose();
              m.dispose();
            });
          } else {
            if (child.material.map) child.material.map.dispose();
            if (child.material.normalMap) child.material.normalMap.dispose();
            child.material.dispose();
          }
        }
      });

      this.worldScene.remove(zoneGroup);
      this.zoneGroups.delete(sceneName);
    }

    // Invalider le cache
    this.collisionCache.invalidateScene(`zone_${sceneName}`);

    // Supprimer les portails de cette zone
    this.portals = this.portals.filter((p) => p.sourceZone !== sceneName);

    // ✅ NETTOYAGE DES PNJ
    if (this.sceneManager.npcManager) {
        this.sceneManager.npcManager.clearNPCsForScene(sceneName);
    }

    this.loadedZones.delete(sceneName);
  }

  /**
   * Met à jour le chargement des zones selon la position du joueur
   */
  update(playerPosition) {
    if (!this.worldMapData || this.zones.length === 0 || !this.worldScene) return;

    const px = playerPosition.x;
    const pz = playerPosition.z;

    // Trouver la zone où se trouve le joueur
    let currentZone = null;
    for (const zone of this.zones) {
      if (this.isInZone(px, pz, zone)) {
        currentZone = zone;
        break;
      }
    }

    // Changement de zone ?
    if (currentZone && currentZone !== this.activeZone) {
      const oldZone = this.activeZone;
      this.activeZone = currentZone;

      console.log(
        `🗺️ Changement de zone: ${oldZone?.scene || "none"} → ${
          currentZone.scene
        }`
      );

      if (this.onZoneChange) {
        this.onZoneChange(currentZone.scene, oldZone?.scene);
      }
    }

    // Précharger les zones proches
    for (const zone of this.zones) {
      const distance = this.distanceToZone(px, pz, zone);

      if (
        distance < this.preloadDistance &&
        !this.loadedZones.has(zone.scene)
      ) {
        this.loadZone(zone.scene);
      } else if (
        distance > this.unloadDistance &&
        this.loadedZones.has(zone.scene) &&
        zone !== this.activeZone
      ) {
        this.unloadZone(zone.scene);
      }
    }

    // Log périodique
    if (!this._lastLogTime || Date.now() - this._lastLogTime > 3000) {
      console.log(
        `🗺️ Zones chargées: ${this.loadedZones.size}/${this.zones.length}`,
        Array.from(this.loadedZones)
      );
      this._lastLogTime = Date.now();
    }
  }

  /**
   * Vérifie si un point est dans une zone
   */
  isInZone(x, z, zone) {
    if (!zone.bounds) return false;
    return (
      x >= zone.bounds.minX &&
      x <= zone.bounds.maxX &&
      z >= zone.bounds.minZ &&
      z <= zone.bounds.maxZ
    );
  }

  /**
   * Calcule la distance au centre d'une zone
   */
  distanceToZone(x, z, zone) {
    const dx = x - zone.worldX;
    const dz = z - zone.worldZ;
    return Math.sqrt(dx * dx + dz * dz);
  }

  getTerrainHeight(worldX, worldZ) {
    // NOUVEAU : Vérifier le cache d'abord
    const cached = this.collisionCache.getTerrainHeight(
      worldX,
      worldZ,
      "world"
    );
    if (cached !== null) {
      return cached;
    }

    // Cache miss - calculer
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(worldX, 50, worldZ),
      new THREE.Vector3(0, -1, 0),
      0,
      100
    );

    // NOUVEAU : Utiliser le cache
    let floors = [];
    for (const [sceneName, zoneGroup] of this.zoneGroups) {
      const cachedFloors = this.collisionCache.getFloors(`zone_${sceneName}`);
      floors.push(...cachedFloors);
    }

    // FIX: Fallback si aucun floor trouvé (cas des modèles mal nommés comme Route 2)
    if (floors.length === 0 && this.worldScene) {
        //  console.warn("⚠️ Aucun sol détecté via le cache. Scan complet de la zone...");
         this.worldScene.traverse(child => {
             if (child.isMesh) floors.push(child);
         });
    }

    const hits = raycaster.intersectObjects(floors, false);
    // Si toujours rien, on assume Y=0
    const height = hits.length > 0 ? hits[0].point.y : 0;

    // NOUVEAU : Stocker dans le cache
    this.collisionCache.setTerrainHeight(worldX, worldZ, height, "world");

    return height;
  }

  /**
   * Vérifie collision avec les _flange (rebords)
   */
  checkFlangeCollision(currentPos, newPos, playerHeight = 1.6) {
    if (!newPos) {
      newPos = currentPos;
      currentPos = newPos;
    }

    const feetY = currentPos.y - playerHeight;

    const direction = new THREE.Vector3(
      newPos.x - currentPos.x,
      0,
      newPos.z - currentPos.z
    );

    const distance = direction.length();
    if (distance < 0.001) return false;

    direction.normalize();

    // NOUVEAU : Utiliser le cache au lieu de traverse
    const flanges = [];
    for (const [sceneName, zoneGroup] of this.zoneGroups) {
      const cachedFlanges = this.collisionCache.getFlanges(`zone_${sceneName}`);
      if (cachedFlanges && cachedFlanges.length > 0) {
        flanges.push(...cachedFlanges);
      }
    }

    // Si aucun flange dans la zone, skip
    if (flanges.length === 0) return false;

    // Tester à plusieurs hauteurs (pieds -> tête)
    const testHeights = [
      feetY + 0.1, // Pieds
      feetY + 0.4, // Chevilles
      feetY + 0.7, // Genoux
      feetY + 1.0, // Hanches
      feetY + 1.3, // Poitrine
      feetY + 1.6, // Tête
    ];

    for (const height of testHeights) {
      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(currentPos.x, height, currentPos.z),
        direction,
        0,
        distance + 0.5
      );

      const hits = raycaster.intersectObjects(flanges, false); // false car déjà des meshes
      if (hits.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Vérifie les collisions dans les zones chargées
   */
  checkCollision(position, playerRadius = 0.3, playerHeight = 1.6) {
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
    
    // Si près d'un portail, ignore les collisions pour éviter d'être coincé
    if (this.sceneManager.isNearPortal(position)) {
        return false;
    }

    // NOUVEAU : Utiliser le cache
    for (const [sceneName, zoneGroup] of this.zoneGroups) {
      const cachedCollisions = this.collisionCache.getCollisions(
        `zone_${sceneName}`
      );

      for (const child of cachedCollisions) {
        const box = new THREE.Box3().setFromObject(child);
        if (box.intersectsBox(playerBox)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Retourne les données des portails pour que SceneManager les crée
   */
  getPortalsForSceneManager() {
    return this.portals;
  }

  /**
   * Récupère tous les objets de collision des zones chargées
   */
  getCollisionObjects() {
    const objects = [];

    for (const [sceneName, zoneGroup] of this.zoneGroups) {
      zoneGroup.traverse((child) => {
        if (child.isMesh && child.userData?.hasCollision) {
          objects.push(child);
        }
      });
    }

    return objects;
  }

  /**
   * Vérifie si le joueur est au-dessus d'un flange (peut sauter)
   */
  isAboveFlange(position, direction, playerHeight = 1.6) {
    const feetY = position.y - playerHeight;

    // Tester plusieurs directions (pas juste devant)
    const testDirections = [
      direction.clone().normalize(), // Devant
      new THREE.Vector3(direction.z, 0, -direction.x).normalize(), // Droite
      new THREE.Vector3(-direction.z, 0, direction.x).normalize(), // Gauche
      new THREE.Vector3(-direction.x, 0, -direction.z).normalize(), // Derrière
    ];

    // NOUVEAU : Récupérer les floors depuis le cache
    const floors = [];
    for (const [sceneName, zoneGroup] of this.zoneGroups) {
      const cachedFloors = this.collisionCache.getFloors(`zone_${sceneName}`);
      floors.push(...cachedFloors);
    }

    if (floors.length === 0) {
      return { canJump: false, landingY: 0, landingX: 0, landingZ: 0 };
    }

    // Tester chaque direction
    for (const testDir of testDirections) {
      const forwardPos = new THREE.Vector3(
        position.x + testDir.x * 1.5,
        position.y,
        position.z + testDir.z * 1.5
      );

      const raycaster = new THREE.Raycaster(
        forwardPos,
        new THREE.Vector3(0, -1, 0),
        0,
        20
      );

      const floorHits = raycaster.intersectObjects(floors, false);

      for (const hit of floorHits) {
        if (hit.point.y < feetY - 0.5) {
          return {
            canJump: true,
            landingY: hit.point.y,
            landingX: forwardPos.x,
            landingZ: forwardPos.z,
          };
        }
      }
    }

    return { canJump: false, landingY: 0, landingX: 0, landingZ: 0 };
  }

  /**
   * Récupère la position de spawn pour une zone
   */
  getZoneSpawnPosition(sceneName) {
    const zone = this.zones.find((z) => z.scene === sceneName);
    if (zone) {
      return new THREE.Vector3(zone.worldX, 1.6, zone.worldZ);
    }
    return new THREE.Vector3(0, 1.6, 0);
  }

  /**
   * Vérifie si le mode worldmap est actif
   */
  isWorldMapMode() {
    return this.worldMapData && this.zones.length > 0;
  }
}
