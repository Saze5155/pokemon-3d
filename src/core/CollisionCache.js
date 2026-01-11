/**
 * CollisionCache - Cache intelligent pour les collisions
 * S'intègre sans modifier la logique existante
 */
export class CollisionCache {
  constructor() {
    // Cache par scène
    this.floorCache = new Map(); // sceneName -> [meshes]
    this.flangeCache = new Map(); // sceneName -> [meshes]
    this.collisionCache = new Map(); // sceneName -> [meshes]

    // Cache de hauteur terrain (évite les raycasts répétés)
    this.terrainHeightCache = new Map(); // "x_z" -> height
    this.cacheLifetime = 1000; // 1 seconde
    this.lastCacheTime = new Map();
  }

  /**
   * Précharge les meshes d'une scène
   * Appeler UNE FOIS quand une scène est chargée
   */
  buildCacheForScene(sceneName, scene) {
    const floors = [];
    const flanges = [];
    const collisions = [];

    scene.traverse((child) => {
      if (!child.isMesh) return;

      const name = child.name.toLowerCase();
      const parentName = child.parent?.name?.toLowerCase() || "";

      // Floors
      if (
        name.includes("_floor") ||
        parentName.includes("_floor") ||
        name.includes("_sol") ||
        name.includes("floor") ||
        name.includes("ground") ||
        name.includes("terrain")
      ) {
        child.updateMatrixWorld(true);
        floors.push(child);
      }

      // Flanges - logique corrigée
      if (child.userData?.isFlange) {
        // C'est un groupe flange, on traverse ses enfants
        child.traverse((subChild) => {
          if (subChild.isMesh && subChild !== child) {
            subChild.updateMatrixWorld(true);
            flanges.push(subChild);
          }
        });
      } else if (name.includes("flange") || parentName.includes("flange")) {
        // Mesh directement nommé flange
        child.updateMatrixWorld(true);
        flanges.push(child);
      }

      // Collisions
      if (child.userData?.hasCollision) {
        child.updateMatrixWorld(true);
        collisions.push(child);
      }
    });

    this.floorCache.set(sceneName, floors);
    this.flangeCache.set(sceneName, flanges);
    this.collisionCache.set(sceneName, collisions);

    console.log(`🗂️ Cache construit pour ${sceneName}:`, {
      floors: floors.length,
      flanges: flanges.length,
      collisions: collisions.length,
    });
  }

  /**
   * Obtient les floors avec cache
   */
  getFloors(sceneName) {
    return this.floorCache.get(sceneName) || [];
  }

  /**
   * Obtient les flanges avec cache
   */
  getFlanges(sceneName) {
    return this.flangeCache.get(sceneName) || [];
  }

  /**
   * Obtient les collisions avec cache
   */
  getCollisions(sceneName) {
    return this.collisionCache.get(sceneName) || [];
  }

  /**
   * Cache de hauteur terrain
   */
  getTerrainHeight(x, z, key = "default") {
    const cacheKey = `${key}_${Math.floor(x * 2)}_${Math.floor(z * 2)}`;
    const cached = this.terrainHeightCache.get(cacheKey);

    if (cached !== undefined) {
      const age = Date.now() - (this.lastCacheTime.get(cacheKey) || 0);
      if (age < this.cacheLifetime) {
        return cached;
      }
    }

    return null;
  }

  /**
   * Stocke une hauteur dans le cache
   */
  setTerrainHeight(x, z, height, key = "default") {
    const cacheKey = `${key}_${Math.floor(x * 2)}_${Math.floor(z * 2)}`;
    this.terrainHeightCache.set(cacheKey, height);
    this.lastCacheTime.set(cacheKey, Date.now());
  }

  /**
   * Invalide le cache d'une scène (quand elle change)
   */
  invalidateScene(sceneName) {
    this.floorCache.delete(sceneName);
    this.flangeCache.delete(sceneName);
    this.collisionCache.delete(sceneName);
  }

  /**
   * Nettoie le cache de terrain ancien
   */
  cleanTerrainCache() {
    const now = Date.now();
    for (const [key, time] of this.lastCacheTime.entries()) {
      if (now - time > this.cacheLifetime * 5) {
        this.terrainHeightCache.delete(key);
        this.lastCacheTime.delete(key);
      }
    }
  }
}
