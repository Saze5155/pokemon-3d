import { VRMenuPanel } from './VRMenuPanel.js';

export class VRShopPanel extends VRMenuPanel {
  constructor(game) {
    super(game, 1024, 768);

    this.currentTab = 'buy'; // buy, sell
    this.selectedItem = null;
    this.quantity = 1;

    // Liste des objets affichés
    this.itemList = [];
    this.scrollOffset = 0;
    this.itemsPerPage = 6;
  }

  show() {
    this.currentTab = 'buy';
    this.selectedItem = null;
    this.quantity = 1;
    this.refreshItemList();
    super.show();
  }

  refreshItemList() {
    const saveManager = this.game?.saveManager;
    if (!saveManager || !saveManager.itemsDatabase) {
      console.warn("[VRShopPanel] SaveManager ou itemsDatabase manquant");
      this.itemList = [];
      return;
    }

    this.itemList = [];

    if (this.currentTab === 'buy') {
      // Mode achat : afficher les objets en vente
      for (const [itemId, itemData] of Object.entries(saveManager.itemsDatabase)) {
        if (itemData.buyPrice && itemData.buyPrice > 0) {
          this.itemList.push({
            id: itemId,
            name: itemData.name,
            description: itemData.description || 'Aucune description',
            price: itemData.buyPrice,
            icon: itemData.icon || '📦',
            type: 'buy'
          });
        }
      }
    } else {
      // Mode vente : afficher l'inventaire du joueur
      const inventory = saveManager.saveData?.joueur?.inventaire || {};
      for (const [itemId, quantity] of Object.entries(inventory)) {
        if (quantity > 0) {
          const itemData = saveManager.itemsDatabase[itemId];
          if (itemData && itemData.sellPrice && itemData.sellPrice > 0) {
            this.itemList.push({
              id: itemId,
              name: itemData.name,
              description: itemData.description || 'Aucune description',
              price: itemData.sellPrice,
              icon: itemData.icon || '📦',
              quantity: quantity,
              type: 'sell'
            });
          }
        }
      }
    }

    // Réinitialiser le scroll et la sélection
    this.scrollOffset = 0;
    this.selectedItem = null;
    this.draw();
  }

  draw() {
    const ctx = this.ctx;

    // Fond général
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.width, this.height);

    // Header avec argent du joueur
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(0, 0, this.width, 80);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BOUTIQUE POKÉMON', this.width / 2, 55);

    // Afficher l'argent
    const money = this.game?.saveManager?.saveData?.joueur?.argent || 0;
    ctx.font = '24px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${money} ₽`, this.width - 180, 50);

    // Reset buttons
    this.buttons = [];

    // Dessiner les onglets
    this.drawTabs();

    // Dessiner la liste d'objets
    this.drawItemList();

