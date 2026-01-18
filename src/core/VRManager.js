import * as THREE from "three";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

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
  }

  setupControllers() {
    // --- Controller 0 : Gauche (par défaut souvent) ---
    // Note: On vérifiera les profils/handedness dynamiquement
    
    // Ray Space (Ligne de visée)
    const controller1 = this.renderer.xr.getController(0);
    controller1.addEventListener('selectstart', () => this.onSelectStart(controller1));
    controller1.addEventListener('selectend', () => this.onSelectEnd(controller1));
    controller1.addEventListener('connected', (e) => this.onControllerConnected(e, controller1));
    controller1.addEventListener('disconnected', (e) => this.onControllerDisconnected(e, controller1));
    this.playerRig.add(controller1);
    
    // Ray Space 2
    const controller2 = this.renderer.xr.getController(1);
    controller2.addEventListener('selectstart', () => this.onSelectStart(controller2));
    controller2.addEventListener('selectend', () => this.onSelectEnd(controller2));
    controller2.addEventListener('connected', (e) => this.onControllerConnected(e, controller2));
    controller2.addEventListener('disconnected', (e) => this.onControllerDisconnected(e, controller2));
    this.playerRig.add(controller2);

    // Grip Space (Modèle 3D de la manette)
    const controllerGrip1 = this.renderer.xr.getControllerGrip(0);
    controllerGrip1.add(this.controllerModelFactory.createControllerModel(controllerGrip1));
    this.playerRig.add(controllerGrip1);

    const controllerGrip2 = this.renderer.xr.getControllerGrip(1);
    controllerGrip2.add(this.controllerModelFactory.createControllerModel(controllerGrip2));
    this.playerRig.add(controllerGrip2);
    
    this.controllersArr = [controller1, controller2];
    this.gripsArr = [controllerGrip1, controllerGrip2];
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
    }
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
    }
  }

  onSelectEnd(controller) {
    controller.userData.isSelecting = false;
  }

  onSessionStart() {
    console.log("🕶️ Session VR Démarrée");
    this.enabled = true;
    this.game.useVR = true; // Flag global
    
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
    
    // Mettre à jour les gamepads (nécessaire pour lire les axes à chaque frame)
    // Les objets gamepad ne se mettent pas à jour auto, il faut les relire depuis la source ou c'est géré par WebXR ?
    // En WebXR, event.data.gamepad est une référence.
  }

  handleLocomotion(delta) {
    // 1. Déplacement (Joystick Gauche)
    if (this.controllers.left) {
        const gamepad = this.controllers.left.userData.gamepad;
        if (gamepad && gamepad.axes) {
            // Axes standards: [2] = X (gauche/droite), [3] = Y (haut/bas)
            const x = gamepad.axes[2]; 
            const y = gamepad.axes[3];

            // Deadzone
            if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {
                this.moveVector.set(x, 0, y);
                
                // Mouvement relatif à la direction du regard (HMD)
                // On prend la rotation Y de la caméra (tête)
                const rotation = this.camera.getWorldDirection(new THREE.Vector3());
                const theta = Math.atan2(rotation.x, rotation.z);
                
                // Appliquer la rotation au vecteur de mouvement
                this.moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), theta);
                
                // Injecter dans l'InputManager ou déplacer directement ?
                // Le mieux est de passer par InputManager pour les collisions
                this.game.inputManager.setVRInput(this.moveVector.x, this.moveVector.z);
            } else {
                this.game.inputManager.setVRInput(0, 0);
            }
        }
    }

    // 2. Rotation Snap (Joystick Droit)
    if (this.controllers.right) {
        const gamepad = this.controllers.right.userData.gamepad;
        if (gamepad && gamepad.axes) {
            const x = gamepad.axes[2];
            
            // Gestion du délai pour éviter rotation continue trop rapide
            if (this.snapTurnDelay > 0) {
                this.snapTurnDelay -= delta;
            } else if (Math.abs(x) > 0.5) {
                const angle = 45 * (Math.PI / 180); // 45 degrés
                const direction = x > 0 ? -1 : 1; // Droite ou Gauche
                
                // Tourner le Rig
                this.playerRig.rotateY(angle * direction);
                
                // Délai avant prochain snap (ex: 0.5s)
                this.snapTurnDelay = 0.5;
            }
        }
    }
  }
}
