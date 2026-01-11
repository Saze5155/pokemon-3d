const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration
const INPUT_FOLDER = "./assets/sprites/pokemons";
const OUTPUT_FOLDER = "./assets/sprites/pokemons_glb";
const BLENDER_PATH =
  "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe";

// Créer dossier de sortie
if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
}

console.log("🔄 Conversion FBX vers GLB - Tous les Pokémons\n");

// Test Blender
console.log("🔍 Test de Blender...");
try {
  const version = execSync(`"${BLENDER_PATH}" --version`, { encoding: "utf8" });
  console.log("✅ Blender trouvé\n");
} catch (error) {
  console.error("❌ ERREUR: Blender non trouvé !");
  process.exit(1);
}

// Lire tous les fichiers FBX
const files = fs.readdirSync(INPUT_FOLDER);
const fbxFiles = files.filter(
  (file) => path.extname(file).toLowerCase() === ".fbx"
);

if (fbxFiles.length === 0) {
  console.log("❌ Aucun fichier FBX trouvé");
  process.exit(1);
}

console.log(`📁 ${fbxFiles.length} Pokémons à convertir\n`);
console.log("=".repeat(60));

let convertedCount = 0;
let errorCount = 0;
const errors = [];

// Convertir chaque fichier
for (let i = 0; i < fbxFiles.length; i++) {
  const file = fbxFiles[i];
  const inputPath = path.resolve(INPUT_FOLDER, file);
  const outputName = path.basename(file, ".fbx") + ".glb";
  const outputPath = path.resolve(OUTPUT_FOLDER, outputName);

  // Afficher progression
  const progress = Math.round(((i + 1) / fbxFiles.length) * 100);
  console.log(`\n[${i + 1}/${fbxFiles.length}] ${progress}% - ${file}`);

  // Script Python pour CE fichier
  const blenderScript = `
import bpy
import sys

# Nettoyer la scène
bpy.ops.wm.read_factory_settings(use_empty=True)

# Chemins
input_path = sys.argv[-2]
output_path = sys.argv[-1]

# Importer
bpy.ops.import_scene.fbx(filepath=input_path)

# Exporter
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB'
)
`;

  // Créer le script temporaire
  const scriptPath = path.join(__dirname, "temp_convert.py");
  fs.writeFileSync(scriptPath, blenderScript);

  try {
    const command = `"${BLENDER_PATH}" --background --python "${scriptPath}" -- "${inputPath}" "${outputPath}"`;

    execSync(command, {
      encoding: "utf8",
      stdio: "pipe",
      maxBuffer: 50 * 1024 * 1024,
    });

    // Vérifier la création
    if (fs.existsSync(outputPath)) {
      const outputStats = fs.statSync(outputPath);
      const sizeMB = (outputStats.size / 1024 / 1024).toFixed(2);
      console.log(`✅ ${outputName} - ${sizeMB} MB`);
      convertedCount++;
    } else {
      throw new Error("Fichier de sortie non créé");
    }
  } catch (error) {
    console.error(`❌ Erreur lors de la conversion`);
    errors.push(file);
    errorCount++;
  }

  // Nettoyer le script temporaire
  if (fs.existsSync(scriptPath)) {
    fs.unlinkSync(scriptPath);
  }
}

// Résumé final
console.log("\n" + "=".repeat(60));
console.log(`\n✅ Conversions réussies: ${convertedCount}/${fbxFiles.length}`);
console.log(`❌ Erreurs: ${errorCount}`);

if (errors.length > 0) {
  console.log("\n⚠️  Pokémons en erreur:");
  errors.forEach((file) => {
    console.log(`   - ${file}`);
  });
}

console.log("\n" + "=".repeat(60));
console.log(`\n📂 Fichiers GLB dans: ${OUTPUT_FOLDER}`);
