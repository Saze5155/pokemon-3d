/**
 * MaterialFixer - Utilitaire pour corriger les matériaux Three.js corrompus
 * Résout l'erreur "Cannot read properties of undefined (reading 'value')"
 */

/**
 * Nettoie et corrige un matériau Three.js
 */
export function fixMaterial(material) {
  if (!material) return;

  // Liste des propriétés de texture qui peuvent causer des problèmes
  const textureProperties = [
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

  // Ne définir ces propriétés que si elles existent déjà
  // Ne JAMAIS les créer avec null
  textureProperties.forEach((prop) => {
    // Si la propriété existe et est null, la supprimer
    if (material[prop] === null) {
      delete material[prop];
    }
  });

  // Forcer la mise à jour du matériau
  material.needsUpdate = true;
}

/**
 * Corrige tous les matériaux d'un objet 3D récursivement
 */
export function fixObject3D(object) {
  if (!object) return;

  object.traverse((child) => {
    if (child.isMesh && child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((mat) => fixMaterial(mat));
    }
  });
}

/**
 * Corrige tous les matériaux d'une scène
 */
export function fixScene(scene) {
  if (!scene) return;

  console.log("🔧 Nettoyage des matériaux de la scène...");
  let fixedCount = 0;

  scene.traverse((child) => {
    if (child.isMesh && child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((mat) => {
        fixMaterial(mat);
        fixedCount++;
      });
    }
  });

  console.log(`✅ ${fixedCount} matériaux nettoyés`);
}

/**
 * Wrapper pour GLTFLoader qui corrige automatiquement les matériaux
 */
export function loadGLTFSafe(loader, path) {
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        // Corriger automatiquement tous les matériaux
        fixObject3D(gltf.scene);
        resolve(gltf);
      },
      undefined,
      (error) => {
        reject(error);
      }
    );
  });
}
