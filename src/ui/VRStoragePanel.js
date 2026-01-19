import { VRMenuPanel } from './VRMenuPanel.js';

export class VRStoragePanel extends VRMenuPanel {
  constructor(game) {
    super(game, 1024, 768);
    this.selectedPokemon = null;
    this.selectedSource = null; // 'team' ou 'pc'
    this.page = 0;
    this.itemsPerPage = 30; // 6x5 grid
  }
  
  draw() {
    const ctx = this.ctx;
    const sm = this.game.saveManager;
    const playerName = sm.saveData?.joueur?.nom || 'JOUEUR';
    
    // Fond général
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Header
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(0, 0, this.width, 80);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`PC DE ${playerName.toUpperCase()}`, this.width / 2, 55);
    
    // Reset buttons
    this.buttons = [];
    
    // --- ZONE GAUCHE : ÉQUIPE ---
    this.drawTeamColumn(0, 80, 250, this.height - 80);
    
    // --- ZONE CENTRE : GRILLE PC ---
    const centerW = this.width - 250 - 300; // Total - Left - Right
    this.drawPCGrid(250, 80, centerW, this.height - 80);
    
    // --- ZONE DROITE : DÉTAILS ---
    this.drawDetails(this.width - 300, 80, 300, this.height - 80);
    
    // Bouton Fermer (Header)
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
  
