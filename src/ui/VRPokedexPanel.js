import { VRMenuPanel } from './VRMenuPanel.js';

export class VRPokedexPanel extends VRMenuPanel {
  constructor(game) {
    super(game, 1024, 768);
    this.selectedId = null;
    this.page = 0;
    this.itemsPerPage = 10;
    this.maxId = 151;
  }
  
  draw() {
    const ctx = this.ctx;
    const sm = this.game.saveManager;
    
    // Fond
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Header
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(0, 0, this.width, 80);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('POKÉDEX', this.width / 2, 55);
    
    // Stats (Header droit)
    const stats = sm.getPokedexStats();
    ctx.font = '20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`VUS: ${stats.vus}  PRIS: ${stats.captures}`, this.width - 180, 50);
    
    // Reset buttons
    this.buttons = [];
    
    // Zone gauche: Liste
    const listW = this.width * 0.45;
    this.drawList(0, 80, listW, this.height - 80);
    
    // Zone droite: Détails
    this.drawDetails(listW, 80, this.width - listW, this.height - 80);
    
    // Bouton Fermer (Custom position to not overlap stats)
    const closeBtn = {
      x: 20,
      y: 25, // Easier to hit
      w: 120,
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
  
  drawList(x, y, w, h) {
      const ctx = this.ctx;
      const sm = this.game.saveManager;
      
      // Fond liste
      ctx.fillStyle = '#16213e';
      ctx.fillRect(x, y, w, h);
      
      const startId = this.page * this.itemsPerPage + 1;
      const endId = Math.min(startId + this.itemsPerPage - 1, this.maxId);
      
      const itemH = 60;
      const gap = 5;
      const startY = y + 20;
      
      for (let id = startId; id <= endId; id++) {
          const localIndex = id - startId;
          const iy = startY + localIndex * (itemH + gap);
          
          const isSeen = sm.saveData.pokedex.vus.includes(id);
          const isCaught = sm.saveData.pokedex.captures.includes(id);
          
          // Get Name
          let name = "???";
          if (isSeen) {
               // Chercher dans la base
               const dbEntry = sm.pokemonDatabase ? sm.pokemonDatabase.find(p => p.id == id) : null;
               if (dbEntry) name = dbEntry.nom;
          }
          
          const padId = id.toString().padStart(3, '0');
          
          const btn = {
              x: x + 10, y: iy, w: w - 20, h: itemH,
              label: `DEX_${id}`,
              action: () => {
                  this.selectedId = id;
                  this.draw();
              }
          };
          
          const isSelected = this.selectedId === id;
          const isHovered = this.hoveredButton === btn;
          
          // Fond Item
          ctx.fillStyle = isSelected ? '#cc0000' : (isHovered ? '#2a2a4e' : '#1f1f35');
          this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 5, true);
          
          // Numéro
          ctx.fillStyle = '#ffd700';
          ctx.font = 'bold 20px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`No.${padId}`, btn.x + 15, btn.y + 38);
          
          // Nom
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 24px Arial';
          ctx.fillText(name, btn.x + 110, btn.y + 38);
          
          // Icône Pokéball / Sprite si capturé
          if (isCaught) {
              const spriteH = 40;
              const spriteW = spriteH * (70/58);
              this.drawPokemonSprite(id, btn.x + btn.w - 60, btn.y + itemH/2 - spriteH/2, spriteW, spriteH);
          }
          
          this.buttons.push(btn);
      }
      
      // Pagination Controls
      const controlsY = y + h - 60;
      
      // Prev
      if (this.page > 0) {
          const prevBtn = {
              x: x + 20, y: controlsY, w: 100, h: 40,
              label: "PREV",
              action: () => {
                  this.page--;
                  this.draw();
              }
          };
          ctx.fillStyle = this.hoveredButton === prevBtn ? '#444' : '#333';
          this.roundRect(ctx, prevBtn.x, prevBtn.y, prevBtn.w, prevBtn.h, 5, true);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText("PRÉC.", prevBtn.x + prevBtn.w/2, prevBtn.y + 25);
          this.buttons.push(prevBtn);
      }
      
      // Next
      if (endId < this.maxId) {
          const nextBtn = {
              x: x + w - 120, y: controlsY, w: 100, h: 40,
              label: "NEXT",
              action: () => {
                  this.page++;
                  this.draw();
              }
          };
          ctx.fillStyle = this.hoveredButton === nextBtn ? '#444' : '#333';
          this.roundRect(ctx, nextBtn.x, nextBtn.y, nextBtn.w, nextBtn.h, 5, true);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText("SUIV.", nextBtn.x + nextBtn.w/2, nextBtn.y + 25);
          this.buttons.push(nextBtn);
      }
  }
  
  drawDetails(x, y, w, h) {
      const ctx = this.ctx;
      const sm = this.game.saveManager;
      
      // Fond détails
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(x, y, w, h);
      
      if (!this.selectedId) {
          ctx.fillStyle = '#666';
          ctx.font = 'italic 24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText("Sélectionnez un Pokémon", x + w/2, y + h/2);
          return;
      }
      
      const id = this.selectedId;
      const isSeen = sm.saveData.pokedex.vus.includes(id);
      
      if (!isSeen) {
          ctx.fillStyle = '#444';
          ctx.font = 'bold 40px Arial';
          ctx.textAlign = 'center';
          ctx.fillText("???", x + w/2, y + 100);
          return;
      }
      
      // Get DB Data
      const dbEntry = sm.pokemonDatabase ? sm.pokemonDatabase.find(p => p.id == id) : null;
      if (!dbEntry) return; // Should not happen if seen
      
      // Nom
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 50px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(dbEntry.nom.toUpperCase(), x + w/2, y + 80);
      
      // Catégorie / Type
      // TODO: Get types from DB
      const types = dbEntry.types || [dbEntry.type] || [];
      if (types.length > 0) {
           ctx.font = '24px Arial';
           ctx.fillStyle = '#aaa';
           ctx.fillText(types.join(" / ").toUpperCase(), x + w/2, y + 120);
      }
      
      // Placeholder Image Area -> Sprite
      // ctx.fillStyle = '#333';
      // ctx.fillRect(x + w/2 - 100, y + 160, 200, 200);
      
      const spriteSize = 200;
      this.drawPokemonSprite(id, x + w/2 - spriteSize/2, y + 160, spriteSize, spriteSize/70*58);
      
      // ctx.fillStyle = '#666';
      // ctx.font = '40px Arial';
      // ctx.fillText("?", x + w/2, y + 270);
      
      // Description (Placeholder)
      ctx.fillStyle = '#ddd';
      ctx.font = 'italic 20px Arial';
      const desc = "Un Pokémon mystérieux découvert dans la région de Kanto.";
      // Simple wrap text would be nice but overkill for now
      ctx.fillText(desc, x + w/2, y + 420);
      
      // Stats physiques (Taille/Poids via DB si dispo)
      // ctx.fillText(`Taille: ? m  Poids: ? kg`, x + w/2, y + 460);
  }
}
