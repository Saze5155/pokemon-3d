import * as THREE from "three";
import { DDSLoader } from "three/addons/loaders/DDSLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { Portal } from "../world/Portal.js";
import { CollisionCache } from "./CollisionCache.js";

/**
 * SceneManager - GÃ¨re toutes les scÃ¨nes du jeu
 * Version optimisÃ©e avec cache de collision
 */
export class SceneManager {
  constructor(renderer) {
    this.renderer = renderer;

    this.scenes = new Map();
    this.sceneData = new Map();
    this.activeSceneName = null;

    this.portals = [];

    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXLoader();
    const ddsLoader = new DDSLoader();
    THREE.DefaultLoadingManager.addHandler(/\.dds$/i, ddsLoader);
    this.objLoader = new OBJLoader();

    this.onSceneChange = null;
    this.onScenesLoaded = null;

    // === OPTIMISATION: Cache des objets de collision par scÃ¨ne ===
    this.collisionCache = new CollisionCache();

    // Gestionnaires d'événements multiples
    this.sceneChangeListeners = [];
  }

  addSceneChangeListener(callback) {
      this.sceneChangeListeners.push(callback);
  }

  createScene(name, config = {}) {
    const scene = new THREE.Scene();

    if (config.background) {
      scene.background = new THREE.Color(config.background);
    }

    if (config.fog) {
      scene.fog = new THREE.Fog(
        config.fog.color,
        config.fog.near,
        config.fog.far
      );
    }

    this.setupLights(scene, config.isInterior || false);
    this.scenes.set(name, scene);

    if (!this.activeSceneName) {
      this.activeSceneName = name;
    }

    return scene;
  }

  /**
   * Configure les lumiÃ¨res - OPTIMISÃ‰ pour les intÃ©rieurs (pas d'ombres)
   */
  setupLights(scene, isInterior = false) {
    if (isInterior) {
      const ambient = new THREE.AmbientLight(0xffffff, 2.0);
      scene.add(ambient);

      const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.0);
      hemi.position.set(0, 5, 0);
      scene.add(hemi);

      const sun = new THREE.DirectionalLight(0xffffff, 0.5);
      sun.position.set(2, 5, 2);
      sun.castShadow = false; // Pas d'ombres en intÃ©rieur
      scene.add(sun);
    } else {
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambient);

