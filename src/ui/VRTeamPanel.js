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
    if (this.selectedPokemon) {
        this.drawDetailsView();
    } else {
        this.drawTeamGrid();
    }
  }

  drawTeamGrid() {
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
          label: pokemon.surnom || pokemon.name || pokemon.nom,
          action: () => this.showPokemonDetails(pokemon)
        });
      } else {
        this.drawEmptySlot(x, y, cardWidth, cardHeight, i + 1);
      }
    }
    
    // Bouton Fermer
    const closeBtn = {
      x: this.width - 150,
      y: this.height - 85, // Slightly higher margin from bottom
      w: 120,
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
    const displayName = pokemon.surnom || pokemon.name || pokemon.nom || `Pokémon #${pokemon.speciesId}`;
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
    const currentHP = pokemon.stats?.hp || pokemon.pv || pokemon.hp || 100;
    const maxHP = pokemon.stats?.hpMax || pokemon.pvMax || pokemon.hpMax || 100;
    const hpPercent = currentHP / maxHP;
    const hpColor = hpPercent > 0.5 ? '#4ade80' : hpPercent > 0.2 ? '#fbbf24' : '#ef4444';
    
    ctx.fillStyle = hpColor;
    this.roundRect(ctx, hpBarX, hpBarY, hpBarW * hpPercent, hpBarH, 10, true, false);
    
    // Texte HP
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    const hpText = `${currentHP} / ${maxHP}`;
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
    
    // Sprite
    const spriteSize = 70;
    this.drawPokemonSprite(pokemon.speciesId || pokemon.id, x + w - 80, y + 20, spriteSize, spriteSize/70*58);
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
    this.selectedPokemon = pokemon;
    this.draw();
  }

  drawDetailsView() {
      const p = this.selectedPokemon;
      const ctx = this.ctx;
      
      if (!p) return;

      // Fond
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, this.width, this.height);
      
      // Reset buttons
      this.buttons = [];
      
      // Header: Nom du Pokémon
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(0, 0, this.width, 80);
      
      const name = p.surnom || p.name || p.nom || '???';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(name.toUpperCase(), this.width / 2, 55);
      
      // Colonne Gauche: Info & Stats
      const leftW = this.width * 0.4;
      
      // Sprite (Cercle fond)
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(leftW / 2, 200, 80, 0, Math.PI * 2);
      ctx.fill();
      
      // Render Sprite
      this.drawPokemonSprite(p.speciesId || p.id, leftW / 2 - 70, 200 - 58, 140, 116); // Scale 2x approximately
      
      // Infos de base
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Niveau ${p.niveau || p.level}`, leftW / 2, 320);
      
      // Barre XP
      const xpBarW = 300;
      const xpBarH = 15;
      const xpBarX = (leftW - xpBarW) / 2;
      const xpBarY = 340;
      
      ctx.fillStyle = '#333';
      this.roundRect(ctx, xpBarX, xpBarY, xpBarW, xpBarH, 5, true);
      
      const xpPercent = (p.xp - 0) / (p.xpNextLevel - 0); // TODO: Min XP for level
      ctx.fillStyle = '#4ade80';
      this.roundRect(ctx, xpBarX, xpBarY, xpBarW * Math.min(1, Math.max(0, xpPercent)), xpBarH, 5, true);
      
      // Stats
      const statY = 400;
      const statH = 40;
      const stats = [
          { label: 'PV', val: `${p.stats.hp}/${p.stats.hpMax}` },
          { label: 'Attaque', val: p.stats.attack },
          { label: 'Défense', val: p.stats.defense },
          { label: 'Spécial', val: p.stats.special },
          { label: 'Vitesse', val: p.stats.speed }
      ];
      
      ctx.font = '24px Arial';
      stats.forEach((s, i) => {
          const y = statY + i * statH;
          ctx.fillStyle = '#aaa';
          ctx.textAlign = 'left';
          ctx.fillText(s.label, 50, y);
          
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'right';
          ctx.fillText(s.val, leftW - 50, y);
      });
      
      // Colonne Droite: Attaques
      const rightX = leftW;
      const rightW = this.width - leftW;
      
      ctx.fillStyle = '#252540';
      this.roundRect(ctx, rightX + 20, 100, rightW - 40, this.height - 120, 20, true);
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('ATTAQUES', rightX + rightW / 2, 150);
      
      // Moves
      const moves = p.attaques || [];
      
      const moveH = 80;
      const moveGap = 20;
      const moveStartY = 180;
      
      for(let i=0; i<4; i++) {
          const moveName = moves[i] || '--';
          // Check ppActuels safely
          const pp = (p.ppActuels && p.ppActuels[i] !== undefined) ? p.ppActuels[i] : '--';
          const ppMax = (p.ppMax && p.ppMax[i] !== undefined) ? p.ppMax[i] : '--';
          
          const y = moveStartY + i * (moveH + moveGap);
          const x = rightX + 40;
          const w = rightW - 80;
          
          const btn = {
              x, y, w, h: moveH,
              label: moveName,
              action: () => console.log('Move clicked:', moveName)
          };
          
          const isHovered = this.hoveredButton?.label === moveName;
          
          // Fond Move
          ctx.fillStyle = isHovered ? '#333355' : '#1f1f35';
          this.roundRect(ctx, x, y, w, moveH, 10, true);
          
          // Type (Placeholder couleur)
          ctx.fillStyle = '#666'; 
          this.roundRect(ctx, x, y, 80, moveH, 10, true); // Left stripe
          
          // Nom
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'left';
          ctx.fillText(typeof moveName === 'string' ? moveName.toUpperCase() : '--', x + 100, y + 50);
          
          // PP
          if (moveName !== '--') {
              ctx.fillStyle = '#ffd700';
              ctx.textAlign = 'right';
              ctx.fillText(`PP ${pp}/${ppMax}`, x + w - 20, y + 50);
          }
          
          if (moveName !== '--') {
             this.buttons.push(btn);
          }
      }
      
      // Bouton Retour (Header)
      const backBtn = {
          x: 20,
          y: 25, // Easier to hit
          w: 140,
          h: 50,
          label: 'RETOUR',
          action: () => {
              this.selectedPokemon = null;
              this.draw();
          }
      };
      
      const isBackHovered = this.hoveredButton === backBtn;
      ctx.fillStyle = isBackHovered ? '#444' : '#333';
      this.roundRect(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, 10, true);
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(backBtn.label, backBtn.x + backBtn.w / 2, backBtn.y + 35);
      
      this.buttons.push(backBtn);
      
      this.texture.needsUpdate = true;
  }
}
