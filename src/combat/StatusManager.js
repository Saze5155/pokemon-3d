export class StatusManager {
    constructor() {
        this.STATUS = {
            NONE: null,
            POISON: 'PSN',
            PARALYSIS: 'PAR',
            SLEEP: 'SLP',
            BURN: 'BRN',
            FREEZE: 'FRZ'
        };

        // Immunities (Type -> Status)
        this.IMMUNITIES = {
            'poison': ['PSN'],
            'acier': ['PSN'],
            'feu': ['BRN'],
            'glace': ['FRZ'],
            'electrik': ['PAR']
        };
    }

    canApplyStatus(pokemon, status) {
        // Can't apply if already has status
        if (pokemon.status && pokemon.status !== this.STATUS.NONE) return false;

        // Check type immunities
        if (pokemon.types) {
            for (const type of pokemon.types) {
                if (this.IMMUNITIES[type] && this.IMMUNITIES[type].includes(status)) {
                    return false;
                }
            }
        }

        return true;
    }

    applyStatus(pokemon, status) {
        if (!this.canApplyStatus(pokemon, status)) return false;

        pokemon.status = status;
        pokemon.statusTurn = 0; // Turn counter for SLP/FRZ

        // Sleep duration (1-3 turns)
        if (status === this.STATUS.SLEEP) {
            pokemon.sleepTurns = Math.floor(Math.random() * 3) + 1;
        }

        return true;
    }

    removeStatus(pokemon) {
        pokemon.status = null;
        pokemon.statusTurn = 0;
        delete pokemon.sleepTurns;
    }

    // Check if Pokemon can move
    canMove(pokemon) {
        if (!pokemon.status) return { canMove: true };

        switch (pokemon.status) {
            case this.STATUS.SLEEP:
                if (pokemon.statusTurn >= pokemon.sleepTurns) {
                    this.removeStatus(pokemon);
                    return { canMove: true, message: `${pokemon.name || 'Le Pokémon'} se réveille !` };
                }
                pokemon.statusTurn++;
                return { canMove: false, message: `${pokemon.name || 'Le Pokémon'} dort profondément.` };

            case this.STATUS.FREEZE:
                // 20% chance to thaw
                if (Math.random() < 0.2) {
                    this.removeStatus(pokemon);
                    return { canMove: true, message: `${pokemon.name || 'Le Pokémon'} n'est plus gelé !` };
                }
                return { canMove: false, message: `${pokemon.name || 'Le Pokémon'} est gelé !` };

            case this.STATUS.PARALYSIS:
                // 25% chance to not move
                if (Math.random() < 0.25) {
                    return { canMove: false, message: `${pokemon.name || 'Le Pokémon'} est paralysé ! Il ne peut pas bouger !` };
                }
                return { canMove: true };

            default:
                return { canMove: true };
        }
    }

    // Process end-of-turn effects (damage)
    processEndTurn(pokemon) {
        if (!pokemon.status) return null;

        let damage = 0;
        let message = null;

        switch (pokemon.status) {
            case this.STATUS.POISON:
                damage = Math.floor(pokemon.maxHp / 8);
                message = `${pokemon.name || 'Le Pokémon'} souffre du poison !`;
                break;
            case this.STATUS.BURN:
                damage = Math.floor(pokemon.maxHp / 16);
                message = `${pokemon.name || 'Le Pokémon'} souffre de sa brûlure !`;
                break;
        }

        if (damage > 0) {
            // Apply damage (ensure doesn't go below 0 handled by caller usually, but good to return amount)
            return { damage, message };
        }

        return null;
    }

    // Get stat multiplier
    getStatMultiplier(pokemon, stat) {
        let multiplier = 1.0;

        if (pokemon.status === this.STATUS.PARALYSIS && stat === 'speed') {
            multiplier *= 0.25; // Speed drop from paralysis
        }

        if (pokemon.status === this.STATUS.BURN && stat === 'attack') {
            multiplier *= 0.5; // Attack drop from burn
        }

        return multiplier;
    }
}