      const sun = new THREE.DirectionalLight(0xffffff, 0.8);
      sun.position.set(50, 100, 50);
      sun.castShadow = true;
      // Shadow map optimisÃ©e
      sun.shadow.camera.left = -80;
      sun.shadow.camera.right = 80;
      sun.shadow.camera.top = 80;
      sun.shadow.camera.bottom = -80;
      sun.shadow.mapSize.width = 1024; // RÃ©duit de 2048
      sun.shadow.mapSize.height = 1024;
      sun.shadow.bias = -0.0005;
      scene.add(sun);
    }
  }

  async loadSceneFromServer(name, url) {
    try {
      const response = await fetch(url);
      const data = await response.json();

      const scene = this.scenes.get(name);
      if (!scene) {
        console.error(`Scene "${name}" n'existe pas`);
        return;
      }

      this.sceneData.set(name, data);
      
      // FIX: Attacher les données de zone à la scène pour PokemonManager
      scene.userData.zoneData = data;

      await this.loadSceneData(data, scene);

      return data;
    } catch (error) {
      console.error(`Erreur chargement scÃ¨ne "${name}":`, error);
    }
  }

  async loadSceneData(data, targetScene) {
    if (data.isPrefabScene && data.prefabModel) {
      await this.loadPrefabModel(data, targetScene);
    } else {
      if (data.groundSize || data.groundWidth) {
        this.loadGround(data, targetScene);
      }
    }

    if (data.objects) {
      for (const objData of data.objects) {
        await this.loadObject(objData, targetScene);
      }
    }

    if (!data.isPrefabScene) {
      const groundWidth = data.groundWidth || data.groundSize;
      const groundHeight = data.groundHeight || data.groundSize;

      if (data.walls) {
        this.loadWalls(data.walls, targetScene, groundWidth, groundHeight);
      }

      if (data.ceiling) {
        this.loadCeiling(
          data.ceiling,
          targetScene,
          groundWidth,
          groundHeight,
          data.walls?.height
        );
      }
    }

    this.collisionCache.buildCacheForScene(
      this.activeSceneName || "default",
      targetScene
    );
  }

  loadPrefabModel(data, targetScene) {
    return new Promise((resolve) => {
      this.gltfLoader.load(data.prefabModel, (gltf) => {
        const prefab = gltf.scene;
        prefab.position.set(0, 0, 0);

        const scale = data.prefabScale || 1;
        prefab.scale.set(scale, scale, scale);

        prefab.traverse((child) => {
          // Marquer les groupes flange (mÃªme si pas un mesh)
          if (child.name.toLowerCase().includes("flange")) {
            child.userData.isFlange = true;
          }

          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // âœ… FIX: DÃ©sactiver le frustum culling sur CHAQUE mesh
            child.frustumCulled = false;

            const name = child.name.toLowerCase();

            // Collision classique
            const isCollision =
              name.includes("_col") ||
              child.parent?.name.toLowerCase().includes("_col");

            if (isCollision) {
              child.visible = false;
              child.userData.hasCollision = true;
              child.userData.isCollisionMesh = true;
            }

            // Flange (rebords) - vÃ©rifier aussi le parent
            if (
              name.includes("flange") ||
              child.parent?.name.toLowerCase().includes("flange")
            ) {
              child.visible = true;
              child.userData.isFlange = true;
            }
          }
        });

        prefab.traverse((child) => {
          if (child.userData?.isFlange) {
            child.frustumCulled = false; // Sur le groupe

            // DÃ©sactiver aussi sur TOUS les enfants du groupe flange
            child.traverse((subChild) => {
              subChild.frustumCulled = false;
              if (subChild.isMesh) {
                subChild.frustumCulled = false;
              }
            });
          }
        });

        // âœ… FIX CRUCIAL: DÃ©sactiver frustum culling sur le GROUP parent aussi
        prefab.frustumCulled = false;

        // âœ… FIX: Forcer la mise Ã  jour de la matrice monde
        prefab.updateMatrixWorld(true);

        prefab.userData.isPrefab = true;
        prefab.userData.modelPath = data.prefabModel;

        targetScene.add(prefab);
        resolve(prefab);
      });
    });
  }

  loadGround(data, targetScene) {
    const width = data.groundWidth || data.groundSize || 100;
    const height = data.groundHeight || data.groundSize || 100;
    const segments = data.groundSegments || 50;

    const groundGeo = new THREE.PlaneGeometry(
      width,
      height,
      segments,
      segments
    );
    const groundMat = new THREE.MeshStandardMaterial({
      color: data.groundColor || 0x3a9d23,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = "terrain";

    // âœ… FIX: DÃ©sactiver frustum culling sur le sol
    ground.frustumCulled = false;

    ground.userData.isGround = true;
    ground.userData.terrainWidth = width;
    ground.userData.terrainHeight = height;
    ground.userData.terrainSegments = segments;

    targetScene.add(ground);

    if (data.heightMap && data.heightMap.length > 0) {
      this.applyHeightMap(ground, data.heightMap);

      // âœ… FIX: Recalculer la bounding box aprÃ¨s heightmap
      ground.geometry.computeBoundingBox();
      ground.geometry.computeBoundingSphere();
    }
  }

  applyHeightMap(ground, heightMap) {
    const positions = ground.geometry.attributes.position;

    for (let i = 0; i < heightMap.length && i < positions.count; i++) {
      positions.setZ(i, heightMap[i]);
    }

    positions.needsUpdate = true;
    ground.geometry.computeVertexNormals();
    ground.userData.heightMap = heightMap;
  }

  loadObject(objData, targetScene) {
    return new Promise((resolve) => {
      const onLoad = async (obj) => {
        if (obj.scene) obj = obj.scene;
        this.setupLoadedObject(obj, objData, targetScene);
        resolve(obj);
      };

      if (objData.path.endsWith(".obj")) {
        this.objLoader.load(objData.path, onLoad);
      } else if (objData.path.endsWith(".fbx")) {
        this.fbxLoader.load(objData.path, onLoad);
      } else if (
        objData.path.endsWith(".glb") ||
        objData.path.endsWith(".gltf")
      ) {
        this.gltfLoader.load(objData.path, onLoad);
      } else {
        resolve(null);
      }
    });
  }

  setupLoadedObject(obj, objData, targetScene) {
    obj.position.set(
      objData.position.x,
      objData.position.y,
      objData.position.z
    );
    obj.rotation.set(
      objData.rotation.x,
      objData.rotation.y,
      objData.rotation.z
    );
    obj.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);

    obj.frustumCulled = false;

    obj.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        const isCollision =
          child.name.toLowerCase().includes("_colli") ||
          child.parent?.name.toLowerCase().includes("_colli");
        if (isCollision) {
          child.visible = true;
          child.material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
          });
          child.userData.hasCollision = true;
          child.userData.isCollisionMesh = true;
        } else {
          if (!child.material) {
            child.material = new THREE.MeshStandardMaterial({
              color: objData.color || 0xffffff,
              roughness: 0.7,
            });
          }
          child.castShadow = true;
          child.receiveShadow = true;

          if (objData.hasCollision) {
            child.userData.hasCollision = true;
          }
        }
      }
    });

    obj.userData = { ...objData };
    obj.userData.hasCollision = objData.hasCollision || false;

    targetScene.add(obj);
  }

  loadWalls(wallsData, targetScene, groundWidth, groundHeight) {
    if (groundHeight === undefined) {
      groundHeight = groundWidth;
    }

    const halfWidth = groundWidth / 2;
    const halfHeight = groundHeight / 2;
    const wallHalfHeight = wallsData.height / 2;

    const directions = ["north", "south", "east", "west"];
    directions.forEach((dir) => {
      if (!wallsData[dir]) return;

      const wallWidth =
        dir === "north" || dir === "south" ? groundWidth : groundHeight;

      const geometry = new THREE.PlaneGeometry(wallWidth, wallsData.height);
      const material = new THREE.MeshStandardMaterial({
        color: wallsData.color,
        side: THREE.DoubleSide,
      });

      const wall = new THREE.Mesh(geometry, material);
      wall.castShadow = true;
      wall.receiveShadow = true;
      wall.frustumCulled = false;
      switch (dir) {
        case "north":
          wall.position.set(0, wallHalfHeight, -halfHeight);
          break;
        case "south":
          wall.position.set(0, wallHalfHeight, halfHeight);
          wall.rotation.y = Math.PI;
          break;
        case "east":
          wall.position.set(halfWidth, wallHalfHeight, 0);
          wall.rotation.y = Math.PI / 2;
          break;
        case "west":
          wall.position.set(-halfWidth, wallHalfHeight, 0);
          wall.rotation.y = -Math.PI / 2;
          break;
      }

      wall.userData.hasCollision = true;
      wall.userData.isWall = true;
      targetScene.add(wall);
    });
  }

  loadCeiling(ceilingData, targetScene, groundWidth, groundHeight, wallHeight) {
    if (!ceilingData.enabled) return;

    if (wallHeight === undefined) {
      wallHeight = groundHeight;
      groundHeight = groundWidth;
    }

    const geometry = new THREE.PlaneGeometry(groundWidth, groundHeight);
    const material = new THREE.MeshStandardMaterial({
      color: ceilingData.color,
      side: THREE.DoubleSide,
    });

    const ceiling = new THREE.Mesh(geometry, material);
    ceiling.rotation.x = -Math.PI / 2;
    ceiling.position.y = wallHeight;
    ceiling.receiveShadow = true;
    ceiling.userData.hasCollision = false;
    ceiling.userData.isCeiling = true;

    targetScene.add(ceiling);
  }

  createPortals() {
    for (const [sceneName, data] of this.sceneData) {
      if (!data.portals || data.portals.length === 0) continue;

      const sourceScene = this.scenes.get(sceneName);
      if (!sourceScene) continue;

      data.portals.forEach((portalData) => {
        const targetScene = this.scenes.get(portalData.targetScene);
        if (!targetScene) {
          console.warn(`Scene cible "${portalData.targetScene}" non trouvÃ©e`);
          return;
        }
        const portal = new Portal(
          sourceScene,
          this.renderer,
          new THREE.Vector3(
            portalData.position.x,
            portalData.position.y,
            portalData.position.z
          ),
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

        this.portals.push({
          portal,
          name: portalData.name,
          sourceScene: sceneName,
          targetScene: portalData.targetScene,
          linkedPortalName: portalData.linkedPortalName || "",
          spawnPosition: portalData.spawnPosition,
          spawnRotation: portalData.spawnRotation,
        });
      });
    }

    this.linkPortals();
  }

  linkPortals() {
    for (const portalInfo of this.portals) {
      let destPortalInfo = null;

      if (portalInfo.linkedPortalName) {
        destPortalInfo = this.portals.find(
          (p) =>
            p.sourceScene === portalInfo.targetScene &&
            p.name === portalInfo.linkedPortalName
        );
      }

      if (!destPortalInfo) {
        destPortalInfo = this.portals.find(
          (p) =>
            p.sourceScene === portalInfo.targetScene &&
            p.targetScene === portalInfo.sourceScene
        );
      }

      if (destPortalInfo?.portal?.portalMesh) {
        const destPos = destPortalInfo.portal.portalMesh.position.clone();
        const destRot = new THREE.Euler(
          0,
          destPortalInfo.portal.portalMesh.rotation.y,
          0
        );
        portalInfo.portal.setLinkedPortal(destPos, destRot);
      } else {
        portalInfo.portal.setLinkedPortal(
          new THREE.Vector3(0, 1.6, 0),
          new THREE.Euler(0, 0, 0)
        );
        console.warn(`Pas de portail retour pour "${portalInfo.name}"`);
      }
    }
  }

  isNearPortal(position) {
    // Vérifier TOUS les portails, pas seulement ceux de la scène active
    for (const portalInfo of this.portals) {
      const portal = portalInfo.portal;
      if (!portal?.portalMesh) continue;

      // IMPORTANT: Utiliser getWorldPosition pour avoir la position réelle
      const portalWorldPos = new THREE.Vector3();
      portal.portalMesh.getWorldPosition(portalWorldPos);

      // Distance horizontale pour être plus permissif
      const dx = position.x - portalWorldPos.x;
      const dz = position.z - portalWorldPos.z;
      const flatDist = Math.sqrt(dx * dx + dz * dz);

      if (flatDist < 3) return true;
    }

    return false;
  }


  // Dans SceneManager.js - checkPortalCrossing

  checkPortalCrossing(playerPosition, lastPlayerSide) {
    if (this.portals.length === 0) return null;

    for (const portalInfo of this.portals) {
      // Vérifier la scène source - accepter aussi "world" pour le mode WorldMap
      if (portalInfo.sourceScene !== this.activeSceneName && portalInfo.sourceScene !== "world") continue;

      const portal = portalInfo.portal;
      if (!portal?.portalMesh) continue;

      // IMPORTANT: Utiliser getWorldPosition pour avoir la position réelle
      const portalWorldPos = new THREE.Vector3();
      portal.portalMesh.getWorldPosition(portalWorldPos);

      const dx = playerPosition.x - portalWorldPos.x;
      const dz = playerPosition.z - portalWorldPos.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);

      const portalHeight = portal.size?.height || 3;
      const verticalDiff = Math.abs(playerPosition.y - portalWorldPos.y);
      const inHeight = verticalDiff < portalHeight + 2;

      // Générer une clé unique pour le tracking (éviter collision de noms entre zones)
      const trackingKey = portalInfo.sourceZone 
        ? `${portalInfo.sourceZone}_${portalInfo.name}` 
        : portalInfo.name;

      // Initialiser si nécessaire
      if (lastPlayerSide[trackingKey] === undefined) {
        lastPlayerSide[trackingKey] = null;
      }

      // Zone de détection élargie pour le tracking
      if (horizontalDist < 3 && inHeight) {
        // Log de debug si proche
        // console.log(`🔍 Portail ${portalInfo.name} (${trackingKey}): dist=${horizontalDist.toFixed(2)}`);

        // Utiliser getWorldQuaternion pour la normale
        const portalNormal = new THREE.Vector3(0, 0, -1);
        const worldQuat = new THREE.Quaternion();
        portal.portalMesh.getWorldQuaternion(worldQuat);
        portalNormal.applyQuaternion(worldQuat);

        const toPlayer = new THREE.Vector3().subVectors(
          playerPosition,
          portalWorldPos
        );
        const dotProduct = toPlayer.dot(portalNormal);
        const currentSide = dotProduct > 0;

        // console.log(`🎯 ${trackingKey}: lastSide=${lastPlayerSide[trackingKey]}, currentSide=${currentSide}, dotProduct=${dotProduct.toFixed(2)}`);

        // Méthode 1: Traversée physique (changement de côté)
        if (horizontalDist < 1.5) {
          if (
            lastPlayerSide[trackingKey] !== null &&
            lastPlayerSide[trackingKey] !== currentSide
          ) {
            console.log(`✅ TRAVERSÉE DÉTECTÉE (changement côté) pour ${trackingKey} !`);
            lastPlayerSide[trackingKey] = null;
            lastPlayerSide[`${trackingKey}_timer`] = null;
            return portalInfo;
          }

          // Méthode 2: Timer de secours (si très proche pendant 0.5s)
          if (!lastPlayerSide[`${trackingKey}_timer`]) {
            lastPlayerSide[`${trackingKey}_timer`] = Date.now();
          }

          if (Date.now() - lastPlayerSide[`${trackingKey}_timer`] > 500) {
            console.log(`✅ TRAVERSÉE DÉTECTÉE (timer) pour ${trackingKey} !`);
            lastPlayerSide[trackingKey] = null;
            lastPlayerSide[`${trackingKey}_timer`] = null;
            return portalInfo;
          }
        } else {
          // Réinitialiser le timer si on s'éloigne
          lastPlayerSide[`${trackingKey}_timer`] = null;
        }

        // Toujours mettre à jour le côté actuel
        lastPlayerSide[trackingKey] = currentSide;
      } else if (horizontalDist > 10) {
        // Reset seulement si VRAIMENT loin (augmenté de 5 à 10)
        lastPlayerSide[trackingKey] = null;
        lastPlayerSide[`${trackingKey}_timer`] = null;
      }
    }

    return null;
  }

  teleportToScene(portalInfo, camera, game = null) {
    console.log("🚀 DÉBUT TÉLÉPORTATION:", portalInfo.name, "->", portalInfo.targetScene);
    console.log("📋 Portal info:", JSON.stringify({
      name: portalInfo.name,
      sourceScene: portalInfo.sourceScene,
      targetScene: portalInfo.targetScene,
      linkedPortalName: portalInfo.linkedPortalName,
      sourceZone: portalInfo.sourceZone
    }));

    let destPortal = null;
    let needsZoneOffset = false;

    // Liste des zones WorldMap pour savoir si on doit appliquer l'offset
    const worldMapZones = ["bourg-palette", "route1", "argenta", "route2", "jadeto2", "foret-jade", "jadielle", "route2nord"];

    // DEBUG: Lister les portails disponibles qui pourraient correspondre
    console.log("🔎 Portails disponibles pour target=" + portalInfo.targetScene + ":");
    this.portals.forEach(p => {
      if (p.targetScene === portalInfo.sourceScene || p.sourceScene === portalInfo.targetScene || p.sourceZone === portalInfo.targetScene) {
        console.log(`   - ${p.name}: sourceScene=${p.sourceScene}, sourceZone=${p.sourceZone}, targetScene=${p.targetScene}, zoneOffset=${JSON.stringify(p.zoneOffset)}`);
      }
    });

    // PRIORITÉ 1: Si on sort d'un intérieur vers une zone WorldMap,
    // chercher le portail WorldMap (sourceScene="world", sourceZone=targetScene)
    if (!destPortal) {
      destPortal = this.portals.find(
        (p) =>
          p.sourceScene === "world" &&
          p.sourceZone === portalInfo.targetScene &&
          p.targetScene === portalInfo.sourceScene
      );
      if (destPortal) console.log("🔍 Trouvé via WorldMap sourceZone");
    }

    // PRIORITÉ 2: Recherche par linkedPortalName
    if (!destPortal && portalInfo.linkedPortalName) {
      destPortal = this.portals.find(
        (p) =>
          p.sourceScene === portalInfo.targetScene &&
          p.name === portalInfo.linkedPortalName
      );
      if (destPortal) {
        console.log("🔍 Trouvé via linkedPortalName");
        // Si c'est un portail classique mais qu'on va vers une zone WorldMap, on doit appliquer l'offset
        if (destPortal.sourceScene !== "world" && worldMapZones.includes(portalInfo.targetScene)) {
          needsZoneOffset = true;
        }
      }
    }

    // PRIORITÉ 3: chercher un portail qui revient vers la scène source
    if (!destPortal) {
      destPortal = this.portals.find(
        (p) =>
          p.sourceScene === portalInfo.targetScene &&
          p.targetScene === portalInfo.sourceScene
      );
      if (destPortal) {
        console.log("🔍 Trouvé via sourceScene/targetScene match");
        // Si c'est un portail classique mais qu'on va vers une zone WorldMap, on doit appliquer l'offset
        if (destPortal.sourceScene !== "world" && worldMapZones.includes(portalInfo.targetScene)) {
          needsZoneOffset = true;
        }
      }
    }

    // PRIORITÉ 4: Fallback pour les portails WorldMap (sourceZone)
    if (!destPortal && portalInfo.sourceZone) {
      destPortal = this.portals.find(
        (p) =>
          p.sourceScene === portalInfo.targetScene &&
          p.targetScene === portalInfo.sourceZone
      );
      if (destPortal) console.log("🔍 Trouvé via portalInfo.sourceZone");
    }

    console.log("📍 Portail destination trouvé:", destPortal ? `${destPortal.name} (sourceScene: ${destPortal.sourceScene}, sourceZone: ${destPortal.sourceZone})` : "AUCUN");
    console.log("📍 needsZoneOffset:", needsZoneOffset);

    // Calculer la position de destination
    let destPos, destRot;
    if (destPortal?.portal?.portalMesh) {
      // Utiliser getWorldPosition pour obtenir la position en coordonnées monde
      destPos = new THREE.Vector3();
      destPortal.portal.portalMesh.getWorldPosition(destPos);
      destRot = destPortal.portal.portalMesh.rotation.y;

      console.log(`📍 Position brute du portail: (${destPos.x.toFixed(2)}, ${destPos.y.toFixed(2)}, ${destPos.z.toFixed(2)})`);

      // Si on a trouvé un portail classique mais qu'on est en mode WorldMap,
      // on doit appliquer le zoneOffset manuellement
      if (needsZoneOffset && game?.worldManager?.worldMapData) {
        const zone = game.worldManager.zones.find(z => z.scene === portalInfo.targetScene);
        if (zone) {
          console.log(`📍 Application du zoneOffset pour ${portalInfo.targetScene}: (${zone.worldX}, ${zone.worldZ})`);
          destPos.x += zone.worldX;
          destPos.z += zone.worldZ;
        }
      }

      const offset = new THREE.Vector3(0, 0, 1.5);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), destRot);
      destPos.add(offset);

      // En mode VR, camera est le playerRig qui doit être au sol (Y=0)
      // En mode desktop, camera est la vraie caméra qui doit être à hauteur des yeux (Y=1.6)
      const isVRRig = camera.isGroup || !camera.isCamera;
      destPos.y = isVRRig ? 0 : 1.6;

      console.log(`📍 Position destination finale: (${destPos.x.toFixed(2)}, ${destPos.y.toFixed(2)}, ${destPos.z.toFixed(2)}) [VR Rig: ${isVRRig}]`);
    } else {
      // Position par défaut si pas de portail retour
      const isVRRig = camera.isGroup || !camera.isCamera;
      destPos = new THREE.Vector3(0, isVRRig ? 0 : 1.6, 0);
      destRot = 0;
      console.warn(
        `Aucun portail de destination trouvé pour "${portalInfo.name}"`
      );
    }

    // Appliquer la position
    camera.position.copy(destPos);
    camera.rotation.set(0, destRot + Math.PI, 0);

    console.log(`📍 Position appliquée à ${camera.isGroup ? 'playerRig' : 'camera'}: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);

    // Mettre à jour la scène active AVANT le callback
    this.activeSceneName = portalInfo.targetScene;
    console.log("🎯 Scène active changée en:", this.activeSceneName);

    const isInterior = !worldMapZones.includes(portalInfo.targetScene);

    // Si camera est le VR Rig (Group), on ne peut pas changer le FOV directement
    if (camera.isCamera) {
        camera.fov = isInterior ? 85 : 75;
        camera.updateProjectionMatrix();
    }



    // Appeler le callback de changement de scène (Legacy)
    console.log("📞 Calling onSceneChange callback if exists. Callback is:", this.onSceneChange ? "FUNCTION" : "NULL");
    if (this.onSceneChange) {
      this.onSceneChange(portalInfo.targetScene);
    }
    
    // NOUVEAU : Appeler les listeners
    this.sceneChangeListeners.forEach(cb => cb(portalInfo.targetScene));
  }

  getActiveScene() {
    return this.scenes.get(this.activeSceneName);
  }

  /**
   * === OPTIMISÃ‰ === Retourne les objets avec collision (avec cache)
   */
  getCollisionObjects() {
    const scene = this.getActiveScene();
    if (!scene) return [];

    return this.collisionCache.getCollisions(this.activeSceneName);
  }

  /**
   * Invalide le cache de collision
   */
  invalidateCollisionCache(sceneName = null) {
    if (sceneName) {
      const cache = this.collisionCache.get(sceneName);
      if (cache) cache.dirty = true;
    } else {
      this.collisionCache.forEach((cache) => (cache.dirty = true));
    }
  }

  getTerrain() {
    const scene = this.getActiveScene();
    if (!scene) return null;

    return scene.children.find(
      (child) => child.name === "terrain" || child.userData?.isGround
    );
  }

  getTerrainHeight(x, z) {
    const scene = this.getActiveScene();
    if (!scene) return 0;

    // NOUVEAU : Cache
    const cached = this.collisionCache.getTerrainHeight(
      x,
      z,
      this.activeSceneName
    );
    if (cached !== null) {
      return cached;
    }

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(x, 50, z),
      new THREE.Vector3(0, -1, 0),
      0,
      100
    );

    // NOUVEAU : Utiliser le cache
    const floors = this.collisionCache.getFloors(this.activeSceneName);

    const hits = raycaster.intersectObjects(floors, true);
    const height = hits.length > 0 ? hits[0].point.y : 0;

    // Stocker
    this.collisionCache.setTerrainHeight(x, z, height, this.activeSceneName);

    return height;
  }

  /**
   * === OPTIMISÉ === Update seulement les portails proches
   */
  updatePortals(camera) {
    const maxRenderDistance = 30; // Distance pour render la texture
    const maxVisibleDistance = 50; // Distance pour voir le portail
    const cameraPos = camera.position;

    for (const portalInfo of this.portals) {
      // Seulement les portails de la scène courante ou world
      if (
        portalInfo.sourceScene !== this.activeSceneName &&
        portalInfo.sourceScene !== "world"
      )
        continue;

      const portal = portalInfo.portal;
      if (!portal?.portalMesh) continue;

      // IMPORTANT: Utiliser getWorldPosition pour avoir la position réelle
      const portalWorldPos = new THREE.Vector3();
      portal.portalMesh.getWorldPosition(portalWorldPos);

      // Calculer la distance au portail
      const distance = cameraPos.distanceTo(portalWorldPos);

      if (distance > maxVisibleDistance) {
        // Trop loin - invisible
        portal.portalMesh.visible = false;
      } else if (distance > maxRenderDistance) {
        // Distance moyenne - visible mais couleur unie
        portal.portalMesh.visible = true;
        portal.portalMesh.material.color.setHex(0x4444ff);
        // Ne pas faire le render de la scène
      } else {
        // Proche - render complet
        portal.portalMesh.visible = true;
        portal.update(camera);
      }
    }
  }

  checkFlangeCollision(currentPos, newPos, playerHeight = 1.6) {
    const scene = this.getActiveScene();
    if (!scene) return false;

    const flanges = [];
    scene.traverse((child) => {
      if (child.userData?.isFlange) {
        child.traverse((subChild) => {
          if (subChild.isMesh) {
            subChild.updateMatrixWorld(true);
            flanges.push(subChild);
          }
        });
      }
    });

    if (flanges.length === 0) return false;

    // Direction du mouvement
    const direction = new THREE.Vector3(
      newPos.x - currentPos.x,
      0,
      newPos.z - currentPos.z
    );

    const distance = direction.length();
    if (distance < 0.001) return false;

    direction.normalize();

    // Raycast horizontal depuis la position actuelle (au niveau des pieds/genoux)
    const feetY = currentPos.y - playerHeight;

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(currentPos.x, feetY + 0.5, currentPos.z),
      direction,
      0,
      distance + 0.5
    );

    const hits = raycaster.intersectObjects(flanges, true);

   

    if (hits.length > 0) {
      return true;
    }

    return false;
  }

  render(camera) {
    const scene = this.getActiveScene();
    if (scene) {
      this.renderer.render(scene, camera);
    }
  }
}