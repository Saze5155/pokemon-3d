/**
 * ModernStorageUI.js - Interface de stockage PC moderne
 */

export class ModernStorageUI {
  constructor(uiManager) {
    this.ui = uiManager;
    this.isVisible = false;
    this.selectedTeamSlot = null;
    this.selectedPCSlot = null;
    
    this.createUI();
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'modern-storage-ui';
    this.container.className = 'modern-menu-overlay modern-ui';
    this.container.style.display = 'none';
    
    this.container.innerHTML = `
      <div class="modern-menu-container theme-purple" style="max-width: 1100px;">
        <div class="modern-menu-header">
          <div class="modern-menu-title">
            <span class="material-symbols-rounded">inventory_2</span>
            STOCKAGE POKÉMON
          </div>
          <button class="modern-close-btn">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
        
        <div class="modern-storage-content">
          <!-- Colonne Équipe -->
          <div class="storage-column team-column">
            <div class="storage-column-header">
                <span class="material-symbols-rounded">group</span> ÉQUIPE
            </div>
            <div class="storage-grid team-grid" id="storage-team-grid">
                <!-- Slots équipe -->
            </div>
          </div>

          <!-- Colonne Actions -->
          <div class="storage-actions">
            <button class="modern-btn modern-btn-secondary" id="btn-storage-deposit">
                <span class="material-symbols-rounded">arrow_forward</span>
                DÉPOSER
            </button>
            <button class="modern-btn modern-btn-secondary" id="btn-storage-withdraw">
                <span class="material-symbols-rounded">arrow_back</span>
                RETIRER
            </button>
          </div>

          <!-- Colonne PC -->
          <div class="storage-column pc-column">
            <div class="storage-column-header">
                <span class="material-symbols-rounded">dns</span> BOÎTE 1
            </div>
            <div class="storage-grid pc-grid" id="storage-pc-grid">
                <!-- Slots PC -->
            </div>
          </div>
        </div>
        
        <div class="modern-storage-footer">
            <div id="storage-selection-info">
                Sélectionnez un Pokémon pour le déplacer
            </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.container);
    
    // Events
    this.container.querySelector('.modern-close-btn').addEventListener('click', () => {
      this.ui.closeAllMenus();
    });

    this.container.querySelector('#btn-storage-deposit').addEventListener('click', () => this.depositPokemon());
    this.container.querySelector('#btn-storage-withdraw').addEventListener('click', () => this.withdrawPokemon());
  }

  show() {
    this.selectedTeamSlot = null;
    this.selectedPCSlot = null;
    this.render();
    this.container.classList.add('visible');
    this.isVisible = true;

    if (document.exitPointerLock) {
        document.exitPointerLock();
    }
  }

  hide() {
    this.container.classList.remove('visible');
    this.isVisible = false;
  }

  render() {
      this.renderTeam();
      this.renderPC();
      this.updateButtons();
  }

  renderTeam() {
      const grid = document.getElementById('storage-team-grid');
      grid.innerHTML = '';
      
      const teamIds = this.ui.saveManager.saveData.equipe;

      // 6 Slots fixes
      for(let i=0; i<6; i++) {
          const pId = teamIds[i];
          const pokemon = pId ? this.ui.saveManager.getPokemon(pId) : null;
          
          const slot = document.createElement('div');
          slot.className = `storage-slot ${this.selectedTeamSlot === i ? 'selected' : ''}`;
          if (!pokemon) slot.classList.add('empty');
          
          if (pokemon) {
              slot.innerHTML = `
                <div class="storage-sprite" style="${this.ui.getPokemonSpriteStyle(pokemon.speciesId)} transform: scale(0.6);"></div>
                <div class="storage-name">${pokemon.surnom || pokemon.name || '???'}</div>
                <div class="storage-level">Niv. ${pokemon.niveau || 1}</div>
              `;
              slot.onclick = () => {
                  this.selectedTeamSlot = (this.selectedTeamSlot === i) ? null : i;
                  if (this.selectedTeamSlot !== null) this.selectedPCSlot = null; // Deselect other side
                  this.render();
              };
          } else {
             slot.innerHTML = `<span class="material-symbols-rounded empty-icon">add</span>`;
          }
          
          grid.appendChild(slot);
      }
  }

  renderPC() {
      const grid = document.getElementById('storage-pc-grid');
      grid.innerHTML = '';
      
      const pcIds = this.ui.saveManager.saveData.pc || [];
      const MAX_PC_SLOTS = 30; // 1 Boîte pour l'instant

      for(let i=0; i<MAX_PC_SLOTS; i++) {
          const pId = pcIds[i];
          const pokemon = pId ? this.ui.saveManager.getPokemon(pId) : null;
          
          const slot = document.createElement('div');
          slot.className = `storage-slot mini ${this.selectedPCSlot === i ? 'selected' : ''}`;
          if (!pokemon) slot.classList.add('empty');

          if (pokemon) {
              slot.innerHTML = `
                <div class="storage-sprite" style="${this.ui.getPokemonSpriteStyle(pokemon.speciesId)} transform: scale(0.5);"></div>
              `;
              slot.title = pokemon.surnom || pokemon.name;
              slot.onclick = () => {
                  this.selectedPCSlot = (this.selectedPCSlot === i) ? null : i;
                  if (this.selectedPCSlot !== null) this.selectedTeamSlot = null; // Deselect other side
                  this.render();
              };
          } else {
              // Empty slot logic if needed
          }

          grid.appendChild(slot);
      }
  }

  updateButtons() {
      const btnDeposit = document.getElementById('btn-storage-deposit');
      const btnWithdraw = document.getElementById('btn-storage-withdraw');
      const info = document.getElementById('storage-selection-info');

      btnDeposit.disabled = this.selectedTeamSlot === null;
      btnWithdraw.disabled = this.selectedPCSlot === null;

      if (this.selectedTeamSlot !== null) {
          const pId = this.ui.saveManager.saveData.equipe[this.selectedTeamSlot];
          const p = this.ui.saveManager.getPokemon(pId);
          info.innerHTML = `Déposer <b>${p.surnom || p.name}</b> dans le PC ?`;
      } else if (this.selectedPCSlot !== null) {
          const pcIds = this.ui.saveManager.saveData.pc || [];
          const pId = pcIds[this.selectedPCSlot];
          const p = this.ui.saveManager.getPokemon(pId);
          info.innerHTML = `Retirer <b>${p.surnom || p.name}</b> vers l'équipe ?`;
      } else {
          info.innerHTML = "Sélectionnez un Pokémon";
      }
  }

  depositPokemon() {
      if (this.selectedTeamSlot === null) return;
      const teamIds = this.ui.saveManager.saveData.equipe;
      const teamId = teamIds[this.selectedTeamSlot];

      // Vérifier dernier pokemon
      const teamCount = teamIds.filter(id => id !== null && id !== undefined).length;
      if (teamCount <= 1) {
          if (this.ui.modernHUD) this.ui.modernHUD.showNotification("Impossible de retirer le dernier Pokémon !", "error");
          return;
      }

      this.ui.saveManager.addToPC(teamId);
      this.ui.saveManager.removeFromTeam(teamId);
      this.ui.saveManager.save();
      
      this.selectedTeamSlot = null;
      this.render();
      if (this.ui.modernHUD) this.ui.modernHUD.showNotification("Pokémon déposé !", "success");
  }

  withdrawPokemon() {
      if (this.selectedPCSlot === null) return;
      const pcIds = this.ui.saveManager.saveData.pc || [];
      const pcId = pcIds[this.selectedPCSlot];

      if (this.ui.saveManager.addToTeam(pcId)) {
          this.ui.saveManager.removeFromPC(pcId);
          this.ui.saveManager.save();
          this.selectedPCSlot = null;
          this.render();
          if (this.ui.modernHUD) this.ui.modernHUD.showNotification("Pokémon retiré !", "success");
      } else {
          if (this.ui.modernHUD) this.ui.modernHUD.showNotification("Équipe pleine !", "error");
      }
  }
}
