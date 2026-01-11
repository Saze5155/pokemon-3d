/**
 * EntityTool - Outil de placement d'entités pour l'éditeur Pokémon 3D
 * Utilise un système d'onglets dans la sidebar gauche (Modèles | Entités)
 */

import * as THREE from "three";

export class EntityTool {
  constructor(editor) {
    this.editor = editor;
    this.scene = editor.scene;
    this.camera = editor.camera;
    this.raycaster = editor.raycaster;
    this.mouse = editor.mouse;
    this.ground = editor.infiniteGround || editor.ground;

    this.pokemonsData = {};
    this.pnjData = {};
    this.currentMode = null;
    this.selectedPnj = null;
    this.selectedPokemons = [];
    this.entities = [];
    this.spawnZones = [];
    this.isPlacing = false;
    this.currentEntity = null;
    this.zoneStart = null;
    this.zonePreview = null;
    this.entityCounter = 1;
    this.zoneCounter = 1;

    this.currentPokemonConfig = null;
    this.pokemonConfigs = new Map();

    this.loadData();
  }

  async loadData() {
    try {
      const pokemonRes = await fetch("data/pokemons.json");
      this.pokemonsData = await pokemonRes.json();
      console.log("📦 Pokémon chargés:", Object.keys(this.pokemonsData).length);

      try {
        const pnjRes = await fetch("data/pnj.json");
        if (pnjRes.ok) {
          this.pnjData = await pnjRes.json();
          console.log(
            "👥 PNJ chargés:",
            Object.keys(this.pnjData.pnj || {}).length
          );
        } else {
          this.pnjData = this.getDefaultPnjData();
        }
      } catch (e) {
        this.pnjData = this.getDefaultPnjData();
      }

      this.initUI();
    } catch (err) {
      console.error("Erreur chargement:", err);
      this.pnjData = this.getDefaultPnjData();
      this.initUI();
    }
  }

  getDefaultPnjData() {
    return {
      categories: {
        professeurs: { nom: "Professeurs", color: "#8B5CF6" },
        dresseurs: { nom: "Dresseurs", color: "#EF4444" },
        champions: { nom: "Champions", color: "#F59E0B" },
        marchands: { nom: "Marchands", color: "#10B981" },
        villageois: { nom: "Villageois", color: "#6B7280" },
      },
      pnj: {
        chen: { id: "chen", nom: "Prof. Chen", categorie: "professeurs" },
        rival: { id: "rival", nom: "Rival", categorie: "dresseurs" },
        pierre: { id: "pierre", nom: "Pierre", categorie: "champions" },
        vendeur: { id: "vendeur", nom: "Vendeur", categorie: "marchands" },
        villageois1: {
          id: "villageois1",
          nom: "Villageois",
          categorie: "villageois",
        },
      },
    };
  }

  initUI() {
    this.addStyles();
    this.createTabSystem();
    this.setupEvents();
  }

