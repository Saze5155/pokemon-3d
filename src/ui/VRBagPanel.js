import { VRMenuPanel } from './VRMenuPanel.js';

export class VRBagPanel extends VRMenuPanel {
  constructor(game) {
    super(game, 1024, 768);
    
    this.currentTab = 'items'; // balls, medicine, items, key
    this.selectedItem = null;
    
    // Config des onglets
    this.tabs = [
      { id: 'balls', label: 'Balls', icon: '⚾' },
      { id: 'medicine', label: 'Soins', icon: '💊' },
      { id: 'items', label: 'Objets', icon: '🎒' },
      { id: 'key', label: 'Clés', icon: '🔑' }
    ];
  }
  
  draw() {
    const ctx = this.ctx;
    
    // Fond général
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Header
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(0, 0, this.width, 80);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SAC À DOS', this.width / 2, 55);
    
    // Reset buttons
    this.buttons = [];
    
    // Dessiner les onglets (Sidebar gauche)
    this.drawSidebar();
    
    // Dessiner la grille d'objets
    this.drawGrid();
    
    // Dessiner les détails de l'objet sélectionné
    if (this.selectedItem) {
      this.drawItemDetails();
    }
    
    // Bouton Fermer
    const closeBtn = {
      x: this.width - 160,
      y: 15,
      w: 140,
      h: 50,
      label: 'FERMER',
      action: () => this.hide()
    };
    
    // Dessiner bouton fermer custom pour le header
    const isHovered = this.hoveredButton === closeBtn;
    ctx.fillStyle = isHovered ? '#ff4444' : '#aa0000';
    this.roundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 10, true, false);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(closeBtn.label, closeBtn.x + closeBtn.w / 2, closeBtn.y + 35);
    
    this.buttons.push(closeBtn);
    
