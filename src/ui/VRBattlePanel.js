import { VRMenuPanel } from './VRMenuPanel.js';

export class VRBattlePanel extends VRMenuPanel {
  constructor(game) {
    super(game, 1024, 768); // Canvas resolution
    
    // State
    this.combatData = null; // { playerPokemon, wildPokemon, message }
    this.menuState = "MAIN"; // MAIN, ATTACKS, ITEMS, POKEMON
    this.combatMessage = "";
    
    // Initialization des sprites si nécessaire (déjà chargé dans VRMenuPanel)
  }
  
  /**
   * Called when combat starts or updates
   * @param {Object} data - Contains pokemon info, hp, flags
   */
  updateCombatState(data) {
      this.combatData = data;
      this.draw();
  }
  
  showMessage(msg) {
      this.combatMessage = msg;
      this.draw();
  }
  
  draw() {
      const ctx = this.ctx;
      
      // Fond (Semi-transparent Black/Red gradient for Battle)
      const grad = ctx.createLinearGradient(0, 0, 0, this.height);
      grad.addColorStop(0, '#2c0000');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
      
      // Border
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, this.width - 10, this.height - 10);
      
      if (!this.combatData) {
          ctx.fillStyle = "white";
          ctx.font = "40px Arial";
          ctx.textAlign = "center";
          ctx.fillText("Waiting for Combat Data...", this.width/2, this.height/2);
          this.texture.needsUpdate = true;
          return;
      }
      
      const { playerPokemon, wildPokemon } = this.combatData;
      
      // --- HEADER: Wild Pokemon (Top Left) --- (Legacy style: Top Left / Bottom Right)
      // Actually standard: Enemy Top-Left / Player Bottom-Right
      if (wildPokemon) {
          this.drawUnitInfo(wildPokemon, 50, 50, false);
      }
      
      // --- FOOTER: Player Pokemon (Bottom Right area) ---
      if (playerPokemon) {
          this.drawUnitInfo(playerPokemon, this.width - 450, 400, true);
      }
      
      // --- MENUS (Bottom) ---
      this.drawMenu(0, this.height - 250, this.width, 250);
      
      this.texture.needsUpdate = true;
  }
  
  drawUnitInfo(pokemon, x, y, isPlayer) {
     const ctx = this.ctx;
     const w = 400;
     const h = 120;
     
     // Bg Panel
     ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
     this.roundRect(ctx, x, y, w, h, 10, true);
     
     // Name & Level
     ctx.fillStyle = "white";
     ctx.font = "bold 30px Arial";
     ctx.textAlign = "left";
     ctx.fillText(`${pokemon.nom} Lv.${pokemon.level}`, x + 20, y + 40);
     
     // HP Bar
     const maxHp = pokemon.maxHp;
     const currentHp = pokemon.hp;
     const hpPercent = Math.max(0, Math.min(1, currentHp / maxHp));
     
     const barW = 360;
     const barH = 20;
     const barX = x + 20;
     const barY = y + 60;
     
     // Bg Bar
     ctx.fillStyle = "#555";
     ctx.fillRect(barX, barY, barW, barH);
     
     // Fg Bar (Color based on HP)
     ctx.fillStyle = hpPercent > 0.5 ? "#00ff00" : (hpPercent > 0.2 ? "orange" : "red");
     ctx.fillRect(barX, barY, barW * hpPercent, barH);
     
     // HP Text
     ctx.fillStyle = "white";
     ctx.font = "20px Monospace";
     ctx.fillText(`${Math.floor(currentHp)} / ${maxHp}`, barX + barW - 120, barY + 40);
  }
  
  drawMenu(x, y, w, h) {
      const ctx = this.ctx;
      
      // Menu Bg
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);
      
      // Message Area (Left)
      ctx.fillStyle = "white";
      ctx.font = "30px Arial";
      ctx.textAlign = "left";
      this.wrapText(ctx, this.combatMessage || `Que doit faire ${this.combatData.playerPokemon?.nom || 'PKMN'} ?`, x + 30, y + 50, w/2 - 40, 40);
      
      // Buttons Area (Right)
      // We will place clickable buttons here
      this.buttons = []; // Reset clickable zones
      
      const btnAreaX = w/2;
      const btnAreaY = y + 20;
      const btnAreaW = w/2 - 20;
      const btnAreaH = h - 40;
      
      if (this.menuState === "MAIN") {
          this.drawMainButtons(btnAreaX, btnAreaY, btnAreaW, btnAreaH);
      } else if (this.menuState === "ATTACKS") {
          this.drawAttackButtons(btnAreaX, btnAreaY, btnAreaW, btnAreaH);
      }
      
      // Draw hover highlight
      this.drawHover();
  }
  
  drawMainButtons(x, y, w, h) {
      const ctx = this.ctx;
      // Grid 2x2
      const labels = ["ATTAQUE", "SAC", "ÉQUIPE", "FUITE"];
      const colors = ["#cc0000", "#cc8800", "#008800", "#0000cc"];
      const actions = [
          () => this.setMenuState("ATTACKS"), 
          () => console.log("Sac clicked"), // TODO
          () => console.log("Equipe clicked"), // TODO
          () => this.game.combatManager.attemptRun() // TODO check binding
      ];
      
      const gap = 10;
      const btnW = (w - gap)/2;
      const btnH = (h - gap)/2;
      
      labels.forEach((label, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const bx = x + col * (btnW + gap);
          const by = y + row * (btnH + gap);
          
          this.drawButton(ctx, bx, by, btnW, btnH, label, colors[i], actions[i]);
      });
  }
  
  drawAttackButtons(x, y, w, h) {
       const ctx = this.ctx;
       // We assume combatData has attacks
       // TODO: Fetch moves from MoveManager or Pokemon info
       const moves = this.combatData.playerPokemon.attaques || []; 
       
       // Back Button?
       // Let's use 4 slots
       const gap = 10;
       const btnW = (w - gap)/2;
       const btnH = (h - gap)/2;
       
       moves.forEach((moveId, i) => {
           if (i >= 4) return;
           const col = i % 2;
           const row = Math.floor(i / 2);
           const bx = x + col * (btnW + gap);
           const by = y + row * (btnH + gap);
           
           // Fetch Move Name (Need MoveManager access)
           // Warning: combatData might not have resolved moves
           // Use helper or basic ID
           
           this.drawButton(ctx, bx, by, btnW, btnH, moveId.toString(), "#444", () => {
               this.game.combatManager.handleCombatAction("use_move", moveId); // Hypothetical
           });
       });
       
       // Add Return Button override if < 4 moves?
       // Or external Return button?
       // For now, B button on controller acts as Back? Or we need visual back.
  }
  
  setMenuState(state) {
      this.menuState = state;
      this.draw();
  }
  
  drawButton(ctx, x, y, w, h, label, color, action) {
      const btn = { x, y, w, h, label, action };
      const isHovered = this.hoveredButton && 
          this.hoveredButton.x === x && this.hoveredButton.y === y; // Simple identity check
          
      ctx.fillStyle = isHovered ? "#ffffff" : color;
      this.roundRect(ctx, x, y, w, h, 10, true, true);
      
      ctx.fillStyle = isHovered ? "#000000" : "#ffffff";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.fillText(label, x + w/2, y + h/2 + 8);
      
      this.buttons.push(btn);
  }
  
  drawHover() {
      // Logic handled in drawButton via this.hoveredButton
  }
}