  addStyles() {
    if (document.getElementById("entity-tool-styles")) return;

    const style = document.createElement("style");
    style.id = "entity-tool-styles";
    style.textContent = `
      .sidebar-tabs { display:flex; border-bottom:1px solid var(--border); background:var(--bg-tertiary); }
      .sidebar-tab { flex:1; padding:12px 8px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--text-muted); font-size:11px; font-weight:600; font-family:inherit; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:6px; }
      .sidebar-tab:hover { color:var(--text-primary); background:var(--bg-hover); }
      .sidebar-tab.active { color:var(--accent); border-bottom-color:var(--accent); background:var(--bg-panel); }
      .tab-content { display:none; flex-direction:column; flex:1; overflow:hidden; }
      .tab-content.active { display:flex; }
      
      .entity-panel { display:flex; flex-direction:column; height:100%; }
      .entity-mode-selector { display:flex; gap:6px; padding:10px; background:var(--bg-tertiary); border-bottom:1px solid var(--border); }
      .entity-mode-btn { flex:1; padding:10px; background:var(--bg-hover); border:2px solid transparent; border-radius:6px; color:var(--text-secondary); font-size:11px; font-weight:500; cursor:pointer; transition:all 0.15s; display:flex; flex-direction:column; align-items:center; gap:4px; }
      .entity-mode-btn:hover { background:var(--bg-active); color:var(--text-primary); }
      .entity-mode-btn.active { border-color:var(--accent); background:var(--bg-active); color:var(--accent); }
      .entity-mode-btn .icon { font-size:18px; }
      
      .entity-subpanel { flex:1; overflow-y:auto; padding:10px; }
      .entity-section-title { font-size:10px; font-weight:600; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid var(--border); }
      
      .pnj-categories { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:10px; }
      .pnj-cat-btn { padding:4px 8px; font-size:9px; font-weight:500; border:none; border-radius:10px; cursor:pointer; opacity:0.7; color:#fff; transition:all 0.15s; }
      .pnj-cat-btn:hover, .pnj-cat-btn.active { opacity:1; transform:scale(1.05); }
      
      .pnj-list { display:flex; flex-direction:column; gap:4px; max-height:180px; overflow-y:auto; margin-bottom:10px; }
      .pnj-item { display:flex; align-items:center; gap:8px; padding:8px; background:var(--bg-hover); border:2px solid transparent; border-radius:6px; cursor:pointer; transition:all 0.15s; }
      .pnj-item:hover { background:var(--bg-active); }
      .pnj-item.selected { border-color:var(--accent); background:var(--bg-active); }
      .pnj-avatar { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; }
      .pnj-name { flex:1; font-size:11px; font-weight:500; color:var(--text-primary); }
      
      .pnj-properties { padding:10px; background:var(--bg-tertiary); border-radius:6px; margin-bottom:10px; }
      .prop-row { margin-bottom:8px; }
      .prop-label { font-size:10px; color:var(--text-muted); margin-bottom:4px; display:block; }
      .prop-input { width:100%; padding:6px 10px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:4px; color:var(--text-primary); font-size:12px; }
      .prop-input:focus { outline:none; border-color:var(--accent); }
      
      .pokemon-search input { width:100%; padding:8px 12px 8px 28px; background:var(--bg-tertiary); border:1px solid var(--border); border-radius:16px; color:var(--text-primary); font-size:11px; margin-bottom:8px; }
      .selected-pokemons { display:flex; flex-wrap:wrap; gap:4px; min-height:32px; padding:6px; background:var(--bg-tertiary); border-radius:4px; margin-bottom:8px; }
      .selected-pokemon-tag { display:flex; align-items:center; gap:4px; padding:3px 8px; background:var(--accent); border-radius:10px; font-size:9px; color:#fff; }
      .selected-pokemon-tag .remove { cursor:pointer; opacity:0.7; }
      .selected-pokemon-tag .remove:hover { opacity:1; }
      
      .pokemon-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:3px; max-height:150px; overflow-y:auto; }
      .pokemon-grid-item { padding:4px 2px; background:var(--bg-hover); border:2px solid transparent; border-radius:4px; cursor:pointer; text-align:center; transition:all 0.15s; }
      .pokemon-grid-item:hover { background:var(--bg-active); }
      .pokemon-grid-item.selected { border-color:var(--accent); background:var(--bg-active); }
      .pokemon-grid-item .num { font-size:7px; color:var(--text-muted); }
      .pokemon-grid-item .name { font-size:8px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      
      .entity-action-btn { width:100%; padding:10px; background:var(--accent); border:none; border-radius:6px; color:#fff; font-size:12px; font-weight:600; cursor:pointer; margin-top:10px; transition:all 0.15s; }
      .entity-action-btn:hover:not(:disabled) { background:var(--accent-hover); }
      .entity-action-btn:disabled { opacity:0.5; cursor:not-allowed; }
      
      .entities-footer { padding:10px; border-top:1px solid var(--border); background:var(--bg-tertiary); }
      .entities-header { display:flex; justify-content:space-between; align-items:center; font-size:10px; color:var(--text-muted); margin-bottom:8px; }
      .entity-count-badge { background:var(--accent); padding:2px 8px; border-radius:10px; color:#fff; font-weight:600; }
      .entities-list { max-height:100px; overflow-y:auto; }
      .entity-list-item { display:flex; align-items:center; justify-content:space-between; padding:6px 8px; background:var(--bg-hover); border-radius:4px; margin-bottom:4px; font-size:10px; }
      .entity-list-item .delete-btn { cursor:pointer; opacity:0.5; }
      .entity-list-item .delete-btn:hover { opacity:1; }
    `;
    document.head.appendChild(style);
  }

