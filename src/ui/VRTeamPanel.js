import { VRMenuPanel } from './VRMenuPanel.js';

/**
 * VRTeamPanel - Affiche l'équipe Pokémon en VR
 * Grille 3x2 avec les 6 Pokémon
 */
export class VRTeamPanel extends VRMenuPanel {
  constructor(game) {
    super(game, 1024, 768);
    this.selectedPokemon = null;
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
    ctx.fillText('ÉQUIPE POKÉMON', this.width / 2, 50);
    
    // Récupérer l'équipe
    // myPokemon contient déjà les objets Pokémon complets (pas juste des IDs)
    const myPokemon = this.game.saveManager?.myPokemon || {};
    console.log(`[VRTeamPanel] myPokemon:`, myPokemon);
    
    const team = [];
    
    // Convertir l'objet en tableau (slots 1-6)
    for (let i = 0; i < 6; i++) {
      const pokemon = myPokemon[i + 1]; // Les slots commencent à 1
      team.push(pokemon || null);
    }
    
    console.log(`[VRTeamPanel] Final team:`, team);
    
    // Reset buttons
    this.buttons = [];
    
    // Grille 3x2
    const cols = 3;
    const rows = 2;
    const cardWidth = 300;
    const cardHeight = 260;
    const gapX = 20;
    const gapY = 20;
    const startX = (this.width - (cols * cardWidth + (cols - 1) * gapX)) / 2;
    const startY = 100;
    
    for (let i = 0; i < 6; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const x = startX + col * (cardWidth + gapX);
      const y = startY + row * (cardHeight + gapY);
      
      const pokemon = team[i];
      
      if (pokemon) {
        this.drawPokemonCard(pokemon, x, y, cardWidth, cardHeight, i);
        
        this.buttons.push({
          x, y,
          w: cardWidth,
          h: cardHeight,
          label: pokemon.surnom || pokemon.nom,
          action: () => this.showPokemonDetails(pokemon)
        });
      } else {
        this.drawEmptySlot(x, y, cardWidth, cardHeight, i + 1);
      }
    }
    
    // Bouton Fermer
    const closeBtn = {
      x: this.width - 180,
      y: this.height - 80,
      w: 150,
      h: 60,
      label: 'FERMER',
      action: () => this.hide()
    };
    
    this.drawButton(closeBtn, this.hoveredButton === closeBtn);
    this.buttons.push(closeBtn);
    
    this.texture.needsUpdate = true;
  }
  
  drawPokemonCard(pokemon, x, y, w, h, index) {
    const ctx = this.ctx;
    const isHovered = this.hoveredButton?.action?.toString().includes(pokemon.nom);
    
    // Fond carte
    ctx.fillStyle = isHovered ? '#2a2a4e' : '#252540';
    this.roundRect(ctx, x, y, w, h, 15, true, false);
    
    // Bordure
    ctx.strokeStyle = isHovered ? '#cc0000' : '#444';
    ctx.lineWidth = 3;
    this.roundRect(ctx, x, y, w, h, 15, false, true);
    
    // Numéro slot
    ctx.fillStyle = '#666';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`#${index + 1}`, x + 15, y + 30);
    
    // Nom du Pokémon
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    const displayName = pokemon.surnom || pokemon.nom || `Pokémon #${pokemon.speciesId}`;
    ctx.fillText(displayName, x + w / 2, y + 70);
    
    // Niveau
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Niv. ${pokemon.niveau || pokemon.level || 5}`, x + w / 2, y + 105);
    
    // Barre de HP
    const hpBarX = x + 30;
    const hpBarY = y + 130;
    const hpBarW = w - 60;
    const hpBarH = 20;
    
    // Fond barre HP
    ctx.fillStyle = '#333';
    this.roundRect(ctx, hpBarX, hpBarY, hpBarW, hpBarH, 10, true, false);
    
    // HP actuel
    const hpPercent = (pokemon.pv || pokemon.hp || 100) / (pokemon.pvMax || pokemon.hpMax || 100);
    const hpColor = hpPercent > 0.5 ? '#4ade80' : hpPercent > 0.2 ? '#fbbf24' : '#ef4444';
    
    ctx.fillStyle = hpColor;
    this.roundRect(ctx, hpBarX, hpBarY, hpBarW * hpPercent, hpBarH, 10, true, false);
    
    // Texte HP
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    const hpText = `${pokemon.pv || pokemon.hp || '?'} / ${pokemon.pvMax || pokemon.hpMax || '?'}`;
    ctx.fillText(hpText, x + w / 2, hpBarY + 15);
    
    // Types (si disponibles)
    if (pokemon.types || pokemon.type) {
      const types = pokemon.types || [pokemon.type];
      const typeY = y + h - 50;
      
      types.forEach((type, i) => {
        if (!type) return;
        
        const typeX = x + w / 2 - (types.length * 60) / 2 + i * 70;
        const typeColors = {
          'Feu': '#f08030', 'Eau': '#6890f0', 'Plante': '#78c850',
          'Électrik': '#f8d030', 'Psy': '#f85888', 'Combat': '#c03028',
          'Normal': '#a8a878', 'Vol': '#a890f0', 'Poison': '#a040a0',
          'Sol': '#e0c068', 'Roche': '#b8a038', 'Insecte': '#a8b820',
          'Spectre': '#705898', 'Acier': '#b8b8d0', 'Glace': '#98d8d8',
          'Dragon': '#7038f8', 'Ténèbres': '#705848', 'Fée': '#ee99ac'
        };
        
        ctx.fillStyle = typeColors[type] || '#888';
        this.roundRect(ctx, typeX, typeY, 60, 25, 5, true, false);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(type.toUpperCase(), typeX + 30, typeY + 17);
      });
    }
    
    // Icône Pokéball (simple)
    ctx.fillStyle = isHovered ? '#ff0000' : '#cc0000';
    ctx.beginPath();
    ctx.arc(x + w - 30, y + 30, 12, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + w - 30, y + 30, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  drawEmptySlot(x, y, w, h, slotNumber) {
    const ctx = this.ctx;
    
    // Fond grisé
    ctx.fillStyle = '#1a1a2a';
    this.roundRect(ctx, x, y, w, h, 15, true, false);
    
    // Bordure pointillée
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    this.roundRect(ctx, x, y, w, h, 15, false, true);
    ctx.setLineDash([]);
    
    // Texte
    ctx.fillStyle = '#666';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Slot ${slotNumber}`, x + w / 2, y + h / 2 - 10);
    ctx.font = '18px Arial';
    ctx.fillText('Vide', x + w / 2, y + h / 2 + 20);
  }
  
  showPokemonDetails(pokemon) {
    console.log(`[VRTeamPanel] Showing details for:`, pokemon);
    // TODO: Afficher un sous-panneau avec les détails complets
    // Pour l'instant, juste un log
  }
}
