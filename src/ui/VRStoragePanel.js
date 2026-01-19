import { VRMenuPanel } from './VRMenuPanel.js';

export class VRStoragePanel extends VRMenuPanel {
  constructor(game) {
    super(game, 1024, 768);
    this.selectedPokemon = null;
    this.page = 0;
    this.itemsPerPage = 30; // 6x5 grid
  }
  
  draw() {
    const ctx = this.ctx;
    
    // Fond
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Header
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(0, 0, this.width, 80);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PC DE LÉO', this.width / 2, 55);
    
    // Reset buttons
    this.buttons = [];
    
    // Récupérer les données
    const pcIds = this.game.saveManager?.saveData?.pc || [];
    
    // Zone de gauche: Grille PC
    const leftW = this.width * 0.6;
    this.drawPCGrid(pcIds, 0, 80, leftW, this.height - 80);
    
    // Zone de droite: Détails
    const rightW = this.width * 0.4;
    this.drawDetails(leftW, 80, rightW, this.height - 80);
    
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
  
  drawPCGrid(pcIds, x, y, w, h) {
    const ctx = this.ctx;
    
    // Fond zone grille
    ctx.fillStyle = '#16213e';
    ctx.fillRect(x, y, w, h);
    
    if (pcIds.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("Boîte Vide", x + w/2, y + h/2);
        return;
    }
    
    const cols = 5;
    const startX = x + 30;
    const startY = y + 30;
    const itemW = 100;
    const itemH = 100;
    const gap = 15;
    
    // Pagination (si besoin, pour l'instant simple)
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
                this.draw();
            }
        };
        
        const isSelected = this.selectedPokemon && this.selectedPokemon.uniqueId === pokemon.uniqueId;
        const isHovered = this.hoveredButton === btn;
        
        // Fond Slot
        ctx.fillStyle = isSelected ? '#cc0000' : (isHovered ? '#333355' : '#252540');
        this.roundRect(ctx, bx, by, itemW, itemH, 10, true, false);
        
        // Placeholder Sprite
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(bx + itemW/2, by + itemH/2 - 10, 30, 0, Math.PI*2);
        ctx.fill();
        
        // Nom (tronqué)
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        let name = pokemon.surnom || pokemon.name || pokemon.nom || '???';
        if (name.length > 10) name = name.substring(0, 8) + '..';
        ctx.fillText(name, bx + itemW/2, by + itemH - 10);
        
        // Niveau
        ctx.fillStyle = '#ffd700';
        ctx.font = '10px Arial';
        ctx.fillText(`Lv.${pokemon.niveau}`, bx + itemW - 15, by + 15);
        
        this.buttons.push(btn);
    }
  }
  
  drawDetails(x, y, w, h) {
      const ctx = this.ctx;
      const p = this.selectedPokemon;
      
      // Fond details
      ctx.fillStyle = '#1f1f35';
      ctx.fillRect(x, y, w, h);
      
      if (!p) {
          ctx.fillStyle = '#666';
          ctx.font = 'italic 24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText("Sélectionnez un Pokémon", x + w/2, y + h/2);
          return;
      }
      
      // Info Pokémon
      const name = p.surnom || p.name || p.nom || '???';
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(name, x + w/2, y + 80);
      
      ctx.font = '24px Arial';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`Niveau ${p.niveau}`, x + w/2, y + 120);
      
      // TODO: Stats, etc.
      
      // Bouton RETIRER
      const withdrawBtn = {
          x: x + w/2 - 100,
          y: y + h - 100,
          w: 200,
          h: 60,
          label: "RETIRER",
          action: () => this.validerRetrait(p)
      };
      
      const isHovered = this.hoveredButton === withdrawBtn;
      ctx.fillStyle = isHovered ? '#4ade80' : '#22c55e';
      this.roundRect(ctx, withdrawBtn.x, withdrawBtn.y, withdrawBtn.w, withdrawBtn.h, 15, true);
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px Arial';
      ctx.fillText("RETIRER", withdrawBtn.x + withdrawBtn.w/2, withdrawBtn.y + 40);
      
      this.buttons.push(withdrawBtn);
  }
  
  validerRetrait(pokemon) {
      // Vérifier place équipe
      // Note: addToTeam gère déjà le check mais renvoie false si plein
      // Idéalement on check avant pour feedback UI
      
      // Hack: On accède à saveData.equipe via saveManager
      const equipe = this.game.saveManager.saveData.equipe;
      const freeSlot = equipe.findIndex(id => id === null);
      
      if (freeSlot === -1 && equipe.length >= 6) {
          console.log("[VRStorage] Équipe pleine !");
          // TODO: Message UI "Équipe pleine"
          return;
      }
      
      console.log(`[VRStorage] Retrait de ${pokemon.name}`);
      
      // Retirer du PC
      // SaveManager n'a pas de méthode atomique "withdrawFromPC", on doit combiner
      // 1. removeFromPC (manque dans SaveManager, il y a juste addToPC)
      // On va le faire manuellement pour l'instant en manipulant les tableaux via SaveManager si possible, 
      // ou on ajoute la méthode au SaveManager. 
      // Pour l'instant on suppose que l'utilisateur va implémenter la méthode manquante ou on hack.
      
      // Check if SaveManager has removeFromPC or update it manually
      const sm = this.game.saveManager;
      const pcIndex = sm.saveData.pc.indexOf(pokemon.uniqueId);
      
      if (pcIndex > -1) {
          sm.saveData.pc.splice(pcIndex, 1); // Retrait du tableau PC
          sm.addToTeam(pokemon.uniqueId); // Ajout équipe
          sm.save(); // Sauvegarder
          
          this.selectedPokemon = null; // Deselect
          this.draw(); // Refresh
      }
  }
}
