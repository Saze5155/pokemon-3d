/**
 * paths.js
 * Configuration centralisée des chemins du projet
 *
 * Avantages:
 * - Facilite la maintenance
 * - Permet de changer les chemins en un seul endroit
 * - Rend le code plus portable
 */

export const PATHS = {
  // Assets
  ASSETS: {
    SPRITES: 'assets/sprites',
    POKEMON_MODELS: 'assets/sprites/pokemons',
    POKEMON_SPRITE: 'assets/sprites/sprite_pokemon.png',
    CSS: 'assets/css',
  },

  // Data files
  DATA: {
    POKEMON: 'data/pokemons.json',
    MOVES: 'data/attaques.json',
    MOVESETS: 'data/movesets.json',
    ITEMS: 'data/objets.json',
    TYPES: 'data/types.json',
  },

  // Save files (API endpoints)
  API: {
    LOAD_SAVE: '/load-save',
    LOAD_MYPOKEMON: '/load-mypokemon',
    SAVE_GAME: '/save-game',
  },

  // Local storage keys
  STORAGE: {
    SAVES: 'pokemon_saves',
    MY_POKEMON: 'pokemon_mypokemon',
  },
};

/**
 * Helper pour construire un chemin de modèle Pokemon
 */
export function getPokemonModelPath(pokemonName) {
  const filename = pokemonName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return `${PATHS.ASSETS.POKEMON_MODELS}/${filename}.glb`;
}

/**
 * Helper pour construire un chemin de sprite
 */
export function getSpritePosition(id, spriteWidth = 70, spriteHeight = 58) {
  const x = ((id - 1) % 20) * spriteWidth;
  const y = Math.floor((id - 1) / 20) * spriteHeight;
  return { x, y };
}
