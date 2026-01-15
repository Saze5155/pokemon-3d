import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { PokeballPhysics } from "../combat/PokeballPhysics.js";

export class Player {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    this.moveSpeed = 10;
    this.jumpSpeed = 8;
    this.gravity = -20;
    this.isOnGround = false;
    this.canJump = false;

    this.keys = { z: false, q: false, s: false, d: false };

    // Position du joueur
    this.camera.position.set(0, 2);

    // Controls FPS
    this.controls = new PointerLockControls(camera, renderer.domElement);
    this.scene.add(this.controls.getObject());

    // Raycaster pour détecter le sol
    this.raycaster = new THREE.Raycaster(
      new THREE.Vector3(),
      new THREE.Vector3(0, -1, 0),
      0,
      2
    );

    this.setupEvents();
  }

  setupEvents() {
    // Verrouillage souris au clic
    this.renderer.domElement.addEventListener("click", () => {
      this.controls.lock();
    });

    // Touches AZERTY
    document.addEventListener("keydown", (e) => {
      if (e.code === "KeyW") this.keys.z = true; // Z
      if (e.code === "KeyA") this.keys.q = true; // Q
      if (e.code === "KeyS") this.keys.s = true; // S
      if (e.code === "KeyD") this.keys.d = true; // D
      if (e.code === "Space" && this.canJump) {
        this.velocity.y = this.jumpSpeed;
        this.canJump = false;
      }
    });



    document.addEventListener("keyup", (e) => {
      if (e.code === "KeyW") this.keys.z = false;
      if (e.code === "KeyA") this.keys.q = false;
      if (e.code === "KeyS") this.keys.s = false;
      if (e.code === "KeyD") this.keys.d = false;
    });
  }

  update(delta, collisionObjects) {
    if (!this.controls.isLocked) return;

    // Gravité
    this.velocity.y += this.gravity * delta;

    // Direction de mouvement
    this.direction.set(0, 0, 0);
    if (this.keys.z) this.direction.z -= 1;
    if (this.keys.s) this.direction.z += 1;
    if (this.keys.q) this.direction.x -= 1;
    if (this.keys.d) this.direction.x += 1;
    this.direction.normalize();

    // Calculer le mouvement souhaité
    const moveX = this.direction.x * this.moveSpeed * delta;
    const moveZ = this.direction.z * this.moveSpeed * delta;

    console.log("moveX:", moveX, "moveZ:", moveZ);

    // Position actuelle
    const playerPos = this.controls.getObject().position.clone();
    playerPos.y -= 0.5; // Milieu du corps

    // Collision horizontale
    const horizontalRaycaster = new THREE.Raycaster();
    const collisionDistance = 0.5; // Distance de détection

    // Vérifier collision avant de bouger
    let canMoveX = true;
    let canMoveZ = true;

    // Direction du mouvement en world space
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));

    // Check mouvement avant/arrière (Z)
    if (moveZ !== 0) {
      const dirZ = cameraDirection.clone().multiplyScalar(-Math.sign(moveZ));
      horizontalRaycaster.set(playerPos, dirZ);
      const hitsZ = horizontalRaycaster.intersectObjects(
        collisionObjects,
        true
      );

      console.log("Raycast Z - hits:", hitsZ.length);
      if (hitsZ.length > 0) {
        console.log(
          "Distance:",
          hitsZ[0].distance,
          "Object:",
          hitsZ[0].object.name
        );
      }

      if (hitsZ.length > 0 && hitsZ[0].distance < collisionDistance) {
        canMoveZ = false;
      }
    }

    // Check mouvement gauche/droite (X)
    if (moveX !== 0) {
      const dirX = cameraRight.clone().multiplyScalar(Math.sign(moveX));
      horizontalRaycaster.set(playerPos, dirX);
      const hitsX = horizontalRaycaster.intersectObjects(
        collisionObjects,
        true
      );
      if (hitsX.length > 0 && hitsX[0].distance < collisionDistance) {
        canMoveX = false;
      }
    }

    // Appliquer le mouvement si pas de collision
    if (canMoveX) this.controls.moveRight(moveX);
    if (canMoveZ) this.controls.moveForward(-moveZ);

    // Appliquer la gravité
    this.controls.getObject().position.y += this.velocity.y * delta;

    // Détection du sol
    this.raycaster.ray.origin.copy(this.controls.getObject().position);
    const intersections = this.raycaster.intersectObjects(
      collisionObjects,
      true
    );

    this.isOnGround = intersections.length > 0;

    if (this.isOnGround) {
      this.velocity.y = Math.max(0, this.velocity.y);
      this.canJump = true;

      if (intersections[0].distance < 1.8) {
        this.controls.getObject().position.y += 1.8 - intersections[0].distance;
      }
    }
  }

  activate() {
    this.controls.lock();
  }

  deactivate() {
    this.controls.unlock();
    // Reset keys
    this.keys = { z: false, q: false, s: false, d: false };
  }
}
