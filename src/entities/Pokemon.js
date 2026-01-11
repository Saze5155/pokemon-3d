import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class Pokemon {
  constructor(
    scene,
    name,
    modelPath,
    position,
    scale = 0.5,
    rotationOffset = 0
  ) {
    this.scene = scene;
    this.name = name;
    this.modelPath = modelPath;
    this.position = position.clone();
    this.model = null;
    this.modelScale = scale;
    this.rotationOffset = rotationOffset;

    // Mouvement
    this.isMoving = false;
    this.moveSpeed = 0.8;
    this.target = position.clone();
    this.baseHeight = position.y;
    this.jumpTimer = 0;
    this.jumpHeight = 0;
    this.patrolTimer = 0;
    this.patrolInterval = 4 + Math.random() * 3;
    this.idleTime = 2 + Math.random() * 2;
    this.isIdle = false;

    // Combat
    this.inCombat = false;

    // Collision
    this.collisionRadius = 0.5;

    // Stats gameplay
    this.level = Math.floor(Math.random() * 3) + 3;
    this.maxHp = 20 + this.level * 5;
    this.hp = this.maxHp;
    this.species = name;

    // Charger le modèle
    this.loadModel();
  }

  loadModel() {
    const loader = new GLTFLoader();

    loader.load(
      this.modelPath,
      (gltf) => {
        this.model = gltf.scene;
        this.model.position.copy(this.position);

        this.model.scale.set(this.modelScale, this.modelScale, this.modelScale);

        // Activer les ombres
        this.model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.model.userData = {
          isPokemon: true,
          pokemon: this,
          hasCollision: true,
        };

        this.scene.add(this.model);
      },
      undefined,
      (error) => {
        console.error(`Erreur chargement ${this.name}:`, error);
      }
    );
  }

  update(delta, playerPosition, collisionObjects = []) {
    if (!this.model) return;

    // Si en combat, ne pas bouger et regarder le joueur
    if (this.inCombat) {
      if (playerPosition) {
        const directionToPlayer = new THREE.Vector3().subVectors(
          playerPosition,
          this.model.position
        );
        directionToPlayer.y = 0;
        directionToPlayer.normalize();

        // FIX: Inverser la direction pour faire FACE au joueur
        const angleToPlayer =
          Math.atan2(-directionToPlayer.x, -directionToPlayer.z) +
          this.rotationOffset;
        this.model.rotation.y = angleToPlayer;
      }
      return;
    }

    // Patrouille aléatoire avec pause
    if (!this.isIdle) {
      this.patrolTimer += delta;
      if (this.patrolTimer > this.patrolInterval) {
        this.patrolTimer = 0;
        this.setRandomTarget(collisionObjects);
      }
    } else {
      this.patrolTimer += delta;
      if (this.patrolTimer > this.idleTime) {
        this.isIdle = false;
        this.patrolTimer = 0;
      }
    }

    // Déplacement avec saut
    if (this.isMoving) {
      const direction = new THREE.Vector3().subVectors(
        this.target,
        this.model.position
      );

      direction.y = 0;
      const distance = direction.length();
      direction.normalize();

      if (distance > 0.1) {
        const moveDistance = this.moveSpeed * delta;
        const newPosition = this.model.position.clone();
        newPosition.add(direction.multiplyScalar(moveDistance));
        newPosition.y = this.baseHeight;

        if (!this.checkCollision(newPosition, collisionObjects)) {
          this.model.position.x = newPosition.x;
          this.model.position.z = newPosition.z;

          // Animation de saut
          this.jumpTimer += delta * 6;
          this.jumpHeight = Math.abs(Math.sin(this.jumpTimer)) * 0.25;
          this.model.position.y = this.baseHeight + this.jumpHeight;

          const angle =
            Math.atan2(-direction.x, -direction.z) + this.rotationOffset;
          this.model.rotation.y = angle;
        } else {
          this.isMoving = false;
          this.isIdle = true;
          this.patrolTimer = 0;
        }
      } else {
        this.isMoving = false;
        this.isIdle = true;
        this.patrolTimer = 0;
        this.model.position.y = this.baseHeight;
        this.jumpTimer = 0;
      }
    } else if (!this.isIdle) {
      // FIX: Rotation vers le joueur quand statique - INVERSER la direction
      if (playerPosition) {
        const directionToPlayer = new THREE.Vector3().subVectors(
          playerPosition,
          this.model.position
        );
        directionToPlayer.y = 0;
        directionToPlayer.normalize();

        // FIX: Utiliser -x et -z pour faire FACE au joueur (pas lui tourner le dos)
        const angleToPlayer =
          Math.atan2(-directionToPlayer.x, -directionToPlayer.z) +
          this.rotationOffset;

        // Rotation progressive
        const currentRotation = this.model.rotation.y;
        let rotationDiff = angleToPlayer - currentRotation;

        // Normaliser l'angle entre -PI et PI
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

        this.model.rotation.y += rotationDiff * delta * 3;
      }
    }
  }

  checkCollision(position, collisionObjects) {
    const pokemonSphere = new THREE.Sphere(position, this.collisionRadius);

    for (const obj of collisionObjects) {
      if (!obj || obj === this.model) continue;
      if (!obj.userData || !obj.userData.hasCollision) continue;

      const box = new THREE.Box3().setFromObject(obj);

      if (box.intersectsSphere(pokemonSphere)) {
        return true;
      }
    }

    return false;
  }

  setRandomTarget(collisionObjects = []) {
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 1 + Math.random() * 2;

      const testTarget = new THREE.Vector3(
        this.position.x + Math.cos(angle) * distance,
        this.baseHeight,
        this.position.z + Math.sin(angle) * distance
      );

      if (!this.checkCollision(testTarget, collisionObjects)) {
        this.target.copy(testTarget);
        this.isMoving = true;
        this.jumpTimer = 0;
        return;
      }
    }

    this.isIdle = true;
    this.patrolTimer = 0;
  }

  takeDamage(damage) {
    this.hp = Math.max(0, this.hp - damage);

    if (this.model) {
      this.model.traverse((child) => {
        if (child.isMesh && child.material) {
          const originalColor = child.material.color.clone();
          child.material.color.set(0xff0000);
          setTimeout(() => {
            if (child.material) child.material.color.copy(originalColor);
          }, 100);
        }
      });
    }

    if (this.hp <= 0) {
      this.faint();
    }
  }

  faint() {
    if (!this.model) return;

    let fallSpeed = 0;
    const fallInterval = setInterval(() => {
      if (!this.model) {
        clearInterval(fallInterval);
        return;
      }

      fallSpeed += 0.02;
      this.model.rotation.x += fallSpeed;
      this.model.position.y -= fallSpeed * 0.5;

      if (this.model.position.y < -2) {
        clearInterval(fallInterval);
        this.remove();
      }
    }, 16);
  }

  remove() {
    if (this.model) {
      this.scene.remove(this.model);
      this.model = null;
    }
  }

  getDistanceToPlayer(playerPosition) {
    if (!this.model) return Infinity;
    return this.model.position.distanceTo(playerPosition);
  }
}

// Factory pour créer les starters
export class PokemonFactory {
  static createStarter(scene, starterName, position) {
    const starters = {
      salameche: {
        name: "Salamèche",
        modelPath: "assets/sprites/pokemons/salameche.glb",
        scale: 0.6,
        rotationOffset: 0,
      },
      carapuce: {
        name: "Carapuce",
        modelPath: "assets/sprites/pokemons/carapuce.glb",
        scale: 1.5,
        rotationOffset: Math.PI / 4,
      },
      bulbizarre: {
        name: "Bulbizarre",
        modelPath: "assets/sprites/pokemons/bulbizarre.glb",
        scale: 0.5,
        rotationOffset: 0,
      },
    };

    const data = starters[starterName.toLowerCase()];
    if (!data) {
      console.error(`Starter "${starterName}" inconnu`);
      return null;
    }

    return new Pokemon(
      scene,
      data.name,
      data.modelPath,
      position,
      data.scale,
      data.rotationOffset
    );
  }
}
