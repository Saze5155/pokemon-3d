import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { EntityTool } from "./editor/EntityTool.js";
import { WorldMapEditor } from "./editor/WorldMapEditor.js";
import { Player } from "./entities/Player.js";

class PokemonEditor {
  constructor() {
    this.objects = [];
    this.currentObject = null;
    this.selectedModel = null;
    this.snapEnabled = false;
    this.isDragging = false;
    this.freeCamMode = false;

    this.isPrefabScene = false;
    this.prefabModel = null;
    this.currentTool = "move";
    this.keys = {
      z: false,
      q: false,
      s: false,
      d: false,
      space: false,
      shift: false,
    };
    this.moveSpeed = 0.2;
    this.testMode = false;
    this.player = null;
    this.clock = new THREE.Clock();
    this.copiedObject = null;

    this.fillMode = false;
    this.fillStart = null;
    this.fillPreview = null;

    // Portals
    this.portals = [];
    this.currentPortal = null;
    this.selectedPortal = null;
    this.availableScenes = [];
    this.portalCounter = 1;
    this.entityTool = null;
    this.worldMapEditor = null;

    this.walls = {
      north: null,
      south: null,
      east: null,
      west: null,
    };
    this.ceiling = null;

    // Terrain
    this.groundWidth = 100;
    this.groundHeight = 100;
    this.groundSegments = 50;
    this.heightMap = [];
    this.groundColor = "#3a9d23";

    // Sculpt
    this.sculptBrushSize = 5;
    this.sculptStrength = 0.5;
    this.sculptMode = "raise"; // raise, lower, smooth, flatten
    this.brushPreview = null;
    this.isSculpting = false;

    this.initScene();
    this.initLights();
    this.initGround();
    this.initRaycaster();
    this.initGallery();
    this.loadScenesList();
    this.setupEvents();
    this.setupPortalEvents();
    this.initEntityTool();
    this.initWorldMapEditor();
    this.setupTerrainEvents();
    this.animate();
  }

