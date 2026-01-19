import * as THREE from 'three';

/**
 * VRPokeball - Une Pokéball interactible avec physique simple
 */
export class VRPokeball {
    constructor(game, mesh, data = {}) {
        this.game = game;
        this.mesh = mesh;
        this.data = data; // { type, pokemonId, isTeamBall, pokemonName, etc. }

        this.state = 'ATTACHED'; // ATTACHED, HELD, THROWN, LANDED

        // Physique
        this.velocity = new THREE.Vector3();
        this.gravity = -9.8;
        this.radius = 0.04; // 4cm

        // Pour le respawn
        this.hasHitTarget = false;

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
        if (this.hasHitTarget) return; // Déjà touché quelque chose

        const pokeballPos = this.mesh.position;

        for (const pokemon of this.game.pokemonManager.pokemons) {
            if (!pokemon.model || pokemon.inCombat) continue;

            const pokemonPos = pokemon.model.position.clone();

            // Hitbox généreuse pour faciliter le gameplay VR
            // Base de 2m de rayon + taille du pokemon
            let collisionRadius = 2.0;
            if (pokemon.model.userData?.boundingBox) {
                const box = pokemon.model.userData.boundingBox;
                collisionRadius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 + 1.5;
            }

            // Distance horizontale (ignorer Y pour plus de tolérance)
            const dx = pokeballPos.x - pokemonPos.x;
            const dz = pokeballPos.z - pokemonPos.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);

            // Hauteur très tolérante (3m de marge)
            const heightDiff = Math.abs(pokeballPos.y - (pokemonPos.y + 1.0));

            if (horizontalDist < collisionRadius && heightDiff < 3.0) {
                this.onHitPokemon(pokemon);
                break;
            }
        }
    }

    onHitPokemon(pokemon) {
        if (this.state !== 'THROWN') return;
        if (this.hasHitTarget) return;

        this.hasHitTarget = true;
        console.log(`🎯 VR Hit: ${pokemon.species} !`, this.data);
        this.state = 'LANDED';
        this.velocity.set(0, 0, 0);

        // Positionner la ball près du pokemon
        this.mesh.position.set(
            pokemon.model.position.x,
            pokemon.model.position.y + 0.5,
            pokemon.model.position.z
        );

        if (this.data.isTeamBall) {
            // C'est un Pokémon de l'équipe -> Lancer le combat
            this.triggerCombat(pokemon);
        } else {
            // C'est une Ball vide -> Tenter la capture
            this.attemptCapture(pokemon);
        }
    }

    triggerCombat(wildPokemon) {
        console.log("⚔️ VR Combat: Envoi de", this.data.pokemonName || "Pokemon", "contre", wildPokemon.species);

        // Récupérer les données du pokemon de l'équipe
        const teamPokemonId = this.data.pokemonId;
        if (!teamPokemonId || !this.game.saveManager) {
            console.error("❌ Pas de pokemon d'équipe valide !");
            return;
        }

        // Récupérer le pokemon depuis SaveManager
        const playerPokemonData = this.game.saveManager.getPokemon(teamPokemonId);
        if (!playerPokemonData) {
            console.error("❌ Pokemon non trouvé dans l'équipe:", teamPokemonId);
            return;
        }

        // Utiliser PokeballPhysics pour spawn le pokemon et démarrer le combat
        // startCombat(playerPokemon, wildPokemon) - le pokemon du joueur en premier !
        if (this.game.pokeballPhysics) {
            this.game.pokeballPhysics.startCombat(playerPokemonData, wildPokemon);
        }

        // Cacher la ball VR (le pokemon est sorti)
        this.mesh.visible = false;
    }

    attemptCapture(wildPokemon) {
        console.log("🔴 VR Capture: Tentative sur", wildPokemon.species);

        if (this.game.pokeballPhysics) {
            // Mock pokeball pour PokeballPhysics
            const mockPokeball = {
                pokemon: null, // Vide = capture
                mesh: this.mesh
            };

            // attemptCapture gère la logique de capture et les callbacks
            this.game.pokeballPhysics.attemptCapture(wildPokemon, mockPokeball);
        }
    }

    onLand() {
        if (this.hasHitTarget) return; // Déjà géré par onHitPokemon

        this.state = 'LANDED';
        this.mesh.position.y = this.radius; // Poser au sol
        this.velocity.set(0, 0, 0);

        console.log("🔴 Pokéball a atterri sans toucher de cible", this.data);

        // Si c'est une ball d'équipe qui touche le sol, spawn le pokemon quand même
        if (this.data.isTeamBall && this.data.pokemonId) {
            this.spawnTeamPokemon();
        }
    }

    spawnTeamPokemon() {
        // Spawn le pokemon de l'équipe au sol (hors combat)
        const teamPokemonId = this.data.pokemonId;
        if (!teamPokemonId || !this.game.saveManager) return;

        const pokemonData = this.game.saveManager.getPokemon(teamPokemonId);
        if (!pokemonData) return;

        console.log("🐾 Spawn pokemon d'équipe:", pokemonData.name || pokemonData.species);

        // Utiliser PokeballPhysics.spawnPlayerPokemon si disponible
        if (this.game.pokeballPhysics?.spawnPlayerPokemon) {
            const spawnPos = this.mesh.position.clone();
            spawnPos.y = 0; // Au sol
            this.game.pokeballPhysics.spawnPlayerPokemon(pokemonData, spawnPos);
        }

        // Cacher la ball
        this.mesh.visible = false;
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
