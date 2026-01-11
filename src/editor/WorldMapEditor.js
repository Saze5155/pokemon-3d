import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * WorldMapEditor - Éditeur de carte du monde avec rendu précis
 * Fond transparent, pivot de rotation, superposition
 */
export class WorldMapEditor {
  constructor() {
    this.overlay = document.getElementById("worldmap-overlay");
    this.canvas = document.getElementById("worldmap-canvas");
    this.ctx = this.canvas.getContext("2d");

    // Données
    this.availableScenes = [];
    this.placedZones = [];
    this.selectedZone = null;

    // Vue
    this.viewOffset = { x: 0, y: 0 };
    this.zoom = 1;
    this.minZoom = 0.02;
    this.maxZoom = 10;

    // Interaction
    this.isDragging = false;
    this.isPanning = false;
    this.isRotating = false;
    this.dragStart = { x: 0, y: 0 };
    this.draggedZone = null;
    this.dragOffset = { x: 0, y: 0 };

    // Rendu
    this.sceneThumbnails = new Map();
    this.gltfLoader = new GLTFLoader();
    this.thumbnailRenderer = null;
    this.modelCache = new Map();

    this.pixelsPerUnit = 15;
    this.maxThumbnailSize = 4096;

    // Grid
    this.gridSize = 1;
    this.snapToGrid = false;
    this.showGrid = true;

    // Affichage
    this.zoneOpacity = 1.0;
    this.showBorders = true;
    this.showGround = false; // FALSE = fond transparent, que les modèles
    this.showPivots = true;

    // Loading
    this.loadingScenes = new Set();

    this.init();
  }

  init() {
    this.setupThumbnailRenderer();
    this.setupEvents();
    this.loadAvailableScenes();
  }

