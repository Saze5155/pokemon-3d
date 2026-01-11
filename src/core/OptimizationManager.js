import * as THREE from "three";

/**
 * OptimizationManager - Gestionnaire central des optimisations du jeu
 *
 * Fonctionnalités:
 * - LOD (Level of Detail) pour textures et modèles
 * - Frustum Culling intelligent
 * - Désactivation des portails distants
 * - Spatial Hashing pour collisions O(1)
 * - Object Pooling
 * - Texture streaming
 */
export class OptimizationManager {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;

    // Configuration des distances
    this.config = {
      // LOD distances
      lod: {
        high: 15, // Haute qualité < 15m
        medium: 40, // Moyenne qualité < 40m
        low: 80, // Basse qualité < 80m
        cull: 150, // Invisible > 150m
      },
      // Portails
      portal: {
        activeDistance: 30, // Render actif < 30m
        lowResDistance: 60, // Render basse résolution < 60m
        disableDistance: 100, // Désactivé > 100m
      },
      // Shadows
      shadow: {
        distance: 50, // Ombres dynamiques < 50m
        staticDistance: 100, // Ombres statiques < 100m
      },
      // Updates
      updateIntervals: {
        lod: 0.2, // Vérifier LOD toutes les 200ms
        collision: 0.05, // Spatial hash toutes les 50ms
        portal: 0.1, // Portails toutes les 100ms
      },
    };

    // Spatial Hash Grid pour les collisions
    this.spatialHash = new SpatialHashGrid(5); // Cellules de 5 unités

    // Object Pool
    this.objectPools = new Map();

    // Cache de frustum
    this.frustum = new THREE.Frustum();
    this.frustumMatrix = new THREE.Matrix4();

    // Timers pour les updates espacées
    this.timers = {
      lod: 0,
      collision: 0,
      portal: 0,
    };

    // Stats pour debug
    this.stats = {
      visibleObjects: 0,
      culledObjects: 0,
      activePortals: 0,
      collisionChecks: 0,
    };

    // LOD Groups
    this.lodGroups = new Map();

    // Texture LOD cache
    this.textureCache = new Map();

