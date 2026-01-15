/**
 * ModernBagUI.js - Interface de sac moderne
 */

export class ModernBagUI {
  constructor(uiManager) {
    this.ui = uiManager;
    this.isVisible = false;
    this.currentTab = 'items'; // items, medicine, balls, key
    
    // Config des catégories
    this.categories = {
      items: { icon: 'backpack', label: 'Objets' },
      medicine: { icon: 'medication', label: 'Soins' },
      balls: { icon: 'sports_baseball', label: 'Pokéballs' },
      key: { icon: 'key', label: 'Objets Rares' }
    };
    
    this.createUI();
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'modern-bag-ui';
    this.container.className = 'modern-menu-overlay modern-ui';
    this.container.style.display = 'none';
    
    this.container.innerHTML = `
      <div class="modern-menu-container theme-yellow">
        <div class="modern-menu-header">
          <div class="modern-menu-title">
            <span class="material-symbols-rounded">backpack</span>
            SAC À DOS
          </div>
          <button class="modern-close-btn">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
        
        <div class="modern-bag-layout">
          <!-- Sidebar Catégories -->
          <div class="modern-bag-sidebar glass">
            ${Object.entries(this.categories).map(([key, data]) => `
              <button class="bag-category-btn ${key === this.currentTab ? 'active' : ''}" data-tab="${key}">
                <span class="material-symbols-rounded">${data.icon}</span>
                ${data.label}
              </button>
            `).join('')}
          </div>
          
          <!-- Contenu Grille -->
          <div class="modern-bag-content">
            <div class="modern-bag-grid" id="modern-bag-grid">
              <!-- Items injectés ici -->
            </div>
          </div>
          
          <!-- Détails Item -->
          <div class="modern-bag-details glass">
            <div class="empty-details" id="bag-item-details">
              <span class="material-symbols-rounded">touch_app</span>
              <span>Sélectionne un objet</span>
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
    
    this.container.querySelectorAll('.bag-category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });
  }

  switchTab(tab) {
    this.currentTab = tab;
    
    // Update active button
    this.container.querySelectorAll('.bag-category-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    this.updateGrid();
  }

  show() {
    this.updateGrid();
    this.container.classList.add('visible');
    this.isVisible = true;

    if (document.exitPointerLock) {
        document.exitPointerLock();
    }

    if (this.ui.tutorialSystem) {
        this.ui.tutorialSystem.showIfNotSeen('bag');
    }
  }

  hide() {
    this.container.classList.remove('visible');
    this.isVisible = false;
  }

  updateGrid() {
    const grid = document.getElementById('modern-bag-grid');
    grid.innerHTML = '';
    
    const bag = this.ui.playerData.bag;
    const itemConfig = this.ui.getItemConfig();
    
    // Filtrage simple pour l'instant (tout dans items sauf classification future)
    // TODO: Implémenter une vraie classification dans UI.js ou ici
    // Pour l'instant on affiche tout si tab == items, sinon vide (à améliorer)
    
    // Mapping temporaire des types d'items pour la démo
    const typeMapping = {
      pokeball: 'balls', superball: 'balls', hyperball: 'balls', masterball: 'balls',
      potion: 'medicine', super_potion: 'medicine', hyper_potion: 'medicine', potion_max: 'medicine',
      rappel: 'medicine', rappel_max: 'medicine', total_soin: 'medicine',
      antidote: 'medicine',
      // Le reste dans items
    };

    let hasItems = false;
    
    for (const [key, count] of Object.entries(bag)) {
      if (count <= 0) continue;
      
      const config = itemConfig[key];
      if (!config) continue;
      
      // Determine category (default to items)
      const category = typeMapping[key] || 'items';
      
      // Filter
      if (category !== this.currentTab && !(this.currentTab === 'items' && category === 'items')) {
          // Si on est dans balls et l'item n'est pas balls, skip
          if (this.currentTab !== category) continue;
      }
      
      hasItems = true;

      const card = document.createElement('div');
      card.className = 'modern-item-card glass';
      
      card.innerHTML = `
        <div class="modern-item-icon" style="${this.ui.getItemSpriteStyle(config.spriteIndex)} transform: scale(1);"></div>
        <div class="modern-item-info">
          <div class="modern-item-name">${config ? config.name : itemKey}</div>
          <div class="modern-item-count">x${count}</div>
        </div>
      `;
      
      card.addEventListener('click', () => this.showItemDetails(key, config, count));
      grid.appendChild(card);
    }
    
    if (!hasItems) {
      grid.innerHTML = '<div class="empty-message">Aucun objet dans cette poche</div>';
    }
  }

  showItemDetails(key, config, count) {
    const container = document.getElementById('bag-item-details');
    
    container.innerHTML = `
      <div class="details-header" style="border: none; padding-bottom: 0;">
         <div class="modern-item-icon large" style="${this.ui.getItemSpriteStyle(config.spriteIndex)} transform: scale(2);"></div>
         <div class="details-info">
            <h2>${config.name}</h2>
            <div class="details-sub">Quantité: ${count}</div>
         </div>
      </div>
      
      <div class="item-description glass-light" style="padding: 16px; border-radius: 8px; margin: 20px 0;">
        Un objet très utile pour votre aventure.
      </div>
      
      <div class="details-actions">
        <button class="modern-btn modern-btn-primary" id="btn-use-item">
            <span class="material-symbols-rounded">play_arrow</span> UTILISER
        </button>
         <button class="modern-btn modern-btn-secondary" style="margin-top: 10px;">
            <span class="material-symbols-rounded">delete</span> JETER
        </button>
      </div>
    `;

    container.querySelector('#btn-use-item').onclick = () => {
        this.ui.useItem(key);
        // Refresh handled by events usually, but simplistic here
        this.updateGrid();
    };
  }
}