    // Dessiner le panneau de détails
    if (this.selectedItem) {
      this.drawDetailsPanel();
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

  drawTabs() {
    const ctx = this.ctx;
    const tabs = [
      { id: 'buy', label: 'ACHETER' },
      { id: 'sell', label: 'VENDRE' }
    ];

    const tabWidth = 200;
    const tabHeight = 60;
    const startX = 50;
    const startY = 100;

    tabs.forEach((tab, index) => {
      const x = startX + index * (tabWidth + 20);
      const isActive = this.currentTab === tab.id;
      const isHovered = this.hoveredButton?.id === `tab_${tab.id}`;

      const btn = {
        id: `tab_${tab.id}`,
        x: x,
        y: startY,
        w: tabWidth,
        h: tabHeight,
        action: () => {
          this.currentTab = tab.id;
          this.refreshItemList();
        }
      };

      // Background
      if (isActive) {
        ctx.fillStyle = '#3366cc';
      } else if (isHovered) {
        ctx.fillStyle = '#2244aa';
      } else {
        ctx.fillStyle = '#16213e';
      }

      this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10, true, false);

      // Bordure si actif
      if (isActive) {
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 3;
        this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10, false, true);
      }

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(tab.label, btn.x + btn.w / 2, btn.y + 40);

      this.buttons.push(btn);
    });
  }

  drawItemList() {
    const ctx = this.ctx;
    const listX = 50;
    const listY = 200;
    const listWidth = 450;
    const listHeight = 500;
    const itemHeight = 80;

    // Fond de la liste
    ctx.fillStyle = '#16213e';
    this.roundRect(ctx, listX, listY, listWidth, listHeight, 10, true, false);

    // Afficher les objets
    const visibleItems = this.itemList.slice(this.scrollOffset, this.scrollOffset + this.itemsPerPage);

    visibleItems.forEach((item, index) => {
      const y = listY + 10 + index * (itemHeight + 5);
      const isSelected = this.selectedItem === item;
      const isHovered = this.hoveredButton?.id === `item_${item.id}`;

      const btn = {
        id: `item_${item.id}`,
        x: listX + 10,
        y: y,
        w: listWidth - 20,
        h: itemHeight,
        action: () => {
          this.selectedItem = item;
          this.quantity = 1;
          this.draw();
        }
      };

      // Background
      if (isSelected) {
        ctx.fillStyle = '#3366cc';
      } else if (isHovered) {
        ctx.fillStyle = '#2244aa';
      } else {
        ctx.fillStyle = '#0f3460';
      }

      this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 5, true, false);

      // Icon
      ctx.font = '36px Arial';
      ctx.fillText(item.icon, btn.x + 20, btn.y + 50);

      // Nom
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(item.name, btn.x + 70, btn.y + 35);

      // Prix
      ctx.font = '20px Arial';
      ctx.fillStyle = '#ffcc00';
      ctx.fillText(`${item.price} ₽`, btn.x + 70, btn.y + 60);

      // Quantité si mode vente
      if (item.type === 'sell') {
        ctx.fillStyle = '#aaa';
        ctx.font = '18px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`x${item.quantity}`, btn.x + btn.w - 10, btn.y + 50);
      }

      this.buttons.push(btn);
    });

    // Boutons de scroll si nécessaire
    if (this.itemList.length > this.itemsPerPage) {
      // Bouton scroll up
      if (this.scrollOffset > 0) {
        const upBtn = {
          id: 'scroll_up',
          x: listX + listWidth - 50,
          y: listY - 50,
          w: 40,
          h: 40,
          label: '▲',
          action: () => {
            this.scrollOffset = Math.max(0, this.scrollOffset - 1);
            this.draw();
          }
        };

        const isHovered = this.hoveredButton === upBtn;
        ctx.fillStyle = isHovered ? '#3366cc' : '#16213e';
        this.roundRect(ctx, upBtn.x, upBtn.y, upBtn.w, upBtn.h, 5, true, false);

        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(upBtn.label, upBtn.x + upBtn.w / 2, upBtn.y + 28);

        this.buttons.push(upBtn);
      }

      // Bouton scroll down
      if (this.scrollOffset + this.itemsPerPage < this.itemList.length) {
        const downBtn = {
          id: 'scroll_down',
          x: listX + listWidth - 50,
          y: listY + listHeight + 10,
          w: 40,
          h: 40,
          label: '▼',
          action: () => {
            this.scrollOffset = Math.min(this.itemList.length - this.itemsPerPage, this.scrollOffset + 1);
            this.draw();
          }
        };

        const isHovered = this.hoveredButton === downBtn;
        ctx.fillStyle = isHovered ? '#3366cc' : '#16213e';
        this.roundRect(ctx, downBtn.x, downBtn.y, downBtn.w, downBtn.h, 5, true, false);

        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(downBtn.label, downBtn.x + downBtn.w / 2, downBtn.y + 28);

        this.buttons.push(downBtn);
      }
    }
  }

  drawDetailsPanel() {
    const ctx = this.ctx;
    const panelX = 550;
    const panelY = 200;
    const panelWidth = 424;
    const panelHeight = 500;

    // Fond du panneau
    ctx.fillStyle = '#16213e';
    this.roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 10, true, false);

    const item = this.selectedItem;

    // Icon grande
    ctx.font = '64px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(item.icon, panelX + panelWidth / 2, panelY + 80);

    // Nom
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Arial';
    ctx.fillText(item.name, panelX + panelWidth / 2, panelY + 140);

    // Description
    ctx.fillStyle = '#aaa';
    ctx.font = '18px Arial';
    this.wrapText(ctx, item.description, panelX + 20, panelY + 180, panelWidth - 40, 24);

    // Prix
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    const actionLabel = this.currentTab === 'buy' ? 'Prix :' : 'Vente :';
    ctx.fillText(`${actionLabel} ${item.price} ₽`, panelX + panelWidth / 2, panelY + 280);

    // Sélecteur de quantité
    this.drawQuantitySelector(panelX, panelY + 320, panelWidth);

    // Bouton confirmer
    const totalPrice = item.price * this.quantity;
    const money = this.game?.saveManager?.saveData?.joueur?.argent || 0;
    const canAfford = this.currentTab === 'sell' || money >= totalPrice;
    const canSell = this.currentTab === 'buy' || this.quantity <= (item.quantity || 0);
    const enabled = canAfford && canSell;

    const confirmBtn = {
      x: panelX + 40,
      y: panelY + panelHeight - 70,
      w: panelWidth - 80,
      h: 50,
      label: this.currentTab === 'buy' ? `ACHETER (${totalPrice} ₽)` : `VENDRE (${totalPrice} ₽)`,
      action: enabled ? () => this.confirmTransaction() : null
    };

    const isHovered = this.hoveredButton === confirmBtn && enabled;
    ctx.fillStyle = enabled ? (isHovered ? '#00aa00' : '#008800') : '#444';
    this.roundRect(ctx, confirmBtn.x, confirmBtn.y, confirmBtn.w, confirmBtn.h, 10, true, false);

    ctx.fillStyle = enabled ? '#fff' : '#888';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(confirmBtn.label, confirmBtn.x + confirmBtn.w / 2, confirmBtn.y + 35);

    if (enabled) {
      this.buttons.push(confirmBtn);
    }
  }

  drawQuantitySelector(x, y, width) {
    const ctx = this.ctx;
    const btnWidth = 50;
    const centerX = x + width / 2;

    // Bouton -
    const minusBtn = {
      id: 'quantity_minus',
      x: centerX - 100,
      y: y,
      w: btnWidth,
      h: btnWidth,
      label: '-',
      action: () => {
        if (this.quantity > 1) {
          this.quantity--;
          this.draw();
        }
      }
    };

    const isHoveredMinus = this.hoveredButton === minusBtn;
    ctx.fillStyle = this.quantity > 1 ? (isHoveredMinus ? '#3366cc' : '#16213e') : '#0a0a0a';
    this.roundRect(ctx, minusBtn.x, minusBtn.y, minusBtn.w, minusBtn.h, 5, true, false);

    ctx.fillStyle = this.quantity > 1 ? '#fff' : '#444';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(minusBtn.label, minusBtn.x + minusBtn.w / 2, minusBtn.y + 38);

    if (this.quantity > 1) {
      this.buttons.push(minusBtn);
    }

    // Quantité
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(this.quantity.toString(), centerX, y + 38);

    // Bouton +
    const maxQuantity = this.currentTab === 'sell' ? (this.selectedItem?.quantity || 1) : 99;
    const plusBtn = {
      id: 'quantity_plus',
      x: centerX + 50,
      y: y,
      w: btnWidth,
      h: btnWidth,
      label: '+',
      action: () => {
        if (this.quantity < maxQuantity) {
          this.quantity++;
          this.draw();
        }
      }
    };

    const isHoveredPlus = this.hoveredButton === plusBtn;
    ctx.fillStyle = this.quantity < maxQuantity ? (isHoveredPlus ? '#3366cc' : '#16213e') : '#0a0a0a';
    this.roundRect(ctx, plusBtn.x, plusBtn.y, plusBtn.w, plusBtn.h, 5, true, false);

    ctx.fillStyle = this.quantity < maxQuantity ? '#fff' : '#444';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(plusBtn.label, plusBtn.x + plusBtn.w / 2, plusBtn.y + 38);

    if (this.quantity < maxQuantity) {
      this.buttons.push(plusBtn);
    }
  }

  confirmTransaction() {
    const saveManager = this.game?.saveManager;
    if (!saveManager || !this.selectedItem) return;

    const item = this.selectedItem;
    const totalPrice = item.price * this.quantity;
    const money = saveManager.saveData.joueur.argent;

    if (this.currentTab === 'buy') {
      // Achat
      if (money < totalPrice) {
        console.log("[VRShop] Pas assez d'argent !");
        this.game?.ui?.showNotification?.("Pas assez d'argent !", "error");
        return;
      }

      // Débiter l'argent
      saveManager.addMoney(-totalPrice);

      // Ajouter l'objet à l'inventaire
      saveManager.addItem(item.id, this.quantity);

      console.log(`[VRShop] Acheté ${this.quantity}x ${item.name} pour ${totalPrice} ₽`);
      this.game?.ui?.showNotification?.(`Acheté ${this.quantity}x ${item.name} !`, "success");

    } else {
      // Vente
      if (this.quantity > (item.quantity || 0)) {
        console.log("[VRShop] Pas assez d'objets à vendre !");
        this.game?.ui?.showNotification?.("Pas assez d'objets !", "error");
        return;
      }

      // Créditer l'argent
      saveManager.addMoney(totalPrice);

      // Retirer l'objet de l'inventaire
      saveManager.removeItem(item.id, this.quantity);

      console.log(`[VRShop] Vendu ${this.quantity}x ${item.name} pour ${totalPrice} ₽`);
      this.game?.ui?.showNotification?.(`Vendu ${this.quantity}x ${item.name} !`, "success");
    }

    // Rafraîchir la liste
    this.refreshItemList();
  }

  // Utilitaire pour wrapping de texte
  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && i > 0) {
        ctx.textAlign = 'left';
        ctx.fillText(line, x, currentY);
        line = words[i] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.textAlign = 'left';
    ctx.fillText(line, x, currentY);
  }
}