  createTabSystem() {
    const leftSidebar = document.querySelector(".sidebar-left");
    if (!leftSidebar) return;

    const existingHeader = leftSidebar.querySelector(".sidebar-header");
    if (!existingHeader) return;

    // Créer les onglets
    const tabHeader = document.createElement("div");
    tabHeader.className = "sidebar-tabs";
    tabHeader.innerHTML = `
      <button class="sidebar-tab active" data-tab="models">📦 Modèles</button>
      <button class="sidebar-tab" data-tab="entities">🎭 Entités</button>
    `;
    existingHeader.replaceWith(tabHeader);

    // Wrapper le contenu modèles
    const searchBox = leftSidebar.querySelector(".search-box");
    const sidebarContent = leftSidebar.querySelector(".sidebar-content");

    const modelsTab = document.createElement("div");
    modelsTab.id = "tab-models";
    modelsTab.className = "tab-content active";
    if (searchBox) modelsTab.appendChild(searchBox);
    if (sidebarContent) modelsTab.appendChild(sidebarContent);

    // Créer le contenu entités
    const entitiesTab = document.createElement("div");
    entitiesTab.id = "tab-entities";
    entitiesTab.className = "tab-content";
    entitiesTab.innerHTML = `
      <div class="entity-panel">
        <div class="entity-mode-selector">
          <button class="entity-mode-btn" data-mode="pnj"><span class="icon">👤</span><span>PNJ</span></button>
          <button class="entity-mode-btn" data-mode="zone"><span class="icon">🌿</span><span>Zone Spawn</span></button>
        </div>
        
        <div id="pnj-panel" class="entity-subpanel" style="display:none;">
          <div class="entity-section-title">Sélectionner un PNJ</div>
          <div class="pnj-categories" id="pnj-categories"></div>
          <div class="pnj-list" id="pnj-list"></div>
          <div id="pnj-properties" class="pnj-properties" style="display:none;">
            <div class="prop-row">
              <label class="prop-label">Direction (°)</label>
              <input type="number" id="pnj-rotation" class="prop-input" value="0" min="0" max="360" step="15">
            </div>
            <button id="pnj-place-btn" class="entity-action-btn">📍 Placer le PNJ</button>
          </div>
        </div>
        
        <div id="zone-panel" class="entity-subpanel" style="display:none;">
          <div class="entity-section-title">Configuration</div>
          <div class="prop-row">
            <label class="prop-label">Nom de la zone</label>
            <input type="text" id="zone-name" class="prop-input" placeholder="Route1_Grass">
          </div>
          <div class="prop-row">
            <label class="prop-label">Type de terrain</label>
            <select id="zone-terrain-type" class="prop-input">
              <option value="grass">🌿 Hautes herbes</option>
              <option value="water">💧 Eau</option>
              <option value="cave">🪨 Grotte</option>
              <option value="fishing">🎣 Pêche</option>
            </select>
          </div>
          <div class="prop-row">
            <label class="prop-label">Taux: <span id="zone-rate-value">25%</span></label>
            <input type="range" id="zone-encounter-rate" min="1" max="100" value="25" style="width:100%;">
          </div>
          
          <div class="entity-section-title">Pokémon <span id="selected-pokemon-count" style="color:var(--accent);float:right;">0</span></div>
          <div class="pokemon-search"><input type="text" id="pokemon-search" placeholder="🔍 Rechercher..."></div>
          <div class="selected-pokemons" id="selected-pokemons"></div>

          <!-- NOUVEAU: Configuration individuelle -->
          <div id="pokemon-config" class="pnj-properties" style="display:none; margin-bottom:8px;">
            <div class="entity-section-title">Configuration du Pokémon</div>
            <div class="prop-row">
              <label class="prop-label">Rareté (pourcetage): <span id="current-pokemon-weight">50</span></label>
              <input type="range" id="pokemon-weight-slider" min="1" max="100" value="50" style="width:100%;">
              <small style="font-size:9px;color:var(--text-muted);">Plus haut = plus commun</small>
            </div>
            <div style="display:flex;gap:6px;">
              <div class="prop-row" style="flex:1;margin-bottom:0;">
                <label class="prop-label">Niv. Min</label>
                <input type="number" id="pokemon-min-level" class="prop-input" value="2" min="1" max="100">
              </div>
              <div class="prop-row" style="flex:1;margin-bottom:0;">
                <label class="prop-label">Niv. Max</label>
                <input type="number" id="pokemon-max-level" class="prop-input" value="5" min="1" max="100">
              </div>
            </div>
            <button id="pokemon-config-apply" class="entity-action-btn" style="margin-top:8px;">✓ Appliquer</button>
          </div>

          <div class="pokemon-grid" id="pokemon-grid"></div>
          <button id="zone-draw-btn" class="entity-action-btn" disabled>✏️ Dessiner la zone</button>
        </div>
        
        <div class="entities-footer">
          <div class="entities-header">
            <span>📋 Entités</span>
            <span class="entity-count-badge" id="entity-count">0</span>
          </div>
          <div class="entities-list" id="entities-list"></div>
        </div>
      </div>
    `;

    leftSidebar.appendChild(modelsTab);
    leftSidebar.appendChild(entitiesTab);

    // Events onglets
    tabHeader.querySelectorAll(".sidebar-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        tabHeader
          .querySelectorAll(".sidebar-tab")
          .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        document
          .querySelectorAll(".tab-content")
          .forEach((c) => c.classList.remove("active"));
        document
          .getElementById(`tab-${tab.dataset.tab}`)
          ?.classList.add("active");
      });
    });

    this.populatePnjCategories();
    this.populatePokemonGrid();
    console.log("✅ UI EntityTool créée");
  }

  populatePnjCategories() {
    const container = document.getElementById("pnj-categories");
    if (!container) return;

    container.innerHTML =
      '<button class="pnj-cat-btn active" data-category="all" style="background:#4a5568">Tous</button>';

    Object.entries(this.pnjData.categories).forEach(([key, cat]) => {
      container.innerHTML += `<button class="pnj-cat-btn" data-category="${key}" style="background:${cat.color}">${cat.nom}</button>`;
    });

    this.filterPnjList("all");
  }

  filterPnjList(category) {
    const container = document.getElementById("pnj-list");
    if (!container) return;

    container.innerHTML = "";
    Object.entries(this.pnjData.pnj).forEach(([key, pnj]) => {
      if (category !== "all" && pnj.categorie !== category) return;
      const catData = this.pnjData.categories[pnj.categorie] || {
        color: "#666",
      };
      const emojis = {
        professeurs: "🔬",
        dresseurs: "⚔️",
        champions: "🏆",
        marchands: "🛒",
        villageois: "🏠",
      };
      container.innerHTML += `
        <div class="pnj-item" data-pnj-id="${key}">
          <div class="pnj-avatar" style="background:${catData.color}">${
        emojis[pnj.categorie] || "👤"
      }</div>
          <span class="pnj-name">${pnj.nom}</span>
        </div>
      `;
    });
  }

  populatePokemonGrid() {
    const container = document.getElementById("pokemon-grid");
    if (!container) return;

    container.innerHTML = "";
    Object.keys(this.pokemonsData)
      .forEach((id) => {
        const p = this.pokemonsData[id];
        if (!p) return;
        container.innerHTML += `
        <div class="pokemon-grid-item" data-pokemon-id="${id}">
          <div class="num">#${id.padStart(3, "0")}</div>
          <div class="name">${p.nom}</div>
        </div>
      `;
      });
  }

  setupEvents() {
    document.querySelectorAll(".entity-mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.setMode(btn.dataset.mode));
    });

    document
      .getElementById("pnj-categories")
      ?.addEventListener("click", (e) => {
        const btn = e.target.closest(".pnj-cat-btn");
        if (!btn) return;
        document
          .querySelectorAll(".pnj-cat-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.filterPnjList(btn.dataset.category);
      });

    document.getElementById("pnj-list")?.addEventListener("click", (e) => {
      const item = e.target.closest(".pnj-item");
      if (!item) return;
      document
        .querySelectorAll(".pnj-item")
        .forEach((i) => i.classList.remove("selected"));
      item.classList.add("selected");
      this.selectPnj(item.dataset.pnjId);
    });

    document
      .getElementById("pnj-place-btn")
      ?.addEventListener("click", () => this.startPnjPlacement());

    document
      .getElementById("pokemon-search")
      ?.addEventListener("input", (e) => {
        const search = e.target.value.toLowerCase();
        document.querySelectorAll(".pokemon-grid-item").forEach((item) => {
          const p = this.pokemonsData[item.dataset.pokemonId];
          const match =
            p?.nom.toLowerCase().includes(search) ||
            item.dataset.pokemonId.includes(search);
          item.style.display = match ? "" : "none";
        });
      });

    document.getElementById("pokemon-grid")?.addEventListener("click", (e) => {
      const item = e.target.closest(".pokemon-grid-item");
      if (item) this.togglePokemonSelection(item.dataset.pokemonId);
    });

    document
      .getElementById("zone-encounter-rate")
      ?.addEventListener("input", (e) => {
        document.getElementById("zone-rate-value").textContent =
          e.target.value + "%";
      });

    document
      .getElementById("zone-draw-btn")
      ?.addEventListener("click", () => this.startZoneDrawing());

    document
      .getElementById("selected-pokemons")
      ?.addEventListener("click", (e) => {
        if (e.target.closest(".remove")) {
          const tag = e.target.closest(".selected-pokemon-tag");
          if (tag) this.togglePokemonSelection(tag.dataset.pokemonId);
        }
      });

    document
      .getElementById("pokemon-weight-slider")
      ?.addEventListener("input", (e) => {
        document.getElementById("current-pokemon-weight").textContent =
          e.target.value;
      });

    // NOUVEAU: Appliquer la config
    document
      .getElementById("pokemon-config-apply")
      ?.addEventListener("click", () => {
        if (!this.currentPokemonConfig) return;

        const weight = parseInt(
          document.getElementById("pokemon-weight-slider").value
        );
        const minLevel = parseInt(
          document.getElementById("pokemon-min-level").value
        );
        const maxLevel = parseInt(
          document.getElementById("pokemon-max-level").value
        );

        if (minLevel > maxLevel) {
          alert("Le niveau minimum doit être <= au niveau maximum");
          return;
        }

        this.pokemonConfigs.set(this.currentPokemonConfig, {
          weight,
          minLevel,
          maxLevel,
        });

        this.updateSelectedPokemonsUI();
        const pokemon = this.pokemonsData[this.currentPokemonConfig];
        alert(
          `✓ ${pokemon.nom} configuré: Weight ${weight}, Niv.${minLevel}-${maxLevel}`
        );
      });

    // NOUVEAU: Double-clic pour éditer
    document
      .getElementById("selected-pokemons")
      ?.addEventListener("dblclick", (e) => {
        const tag = e.target.closest(".selected-pokemon-tag");
        if (tag) {
          this.showPokemonConfig(tag.dataset.pokemonId);
        }
      });

    console.log("✅ Events configurés");
  }

  setMode(mode) {
    this.currentMode = mode;
    document
      .querySelectorAll(".entity-mode-btn")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.mode === mode)
      );
    document.getElementById("pnj-panel").style.display =
      mode === "pnj" ? "block" : "none";
    document.getElementById("zone-panel").style.display =
      mode === "zone" ? "block" : "none";
    this.editor.setTool?.("entity");
  }

  selectPnj(pnjId) {
    this.selectedPnj = this.pnjData.pnj[pnjId];
    if (this.selectedPnj) {
      document.getElementById("pnj-properties").style.display = "block";
      document.getElementById("pnj-rotation").value = "0";
    }
  }

  togglePokemonSelection(id) {
    const idx = this.selectedPokemons.findIndex((p) => p.id === id);
    if (idx > -1) {
      // Retirer
      this.selectedPokemons.splice(idx, 1);
      this.pokemonConfigs.delete(id);

      if (this.currentPokemonConfig === id) {
        this.currentPokemonConfig = null;
        document.getElementById("pokemon-config").style.display = "none";
      }
    } else {
      // Ajouter
      const p = this.pokemonsData[id];
      if (p) {
        this.selectedPokemons.push({ id, nom: p.nom });

        // Config par défaut
        this.pokemonConfigs.set(id, {
          weight: 50,
          minLevel: 2,
          maxLevel: 5,
        });

        // Ouvrir la config
        this.showPokemonConfig(id);
      }
    }
    this.updateSelectedPokemonsUI();
  }

  showPokemonConfig(id) {
    this.currentPokemonConfig = id;
    const config = this.pokemonConfigs.get(id) || {
      weight: 50,
      minLevel: 2,
      maxLevel: 5,
    };
    const pokemon = this.pokemonsData[id];

    const panel = document.getElementById("pokemon-config");
    panel.style.display = "block";

    // Mettre à jour le titre
    const title = panel.querySelector(".entity-section-title");
    if (title) {
      title.textContent = `Config: ${pokemon.nom} #${id}`;
    }

    // Remplir les valeurs
    document.getElementById("pokemon-weight-slider").value = config.weight;
    document.getElementById("current-pokemon-weight").textContent =
      config.weight;
    document.getElementById("pokemon-min-level").value = config.minLevel;
    document.getElementById("pokemon-max-level").value = config.maxLevel;
  }

  updateSelectedPokemonsUI() {
    const container = document.getElementById("selected-pokemons");
    const count = document.getElementById("selected-pokemon-count");
    const btn = document.getElementById("zone-draw-btn");

    if (container) {
      container.innerHTML = this.selectedPokemons
        .map((p) => {
          const config = this.pokemonConfigs.get(p.id) || { weight: 50 };
          return `<div class="selected-pokemon-tag" data-pokemon-id="${p.id}">
          <span>#${p.id} ${p.nom}</span>
          <span style="opacity:0.7;font-size:8px;margin-left:4px;">W:${config.weight}</span>
          <span class="remove">✕</span>
        </div>`;
        })
        .join("");
    }
    if (count) count.textContent = this.selectedPokemons.length;
    if (btn) btn.disabled = this.selectedPokemons.length === 0;

    document.querySelectorAll(".pokemon-grid-item").forEach((item) => {
      item.classList.toggle(
        "selected",
        this.selectedPokemons.some((p) => p.id === item.dataset.pokemonId)
      );
    });
  }

  startPnjPlacement() {
    if (!this.selectedPnj) return alert("Sélectionnez un PNJ");
    this.isPlacing = true;
    this.editor.controls.enabled = false;

    const color =
      this.pnjData.categories[this.selectedPnj.categorie]?.color || "#6366f1";
    this.currentEntity = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 1.8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })
    );
    this.currentEntity.position.y = 0.9;

    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.4, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    arrow.rotation.x = Math.PI / 2;
    arrow.position.z = 0.5;
    this.currentEntity.add(arrow);

    this.scene.add(this.currentEntity);
  }

  startZoneDrawing() {
    if (!this.selectedPokemons.length) return alert("Sélectionnez des Pokémon");
    this.isPlacing = true;
    this.zoneStart = null;
    this.editor.controls.enabled = false;
  }

  onMouseMove() {
    if (!this.isPlacing) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObject(this.ground)[0];
    if (!hit) return;

    if (this.currentMode === "pnj" && this.currentEntity) {
      this.currentEntity.position.x = hit.point.x;
      this.currentEntity.position.z = hit.point.z;
      this.currentEntity.rotation.y =
        ((parseFloat(document.getElementById("pnj-rotation")?.value) || 0) *
          Math.PI) /
        180;
    } else if (
      this.currentMode === "zone" &&
      this.zoneStart &&
      this.zonePreview
    ) {
      const w = Math.abs(hit.point.x - this.zoneStart.x);
      const d = Math.abs(hit.point.z - this.zoneStart.z);
      this.zonePreview.geometry.dispose();
      this.zonePreview.geometry = new THREE.PlaneGeometry(
        Math.max(w, 0.5),
        Math.max(d, 0.5)
      );
      this.zonePreview.position.set(
        (this.zoneStart.x + hit.point.x) / 2,
        0.05,
        (this.zoneStart.z + hit.point.z) / 2
      );
    }
  }

  onMouseDown(e) {
    if (!this.isPlacing || e.button !== 0) return false;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObject(this.ground)[0];
    if (!hit) return false;

    if (this.currentMode === "zone" && !this.zoneStart) {
      this.zoneStart = hit.point.clone();
      const colors = {
        grass: 0x22c55e,
        water: 0x3b82f6,
        cave: 0x78716c,
        fishing: 0x06b6d4,
      };
      this.zonePreview = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color:
            colors[document.getElementById("zone-terrain-type")?.value] ||
            0x22c55e,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
        })
      );
      this.zonePreview.rotation.x = -Math.PI / 2;
      this.zonePreview.position.y = 0.05;
      this.scene.add(this.zonePreview);
    }
    return true;
  }

  onMouseUp() {
    if (!this.isPlacing) return false;

    if (this.currentMode === "pnj" && this.currentEntity) {
      const data = {
        type: "pnj",
        id: `${this.selectedPnj.id}_${this.entityCounter++}`,
        pnjId: this.selectedPnj.id,
        nom: this.selectedPnj.nom,
        categorie: this.selectedPnj.categorie,
        position: {
          x: this.currentEntity.position.x,
          y: 0,
          z: this.currentEntity.position.z,
        },
        rotation:
          parseFloat(document.getElementById("pnj-rotation")?.value) || 0,
        mesh: this.currentEntity,
      };
      this.currentEntity.material.opacity = 1;
      this.entities.push(data);
      this.currentEntity = null;
      this.isPlacing = false;
      this.editor.controls.enabled = true;
      this.updateEntitiesList();
      return true;
    }

    if (this.currentMode === "zone" && this.zonePreview && this.zoneStart) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hit = this.raycaster.intersectObject(this.ground)[0];
      if (!hit) return false;

      const data = {
        type: "spawnZone",
        id:
          document.getElementById("zone-name")?.value ||
          `zone_${this.zoneCounter++}`,
        terrainType:
          document.getElementById("zone-terrain-type")?.value || "grass",
        bounds: {
          minX: Math.min(this.zoneStart.x, hit.point.x),
          maxX: Math.max(this.zoneStart.x, hit.point.x),
          minZ: Math.min(this.zoneStart.z, hit.point.z),
          maxZ: Math.max(this.zoneStart.z, hit.point.z),
        },
        center: {
          x: (this.zoneStart.x + hit.point.x) / 2,
          z: (this.zoneStart.z + hit.point.z) / 2,
        },
        size: {
          width: Math.abs(hit.point.x - this.zoneStart.x),
          depth: Math.abs(hit.point.z - this.zoneStart.z),
        },
        encounterRate:
          parseInt(document.getElementById("zone-encounter-rate")?.value) || 25,
        pokemons: this.selectedPokemons.map((p) => {
          const config = this.pokemonConfigs.get(p.id) || {
            weight: 50,
            minLevel: 2,
            maxLevel: 5,
          };
          return {
            id: parseInt(p.id),
            nom: p.nom,
            weight: config.weight,
            minLevel: config.minLevel,
            maxLevel: config.maxLevel,
          };
        }),
        mesh: this.zonePreview,
      };

      this.zonePreview.material.opacity = 0.3;

      // Label
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, 256, 64);
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(data.id, 128, 28);
      ctx.font = "14px Arial";
      ctx.fillText(`${data.pokemons.length} Pokémon`, 128, 50);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) })
      );
      sprite.scale.set(4, 1, 1);
      sprite.position.set(data.center.x, 2, data.center.z);
      this.scene.add(sprite);
      data.label = sprite;

      this.spawnZones.push(data);
      this.zonePreview = null;
      this.zoneStart = null;
      this.isPlacing = false;
      this.editor.controls.enabled = true;
      this.updateEntitiesList();
      return true;
    }
    return false;
  }

  updateEntitiesList() {
    const container = document.getElementById("entities-list");
    const count = document.getElementById("entity-count");
    if (!container) return;

    const all = [...this.entities, ...this.spawnZones];
    container.innerHTML = all
      .map(
        (e, i) => `
      <div class="entity-list-item">
        <span>${e.type === "pnj" ? "👤" : "🌿"} ${
          e.type === "pnj" ? e.nom : e.id
        }</span>
        <span class="delete-btn" data-idx="${i}" data-type="${e.type}">🗑️</span>
      </div>
    `
      )
      .join("");
    if (count) count.textContent = all.length;

    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        this.deleteEntity(parseInt(btn.dataset.idx), btn.dataset.type)
      );
    });
  }

  deleteEntity(idx, type) {
    const all = [...this.entities, ...this.spawnZones];
    const e = all[idx];
    if (!e) return;
    if (e.mesh) {
      this.scene.remove(e.mesh);
      e.mesh.geometry?.dispose();
      e.mesh.material?.dispose();
    }
    if (e.label) this.scene.remove(e.label);
    if (type === "pnj") {
      const i = this.entities.indexOf(e);
      if (i > -1) this.entities.splice(i, 1);
    } else {
      const i = this.spawnZones.indexOf(e);
      if (i > -1) this.spawnZones.splice(i, 1);
    }
    this.updateEntitiesList();
  }

  getEntitiesData() {
    return {
      pnj: this.entities.map((e) => ({
        id: e.id,
        pnjId: e.pnjId,
        nom: e.nom,
        categorie: e.categorie,
        position: e.position,
        rotation: e.rotation,
      })),
      spawnZones: this.spawnZones.map((z) => ({
        id: z.id,
        terrainType: z.terrainType,
        bounds: z.bounds,
        center: z.center,
        size: z.size,
        encounterRate: z.encounterRate,
        pokemons: z.pokemons.map((p) => ({
          id: p.id,
          nom: p.nom,
          weight: p.weight || 50,
          minLevel: p.minLevel || 2,
          maxLevel: p.maxLevel || 5,
        })),
      })),
    };
  }

  loadEntitiesData(data) {
    if (!data) return;
    this.entities.forEach((e) => e.mesh && this.scene.remove(e.mesh));
    this.spawnZones.forEach((z) => {
      z.mesh && this.scene.remove(z.mesh);
      z.label && this.scene.remove(z.label);
    });
    this.entities = [];
    this.spawnZones = [];

    data.pnj?.forEach((d) => {
      const color = this.pnjData.categories[d.categorie]?.color || "#6366f1";
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 1.8, 8),
        new THREE.MeshBasicMaterial({ color })
      );
      mesh.position.set(d.position.x, 0.9, d.position.z);
      mesh.rotation.y = ((d.rotation || 0) * Math.PI) / 180;
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      arrow.rotation.x = Math.PI / 2;
      arrow.position.z = 0.5;
      mesh.add(arrow);
      this.scene.add(mesh);
      this.entities.push({ ...d, type: "pnj", mesh });
    });

    data.spawnZones?.forEach((d) => {
      const colors = {
        grass: 0x22c55e,
        water: 0x3b82f6,
        cave: 0x78716c,
        fishing: 0x06b6d4,
      };
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(d.size.width, d.size.depth),
        new THREE.MeshBasicMaterial({
          color: colors[d.terrainType] || 0x22c55e,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(d.center.x, 0.05, d.center.z);
      this.scene.add(mesh);

      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, 256, 64);
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(d.id, 128, 28);
      ctx.font = "14px Arial";
      const totalWeight = d.pokemons.reduce(
        (sum, p) => sum + (p.weight || 50),
        0
      );
      const avgWeight = Math.round(totalWeight / d.pokemons.length);
      ctx.fillText(`${d.pokemons.length} Pokémon (W:${avgWeight})`, 128, 50);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) })
      );
      sprite.scale.set(4, 1, 1);
      sprite.position.set(d.center.x, 2, d.center.z);
      this.scene.add(sprite);

      this.spawnZones.push({ ...d, type: "spawnZone", mesh, label: sprite });
    });

    this.updateEntitiesList();
  }
}