    this.texture.needsUpdate = true;
  }
  
  drawSidebar() {
    const ctx = this.ctx;
    const startY = 100;
    const tabHeight = 100;
    const tabWidth = 200;
    
    // Fond sidebar
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 80, tabWidth, this.height - 80);
    
    this.tabs.forEach((tab, index) => {
      const y = startY + index * (tabHeight + 10);
      const isActive = this.currentTab === tab.id;
      const isHovered = this.hoveredButton?.id === `tab_${tab.id}`;
      
      const btn = {
        id: `tab_${tab.id}`,
        x: 10,
        y: y,
        w: tabWidth - 20,
        h: tabHeight,
        action: () => {
          this.currentTab = tab.id;
          this.selectedItem = null;
          this.draw();
        }
      };
      
      // Fond onglet
      if (isActive) {
        ctx.fillStyle = '#cc0000';
      } else if (isHovered) {
        ctx.fillStyle = '#2a2a4e';
      } else {
        ctx.fillStyle = '#1f1f35';
      }
      
      this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10, true, false);
      
      // Icône et Texte
      ctx.fillStyle = '#fff';
      ctx.font = '40px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(tab.icon, btn.x + btn.w / 2, btn.y + 45);
      
      ctx.font = 'bold 20px Arial';
      ctx.fillText(tab.label, btn.x + btn.w / 2, btn.y + 80);
      
      this.buttons.push(btn);
    });
  }
  
  drawGrid() {
    // Récupérer les items selon l'onglet
    const items = this.getItemsForTab(this.currentTab);
    
    const startX = 220;
    const startY = 100;
    const gridW = this.width - startX - 20; // 20px margin right
    const gridH = this.height - startY - 200; // Leave space for details
    
    // Fond grille
    this.ctx.fillStyle = '#1f1f35';
    this.roundRect(this.ctx, startX, startY, gridW, gridH, 10, true, false);
    
    if (items.length === 0) {
      this.ctx.fillStyle = '#666';
      this.ctx.font = '30px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText("Sac vide", startX + gridW / 2, startY + gridH / 2);
      return;
    }
    
    // Grille 4 colonnes
    const cols = 4;
    const itemSize = 130;
    const gap = 20;
    
    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      const x = startX + 40 + col * (itemSize + gap); // 40px padding left
      const y = startY + 40 + row * (itemSize + gap);
      
      if (y + itemSize > startY + gridH) return; // Ne pas dessiner si dépasse (TODO: Scroll)
      
      const btn = {
        x, y, 
        w: itemSize, h: itemSize,
        label: item.name,
        action: () => {
          this.selectedItem = item;
          this.draw();
        }
      };
      
      const isSelected = this.selectedItem && this.selectedItem.id === item.id;
      const isHovered = this.hoveredButton?.label === item.name;
      
      // Fond item
      this.ctx.fillStyle = isSelected ? '#cc0000' : (isHovered ? '#333355' : '#252540');
      this.roundRect(this.ctx, x, y, itemSize, itemSize, 10, true, false);
      
      // Icône (cercle placeholder ou sprite)
      const centerX = x + itemSize / 2;
      const centerY = y + itemSize / 2 - 20;
      
      this.ctx.fillStyle = '#fff';
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Texte quantité
      this.ctx.fillStyle = '#ffd700';
      this.ctx.font = 'bold 20px monospace';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(`x${item.count}`, x + itemSize - 10, y + 30);
      
      // Nom
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 16px Arial';
      this.ctx.textAlign = 'center';
      
       // Tronquer si trop long
      let name = item.name;
      if (name.length > 12) name = name.substring(0, 10) + '..';
      this.ctx.fillText(name, centerX, y + itemSize - 15);
      
      this.buttons.push(btn);
    });
  }
  
  drawItemDetails() {
    const item = this.selectedItem;
    const h = 180;
    const y = this.height - h - 10;
    const x = 220; // Aligné avec grille
    const w = this.width - x - 20;
    
    // Fond
    this.ctx.fillStyle = '#252540';
    this.roundRect(this.ctx, x, y, w, h, 10, true, false);
    
    // Nom
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 36px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(item.name, x + 30, y + 50);
    
    // Description (Simulation)
    this.ctx.fillStyle = '#aaa';
    this.ctx.font = 'italic 24px Arial';
    this.ctx.fillText("Un objet très utile pour l'aventure.", x + 30, y + 90);
    
    // Action: Utiliser (si applicable)
    // TODO: Implémenter utilisation
    const useBtn = {
      x: x + w - 200,
      y: y + 50,
      w: 160,
      h: 60,
      label: 'UTILISER',
      action: () => console.log('Utiliser', item.id)
    };
    
    const isHovered = this.hoveredButton === useBtn;
    this.ctx.fillStyle = isHovered ? '#4ade80' : '#22c55e';
    this.roundRect(this.ctx, useBtn.x, useBtn.y, useBtn.w, useBtn.h, 10, true, false);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 22px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(useBtn.label, useBtn.x + useBtn.w / 2, useBtn.y + 40);
    
    this.buttons.push(useBtn);
  }
  
  getItemsForTab(tab) {
    if (!this.game.saveManager || !this.game.saveManager.saveData || !this.game.saveManager.saveData.sac) {
      return [];
    }
    
    const sac = this.game.saveManager.saveData.sac;
    const items = [];
    
    // Mapping VR Tab -> SaveManager Categories
    const categories = [];
    
    if (tab === 'balls') categories.push('pokeballs');
    if (tab === 'medicine') categories.push('soins', 'boosts', 'boosts_combat', 'repousses');
    if (tab === 'items') categories.push('pierres', 'peche', 'divers');
    if (tab === 'key') {
      // Cas spécial pour les clés (array de strings)
      if (sac.cles) {
         sac.cles.forEach(key => {
           items.push({ id: key, name: key, count: 1, type: 'key' });
         });
      }
      return items;
    }
    
    // Parcourir les catégories mappées
    categories.forEach(cat => {
      if (sac[cat]) {
        Object.entries(sac[cat]).forEach(([id, count]) => {
          if (count > 0) {
            // TODO: Récupérer le vrai nom depuis itemsDatabase si possible
            items.push({ id, name: id, count, type: cat });
          }
        });
      }
    });
    
    return items;
  }
}
