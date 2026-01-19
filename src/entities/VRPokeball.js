import * as THREE from 'three';

/**
 * VRPokeball - Une Pokéball interactible avec physique simple
 */
export class VRPokeball {
    constructor(game, mesh, data = {}) {
        this.game = game;
        this.mesh = mesh;
        this.data = data; // { type, pokemonId, level, etc. }

        this.state = 'ATTACHED'; // ATTACHED, HELD, THROWN, LANDED
        
        // Physique
        this.velocity = new THREE.Vector3();
        this.gravity = -9.8;
        this.radius = 0.04; // 4cm
        
        // Setup initial
        this.mesh.userData.interactable = true;
        this.mesh.userData.vrPokeball = this;
    }

    update(delta) {
        if (this.state === 'THROWN') {
            // Appliquer gravité
            this.velocity.y += this.gravity * delta;

            // Appliquer vélocité
            this.mesh.position.addScaledVector(this.velocity, delta);
            
            // Rotation visuelle pendant le vol
            this.mesh.rotation.x -= 10 * delta;


            // Collision Sol (Y=0 pour l'instant)
            if (this.mesh.position.y <= this.radius) {
                this.onLand();
            }

            // Collision Pokemon
            this.checkCollisions();
        }
    }

    checkCollisions() {
        if (!this.game.pokemonManager || !this.game.pokemonManager.pokemons) return;

        const pokeballPos = this.mesh.position;
        // Optimization: Ne pas checker trop souvent ?
        // Pour l'instant on check à chaque frame car c'est critique

        for (const pokemon of this.game.pokemonManager.pokemons) {
            if (!pokemon.model || pokemon.inCombat) continue;

            // Simple Bounding Sphere Check
            // On pourrait utiliser la logique plus complexe de PokeballPhysics mais on simplifie pour la perf VR
            const pokemonPos = pokemon.model.position;
            const dist = pokeballPos.distanceTo(pokemonPos);
            
            // Rayon collision approximatif (Pokemon = 0.5 ~ 1m + Ball 0.1m)
            if (dist < 1.0) {
                this.onHitPokemon(pokemon);
                break; // Une seule collision
            }
        }
    }

    onHitPokemon(pokemon) {
        if (this.state !== 'THROWN') return;
        
        console.log(`🎯 VR Hit: ${pokemon.species} !`, this.data);
        this.state = 'LANDED'; // Stop physics temporarily
        this.velocity.set(0, 0, 0);

        // Capture ou Combat ?
        if (this.data.isTeamBall) {
             // C'est un Pokémon de l'équipe -> Combat
             // TODO: Trigger Combat
             console.log("⚔️ TODO: Lancer le combat !");
        } else {
             // C'est une Ball vide -> Capture
             // Adapter pour utiliser PokeballPhysics
             if (this.game.pokeballPhysics) {
                 // On passe 'this' (VRPokeball) mais PokeballPhysics attend une structure un peu différente
                 // On va mocker ce qu'il attend ou appeler attemptCapture avec les bonnes données
                 
                 // PokeballPhysics.attemptCapture(wildPokemon, pokeball)
                 // pokeball.pokemon doit être null pour capture
                 // pokeball.mesh sert pour la position
                 
                 const mockPokeball = {
                     pokemon: null, // Vide
                     mesh: this.mesh
                 };
                 
                 this.game.pokeballPhysics.attemptCapture(pokemon, mockPokeball);
                 
                 // Détruire notre balle VR car PokeballPhysics va gérer la suite (ou pas ?)
                 // PokeballPhysics ne détruit pas la mesh, il la fait rebondir si raté
                 // Sauf qu'ici c'est NOTRE mesh. 
                 
                 // Si capture réussie, PokeballPhysics supprime le Pokemon et notifie.
                 // Si raté, il fait rebondir la ball.
                 // Le souci est que PokeballPhysics manipule sa propre physique. 
                 // On va laisser PokeballPhysics gérer le succès/échec LOGIQUE, mais on doit gérer le visuel ici.
                 
                 // Pour l'instant, on détruit la balle VR pour éviter les conflits, 
                 // et on laisse PokeballPhysics gérer le feedback (il loggue pour l'instant)
                 // ATTENTION: PokeballPhysics fait des anims sur 'pokeball.mesh'. 
                 // Donc si on passe 'this.mesh', il va l'animer. C'est parfait.
             }
        }
    }

    onLand() {
        this.state = 'LANDED';
        this.mesh.position.y = this.radius; // Poser au sol
        this.velocity.set(0, 0, 0);
        
        // Effet ou Logique de jeu
        console.log("🔴 Pokéball a atterri !", this.data);
        
        // TODO: Déclencher l'ouverture si c'est une PokemonBall
        if (this.data.isTeamBall) {
             // this.game.combatManager.startBattle(...) ?
             // Ou juste spawn le pokemon pour le voir
        }
    }

    grab(controller) {
        this.state = 'HELD';
        this.velocity.set(0, 0, 0);
        
        // Attacher au contrôleur
        // Note: C'est géré par InteractionManager qui reparente le mesh
        // Ici on gère juste l'état logique
    }

    throw(velocity) {
        this.state = 'THROWN';
        this.velocity.copy(velocity);
        
        // Ajouter un "boost" pour compenser la sensation de lourdeur parfois en VR
        this.velocity.multiplyScalar(1.2);
        
        console.log("🚀 Pokéball lancée !", this.velocity);
    }
}
