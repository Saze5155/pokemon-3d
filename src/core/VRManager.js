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

      // Ajouter le Rig à la scène active
      if (this.game.sceneManager.activeSceneName === 'world') {
          this.game.worldManager.worldScene.add(this.playerRig);
      } else {
          const scene = this.game.sceneManager.scenes.get(this.game.sceneManager.activeSceneName);
          if (scene) scene.add(this.playerRig);
      }

      // Synchroniser la position du Rig avec la caméra desktop
      this.playerRig.position.copy(this.camera.position);
      this.playerRig.position.y = this.camera.position.y; // Ajuster hauteur min ?
      
      // La camera Three.js est maintenant contrôlée par le headset
      // Elle est RELATIVE au playerRig (car WebXR met sa propre matrice de vue)
      // Mais nous ne devons PAS la parenter physiquement si on utilise le système de cam par défaut three.js XR
      // Three.js gère la caméra XR automatiquement, elle "devient" les yeux.
      // Cependant pour la locomotion, on déplace le "Rig" (un Group qui contient la camera LOGIQUE si on le voulait, mais ici on déplace juste un conteneur et on mettra à jour la cam)
      
      // En three.js standard, 'camera' est déplacée par le device. Si on veut bouger le joueur, il faut soit déplacer tout le monde, soit utiliser un wrapper.
      // La méthode recommandée est souvent: Scene -> UserGroup -> Camera.
      // On va déplacer la caméra, donc on "attache" la caméra au rig au démarrage ?
      this.playerRig.add(this.camera);
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
            // On vérifie le produit scalaire entre la normale de la montre et le regard
            // Ou simplement la rotation Z du poignet
            const rotation = this.controllers.left.rotation;
            
            // Debug (à calibrer)
            // console.log(rotation);
            
            // La montre est visible si on la regarde
            // Pour l'instant, on la laisse toujours visible pour debug
            this.watchMenu.isVisible = true; 
            
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
      if (!session) return;

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
        const x = leftGamepad.axes[2];
        const y = leftGamepad.axes[3];

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
