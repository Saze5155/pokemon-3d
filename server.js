const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Servir les fichiers statiques
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/src", express.static(path.join(__dirname, "src")));
app.use("/scenes", express.static(path.join(__dirname, "scenes")));

// ==================== ROUTES SCÃˆNES ====================

// Route pour sauvegarder une scÃ¨ne
app.post("/save-scene", (req, res) => {
  const sceneData = req.body;

  console.log("DonnÃ©es de scÃ¨ne reÃ§ues:", sceneData);

  // CrÃ©er le dossier scenes s'il n'existe pas
  const scenesDir = path.join(__dirname, "scenes");
  if (!fs.existsSync(scenesDir)) {
    fs.mkdirSync(scenesDir);
  }

  // GÃ©nÃ©rer le nom du fichier (slug du nom de la scÃ¨ne)
  const fileName =
    sceneData.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") + ".json";

  const filePath = path.join(scenesDir, fileName);

  // Sauvegarder le JSON
  fs.writeFile(filePath, JSON.stringify(sceneData, null, 2), "utf8", (err) => {
    if (err) {
      console.error("Erreur Ã©criture:", err);
      res.status(500).json({ error: "Erreur lors de la sauvegarde" });
      return;
    }

    console.log(`ScÃ¨ne sauvegardÃ©e: ${fileName}`);
    res.json({
      success: true,
      message: "ScÃ¨ne sauvegardÃ©e avec succÃ¨s",
      file: fileName,
      path: `/scenes/${fileName}`,
    });
  });
});

// Route pour lister tous les fichiers du dossier terrain
// Route pour lister tous les fichiers du dossier terrain
app.get("/list-models", (req, res) => {
  const basePath = path.join(__dirname, "assets/models");
  const categories = {
    bourgpalette: ["", "batiment"],
    argenta: ["", "batiment"],
  };

  const models = [];

  // Modèles à la racine
  if (fs.existsSync(basePath)) {
    const rootFiles = fs.readdirSync(basePath);
    rootFiles
      .filter(
        (file) =>
          file.endsWith(".obj") ||
          file.endsWith(".glb") ||
          file.endsWith(".gltf") ||
          file.endsWith(".fbx")
      )
      .forEach((file) => {
        models.push({
          name: file.replace(/\.(obj|glb|gltf|fbx)$/, "").replace(/_/g, " "),
          path: `assets/models/${file}`,
          type: "root",
          category: "root",
        });
      });
  }

  // Modèles dans les sous-dossiers
  Object.entries(categories).forEach(([mainCat, subCats]) => {
    subCats.forEach((subCat) => {
      const folderPath = subCat
        ? path.join(basePath, mainCat, subCat)
        : path.join(basePath, mainCat);

      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);

        files
          .filter(
            (file) =>
              file.endsWith(".obj") ||
              file.endsWith(".glb") ||
              file.endsWith(".gltf") ||
              file.endsWith(".fbx")
          )
          .forEach((file) => {
            models.push({
              name: file
                .replace(/\.(obj|glb|gltf|fbx)$/, "")
                .replace(/_/g, " "),
              path: subCat
                ? `assets/models/${mainCat}/${subCat}/${file}`
                : `assets/models/${mainCat}/${file}`,
              type: subCat || mainCat,

              category: mainCat,
            });
          });
      }
    });
  });

  res.json({ models });
});

// Route pour charger une scÃ¨ne
app.get("/load-scene/:name", (req, res) => {
  const sceneName = req.params.name;
  const filePath = path.join(__dirname, "scenes", `${sceneName}.json`);

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Erreur lecture:", err);
      res.status(404).json({ error: "ScÃ¨ne introuvable" });
      return;
    }

    res.json(JSON.parse(data));
  });
});

// Route pour lister toutes les scÃ¨nes
app.get("/list-scenes", (req, res) => {
  const scenesDir = path.join(__dirname, "scenes");

  if (!fs.existsSync(scenesDir)) {
    res.json({ scenes: [] });
    return;
  }

  fs.readdir(scenesDir, (err, files) => {
    if (err) {
      console.error("Erreur listage:", err);
      res.status(500).json({ error: "Erreur lors du listage" });
      return;
    }

    const sceneFiles = files
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.replace(".json", ""));

    res.json({ scenes: sceneFiles });
  });
});

// ==================== ROUTES SAUVEGARDES ====================

// Dossier des sauvegardes
const savesDir = path.join(__dirname, "saves");

// CrÃ©er le dossier saves s'il n'existe pas
if (!fs.existsSync(savesDir)) {
  fs.mkdirSync(savesDir);
  console.log("ðŸ“ Dossier saves crÃ©Ã©");
}

// Fichiers de sauvegarde par dÃ©faut
const defaultSaves = {
  sauvegarde_1: null,
  sauvegarde_2: null,
  sauvegarde_3: null,
};