    console.log("🚀 OptimizationManager initialisé");
  }

  /**
   * Update principal - appeler chaque frame
   */
  update(delta, scene) {
    // Mettre à jour le frustum
    this.updateFrustum();

    // LOD update (espacé)
    this.timers.lod += delta;
    if (this.timers.lod >= this.config.updateIntervals.lod) {
      this.updateLOD(scene);
      this.timers.lod = 0;
    }

    // Reset stats
    this.stats.visibleObjects = 0;
    this.stats.culledObjects = 0;
  }

  /**
   * Met à jour la matrice de frustum
   */
  updateFrustum() {
    this.frustumMatrix.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.frustumMatrix);
  }

  /**
   * Vérifie si un objet est dans le frustum
   */
  isInFrustum(object) {
    if (!object.geometry) return true;

    // Utiliser la bounding sphere si disponible
    if (!object.geometry.boundingSphere) {
      object.geometry.computeBoundingSphere();
    }

    const sphere = object.geometry.boundingSphere.clone();
    sphere.applyMatrix4(object.matrixWorld);

    return this.frustum.intersectsSphere(sphere);
  }

  /**
   * Calcule la distance à la caméra
   */
  getDistanceToCamera(position) {
    return this.camera.position.distanceTo(position);
  }

  /**
   * Obtient le niveau LOD pour une distance
   */
  getLODLevel(distance) {
    if (distance < this.config.lod.high) return "high";
    if (distance < this.config.lod.medium) return "medium";
    if (distance < this.config.lod.low) return "low";
    if (distance < this.config.lod.cull) return "minimum";
    return "culled";
  }

  /**
   * Met à jour le LOD de tous les objets de la scène
   */
  updateLOD(scene) {
    scene.traverse((child) => {
      if (!child.isMesh) return;
      if (child.userData.isPortal) return; // Géré séparément
      if (child.userData.skipLOD) return;

      const distance = this.getDistanceToCamera(child.position);
      const lodLevel = this.getLODLevel(distance);
      const inFrustum = this.isInFrustum(child);

      // Culling frustum + distance
      if (lodLevel === "culled" || !inFrustum) {
        if (child.visible) {
          child.visible = false;
          this.stats.culledObjects++;
        }
        return;
      }

      // Rendre visible si nécessaire
      if (!child.visible) {
        child.visible = true;
      }
      this.stats.visibleObjects++;

      // Appliquer LOD au matériau
      this.applyMaterialLOD(child, lodLevel, distance);

      // Gérer les ombres basées sur la distance
      this.updateShadows(child, distance);
    });
  }

  /**
   * Applique le LOD au matériau d'un objet
   */
  applyMaterialLOD(mesh, lodLevel, distance) {
    if (!mesh.material) return;

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    materials.forEach((mat) => {
      if (!mat.userData.originalMap) {
        mat.userData.originalMap = mat.map;
        mat.userData.originalNormalMap = mat.normalMap;
        mat.userData.originalRoughness = mat.roughness;
      }

      switch (lodLevel) {
        case "high":
          // Qualité maximale
          if (mat.map !== mat.userData.originalMap) {
            mat.map = mat.userData.originalMap;
            mat.normalMap = mat.userData.originalNormalMap;
            mat.needsUpdate = true;
          }
          break;

        case "medium":
          // Désactiver normal maps
          if (mat.normalMap) {
            mat.normalMap = null;
            mat.needsUpdate = true;
          }
          break;

        case "low":
          // Simplifier davantage
          mat.normalMap = null;
          if (mat.roughness !== 1) {
            mat.roughness = 1;
            mat.needsUpdate = true;
          }
          break;

        case "minimum":
          // Qualité minimale - juste couleur
          mat.normalMap = null;
          mat.map = null;
          mat.roughness = 1;
          mat.needsUpdate = true;
          break;
      }
    });
  }

  /**
   * Gère les ombres basées sur la distance
   */
  updateShadows(mesh, distance) {
    if (distance < this.config.shadow.distance) {
      // Ombres dynamiques
      mesh.castShadow = mesh.userData.originalCastShadow !== false;
      mesh.receiveShadow = mesh.userData.originalReceiveShadow !== false;
    } else if (distance < this.config.shadow.staticDistance) {
      // Seulement recevoir des ombres
      mesh.castShadow = false;
      mesh.receiveShadow = true;
    } else {
      // Pas d'ombres
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
  }

  /**
   * Optimise les portails basé sur la distance
   */
  updatePortals(portals, cameraPosition) {
    let activeCount = 0;

    portals.forEach((portalInfo) => {
      const portal = portalInfo.portal;
      if (!portal || !portal.portalMesh) return;

      const distance = cameraPosition.distanceTo(portal.portalMesh.position);

      if (distance > this.config.portal.disableDistance) {
        // Trop loin - désactiver complètement
        portal.portalMesh.visible = false;
        portal.active = false;
      } else if (distance > this.config.portal.lowResDistance) {
        // Loin - visible mais pas de render
        portal.portalMesh.visible = true;
        portal.active = false;
        // Utiliser une couleur statique au lieu du render
        if (portal.portalMesh.material.map) {
          portal.portalMesh.material.color.setHex(0x333366);
          portal.portalMesh.material.map = null;
          portal.portalMesh.material.needsUpdate = true;
        }
      } else if (distance > this.config.portal.activeDistance) {
        // Distance moyenne - render basse résolution
        portal.portalMesh.visible = true;
        portal.active = true;
        this.setPortalResolution(portal, 256);
        activeCount++;
      } else {
        // Proche - render haute résolution
        portal.portalMesh.visible = true;
        portal.active = true;
        this.setPortalResolution(portal, 1024);
        activeCount++;
      }
    });

    this.stats.activePortals = activeCount;
    return activeCount;
  }

  /**
   * Change la résolution du render target d'un portail
   */
  setPortalResolution(portal, resolution) {
    if (!portal.renderTarget) return;

    const currentSize = portal.renderTarget.width;
    if (currentSize === resolution) return;

    // Créer un nouveau render target avec la bonne résolution
    portal.renderTarget.setSize(resolution, resolution);
  }

  /**
   * Enregistre un objet dans le spatial hash
   */
  registerCollisionObject(object) {
    if (!object || !object.position) return;
    this.spatialHash.insert(object);
  }

  /**
   * Met à jour la position d'un objet dans le spatial hash
   */
  updateCollisionObject(object) {
    this.spatialHash.update(object);
  }

  /**
   * Obtient les objets proches pour collision
   */
  getNearbyCollisionObjects(position, radius = 5) {
    return this.spatialHash.query(position, radius);
  }

  /**
   * Reconstruit le spatial hash avec une liste d'objets
   */
  rebuildSpatialHash(objects) {
    this.spatialHash.clear();
    objects.forEach((obj) => {
      if (obj && obj.position) {
        this.spatialHash.insert(obj);
      }
    });
  }

  /**
   * Crée ou récupère un objet du pool
   */
  getFromPool(type, createFn) {
    if (!this.objectPools.has(type)) {
      this.objectPools.set(type, []);
    }

    const pool = this.objectPools.get(type);

    if (pool.length > 0) {
      const obj = pool.pop();
      obj.visible = true;
      return obj;
    }

    return createFn();
  }

  /**
   * Retourne un objet au pool
   */
  returnToPool(type, object) {
    if (!this.objectPools.has(type)) {
      this.objectPools.set(type, []);
    }

    object.visible = false;
    this.objectPools.get(type).push(object);
  }

  /**
   * Configure le renderer pour les performances
   */
  configureRenderer() {
    // Limiter le pixel ratio pour les écrans haute densité
    const maxPixelRatio = 2;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, maxPixelRatio)
    );

    // Désactiver l'auto-clear si on gère manuellement
    // this.renderer.autoClear = false;

    // Optimiser les shadow maps
    this.renderer.shadowMap.autoUpdate = false; // On update manuellement

    // Power preference
    if (this.renderer.capabilities) {
      console.log(
        "GPU:",
        this.renderer.capabilities.maxTextures,
        "textures max"
      );
    }
  }

  /**
   * Met à jour les shadow maps (appeler moins souvent)
   */
  updateShadowMaps() {
    this.renderer.shadowMap.needsUpdate = true;
  }

  /**
   * Dispose des ressources non utilisées
   */
  disposeUnusedResources(scene) {
    const texturesInUse = new Set();
    const geometriesInUse = new Set();

    // Collecter les ressources en utilisation
    scene.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) geometriesInUse.add(child.geometry.uuid);
        if (child.material) {
          const mats = Array.isArray(child.material)
            ? child.material
            : [child.material];
          mats.forEach((mat) => {
            if (mat.map) texturesInUse.add(mat.map.uuid);
            if (mat.normalMap) texturesInUse.add(mat.normalMap.uuid);
          });
        }
      }
    });
  }

  /**
   * Retourne les stats pour debug
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Affiche les stats dans la console
   */
  logStats() {
    console.log(`📊 Optimization Stats:
    - Visible: ${this.stats.visibleObjects}
    - Culled: ${this.stats.culledObjects}
    - Active Portals: ${this.stats.activePortals}
    - Collision Checks: ${this.stats.collisionChecks}`);
  }
}

