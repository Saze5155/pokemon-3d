import * as THREE from 'three';
import { VRPokeball } from '../entities/VRPokeball.js';

/**
 * VRInteractionManager - Gère les interactions mains/objets
 * S'occupe principalement de "Grab" et "Throw"
 */
export class VRInteractionManager {
    constructor(game, vrManager) {
        this.game = game;
        this.vrManager = vrManager;

        // Mains
        this.hands = {
            left: { heldObject: null, velocityTracker: [] },
            right: { heldObject: null, velocityTracker: [] }
        };

        // Configuration
        this.grabDistance = 0.15; // 15cm
    }

    /**
     * Appelé à chaque frame par VRManager
     */
    update(delta) {
        // Suivi de vélocité pour le lancer
        this.updateVelocityTracker('left', delta);
        this.updateVelocityTracker('right', delta);
        
        // Update des objets tenus (si logique spécifique)
        // Update des objets lancés (VRPokeball.update) via une liste globale ?
        // Pour l'instant, VRManager ne boucle pas sur les entités physiques séparées.
        // On va devoir gérer une liste d'objets actifs.
    }
    
    // Suivi position pour calculer vitesse relachement
    updateVelocityTracker(handName, delta) {
        const controller = this.vrManager.controllers[handName];
        if (!controller) return;

        const hand = this.hands[handName];
        
        // Stocker les 5 dernières positions/temps
        const now = performance.now();
        const pos = controller.getWorldPosition(new THREE.Vector3());
        
        hand.velocityTracker.push({ pos, time: now });
        
        // Garder historique court (~100ms)
        if (hand.velocityTracker.length > 5) hand.velocityTracker.shift();
    }

    getThrowVelocity(handName) {
        const hand = this.hands[handName];
        if (hand.velocityTracker.length < 2) return new THREE.Vector3();

        const last = hand.velocityTracker[hand.velocityTracker.length - 1];
        const first = hand.velocityTracker[0];
        
        const dt = (last.time - first.time) / 1000;
        if (dt <= 0.001) return new THREE.Vector3();

        const velocity = new THREE.Vector3()
            .subVectors(last.pos, first.pos)
            .divideScalar(dt);
            
        return velocity;
    }

    /**
     * Tente d'attraper un objet proche
     */
    handleGrab(handName) {
        // Si on tient déjà un truc, on ne fait rien (ou on le lache ?)
        if (this.hands[handName].heldObject) return;

        console.log(`[Interaction] ${handName} tente d'attraper...`);

        // Objets potentielles : Ceinture
        // On check la ceinture via VRBelt
        // Optimisation: On demande à VRBelt de nous donner l'objet le plus proche
        // ou on check manuellement les listes de VRBelt
        
        const belt = this.vrManager.vrBelt;
        if (!belt || !belt.isVisible) return; // On ne peut attraper que si ceinture visible (regard bas)
        
        // Récupérer position main
        const controller = this.vrManager.controllers[handName]; 
        // Note: Idéalement GripSpace controller, mais VRManager.controllers stocke les RaySpace ?
        // VRManager ligne 323: this.controllers.left = controller (RaySpace)
        // Mais on a aussi this.gripsArr.
        // On va utiliser le RaySpace (controller) pour la distance, c'est assez proche.
        
        if (!controller) return;
        const handPos = controller.getWorldPosition(new THREE.Vector3());

        let closest = null;
        let minDist = this.grabDistance;

        // Check Team Balls (Right)
        belt.teamBalls.forEach(ball => {
            const dist = ball.getWorldPosition(new THREE.Vector3()).distanceTo(handPos);
            if (dist < minDist) {
                minDist = dist;
                closest = ball;
            }
        });

        // Check Inventory Balls (Left)
        belt.captureBalls.forEach(ball => {
            const dist = ball.getWorldPosition(new THREE.Vector3()).distanceTo(handPos);
            if (dist < minDist) {
                minDist = dist;
                closest = ball;
            }
        });

        if (closest) {
            this.grabObject(handName, closest);
        }
    }

