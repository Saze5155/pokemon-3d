/**
 * ModernPokedexUI.js - Interface du Pokédex moderne
 */

export class ModernPokedexUI {
  constructor(uiManager) {
    this.ui = uiManager;
    this.isVisible = false;
    this.createUI();
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'modern-pokedex-ui';
    this.container.className = 'modern-menu-overlay modern-ui';
    this.container.style.display = 'none';
    
    this.container.innerHTML = `
      <div class="modern-menu-container theme-red" style="max-width: 900px; height: 85vh;">
        <div class="modern-menu-header" style="background: linear-gradient(135deg, #ef5350, #c62828);">
          <div class="modern-menu-title">
            <span class="material-symbols-rounded">menu_book</span>
            POKÉDEX
          </div>
          <button class="modern-close-btn">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
        
        <div class="pokedex-stats-bar">
            <div class="stat-pill">
                <span class="label">VUS</span>
                <span class="value" id="pokedex-seen-count">0</span>
            </div>
            <div class="stat-pill">
                <span class="label">PRIS</span>
                <span class="value" id="pokedex-caught-count">0</span>
            </div>
        </div>

        <div class="modern-pokedex-content">
            <div class="pokedex-grid" id="modern-pokedex-grid">
                <!-- Entries -->
            </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.container);
    
    this.container.querySelector('.modern-close-btn').addEventListener('click', () => {
      this.ui.closeAllMenus();
    });
  }

  show() {
    this.render();
    this.container.classList.add('visible');
    this.isVisible = true;
    if (document.exitPointerLock) document.exitPointerLock();
  }

  hide() {
    this.container.classList.remove('visible');
    this.isVisible = false;
  }

  render() {
      const grid = document.getElementById('modern-pokedex-grid');
      const seenEl = document.getElementById('pokedex-seen-count');
      const caughtEl = document.getElementById('pokedex-caught-count');
      
      grid.innerHTML = '';

      if (!this.ui.saveManager || !this.ui.saveManager.saveData) return;

      const pokedex = this.ui.saveManager.saveData.pokedex;
      const seen = pokedex.vus || [];
      const caught = pokedex.captures || [];
      const totalPokemon = 151; // Gen 1 standard

      seenEl.textContent = seen.length;
      caughtEl.textContent = caught.length;

      for(let i=1; i<=totalPokemon; i++) {
          const isSeen = seen.includes(i);
          const isCaught = caught.includes(i);
          
          if (!isSeen) {
               // Unknown slot
               const slot = document.createElement('div');
               slot.className = 'pokedex-slot unknown';
               slot.innerHTML = `<div class="dex-num">#${i.toString().padStart(3, '0')}</div><div class="dex-name">???</div>`;
               grid.appendChild(slot);
               continue;
          }

          // Known Pokemon
          // Need name, we can try to get it from saveManager helper if available, or just ID
          // Usually UI.js has getPokemonName(id)
          let name = `Pokémon ${i}`;
          if (this.ui && typeof this.ui.getPokemonName === 'function') {
              name = this.ui.getPokemonName(i);
          }
          if (!name || name === 'undefined') {
               name = `Pokémon ${i}`; 
          }
          
          const slot = document.createElement('div');
          slot.className = `pokedex-slot ${isCaught ? 'caught' : 'seen'}`;
          slot.innerHTML = `
            <div class="dex-num">#${i.toString().padStart(3, '0')}</div>
            <div class="dex-sprite" style="${this.ui.getPokemonSpriteStyle(i)} transform: scale(0.7);"></div>
            <div class="dex-name">${name}</div>
            ${isCaught ? '<span class="material-symbols-rounded caught-icon" style="color:#FFD700; text-shadow:0 0 5px black;">check_circle</span>' : ''}
          `;
          
          grid.appendChild(slot);
      }
  }
}
