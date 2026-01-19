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
      
      this.buttons = []; // Reset clickable zones

      if (!this.combatData) {
          ctx.fillStyle = "white";
          ctx.font = "40px Arial";
          ctx.textAlign = "center";
          ctx.fillText("Waiting for Combat Data...", this.width/2, this.height/2);
          this.texture.needsUpdate = true;
          return;
      }
      
      const { playerPokemon, wildPokemon } = this.combatData;

      // --- 1. DIALOGUE AREA (Top) ---
      // "Au dessus le dialogue"
      this.drawDialogueBar(0, 20, this.width, 100);
      
      // --- 2. HUD AREA (Right Side) ---
      // "Player droite en bas"
      // "Ennemi juste au dessus"
      const hudX = this.width / 2 + 20;
      const hudWidth = this.width / 2 - 40;
      
      // Enemy HUD (Top Right)
      if (wildPokemon) {
          this.drawUnitInfo(wildPokemon, hudX, 140, false);
      }
      
      // Player HUD (Bottom Right, under Enemy)
      if (playerPokemon) {
          this.drawUnitInfo(playerPokemon, hudX, 400, true);
      }
      
      // --- 3. MENU / ACTIONS AREA (Left Side) ---
      // Actions taking the left space
      const menuX = 20;
      const menuY = 140;
      const menuW = this.width / 2 - 40;
      const menuH = 500;
      
      this.drawMenuArea(menuX, menuY, menuW, menuH);
      
      this.texture.needsUpdate = true;
  }
  
  drawDialogueBar(x, y, w, h) {
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(x, y, w, h);
      
      const text = this.combatMessage || (this.combatData.playerPokemon ? `Que doit faire ${this.getPokemonName(this.combatData.playerPokemon)} ?` : "Combat !");
      
      ctx.fillStyle = "white";
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      this.wrapText(ctx, text, x + w/2, y + 60, w - 40, 40);
  }

  drawUnitInfo(pokemon, x, y, isPlayer) {
     const ctx = this.ctx;
     const w = 450;
     const h = 140;

     // Bg Panel
     ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
     this.roundRect(ctx, x, y, w, h, 10, true);

     // Name & Level
     ctx.fillStyle = "white";
     ctx.font = "bold 32px Arial";
     ctx.textAlign = "left";
     ctx.fillText(`${this.getPokemonName(pokemon)} Lv.${this.getPokemonLevel(pokemon)}`, x + 20, y + 45);

     // HP Bar - utiliser les helpers comme CombatManager
     const maxHp = this.getPokemonMaxHp(pokemon);
     const currentHp = Math.max(0, this.getPokemonHp(pokemon));
     const hpPercent = Math.max(0, Math.min(1, currentHp / maxHp));
     
     const barW = 400;
     const barH = 25;
     const barX = x + 20;
     const barY = y + 70;
     
     // Bg Bar
     ctx.fillStyle = "#555";
     this.roundRect(ctx, barX, barY, barW, barH, 5, true);
     
     // Fg Bar
     ctx.fillStyle = hpPercent > 0.5 ? "#00ff00" : (hpPercent > 0.2 ? "orange" : "red");
     // Simple rect logic for fill
     ctx.fillRect(barX, barY, barW * hpPercent, barH);
     
     // HP Text (Only for player usually, but let's show for both or just player as per user preference? 
     // "comme le desktop" suggests Player sees numbers, Enemy doesn't? But user said "point de vie ... a droite".)
     // Let's show numbers for Player only to be safe/clean.
     if (isPlayer) {
         ctx.fillStyle = "white";
         ctx.font = "24px Monospace";
         ctx.textAlign = "right";
         ctx.fillText(`${Math.floor(currentHp)} / ${maxHp}`, barX + barW, barY + barH + 30);
     }
  }
  
  drawMenuArea(x, y, w, h) {
      const ctx = this.ctx;
      
      if (this.menuState === "MAIN") {
           // 4 Big Buttons
           this.drawMainButtons(x, y, w, h);
      } else if (this.menuState === "ATTACKS") {
           this.drawAttackButtons(x, y, w, h);
      } else if (this.menuState === "SWITCH_PROMPT") {
           this.drawSwitchPrompt(x, y, w, h);
      } else if (this.menuState === "POKEMON_SELECT") {
           this.drawPokemonSelection(x, y, w, h);
      }
  }
  
  drawMainButtons(x, y, w, h) {
      // Vérifier si c'est un combat dresseur (pas de fuite possible)
      const isTrainerBattle = !!this.game.combatManager?.currentTrainer;

      let buttons;
      if (isTrainerBattle) {
          // Combat dresseur: 3 boutons (pas de fuite)
          buttons = [
              { label: "ATTAQUE", color: "#cc0000", action: () => this.setMenuState("ATTACKS") },
              { label: "SAC", color: "#cc8800", action: () => console.log("Sac clicked") },
              { label: "POKÉMON", color: "#008800", action: () => this.setMenuState("POKEMON_SELECT") }
          ];
      } else {
          // Combat sauvage: 4 boutons
          buttons = [
              { label: "ATTAQUE", color: "#cc0000", action: () => this.setMenuState("ATTACKS") },
              { label: "SAC", color: "#cc8800", action: () => console.log("Sac clicked") },
              { label: "POKÉMON", color: "#008800", action: () => this.setMenuState("POKEMON_SELECT") },
              { label: "FUITE", color: "#0000cc", action: () => this.game.combatManager.attemptRun() }
          ];
      }

      const gap = 15;
      const cols = 2;
      const rows = Math.ceil(buttons.length / cols);
      const btnW = (w - gap) / cols;
      const btnH = (h - gap * (rows - 1)) / rows;

      buttons.forEach((btn, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const bx = x + col * (btnW + gap);
          const by = y + row * (btnH + gap);

          this.drawButton(this.ctx, bx, by, btnW, btnH, btn.label, btn.color, btn.action);
      });
  }
  
  drawAttackButtons(x, y, w, h) {
       const moves = this.combatData.playerPokemon.attaques || [];
       const moveManager = this.game.combatManager?.moveManager;
       const gap = 15;

       // Zone for Moves (Top 80%)
       const movesH = h * 0.8;
       const btnW = (w - gap) / 2;
       const btnH = (movesH - gap) / 2;

       moves.forEach((moveId, i) => {
           if (i >= 4 || !moveId) return;
           const col = i % 2;
           const row = Math.floor(i / 2);
           const bx = x + col * (btnW + gap);
           const by = y + row * (btnH + gap);

           // Récupérer le nom de l'attaque via moveManager
           const move = moveManager ? moveManager.getMove(moveId) : null;
           const moveName = move ? move.nom : moveId.toString();

           this.drawButton(this.ctx, bx, by, btnW, btnH, moveName, "#444", () => {
               this.game.combatManager.handleCombatAction("use_move", moveId);
           });
       });

       // Back Button (Bottom 20%)
       const backY = y + movesH + 10;
       this.drawButton(this.ctx, x, backY, w, h - movesH - 10, "RETOUR", "#666", () => {
           this.setMenuState("MAIN");
       });
  }
  
  showSwitchPrompt(callbackYes, callbackNo) {
      this.menuState = "SWITCH_PROMPT";
      this.switchCallbackYes = callbackYes;
      this.switchCallbackNo = callbackNo;
      this.combatMessage = "Changer de Pokémon ?";
      this.draw();
  }
  
  drawSwitchPrompt(x, y, w, h) {
      // Yes / No Buttons
      const btnH = 80;
      const gap = 20;
      
      const centerY = y + h/2 - btnH;
      
      this.drawButton(this.ctx, x, centerY, w, btnH, "OUI", "#008800", () => {
          if (this.switchCallbackYes) this.switchCallbackYes();
          this.switchCallbackYes = null; // Reset
      });
      
      this.drawButton(this.ctx, x, centerY + btnH + gap, w, btnH, "NON", "#cc0000", () => {
          if (this.switchCallbackNo) this.switchCallbackNo();
          this.setMenuState("MAIN"); // Return to main if cancelled (or handled by callback)
          this.switchCallbackNo = null; 
      });
  }

  showPokemonSelection(callbackSelect) {
      this.menuState = "POKEMON_SELECT";
      this.pokemonSelectCallback = callbackSelect;
      this.combatMessage = "Choisis un Pokémon";
      this.draw();
  }

  drawPokemonSelection(x, y, w, h) {
      // List team members
      // Simple vertical list
      const team = this.game.saveManager.getTeam(); // Need access to full team
      // Or from this.combatData.playerTeam if available?
      // Use this.game.saveManager.myPokemon usually has 'equipe'
      
      // We need to fetch current team status (HP)
      const currentTeam = this.game.saveManager.getTeam();
      
      const btnH = 60;
      const gap = 10;
      
      currentTeam.forEach((pId, i) => {
          if (i >= 6) return;
          const pokemon = this.game.saveManager.getPokemon(pId);
          if (!pokemon) return;
          
          const by = y + i * (btnH + gap);
          const color = pokemon.hp > 0 ? "#444" : "#222"; // Dim if fainted
          const label = `${pokemon.surnom || pokemon.name} ${Math.floor(pokemon.hp)}/${pokemon.maxHp}`;
          
          this.drawButton(this.ctx, x, by, w, btnH, label, color, () => {
              if (pokemon.hp <= 0) return; // Can't switch to fainted
              if (pokemon === this.combatData.playerPokemon) return; // Already active

              if (this.pokemonSelectCallback) {
                   this.pokemonSelectCallback(i); // Pass index
                   this.pokemonSelectCallback = null;
              } else {
                   // Default behavior: user clicked "Pokemon" in menu
                   // Just switch? Need combat turn logic.
                   // TODO: Connect this to CombatManager switch
              }
          });
      });
      
      // Cancel button at bottom
      this.drawButton(this.ctx, x, y + h - 60, w, 60, "ANNULER", "#666", () => {
          this.setMenuState("MAIN");
      });
  }
  
  setMenuState(state) {
       this.menuState = state;
       this.draw();
  }

  getPokemonName(pokemon) {
    return pokemon.surnom || pokemon.name || pokemon.species || "???";
  }

  getPokemonHp(pokemon) {
    if (pokemon.stats && pokemon.stats.hp !== undefined) {
      return pokemon.stats.hp;
    }
    return pokemon.hp || 0;
  }

  getPokemonMaxHp(pokemon) {
    if (pokemon.stats && pokemon.stats.hpMax !== undefined) {
      return pokemon.stats.hpMax;
    }
    return pokemon.maxHp || pokemon.hp || 100;
  }

  getPokemonLevel(pokemon) {
    if (pokemon.stats && pokemon.stats.level !== undefined) {
      return pokemon.stats.level;
    }
    // Prioriser level (niveau actuel) sur niveau (niveau de rencontre)
    return pokemon.level || pokemon.niveau || 1;
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const cleanText = text.replace(/<[^>]*>/g, '');
    const words = cleanText.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }
  
  drawButton(ctx, x, y, w, h, label, color, action) {
       const btn = { x, y, w, h, label, action };
       // Simple hover check based entirely on "isHovered" logic managed by VRManager raycast
       // VRManager sets 'this.hoveredButton'
       let isHovered = false;
       
       if (this.hoveredButton && 
           this.hoveredButton.x === x && 
           this.hoveredButton.y === y &&
           this.hoveredButton.label === label) {
            isHovered = true;
       }
           
       ctx.fillStyle = isHovered ? "#ffffff" : color;
       this.roundRect(ctx, x, y, w, h, 10, true, true);
       
       ctx.fillStyle = isHovered ? "#000000" : "#ffffff";
       ctx.font = "bold 24px Arial";
       ctx.textAlign = "center";
       ctx.fillText(label, x + w/2, y + h/2 + 8);
       
       this.buttons.push(btn);
  }
  
  drawHover() {
      // Handled in drawButton
  }
}