    grabObject(handName, mesh) {
        console.log(`[Interaction] ${handName} attrape ${mesh.uuid}`);

        // Sauvegarder le parent et la position AVANT toute manipulation
        const originalParent = mesh.parent;
        const originalPosition = mesh.position.clone();

        // 1. Créer l'entité logique si pas déjà présente
        let pokeball = mesh.userData.vrPokeball;
        if (!pokeball) {
            // C'est une ball brute de la ceinture, on doit la "convertir" en VRPokeball dynamique
            // On clone le mesh pour le détacher de la ceinture sans casser l'UI ceinture
            const newMesh = mesh.clone(true); // true = recursive clone pour les enfants (bouton, ceinture)

            // S'assurer que le clone et ses enfants sont visibles
            newMesh.visible = true;
            newMesh.traverse(child => { child.visible = true; });

            // On cache l'original sur la ceinture
            mesh.visible = false;
            mesh.userData.isHidden = true; // Flag pour VRBelt

            // Init VRPokeball avec les vraies données du mesh original
            newMesh.userData = { ...mesh.userData };
            pokeball = new VRPokeball(this.game, newMesh, mesh.userData);

            this.game.sceneManager.getActiveScene().add(newMesh); // Ajouter au monde d'abord
        }

        // Toujours sauvegarder les infos de restauration (même si pokeball existait déjà)
        pokeball.originalBeltMesh = mesh;
        pokeball.originalParent = originalParent;
        pokeball.originalPosition = originalPosition;

        // 2. Attacher à la main
        const controller = this.vrManager.controllers[handName];

        controller.add(pokeball.mesh);
        pokeball.mesh.position.set(0, -0.02, 0); // Ajuster position dans la main
        pokeball.mesh.rotation.set(0, 0, 0);

        pokeball.grab(controller);

        this.hands[handName].heldObject = pokeball; 
    }

    handleRelease(handName) {
        const hand = this.hands[handName];
        if (!hand.heldObject) return;

        console.log(`[Interaction] ${handName} relache...`);
        const pokeball = hand.heldObject;

        // Calcul vitesse
        const velocity = this.getThrowVelocity(handName);
        console.log(`[Interaction] Velocity: ${velocity.length().toFixed(2)}`);

        const THROW_THRESHOLD = 1.0; // Vitesse minimale pour considérer un lancer

        // IMPORTANT: Récupérer la position monde AVANT de détacher du controller
        const worldPos = new THREE.Vector3();
        pokeball.mesh.getWorldPosition(worldPos);

        // Récupérer la rotation monde aussi
        const worldQuat = new THREE.Quaternion();
        pokeball.mesh.getWorldQuaternion(worldQuat);

        // Détacher de la main (le controller)
        const controller = this.vrManager.controllers[handName];
        if (controller) {
            controller.remove(pokeball.mesh);
        }

        const scene = this.game.sceneManager.getActiveScene();

        if (velocity.length() > THROW_THRESHOLD) {
            // LANCER
            // Ajouter à la scène avec position monde
            scene.add(pokeball.mesh);
            pokeball.mesh.position.copy(worldPos);
            pokeball.mesh.quaternion.copy(worldQuat);

            // S'assurer que la ball est visible
            pokeball.mesh.visible = true;
            pokeball.mesh.traverse(child => { child.visible = true; });

            pokeball.throw(velocity);

            // Ajouter à la liste des objets actifs de la scène pour physics update
            if (!this.game.activePhysicsObjects) this.game.activePhysicsObjects = [];
            this.game.activePhysicsObjects.push(pokeball);

            console.log("[Interaction] Ball lancée!", worldPos);

        } else {
            // LÂCHER (Drop) -> Retour ceinture
            console.log("[Interaction] Drop detected (vitesse faible), retour ceinture");

            // Ne pas ajouter à la scène, juste détruire le clone
            // (déjà détaché du controller ci-dessus)
            if (pokeball.mesh.geometry) pokeball.mesh.geometry.dispose();

            // Réafficher l'original sur la ceinture
            if (pokeball.originalBeltMesh && pokeball.originalParent) {
                const original = pokeball.originalBeltMesh;

                // Réattacher au parent original (holster) si nécessaire
                if (!original.parent) {
                    pokeball.originalParent.add(original);
                    original.position.copy(pokeball.originalPosition);
                }

                original.visible = true;
                original.userData.isHidden = false;
                // S'assurer que tous les enfants sont aussi visibles
                original.traverse(child => { child.visible = true; });
                console.log("[Interaction] Ball originale restaurée sur ceinture");
            }
        }

        hand.heldObject = null;
    }
}
