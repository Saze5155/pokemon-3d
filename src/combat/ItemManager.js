export class ItemManager {
    constructor(game) {
        this.game = game;
        this.items = {};
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        try {
            const response = await fetch('data/objets.json');
            this.items = await response.json();
            this.initialized = true;
            console.log("✅ ItemManager chargé");
        } catch (e) {
            console.error("❌ Erreur chargement objets.json", e);
        }
    }

    getItem(itemId) {
        // Recherche dans les différentes catégories
        for (const category in this.items) {
            if (this.items[category][itemId]) {
                const item = { ...this.items[category][itemId] };
                item.id = itemId;
                item.category = category;
                return item;
            }
        }
        return null;
    }

    canUseItem(itemId, pokemon, context = 'combat') {
        const item = this.getItem(itemId);
        if (!item) return { success: false, message: "Objet inconnu." };

        // Checks de base
        if (pokemon.hp === 0 && item.effet !== 'revive') {
            return { success: false, message: "Ce Pokémon est K.O. !" };
        }
        if (pokemon.hp > 0 && item.effet === 'revive') {
            return { success: false, message: "Ce Pokémon n'est pas K.O." };
        }

        // Checks spécifiques
        switch (item.effet) {
            case 'heal_hp':
            case 'full_restore':
                if (pokemon.hp >= pokemon.maxHp && (item.effet !== 'full_restore' || !pokemon.status)) {
                    return { success: false, message: "PV déjà au max." };
                }
                break;
            case 'cure_status':
            case 'cure_all_status':
                if (!pokemon.status) {
                    return { success: false, message: "Aucun problème de statut." };
                }
                if (item.statut && item.statut !== 'all' && item.statut !== pokemon.status) {
                     return { success: false, message: "Ça n'aura aucun effet." };
                }
                break;
            case 'heal_pp':
            case 'restore_pp':
                // Check PP (TODO if PP system implemented fully)
                break;
        }

        return { success: true };
    }

    useItem(itemId, pokemon, combatManager = null) {
        const check = this.canUseItem(itemId, pokemon, combatManager ? 'combat' : 'menu');
        if (!check.success) return check;

        const item = this.getItem(itemId);
        let message = `Vous utilisez ${item.nom}.`;

        // Appliquer l'effet
        switch (item.effet) {
            case 'heal_hp':
                this.healHp(pokemon, item.valeur);
                message = `${pokemon.name} récupère ${item.valeur} PV !`;
                break;

            case 'full_restore':
                this.healHp(pokemon, 9999);
                if (pokemon.status && combatManager && combatManager.statusManager) {
                    combatManager.statusManager.removeStatus(pokemon);
                }
                message = `${pokemon.name} retrouve sa forme !`;
                break;

            case 'revive':
                const healPercent = item.valeur || 0.5;
                const healAmount = Math.floor(pokemon.maxHp * healPercent);
                pokemon.hp = healAmount;
                pokemon.isFainted = false; // Reset fainted flag logic if any
                message = `${pokemon.name} est réanimé !`;
                break;

            case 'cure_status':
            case 'cure_all_status':
                if (combatManager && combatManager.statusManager) {
                    combatManager.statusManager.removeStatus(pokemon);
                    message = `${pokemon.name} est soigné de son statut !`;
                }
                break;

            case 'boost_stat':
                if (combatManager) {
                    const result = combatManager.applyStatChange(pokemon, item.stat, item.valeur || 1);
                    if (result.success) message = `${item.nom} : ${result.message}`;
                    else return { success: false, message: result.message };
                }
                break;
            
            // TODO: Autres effets (PP, Evolution, etc.)
        }

        // Clamp HP
        if (pokemon.hp > pokemon.maxHp) pokemon.hp = pokemon.maxHp;

        return { success: true, message: message };
    }

    healHp(pokemon, amount) {
        const oldHp = pokemon.hp;
        pokemon.hp = Math.min(pokemon.maxHp, pokemon.hp + amount);
        return pokemon.hp - oldHp;
    }
}