  initScene() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(10, 10, 10);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    document
      .getElementById("canvas-container")
      .appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2;
  }

  initLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    this.scene.add(sun);
  }

  initGround() {
    this.initHeightMap();

    const groundGeo = new THREE.PlaneGeometry(
      this.groundWidth,
      this.groundHeight,
      this.groundSegments,
      this.groundSegments
    );

    const groundMat = new THREE.MeshStandardMaterial({
      color: this.groundColor,
      flatShading: false,
    });

    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Plan invisible illimité pour le dessin des entités
    const infiniteGeo = new THREE.PlaneGeometry(10000, 10000);
    const infiniteMat = new THREE.MeshBasicMaterial({
      visible: false,
      side: THREE.DoubleSide,
    });
    this.infiniteGround = new THREE.Mesh(infiniteGeo, infiniteMat);
    this.infiniteGround.rotation.x = -Math.PI / 2;
    this.infiniteGround.position.y = 0;
    this.scene.add(this.infiniteGround);

    // Grille
    this.updateGridHelper();

    // Brush preview
    this.initBrushPreview();
  }

  initHeightMap() {
    const segments = this.groundSegments + 1;
    this.heightMap = new Array(segments * segments).fill(0);
  }

  initBrushPreview() {
    const geometry = new THREE.RingGeometry(
      this.sculptBrushSize - 0.2,
      this.sculptBrushSize,
      32
    );
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });

    this.brushPreview = new THREE.Mesh(geometry, material);
    this.brushPreview.rotation.x = -Math.PI / 2;
    this.brushPreview.visible = false;
    this.scene.add(this.brushPreview);
  }

  updateGroundSize(width, height) {
    this.groundWidth = width;
    this.groundHeight = height;

    this.scene.remove(this.ground);
    this.initHeightMap();

    const groundGeo = new THREE.PlaneGeometry(
      this.groundWidth,
      this.groundHeight,
      this.groundSegments,
      this.groundSegments
    );

    const groundMat = new THREE.MeshStandardMaterial({
      color: this.groundColor,
      flatShading: false,
    });

    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Mettre à jour EntityTool si nécessaire
    if (this.entityTool && this.infiniteGround) {
      this.entityTool.ground = this.infiniteGround;
    }

    this.updateGridHelper();
    console.log(`Terrain: ${width}x${height}`);
  }

  updateGridHelper() {
    const oldGrid = this.scene.children.find((c) => c.type === "GridHelper");
    if (oldGrid) this.scene.remove(oldGrid);

    const maxSize = Math.max(this.groundWidth, this.groundHeight);
    const grid = new THREE.GridHelper(
      maxSize,
      Math.floor(maxSize / 2),
      0x000000,
      0x000000
    );
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    this.scene.add(grid);
  }

  sculptTerrain(worldPos) {
    const geometry = this.ground.geometry;
    const positions = geometry.attributes.position;

    // Convertir en coordonnÃ©es locales
    const localPos = this.ground.worldToLocal(worldPos.clone());

    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i); // Hauteur actuelle

      // Distance 2D au pinceau
      const distance = Math.sqrt(
        Math.pow(vx - localPos.x, 2) + Math.pow(vy - localPos.y, 2)
      );

      if (distance < this.sculptBrushSize) {
        // Falloff smooth
        const falloff = 1 - distance / this.sculptBrushSize;
        const smooth = falloff * falloff * (3 - 2 * falloff);

        let delta = 0;
        switch (this.sculptMode) {
          case "raise":
            delta = this.sculptStrength * smooth * 0.1;
            break;
          case "lower":
            delta = -this.sculptStrength * smooth * 0.1;
            break;
          case "smooth":
            const avgHeight = this.getAverageHeight(i, positions);
            delta = (avgHeight - vz) * smooth * 0.1;
            break;
          case "flatten":
            delta = (0 - vz) * smooth * 0.1;
            break;
        }

        positions.setZ(i, vz + delta);
        this.heightMap[i] = vz + delta;
      }
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  getAverageHeight(index, positions) {
    const cols = this.groundSegments + 1;
    const row = Math.floor(index / cols);
    const col = index % cols;

    let sum = 0;
    let count = 0;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < cols && nc >= 0 && nc < cols) {
          const ni = nr * cols + nc;
          sum += positions.getZ(ni);
          count++;
        }
      }
    }

    return count > 0 ? sum / count : positions.getZ(index);
  }

  updateBrushPreview(position) {
    if (!this.brushPreview) return;

    this.brushPreview.geometry.dispose();
    this.brushPreview.geometry = new THREE.RingGeometry(
      this.sculptBrushSize - 0.2,
      this.sculptBrushSize,
      32
    );

    this.brushPreview.position.copy(position);
    this.brushPreview.position.y += 0.1;

    const colors = {
      raise: 0x00ff00,
      lower: 0xff0000,
      smooth: 0x0088ff,
      flatten: 0xffff00,
    };
    this.brushPreview.material.color.setHex(colors[this.sculptMode]);
  }

  setupTerrainEvents() {
    // Taille terrain
    document
      .getElementById("update-ground-size-btn")
      ?.addEventListener("click", () => {
        const width = parseInt(document.getElementById("ground-width").value);
        const height = parseInt(document.getElementById("ground-height").value);
        this.updateGroundSize(width, height);
      });

    // Couleur terrain
    document
      .getElementById("update-ground-color-btn")
      ?.addEventListener("click", () => {
        const color = document.getElementById("ground-color").value;
        this.updateGroundColor(color);
      });

    // Mode sculpt
    document.getElementById("sculpt-mode")?.addEventListener("change", (e) => {
      this.sculptMode = e.target.value;
      console.log("Mode sculpt:", this.sculptMode);
    });

    // Taille pinceau
    document.getElementById("brush-size")?.addEventListener("input", (e) => {
      this.sculptBrushSize = parseFloat(e.target.value);
      document.getElementById("brush-size-value").textContent =
        this.sculptBrushSize;
    });

    // Force pinceau
    document
      .getElementById("brush-strength")
      ?.addEventListener("input", (e) => {
        this.sculptStrength = parseFloat(e.target.value);
        document.getElementById("brush-strength-value").textContent =
          this.sculptStrength;
      });
  }

  initRaycaster() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  generateThumbnail(modelPath, callback) {
    const thumbScene = new THREE.Scene();
    thumbScene.background = new THREE.Color(0x333333);

    const thumbCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    thumbCamera.position.set(2, 2, 2);
    thumbCamera.lookAt(0, 0, 0);

    const thumbLight = new THREE.DirectionalLight(0xffffff, 1);
    thumbLight.position.set(5, 5, 5);
    thumbScene.add(thumbLight);
    thumbScene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const thumbRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    thumbRenderer.setSize(80, 80);

    // Charger le modÃ¨le avec gestion d'erreur
    if (modelPath.endsWith(".obj")) {
      this.objLoader.load(
        modelPath,
        (obj) => {
          const box = new THREE.Box3().setFromObject(obj);
          const center = box.getCenter(new THREE.Vector3());
          obj.position.sub(center);

          const size = box.getSize(new THREE.Vector3()).length();
          obj.scale.setScalar(2 / size);

          obj.traverse((child) => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x00ff00,
              });
            }
          });

          thumbScene.add(obj);
          thumbRenderer.render(thumbScene, thumbCamera);
          callback(thumbRenderer.domElement.toDataURL());
          thumbRenderer.dispose();
        },
        undefined,
        (error) => {
          console.error(`Erreur chargement ${modelPath}:`, error);
          callback(
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23f00" width="80" height="80"/><text x="40" y="45" fill="white" font-size="12" text-anchor="middle">ERR</text></svg>'
          );
        }
      );
    } else if (modelPath.endsWith(".glb") || modelPath.endsWith(".gltf")) {
      this.gltfLoader.load(
        modelPath,
        (gltf) => {
          const obj = gltf.scene;

          const box = new THREE.Box3().setFromObject(obj);
          const center = box.getCenter(new THREE.Vector3());
          obj.position.sub(center);

          const size = box.getSize(new THREE.Vector3()).length();
          obj.scale.setScalar(2 / size);

          thumbScene.add(obj);
          thumbRenderer.render(thumbScene, thumbCamera);
          callback(thumbRenderer.domElement.toDataURL());
          thumbRenderer.dispose();
        },
        undefined,
        (error) => {
          console.error(`Erreur chargement ${modelPath}:`, error);
          callback(
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23f00" width="80" height="80"/><text x="40" y="45" fill="white" font-size="12" text-anchor="middle">ERR</text></svg>'
          );
        }
      );
    } else if (modelPath.endsWith(".fbx")) {
      this.fbxLoader.load(
        modelPath,
        (fbx) => {
          const box = new THREE.Box3().setFromObject(fbx);
          const center = box.getCenter(new THREE.Vector3());
          fbx.position.sub(center);

          const size = box.getSize(new THREE.Vector3()).length();
          fbx.scale.setScalar(2 / size);

          fbx.traverse((child) => {
            if (child.isMesh && !child.material) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x00ff00,
              });
            }
          });

          thumbScene.add(fbx);
          thumbRenderer.render(thumbScene, thumbCamera);
          callback(thumbRenderer.domElement.toDataURL());
          thumbRenderer.dispose();
        },
        undefined,
        (error) => {
          console.error(`Erreur chargement ${modelPath}:`, error);
          callback(
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23f00" width="80" height="80"/><text x="40" y="45" fill="white" font-size="12" text-anchor="middle">ERR</text></svg>'
          );
        }
      );
    }
  }

  initGallery() {
    this.gltfLoader = new GLTFLoader();
    this.objLoader = new OBJLoader();
    this.fbxLoader = new FBXLoader();
    this.models = [];
    this.currentFilter = "all"; // Nouveau

    const galleryList = document.getElementById("gallery-list");
    const filterButtons = document.getElementById("filter-buttons");

    galleryList.innerHTML = '<div style="color:white;">Chargement...</div>';

    fetch("http://localhost:3000/list-models")
      .then((res) => res.json())
      .then((data) => {
        this.models = data.models;

        if (this.models.length === 0) {
          galleryList.innerHTML =
            '<div style="color:white;">Aucun modÃ¨le trouvÃ©</div>';
          return;
        }

        // CrÃ©er les boutons de filtre dynamiquement
        const types = [...new Set(this.models.map((m) => m.type))];
        types.forEach((type) => {
          const btn = document.createElement("button");
          btn.className = "filter-btn";
          btn.textContent = type.charAt(0).toUpperCase() + type.slice(1);
          btn.dataset.filter = type;
          btn.onclick = () => this.filterModels(type);
          filterButtons.appendChild(btn);
        });

        // Afficher tous les modÃ¨les
        this.renderGallery();

        const prefabSelect = document.getElementById("prefab-model");
        this.models.forEach((model) => {
          const option = document.createElement("option");
          option.value = model.path;
          option.textContent = model.name;
          prefabSelect.appendChild(option);
        });
      })
      .catch((err) => {
        console.error("Erreur chargement modÃ¨les:", err);
        galleryList.innerHTML =
          '<div style="color:red;">Erreur chargement</div>';
      });
  }

  filterModels(filter) {
    this.currentFilter = filter;

    // Mettre Ã  jour les boutons actifs
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.filter === filter) {
        btn.classList.add("active");
      }
    });

    this.renderGallery();
  }

  // Nouvelle mÃ©thode pour afficher la galerie
  renderGallery() {
    const categoryGallery = document.getElementById("category-gallery");
    categoryGallery.innerHTML = "";

    // Filtrer les modÃ¨les
    const filteredModels =
      this.currentFilter === "all"
        ? this.models
        : this.models.filter((m) => m.type === this.currentFilter);

    if (filteredModels.length === 0) {
      categoryGallery.innerHTML =
        '<div style="color:var(--text-muted);padding:20px;text-align:center;">Aucun modÃ¨le trouvÃ©</div>';
      return;
    }

    // Grouper par type
    const grouped = {};
    filteredModels.forEach((model) => {
      if (!grouped[model.type]) {
        grouped[model.type] = [];
      }
      grouped[model.type].push(model);
    });

    // Afficher par catÃ©gorie en accordÃ©on
    Object.entries(grouped).forEach(([type, models], catIndex) => {
      const category = document.createElement("div");
      category.className = "category";

      // Header de la catÃ©gorie (cliquable)
      const header = document.createElement("div");
      header.className = "category-header" + (catIndex === 0 ? " active" : "");
      header.innerHTML = `
        <svg class="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span class="category-name">${
          type.charAt(0).toUpperCase() + type.slice(1)
        }</span>
        <span class="category-count">${models.length}</span>
      `;

      // Container des items
      const items = document.createElement("div");
      items.className = "category-items";

      // ModÃ¨les de cette catÃ©gorie
      models.forEach((model) => {
        const index = this.models.indexOf(model);

        const item = document.createElement("div");
        item.className = "gallery-item";
        item.dataset.modelIndex = index;

        const thumbContainer = document.createElement("div");
        thumbContainer.style.width = "50px";
        thumbContainer.style.height = "50px";
        thumbContainer.style.background = "rgba(255,255,255,0.05)";
        thumbContainer.style.borderRadius = "4px";
        thumbContainer.style.display = "flex";
        thumbContainer.style.alignItems = "center";
        thumbContainer.style.justifyContent = "center";
        thumbContainer.style.marginBottom = "4px";
        thumbContainer.innerHTML =
          '<div style="color:var(--text-muted);font-size:8px;">...</div>';

        const name = document.createElement("span");
        name.textContent = model.name;
        name.style.overflow = "hidden";
        name.style.textOverflow = "ellipsis";
        name.style.whiteSpace = "nowrap";
        name.style.maxWidth = "100%";

        item.appendChild(thumbContainer);
        item.appendChild(name);
        item.onclick = () => this.selectModel(index, item);
        items.appendChild(item);

        // GÃ©nÃ©rer thumbnail
        this.generateThumbnail(model.path, (dataUrl) => {
          const img = document.createElement("img");
          img.src = dataUrl;
          img.style.width = "50px";
          img.style.height = "50px";
          img.style.borderRadius = "4px";
          img.style.objectFit = "cover";
          thumbContainer.innerHTML = "";
          thumbContainer.appendChild(img);
        });
      });

      category.appendChild(header);
      category.appendChild(items);
      categoryGallery.appendChild(category);
    });

    console.log(
      `${filteredModels.length} modÃ¨les affichÃ©s dans ${
        Object.keys(grouped).length
      } catÃ©gories`
    );
  }

  selectModel(index, element) {
    // Retirer la sÃ©lection prÃ©cÃ©dente
    document.querySelectorAll(".gallery-item").forEach((el) => {
      el.classList.remove("selected");
    });

    element.classList.add("selected");
    this.selectedModel = this.models[index];
    console.log("ModÃ¨le sÃ©lectionnÃ©:", this.selectedModel.name);
  }

  setupEvents() {
    // Mouse move
    this.renderer.domElement.addEventListener("mousemove", (e) =>
      this.onMouseMove(e)
    );

    // Mouse down (start dragging)
    this.renderer.domElement.addEventListener("mousedown", (e) =>
      this.onMouseDown(e)
    );

    // Mouse up (stop dragging)
    this.renderer.domElement.addEventListener("mouseup", () =>
      this.onMouseUp()
    );

    // Wheel (height adjust)
    this.renderer.domElement.addEventListener("wheel", (e) => this.onWheel(e));

    // Keyboard
    window.addEventListener("keydown", (e) => this.onKeyDown(e));

    window.addEventListener("keyup", (e) => this.onKeyUp(e));

    // Resize
    window.addEventListener("resize", () => this.onResize());

    document.getElementById("color-picker").addEventListener("input", (e) => {
      if (this.currentObject) {
        const color = new THREE.Color(e.target.value);
        this.currentObject.traverse((child) => {
          if (child.isMesh) {
            child.material.color = color;
          }
        });
      }
    });

    document.getElementById("apply-scale-btn").addEventListener("click", () => {
      if (this.currentObject) {
        const scale = parseFloat(document.getElementById("scale-input").value);
        this.currentObject.scale.set(scale, scale, scale);
        console.log("Scale appliquÃ©:", scale);
      }
    });

    document.getElementById("load-btn").addEventListener("click", () => {
      const sceneName = prompt("Nom de la scÃ¨ne Ã  charger:", "bourg-palette");
      if (sceneName) {
        this.loadScene(sceneName);
      }
    });

    document
      .getElementById("update-ground-size-btn")
      ?.addEventListener("click", () => {
        const width =
          parseInt(document.getElementById("ground-width").value) || 100;
        const height =
          parseInt(document.getElementById("ground-height").value) || 100;
        this.updateGroundSize(width, height);
      });

    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.setTool(btn.dataset.tool);
      });
    });

    document.getElementById("test-btn").addEventListener("click", () => {
      this.toggleTestMode();
    });

    document.getElementById("exit-test-btn").addEventListener("click", () => {
      this.toggleTestMode();
    });

    // Echap pour quitter le test
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape" && this.testMode) {
        this.toggleTestMode();
      }
    });

    // Raccourcis clavier pour les outils
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyC") this.setTool("move");
      if (e.code === "KeyV") this.setTool("select");
      if (e.code === "KeyP") this.setTool("place");
      if (e.code === "KeyE") this.setTool("entity");
    });

    document
      .getElementById("update-ground-color-btn")
      .addEventListener("click", () => {
        const color = document.getElementById("ground-color").value;
        this.updateGroundColor(color);
      });

    // Toggles construction
    document
      .getElementById("toggle-wall-north")
      .addEventListener("change", (e) => {
        this.toggleWall("north", e.target.checked);
      });

    document
      .getElementById("toggle-wall-south")
      .addEventListener("change", (e) => {
        this.toggleWall("south", e.target.checked);
      });

    document
      .getElementById("toggle-wall-east")
      .addEventListener("change", (e) => {
        this.toggleWall("east", e.target.checked);
      });

    document
      .getElementById("toggle-wall-west")
      .addEventListener("change", (e) => {
        this.toggleWall("west", e.target.checked);
      });

    document
      .getElementById("toggle-ceiling")
      .addEventListener("change", (e) => {
        this.toggleCeiling(e.target.checked);
      });

    // Update couleur murs
    document.getElementById("wall-color").addEventListener("input", () => {
      this.updateWallsColor();
    });

    // Update couleur plafond
    document.getElementById("ceiling-color").addEventListener("input", () => {
      this.updateCeilingColor();
    });

    // Update hauteur murs
    document.getElementById("wall-height").addEventListener("input", () => {
      this.updateWallsHeight();
    });

    document.getElementById("prefab-scene").addEventListener("change", (e) => {
      this.isPrefabScene = e.target.checked;
      document.getElementById("prefab-options").style.display = e.target.checked
        ? "block"
        : "none";

      if (e.target.checked) {
        // Cacher le terrain
        this.ground.visible = false;
        const grid = this.scene.children.find((c) => c.type === "GridHelper");
        if (grid) grid.visible = false;
      } else {
        // RÃ©afficher le terrain
        this.ground.visible = true;
        const grid = this.scene.children.find((c) => c.type === "GridHelper");
        if (grid) grid.visible = true;
      }
    });

    // Charger le modÃ¨le prÃ©fait
    document.getElementById("load-prefab-btn").addEventListener("click", () => {
      const modelPath = document.getElementById("prefab-model").value;
      if (!modelPath) {
        alert("SÃ©lectionne un modÃ¨le");
        return;
      }
      this.loadPrefabScene(modelPath);
    });

    // Appliquer le scale du prefab
    document
      .getElementById("apply-prefab-scale-btn")
      .addEventListener("click", () => {
        if (this.prefabModel) {
          const scale = parseFloat(
            document.getElementById("prefab-scale").value
          );
          this.prefabModel.scale.set(scale, scale, scale);
          console.log("Scale prefab:", scale);
        }
      });
  }

  updateGroundColor(color) {
    this.ground.material.color.set(color);
    this.groundColor = color;
    console.log(`Couleur terrain changÃ©e: ${color}`);
  }

  onMouseMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Gestion EntityTool
    if (this.currentTool === "entity" && this.entityTool) {
      this.entityTool.onMouseMove(event);
      return;
    }

    if (this.currentTool === "sculpt") {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObject(this.ground);

      if (intersects.length > 0) {
        this.brushPreview.visible = true;
        this.updateBrushPreview(intersects[0].point);

        if (this.isSculpting) {
          this.sculptTerrain(intersects[0].point);
        }
      } else {
        this.brushPreview.visible = false;
      }
      return;
    }

    if (
      this.currentTool === "move" &&
      document.pointerLockElement === this.renderer.domElement
    ) {
      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      this.camera.rotation.y -= movementX * 0.002;
      this.camera.rotation.x -= movementY * 0.002;
      this.camera.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, this.camera.rotation.x)
      );
      return;
    }

    // Mode Ã©dition - calculer les coordonnÃ©es relatives au canvas
    if (this.constructionMode && this.wallPreview && this.wallStart) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const allObjects = [
        this.ground,
        ...this.scene.children.filter(
          (c) => c.userData.modelPath || c.userData.isConstruction
        ),
      ];
      const intersects = this.raycaster.intersectObjects(allObjects, true);

      if (intersects.length > 0) {
        const endPoint = intersects[0].point;

        if (this.constructionMode === "wall") {
          // Calculer la direction et la longueur
          const direction = new THREE.Vector3().subVectors(
            endPoint,
            this.wallStart
          );
          const length = direction.length();
          const height = parseFloat(
            document.getElementById("construct-height").value
          );

          // Positionner et orienter le mur
          this.wallPreview.geometry.dispose();
          this.wallPreview.geometry = new THREE.PlaneGeometry(length, height);

          const midPoint = new THREE.Vector3()
            .addVectors(this.wallStart, endPoint)
            .multiplyScalar(0.5);
          this.wallPreview.position.copy(midPoint);
          this.wallPreview.position.y = this.wallStart.y + height / 2;

          const angle = Math.atan2(direction.z, direction.x);
          this.wallPreview.rotation.y = -angle + Math.PI / 2;
        } else if (this.constructionMode === "floor") {
          // Sol/Plafond rectangulaire
          const width = Math.abs(endPoint.x - this.wallStart.x);
          const depth = Math.abs(endPoint.z - this.wallStart.z);
          const centerX = (this.wallStart.x + endPoint.x) / 2;
          const centerZ = (this.wallStart.z + endPoint.z) / 2;

          this.wallPreview.geometry.dispose();
          this.wallPreview.geometry = new THREE.PlaneGeometry(width, depth);
          this.wallPreview.position.set(centerX, this.wallStart.y, centerZ);
        }
      }
    }

    if (this.fillMode && this.fillPreview) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObject(this.ground);

      if (intersects.length > 0) {
        const endPoint = intersects[0].point;
        const width = Math.abs(endPoint.x - this.fillStart.x);
        const height = Math.abs(endPoint.z - this.fillStart.z);
        const centerX = (this.fillStart.x + endPoint.x) / 2;
        const centerZ = (this.fillStart.z + endPoint.z) / 2;

        this.fillPreview.scale.set(width, height, 1);
        this.fillPreview.position.set(centerX, 0.1, centerZ);
      }
    }

    if (
      this.isDragging &&
      this.currentObject &&
      (this.currentTool === "select" || this.currentTool === "place")
    ) {
      this.updateObjectPosition();
    }

    // Glissement des portails sÃ©lectionnÃ©s
    if (
      this.isDragging &&
      this.selectedPortal &&
      this.currentTool === "select"
    ) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObject(this.ground);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        this.selectedPortal.mesh.position.x = point.x;
        this.selectedPortal.mesh.position.z = point.z;
        this.selectedPortal.position.x = point.x;
        this.selectedPortal.position.z = point.z;
      }
    }
  }

  onMouseDown(event) {
    if (event.button !== 0) return;

    // Comportement selon l'outil actif
    switch (this.currentTool) {
      case "mouse":
        // Ne rien faire, juste laisser OrbitControls gÃ©rer
        break;
      case "move":
        // Pas d'action au clic en mode camÃ©ra
        break;

      case "select":
        // SÃ©lectionner un objet existant ou un portail
        this.controls.enabled = false;
        // D'abord vÃ©rifier si on clique sur un portail
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const portalMeshes = this.portals.map((p) => p.mesh);
        const portalIntersects = this.raycaster.intersectObjects(
          portalMeshes,
          true
        );
        if (portalIntersects.length > 0) {
          const clickedMesh = portalIntersects[0].object;
          const portalData = this.portals.find(
            (p) =>
              p.mesh === clickedMesh || p.mesh.children.includes(clickedMesh)
          );
          if (portalData) {
            // DÃ©sÃ©lectionner l'objet courant s'il y en a un
            this.currentObject = null;
            this.selectPortal(portalData);
            this.isDragging = true;
            return;
          }
        }
        // Sinon sÃ©lectionner un objet normal - dÃ©sÃ©lectionner le portail
        this.selectedPortal = null;
        this.currentPortal = null;
        document.getElementById("portal-properties-section").style.display =
          "none";
        this.selectExistingObject();
        break;

      case "place":
        // Placer un nouvel objet
        if (this.selectedModel && !this.currentObject) {
          this.isDragging = true;
          this.controls.enabled = false;
          this.createTemporaryObject();
        }
        break;
      case "fill":
        if (this.selectedModel) {
          this.controls.enabled = false; // DÃ©sactiver OrbitControls
          this.startFill();
        }
        break;

      case "portal":
        // Placer un portail
        this.controls.enabled = false;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const groundIntersects = this.raycaster.intersectObject(this.ground);
        if (groundIntersects.length > 0) {
          const point = groundIntersects[0].point;
          this.placePortalAt(point.x, 0, point.z);
        }
        this.controls.enabled = true;
        break;
      case "sculpt":
        this.controls.enabled = false;
        this.isSculpting = true;
        break;

      case "entity":
        if (this.entityTool && this.entityTool.onMouseDown(event)) {
          return;
        }
        break;
    }

    if (event.button !== 0) return; // Seulement clic gauche

    // Si on a dÃ©jÃ  un objet ou portail en cours, ne rien faire
    if (this.currentObject || this.selectedPortal) return;

    // Sinon, essayer de sÃ©lectionner un objet existant avec raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const placedObjects = this.scene.children.filter(
      (child) => child.userData.modelPath
    );
    const intersects = this.raycaster.intersectObjects(placedObjects, true);

    if (intersects.length > 0) {
      // Trouver le parent (l'objet complet, pas juste un mesh enfant)
      let selected = intersects[0].object;
      while (selected.parent && !selected.userData.modelPath) {
        selected = selected.parent;
      }

      this.currentObject = selected;
      this.isDragging = true;

      // Afficher les propriÃ©tÃ©s
      document.getElementById("object-properties-section").style.display =
        "block";

      // RÃ©cupÃ©rer la couleur actuelle
      selected.traverse((child) => {
        if (child.isMesh && child.material) {
          document.getElementById("color-picker").value =
            "#" + child.material.color.getHexString();
        }
      });

      // RÃ©cupÃ©rer le scale actuel
      document.getElementById("scale-input").value =
        selected.scale.x.toFixed(1);

      // RÃ©cupÃ©rer la collision
      const objData = this.objects.find(
        (o) =>
          o.position.x === selected.position.x &&
          o.position.y === selected.position.y &&
          o.position.z === selected.position.z
      );
      if (objData) {
        document.getElementById("has-collision").checked =
          objData.hasCollision || false;
      }

      console.log("Objet sÃ©lectionnÃ© pour modification");
      return;
    }

    // Sinon, crÃ©er un nouvel objet si un modÃ¨le est sÃ©lectionnÃ©
    if (this.selectedModel) {
      this.isDragging = true;
      this.createTemporaryObject();
    }
  }

  onMouseUp() {
    if (this.currentTool === "entity" && this.entityTool) {
      if (this.entityTool.onMouseUp(event)) {
        return;
      }
    }
    if (this.constructionMode && this.wallPreview) {
      this.completeConstruction();
    }
    if (this.fillMode && this.fillPreview) {
      this.completeFill();
    }

    this.isDragging = false;
    this.isSculpting = false;
    if (this.currentTool !== "move") {
      this.controls.enabled = true;
    }
  }

  completeConstruction() {
    if (!this.wallStart || !this.wallPreview) return;

    // CrÃ©er le mur/sol final
    const finalGeometry = this.wallPreview.geometry.clone();
    const color = document.getElementById("color-picker").value;
    const finalMaterial = new THREE.MeshStandardMaterial({
      color: color,
      side: THREE.DoubleSide,
    });

    const construction = new THREE.Mesh(finalGeometry, finalMaterial);
    construction.position.copy(this.wallPreview.position);
    construction.rotation.copy(this.wallPreview.rotation);
    construction.castShadow = true;
    construction.receiveShadow = true;

    construction.userData = {
      isConstruction: true,
      type: this.constructionMode,
      modelPath: `construction_${this.constructionMode}_${Date.now()}`,
      modelName: this.constructionMode === "wall" ? "Mur" : "Sol/Plafond",
    };

    this.scene.add(construction);

    // Sauvegarder dans objects
    this.objects.push({
      name: construction.userData.modelName,
      path: construction.userData.modelPath,
      type: "construction",
      constructionType: this.constructionMode,
      color: color,
      hasCollision: document.getElementById("has-collision").checked,
      position: {
        x: construction.position.x,
        y: construction.position.y,
        z: construction.position.z,
      },
      rotation: {
        x: construction.rotation.x,
        y: construction.rotation.y,
        z: construction.rotation.z,
      },
      scale: {
        x: construction.scale.x,
        y: construction.scale.y,
        z: construction.scale.z,
      },
      geometry: {
        width: finalGeometry.parameters.width,
        height: finalGeometry.parameters.height,
      },
    });

    // Nettoyer
    this.scene.remove(this.wallPreview);
    this.wallPreview = null;
    this.wallStart = null;
    this.constructionMode = null;

    document.getElementById("construction-props").style.display = "none";
    document.getElementById("object-properties-section").style.display = "none";
    document.getElementById("has-collision").checked = false;

    document.getElementById(
      "object-count"
    ).textContent = `Objets: ${this.objects.length}`;
    console.log("âœ… Construction crÃ©Ã©e");
  }

  toggleWall(direction, enabled) {
    if (enabled) {
      // CrÃ©er le mur
      if (this.walls[direction]) {
        this.scene.remove(this.walls[direction]);
        this.walls[direction] = null;
      }

      const groundSize = parseInt(document.getElementById("ground-size").value);
      const wallHeight = parseFloat(
        document.getElementById("wall-height").value
      );
      const color = document.getElementById("wall-color").value;

      const geometry = new THREE.PlaneGeometry(groundSize, wallHeight);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        side: THREE.DoubleSide,
      });

      const wall = new THREE.Mesh(geometry, material);
      wall.castShadow = true;
      wall.receiveShadow = true;

      const halfSize = groundSize / 2;
      const halfHeight = wallHeight / 2;

      switch (direction) {
        case "north":
          wall.position.set(0, halfHeight, -halfSize);
          wall.rotation.y = 0;
          break;
        case "south":
          wall.position.set(0, halfHeight, halfSize);
          wall.rotation.y = Math.PI;
          break;
        case "east":
          wall.position.set(halfSize, halfHeight, 0);
          wall.rotation.y = Math.PI / 2;
          break;
        case "west":
          wall.position.set(-halfSize, halfHeight, 0);
          wall.rotation.y = -Math.PI / 2;
          break;
      }

      wall.userData = {
        isConstruction: true,
        constructionType: "wall",
        direction: direction,
        locked: true, // EmpÃªcher dÃ©placement
        modelPath: `wall_${direction}`,
        modelName: `Mur ${direction.toUpperCase()}`,
      };

      this.scene.add(wall);
      this.walls[direction] = wall;

      console.log(`ðŸ§± Mur ${direction} activÃ©`);
    } else {
      // Supprimer le mur
      if (this.walls[direction]) {
        this.scene.remove(this.walls[direction]);
        this.walls[direction] = null;
        console.log(`ðŸ§± Mur ${direction} dÃ©sactivÃ©`);
      }
    }
  }

  toggleCeiling(enabled) {
    if (enabled) {
      if (this.ceiling) {
        this.scene.remove(this.ceiling);
        this.ceiling = null;
      }

      const groundSize = parseInt(document.getElementById("ground-size").value);
      const wallHeight = parseFloat(
        document.getElementById("wall-height").value
      );
      const color = document.getElementById("ceiling-color").value;

      const geometry = new THREE.PlaneGeometry(groundSize, groundSize);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        side: THREE.DoubleSide,
      });

      const ceiling = new THREE.Mesh(geometry, material);
      ceiling.rotation.x = -Math.PI / 2;
      ceiling.position.set(0, wallHeight, 0);
      ceiling.castShadow = true;
      ceiling.receiveShadow = true;

      ceiling.userData = {
        isConstruction: true,
        constructionType: "ceiling",
        locked: true,
        modelPath: "ceiling",
        modelName: "Plafond",
      };

      this.scene.add(ceiling);
      this.ceiling = ceiling;

      console.log("â¬œ Plafond activÃ©");
    } else {
      if (this.ceiling) {
        this.scene.remove(this.ceiling);
        this.ceiling = null;
        console.log("â¬œ Plafond dÃ©sactivÃ©");
      }
    }
  }

  updateWallsColor() {
    const color = document.getElementById("wall-color").value;
    Object.values(this.walls).forEach((wall) => {
      if (wall) {
        wall.material.color.set(color);
      }
    });
  }

  updateCeilingColor() {
    const color = document.getElementById("ceiling-color").value;
    if (this.ceiling) {
      this.ceiling.material.color.set(color);
    }
  }

  updateWallsHeight() {
    const newHeight = parseFloat(document.getElementById("wall-height").value);
    const groundSize = parseInt(document.getElementById("ground-size").value);
    const halfSize = groundSize / 2;
    const halfHeight = newHeight / 2;

    // Update murs
    Object.entries(this.walls).forEach(([direction, wall]) => {
      if (wall) {
        wall.geometry.dispose();
        wall.geometry = new THREE.PlaneGeometry(groundSize, newHeight);
        wall.position.y = halfHeight;
      }
    });

    // Update plafond
    if (this.ceiling) {
      this.ceiling.position.y = newHeight;
    }
  }

  completeFill() {
    if (!this.fillStart || !this.selectedModel) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.ground);

    if (intersects.length > 0) {
      const endPoint = intersects[0].point;
      const spacing = parseFloat(document.getElementById("fill-spacing").value);

      const minX = Math.min(this.fillStart.x, endPoint.x);
      const maxX = Math.max(this.fillStart.x, endPoint.x);
      const minZ = Math.min(this.fillStart.z, endPoint.z);
      const maxZ = Math.max(this.fillStart.z, endPoint.z);

      let count = 0;

      // Placer les objets en grille
      for (let x = minX; x <= maxX; x += spacing) {
        for (let z = minZ; z <= maxZ; z += spacing) {
          this.placeObjectAt(x, 0, z);
          count++;
        }
      }

      console.log(`ðŸŽ¨ ${count} objets placÃ©s`);
    }

    // Nettoyer
    this.scene.remove(this.fillPreview);
    this.fillPreview = null;
    this.fillMode = false;
    this.fillStart = null;

    if (this.currentTool !== "move") {
      this.controls.enabled = true;
    }

    document.getElementById(
      "object-count"
    ).textContent = `Objets: ${this.objects.length}`;
  }

  selectExistingObject() {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const placedObjects = this.scene.children.filter(
      (child) => child.userData.modelPath
    );
    const intersects = this.raycaster.intersectObjects(placedObjects, true);

    if (intersects.length > 0) {
      let selected = intersects[0].object;
      while (selected.parent && !selected.userData.modelPath) {
        selected = selected.parent;
      }

      // VÃ©rifier si l'objet est locked
      if (selected.userData.locked) {
        console.log("âŒ Cet objet ne peut pas Ãªtre dÃ©placÃ©");
        return;
      }

      this.currentObject = selected;
      this.isDragging = true;

      document.getElementById("object-properties-section").style.display =
        "block";

      selected.traverse((child) => {
        if (child.isMesh && child.material) {
          document.getElementById("color-picker").value =
            "#" + child.material.color.getHexString();
        }
      });

      document.getElementById("scale-input").value =
        selected.scale.x.toFixed(1);

      const objData = this.objects.find(
        (o) =>
          Math.abs(o.position.x - selected.position.x) < 0.01 &&
          Math.abs(o.position.y - selected.position.y) < 0.01 &&
          Math.abs(o.position.z - selected.position.z) < 0.01
      );
      if (objData) {
        document.getElementById("has-collision").checked =
          objData.hasCollision || false;
      }

      console.log("Objet sÃ©lectionnÃ©");
    }
  }

  placeObjectAt(x, y, z) {
    const model = this.selectedModel;
    const color = document.getElementById("color-picker").value;
    const scale = parseFloat(document.getElementById("scale-input").value);
    const hasCollision = document.getElementById("has-collision").checked;

    if (model.path.endsWith(".obj")) {
      this.objLoader.load(model.path, (obj) => {
        obj.position.set(x, y, z);
        obj.scale.set(scale, scale, scale);

        obj.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: color,
              roughness: 0.7,
            });
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        obj.userData = {
          modelPath: model.path,
          modelName: model.name,
          type: model.type,
        };

        this.scene.add(obj);

        this.objects.push({
          name: model.name,
          path: model.path,
          type: model.type,
          color: color,
          hasCollision: hasCollision,
          position: { x, y, z },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: scale, y: scale, z: scale },
        });
      });
    } else if (model.path.endsWith(".fbx")) {
      this.fbxLoader.load(model.path, (fbx) => {
        fbx.position.set(x, y, z);
        fbx.scale.set(scale, scale, scale);

        fbx.traverse((child) => {
          if (child.isMesh) {
            if (!child.material) {
              child.material = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.7,
              });
            } else {
              child.material.color = new THREE.Color(color);
            }
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        fbx.userData = {
          modelPath: model.path,
          modelName: model.name,
          type: model.type,
        };

        this.scene.add(fbx);

        this.objects.push({
          name: model.name,
          path: model.path,
          type: model.type,
          color: color,
          hasCollision: hasCollision,
          position: { x, y, z },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: scale, y: scale, z: scale },
        });
      });
    } else if (model.path.endsWith(".glb") || model.path.endsWith(".gltf")) {
      this.gltfLoader.load(model.path, (gltf) => {
        const obj = gltf.scene;
        obj.position.set(x, y, z);
        obj.scale.set(scale, scale, scale);

        obj.traverse((child) => {
          if (child.isMesh) {
            if (child.material) {
              child.material.color = new THREE.Color(color);
            }
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        obj.userData = {
          modelPath: model.path,
          modelName: model.name,
          type: model.type,
        };

        this.scene.add(obj);

        this.objects.push({
          name: model.name,
          path: model.path,
          type: model.type,
          color: color,
          hasCollision: hasCollision,
          position: { x, y, z },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: scale, y: scale, z: scale },
        });
      });
    }
  }

  toggleFreeCam() {
    this.freeCamMode = !this.freeCamMode;
    console.log("freeCamMode:", this.freeCamMode);
    if (this.freeCamMode) {
      this.controls.enabled = false; // DÃ©sactiver OrbitControls
      this.renderer.domElement.requestPointerLock(); // Lock la souris
      console.log(
        "ðŸŽ¥ Mode camÃ©ra libre (ZQSD pour bouger, Espace/Shift haut/bas, Echap pour sortir)"
      );
    } else {
      document.exitPointerLock();
      this.controls.enabled = true;
      console.log("âœï¸ Mode Ã©dition");
    }
  }

  createTemporaryObject() {
    if (this.currentObject) {
      this.scene.remove(this.currentObject);
    }

    const model = this.selectedModel;

    // Cube temporaire pendant le chargement
    const tempGeo = new THREE.BoxGeometry(1, 1, 1);
    const tempMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      wireframe: true,
    });
    this.currentObject = new THREE.Mesh(tempGeo, tempMat);

    this.currentObject.userData = {
      modelPath: model.path,
      modelName: model.name,
      type: model.type,
    };

    this.scene.add(this.currentObject);
    this.updateObjectPosition();

    // Charger le vrai modÃ¨le
    if (model.path.endsWith(".png") || model.path.endsWith(".jpg")) {
      // Sprite
      const texture = new THREE.TextureLoader().load(model.path);
      const spriteMat = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(2, 2, 1);

      // Remplacer le cube par le sprite
      const pos = this.currentObject.position.clone();
      const rot = this.currentObject.rotation.clone();
      this.scene.remove(this.currentObject);

      sprite.position.copy(pos);
      sprite.rotation.copy(rot);
      sprite.userData = this.currentObject.userData;
      this.currentObject = sprite;
      this.scene.add(this.currentObject);
    } else if (model.path.endsWith(".obj")) {
      // OBJ
      this.objLoader.load(model.path, (obj) => {
        const pos = this.currentObject.position.clone();
        const rot = this.currentObject.rotation.clone();
        this.scene.remove(this.currentObject);

        obj.position.copy(pos);
        obj.rotation.copy(rot);
        obj.userData = this.currentObject.userData;

        // Material par dÃ©faut avec couleur
        obj.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x00ff00,
              roughness: 0.7,
            });
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.currentObject = obj;
        this.scene.add(this.currentObject);

        // Afficher le panneau propriÃ©tÃ©s
        document.getElementById("object-properties-section").style.display =
          "block";
        document.getElementById("scale-input").value = "1";
      });
    } else if (model.path.endsWith(".glb") || model.path.endsWith(".gltf")) {
      // GLB/GLTF
      this.gltfLoader.load(model.path, (gltf) => {
        const pos = this.currentObject.position.clone();
        const rot = this.currentObject.rotation.clone();
        this.scene.remove(this.currentObject);

        gltf.scene.position.copy(pos);
        gltf.scene.rotation.copy(rot);
        gltf.scene.userData = this.currentObject.userData;

        this.currentObject = gltf.scene;
        this.scene.add(this.currentObject);

        document.getElementById("object-properties-section").style.display =
          "block";
        document.getElementById("scale-input").value = "1";
      });
    } else if (model.path.endsWith(".fbx")) {
      // FBX
      this.fbxLoader.load(model.path, (fbx) => {
        const pos = this.currentObject.position.clone();
        const rot = this.currentObject.rotation.clone();
        this.scene.remove(this.currentObject);

        fbx.position.copy(pos);
        fbx.rotation.copy(rot);
        fbx.userData = this.currentObject.userData;

        fbx.traverse((child) => {
          if (child.isMesh) {
            if (!child.material) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x00ff00,
                roughness: 0.7,
              });
            }
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.currentObject = fbx;
        this.scene.add(this.currentObject);

        document.getElementById("object-properties-section").style.display =
          "block";
        document.getElementById("scale-input").value = "1";
      });
    }
  }

  updateObjectPosition() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.ground);

    if (intersects.length > 0) {
      const point = intersects[0].point;

      if (this.snapEnabled && this.objects.length > 0) {
        // Snap Ã  la derniÃ¨re position
        const lastObj = this.objects[this.objects.length - 1];
        const snapDistance = 3;

        this.currentObject.position.set(
          lastObj.position.x + snapDistance,
          this.currentObject.position.y,
          lastObj.position.z
        );
        this.currentObject.rotation.y = lastObj.rotation.y;
      } else {
        this.currentObject.position.set(
          point.x,
          this.currentObject.position.y,
          point.z
        );
      }
    }
  }

  onWheel(event) {
    if (this.currentObject) {
      event.preventDefault();
      this.currentObject.position.y += event.deltaY * -0.01;
    }
  }

  onKeyDown(event) {
    // Ignorer les raccourcis si on tape dans un champ de formulaire
    const activeElement = document.activeElement;
    const isTyping =
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT" ||
        activeElement.isContentEditable);

    if (isTyping) {
      // Permettre uniquement Ctrl+S pour sauvegarder mÃªme en mode Ã©dition
      if (event.ctrlKey && event.code === "KeyS") {
        event.preventDefault();
        this.saveScene();
      }
      return;
    }

    // Mouvement AZERTY
    if (event.code === "KeyW") this.keys.z = true;
    if (event.code === "KeyA") this.keys.q = true;
    if (event.code === "KeyS") this.keys.s = true;
    if (event.code === "KeyD") this.keys.d = true;
    if (event.code === "Space") this.keys.space = true;
    if (event.code === "ShiftLeft") this.keys.shift = true;

    if (event.code === "KeyM") {
      this.setTool("mouse");
      return;
    }

    if (event.code === "KeyW" && !this.keys.z) {
      this.setTool("wall");
      return;
    }
    if (event.code === "KeyL") {
      this.setTool("floor");
      return;
    }
    // Raccourcis outils
    if (event.code === "KeyC" && !event.ctrlKey) {
      this.setTool("move");
      return;
    }
    if (event.code === "KeyV" && !event.ctrlKey) {
      this.setTool("select");
      return;
    }
    if (event.code === "KeyP") {
      this.setTool("place");
      return;
    }
    if (event.code === "KeyF") {
      this.setTool("fill");
      return;
    }

    // Copier-coller
    if (event.ctrlKey && event.code === "KeyC" && this.currentObject) {
      event.preventDefault();
      this.copyObject();
      return;
    }

    if (event.ctrlKey && event.code === "KeyV" && this.copiedObject) {
      event.preventDefault();
      this.pasteObject();
      return;
    }

    // Commandes Ã©diteur (pas en mode move)
    if (this.currentTool === "move") {
      event.preventDefault();
      return;
    }

    switch (event.code) {
      case "KeyR":
        if (this.currentObject) this.currentObject.rotation.y += Math.PI / 8;
        if (this.currentPortal) {
          this.currentPortal.mesh.rotation.y += Math.PI / 8;
          this.currentPortal.rotation.copy(this.currentPortal.mesh.rotation);
        }
        if (this.selectedPortal && !this.currentPortal) {
          this.selectedPortal.mesh.rotation.y += Math.PI / 8;
          this.selectedPortal.rotation.copy(this.selectedPortal.mesh.rotation);
        }
        break;
      case "KeyE":
        if (this.currentObject) this.currentObject.rotation.x += Math.PI / 8;
        break;
      case "Enter":
        this.confirmObject();
        if (this.currentPortal) {
          // Valider le portail courant
          this.currentPortal.position.copy(this.currentPortal.mesh.position);
          this.currentPortal.rotation.copy(this.currentPortal.mesh.rotation);
          this.currentPortal = null;
          console.log("Portail confirmÃ©");
        }
        break;
      case "Tab":
        event.preventDefault();
        this.snapEnabled = !this.snapEnabled;
        document.getElementById("snap-status").textContent = `Snap: ${
          this.snapEnabled ? "ON" : "OFF"
        }`;
        break;
      case "Backspace":
      case "Delete":
        if (this.currentPortal) {
          this.deleteSelectedPortal();
        } else {
          this.deleteLastObject();
        }
        break;
      case "KeyS":
        if (event.ctrlKey) {
          event.preventDefault();
          this.saveScene();
        }
        break;
      case "KeyO":
        // Raccourci pour l'outil portail
        this.setTool("portal");
        break;
    }
  }

  onKeyUp(event) {
    if (event.code === "KeyW") this.keys.z = false;
    if (event.code === "KeyA") this.keys.q = false;
    if (event.code === "KeyS") this.keys.s = false;
    if (event.code === "KeyD") this.keys.d = false;
    if (event.code === "Space") this.keys.space = false;
    if (event.code === "ShiftLeft") this.keys.shift = false;
  }

  confirmObject() {
    if (!this.currentObject) return;

    let color = "#00ff00";

    this.currentObject.traverse((child) => {
      if (child.isMesh && child.material && child.material.color) {
        color = "#" + child.material.color.getHexString();
      }
    });

    const objData = {
      name: this.currentObject.userData.modelName,
      path: this.currentObject.userData.modelPath,
      type: this.currentObject.userData.type,
      color: color,
      hasCollision: document.getElementById("has-collision").checked,
      position: {
        x: this.currentObject.position.x,
        y: this.currentObject.position.y,
        z: this.currentObject.position.z,
      },
      rotation: {
        x: this.currentObject.rotation.x,
        y: this.currentObject.rotation.y,
        z: this.currentObject.rotation.z,
      },
      scale: {
        x: this.currentObject.scale.x,
        y: this.currentObject.scale.y,
        z: this.currentObject.scale.z,
      },
    };

    if (this.currentObject.userData.isConstruction) {
      objData.constructionType = this.currentObject.userData.constructionType;
      objData.geometry = {
        width: this.currentObject.geometry.parameters.width,
        height: this.currentObject.geometry.parameters.height,
      };
    }

    // VÃ©rifier si l'objet existe dÃ©jÃ  dans la liste
    const existingIndex = this.objects.findIndex(
      (o) =>
        Math.abs(o.position.x - objData.position.x) < 0.01 &&
        Math.abs(o.position.y - objData.position.y) < 0.01 &&
        Math.abs(o.position.z - objData.position.z) < 0.01
    );

    if (existingIndex !== -1) {
      // Mettre Ã  jour l'objet existant
      this.objects[existingIndex] = objData;
      console.log("Objet mis Ã  jour", objData);
    } else {
      // Ajouter un nouvel objet
      this.objects.push(objData);
      console.log("Objet ajoutÃ©", objData);
    }

    this.isDragging = false;
    this.currentObject = null;

    if (this.currentTool !== "move") {
      this.controls.enabled = true;
    }

    document.getElementById("object-properties-section").style.display = "none";
    document.getElementById("has-collision").checked = false;
    document.getElementById("color-picker").value = "#00ff00";
    document.getElementById("scale-input").value = "1";

    document.getElementById(
      "object-count"
    ).textContent = `Objets: ${this.objects.length}`;
  }

  deleteLastObject() {
    if (this.objects.length > 0) {
      const deleted = this.objects.pop();
      console.log("Objet supprimÃ©", deleted);

      // Supprimer visuellement
      const toRemove = this.scene.children.find(
        (child) =>
          child.userData.modelPath === deleted.path &&
          child.position.equals(
            new THREE.Vector3(
              deleted.position.x,
              deleted.position.y,
              deleted.position.z
            )
          )
      );

      if (toRemove) {
        this.scene.remove(toRemove);
      }

      document.getElementById(
        "object-count"
      ).textContent = `Objets: ${this.objects.length}`;
    }
  }

  startFill() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.ground);

    if (intersects.length > 0) {
      this.fillStart = intersects[0].point.clone();
      this.fillMode = true;

      // CrÃ©er un helper visuel (rectangle)
      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });
      this.fillPreview = new THREE.Mesh(geometry, material);
      this.fillPreview.rotation.x = -Math.PI / 2;
      this.scene.add(this.fillPreview);

      console.log(
        "ðŸŽ¨ Cliquez et glissez pour dÃ©finir la zone de remplissage"
      );
    }
  }

  copyObject() {
    if (!this.currentObject) return;

    let color = "#00ff00";
    this.currentObject.traverse((child) => {
      if (child.isMesh && child.material && child.material.color) {
        color = "#" + child.material.color.getHexString();
      }
    });

    this.copiedObject = {
      name: this.currentObject.userData.modelName,
      path: this.currentObject.userData.modelPath,
      type: this.currentObject.userData.type,
      color: color,
      hasCollision: document.getElementById("has-collision").checked,
      rotation: {
        x: this.currentObject.rotation.x,
        y: this.currentObject.rotation.y,
        z: this.currentObject.rotation.z,
      },
      scale: {
        x: this.currentObject.scale.x,
        y: this.currentObject.scale.y,
        z: this.currentObject.scale.z,
      },
    };

    console.log("ðŸ“‹ Objet copiÃ©:", this.copiedObject.name);
  }

  pasteObject() {
    if (!this.copiedObject) return;

    // CrÃ©er un nouvel objet basÃ© sur la copie
    const modelData = this.models.find(
      (m) => m.path === this.copiedObject.path
    );
    if (!modelData) {
      console.error("ModÃ¨le introuvable pour le collage");
      return;
    }

    // SÃ©lectionner le modÃ¨le
    this.selectedModel = modelData;

    // Passer en mode placement
    this.setTool("place");

    // CrÃ©er l'objet temporaire
    this.isDragging = true;
    this.createTemporaryObject();

    // Attendre que l'objet soit chargÃ© puis appliquer les propriÃ©tÃ©s
    const checkLoaded = setInterval(() => {
      if (this.currentObject && this.currentObject.type !== "Mesh") {
        // Pas le cube temporaire
        clearInterval(checkLoaded);

        // Appliquer les propriÃ©tÃ©s copiÃ©es
        this.currentObject.rotation.set(
          this.copiedObject.rotation.x,
          this.copiedObject.rotation.y,
          this.copiedObject.rotation.z
        );

        this.currentObject.scale.set(
          this.copiedObject.scale.x,
          this.copiedObject.scale.y,
          this.copiedObject.scale.z
        );

        // Appliquer la couleur
        const color = new THREE.Color(this.copiedObject.color);
        this.currentObject.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.color = color;
          }
        });

        // Mettre Ã  jour l'UI
        document.getElementById("color-picker").value = this.copiedObject.color;
        document.getElementById("scale-input").value =
          this.copiedObject.scale.x.toFixed(1);
        document.getElementById("has-collision").checked =
          this.copiedObject.hasCollision;

        console.log(
          "ðŸ“Œ Objet collÃ©, placez-le avec la souris et validez avec Enter"
        );
      }
    }, 100);

    // Timeout sÃ©curitÃ©
    setTimeout(() => clearInterval(checkLoaded), 5000);
  }

  setTool(tool) {
    this.currentTool = tool;

    // Mettre Ã  jour l'UI
    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.tool === tool) {
        btn.classList.add("active");
      }
    });

    // GÃ©rer le mode camÃ©ra
    if (tool === "move") {
      // Mode camÃ©ra libre
      this.controls.enabled = false;
      this.renderer.domElement.requestPointerLock();
      console.log("ðŸŽ¥ Outil: DÃ©placer camÃ©ra (ZQSD)");
    } else {
      document.exitPointerLock();
      this.controls.enabled = true;

      if (tool === "mouse") {
        console.log("ðŸ–±ï¸ Outil: Souris libre (OrbitControls)");
      } else {
        console.log(
          `ðŸ”§ Outil: ${tool === "select" ? "SÃ©lectionner" : "Placer objet"}`
        );
      }
    }

    if (tool === "entity") {
      document.exitPointerLock();
      this.controls.enabled = true;
      console.log("ðŸŽ­ Outil: Placer entitÃ©s");
    }

    // Cacher les propriÃ©tÃ©s si on change d'outil
    if (tool !== "select" && this.currentObject) {
      this.currentObject = null;
      document.getElementById("object-properties-section").style.display =
        "none";
    }

    // Ajouter pour le tool sculpt
    if (tool === "sculpt") {
      this.brushPreview.visible = true;
      console.log("ðŸ–Œï¸ Outil: Sculpt terrain");
    } else {
      this.brushPreview.visible = false;
    }
  }

  loadScene(sceneName) {
    fetch(`http://localhost:3000/load-scene/${sceneName}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("ScÃ¨ne chargÃ©e:", data);

        if (data.isPrefabScene) {
          document.getElementById("prefab-scene").checked = true;
          this.isPrefabScene = true;
          document.getElementById("prefab-options").style.display = "block";

          // Cacher le terrain
          this.ground.visible = false;
          const grid = this.scene.children.find((c) => c.type === "GridHelper");
          if (grid) grid.visible = false;

          // Charger le modÃ¨le prÃ©fait
          if (data.prefabModel) {
            document.getElementById("prefab-model").value = data.prefabModel;
            document.getElementById("prefab-scale").value =
              data.prefabScale || 1;
            this.loadPrefabScene(data.prefabModel);
          }
        } else {
          document.getElementById("prefab-scene").checked = false;
          this.isPrefabScene = false;
          document.getElementById("prefab-options").style.display = "none";

          // Afficher le terrain
          this.ground.visible = true;
          const grid = this.scene.children.find((c) => c.type === "GridHelper");
          if (grid) grid.visible = true;
        }

        // Charger la taille du terrain
        if (data.groundWidth && data.groundHeight) {
          document.getElementById("ground-width").value = data.groundWidth;
          document.getElementById("ground-height").value = data.groundHeight;
          this.groundSegments = data.groundSegments || 50;
          this.updateGroundSize(data.groundWidth, data.groundHeight);
        }

        if (data.heightMap && data.heightMap.length > 0) {
          this.heightMap = data.heightMap;
          this.applyHeightMap();
        }

        if (data.groundColor) {
          document.getElementById("ground-color").value = data.groundColor;
          this.updateGroundColor(data.groundColor);
        }

        if (data.walls) {
          // D'abord mettre les valeurs dans les inputs
          document.getElementById("wall-height").value = data.walls.height || 3;
          document.getElementById("wall-color").value =
            data.walls.color || "#ffffff";
        }

        if (data.ceiling) {
          document.getElementById("ceiling-color").value =
            data.ceiling.color || "#f0f0f0";
        }

        // Ensuite crÃ©er les murs
        if (data.walls) {
          document.getElementById("toggle-wall-north").checked =
            data.walls.north || false;
          this.toggleWall("north", data.walls.north || false);

          document.getElementById("toggle-wall-south").checked =
            data.walls.south || false;
          this.toggleWall("south", data.walls.south || false);

          document.getElementById("toggle-wall-east").checked =
            data.walls.east || false;
          this.toggleWall("east", data.walls.east || false);

          document.getElementById("toggle-wall-west").checked =
            data.walls.west || false;
          this.toggleWall("west", data.walls.west || false);
        }

        if (data.ceiling) {
          document.getElementById("toggle-ceiling").checked =
            data.ceiling.enabled || false;
          this.toggleCeiling(data.ceiling.enabled || false);
        }

        // Vider la scÃ¨ne actuelle (garder ground et lights)
        const toRemove = [];
        this.scene.children.forEach((child) => {
          if (child.userData.modelPath) {
            toRemove.push(child);
          }
        });
        toRemove.forEach((obj) => this.scene.remove(obj));

        // Charger les objets
        this.objects = data.objects;

        data.objects.forEach((objData) => {
          this.loadObject(objData);
        });

        // Charger les entitÃ©s
        if (data.entities && this.entityTool) {
          this.entityTool.loadEntitiesData(data.entities);
          console.log("EntitÃ©s chargÃ©es:", data.entities);
        }

        // AprÃ¨s le chargement des entitÃ©s, ajouter :

        // Charger les portails
        if (data.portals && data.portals.length > 0) {
          // Supprimer les anciens portails
          this.portals.forEach((p) => this.scene.remove(p.mesh));
          this.portals = [];

          data.portals.forEach((portalData) => {
            const mesh = this.createPortalMesh(
              portalData.size.width,
              portalData.size.height,
              portalData.color
            );

            mesh.position.set(
              portalData.position.x,
              portalData.position.y,
              portalData.position.z
            );
            mesh.rotation.set(
              portalData.rotation.x,
              portalData.rotation.y,
              portalData.rotation.z
            );

            const portal = {
              name: portalData.name,
              mesh: mesh,
              position: new THREE.Vector3(
                portalData.position.x,
                portalData.position.y,
                portalData.position.z
              ),
              rotation: new THREE.Euler(
                portalData.rotation.x,
                portalData.rotation.y,
                portalData.rotation.z
              ),
              size: portalData.size,
              color: portalData.color,
              targetScene: portalData.targetScene,
              spawnPosition: portalData.spawnPosition || { x: 0, y: 1.6, z: 0 },
              spawnRotation: portalData.spawnRotation || 0,
            };

            mesh.userData.isPortal = true;
            mesh.userData.portalIndex = this.portals.length;

            this.scene.add(mesh);
            this.portals.push(portal);
          });

          this.portalCounter = this.portals.length + 1;
          console.log(`ðŸšª ${this.portals.length} portails chargÃ©s`);
        }

        document.getElementById(
          "object-count"
        ).textContent = `Objets: ${this.objects.length}`;
        alert("ScÃ¨ne chargÃ©e!");
      })
      .catch((err) => {
        console.error("Erreur chargement:", err);
        alert("Erreur lors du chargement");
      });
  }

  loadPrefabScene(modelPath) {
    // Supprimer l'ancien prefab s'il existe
    if (this.prefabModel) {
      this.scene.remove(this.prefabModel);
    }

    const scale =
      parseFloat(document.getElementById("prefab-scale").value) || 1;

    this.gltfLoader.load(modelPath, (gltf) => {
      this.prefabModel = gltf.scene;

      // Positionner Ã  l'origine
      this.prefabModel.position.set(0, 0, 0);
      this.prefabModel.scale.set(scale, scale, scale);

      // Marquer tous les meshes
      this.prefabModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          const isCollision =
            child.name.toLowerCase().includes("_colli") ||
            child.parent?.name.toLowerCase().includes("_colli");

          if (isCollision) {
            child.visible = false;
            child.userData.hasCollision = true;
            child.userData.isCollisionMesh = true;
          }
        }
      });

      this.prefabModel.userData.isPrefab = true;
      this.prefabModel.userData.modelPath = modelPath;

      this.scene.add(this.prefabModel);
      console.log("Prefab chargÃ©:", modelPath, "scale:", scale);
    });
  }

  applyHeightMap() {
    const positions = this.ground.geometry.attributes.position;
    for (let i = 0; i < this.heightMap.length && i < positions.count; i++) {
      positions.setZ(i, this.heightMap[i]);
    }
    positions.needsUpdate = true;
    this.ground.geometry.computeVertexNormals();
  }

  // Nouvelle mÃ©thode loadObject :
  loadObject(objData) {
    const loader = objData.path.endsWith(".obj")
      ? this.objLoader
      : this.gltfLoader;

    if (objData.type === "construction") {
      const geometry = new THREE.PlaneGeometry(
        objData.geometry.width,
        objData.geometry.height
      );
      const material = new THREE.MeshStandardMaterial({
        color: objData.color || 0xffffff,
        side: THREE.DoubleSide,
      });

      const construction = new THREE.Mesh(geometry, material);
      construction.position.set(
        objData.position.x,
        objData.position.y,
        objData.position.z
      );
      construction.rotation.set(
        objData.rotation.x,
        objData.rotation.y,
        objData.rotation.z
      );
      construction.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);
      construction.castShadow = true;
      construction.receiveShadow = true;

      construction.userData = {
        isConstruction: true,
        constructionType: objData.constructionType,
        direction: objData.direction,
        modelPath: objData.path,
        modelName: objData.name,
        hasCollision: objData.hasCollision,
      };

      this.scene.add(construction);
      return;
    }

    if (objData.path.endsWith(".obj")) {
      this.objLoader.load(objData.path, (obj) => {
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

        obj.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: objData.color || 0x00ff00,
              roughness: 0.7,
            });
          }
        });

        obj.userData = {
          modelPath: objData.path,
          modelName: objData.name,
          type: objData.type,
          hasCollision: objData.hasCollision,
        };

        this.scene.add(obj);
      });
    } else if (objData.path.endsWith(".fbx")) {
      this.fbxLoader.load(objData.path, (fbx) => {
        fbx.position.set(
          objData.position.x,
          objData.position.y,
          objData.position.z
        );
        fbx.rotation.set(
          objData.rotation.x,
          objData.rotation.y,
          objData.rotation.z
        );
        fbx.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);

        fbx.userData = {
          modelPath: objData.path,
          modelName: objData.name,
          type: objData.type,
          hasCollision: objData.hasCollision,
        };

        this.scene.add(fbx);
      });
    } else {
      this.gltfLoader.load(objData.path, (gltf) => {
        gltf.scene.position.set(
          objData.position.x,
          objData.position.y,
          objData.position.z
        );
        gltf.scene.rotation.set(
          objData.rotation.x,
          objData.rotation.y,
          objData.rotation.z
        );
        gltf.scene.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);

        gltf.scene.userData = {
          modelPath: objData.path,
          modelName: objData.name,
          type: objData.type,
          hasCollision: objData.hasCollision,
        };

        this.scene.add(gltf.scene);
      });
    }
  }

  // ========== PORTAL METHODS ==========

  loadScenesList() {
    fetch("http://localhost:3000/list-scenes")
      .then((res) => res.json())
      .then((data) => {
        this.availableScenes = data.scenes || [];
        const select = document.getElementById("portal-target-scene");
        select.innerHTML = '<option value="">-- Selectionner --</option>';
        this.availableScenes.forEach((scene) => {
          const option = document.createElement("option");
          option.value = scene;
          option.textContent = scene;
          select.appendChild(option);
        });
        console.log("Scenes disponibles:", this.availableScenes);
      })
      .catch((err) => {
        console.error("Erreur chargement scenes:", err);
      });
  }

  setupPortalEvents() {
    // Bouton mise Ã  jour portail
    document
      .getElementById("portal-update-btn")
      .addEventListener("click", () => {
        this.updatePortalFromUI();
      });

    // Mise Ã  jour en temps rÃ©el de la couleur
    document.getElementById("portal-color").addEventListener("input", (e) => {
      if (this.currentPortal) {
        this.currentPortal.mesh.material.color.set(e.target.value);
        this.currentPortal.color = e.target.value;
      }
    });

    // Mise Ã  jour automatique quand on change les valeurs
    const autoUpdateFields = [
      "portal-name",
      "portal-target-scene",
      "portal-linked-name",
      "portal-width",
      "portal-height",
      "portal-spawn-x",
      "portal-spawn-y",
      "portal-spawn-z",
      "portal-rotation-y",
    ];
    autoUpdateFields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => this.updatePortalFromUI());
      }
    });
  }

  createPortalMesh(width, height, color) {
    const group = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(width, height);

    // Face avant (bleue) - cÃ´tÃ© entrÃ©e (+Z)
    const frontMaterial = new THREE.MeshBasicMaterial({
      color: 0x3b82f6, // Bleu
      transparent: true,
      opacity: 0.7,
      side: THREE.FrontSide,
      depthWrite: false,
    });
    const frontMesh = new THREE.Mesh(geometry, frontMaterial);
    group.add(frontMesh);

    // Face arriÃ¨re (rouge) - cÃ´tÃ© sortie (-Z)
    const backMaterial = new THREE.MeshBasicMaterial({
      color: 0xef4444, // Rouge
      transparent: true,
      opacity: 0.7,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const backMesh = new THREE.Mesh(geometry, backMaterial);
    group.add(backMesh);

    // Ajouter un contour blanc
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    group.add(wireframe);

    // Ajouter une flÃ¨che pour indiquer la direction d'entrÃ©e
    const arrowGeo = new THREE.ConeGeometry(0.2, 0.5, 8);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = Math.PI / 2; // Pointer vers +Z
    arrow.position.z = 0.3;
    arrow.position.y = height / 2 - 0.5;
    group.add(arrow);

    return group;
  }

  placePortalAt(x, y, z) {
    const name =
      document.getElementById("portal-name").value ||
      `portal_${this.portalCounter}`;
    const width =
      parseFloat(document.getElementById("portal-width").value) || 2;
    const height =
      parseFloat(document.getElementById("portal-height").value) || 3;
    const color = document.getElementById("portal-color").value || "#6366f1";
    const targetScene =
      document.getElementById("portal-target-scene").value || "";
    const spawnX =
      parseFloat(document.getElementById("portal-spawn-x").value) || 0;
    const spawnY =
      parseFloat(document.getElementById("portal-spawn-y").value) || 1.6;
    const spawnZ =
      parseFloat(document.getElementById("portal-spawn-z").value) || 0;
    const spawnRot =
      parseFloat(document.getElementById("portal-rotation-y").value) || 0;

    const mesh = this.createPortalMesh(width, height, color);
    mesh.position.set(x, y + height / 2, z);

    const linkedPortalName =
      document.getElementById("portal-linked-name").value || "";

    const portalData = {
      name: name,
      mesh: mesh,
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      size: { width, height },
      color: color,
      targetScene: targetScene,
      linkedPortalName: linkedPortalName,
      spawnPosition: { x: spawnX, y: spawnY, z: spawnZ },
      spawnRotation: spawnRot * (Math.PI / 180), // Convert to radians
    };

    mesh.userData.isPortal = true;
    mesh.userData.portalIndex = this.portals.length;

    this.scene.add(mesh);
    this.portals.push(portalData);
    this.currentPortal = portalData;
    this.portalCounter++;

    // Afficher le panneau des propriÃ©tÃ©s
    document.getElementById("portal-properties-section").style.display =
      "block";
    document.getElementById(
      "portal-name"
    ).value = `portal_${this.portalCounter}`;

    console.log(
      "Portail placÃ©:",
      portalData.name,
      "vers",
      targetScene || "non dÃ©fini"
    );
    return portalData;
  }

  selectPortal(portalData) {
    this.currentPortal = portalData;
    this.selectedPortal = portalData;

    // Remplir les champs UI
    document.getElementById("portal-name").value = portalData.name;
    document.getElementById("portal-width").value = portalData.size.width;
    document.getElementById("portal-height").value = portalData.size.height;
    document.getElementById("portal-color").value = portalData.color;
    document.getElementById("portal-target-scene").value =
      portalData.targetScene;
    document.getElementById("portal-spawn-x").value =
      portalData.spawnPosition.x;
    document.getElementById("portal-spawn-y").value =
      portalData.spawnPosition.y;
    document.getElementById("portal-spawn-z").value =
      portalData.spawnPosition.z;
    document.getElementById("portal-linked-name").value =
      portalData.linkedPortalName || "";
    document.getElementById("portal-rotation-y").value = Math.round(
      portalData.rotation.y * (180 / Math.PI)
    );

    // Afficher le panneau
    document.getElementById("portal-properties-section").style.display =
      "block";
    document.getElementById("object-properties-section").style.display = "none";
  }

  updatePortalFromUI() {
    if (!this.currentPortal) return;

    const p = this.currentPortal;
    p.name = document.getElementById("portal-name").value;
    p.size.width = parseFloat(document.getElementById("portal-width").value);
    p.size.height = parseFloat(document.getElementById("portal-height").value);
    p.color = document.getElementById("portal-color").value;
    p.targetScene = document.getElementById("portal-target-scene").value;
    p.spawnPosition.x = parseFloat(
      document.getElementById("portal-spawn-x").value
    );
    p.spawnPosition.y = parseFloat(
      document.getElementById("portal-spawn-y").value
    );
    p.spawnPosition.z = parseFloat(
      document.getElementById("portal-spawn-z").value
    );

    // RecrÃ©er le mesh avec la nouvelle taille
    const oldPos = p.mesh.position.clone();
    const oldRot = p.mesh.rotation.clone();
    this.scene.remove(p.mesh);

    p.mesh = this.createPortalMesh(p.size.width, p.size.height, p.color);
    p.mesh.position.copy(oldPos);
    p.mesh.rotation.copy(oldRot);
    const rotationY =
      parseFloat(document.getElementById("portal-rotation-y").value) *
      (Math.PI / 180);
    p.mesh.rotation.y = rotationY;
    p.rotation.copy(p.mesh.rotation);
    p.mesh.userData.isPortal = true;
    p.mesh.userData.portalIndex = this.portals.indexOf(p);

    this.scene.add(p.mesh);
  }

  deleteSelectedPortal() {
    if (!this.currentPortal) return;

    const index = this.portals.indexOf(this.currentPortal);
    if (index > -1) {
      this.scene.remove(this.currentPortal.mesh);
      this.portals.splice(index, 1);
      this.currentPortal = null;
      this.selectedPortal = null;
      document.getElementById("portal-properties-section").style.display =
        "none";
      console.log("Portail supprimÃ©");
    }
  }

  saveScene() {
    const sceneName = prompt("Nom de la scÃ¨ne:", "bourg-palette");
    if (!sceneName) {
      console.log("Sauvegarde annulÃ©e");
      return;
    }

    const sceneData = {
      name: sceneName,
      isInterior: this.isPrefabScene,
      isPrefabScene: this.isPrefabScene,
      prefabModel: this.prefabModel?.userData.modelPath || null, // <-- AJOUTER
      prefabScale: this.prefabModel?.scale.x || 1,
      groundWidth: this.groundWidth,
      groundHeight: this.groundHeight,
      groundSegments: this.groundSegments,
      groundColor: this.groundColor,
      heightMap: this.heightMap,
      walls: {
        north: document.getElementById("toggle-wall-north").checked,
        south: document.getElementById("toggle-wall-south").checked,
        east: document.getElementById("toggle-wall-east").checked,
        west: document.getElementById("toggle-wall-west").checked,
        height: parseFloat(document.getElementById("wall-height").value),
        color: document.getElementById("wall-color").value,
      },
      ceiling: {
        enabled: document.getElementById("toggle-ceiling").checked,
        color: document.getElementById("ceiling-color").value,
      },
      objects: this.objects,
      portals: this.portals.map((p) => ({
        name: p.name,
        position: { x: p.position.x, y: p.position.y, z: p.position.z },
        rotation: { x: p.rotation.x, y: p.rotation.y, z: p.rotation.z },
        size: { width: p.size.width, height: p.size.height },
        color: p.color,
        targetScene: p.targetScene,
        linkedPortalName: p.linkedPortalName || "",
        spawnPosition: {
          x: p.spawnPosition.x,
          y: p.spawnPosition.y,
          z: p.spawnPosition.z,
        },
        spawnRotation: p.spawnRotation,
      })),
      entities: this.entityTool
        ? this.entityTool.getEntitiesData()
        : { pnj: [], spawnZones: [] },
    };

    fetch("http://localhost:3000/save-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sceneData),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("ScÃ¨ne sauvegardÃ©e!", data);
        alert("ScÃ¨ne sauvegardÃ©e avec succÃ¨s!");
      })
      .catch((err) => {
        console.error("Erreur sauvegarde:", err);
        alert("Erreur lors de la sauvegarde");
      });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateCameraMovement() {
    if (this.currentTool !== "move") return;

    const direction = new THREE.Vector3();

    if (this.keys.z) direction.z += 1;
    if (this.keys.s) direction.z -= 1;
    if (this.keys.q) direction.x -= 1;
    if (this.keys.d) direction.x += 1;

    if (direction.length() === 0 && !this.keys.space && !this.keys.shift)
      return;

    direction.normalize();

    // CrÃ©er un vecteur forward basÃ© sur la rotation Y de la camÃ©ra
    const forward = new THREE.Vector3(
      Math.sin(this.camera.rotation.y),
      0,
      Math.cos(this.camera.rotation.y)
    );

    // Direction droite (perpendiculaire au forward)
    const right = new THREE.Vector3(
      Math.cos(this.camera.rotation.y),
      0,
      -Math.sin(this.camera.rotation.y)
    );

    // Mouvement
    const move = new THREE.Vector3();
    move.addScaledVector(forward, -direction.z * this.moveSpeed);
    move.addScaledVector(right, direction.x * this.moveSpeed);

    // Monter/descendre
    if (this.keys.space) move.y += this.moveSpeed;
    if (this.keys.shift) move.y -= this.moveSpeed;

    this.camera.position.add(move);
  }

  toggleTestMode() {
    this.testMode = !this.testMode;

    if (this.testMode) {
      // Activer mode test
      console.log("ðŸŽ® MODE TEST activÃ©");

      // Masquer UI Ã©diteur
      document
        .querySelectorAll(".sidebar")
        .forEach((s) => (s.style.display = "none"));
      document.getElementById("object-properties-section").style.display =
        "none";
      document.getElementById("toolbar").style.display = "none";
      document.getElementById("test-overlay").style.display = "flex";
      // Ã‰tendre le canvas
      document.getElementById("canvas-container").style.left = "0";
      document.getElementById("canvas-container").style.right = "0";

      // Sauvegarder position camÃ©ra Ã©diteur
      this.editorCamPos = this.camera.position.clone();
      this.editorCamRot = this.camera.rotation.clone();

      // DÃ©sactiver OrbitControls
      this.controls.enabled = false;
      document.exitPointerLock();

      // CrÃ©er le joueur
      this.player = new Player(this.scene, this.camera, this.renderer);
    } else {
      // DÃ©sactiver mode test
      console.log("âœï¸ MODE Ã‰DITION");

      // RÃ©afficher UI
      document
        .querySelectorAll(".sidebar")
        .forEach((s) => (s.style.display = "flex"));
      document.getElementById("toolbar").style.display = "flex";
      document.getElementById("test-overlay").style.display = "none";
      // Restaurer le canvas
      document.getElementById("canvas-container").style.left =
        "var(--sidebar-width)";
      document.getElementById("canvas-container").style.right =
        "var(--sidebar-width)";

      // DÃ©sactiver le joueur
      if (this.player) {
        this.player.deactivate();
        this.player = null;
      }

      // Restaurer camÃ©ra Ã©diteur
      this.camera.position.copy(this.editorCamPos);
      this.camera.rotation.copy(this.editorCamRot);

      // RÃ©activer OrbitControls
      this.controls.enabled = true;
    }
  }

  initEntityTool() {
    this.entityTool = new EntityTool(this);
    console.log("ðŸŽ­ EntityTool initialisÃ©");
  }

  initWorldMapEditor() {
    this.worldMapEditor = new WorldMapEditor();
    console.log("🗺️ WorldMapEditor initialisé");
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.testMode && this.player) {
      // Mode test - update player
      const delta = this.clock.getDelta();

      // Collecter tous les objets avec collision
      const collisionObjects = [this.ground];
      this.scene.children.forEach((child) => {
        if (child.userData.hasCollision) {
          collisionObjects.push(child);
        }
      });

      this.player.update(delta, collisionObjects);
    } else {
      // Mode Ã©diteur
      this.updateCameraMovement();

      if (this.currentTool !== "move") {
        this.controls.update();
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Lancer l'Ã©diteur
new PokemonEditor();