const defaultMyPokemon = {
  sauvegarde_1: {},
  sauvegarde_2: {},
  sauvegarde_3: {},
};

// CrÃ©er les fichiers par dÃ©faut s'ils n'existent pas
const savesFilePath = path.join(savesDir, "sauvegarde.json");
const pokemonFilePath = path.join(savesDir, "mypokemon.json");

if (!fs.existsSync(savesFilePath)) {
  fs.writeFileSync(savesFilePath, JSON.stringify(defaultSaves, null, 2));
  console.log("ðŸ“„ Fichier sauvegarde.json crÃ©Ã©");
}

if (!fs.existsSync(pokemonFilePath)) {
  fs.writeFileSync(pokemonFilePath, JSON.stringify(defaultMyPokemon, null, 2));
  console.log("ðŸ“„ Fichier mypokemon.json crÃ©Ã©");
}

/**
 * GET /load-save
 * Charge toutes les sauvegardes
 */
app.get("/load-save", (req, res) => {
  console.log("ðŸ“‚ Chargement des sauvegardes...");

  fs.readFile(savesFilePath, "utf8", (err, data) => {
    if (err) {
      console.error("Erreur lecture sauvegarde:", err);
      res
        .status(500)
        .json({ error: "Erreur lors du chargement des sauvegardes" });
      return;
    }

    try {
      const saves = JSON.parse(data);
      console.log("âœ… Sauvegardes chargÃ©es");
      res.json(saves);
    } catch (parseErr) {
      console.error("Erreur parsing sauvegarde:", parseErr);
      res.json(defaultSaves);
    }
  });
});

/**
 * GET /load-mypokemon
 * Charge tous les PokÃ©mon capturÃ©s
 */
app.get("/load-mypokemon", (req, res) => {
  console.log("ðŸ“‚ Chargement des PokÃ©mon...");

  fs.readFile(pokemonFilePath, "utf8", (err, data) => {
    if (err) {
      console.error("Erreur lecture mypokemon:", err);
      res.status(500).json({ error: "Erreur lors du chargement des PokÃ©mon" });
      return;
    }

    try {
      const pokemon = JSON.parse(data);
      console.log("âœ… PokÃ©mon chargÃ©s");
      res.json(pokemon);
    } catch (parseErr) {
      console.error("Erreur parsing mypokemon:", parseErr);
      res.json(defaultMyPokemon);
    }
  });
});

/**
 * POST /save-game
 * Sauvegarde la partie (sauvegardes + PokÃ©mon)
 */
app.post("/save-game", (req, res) => {
  console.log("ðŸ’¾ Sauvegarde de la partie...");

  const { saves, pokemon } = req.body;

  if (!saves || !pokemon) {
    res.status(400).json({ error: "DonnÃ©es manquantes (saves ou pokemon)" });
    return;
  }

  // Sauvegarder les deux fichiers
  let savesWritten = false;
  let pokemonWritten = false;
  let errorOccurred = false;

  // Ã‰crire sauvegarde.json
  fs.writeFile(savesFilePath, JSON.stringify(saves, null, 2), "utf8", (err) => {
    if (err) {
      console.error("Erreur Ã©criture sauvegarde:", err);
      errorOccurred = true;
    } else {
      console.log("âœ… sauvegarde.json Ã©crit");
      savesWritten = true;
    }
    checkComplete();
  });

  // Ã‰crire mypokemon.json
  fs.writeFile(
    pokemonFilePath,
    JSON.stringify(pokemon, null, 2),
    "utf8",
    (err) => {
      if (err) {
        console.error("Erreur Ã©criture mypokemon:", err);
        errorOccurred = true;
      } else {
        console.log("âœ… mypokemon.json Ã©crit");
        pokemonWritten = true;
      }
      checkComplete();
    }
  );

  // VÃ©rifier quand les deux Ã©critures sont terminÃ©es
  function checkComplete() {
    if ((savesWritten || errorOccurred) && (pokemonWritten || errorOccurred)) {
      if (errorOccurred) {
        res.status(500).json({
          success: false,
          error: "Erreur lors de la sauvegarde",
        });
      } else {
        console.log("âœ… Partie sauvegardÃ©e avec succÃ¨s!");
        res.json({
          success: true,
          message: "Partie sauvegardÃ©e avec succÃ¨s",
        });
      }
    }
  }
});

/**
 * DELETE /delete-save/:slot
 * Supprime une sauvegarde spÃ©cifique (optionnel, peut Ãªtre utile)
 */
