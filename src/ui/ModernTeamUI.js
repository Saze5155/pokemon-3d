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
    this.container.className = 'modern-menu-overlay modern-ui';
    this.container.style.display = 'none'; // Géré par CSS class .visible
    
    this.container.innerHTML = `
      <div class="modern-menu-container theme-blue">
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
          
          <div class="modern-team-stats" id="modern-team-details">
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

    // Tuto
    if (this.ui.tutorialSystem) {
        this.ui.tutorialSystem.showIfNotSeen('team');
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
      card.className = 'modern-pokemon-card';
      
      const currentHp = (pokemon.hp !== undefined) ? pokemon.hp : (pokemon.stats?.hp || 0);
      const maxHp = pokemon.stats?.hp || pokemon.maxHp || 1;
      const hpPercent = (currentHp / maxHp) * 100;
      const hpColor = hpPercent > 50 ? 'var(--success)' : hpPercent > 20 ? 'var(--warning)' : 'var(--danger)';
      
      const spriteStyle = this.ui.getPokemonSpriteStyle(pokemon.speciesId || pokemon.id);
      
      card.innerHTML = `
        <div class="modern-pokemon-sprite" style="${spriteStyle} transform: scale(0.8);"></div>
        <div class="modern-pokemon-info">
          <div class="modern-pokemon-name">${pokemon.surnom || pokemon.name || '???'}</div>
          <div class="modern-pokemon-level">Niv. ${pokemon.level || pokemon.niveau || 1}</div>
          <div class="modern-hp-bar-container">
            <div class="modern-hp-text">PV ${currentHp}/${maxHp}</div>
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
    const hpPercent = (pokemon.hp / pokemon.stats.hp) * 100;
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
                <div class="stat-value">${pokemon.stats?.attack || 0}</div>
            </div>
             <div class="stat-item">
                <label>DEF</label>
                <div class="stat-value">${pokemon.stats?.defense || 0}</div>
            </div>
             <div class="stat-item">
                <label>VIT</label>
                <div class="stat-value">${pokemon.stats?.speed || 0}</div>
            </div>
             <div class="stat-item">
                <label>SPÉ</label>
                <div class="stat-value">${pokemon.stats?.special || 0}</div>
            </div>
        </div>
      </div>

      <div class="details-moves">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3>Attaques</h3>
        </div>
        <div class="moves-list">
            ${(pokemon.attaques || []).map((move, index) => `
                <div class="move-item glass">
                    <span class="move-name">${move || '---'}</span>
                </div>
            `).join('')}
        </div>
      </div>

      <div class="details-actions">
         <button class="modern-btn modern-btn-primary" id="btn-manage-moves">
            <span class="material-symbols-rounded">edit_note</span> Gérer les attaques
         </button>
      </div>
    `;

    // Events
    const btn = details.querySelector('#btn-manage-moves');
    if (btn) {
        btn.addEventListener('click', () => this.showMoveRelearner(pokemon));
    }
  }

  showMoveRelearner(pokemon) {
      console.log("Opening Move Relearner for", pokemon);
      // 1. Récupérer l'arbre généalogique
      const speciesId = parseInt(pokemon.speciesId || pokemon.id);
      const level = pokemon.niveau || pokemon.level || 1;
      const movesetDB = this.ui.saveManager?.movesetDatabase;
      
      console.log("DB & Info:", { speciesId, level, hasDB: !!movesetDB });
      
      // FIX EXPERIMENTAL: Recalculer le niveau si l'XP semble incohérente (Bug Level 5 vs 80k XP)
      let effectiveLevel = level;
      if (pokemon.xp > 5000 && level < 10) {
          // Estimation brute pour "Parabolique" (Medium Slow - Starters)
          // Niv 40 ~ 53k, Niv 45 ~ 76k, Niv 50 ~ 105k
          // Si 80k, alors ~45
          // On fait une boucle simple
          for(let l=1; l<=100; l++) {
               const xpReq = (1.2 * Math.pow(l, 3)) - (15 * Math.pow(l, 2)) + (100 * l) - 140;
               if (pokemon.xp < xpReq) {
                   effectiveLevel = l - 1;
                   break;
               }
          }
          console.log(`[MoveRelearner] Niveau corrigé via XP: ${level} -> ${effectiveLevel}`);
      }

      let pool = new Set();
      
      // Fonction helper pour collecter les moves
      const collectMoves = (id) => {
          if (movesetDB && movesetDB[id] && movesetDB[id].attaquesParNiveau) {
             const table = movesetDB[id].attaquesParNiveau;
             for (const [lvlStr, moves] of Object.entries(table)) {
                  if (parseInt(lvlStr) <= effectiveLevel) {
                      moves.forEach(m => pool.add(m));
                  }
             }
          }
      };

      // 1. Collecter pour l'espèce actuelle
      collectMoves(speciesId);
      
      // 2. Collecter pour les pré-évolutions (Si SaveManager dispo)
      if (this.ui.saveManager && this.ui.saveManager.getPreEvolutions) {
          const ancestors = this.ui.saveManager.getPreEvolutions(speciesId);
          ancestors.forEach(id => collectMoves(id));
      }
      
      // 3. Ajouter les attaques actuelles
      pokemon.attaques.forEach(m => { if(m) pool.add(m)});
      
      // Convertir en tableau
      const allMoves = Array.from(pool).sort();
      const currentMoves = [...pokemon.attaques]; // Clone
      
      // Créer la modale Design
      const modal = document.createElement('div');
      modal.className = 'modern-modal-overlay';
      modal.innerHTML = `
        <div class="modern-modal card glass-dark slide-up-anim" style="width: 750px; max-width: 95vw; height: 600px; display: flex; flex-direction: column;">
            <div class="modern-modal-header" style="flex-shrink: 0; padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span class="material-symbols-rounded" style="font-size: 32px; color: var(--accent);">history_edu</span>
                    <div>
                        <h3 style="margin: 0; font-size: 1.5em; text-transform: uppercase; letter-spacing: 1px;">Maitre des Capacités</h3>
                        <div style="font-size: 0.9em; opacity: 0.7;">Personnalisez les attaques de ${pokemon.surnom || pokemon.name} (Niv. ${effectiveLevel})</div>
                    </div>
                </div>
                <button class="close-modal icon-btn"><span class="material-symbols-rounded">close</span></button>
            </div>
            
            <div class="modern-modal-body" style="flex: 1; overflow: hidden; padding: 0;">
                <div class="move-manager-layout">
                    <!-- COLONNE GAUCHE: ACTIVES -->
                    <div class="move-panel active-panel">
                        <div class="panel-header">
                            <span class="material-symbols-rounded">bolt</span>
                            <h4>Attaques Équipées</h4>
                            <span class="count-badge" id="active-count">0/4</span>
                        </div>
                        <div class="move-list-vertical" id="active-moves-list"></div>
                        <div class="panel-hint">Cliquez pour retirer</div>
                    </div>

                    <!-- COLONNE DROITE: POOL -->
                    <div class="move-panel pool-panel">
                        <div class="panel-header">
                            <span class="material-symbols-rounded">library_books</span>
                            <h4>Bibliothèque de Capacités</h4>
                        </div>
                        <div class="search-bar-container">
                             <span class="material-symbols-rounded">search</span>
                             <input type="text" id="move-search" placeholder="Rechercher une attaque...">
                        </div>
                        <div class="move-grid-pool custom-scrollbar" id="pool-moves-list"></div>
                    </div>
                </div>
            </div>

            <div class="modern-modal-footer" style="flex-shrink: 0; padding: 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: flex-end; gap: 15px;">
                <button class="modern-btn modern-btn-secondary close-modal">Annuler</button>
                <button class="modern-btn modern-btn-primary" id="save-moves-btn">
                    <span class="material-symbols-rounded">save</span>
                    Sauvegarder
                </button>
            </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // CSS Injection
      if (!document.getElementById('move-manager-css-v3')) {
          const style = document.createElement('style');
          style.id = 'move-manager-css-v3';
          style.textContent = `
              .modern-modal-overlay { 
                  position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                  z-index: 99999 !important; 
                  background: rgba(0, 0, 0, 0.85); 
                  backdrop-filter: blur(5px);
                  display: flex; justify-content: center; align-items: center; 
              }
              
              .modern-modal.card {
                  background: #1e293b; /* Solid dark blue-grey */
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                  color: #e2e8f0;
                  font-family: 'Inter', sans-serif;
              }

              .modern-modal-header {
                  background: rgba(15, 23, 42, 0.5);
                  border-bottom: 1px solid rgba(255,255,255,0.05);
              }

              .move-manager-layout { display: flex; height: 100%; background: #0f172a; }
              
              .move-panel { display: flex; flex-direction: column; padding: 20px; }
              
              .active-panel { 
                  width: 350px; 
                  background: #1e293b; 
                  border-right: 1px solid rgba(255,255,255,0.05); 
              }
              
              .pool-panel { 
                  flex: 1; 
                  background: #0f172a; 
              }
              
              .panel-header { 
                  display: flex; align-items: center; gap: 12px; margin-bottom: 25px; 
                  color: #94a3b8; letter-spacing: 0.5px; font-weight: 600; font-size: 0.9em; text-transform: uppercase;
              }
              .panel-header .material-symbols-rounded { color: var(--primary, #6366f1); }
              
              .move-list-vertical { display: flex; flex-direction: column; gap: 15px; }
              
              .move-card {
                  background: #334155;
                  border: 1px solid transparent;
                  border-radius: 12px;
                  padding: 16px;
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              }
              .move-card:hover {
                  background: #475569;
                  transform: translateY(-2px);
                  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
                  border-color: rgba(255,255,255,0.1);
              }
              .move-card .move-name-lg { color: white; font-weight: 600; font-size: 1.1em; }
              
              .move-card.empty {
                  background: transparent;
                  border: 2px dashed #475569;
                  box-shadow: none;
                  color: #64748b;
                  height: 60px;
                  justify-content: center;
              }
              .move-card.empty:hover {
                  border-color: #94a3b8;
                  color: #94a3b8;
                  background: rgba(255,255,255,0.02);
              }

              /* Pool Grid */
              .move-grid-pool {
                  display: grid;
                  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                  gap: 12px;
                  padding: 5px;
                  overflow-y: auto;
              }
              
              .pool-item {
                  background: #1e293b;
                  border-radius: 8px;
                  padding: 12px 15px;
                  cursor: pointer;
                  transition: all 0.15s;
                  border: 1px solid rgba(255,255,255,0.05);
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  color: #cbd5e1;
                  font-weight: 500;
              }
              .pool-item:hover {
                  background: #334155;
                  border-color: var(--primary, #6366f1);
                  color: white;
              }
              .pool-item .material-symbols-rounded { font-size: 18px; color: #64748b; }
              
              .pool-item.equipped {
                  background: #0f172a;
                  opacity: 0.4;
                  pointer-events: none;
                  border: 1px solid transparent;
              }
              
              /* Search */
              .search-bar-container {
                  background: #1e293b;
                  border: 1px solid rgba(255,255,255,0.05);
                  border-radius: 8px;
                  padding: 10px 16px;
                  display: flex; align-items: center; gap: 10px;
                  margin-bottom: 20px;
              }
              .search-bar-container input {
                  background: transparent; border: none; color: white; outline: none; width: 100%; font-size: 0.95em;
              }
              .search-bar-container:focus-within {
                  border-color: var(--primary, #6366f1);
                  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
              }

              .panel-hint { color: #64748b; text-align: center; margin-top: auto; padding-top: 20px; font-size: 0.85em; }

              /* Scrollbar */
              .custom-scrollbar::-webkit-scrollbar { width: 6px; }
              .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }

              @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
              .slide-up-anim { animation: slideUp 0.25s cubic-bezier(0.2, 0, 0.2, 1); }
          `;
          document.head.appendChild(style);
      }
      
      let tempMoves = [...currentMoves];
      while(tempMoves.length < 4) tempMoves.push(null);
      
      const render = (filter = "") => {
          const activeList = modal.querySelector('#active-moves-list');
          const poolList = modal.querySelector('#pool-moves-list');
          const activeCount = modal.querySelector('#active-count');
          
          activeList.innerHTML = '';
          poolList.innerHTML = '';
          
          activeCount.textContent = `${tempMoves.filter(m => m).length}/4`;
          
          // Render Equiped Slots
          tempMoves.forEach((move, idx) => {
              const div = document.createElement('div');
              if (move) {
                  div.className = 'move-card';
                  div.innerHTML = `
                      <div class="move-info">
                          <span class="move-name-lg">${move}</span>
                          <div class="move-meta">
                             <span>PP ???</span>
                          </div>
                      </div>
                      <span class="material-symbols-rounded" style="color: var(--danger);">remove_circle</span>
                  `;
                  div.onclick = () => {
                      // Remove
                      tempMoves[idx] = null;
                      render(filter);
                  };
              } else {
                  div.className = 'move-card empty';
                  div.innerHTML = `
                      <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                          <span class="material-symbols-rounded">add_circle</span>
                          <span>Emplacement vide</span>
                      </div>
                  `;
              }
              activeList.appendChild(div);
          });
          
          // Render Pool
          allMoves.forEach(move => {
              if (filter && !move.toLowerCase().includes(filter.toLowerCase())) return;
              
              const isEquipped = tempMoves.includes(move);
              
              const div = document.createElement('div');
              div.className = `pool-item ${isEquipped ? 'equipped' : ''}`;
              div.innerHTML = `
                  <span class="material-symbols-rounded">swords</span>
                  <span>${move}</span>
              `;
              
              if (!isEquipped) {
                 div.onclick = () => {
                     // Find first empty
                     const emptyIdx = tempMoves.findIndex(m => m === null);
                     if (emptyIdx !== -1) {
                         tempMoves[emptyIdx] = move;
                         render(filter);
                         
                         // Feedback sound or animation could go here
                     } else {
                         // Shake UI?
                         alert("Pas de place ! Retirez une attaque d'abord.");
                     }
                 };
              }
              
              poolList.appendChild(div);
          });
      };
      
      render();
      
      // Filter Event
      modal.querySelector('#move-search').addEventListener('input', (e) => {
          render(e.target.value);
      });
      
      // Close Events
      const close = () => { modal.remove(); };
      modal.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', close));
      
      // Save Event
      modal.querySelector('#save-moves-btn').addEventListener('click', () => {
         const finalMoves = tempMoves.filter(m => m !== null);
         if (finalMoves.length === 0) {
             alert("Un Pokémon doit avoir au moins une attaque !");
             return;
         }
         
         pokemon.attaques = finalMoves;
         
         // Update SaveManager Logic
         if (this.ui.saveManager) {
             const newPP = [];
             const newMax = [];
             
             finalMoves.forEach((m, i) => {
                 // Intelligent PP preservation: if move was already equipped at index J, keep its PP?
                 // Or simple approach: reset to max.
                 newMax[i] = this.ui.saveManager.getMovePP(m);
                 newPP[i] = newMax[i]; 
             });
             
             pokemon.ppActuels = newPP;
             pokemon.ppMax = newMax;
             
             this.ui.saveManager.save();
             this.ui.showNotification("Capacités mises à jour !");
         }
         
         this.showPokemonDetails(pokemon);
         close();
      });
  }
}
