import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

/**
 * InputManager - Gère tous les inputs clavier et souris
 * Centralise la gestion des contrôles pour une meilleure maintenabilité
 */
export class InputManager {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // État des touches
    this.keys = {
      forward: false, // Z ou W
      backward: false, // S
      left: false, // Q ou A
      right: false, // D
      jump: false, // Space
      run: false, // Shift
      interact: false, // E
      menu: false, // Escape
    };

    // Input VR
    this.vrInput = { x: 0, z: 0 };
    this.vrInteractPressed = false;

    // Configuration
    this.moveSpeed = 0.1;
    this.runMultiplier = 1.8;
    this.mouseSensitivity = 0.5; // Sensibilité de la souris par défaut (valeur médiane)

    // Callbacks pour les actions
    this.onMenuToggle = null;
    this.onInteract = null;
    this.jumpPressed = false;

    // Pointer Lock Controls
    this.controls = new PointerLockControls(camera, domElement);

    // Modifier la sensibilité par défaut
    this.controls.pointerSpeed = this.mouseSensitivity;

    // Condition pour bloquer le lock (ex: menu ouvert)
    // Modifié pour VR : En VR, on considère toujours "locked" pour le mouvement si on est en session
    this.canLock = () => true;

    this.initEventListeners();
  }

  initEventListeners() {
    // Click pour lock
    this.domElement.addEventListener("click", () => {
      if (this.canLock()) {
        this.controls.lock();
      }
    });

    // Detecter le verrouillage effectif
    this.controls.addEventListener("lock", () => {
        this.lastLockTime = Date.now();
    });

    // Keydown
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));
    document.addEventListener("keyup", (e) => this.handleKeyUp(e));
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        this.jumpPressed = true;
      }
    });

    document.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        this.jumpPressed = false;
      }
    });
  }

  handleKeyDown(e) {
    const key = e.key.toLowerCase();

    // Mouvement ZQSD / WASD
    if (key === "z" || key === "w") this.keys.forward = true;
    if (key === "q" || key === "a") this.keys.left = true;
    if (key === "s") this.keys.backward = true;
    if (key === "d") this.keys.right = true;

    // Actions
    if (key === " ") this.keys.jump = true;
    if (key === "shift") this.keys.run = true;
    if (key === "e") {
      this.keys.interact = true;
      if (this.onInteract) this.onInteract();
    }
    if (key === "escape") {
      if (this.onMenuToggle) this.onMenuToggle();
    }
  }

  handleKeyUp(e) {
    const key = e.key.toLowerCase();

    if (key === "z" || key === "w") this.keys.forward = false;
    if (key === "q" || key === "a") this.keys.left = false;
    if (key === "s") this.keys.backward = false;
    if (key === "d") this.keys.right = false;

    if (key === " ") this.keys.jump = false;
    if (key === "shift") this.keys.run = false;
    if (key === "e") this.keys.interact = false;
  }

  /**
   * Calcule le vecteur de mouvement basé sur les inputs
   * @returns {THREE.Vector3} Vecteur de déplacement normalisé
   */
  getMovementVector() {
    const direction = new THREE.Vector3();

    if (this.keys.forward) direction.z -= 1;
    if (this.keys.backward) direction.z += 1;
    if (this.keys.left) direction.x -= 1;
    if (this.keys.right) direction.x += 1;

    direction.normalize();

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, this.camera.up);

    const move = new THREE.Vector3();
    const speed = this.moveSpeed * (this.keys.run ? this.runMultiplier : 1);

    move.addScaledVector(forward, -direction.z * speed);
    move.addScaledVector(right, direction.x * speed);

    // DEBUG VR Input
    if (this.vrInput.x !== 0 || this.vrInput.z !== 0) {
      console.log(`🎯 VR Input reçu: x=${this.vrInput.x.toFixed(2)}, z=${this.vrInput.z.toFixed(2)}`);
      move.x += this.vrInput.x * speed;
      move.z += this.vrInput.z * speed;
      console.log(`🚀 Move final: x=${move.x.toFixed(3)}, z=${move.z.toFixed(3)}`);
    }

    return move;
  }

  /**
   * Définit l'input de mouvement VR
   * @param {number} x - Axe X world (après rotation tête)
   * @param {number} z - Axe Z world (après rotation tête)
   */
  setVRInput(x, z) {
      this.vrInput.x = x;
      this.vrInput.z = z;
  }

  /**
   * Déclenche une interaction (depuis VR Controller)
   */
  triggerInteraction() {
      if (this.onInteract) this.onInteract();
  }

  /**
   * Vérifie si le joueur est en train de bouger
   * @returns {boolean}
   */
  isMoving() {
    return (
      this.keys.forward ||
      this.keys.backward ||
      this.keys.left ||
      this.keys.right
    );
  }

  /**
   * Vérifie si les contrôles sont verrouillés
   * @returns {boolean}
   */
  isLocked() {
    // En VR, on est toujours considéré comme "locked" pour permettre le mouvement
    if (this.vrInput.x !== 0 || this.vrInput.z !== 0 || (this.camera && this.camera.parent && this.camera.parent.type === 'Group')) {
         return true;
    }
    return this.controls.isLocked;
  }

  /**
   * Définit la condition pour autoriser le lock
   * @param {Function} callback - Fonction retournant true si le lock est autorisé
   */
  setCanLockCondition(callback) {
    this.canLock = callback;
  }

  /**
   * Configure la vitesse de déplacement
   * @param {number} speed - Vitesse de base
   * @param {number} runMultiplier - Multiplicateur de course
   */
  setMoveSpeed(speed, runMultiplier = 1.8) {
    this.moveSpeed = speed;
    this.runMultiplier = runMultiplier;
  }

  isJumpPressed() {
    const pressed = this.jumpPressed;
    this.jumpPressed = false; // Reset après lecture
    return pressed;
  }

  /**
   * Libère les ressources
   */
  dispose() {
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    this.controls.dispose();
  }
}
