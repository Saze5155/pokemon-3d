import * as THREE from 'three';
import { VRPokeball } from '../entities/VRPokeball.js';

/**
 * VRBelt - Système de ceinture virtuelle
 * Gère l'affichage des Pokéballs à la taille du joueur
 */
export class VRBelt {
    constructor(game, playerRig) {
        this.game = game;
        this.playerRig = playerRig;
        this.camera = game.camera; // Sera sync avec le headset

        this.isVisible = false;
        
        // Groupe principal attaché au Rig
        // Note: On ne l'attache pas directement à la caméra pour éviter qu'il suive le pitch (bas/haut) de la tête
        // Il doit suivre le X/Z de la tête, mais rester à une hauteur fixe (ou relative au cou)
        this.container = new THREE.Group();
        this.playerRig.add(this.container);

        // Groupes pour les côtés
        this.leftHolster = new THREE.Group(); // Capture (Pokéballs vides)
        this.rightHolster = new THREE.Group(); // Équipe
        
        this.container.add(this.leftHolster);
        this.container.add(this.rightHolster);

        // Position relative au centre du corps
        // Position relative au centre du corps
        // Z négatif = Devant le joueur
        this.leftHolster.position.set(-0.3, -0.2, -0.35); // Ajusté (-0.35)
        this.rightHolster.position.set(0.3, -0.2, -0.35); // Ajusté (-0.35)

        // Rotation pour orienter vers l'avant et le haut (meilleur accès)
        // Y = Orientation générale (vers l'intérieur pour suivre la courbe du corps)
        // X = Penché vers l'avant (pour voir les balls du haut)
        // Z = Écartement (flarc)
        
        this.leftHolster.rotation.set(0.2, 0.3, -0.1); 
        this.rightHolster.rotation.set(0.2, -0.3, 0.1);

        // Materiaux
        this.ballMaterials = {
            'pokeball': new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.3, metalness: 0.5 }),
            'superball': new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.3, metalness: 0.5 }),
            'hyperball': new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.3, metalness: 0.5 }),
            'masterball': new THREE.MeshStandardMaterial({ color: 0x800080, roughness: 0.1, metalness: 0.8 }),
            'vide': new THREE.MeshBasicMaterial({ color: 0x444444, wireframe: true, transparent: true, opacity: 0.5 })
        };

        this.teamBalls = [];
        this.captureBalls = [];

        // cooldown pour éviter spam d'update
        this.lastUpdate = 0;
        
        console.log("✅ VRBelt: Initialisée");
    }

    /**
     * Met à jour la position et la visibilité de la ceinture
     * @param {number} delta Temps écoulé
     */
    update(delta) {
        if (!this.camera) return;

        // 1. Gestion de la Visibilité (Regard vers le bas)
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        // Le vecteur "Bas" dans le monde est (0, -1, 0)
        // On regarde si le forward pointe vers le bas
        // Dot product: 1 = même direction, 0 = 90deg, -1 = opposé
        // Si on regarde vers le bas, Y du forward est négatif.
        // Seuil: -0.5 correspond à 60° vers le bas (cos 60 = 0.5? non c'est l'inverse)
        // angle > 30° vers le bas. sin(-30) = -0.5
        
        const isLookingDown = forward.y < -0.4; // Environ 25-30 degrés vers le bas

        if (isLookingDown !== this.isVisible) {
            this.isVisible = isLookingDown;
            this.container.visible = this.isVisible;
            
            // Si on devient visible, on ne force PAS le refresh pour ne pas casser les interactions en cours
            // if (this.isVisible) this.refreshData();
        }

        if (!this.isVisible) return; 

        // 2. Positionnement "Body-Tracking" simulé
        // ... (Code existant inchangé pour le positionnement) ...
        const headPos = this.camera.position;
        const waistHeight = headPos.y - 0.5;
        this.container.position.set(headPos.x, waistHeight, headPos.z);
        
        const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
        this.container.rotation.y = euler.y;
    }

    refreshData() {
        this.updateTeam();
        this.updateInventory();
    }

    /**
     * Met à jour les balles de l'équipe (Côté Droit)
     */
    updateTeam() {
        // Nettoyer existant
        this.teamBalls.forEach(b => this.rightHolster.remove(b));
        this.teamBalls = [];

        const team = this.game.saveManager?.myPokemon || {};
        console.log(`[VRBelt] updateTeam: Found ${Object.keys(team).length} pokemons`, team);
        
        // Configuration Grille 2 colonnes x 3 lignes
        // Col 1 = Arrière, Col 2 = Avant (ou inversement selon préférence)
        // Lignes = Haut (0), Milieu (1), Bas (2)
        
        const cols = 2;
        // Espacements
        const sepX = 0.08; // Espacement horizontal (profondeur)
        const sepY = 0.08; // Espacement vertical (hauteur)

        for (let i = 0; i < 6; i++) {
            // Calcul position grille
            // i=0 -> col 0, row 0
            // i=1 -> col 1, row 0
            // i=2 -> col 0, row 1...
            const col = i % cols; 
            const row = Math.floor(i / cols);

            // Slot occupé ?
            if (team[i+1]) {
                const pokemon = team[i+1];
                const ball = this.createPokeballMesh('pokeball');
                
                // Positionnement
                // X : Décalage en largeur (vers l'extérieur du corps) -> Non, c'est depth sur le holster ?
                // Le holster est rotaté de -0.3rad.
                // Disons:
                // X (Local) = Profondeur le long de la hanche
                // Y (Local) = Hauteur verticale
                // Z (Local) = Ecartement du corps
                
                // On arrange en 2 colonnes le long de la hanche (X) et en hauteur (Y) ?
                // Ou 2 colonnes en Z (épaisseur) ?
                // "2 colonnes de 3" sur une surface plane verticale type plaque de cuisse.
                
                // Centrage
                const x = (col * sepX) + 0.05; // Décalage vers l'arrière
                const y = -(row * sepY) + 0.1; // Part du haut vers le bas
                const z = 0;

                ball.position.set(x, y, z);
                
                this.rightHolster.add(ball);
                this.teamBalls.push(ball);
            } else {
                const empty = this.createPokeballMesh('vide');
                empty.scale.setScalar(0.5);
                
                const x = (col * sepX) + 0.05;
                const y = -(row * sepY) + 0.1;
                const z = 0;

                empty.position.set(x, y, z);
                this.rightHolster.add(empty);
                this.teamBalls.push(empty);
            }
        }
    }

    /**
     * Met à jour les balles de capture (Côté Gauche)
     */

    updateInventory() {
        this.captureBalls.forEach(b => this.leftHolster.remove(b));
        this.captureBalls = [];

        // ✅ FIX: Accès correct aux données du sac via SaveManager
        const saveManager = this.game.saveManager;
        
        let countPokeball = saveManager ? saveManager.getItemCount("pokeballs", "pokeball") : 0;
        let countSuper = saveManager ? saveManager.getItemCount("pokeballs", "superball") : 0;
        let countHyper = saveManager ? saveManager.getItemCount("pokeballs", "hyperball") : 0;

        // ✅ FIX: Mode "Illimité" (ou Sandbox) si inventaire vide
        // Si le joueur n'a aucune balle, on lui donne des Pokéballs infinies (visuellement)
        // Cela correspond au comportement Desktop parfois observé ou attendu pour le test VR
        const totalBalls = countPokeball + countSuper + countHyper;
        
        if (totalBalls === 0) {
            console.log("[VRBelt] Inventaire vide -> Mode Illimité activé (1 Pokéball)");
            countPokeball = 1; // Toujours afficher au moins une balle
        }

        const balls = [
            { id: 'pokeball', count: countPokeball, color: 0xff0000 },
            { id: 'superball', count: countSuper, color: 0x3366cc },
            { id: 'hyperball', count: countHyper, color: 0xffff00 }
        ];

        let offset = 0;
        const scale = 0.04; // 4cm radius

        balls.forEach(ballType => {
            if (ballType.count > 0) {
                // Créer une représentation de la balle
                const ballMesh = this.createPokeballMesh(ballType.id);
                
                // Positionner en ligne ou grille
                // Côté Gauche: on inverse X pour symétrie par rapport au joueur
                ballMesh.position.set(
                    -(0.1 + (offset * 0.1)), 
                    0, 
                    (offset * 0.05)
                );
                
                // Metadata pour l'interaction
                ballMesh.userData = {
                    type: 'capture',
                    ballId: ballType.id,
                    isTeamBall: false,
                    isUnlimited: totalBalls === 0 // Marqueur pour savoir si c'est une balle "virtuelle"
                };

                // Ajouter au container
                this.leftHolster.add(ballMesh);
                this.captureBalls.push(ballMesh);
                
                // Wrapper pour la physique
                new VRPokeball(this.game, ballMesh, ballMesh.userData);

                offset++;
            }
        });
    }

    createPokeballMesh(type) {
        const geometry = new THREE.SphereGeometry(0.04, 16, 16); // 8cm diametre = 4cm rayon
        const material = this.ballMaterials[type] || this.ballMaterials['pokeball'];
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Ligne noire de la ceinture de la ball
        const beltGeo = new THREE.CylinderGeometry(0.041, 0.041, 0.005, 16);
        const beltMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const belt = new THREE.Mesh(beltGeo, beltMat);
        mesh.add(belt);
        
        // Bouton
        const btnGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.01, 8);
        const btnMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const btn = new THREE.Mesh(btnGeo, btnMat);
        btn.rotation.x = Math.PI / 2;
        btn.position.z = 0.04;
        mesh.add(btn);

        return mesh;
    }
}
