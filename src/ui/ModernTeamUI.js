/**
 * ModernTeamUI.js - Interface d'équipe moderne
 */

export class ModernTeamUI {
  constructor(uiManager) {
    this.ui = uiManager;
    this.isVisible = false;
    
    // Créer l'interface
    this.createUI();
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'modern-team-ui';
    this.container.className = 'menu-screen modern-ui';
    this.container.style.display = 'none'; // Géré par CSS class .visible
    
    this.container.innerHTML = `
      <div class="modern-menu-container glass-dark">
        <div class="modern-menu-header">
          <div class="modern-menu-title">
            <span class="material-symbols-rounded">group</span>
            ÉQUIPE POKÉMON
          </div>
          <button class="modern-close-btn">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
        
        <div class="modern-team-content">
          <div class="modern-team-grid" id="modern-team-grid">
            <!-- Pokémon cards injectées ici -->
          </div>
          
          <div class="modern-team-stats glass" id="modern-team-details">
            <div class="empty-details">
              <span class="material-symbols-rounded">touch_app</span>
              <span>Sélectionne un Pokémon pour voir les détails</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.container);
    
    // Events
    this.container.querySelector('.modern-close-btn').addEventListener('click', () => {
      this.ui.closeAllMenus();
    });
  }

  show() {
    this.updateTeamGrid();
    this.container.classList.add('visible');
    this.isVisible = true;

    // unlock cursor
    if (document.exitPointerLock) {
        document.exitPointerLock();
    }
  }

  hide() {
    this.container.classList.remove('visible');
    this.isVisible = false;
  }

  updateTeamGrid() {
    const grid = document.getElementById('modern-team-grid');
    grid.innerHTML = '';
    
    const team = this.ui.playerData.team;
    
    if (team.length === 0) {
      grid.innerHTML = '<div class="empty-message">Aucun Pokémon dans l\'équipe</div>';
      return;
    }

    team.forEach((pokemon, index) => {
      if (!pokemon) return;
      
      const card = document.createElement('div');
      card.className = 'modern-pokemon-card glass';
      
      const hpPercent = (pokemon.hp / pokemon.stats.hpMax) * 100;
      const hpColor = hpPercent > 50 ? 'var(--success)' : hpPercent > 20 ? 'var(--warning)' : 'var(--danger)';
      
      const spriteStyle = this.ui.getPokemonSpriteStyle(pokemon.speciesId || pokemon.id);
      
      card.innerHTML = `
        <div class="modern-pokemon-sprite" style="${spriteStyle} transform: scale(0.8);"></div>
        <div class="modern-pokemon-info">
          <div class="modern-pokemon-name">${pokemon.surnom || pokemon.name}</div>
          <div class="modern-pokemon-level">Niv. ${pokemon.level || pokemon.niveau}</div>
          <div class="modern-hp-bar-container">
            <div class="modern-hp-text">PV ${pokemon.hp}/${pokemon.stats.hpMax}</div>
            <div class="modern-hp-bar-bg">
              <div class="modern-hp-bar-fill" style="width: ${hpPercent}%; background: ${hpColor};"></div>
            </div>
          </div>
        </div>
        <div class="modern-pokemon-status">
            ${pokemon.status ? `<span class="status-badge">${pokemon.status}</span>` : ''}
        </div>
        <span class="material-symbols-rounded details-icon">chevron_right</span>
      `;
      
      card.addEventListener('click', () => this.showPokemonDetails(pokemon));
      
      grid.appendChild(card);
    });
  }

  showPokemonDetails(pokemon) {
    const details = document.getElementById('modern-team-details');
    const spriteStyle = this.ui.getPokemonSpriteStyle(pokemon.speciesId || pokemon.id);
    const hpPercent = (pokemon.hp / pokemon.stats.hpMax) * 100;
    const hpColor = hpPercent > 50 ? 'var(--success)' : hpPercent > 20 ? 'var(--warning)' : 'var(--danger)';

    details.innerHTML = `
      <div class="details-header">
        <div class="details-sprite" style="${spriteStyle} transform: scale(1.5);"></div>
        <div class="details-info">
            <h2>${pokemon.surnom || pokemon.name}</h2>
            <div class="details-sub">
                <span class="type-badge">${pokemon.type1 || 'Normal'}</span>
                ${pokemon.type2 ? `<span class="type-badge">${pokemon.type2}</span>` : ''}
            </div>
        </div>
      </div>
      
      <div class="details-stats-container">
        <h3>Statistiques</h3>
        <div class="stat-grid">
            <div class="stat-item">
                <label>ATQ</label>
                <div class="stat-value">${pokemon.stats.attack}</div>
            </div>
             <div class="stat-item">
                <label>DEF</label>
                <div class="stat-value">${pokemon.stats.defense}</div>
            </div>
             <div class="stat-item">
                <label>VIT</label>
                <div class="stat-value">${pokemon.stats.speed}</div>
            </div>
             <div class="stat-item">
                <label>SPÉ</label>
                <div class="stat-value">${pokemon.stats.special}</div>
            </div>
        </div>
      </div>

      <div class="details-moves">
        <h3>Attaques</h3>
        <div class="moves-list">
            ${pokemon.attaques.map(move => `
                <div class="move-item glass">
                    <span class="material-symbols-rounded">swords</span>
                    ${move}
                </div>
            `).join('')}
        </div>
      </div>

      <div class="details-actions">
         <button class="modern-btn modern-btn-primary">
            <span class="material-symbols-rounded">swap_vert</span> Déplacer
         </button>
      </div>
    `;
  }
}
