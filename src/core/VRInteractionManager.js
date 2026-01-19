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
        
        // 1. Créer l'entité logique si pas déjà présente
        let pokeball = mesh.userData.vrPokeball;
        if (!pokeball) {
            // C'est une ball brute de la ceinture, on doit la "convertir" en VRPokeball dynamique
            // On clone le mesh pour le détacher de la ceinture sans casser l'UI ceinture
            const newMesh = mesh.clone();
            
            // On cache l'original sur la ceinture (on le réaffichera si on lache sans lancer ?)
            // Pour l'instant on le laisse ou on le cache ? 
            // Mieux: On le cache.
            mesh.visible = false;
            mesh.userData.isHidden = true; // Flag pour VRBelt
            
            // TODO: Dire à VRBelt que ce slot est vide temporairement
            
            // Init VRPokeball
            // On assume que userData du mesh original avait des infos (type, pokemon...)
            // VRBelt doit mettre ces infos. Pour l'instant c'est vide.
            pokeball = new VRPokeball(this.game, newMesh, { isTeamBall: true }); // Mock data
            
            this.game.sceneManager.getActiveScene().add(newMesh); // Ajouter au monde d'abord
        }

        // 2. Attacher à la main
        // Reparenter au controller GRIP pour un suivi physique parfait
        // On doit trouver le Grip Controller correspondant
        // VRManager ne stocke pas grip par nom facilement, on va tricher et attacher au RaySpace ou chercher le grip
        // Utilisons le RaySpace stocké dans controllers[handName] pour simplifier au début
        const controller = this.vrManager.controllers[handName];
        
        controller.add(pokeball.mesh);
        pokeball.mesh.position.set(0, -0.02, 0); // Ajuster position dans la main
        pokeball.mesh.rotation.set(0, 0, 0);
        
        pokeball.grab(controller);
        
        this.hands[handName].heldObject = pokeball;
        // Reference vers l'original pour le restaurer si besoin
        pokeball.originalBeltMesh = mesh; 
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
        
        // Détacher de la main
        // Attacher à la scène MDI (Monde)
        const scene = this.game.sceneManager.getActiveScene();
        scene.add(pokeball.mesh);
        
        // Conserver position monde
        const worldPos = new THREE.Vector3();
        pokeball.mesh.getWorldPosition(worldPos);
        pokeball.mesh.position.copy(worldPos);
        pokeball.mesh.rotation.set(0,0,0); // Reset rotation locale ? ou garder monde ?
        
        if (velocity.length() > THROW_THRESHOLD) {
            // LANCER
            pokeball.throw(velocity);
            
            // Ajouter à la liste des objets actifs de la scène pour physics update
            if (!this.game.activePhysicsObjects) this.game.activePhysicsObjects = [];
            this.game.activePhysicsObjects.push(pokeball);
            
        } else {
            // LÂCHER (Drop) -> Retour ceinture
            console.log("[Interaction] Drop detected (vitesse faible), retour ceinture");
            
            // Détruire le clone
            scene.remove(pokeball.mesh);
            
            // Réafficher l'original
            if (pokeball.originalBeltMesh) {
                pokeball.originalBeltMesh.visible = true;
                pokeball.originalBeltMesh.userData.isHidden = false;
            }
        }
        
        hand.heldObject = null;
    }
}