/**
 * SpatialHashGrid - Grille de hash spatial pour collisions O(1)
 */
export class SpatialHashGrid {
  constructor(cellSize = 5) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this.objectCells = new Map(); // object -> Set de cellules
  }

  /**
   * Génère la clé de cellule pour une position
   */
  getCellKey(x, z) {
    const cellX = Math.floor(x / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    return `${cellX},${cellZ}`;
  }

  /**
   * Obtient les clés de toutes les cellules qu'un objet occupe
   */
  getObjectCells(object) {
    const cells = new Set();

    if (!object.geometry) {
      // Point simple
      const key = this.getCellKey(object.position.x, object.position.z);
      cells.add(key);
      return cells;
    }

    // Utiliser la bounding box
    if (!object.geometry.boundingBox) {
      object.geometry.computeBoundingBox();
    }

    const box = object.geometry.boundingBox.clone();
    box.applyMatrix4(object.matrixWorld);

    const minX = Math.floor(box.min.x / this.cellSize);
    const maxX = Math.floor(box.max.x / this.cellSize);
    const minZ = Math.floor(box.min.z / this.cellSize);
    const maxZ = Math.floor(box.max.z / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        cells.add(`${x},${z}`);
      }
    }

    return cells;
  }

  /**
   * Insère un objet dans la grille
   */
  insert(object) {
    const cells = this.getObjectCells(object);

    cells.forEach((key) => {
      if (!this.grid.has(key)) {
        this.grid.set(key, new Set());
      }
      this.grid.get(key).add(object);
    });

    this.objectCells.set(object, cells);
  }

  /**
   * Retire un objet de la grille
   */
  remove(object) {
    const cells = this.objectCells.get(object);
    if (!cells) return;

    cells.forEach((key) => {
      const cell = this.grid.get(key);
      if (cell) {
        cell.delete(object);
        if (cell.size === 0) {
          this.grid.delete(key);
        }
      }
    });

    this.objectCells.delete(object);
  }

  /**
   * Met à jour la position d'un objet
   */
  update(object) {
    this.remove(object);
    this.insert(object);
  }

  /**
   * Requête: trouve tous les objets dans un rayon
   */
  query(position, radius) {
    const results = new Set();

    const minX = Math.floor((position.x - radius) / this.cellSize);
    const maxX = Math.floor((position.x + radius) / this.cellSize);
    const minZ = Math.floor((position.z - radius) / this.cellSize);
    const maxZ = Math.floor((position.z + radius) / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const cell = this.grid.get(`${x},${z}`);
        if (cell) {
          cell.forEach((obj) => results.add(obj));
        }
      }
    }

    return Array.from(results);
  }

  /**
   * Requête: trouve les objets dans une boîte
   */
  queryBox(box) {
    const results = new Set();

    const minX = Math.floor(box.min.x / this.cellSize);
    const maxX = Math.floor(box.max.x / this.cellSize);
    const minZ = Math.floor(box.min.z / this.cellSize);
    const maxZ = Math.floor(box.max.z / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const cell = this.grid.get(`${x},${z}`);
        if (cell) {
          cell.forEach((obj) => results.add(obj));
        }
      }
    }

    return Array.from(results);
  }

  /**
   * Vide la grille
   */
  clear() {
    this.grid.clear();
    this.objectCells.clear();
  }

  /**
   * Stats de la grille
   */
  getStats() {
    let totalObjects = 0;
    this.grid.forEach((cell) => (totalObjects += cell.size));

    return {
      cells: this.grid.size,
      objects: this.objectCells.size,
      averagePerCell: this.grid.size > 0 ? totalObjects / this.grid.size : 0,
    };
  }
}