app.delete("/delete-save/:slot", (req, res) => {
  const slot = parseInt(req.params.slot);

  if (slot < 1 || slot > 3) {
    res.status(400).json({ error: "Slot invalide (1-3)" });
    return;
  }

  const key = `sauvegarde_${slot}`;
  console.log(`ðŸ—‘ï¸ Suppression du slot ${slot}...`);

  // Lire les fichiers actuels
  let saves, pokemon;

  try {
    saves = JSON.parse(fs.readFileSync(savesFilePath, "utf8"));
    pokemon = JSON.parse(fs.readFileSync(pokemonFilePath, "utf8"));
  } catch (err) {
    res.status(500).json({ error: "Erreur lecture fichiers" });
    return;
  }

  // Supprimer les donnÃ©es du slot
  saves[key] = null;
  pokemon[key] = {};

  // RÃ©Ã©crire les fichiers
  try {
    fs.writeFileSync(savesFilePath, JSON.stringify(saves, null, 2));
    fs.writeFileSync(pokemonFilePath, JSON.stringify(pokemon, null, 2));

    console.log(`âœ… Slot ${slot} supprimÃ©`);
    res.json({ success: true, message: `Slot ${slot} supprimÃ©` });
  } catch (err) {
    res.status(500).json({ error: "Erreur Ã©criture fichiers" });
  }
});

/**
 * GET /save-info
 * Retourne les infos rÃ©sumÃ©es des 3 slots (pour debug)
 */
app.get("/save-info", (req, res) => {
  try {
    const saves = JSON.parse(fs.readFileSync(savesFilePath, "utf8"));

    const info = [];
    for (let i = 1; i <= 3; i++) {
      const key = `sauvegarde_${i}`;
      const save = saves[key];

      if (save) {
        info.push({
          slot: i,
          empty: false,
          playerName: save.joueur?.nom || "???",
          badges: save.joueur?.badges?.filter((b) => b).length || 0,
          tempsJeu: save.joueur?.tempsJeu || 0,
          pokedex: save.pokedex?.captures?.length || 0,
          dateSauvegarde: save.dateSauvegarde,
        });
      } else {
        info.push({ slot: i, empty: true });
      }
    }

    res.json({ slots: info });
  } catch (err) {
    res.status(500).json({ error: "Erreur lecture sauvegardes" });
  }
});

// ==================== WORLD MAP ====================

// Sauvegarder la worldmap
app.post("/save-worldmap", (req, res) => {
  const worldMapData = req.body;

  const scenesDir = path.join(__dirname, "scenes");
  if (!fs.existsSync(scenesDir)) {
    fs.mkdirSync(scenesDir);
  }

  const filePath = path.join(scenesDir, "worldmap.json");

  fs.writeFile(
    filePath,
    JSON.stringify(worldMapData, null, 2),
    "utf8",
    (err) => {
      if (err) {
        console.error("Erreur écriture worldmap:", err);
        res.status(500).json({ error: "Erreur lors de la sauvegarde" });
        return;
      }

      console.log("🗺️ World Map sauvegardée");
      res.json({ success: true, message: "World Map sauvegardée" });
    }
  );
});

// Charger la worldmap
app.get("/load-worldmap", (req, res) => {
  const filePath = path.join(__dirname, "scenes", "worldmap.json");

  if (!fs.existsSync(filePath)) {
    res.json({ zones: [] });
    return;
  }

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Erreur lecture worldmap:", err);
      res.status(500).json({ error: "Erreur lecture worldmap" });
      return;
    }

    try {
      const worldMap = JSON.parse(data);
      res.json(worldMap);
    } catch (parseErr) {
      res.status(500).json({ error: "Erreur parsing worldmap" });
    }
  });
});

// ==================== DÉMARRAGE SERVEUR ====================

// DÃ©marrer le serveur
app.listen(PORT, () => {
  console.log(
    `\nðŸŽ® â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•`
  );
  console.log(`   SERVEUR POKÃ‰MON 3D`);

  console.log(`âœ… Serveur dÃ©marrÃ© sur http://localhost:${PORT}`);
  console.log(`ðŸ“ ScÃ¨nes: ${path.join(__dirname, "scenes")}`);
  console.log(`ðŸ’¾ Sauvegardes: ${savesDir}`);

  console.log(`ðŸ“Œ Routes disponibles:`);
  console.log(`   GET  /load-scene/:name    - Charger une scÃ¨ne`);
  console.log(`   POST /save-scene          - Sauvegarder une scÃ¨ne`);
  console.log(`   GET  /list-scenes         - Lister les scÃ¨nes`);
  console.log(`   GET  /list-models         - Lister les modÃ¨les 3D`);

  console.log(`   GET  /load-save           - Charger les sauvegardes`);
  console.log(`   GET  /load-mypokemon      - Charger les PokÃ©mon`);
  console.log(`   POST /save-game           - Sauvegarder la partie`);
  console.log(`   DEL  /delete-save/:slot   - Supprimer un slot`);
  console.log(`   GET  /save-info           - Infos des slots (debug)\n`);
});
