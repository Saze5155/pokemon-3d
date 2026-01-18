  import * as THREE from "three";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { VRWatchMenu } from "../ui/VRWatchMenu.js";

  /**
   * VRManager - Gère l'intégration WebXR
   * Basé sur le Cahier des Charges - Phase 1 & 2
   */
  export class VRManager {
    constructor(game) {
      this.game = game;
      this.renderer = game.renderer;
      this.scene = game.sceneManager.getActiveScene(); // Scène active
      this.camera = game.camera;

      // État VR
      this.enabled = false;
      this.session = null;

      // Contrôleurs
      this.controllers = {
        left: null,
        right: null
      };
      this.controllerGrips = {
        left: null,
        right: null
      };

      // Locomotion
      this.moveVector = new THREE.Vector3();
      this.snapTurnDelay = 0;
      
      // Factory pour les modèles de manettes
      this.controllerModelFactory = new XRControllerModelFactory();
      
      // UI Montre
      this.watchMenu = new VRWatchMenu(game);
      
      // Laser Pointer
      this.raycaster = new THREE.Raycaster();
      this.tempMatrix = new THREE.Matrix4();
      this.laserLine = null;

      // Group pour le joueur (Camera + Mains)
      
      // Group pour le joueur (Camera + Mains)
      // En WebXR, la caméra est déplacée par le headset, donc on déplace un "PlayerRig" parent
      this.playerRig = new THREE.Group();
      // Position initiale
      this.playerRig.position.copy(this.camera.position);
      this.playerRig.rotation.y = 0;
      
      // Ajouter le rig à la scène
      // Note: Cela sera fait dans init()
      
      // écouter les changements de scène pour déplacer le Rig
      // On utilise une méthode interne pour s'assurer qu'on ne se fait pas écraser
      this.game.sceneManager.addSceneChangeListener((newSceneName) => {
          this.onSceneChanged(newSceneName);
      });
    }

    onSceneChanged(newSceneName) {
        console.log(`🔍 VRManager: onSceneChanged called for ${newSceneName}. Enabled? ${this.enabled}`);
        if (!this.enabled) return;

        console.log(`🔄 VRManager: Déplacement du Rig vers ${newSceneName}`);
        console.log(`📍 VRManager: Position AVANT changement: (${this.playerRig.position.x.toFixed(2)}, ${this.playerRig.position.y.toFixed(2)}, ${this.playerRig.position.z.toFixed(2)})`);
        console.log(`📍 VRManager: Enfants du rig: ${this.playerRig.children.length} (controllers + camera)`);

        // Retirer de l'ancienne scène (le parent actuel)
        if (this.playerRig.parent) {
            this.playerRig.parent.remove(this.playerRig);
        }

        // Liste des zones WorldMap
        const worldMapZones = ["bourg-palette", "route1", "argenta", "route2", "jadeto2", "foret-jade", "jadielle", "route2nord", "world"];

        // Ajouter à la nouvelle scène
        let targetScene = null;

        if (worldMapZones.includes(newSceneName)) {
            // C'est une zone WorldMap - utiliser la worldScene
            targetScene = this.game.worldManager?.worldScene;
            console.log(`🗺️ VRManager: ${newSceneName} est une zone WorldMap, utilisation de worldScene`);
        } else {
            // Scène intérieure - chercher dans les scènes enregistrées
            targetScene = this.game.sceneManager.scenes.get(newSceneName);
            console.log(`🏠 VRManager: ${newSceneName} est un intérieur`);
        }

        if (targetScene) {
            targetScene.add(this.playerRig);
            console.log(`✅ VRManager: Rig ajouté à la scène ${newSceneName}`);
        } else {
            // Fallback: essayer la scène active du sceneManager
            const activeScene = this.game.sceneManager.getActiveScene();
            if (activeScene) {
                activeScene.add(this.playerRig);
                console.log(`✅ VRManager: Rig ajouté à la scène active (fallback)`);
            } else {
                console.warn(`⚠️ VRManager: Scène ${newSceneName} introuvable pour le Rig`);
            }
        }

        // S'assurer que la caméra est bien dans le rig (peut avoir été détachée)
        if (this.camera.parent !== this.playerRig) {
            console.log(`⚠️ VRManager: Caméra détachée, réattachement au rig`);
            this.playerRig.add(this.camera);
        }
        
        // Réattacher explicitement les contrôleurs et grips
        if (this.controllersArr) {
            this.controllersArr.forEach((c, i) => {
                if (c) {
                    // Toujours réattacher pour être sûr
                    this.playerRig.add(c);
                    console.log(`🔧 VRManager: Controller ${i} réattaché au Rig`);
                }
            });
        }
        if (this.gripsArr) {
            this.gripsArr.forEach((g, i) => {
                if (g) {
                    this.playerRig.add(g);
                    console.log(`🔧 VRManager: Grip ${i} réattaché au Rig`);
                }
            });
        }
        
        // S'assurer que le Raycaster (laser) est toujours sur le controller droit
        if (this.controllers.right && this.laserLine && !this.laserLine.parent) {
             this.controllers.right.add(this.laserLine);
        }

        // Réattacher la montre si nécessaire (si elle a été orpheline)
        if (this.watchMenu && this.watchMenu.container) {
             if (!this.watchMenu.container.parent && this.controllers.left) {
                 // Retrouver le grip gauche
                 const index = this.controllersArr.indexOf(this.controllers.left);
                 if (index >= 0 && this.gripsArr[index]) {
                     this.gripsArr[index].add(this.watchMenu.container);
                     console.log("⌚ Montre réattachée après changement de scène");
                 }
             }
        }

        // Vérifier que les contrôleurs sont toujours dans le rig

        // Vérifier que les contrôleurs sont toujours dans le rig
        console.log(`📍 VRManager: Enfants du rig APRÈS changement: ${this.playerRig.children.length}`);
        this.playerRig.children.forEach((child, i) => {
            console.log(`   [${i}] ${child.type} - ${child.name || 'unnamed'}`);
        });

        // Forcer une mise à jour de la matrice monde après changement de parent
        this.playerRig.updateMatrixWorld(true);

        console.log(`📍 VRManager: Position du Rig après changement de scène: (${this.playerRig.position.x.toFixed(2)}, ${this.playerRig.position.y.toFixed(2)}, ${this.playerRig.position.z.toFixed(2)})`);
    }

    /**
     * Synchronise la position du playerRig avec la caméra
     * En VR, la caméra est relative au rig, donc on déplace le rig pour que
     * la position absolue de la caméra corresponde à la position souhaitée
     */
    syncRigToCamera() {
        if (!this.enabled) return;

        // La caméra desktop a été positionnée, on doit mettre le Rig au même endroit
        // En VR, la caméra (headset) est relative au Rig
        // Donc on copie la position de la caméra dans le Rig, et on ajuste pour la hauteur
        const cameraWorldPos = new THREE.Vector3();
        this.camera.getWorldPosition(cameraWorldPos);

        console.log(`🎯 VRManager: Syncing Rig to camera at (${cameraWorldPos.x.toFixed(2)}, ${cameraWorldPos.y.toFixed(2)}, ${cameraWorldPos.z.toFixed(2)})`);

        // Le Rig doit être au sol (position Y = hauteur du sol)
        // La caméra est à 1.6m au-dessus du Rig
        this.playerRig.position.set(cameraWorldPos.x, cameraWorldPos.y - 1.6, cameraWorldPos.z);

        // Forcer une mise à jour de la matrice monde
        this.playerRig.updateMatrixWorld(true);

        console.log(`✅ VRManager: Rig repositionné à (${this.playerRig.position.x.toFixed(2)}, ${this.playerRig.position.y.toFixed(2)}, ${this.playerRig.position.z.toFixed(2)})`);
    }

    async init() {
      if (!navigator.xr) {
        console.warn("WebXR non supporté sur ce navigateur");
        return;
      }

      const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
      if (isSupported) {
        console.log("✅ WebXR Immersive VR est supporté");
        this.setupVR();
      } else {
        console.warn("❌ WebXR Immersive VR non supporté");
      }
    }

    setupVR() {
      // Activer XR sur le renderer
      this.renderer.xr.enabled = true;
      
      // Créer les contrôleurs
      this.setupControllers();

      // Événements de session
      this.renderer.xr.addEventListener('sessionstart', () => this.onSessionStart());
      this.renderer.xr.addEventListener('sessionend', () => this.onSessionEnd());
      
      // Setup Laser Visual
      this.createLaserPointer();
    }

    createLaserPointer() {
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -5)
        ]);
        const material = new THREE.LineBasicMaterial({ color: 0x00d2ff });
        this.laserLine = new THREE.Line(geometry, material);
        this.laserLine.name = 'laserPointer';
        this.laserLine.scale.z = 1; // Longueur par défaut
    
    }

    setupControllers() {
      this.controllerModelFactory = new XRControllerModelFactory();

      // 1. Ray Space (Pointage)
      const controller1 = this.renderer.xr.getController(0);
      this.setupRayController(controller1);
      this.playerRig.add(controller1);

      const controller2 = this.renderer.xr.getController(1);
      this.setupRayController(controller2);
      this.playerRig.add(controller2);

      // 2. Grip Space (Modèle physique / Main)
      const controllerGrip1 = this.renderer.xr.getControllerGrip(0);
      controllerGrip1.add(this.controllerModelFactory.createControllerModel(controllerGrip1));
      this.playerRig.add(controllerGrip1);

      const controllerGrip2 = this.renderer.xr.getControllerGrip(1);
      controllerGrip2.add(this.controllerModelFactory.createControllerModel(controllerGrip2));
      this.playerRig.add(controllerGrip2);

      this.controllersArr = [controller1, controller2];
      this.gripsArr = [controllerGrip1, controllerGrip2];
      
      // Note: On attachera la montre une fois qu'on saura quelle main est gauche/droite
    }

    setupRayController(controller) {
        controller.addEventListener('selectstart', () => this.onSelectStart(controller));
        controller.addEventListener('selectend', () => this.onSelectEnd(controller));
        controller.addEventListener('connected', (e) => this.onControllerConnected(e, controller));
        controller.addEventListener('disconnected', (e) => this.onControllerDisconnected(e, controller));
    }
    

    onControllerConnected(event, controller) {
      const handedness = event.data.handedness; // 'left' ou 'right'
      console.log(`🎮 Contrôleur connecté: ${handedness}`);
      
      if (handedness === 'left') {
        this.controllers.left = controller;
        controller.userData.handedness = 'left';
        controller.userData.gamepad = event.data.gamepad;
      } else if (handedness === 'right') {
        this.controllers.right = controller;
        controller.userData.handedness = 'right';
        controller.userData.gamepad = event.data.gamepad;
        
        // Ajouter le Laser à la main DROITE
        if (this.laserLine) controller.add(this.laserLine.clone());
        
      } else if (handedness === 'left') { // FIX: Inversion potentielle logic
        // Left logic
        this.controllers.left = controller;
        controller.userData.handedness = 'left';
        controller.userData.gamepad = event.data.gamepad;

        // Initialiser la Montre sur la main GAUCHE
        // On attend un peu que le modèle soit chargé ou on l'ajoute direct au grip ?
        // Ajout au grip (modèle physique) est mieux pour le suivi
        // Mais attention, this.controllerGrips.left est le bon endroit
      }
    }

    // APPELÉ DEPUIS SETUPCONTROLLERS POUR LES GRIPS
    setupGrips() {
        // Cette méthode n'existait pas vraiment, j'ai tout mis dans setupControllers
        // Je vais modifier setupControllers pour injecter la montre
    }
    
    onControllerDisconnected(event, controller) {
      console.log(`🔌 Contrôleur déconnecté`);
      if (controller === this.controllers.left) this.controllers.left = null;
      if (controller === this.controllers.right) this.controllers.right = null;
    }

    onSelectStart(controller) {
      controller.userData.isSelecting = true;
      console.log(`Select START (${controller.userData.handedness})`);
      
      // Interaction basique (équivalent touche E)
      // TODO: Phase 5 - Interactions plus complexes
      if (controller.userData.handedness === 'right') {
          this.game.inputManager.triggerInteraction();
          
          // Interaction UI Montre
          if (this.watchMenu && this.watchMenu.isVisible) {
              this.watchMenu.click();
          }
      }
    }

    onSelectEnd(controller) {
      controller.userData.isSelecting = false;
    }

    onSessionStart() {
      console.log("🕶️ Session VR Démarrée");
      this.enabled = true;
      this.session = this.renderer.xr.getSession();

      this.game.useVR = true;

      // Ajouter le Rig à la scène active
      if (this.game.sceneManager.activeSceneName === 'world') {
          this.game.worldManager.worldScene.add(this.playerRig);
      } else {
          const scene = this.game.sceneManager.scenes.get(this.game.sceneManager.activeSceneName);
          if (scene) scene.add(this.playerRig);
      }

      // Synchroniser la position du Rig avec la caméra desktop
      this.playerRig.position.copy(this.camera.position);
      // La caméra desktop est à 1.6m du sol. Le Rig doit être au SOL.
      // Donc on baisse le Rig de 1.6m (ou on le met au niveau du sol détecté)
      this.playerRig.position.y = Math.max(0, this.camera.position.y - 1.6);

      this.playerRig.rotation.y = 0; // Reset rotation Y pour aligner avec la vue initiale

      // IMPORTANT: En Three.js WebXR, la caméra et les contrôleurs sont automatiquement
      // mis à jour par le système XR. Si on veut les déplacer dans le monde, on doit:
      // 1. Soit utiliser setReferenceSpaceOffset (complexe)
      // 2. Soit ajouter la caméra au playerRig (Three.js gère le reste)
      //
      // L'approche recommandée: ajouter la caméra au rig. Three.js appliquera
      // les transformations du rig aux positions XR automatiquement.
      this.playerRig.add(this.camera);

      console.log(`📍 VR Session: Rig position = (${this.playerRig.position.x.toFixed(2)}, ${this.playerRig.position.y.toFixed(2)}, ${this.playerRig.position.z.toFixed(2)})`);
      console.log(`📍 VR Session: Camera added to rig, controllers count = ${this.playerRig.children.length}`);
    }

    onSessionEnd() {
      console.log("⏹️ Session VR Terminée");
      this.enabled = false;
      this.game.useVR = false;
      
      // Détacher la caméra et le rig
      this.game.sceneManager.getActiveScene().remove(this.playerRig);
      this.game.sceneManager.getActiveScene().add(this.camera); // Remettre la cam à la racine
      
      // Réinitialiser la caméra desktop à une position safe (position du rig)
      this.camera.position.copy(this.playerRig.position);
      this.camera.position.y += 1.6; // Hauteur yeux desktop
    }

    update(delta) {
      if (!this.enabled) return;

      this.handleLocomotion(delta);
      
      // Gestion Montre (Apparition / Interaction)
      this.handleWatch(delta);
    }

    handleWatch(delta) {
        // 1. Initialisation tardive (une fois le controller 'left' identifié)
        if (this.controllers.left && !this.watchMenu.container.parent) {
            // On cherche le GRIP correspondant
            // C'est un peu tricky car controllers.left est le RaySpace.
            // Le GripSpace est souvent index 0 ou 1 correspondant.
            // Simplification: On attache au GripController (qui a le modèle 3D)
            // On doit trouver quel grip correspond à 'left'
            
            // Hack: On assume que si controllers.left est index 0, grip[0] est left.
            // WebXR standard tries to keep indices consistent.
            const index = this.controllersArr.indexOf(this.controllers.left);
            if (index >= 0 && this.gripsArr[index]) {
                this.watchMenu.init(this.gripsArr[index]);
                console.log("⌚ Montre attachée au contrôleur gauche !");
            }
        }

        // 2. Détection du geste "Regarder la montre"
        if (this.controllers.left && this.watchMenu.container.parent) {
            const watchContainer = this.watchMenu.container;
            
            // Vecteur normal de la montre (Screen Up)
            // Container local Y+ est la normale de l'écran (supposons)
            const n = new THREE.Vector3(0, 1, 0); 
            n.applyQuaternion(watchContainer.getWorldQuaternion(new THREE.Quaternion()));
            
            // Vecteur vers la caméra
            const toCam = new THREE.Vector3().subVectors(this.camera.position, watchContainer.getWorldPosition(new THREE.Vector3())).normalize();
            
            // Produit scalaire
            const dot = n.dot(toCam);
            
            // Avec la rotation Z presque à PI (180deg), la normale Y+ pointe probablement vers le bas/l'extérieur.
            // Donc quand on regarde l'écran, la normale pointe à l'opposé de la caméra.
            // Dot product doit être NÉGATIF.
            // On teste avec un seuil négatif.
            
            const isLooking = dot < -0.4;
            
            // DEBUG (à enlever plus tard)
            // if (Math.random() < 0.05) console.log(`⌚ Dot: ${dot.toFixed(2)}, Focused: ${isLooking}`);
            
            this.watchMenu.isVisible = true; // Toujours visible pour tester
            this.watchMenu.setFocus(isLooking);

            // Update Raycaster depuis la main DROITE
            if (this.controllers.right) {
                // Pos et Dir du controller droit
                this.tempMatrix.identity().extractRotation(this.controllers.right.matrixWorld);
                this.raycaster.ray.origin.setFromMatrixPosition(this.controllers.right.matrixWorld);
                this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
                
                // Mettre à jour l'UI de la montre
                this.watchMenu.update(this.raycaster);
            }
        }
    }

    handleLocomotion(delta) {
      const session = this.renderer.xr.getSession();
      if (!session) {
        console.log("❌ Pas de session XR");
        return;
      }

      let leftGamepad = null;
      let rightGamepad = null;
      for (const source of session.inputSources) {
        if (source.gamepad && source.handedness === 'left') {
          const axes = source.gamepad.axes;
          // Afficher les 4 axes avec leurs valeurs
          console.log(`🕹️ LEFT axes: [0]=${axes[0]?.toFixed(2)}, [1]=${axes[1]?.toFixed(2)}, [2]=${axes[2]?.toFixed(2)}, [3]=${axes[3]?.toFixed(2)}`);
        }
  }

      // Récupérer les gamepads FRAIS depuis la session
      for (const source of session.inputSources) {
        if (source.gamepad) {
          if (source.handedness === 'left') leftGamepad = source.gamepad;
          if (source.handedness === 'right') rightGamepad = source.gamepad;
        }
      }

      // 1. Déplacement (Joystick Gauche)
      if (leftGamepad && leftGamepad.axes.length >= 4) {
        const x = -leftGamepad.axes[2];
        const y = -leftGamepad.axes[3];

        // Deadzone
        if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {
          this.moveVector.set(x, 0, y);

          // Mouvement relatif à la direction du regard (HMD)
          const rotation = this.camera.getWorldDirection(new THREE.Vector3());
          const theta = Math.atan2(rotation.x, rotation.z);

          // Appliquer la rotation
          this.moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), theta);

          // Envoyer à l'InputManager
          this.game.inputManager.setVRInput(this.moveVector.x, this.moveVector.z);
        } else {
          this.game.inputManager.setVRInput(0, 0);
        }
      } else {
        this.game.inputManager.setVRInput(0, 0);
      }

      // 2. Rotation Snap (Joystick Droit)
      if (rightGamepad && rightGamepad.axes.length >= 4) {
        const x = rightGamepad.axes[2];

        // Gestion du délai pour éviter rotation continue trop rapide
        if (this.snapTurnDelay > 0) {
          this.snapTurnDelay -= delta;
        } else if (Math.abs(x) > 0.5) {
          const angle = 45 * (Math.PI / 180); // 45 degrés
          const direction = x > 0 ? -1 : 1;

          // Tourner le Rig
          this.playerRig.rotateY(angle * direction);

          // Délai avant prochain snap
          this.snapTurnDelay = 0.5;
        }
      }
    }
  }