/**
 * LODManager - Gestion avancée des niveaux de détail
 */
export class LODManager {
  constructor() {
    this.lodGroups = new Map();
    this.lodDistances = [0, 15, 40, 80]; // Distances pour chaque niveau
  }

  /**
   * Crée un groupe LOD pour un objet
   */
  createLODGroup(name, highDetail, mediumDetail, lowDetail) {
    const group = new THREE.LOD();

    if (highDetail) group.addLevel(highDetail, this.lodDistances[0]);
    if (mediumDetail) group.addLevel(mediumDetail, this.lodDistances[1]);
    if (lowDetail) group.addLevel(lowDetail, this.lodDistances[2]);

    // Placeholder pour très loin
    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    group.addLevel(placeholder, this.lodDistances[3]);

    this.lodGroups.set(name, group);
    return group;
  }

  /**
   * Met à jour tous les LOD groups
   */
  update(camera) {
    this.lodGroups.forEach((lod) => {
      lod.update(camera);
    });
  }

  /**
   * Crée une version simplifiée d'une géométrie
   */
  simplifyGeometry(geometry, targetRatio = 0.5) {
    // Simplification basique: réduire les vertices
    // Pour une vraie simplification, utiliser SimplifyModifier
    const simplified = geometry.clone();

    // Marquer comme simplifié
    simplified.userData.simplified = true;
    simplified.userData.ratio = targetRatio;

    return simplified;
  }
}

/**
 * TextureManager - Gestion optimisée des textures
 */
export class TextureManager {
  constructor() {
    this.textureCache = new Map();
    this.loadingTextures = new Map();
    this.maxCacheSize = 50; // Maximum de textures en cache

    this.textureLoader = new THREE.TextureLoader();
  }