  drawTeamColumn(x, y, w, h) {
      const ctx = this.ctx;
      
      // Fond colonne
      ctx.fillStyle = '#16213e';
      ctx.fillRect(x, y, w, h);
      
      // Titre
      ctx.fillStyle = '#aaa';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText("ÉQUIPE", x + w/2, y + 40);
      
      // Liste Équipe
      const myPokemon = this.game.saveManager?.myPokemon || {};
      const startY = y + 60;
      const itemH = 90;
      const gap = 10;
      
      for (let i = 0; i < 6; i++) {
          const pokemon = myPokemon[i + 1];
          const iy = startY + i * (itemH + gap);
          
          if (!pokemon) {
              // Slot vide
              ctx.fillStyle = '#252540';
              this.roundRect(ctx, x + 10, iy, w - 20, itemH, 10, true);
              ctx.fillStyle = '#444';
              ctx.font = 'italic 16px Arial';
              ctx.fillText("Vide", x + w/2, iy + itemH/2 + 5);
              continue;
          }
          
          const btn = {
              x: x + 10, y: iy, w: w - 20, h: itemH,
              label: `TEAM_${i}`,
              action: () => {
                  this.selectedPokemon = pokemon;
                  this.selectedSource = 'team';
                  this.draw();
              }
          };
          
          const isSelected = this.selectedPokemon === pokemon;
          const isHovered = this.hoveredButton === btn;
          
          // Fond
          ctx.fillStyle = isSelected ? '#cc0000' : (isHovered ? '#2a2a4e' : '#1f1f35');
          this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10, true);
          
          // Nom
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 18px Arial';
          let name = pokemon.surnom || pokemon.name || pokemon.nom || '???';
          if (name.length > 12) name = name.substring(0, 10) + '..';
          ctx.fillText(name, btn.x + btn.w/2, iy + 30);
          
          // Niveau
          ctx.fillStyle = '#ffd700';
          ctx.font = '14px Arial';
          ctx.fillText(`Niv. ${pokemon.niveau}`, btn.x + btn.w/2, iy + 55);
          
          
          // Sprite Team
          this.drawPokemonSprite(pokemon.speciesId || pokemon.id, x + 20, iy + 5, 50, 50/70*58);
          
          this.buttons.push(btn);
      }
  }
  
  drawPCGrid(x, y, w, h) {
      const ctx = this.ctx;
      
      // Fond
      ctx.fillStyle = '#1a1a2e'; // Un peu plus clair que le fond général ? non, même.
      // ctx.fillRect(x, y, w, h);
      
      // Titre Boîte
      ctx.fillStyle = '#aaa';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`BOÎTE 1 (PC)`, x + w/2, y + 40);
      
      const pcIds = this.game.saveManager?.saveData?.pc || [];
      
      if (pcIds.length === 0) {
          ctx.fillStyle = '#444';
          ctx.font = 'italic 24px Arial';
          ctx.fillText("Boîte Vide", x + w/2, y + h/2);
          return;
      }
      
      const cols = 5;
      const startX = x + 30;
      const startY = y + 60;
      const itemW = 80; // Plus petit pour en mettre plus
      const itemH = 80; 
      const gap = 12;
      
      // Pagination simple
      const startIndex = this.page * this.itemsPerPage;
      const endIndex = Math.min(startIndex + this.itemsPerPage, pcIds.length);
      
      for (let i = startIndex; i < endIndex; i++) {
        const id = pcIds[i];
        const pokemon = this.game.saveManager.getPokemon(id);
        if (!pokemon) continue;
        
        const localIndex = i - startIndex;
        const col = localIndex % cols;
        const row = Math.floor(localIndex / cols);
        
        const bx = startX + col * (itemW + gap);
        const by = startY + row * (itemH + gap);
        
        const btn = {
            x: bx, y: by, w: itemW, h: itemH,
            label: `PC_${id}`,
            action: () => {
                this.selectedPokemon = pokemon;
                this.selectedSource = 'pc';
                this.draw(); // Refresh details
            }
        };
        
        const isSelected = this.selectedPokemon === pokemon;
        const isHovered = this.hoveredButton === btn;
        
        // Slot
        ctx.fillStyle = isSelected ? '#cc0000' : (isHovered ? '#333355' : '#252540');
        this.roundRect(ctx, bx, by, itemW, itemH, 8, true);
        
        // Sprite
        this.drawPokemonSprite(pokemon.speciesId || pokemon.id, bx + 10, by + 10, itemW - 20, (itemW - 20)/70*58);
        
        // Nom
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        let name = pokemon.surnom || pokemon.name || pokemon.nom || '???';
        if (name.length > 8) name = name.substring(0, 6) + '..';
        ctx.fillText(name, bx + itemW/2, by + itemH - 8);
        
        this.buttons.push(btn);
      }
  }
  
  drawDetails(x, y, w, h) {
      const ctx = this.ctx;
      
      // Fond
      ctx.fillStyle = '#16213e';
      ctx.fillRect(x, y, w, h);
      
      const p = this.selectedPokemon;
      
      if (!p) {
          ctx.fillStyle = '#666';
          ctx.font = 'italic 20px Arial';
          ctx.textAlign = 'center';
          ctx.fillText("Sélection...", x + w/2, y + h/2);
          return;
      }
      
      // Info
      let name = p.surnom || p.name || p.nom || '???';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      
      // Details Sprite
      this.drawPokemonSprite(p.speciesId || p.id, x + w/2 - 60, y + 20, 120, 120/70*58);
      
      ctx.fillText(name, x + w/2, y + 150);
      
      ctx.font = '20px Arial';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`Niveau ${p.niveau}`, x + w/2, y + 180);
      
      // Action Button
      let actionLabel = "";
      let actionFn = null;
      let btnColor = '#22c55e';
      
      if (this.selectedSource === 'pc') {
          // Action: Retirer
          // Check équipe pleine
          const equipe = this.game.saveManager.saveData.equipe;
          const isTeamFull = !equipe.some(id => id === null) && equipe.length >= 6;
          
          actionLabel = isTeamFull ? "ÉQUIPE PLEINE" : "RETIRER";
          btnColor = isTeamFull ? '#555' : '#22c55e';
          
          if (!isTeamFull) {
              actionFn = () => this.validerRetrait(p);
          }
      } else if (this.selectedSource === 'team') {
          // Action: Déposer
          // Check si dernier pokemon (interdit de vider équipe complètement)
          const equipe = this.game.saveManager.saveData.equipe;
          const aliveCount = equipe.filter(id => id !== null).length;
          
          actionLabel = aliveCount <= 1 ? "IMPOSSIBLE" : "DÉPOSER";
          btnColor = aliveCount <= 1 ? '#555' : '#3b82f6'; // Bleu pour déposer
          
          if (aliveCount > 1) {
              actionFn = () => this.validerDepot(p);
          }
      }
      
      if (actionLabel) {
          const btn = {
              x: x + 40,
              y: y + h - 100,
              w: w - 80,
              h: 60,
              label: actionLabel,
              action: actionFn || (() => {})
          };
          
          const isHovered = this.hoveredButton === btn;
          // Si désactivé (gris), pas d'effet hover
          const isDisabled = btnColor === '#555';
          ctx.fillStyle = isDisabled ? '#555' : (isHovered ? this.darken(btnColor) : btnColor);
          
          this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10, true);
          
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 22px Arial';
          ctx.fillText(actionLabel, btn.x + btn.w/2, btn.y + 38);
          
          if (!isDisabled) this.buttons.push(btn);
      }
      
      // Bouton RELÂCHER (Optionnel, rouge)
      // On évite pour l'instant pour ne pas supprimer par erreur en VR
  }
  
  darken(color) {
      // Helper simple pour assombrir couleur hex (approx)
      return color === '#22c55e' ? '#16a34a' : (color === '#3b82f6' ? '#2563eb' : color);
  }
  
  validerRetrait(pokemon) {
      console.log(`[VRStorage] Retrait de ${pokemon.name}`);
      const sm = this.game.saveManager;
      
      // Hack retrait PC (manque méthode dans SaveManager)
      const pcIndex = sm.saveData.pc.indexOf(pokemon.uniqueId);
      if (pcIndex > -1) {
          sm.saveData.pc.splice(pcIndex, 1);
          sm.addToTeam(pokemon.uniqueId);
          sm.save();
          
          this.selectedPokemon = null; 
          this.draw(); 
      }
  }
  
  validerDepot(pokemon) {
      console.log(`[VRStorage] Dépôt de ${pokemon.name}`);
      const sm = this.game.saveManager;
      
      // Retirer de l'équipe et envoyer au PC
      if (sm.removeFromTeam(pokemon.uniqueId)) {
          sm.addToPC(pokemon.uniqueId);
          sm.save();
          
          this.selectedPokemon = null;
          this.draw();
      }
  }
}
