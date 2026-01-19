import * as THREE from 'three';
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { VRDialoguePanel } from '../ui/VRDialoguePanel.js';
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
      this.game.sceneManager.addSceneChangeListener((newSceneName) => {
          this.onSceneChanged(newSceneName);
      });

      // NOTE: Le panneau de dialogue et les hooks sont initialisés dans init() pour garantir que l'UI est prête.
      this.vrDialoguePanel = null;
      this.interactionRaycaster = new THREE.Raycaster();
      this.vrDialoguePanel = null;
      this.interactionRaycaster = new THREE.Raycaster();
      this.lastTriggerState = { left: false, right: false };
      this.lastBButtonState = false; // For B button toggle
      
      this.watchHand = 'left'; // Default
    }
    
    switchWatchHand(hand) {
        if (hand === this.watchHand || !['left', 'right'].includes(hand)) return;
        
        console.log(`[VRManager] Switching watch to ${hand} hand`);
        this.watchHand = hand;
        
        if (this.watchMenu && this.watchMenu.container) {
             // Detach
             if (this.watchMenu.container.parent) {
                 this.watchMenu.container.parent.remove(this.watchMenu.container);
             }
             
             // Attach to new hand grip
             const grip = this.controllerGrips[hand];
             if (grip) {
                 grip.add(this.watchMenu.container);
                 console.log(`[VRManager] Watch attached to ${hand} grip`);
             } else {
                 console.warn(`[VRManager] Cannot attach watch: ${hand} grip not found`);
             }
        }
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
            
            // Ajustement hauteur WorldMap
            this.playerRig.position.y += 20; // +20m offset
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
      
      // 2. Configurer les contrôleurs
      this.setupControllers();

      // 3. Initialiser la loop VR
      this.renderer.setAnimationLoop((time, frame) => {
          this.game.renderFrame(); // Appelle sceneManager.update, etc.
      });
      
      // 4. Initialiser le Dialogue Panel VR & Hook
      this.vrDialoguePanel = new VRDialoguePanel(this.game);
      
      console.log("✅ VRManager initialized");
      
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

      // Hook du système de dialogue (re-check à chaque session start pour être sûr)
      // Hook du système de dialogue (re-check à chaque session start pour être sûr)
      if (this.game.dialogueSystem && !this.game.dialogueSystem._isVRHooked) {
          const originalStart = this.game.dialogueSystem.start.bind(this.game.dialogueSystem);
          
          this.game.dialogueSystem.start = (npc, dialogues, key) => {
              // Vérifier si VR est actif
              if (this.renderer.xr.isPresenting) {
                  console.log("💬 VR Dialogue Triggered for " + npc.nom);
                  this.vrDialoguePanel.show(npc, dialogues, key);
              } else {
                  originalStart(npc, dialogues, key);
              }
          };
          this.game.dialogueSystem._isVRHooked = true;
          console.log("✅ VRManager: Dialogue System Hooked (onSessionStart)!");
      }

      // Hook pour les CHOIX (ModernDialogueSystem)
      // IMPORTANT: dialogueSystem et modernDialogue peuvent être la même instance ou différentes
      // On hook les deux pour être sûr
      const dialogueSystems = [
          { name: 'dialogueSystem', instance: this.game.dialogueSystem },
          { name: 'modernDialogue', instance: this.game.modernDialogue }
      ];

      dialogueSystems.forEach(({ name, instance }) => {
          if (instance && instance.showChoices && !instance._isVRChoicesHooked) {
              const originalShowChoices = instance.showChoices.bind(instance);
              
              instance.showChoices = (choices) => {
                 if (this.renderer.xr.isPresenting) {
                      console.log(`🤔 VR Choices Triggered (via ${name}):`, choices);
                      this.vrDialoguePanel.showChoices(choices);
                 } else {
                      originalShowChoices(choices);
                 }
              };
              instance._isVRChoicesHooked = true;
              console.log(`✅ VRManager: ${name}.showChoices Hooked!`);
          }
      });
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
      this.handleInputActions(delta); // B Button check
      
      // Gestion Montre (Apparition / Interaction)
      this.handleWatch(delta);
      
      // Gestion Hover Dialogue
      this.handleDialogueHover();
    }
    
    handleInputActions(delta) {
        const session = this.renderer.xr.getSession();
        if (!session) return;
        
        for (const source of session.inputSources) {
            // Right Hand B Button (Index 5 usually, check profile)
            if (source.handedness === 'right' && source.gamepad && source.gamepad.buttons.length > 5) {
                const bButton = source.gamepad.buttons[5]; // B Button
                if (bButton && bButton.pressed) {
                    if (!this.lastBButtonState) {
                        this.lastBButtonState = true;
                        // Action: Close Menu
                        if (this.watchMenu && this.watchMenu.currentPanel && this.watchMenu.currentPanel.isVisible) {
                            console.log("[VRManager] B Button pressed: Closing Menu");
                            this.watchMenu.currentPanel.hide();
                            this.watchMenu.currentPanel = null;
                        }
                    }
                } else {
                    this.lastBButtonState = false;
                }
            }
        }
    }
    
    handleDialogueHover() {
        if (!this.vrDialoguePanel || !this.vrDialoguePanel.isVisible || !this.vrDialoguePanel.isShowingChoices) return;
        
        if (this.controllers.right) {
            this.tempMatrix.identity().extractRotation(this.controllers.right.matrixWorld);
            this.raycaster.ray.origin.setFromMatrixPosition(this.controllers.right.matrixWorld);
            this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
            
            const intersects = this.raycaster.intersectObject(this.vrDialoguePanel.mesh);
            if (intersects.length > 0) {
                const uv = intersects[0].uv;
                this.vrDialoguePanel.updateHover(uv);
            } else {
                this.vrDialoguePanel.updateHover(null);
            }
        }
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

        // 2. Gestion des Interactions (Gachettes)
        this.handleInteraction(delta);

        // 3. Détection du geste "Regarder la montre"
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
            
            // Nouvelle inversion logique selon retour utilisateur
            // Si le zoom se déclenche quand on ne regarde pas (dot > 0.4), alors quand on regarde, le dot doit être inversé.
            
            const isLooking = dot < -0.4;
            
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
                
                // Mettre à jour le hover sur les panneaux de menu
                if (this.watchMenu && this.watchMenu.currentPanel && this.watchMenu.currentPanel.isVisible) {
                    const intersects = this.raycaster.intersectObject(this.watchMenu.currentPanel.mesh);
                    if (intersects.length > 0) {
                        this.watchMenu.currentPanel.updateHover(intersects[0].uv);
                    } else {
                        this.watchMenu.currentPanel.updateHover(null);
                    }
                }
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

    // === DEBUG MODE: AJUSTEMENT MONTRE ===
    // PAVÉ NUMÉRIQUE :
    // 4/6 = X (Gauche/Droite)
    // 8/2 = Y (Haut/Bas)
    // 7/9 = Z (Profondeur)
    // 1/3 = Rotation Z
    // 5 = Flip Screen
    bindDebugKeys() {
        document.addEventListener('keydown', (e) => {
            if (!this.watchMenu || !this.watchMenu.container) return;
            const c = this.watchMenu.container;
            const step = 0.005; // 5mm
            const rotStep = 0.1; // ~5 deg

            let updated = false;
            // Support Numpad and Digit keys
            switch(e.code) {
                case "Numpad4": case "Digit4": c.position.x -= step; updated=true; break;
                case "Numpad6": case "Digit6": c.position.x += step; updated=true; break;
                
                case "Numpad8": case "Digit8": c.position.y += step; updated=true; break;
                case "Numpad2": case "Digit2": c.position.y -= step; updated=true; break;
                
                case "Numpad9": case "Digit9": c.position.z -= step; updated=true; break; // Eloigner
                case "Numpad7": case "Digit7": c.position.z += step; updated=true; break; // Rapprocher
                
                case "Numpad3": case "Digit3": c.rotation.z += rotStep; updated=true; break;
                case "Numpad1": case "Digit1": c.rotation.z -= rotStep; updated=true; break;
                
                case "Numpad5": case "Digit5": 
                    if (this.watchMenu.menuMesh) this.watchMenu.menuMesh.rotation.z += Math.PI; 
                    console.log("⌚ Flip Screen");
                    break;
            }
            if (updated) {
                console.log(`⌚ WATCH CONFIG:\n Pos(${c.position.x.toFixed(3)}, ${c.position.y.toFixed(3)}, ${c.position.z.toFixed(3)}\n RotZ(${c.rotation.z.toFixed(2)})`);
            }
        });
    }

    handleInteraction(delta) {
        if (!this.session) return;
        
        const session = this.session;
        let leftGamepad = null, rightGamepad = null;
        
        for (const source of session.inputSources) {
            if (source.gamepad) {
                if (source.handedness === 'left') leftGamepad = source.gamepad;
                if (source.handedness === 'right') rightGamepad = source.gamepad;
            }
        }
        
        // Check Triggers (Button 0 usually)
        const leftPressed = leftGamepad && leftGamepad.buttons[0] && leftGamepad.buttons[0].pressed;
        const rightPressed = rightGamepad && rightGamepad.buttons[0] && rightGamepad.buttons[0].pressed;
        
        let interactingHand = null;
        
        // Détection front montant (Just Pressed)
        if (leftPressed && !this.lastTriggerState.left) interactingHand = this.controllers.left;
        if (rightPressed && !this.lastTriggerState.right) interactingHand = this.controllers.right;
        
        this.lastTriggerState.left = leftPressed;
        this.lastTriggerState.right = rightPressed;
        
        if (interactingHand) {
            console.log("🔫 VR Interaction Triggered!");
            
            // Vérifier si un panneau de menu est ouvert
            if (this.watchMenu && this.watchMenu.currentPanel && this.watchMenu.currentPanel.isVisible) {
                console.log(`[VR] Menu panel visible: ${this.watchMenu.currentPanel.constructor.name}`);
                
                this.tempMatrix.identity().extractRotation(interactingHand.matrixWorld);
                this.interactionRaycaster.ray.origin.setFromMatrixPosition(interactingHand.matrixWorld);
                this.interactionRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
                
                const intersects = this.interactionRaycaster.intersectObject(this.watchMenu.currentPanel.mesh);
                
                if (intersects.length > 0) {
                    const uv = intersects[0].uv;
                    const button = this.watchMenu.currentPanel.checkClick(uv);
                    
                    if (button) {
                        console.log(`[VR] Menu button clicked: ${button.label || 'unnamed'}`);
                        button.action();
                        return;
                    }
                }
            }
            
            // Si un dialogue est déjà ouvert
            if (this.vrDialoguePanel && this.vrDialoguePanel.isVisible) {
                console.log(`[VR] Dialogue panel visible. isShowingChoices=${this.vrDialoguePanel.isShowingChoices}`);
                
                // Raycast sur le panel pour les choix
                if (this.vrDialoguePanel.isShowingChoices) {
                     console.log(`[VR] Checking raycast on dialogue panel...`);
                     this.tempMatrix.identity().extractRotation(interactingHand.matrixWorld);
                     this.interactionRaycaster.ray.origin.setFromMatrixPosition(interactingHand.matrixWorld);
                     this.interactionRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
                     
                     const intersects = this.interactionRaycaster.intersectObject(this.vrDialoguePanel.mesh);
                     console.log(`[VR] Raycast intersects: ${intersects.length}`);
                     
                     if (intersects.length > 0) {
                         const uv = intersects[0].uv;
                         console.log(`[VR] Hit UV: (${uv.x.toFixed(3)}, ${uv.y.toFixed(3)})`);
                         const choiceIndex = this.vrDialoguePanel.checkClick(uv);
                         console.log(`[VR] Choice index: ${choiceIndex}`);
                         
                         if (choiceIndex >= 0) {
                             const choice = this.vrDialoguePanel.choices[choiceIndex];
                             console.log("✅ VR Choice Selected:", choice);
                             
                             // Immediately hide choices to prevent re-selection
                             this.vrDialoguePanel.isShowingChoices = false;
                             this.vrDialoguePanel.draw(); // Redraw to hide buttons immediately
                             
                             // Add cooldown to prevent immediate re-trigger
                             this.vrDialoguePanel.lastInputTime = Date.now();
                             
                             // Handle choice directly in VR
                             // 1. Call the onChoiceMade callback if it exists (this sets the starter_choisi flag)
                             if (this.game.dialogueSystem && this.game.dialogueSystem.onChoiceMade) {
                                 this.game.dialogueSystem.onChoiceMade(choiceIndex, choice, this.vrDialoguePanel.npc);
                             }
                             
                             // 2. After flag is set, re-fetch dialogue based on new game state
                             setTimeout(() => {
                                 const npc = this.vrDialoguePanel.npc;
                                 
                                 // Verify the flag was actually set
                                 const hasStarter = this.game.saveManager?.saveData?.drapeaux?.starter_choisi;
                                 console.log(`[VR] After choice, starter_choisi flag: ${hasStarter}`);
                                 
                                 if (hasStarter) {
                                     // Flag is set, show post-starter dialogue
                                     const dialogueData = this.game.npcManager.startDialogue(npc);
                                     console.log(`[VR] Re-fetched dialogue key: ${dialogueData?.key}`);
                                     
                                     if (dialogueData && dialogueData.dialogues && dialogueData.dialogues.length > 0) {
                                         this.vrDialoguePanel.dialogues = dialogueData.dialogues;
                                         this.vrDialoguePanel.currentIndex = 0;
                                         this.vrDialoguePanel.key = dialogueData.key;
                                         this.vrDialoguePanel.showDialogue(dialogueData.dialogues[0]);
                                     } else {
                                         this.vrDialoguePanel.hide();
                                     }
                                 } else {
                                     // Flag not set yet, use the choice's nextDialogues as fallback
                                     console.warn(`[VR] Flag not set, using fallback dialogues`);
                                     if (choice.nextDialogues && choice.nextDialogues.length > 0) {
                                         this.vrDialoguePanel.dialogues = choice.nextDialogues;
                                         this.vrDialoguePanel.currentIndex = 0;
                                         this.vrDialoguePanel.showDialogue(choice.nextDialogues[0]);
                                     } else {
                                         this.vrDialoguePanel.hide();
                                     }
                                 }
                             }, 500); // Increased delay to ensure flag propagation
                             
                             return;
                         }
                     }
                }
                
                // Sinon clic simple pour avancer
                this.vrDialoguePanel.advance();
                return;
            }
            
            // Sinon, Raycast pour trouver un PNJ
            this.tempMatrix.identity().extractRotation(interactingHand.matrixWorld);
            this.interactionRaycaster.ray.origin.setFromMatrixPosition(interactingHand.matrixWorld);
            this.interactionRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
            
            // Objets interactifs : On cherche dans la scène active
            const activeScene = this.game.sceneManager.getActiveScene();
            if (!activeScene) return;
            
            // On veut toucher les meshes des PNJ qui ont userData.isNPC = true
            // On traverse ou on récupère une liste depuis NPCManager (plus optimisé) if possible.
            // Pour l'instant, intersectObjects sur children de la scène (peut être lourd)
            // Mieux: this.game.npcManager.npcs.get(sceneName) -> map to meshes
            
            let candidates = [];
            // Collecter les meshes PNJ
            activeScene.traverse(obj => {
                if (obj.userData && obj.userData.isNPC) { // Ou userData.npcData
                    candidates.push(obj);
                }
            });
            
            // Ajout indicateurs indicateurs visuels (userData.isNPCIndicator)
            
            const intersects = this.interactionRaycaster.intersectObjects(candidates, true); // true = recursive pour les groupes
            
            if (intersects.length > 0) {
                // Trouver le premier objet qui est lié à un PNJ
                // Le mesh touché peut être un enfant du groupe PNJ
                let hitObj = intersects[0].object;
                while(hitObj && !hitObj.userData.npcData && hitObj.parent) {
                    hitObj = hitObj.parent;
                }
                
                if (hitObj && hitObj.userData.npcData) {
                    const npc = hitObj.userData.npcData;
                    console.log("🎯 Hit NPC: " + npc.nom);
                    
                    // Déclencher le dialogue via l'UI Manager
                    // (Cela appellera notre hook start())
                    const dialogue = this.game.npcManager.startDialogue(npc);
                    if (this.game.dialogueSystem) {
                         this.game.dialogueSystem.start(npc, dialogue.dialogues, dialogue.key);
                    }
                }
            }
        }
    }

  }