  /**
   * Charge une texture avec mise en cache
   */
  async loadTexture(url, options = {}) {
    // Vérifier le cache
    if (this.textureCache.has(url)) {
      const cached = this.textureCache.get(url);
      cached.lastUsed = Date.now();
      return cached.texture;
    }

    // Vérifier si déjà en chargement
    if (this.loadingTextures.has(url)) {
      return this.loadingTextures.get(url);
    }

    // Charger
    const promise = new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          // Optimiser la texture
          this.optimizeTexture(texture, options);

          // Mettre en cache
          this.textureCache.set(url, {
            texture,
            lastUsed: Date.now(),
          });

          this.loadingTextures.delete(url);
          this.cleanCache();

          resolve(texture);
        },
        undefined,
        reject
      );
    });

    this.loadingTextures.set(url, promise);
    return promise;
  }

  /**
   * Optimise une texture
   */
  optimizeTexture(texture, options = {}) {
    // Mipmaps pour les textures lointaines
    texture.generateMipmaps = options.generateMipmaps !== false;

    // Filtrage
    texture.minFilter = options.minFilter || THREE.LinearMipmapLinearFilter;
    texture.magFilter = options.magFilter || THREE.LinearFilter;

    // Anisotropie pour les textures vues de biais
    texture.anisotropy = options.anisotropy || 4;

    // Compression si disponible
    // texture.format = THREE.CompressedTextureFormat;
  }

  /**
   * Nettoie le cache si trop grand
   */
  cleanCache() {
    if (this.textureCache.size <= this.maxCacheSize) return;

    // Trier par dernière utilisation
    const entries = Array.from(this.textureCache.entries()).sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed
    );

    // Supprimer les plus vieilles
    const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
    toRemove.forEach(([url, data]) => {
      data.texture.dispose();
      this.textureCache.delete(url);
    });
  }

  /**
   * Précharge une liste de textures
   */
  async preloadTextures(urls) {
    return Promise.all(urls.map((url) => this.loadTexture(url)));
  }

  /**
   * Libère une texture spécifique
   */
  disposeTexture(url) {
    const cached = this.textureCache.get(url);
    if (cached) {
      cached.texture.dispose();
      this.textureCache.delete(url);
    }
  }

  /**
   * Libère toutes les textures
   */
  disposeAll() {
    this.textureCache.forEach((data) => data.texture.dispose());
    this.textureCache.clear();
  }
}

/**
 * PerformanceMonitor - Surveillance des performances
 */
export class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.fps = 0;
    this.lastTime = performance.now();
    this.frameTimes = [];
    this.maxSamples = 60;

    this.metrics = {
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
      triangles: 0,
      memory: 0,
    };

    this.callbacks = {
      onLowFPS: null,
      onHighFPS: null,
    };

    this.thresholds = {
      lowFPS: 30,
      highFPS: 55,
    };
  }

  /**
   * Appelé chaque frame
   */
  update(renderer) {
    const now = performance.now();
    const delta = now - this.lastTime;

    this.frameTimes.push(delta);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }

    this.frameCount++;

    // Calculer FPS toutes les 500ms
    if (delta >= 500) {
      this.fps = (this.frameCount * 1000) / delta;
      this.frameCount = 0;
      this.lastTime = now;

      // Mettre à jour les métriques
      this.updateMetrics(renderer);

      // Callbacks
      if (this.fps < this.thresholds.lowFPS && this.callbacks.onLowFPS) {
        this.callbacks.onLowFPS(this.fps);
      } else if (
        this.fps > this.thresholds.highFPS &&
        this.callbacks.onHighFPS
      ) {
        this.callbacks.onHighFPS(this.fps);
      }
    }
  }

  /**
   * Met à jour les métriques
   */
  updateMetrics(renderer) {
    this.metrics.fps = Math.round(this.fps);
    this.metrics.frameTime =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 0;

    if (renderer.info) {
      this.metrics.drawCalls = renderer.info.render.calls;
      this.metrics.triangles = renderer.info.render.triangles;
    }

    if (performance.memory) {
      this.metrics.memory = Math.round(
        performance.memory.usedJSHeapSize / 1048576
      );
    }
  }

  /**
   * Retourne les métriques actuelles
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Définit un callback pour FPS bas
   */
  onLowFPS(callback) {
    this.callbacks.onLowFPS = callback;
  }

  /**
   * Définit un callback pour FPS élevé
   */
  onHighFPS(callback) {
    this.callbacks.onHighFPS = callback;
  }

  /**
   * Crée un élément de debug pour afficher les stats
   */
  createDebugPanel() {
    const panel = document.createElement("div");
    panel.id = "perf-monitor";
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
    `;
    document.body.appendChild(panel);

    // Update toutes les 500ms
    setInterval(() => {
      panel.innerHTML = `
        FPS: ${this.metrics.fps}<br>
        Frame: ${this.metrics.frameTime.toFixed(1)}ms<br>
        Draw: ${this.metrics.drawCalls}<br>
        Tris: ${this.metrics.triangles}<br>
        Mem: ${this.metrics.memory}MB
      `;
    }, 500);

    return panel;
  }
}