  setupThumbnailRenderer() {
    this.thumbnailRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true, // Important pour transparence
      preserveDrawingBuffer: true,
    });
    this.thumbnailRenderer.setPixelRatio(1);
    this.thumbnailRenderer.setClearColor(0x000000, 0); // Fond transparent
    this.thumbnailRenderer.shadowMap.enabled = false;

    this.thumbnailCamera = new THREE.OrthographicCamera(
      -50,
      50,
      50,
      -50,
      0.1,
      500
    );
    this.thumbnailCamera.position.set(0, 200, 0);
    this.thumbnailCamera.lookAt(0, 0, 0);
  }

  setupEvents() {
    // Boutons
    document
      .getElementById("worldmap-btn")
      ?.addEventListener("click", () => this.open());
    document
      .getElementById("worldmap-close-btn")
      ?.addEventListener("click", () => this.close());
    document
      .getElementById("worldmap-save-btn")
      ?.addEventListener("click", () => this.save());
    document
      .getElementById("worldmap-load-btn")
      ?.addEventListener("click", () => this.load());
    document
      .getElementById("worldmap-remove-zone")
      ?.addEventListener("click", () => this.removeSelectedZone());

    // Canvas
    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("wheel", (e) => this.onWheel(e));
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // Drag & drop
    this.canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });

    this.canvas.addEventListener("drop", (e) => {
      e.preventDefault();
      const sceneName = e.dataTransfer.getData("scene");
      if (sceneName) {
        const pos = this.getCanvasPos(e);
        const worldPos = this.canvasToWorld(pos.x, pos.y);
        let x = worldPos.x;
        let z = worldPos.z;
        if (this.snapToGrid) {
          x = Math.round(x / this.gridSize) * this.gridSize;
          z = Math.round(z / this.gridSize) * this.gridSize;
        }
        this.addZone(sceneName, x, z);
      }
    });

    // Clavier
    window.addEventListener("keydown", (e) => {
      if (!this.isOpen()) return;

      switch (e.key.toLowerCase()) {
        case "escape":
          this.close();
          break;
        case "delete":
          if (this.selectedZone) this.removeSelectedZone();
          break;
        case "g":
          this.snapToGrid = !this.snapToGrid;
          this.render();
          break;
        case "h":
          this.showGrid = !this.showGrid;
          this.render();
          break;
        case "b":
          this.showBorders = !this.showBorders;
          this.render();
          break;
        case "p":
          this.showPivots = !this.showPivots;
          this.render();
          break;
        case "f":
          // Toggle fond/sol visible
          this.showGround = !this.showGround;
          // Regénérer tous les thumbnails
          this.regenerateAllThumbnails();
          break;
        case "t":
          this.zoneOpacity = this.zoneOpacity === 1.0 ? 0.6 : 1.0;
          this.render();
          break;
        case "[":
          this.zoneOpacity = Math.max(0.1, this.zoneOpacity - 0.1);
          this.render();
          break;
        case "]":
          this.zoneOpacity = Math.min(1.0, this.zoneOpacity + 0.1);
          this.render();
          break;
        case "pageup":
          if (this.selectedZone) this.moveZoneUp();
          break;
        case "pagedown":
          if (this.selectedZone) this.moveZoneDown();
          break;
        case "r":
          // Rotation de 90°
          if (this.selectedZone) {
            this.selectedZone.rotation =
              ((this.selectedZone.rotation || 0) + 90) % 360;
            this.render();
          }
          break;
        case "e":
          // Rotation de -90°
          if (this.selectedZone) {
            this.selectedZone.rotation =
              ((this.selectedZone.rotation || 0) - 90 + 360) % 360;
            this.render();
          }
          break;
        case "arrowup":
        case "arrowdown":
        case "arrowleft":
        case "arrowright":
          if (this.selectedZone) {
            e.preventDefault();
            const step = e.shiftKey ? 0.1 : e.ctrlKey ? 0.01 : 1;
            switch (e.key) {
              case "ArrowUp":
                this.selectedZone.worldZ -= step;
                break;
              case "ArrowDown":
                this.selectedZone.worldZ += step;
                break;
              case "ArrowLeft":
                this.selectedZone.worldX -= step;
                break;
              case "ArrowRight":
                this.selectedZone.worldX += step;
                break;
            }
            this.updatePropertiesPanel();
            this.render();
          }
          break;
      }
    });

    // Resize
    window.addEventListener("resize", () => {
      if (this.isOpen()) this.resizeCanvas();
    });

    // Propriétés
    const propX = document.getElementById("worldmap-prop-x");
    const propZ = document.getElementById("worldmap-prop-z");

    if (propX) {
      propX.step = "0.01";
      propX.addEventListener("input", (e) => {
        if (this.selectedZone) {
          this.selectedZone.worldX = parseFloat(e.target.value) || 0;
          this.render();
        }
      });
    }

    if (propZ) {
      propZ.step = "0.01";
      propZ.addEventListener("input", (e) => {
        if (this.selectedZone) {
          this.selectedZone.worldZ = parseFloat(e.target.value) || 0;
          this.render();
        }
      });
    }
  }

  async regenerateAllThumbnails() {
    this.sceneThumbnails.clear();
    for (const zone of this.placedZones) {
      const sceneInfo = this.availableScenes.find((s) => s.name === zone.scene);
      if (sceneInfo) {
        await this.generateHighResThumbnail(zone.scene, sceneInfo);
      }
    }
  }

  moveZoneUp() {
    const idx = this.placedZones.indexOf(this.selectedZone);
    if (idx < this.placedZones.length - 1) {
      this.placedZones.splice(idx, 1);
      this.placedZones.splice(idx + 1, 0, this.selectedZone);
      this.render();
    }
  }

  moveZoneDown() {
    const idx = this.placedZones.indexOf(this.selectedZone);
    if (idx > 0) {
      this.placedZones.splice(idx, 1);
      this.placedZones.splice(idx - 1, 0, this.selectedZone);
      this.render();
    }
  }

  async loadAvailableScenes() {
    try {
      const res = await fetch("/list-scenes");
      const data = await res.json();
      this.availableScenes = [];

      for (const sceneName of data.scenes || []) {
        try {
          const sceneRes = await fetch(
            `/load-scene/${sceneName}`
          );
          const sceneData = await sceneRes.json();
          if (sceneData) {
            this.availableScenes.push({
              name: sceneName,
              data: sceneData,
              width: sceneData.groundWidth || 100,
              height: sceneData.groundHeight || 100,
              isPrefab: sceneData.isPrefabScene || false,
              prefabModel: sceneData.prefabModel || null,
              groundColor: sceneData.groundColor || "#108d07",
              objects: sceneData.objects || [],
              portals: sceneData.portals || [],
            });
          }
        } catch (err) {
          console.warn(`Impossible de charger ${sceneName}:`, err);
        }
      }

      console.log("🗺️ Scènes:", this.availableScenes.length);
    } catch (err) {
      console.error("Erreur chargement scènes:", err);
    }
  }

  open() {
    this.overlay.classList.add("visible");
    this.resizeCanvas();
    this.renderScenesList();

    this.viewOffset = {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
    };

    this.load();
    this.render();
  }

  close() {
    this.overlay.classList.remove("visible");
  }

  isOpen() {
    return this.overlay.classList.contains("visible");
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    this.render();
  }

  renderScenesList() {
    const list = document.getElementById("worldmap-scenes-list");
    list.innerHTML = "";

    for (const scene of this.availableScenes) {
      const isPlaced = this.placedZones.some((z) => z.scene === scene.name);
      const isLoading = this.loadingScenes.has(scene.name);

      const item = document.createElement("div");
      item.className = `worldmap-scene-item ${isPlaced ? "placed" : ""} ${
        isLoading ? "loading" : ""
      }`;
      item.dataset.scene = scene.name;
      item.draggable = !isPlaced;

      const objectCount = scene.objects?.length || 0;

      item.innerHTML = `
        <div class="worldmap-scene-icon">${scene.isPrefab ? "🏠" : "🌳"}</div>
        <div class="worldmap-scene-info">
          <div class="worldmap-scene-name">${scene.name}</div>
          <div class="worldmap-scene-size">${scene.width}×${
        scene.height
      } | ${objectCount} obj</div>
        </div>
        ${isLoading ? '<div class="worldmap-scene-loading">⏳</div>' : ""}
      `;

      item.addEventListener("dragstart", (e) => {
        if (!isPlaced) e.dataTransfer.setData("scene", scene.name);
      });

      item.addEventListener("dblclick", () => {
        if (!isPlaced) this.addZone(scene.name, 0, 0);
      });

      item.addEventListener("click", () => {
        if (isPlaced) {
          const zone = this.placedZones.find((z) => z.scene === scene.name);
          if (zone) {
            this.selectedZone = zone;
            this.updatePropertiesPanel();
            this.render();
            this.centerOnZone(zone);
          }
        }
      });

      list.appendChild(item);
    }
  }

  centerOnZone(zone) {
    this.viewOffset = {
      x: this.canvas.width / 2 - zone.worldX * this.zoom,
      y: this.canvas.height / 2 - zone.worldZ * this.zoom,
    };
    this.render();
  }

  async addZone(sceneName, worldX, worldZ) {
    const sceneInfo = this.availableScenes.find((s) => s.name === sceneName);
    if (!sceneInfo) return;

    if (this.placedZones.some((z) => z.scene === sceneName)) {
      console.warn(`${sceneName} déjà placée`);
      return;
    }

    const zone = {
      scene: sceneName,
      worldX: worldX,
      worldZ: worldZ,
      width: sceneInfo.width,
      height: sceneInfo.height,
      rotation: 0, // Rotation en degrés
      isPrefab: sceneInfo.isPrefab,
      prefabModel: sceneInfo.prefabModel,
      groundColor: sceneInfo.groundColor,
    };

    this.placedZones.push(zone);
    this.selectedZone = zone;
    this.renderScenesList();
    this.updatePropertiesPanel();
    this.render();

    document.getElementById("worldmap-hint").style.display = "none";

    await this.generateHighResThumbnail(sceneName, sceneInfo);

    console.log(`🗺️ Zone: ${sceneName} à (${worldX}, ${worldZ})`);
  }

  async loadModel(path) {
    if (this.modelCache.has(path)) {
      return this.modelCache.get(path).clone();
    }

    try {
      const gltf = await new Promise((resolve, reject) => {
        this.gltfLoader.load(path, resolve, undefined, reject);
      });
      this.modelCache.set(path, gltf.scene);
      return gltf.scene.clone();
    } catch (err) {
      return null;
    }
  }

  async generateHighResThumbnail(sceneName, sceneInfo) {
    if (this.sceneThumbnails.has(sceneName)) return;

    this.loadingScenes.add(sceneName);
    this.renderScenesList();

    try {
      const scene = new THREE.Scene();

      // Lumières
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
      dirLight.position.set(50, 100, 50);
      scene.add(dirLight);
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));

      // Container pour tous les objets (pour calculer le bounding box)
      const objectsContainer = new THREE.Group();
      scene.add(objectsContainer);

      const sceneWidth = sceneInfo.width;
      const sceneHeight = sceneInfo.height;

      // Sol seulement si showGround
      if (this.showGround) {
        const groundGeom = new THREE.PlaneGeometry(sceneWidth, sceneHeight);
        const groundMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color(sceneInfo.groundColor || "#108d07"),
        });
        const ground = new THREE.Mesh(groundGeom, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        objectsContainer.add(ground);
      }

      // Charger les objets
      if (sceneInfo.isPrefab && sceneInfo.prefabModel) {
        const model = await this.loadModel(sceneInfo.prefabModel);
        if (model) {
          const scale = sceneInfo.data.prefabScale || 1;
          model.scale.set(scale, scale, scale);
          objectsContainer.add(model);
        }
      } else if (sceneInfo.objects && sceneInfo.objects.length > 0) {
        const objectsByPath = new Map();
        for (const obj of sceneInfo.objects) {
          if (!objectsByPath.has(obj.path)) {
            objectsByPath.set(obj.path, []);
          }
          objectsByPath.get(obj.path).push(obj);
        }

        const loadPromises = [];
        const objectsToAdd = [];

        for (const [path, objects] of objectsByPath) {
          loadPromises.push(
            this.loadModel(path).then((baseModel) => {
              if (baseModel) {
                for (const obj of objects) {
                  const model = baseModel.clone();
                  model.position.set(
                    obj.position.x,
                    obj.position.y,
                    obj.position.z
                  );
                  model.rotation.set(
                    THREE.MathUtils.degToRad(obj.rotation?.x || 0),
                    THREE.MathUtils.degToRad(obj.rotation?.y || 0),
                    THREE.MathUtils.degToRad(obj.rotation?.z || 0)
                  );
                  model.scale.set(
                    obj.scale?.x || 1,
                    obj.scale?.y || 1,
                    obj.scale?.z || 1
                  );
                  objectsToAdd.push(model);
                }
              }
            })
          );
        }

        await Promise.all(loadPromises);
        objectsToAdd.forEach((m) => objectsContainer.add(m));
      }

      // Portails
      if (sceneInfo.portals) {
        for (const portal of sceneInfo.portals) {
          const portalGeom = new THREE.CylinderGeometry(1, 1, 0.5, 16);
          const portalMat = new THREE.MeshBasicMaterial({
            color: portal.color || 0x6366f1,
          });
          const portalMesh = new THREE.Mesh(portalGeom, portalMat);
          portalMesh.position.set(portal.position.x, 0.25, portal.position.z);
          objectsContainer.add(portalMesh);
        }
      }

      // === CALCULER LE BOUNDING BOX RÉEL ===
      const boundingBox = new THREE.Box3().setFromObject(objectsContainer);

      // Si pas d'objets, utiliser la taille de la scène
      let minX, maxX, minZ, maxZ;

      if (boundingBox.isEmpty()) {
        minX = -sceneWidth / 2;
        maxX = sceneWidth / 2;
        minZ = -sceneHeight / 2;
        maxZ = sceneHeight / 2;
      } else {
        // Prendre le max entre le bounding box et la taille de la scène
        minX = Math.min(boundingBox.min.x, -sceneWidth / 2);
        maxX = Math.max(boundingBox.max.x, sceneWidth / 2);
        minZ = Math.min(boundingBox.min.z, -sceneHeight / 2);
        maxZ = Math.max(boundingBox.max.z, sceneHeight / 2);
      }

      // Ajouter une marge
      const margin = 2;
      minX -= margin;
      maxX += margin;
      minZ -= margin;
      maxZ += margin;

      const realWidth = maxX - minX;
      const realHeight = maxZ - minZ;
      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;

      // Stocker les vraies dimensions et l'offset
      const offsetX = centerX;
      const offsetZ = centerZ;

      // Taille du thumbnail basée sur les vraies dimensions
      let thumbWidth = Math.ceil(realWidth * this.pixelsPerUnit);
      let thumbHeight = Math.ceil(realHeight * this.pixelsPerUnit);

      if (
        thumbWidth > this.maxThumbnailSize ||
        thumbHeight > this.maxThumbnailSize
      ) {
        const scale = this.maxThumbnailSize / Math.max(thumbWidth, thumbHeight);
        thumbWidth = Math.ceil(thumbWidth * scale);
        thumbHeight = Math.ceil(thumbHeight * scale);
      }

      // Minimum size
      thumbWidth = Math.max(thumbWidth, 64);
      thumbHeight = Math.max(thumbHeight, 64);

      this.thumbnailRenderer.setSize(thumbWidth, thumbHeight);

      // Caméra centrée sur le bounding box réel
      this.thumbnailCamera.left = -realWidth / 2;
      this.thumbnailCamera.right = realWidth / 2;
      this.thumbnailCamera.top = realHeight / 2;
      this.thumbnailCamera.bottom = -realHeight / 2;
      this.thumbnailCamera.position.set(centerX, 200, centerZ);
      this.thumbnailCamera.lookAt(centerX, 0, centerZ);
      this.thumbnailCamera.updateProjectionMatrix();

      // Clear et render
      this.thumbnailRenderer.setClearColor(0x000000, 0);
      this.thumbnailRenderer.clear();
      this.thumbnailRenderer.render(scene, this.thumbnailCamera);

      const dataUrl = this.thumbnailRenderer.domElement.toDataURL("image/png");
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => (img.onload = resolve));

      // Sauvegarder avec les infos de dimensions réelles et offset
      this.sceneThumbnails.set(sceneName, {
        image: img,
        width: thumbWidth,
        height: thumbHeight,
        // Dimensions réelles capturées
        realWidth: realWidth,
        realHeight: realHeight,
        // Offset du centre par rapport à l'origine de la scène
        offsetX: offsetX,
        offsetZ: offsetZ,
        // Dimensions originales de la scène
        sceneWidth: sceneWidth,
        sceneHeight: sceneHeight,
      });

      console.log(
        `📸 ${sceneName}: ${thumbWidth}x${thumbHeight}px | Real: ${realWidth.toFixed(
          1
        )}x${realHeight.toFixed(1)} | Offset: (${offsetX.toFixed(
          1
        )}, ${offsetZ.toFixed(1)})`
      );

      // Cleanup
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    } catch (err) {
      console.error(`Erreur thumbnail ${sceneName}:`, err);
    } finally {
      this.loadingScenes.delete(sceneName);
      this.renderScenesList();
      this.render();
    }
  }

  removeSelectedZone() {
    if (!this.selectedZone) return;

    const index = this.placedZones.indexOf(this.selectedZone);
    if (index > -1) {
      this.placedZones.splice(index, 1);
      this.selectedZone = null;
      this.renderScenesList();
      this.updatePropertiesPanel();
      this.render();

      if (this.placedZones.length === 0) {
        document.getElementById("worldmap-hint").style.display = "block";
      }
    }
  }

  updatePropertiesPanel() {
    const panel = document.getElementById("worldmap-properties");

    if (this.selectedZone) {
      panel.style.display = "block";
      document.getElementById("worldmap-prop-name").value =
        this.selectedZone.scene;
      document.getElementById("worldmap-prop-x").value =
        this.selectedZone.worldX.toFixed(2);
      document.getElementById("worldmap-prop-z").value =
        this.selectedZone.worldZ.toFixed(2);
      document.getElementById("worldmap-prop-size").value = `${
        this.selectedZone.width
      }×${this.selectedZone.height} | Rot: ${this.selectedZone.rotation || 0}°`;
    } else {
      panel.style.display = "none";
    }
  }

  // === INTERACTION ===

  onMouseDown(e) {
    const pos = this.getCanvasPos(e);
    const worldPos = this.canvasToWorld(pos.x, pos.y);

    if (e.button === 0) {
      // Vérifier si on clique sur le pivot de rotation
      if (this.selectedZone && this.showPivots) {
        const pivotPos = this.getRotationPivotScreenPos(this.selectedZone);
        const dist = Math.hypot(pos.x - pivotPos.x, pos.y - pivotPos.y);
        if (dist < 15) {
          this.isRotating = true;
          this.dragStart = { x: e.clientX, y: e.clientY };
          return;
        }
      }

      const clickedZone = this.getZoneAtPosition(worldPos.x, worldPos.z);

      if (clickedZone) {
        this.selectedZone = clickedZone;
        this.draggedZone = clickedZone;
        this.isDragging = true;
        this.dragOffset = {
          x: worldPos.x - clickedZone.worldX,
          y: worldPos.z - clickedZone.worldZ,
        };
        this.updatePropertiesPanel();
        this.renderScenesList();
        this.render();
      } else {
        this.selectedZone = null;
        this.updatePropertiesPanel();
        this.renderScenesList();
        this.render();
      }
    } else if (e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
    }
  }

  onMouseMove(e) {
    const pos = this.getCanvasPos(e);
    const worldPos = this.canvasToWorld(pos.x, pos.y);

    // Curseur sur pivot?
    if (
      this.selectedZone &&
      this.showPivots &&
      !this.isDragging &&
      !this.isPanning
    ) {
      const pivotPos = this.getRotationPivotScreenPos(this.selectedZone);
      const dist = Math.hypot(pos.x - pivotPos.x, pos.y - pivotPos.y);
      this.canvas.style.cursor = dist < 15 ? "grab" : "default";
    }

    // Info position
    const posInfo = document.getElementById("worldmap-position");
    if (posInfo) {
      posInfo.innerHTML = `
        <strong>X: ${worldPos.x.toFixed(2)}, Z: ${worldPos.z.toFixed(
        2
      )}</strong> |
        Opacity: ${Math.round(this.zoneOpacity * 100)}% |
        Sol: ${this.showGround ? "ON" : "OFF"} (F) |
        Snap: ${this.snapToGrid ? "ON" : "OFF"} (G)
      `;
    }

    if (this.isRotating && this.selectedZone) {
      const dx = e.clientX - this.dragStart.x;
      // 1 pixel = 1 degré
      this.selectedZone.rotation =
        ((this.selectedZone.rotation || 0) + dx) % 360;
      if (this.selectedZone.rotation < 0) this.selectedZone.rotation += 360;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.updatePropertiesPanel();
      this.render();
      return;
    }

    if (this.isDragging && this.draggedZone) {
      let newX = worldPos.x - this.dragOffset.x;
      let newZ = worldPos.z - this.dragOffset.y;

      if (this.snapToGrid) {
        newX = Math.round(newX / this.gridSize) * this.gridSize;
        newZ = Math.round(newZ / this.gridSize) * this.gridSize;
      }

      this.draggedZone.worldX = newX;
      this.draggedZone.worldZ = newZ;
      this.updatePropertiesPanel();
      this.render();
    }

    if (this.isPanning) {
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      this.viewOffset.x += dx;
      this.viewOffset.y += dy;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.render();
    }
  }

  onMouseUp(e) {
    this.isDragging = false;
    this.isPanning = false;
    this.isRotating = false;
    this.draggedZone = null;
    this.canvas.style.cursor = "default";
  }

  onWheel(e) {
    e.preventDefault();

    const pos = this.getCanvasPos(e);
    const worldBefore = this.canvasToWorld(pos.x, pos.y);

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(
      this.minZoom,
      Math.min(this.maxZoom, this.zoom * zoomFactor)
    );

    const worldAfter = this.canvasToWorld(pos.x, pos.y);
    this.viewOffset.x += (worldAfter.x - worldBefore.x) * this.zoom;
    this.viewOffset.y += (worldAfter.z - worldBefore.z) * this.zoom;

    document.getElementById("worldmap-zoom").textContent = `${Math.round(
      this.zoom * 100
    )}%`;
    this.render();
  }

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  canvasToWorld(canvasX, canvasY) {
    return {
      x: (canvasX - this.viewOffset.x) / this.zoom,
      z: (canvasY - this.viewOffset.y) / this.zoom,
    };
  }

  worldToCanvas(worldX, worldZ) {
    return {
      x: worldX * this.zoom + this.viewOffset.x,
      y: worldZ * this.zoom + this.viewOffset.y,
    };
  }

  getRotationPivotScreenPos(zone) {
    // Pivot au-dessus de la zone
    const centerScreen = this.worldToCanvas(zone.worldX, zone.worldZ);
    const halfH = (zone.height / 2) * this.zoom;
    return {
      x: centerScreen.x,
      y: centerScreen.y - halfH - 25,
    };
  }

  getZoneAtPosition(worldX, worldZ) {
    for (let i = this.placedZones.length - 1; i >= 0; i--) {
      const zone = this.placedZones[i];

      // Prendre en compte la rotation
      const rot = THREE.MathUtils.degToRad(-(zone.rotation || 0));
      const dx = worldX - zone.worldX;
      const dz = worldZ - zone.worldZ;

      // Rotation inverse pour tester
      const localX = dx * Math.cos(rot) - dz * Math.sin(rot);
      const localZ = dx * Math.sin(rot) + dz * Math.cos(rot);

      const halfW = zone.width / 2;
      const halfH = zone.height / 2;

      if (
        localX >= -halfW &&
        localX <= halfW &&
        localZ >= -halfH &&
        localZ <= halfH
      ) {
        return zone;
      }
    }
    return null;
  }

  // === RENDU ===

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Fond damier pour montrer la transparence
    this.drawCheckerboard();

    if (this.showGrid) {
      this.drawGrid();
    }

    // Zones
    for (const zone of this.placedZones) {
      this.drawZone(zone, zone === this.selectedZone);
    }

    this.drawOrigin();
    this.drawHelp();
  }

  drawCheckerboard() {
    const ctx = this.ctx;
    const size = 20;
    const cols = Math.ceil(this.canvas.width / size);
    const rows = Math.ceil(this.canvas.height / size);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#1a1a2e" : "#252542";
        ctx.fillRect(x * size, y * size, size, size);
      }
    }
  }

  drawGrid() {
    const ctx = this.ctx;
    const gridWorldSize = this.gridSize;
    const gridScreenSize = gridWorldSize * this.zoom;

    if (gridScreenSize < 2) return;

    const startWorld = this.canvasToWorld(0, 0);
    const endWorld = this.canvasToWorld(this.canvas.width, this.canvas.height);

    // Grille fine
    if (gridScreenSize > 5) {
      ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
      ctx.lineWidth = 1;

      const startX = Math.floor(startWorld.x / gridWorldSize) * gridWorldSize;
      const endX = Math.ceil(endWorld.x / gridWorldSize) * gridWorldSize;
      const startZ = Math.floor(startWorld.z / gridWorldSize) * gridWorldSize;
      const endZ = Math.ceil(endWorld.z / gridWorldSize) * gridWorldSize;

      ctx.beginPath();
      for (let x = startX; x <= endX; x += gridWorldSize) {
        const screen = this.worldToCanvas(x, 0);
        ctx.moveTo(screen.x, 0);
        ctx.lineTo(screen.x, this.canvas.height);
      }
      for (let z = startZ; z <= endZ; z += gridWorldSize) {
        const screen = this.worldToCanvas(0, z);
        ctx.moveTo(0, screen.y);
        ctx.lineTo(this.canvas.width, screen.y);
      }
      ctx.stroke();
    }

    // Grille majeure
    const majorGrid = 10;
    const majorScreenSize = majorGrid * this.zoom;
    if (majorScreenSize > 15) {
      ctx.strokeStyle = "rgba(99, 102, 241, 0.5)";
      ctx.lineWidth = 1;

      const startX = Math.floor(startWorld.x / majorGrid) * majorGrid;
      const endX = Math.ceil(endWorld.x / majorGrid) * majorGrid;
      const startZ = Math.floor(startWorld.z / majorGrid) * majorGrid;
      const endZ = Math.ceil(endWorld.z / majorGrid) * majorGrid;

      ctx.beginPath();
      for (let x = startX; x <= endX; x += majorGrid) {
        const screen = this.worldToCanvas(x, 0);
        ctx.moveTo(screen.x, 0);
        ctx.lineTo(screen.x, this.canvas.height);
      }
      for (let z = startZ; z <= endZ; z += majorGrid) {
        const screen = this.worldToCanvas(0, z);
        ctx.moveTo(0, screen.y);
        ctx.lineTo(this.canvas.width, screen.y);
      }
      ctx.stroke();

      // Labels
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "10px Inter";
      ctx.textAlign = "center";
      for (let x = startX; x <= endX; x += majorGrid) {
        const screen = this.worldToCanvas(x, startWorld.z);
        ctx.fillText(x.toString(), screen.x, 12);
      }
      ctx.textAlign = "left";
      for (let z = startZ; z <= endZ; z += majorGrid) {
        const screen = this.worldToCanvas(startWorld.x, z);
        ctx.fillText(z.toString(), 5, screen.y + 4);
      }
    }
  }

  drawOrigin() {
    const ctx = this.ctx;
    const origin = this.worldToCanvas(0, 0);
    const size = 50;

    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + size * this.zoom, origin.y);
    ctx.stroke();

    ctx.strokeStyle = "#3b82f6";
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x, origin.y + size * this.zoom);
    ctx.stroke();

    ctx.font = "bold 14px Inter";
    ctx.fillStyle = "#ef4444";
    ctx.fillText("+X", origin.x + size * this.zoom + 5, origin.y + 5);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("+Z", origin.x + 5, origin.y + size * this.zoom + 15);

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHelp() {
    const ctx = this.ctx;
    const h = this.canvas.height;

    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(5, h - 70, 500, 65);

    ctx.fillStyle = "#ffffff";
    ctx.font = "11px Inter";
    ctx.textAlign = "left";
    ctx.fillText(
      "G=Snap | H=Grille | B=Bordures | P=Pivots | F=Sol ON/OFF | T=Transparence | [/]=Opacité",
      10,
      h - 52
    );
    ctx.fillText(
      "R/E=Rotation ±90° | Flèches=Move | Shift=×0.1 | Ctrl=×0.01 | PageUp/Down=Ordre",
      10,
      h - 36
    );
    ctx.fillText(
      "Clic pivot = rotation libre | Clic droit/molette = pan",
      10,
      h - 20
    );
  }

  drawZone(zone, isSelected) {
    const ctx = this.ctx;
    const centerScreen = this.worldToCanvas(zone.worldX, zone.worldZ);
    const rotation = THREE.MathUtils.degToRad(zone.rotation || 0);

    const thumbnail = this.sceneThumbnails.get(zone.scene);

    ctx.save();
    ctx.translate(centerScreen.x, centerScreen.y);
    ctx.rotate(rotation);
    ctx.globalAlpha = this.zoneOpacity;

    if (thumbnail) {
      // Utiliser les dimensions réelles du thumbnail
      const screenWidth = thumbnail.realWidth * this.zoom;
      const screenHeight = thumbnail.realHeight * this.zoom;

      // Offset pour centrer correctement (le thumbnail peut être décentré)
      const offsetX = thumbnail.offsetX * this.zoom;
      const offsetZ = thumbnail.offsetZ * this.zoom;

      ctx.drawImage(
        thumbnail.image,
        -screenWidth / 2 + offsetX,
        -screenHeight / 2 + offsetZ,
        screenWidth,
        screenHeight
      );

      ctx.globalAlpha = 1.0;

      // Bordure de la zone ORIGINALE (pas du thumbnail)
      const origWidth = zone.width * this.zoom;
      const origHeight = zone.height * this.zoom;

      if (this.showBorders || isSelected) {
        // Bordure du thumbnail (ce qui est vraiment visible)
        ctx.strokeStyle = "rgba(100, 100, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(
          -screenWidth / 2 + offsetX,
          -screenHeight / 2 + offsetZ,
          screenWidth,
          screenHeight
        );
        ctx.setLineDash([]);

        // Bordure de la scène originale
        ctx.strokeStyle = isSelected ? "#f59e0b" : "rgba(255,255,255,0.5)";
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.strokeRect(-origWidth / 2, -origHeight / 2, origWidth, origHeight);
      }
    } else {
      // Pas encore de thumbnail
      const screenWidth = zone.width * this.zoom;
      const screenHeight = zone.height * this.zoom;

      if (this.showGround) {
        ctx.fillStyle = zone.groundColor || "#108d07";
        ctx.fillRect(
          -screenWidth / 2,
          -screenHeight / 2,
          screenWidth,
          screenHeight
        );
      }

      if (this.loadingScenes.has(zone.scene)) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(
          -screenWidth / 2,
          -screenHeight / 2,
          screenWidth,
          screenHeight
        );
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px Inter";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⏳ Chargement...", 0, 0);
      }

      ctx.globalAlpha = 1.0;

      if (this.showBorders || isSelected) {
        ctx.strokeStyle = isSelected ? "#f59e0b" : "rgba(255,255,255,0.4)";
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.strokeRect(
          -screenWidth / 2,
          -screenHeight / 2,
          screenWidth,
          screenHeight
        );
      }
    }

    // Nom
    const screenWidth = zone.width * this.zoom;
    const screenHeight = zone.height * this.zoom;

    if (screenWidth > 50) {
      ctx.rotate(-rotation);
      const name = zone.scene;
      ctx.font = "bold 12px Inter";
      const textWidth = ctx.measureText(name).width;

      ctx.fillStyle = isSelected
        ? "rgba(245, 158, 11, 0.9)"
        : "rgba(0,0,0,0.85)";
      ctx.fillRect(
        -textWidth / 2 - 5,
        -screenHeight / 2 - 20,
        textWidth + 10,
        18
      );

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, 0, -screenHeight / 2 - 11);

      if (zone.rotation) {
        ctx.font = "10px Inter";
        ctx.fillStyle = "#ffff00";
        ctx.fillText(`${zone.rotation}°`, 0, -screenHeight / 2 - 32);
      }
    }

    ctx.restore();

    // Pivot de rotation
    if (isSelected && this.showPivots) {
      const pivotPos = this.getRotationPivotScreenPos(zone);

      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(
        centerScreen.x,
        centerScreen.y - (zone.height / 2) * this.zoom
      );
      ctx.lineTo(pivotPos.x, pivotPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(pivotPos.x, pivotPos.y, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pivotPos.x, pivotPos.y, 6, 0, Math.PI * 1.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pivotPos.x + 6, pivotPos.y - 3);
      ctx.lineTo(pivotPos.x + 6, pivotPos.y + 3);
      ctx.lineTo(pivotPos.x + 2, pivotPos.y);
      ctx.closePath();
      ctx.fillStyle = "#000";
      ctx.fill();

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // === SAVE / LOAD ===

  async save() {
    const worldMapData = {
      version: 3,
      zones: this.placedZones.map((z) => ({
        scene: z.scene,
        worldX: z.worldX,
        worldZ: z.worldZ,
        rotation: z.rotation || 0,
      })),
    };

    try {
      const res = await fetch("/save-worldmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(worldMapData),
      });

      const data = await res.json();
      if (data.success) {
        alert("🗺️ World Map sauvegardée !");
      } else {
        alert("Erreur sauvegarde");
      }
    } catch (err) {
      console.error("Erreur:", err);
      alert("Erreur sauvegarde");
    }
  }

  async load() {
    try {
      const res = await fetch("/load-worldmap");
      const data = await res.json();

      if (data && data.zones) {
        this.placedZones = [];

        for (const zoneData of data.zones) {
          const sceneInfo = this.availableScenes.find(
            (s) => s.name === zoneData.scene
          );
          if (sceneInfo) {
            const zone = {
              scene: zoneData.scene,
              worldX: zoneData.worldX,
              worldZ: zoneData.worldZ,
              rotation: zoneData.rotation || 0,
              width: sceneInfo.width,
              height: sceneInfo.height,
              isPrefab: sceneInfo.isPrefab,
              prefabModel: sceneInfo.prefabModel,
              groundColor: sceneInfo.groundColor,
            };
            this.placedZones.push(zone);
            this.generateHighResThumbnail(zoneData.scene, sceneInfo);
          }
        }

        if (this.placedZones.length > 0) {
          document.getElementById("worldmap-hint").style.display = "none";
        }

        this.renderScenesList();
        this.render();
      }
    } catch (err) {
      console.log("Pas de worldmap");
    }
  }
}
