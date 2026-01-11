import * as THREE from "three";
import { GLTFLoader } from "/node_modules/three/examples/jsm/loaders/GLTFLoader.js";

export class ActivePokemon {
  constructor(scene, pokemonData, spawnPosition) {
    this.scene = scene;
    this.pokemonData = pokemonData;
    this.model = null;
    this.target = null; // Position à suivre (le joueur)
    this.followDistance = 2; // Distance derrière le joueur (en mètres)
    this.followSpeed = 5; // Vitesse de suivi
    this.isLoaded = false;
    this.inCombat = false; // Bloque le suivi en combat

    // Position et rotation
    this.position = spawnPosition.clone();
    this.velocity = new THREE.Vector3();

    // Animation
    this.mixer = null;
    this.animations = [];
    this.currentAnimation = null;

    this.loadModel();
  }

  loadModel() {
    const loader = new GLTFLoader();
    const modelPath = this.getModelPath();

    loader.load(
      modelPath,
      (gltf) => {
        this.model = gltf.scene;
        this.model.position.copy(this.position);

        // Scale approprié (ajuster selon tes modèles)
        this.model.scale.set(6, 6, 6);

        // Ombre
        this.model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Animations
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.model);
          this.animations = gltf.animations;
          // Jouer l'animation idle par défaut
          this.playAnimation(0);
        }

        this.scene.add(this.model);
        this.isLoaded = true;

        console.log(`${this.pokemonData.name} spawned!`);
      },
      (progress) => {
        console.log(
          `Loading ${this.pokemonData.name}: ${(
            (progress.loaded / progress.total) *
            100
          ).toFixed(2)}%`
        );
      },
      (error) => {
        console.error(`Error loading ${this.pokemonData.name}:`, error);
        // Fallback: créer un cube coloré
        this.createFallbackModel();
      }
    );
  }

  getModelPath() {
    // Convertir nom en lowercase pour path
    const filename = this.pokemonData.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // Retirer accents

    return `assets/sprites/pokemons/${filename}.glb`;
  }

  createFallbackModel() {
    // Modèle de secours si le GLB ne charge pas
    const colors = {
      1: 0x78c850, // Bulbizarre - vert
      4: 0xf08030, // Salamèche - orange
      7: 0x6890f0, // Carapuce - bleu
    };

    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshStandardMaterial({
      color: colors[this.pokemonData.id] || 0xff00ff,
    });
    this.model = new THREE.Mesh(geometry, material);
    this.model.position.copy(this.position);
    this.model.castShadow = true;

    this.scene.add(this.model);
    this.isLoaded = true;

    console.log(`${this.pokemonData.name} spawned (fallback model)`);
  }

  playAnimation(index) {
    if (!this.mixer || !this.animations[index]) return;

    if (this.currentAnimation) {
      this.currentAnimation.stop();
    }

    this.currentAnimation = this.mixer.clipAction(this.animations[index]);
    this.currentAnimation.play();
  }

  setTarget(target) {
    this.target = target;
  }

  update(deltaTime) {
    if (!this.isLoaded || !this.model) return;

    // Mise à jour animations
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    // Ne pas suivre le joueur en combat
    if (this.inCombat) return;

    // Suivre la cible (joueur)
    if (this.target) {
      const targetPos = this.target.position.clone();

      // Position derrière le joueur
      const direction = new THREE.Vector3();
      this.target.getWorldDirection(direction);
      direction.negate(); // Inverser pour être derrière

      const desiredPos = targetPos
        .clone()
        .add(direction.multiplyScalar(this.followDistance));
      // Tenter d'obtenir la hauteur du terrain via le SceneManager injecté
      if (this.scene.userData?.sceneManager) {
        desiredPos.y = this.scene.userData.sceneManager.getTerrainHeight(
          desiredPos.x,
          desiredPos.z
        );
      } else {
        desiredPos.y = 0; // Fallback
      }

      // Distance actuelle à la position désirée
      const currentPos = this.model.position.clone();
      currentPos.y = 0;
      const distance = currentPos.distanceTo(desiredPos);

      // Seuil pour commencer à suivre
      const followThreshold = this.followDistance + 0.5;

      if (distance > followThreshold) {
        // Trop loin, se rapprocher
        const moveDir = new THREE.Vector3()
          .subVectors(desiredPos, currentPos)
          .normalize();

        this.velocity.copy(
          moveDir.multiplyScalar(this.followSpeed * deltaTime)
        );
        this.model.position.add(this.velocity);

        // Rotation vers la direction de mouvement
        const angle = Math.atan2(moveDir.x, moveDir.z);
        this.model.rotation.y = angle;
      } else if (distance > 0.5) {
        // Proche mais pas collé, mouvement smooth
        const t = deltaTime * 2;
        this.model.position.lerp(desiredPos, t);

        // Rotation vers le joueur
        this.model.lookAt(targetPos);
        this.model.rotation.x = 0;
        this.model.rotation.z = 0;
      }
    }
  }

  recall() {
    // Animation de rappel (optionnel)
    if (this.model) {
      // Effet de lumière/particules
      this.createRecallEffect();

      // Retirer après animation
      setTimeout(() => {
        this.dispose();
      }, 500);
    }
  }

  createRecallEffect() {
    // Effet visuel de rappel (lumière rouge)
    const light = new THREE.PointLight(0xff0000, 2, 5);
    light.position.copy(this.model.position);
    this.scene.add(light);

    // Fade out
    const fadeOut = setInterval(() => {
      light.intensity -= 0.1;
      if (light.intensity <= 0) {
        this.scene.remove(light);
        clearInterval(fadeOut);
      }
    }, 50);
  }

  dispose() {
    if (this.model) {
      this.scene.remove(this.model);

      this.model.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });

      this.model = null;
    }

    console.log(`${this.pokemonData.name} recalled!`);
  }
}
