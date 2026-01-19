import { VRMenuPanel } from './VRMenuPanel.js';

/**
 * VROptionsPanel - Menu des options en VR
 * Permet de configurer le jeu (volume, contrôles, etc.)
 */
export class VROptionsPanel extends VRMenuPanel {
  constructor(game) {
    super(game, 1024, 768);
    
    // Options par défaut
    this.options = {
      volume: 70,
      musicVolume: 80,
      sfxVolume: 90,
      textSpeed: 1, // 0=Lent, 1=Normal, 2=Rapide
      battleAnimations: true,
      autoSave: true
    };
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
    ctx.fillText('OPTIONS', this.width / 2, 50);
    
    // Reset buttons
    this.buttons = [];
    
    const startY = 120;
    const lineHeight = 90;
    let currentY = startY;
    
    // Volume Principal
    this.drawSlider('Volume Principal', this.options.volume, 50, currentY, (value) => {
      this.options.volume = value;
      if (this.game.audioManager) {
          this.game.audioManager.volume = value / 100;
          // Apply to current music immediately
          if (this.game.audioManager.currentMusic) {
              this.game.audioManager.currentMusic.volume = value / 100;
          }
      }
    });
    currentY += lineHeight;
    
    // Volume Musique
    this.drawSlider('Musique', this.options.musicVolume, 50, currentY, (value) => {
      this.options.musicVolume = value;
      // TODO: Appliquer le volume musique
    });
    currentY += lineHeight;
    
    // Volume Effets Sonores
    this.drawSlider('Effets Sonores', this.options.sfxVolume, 50, currentY, (value) => {
      this.options.sfxVolume = value;
      // TODO: SFX Volume implementation
    });
    currentY += lineHeight;
    
    // Vitesse du texte
    this.drawSelector('Vitesse du Texte', ['Lent', 'Normal', 'Rapide'], this.options.textSpeed, 50, currentY, (index) => {
      this.options.textSpeed = index;
    });
    currentY += lineHeight;
    
    // Animations de combat
    this.drawToggle('Animations de Combat', this.options.battleAnimations, 50, currentY, (value) => {
      this.options.battleAnimations = value;
    });
    currentY += lineHeight;
    
    // Sauvegarde auto
    this.drawToggle('Sauvegarde Automatique', this.options.autoSave, 50, currentY, (value) => {
      this.options.autoSave = value;
    });
    currentY += lineHeight;

    // Main de la Montre
    const currentHand = this.game.vrManager ? (this.game.vrManager.watchHand === 'left' ? 'Gauche' : 'Droite') : 'Gauche';
    this.drawSelector('Main Montre', ['Gauche', 'Droite'], currentHand === 'Gauche' ? 0 : 1, 50, currentY, (index) => {
        const hand = index === 0 ? 'left' : 'right';
        if (this.game.vrManager) this.game.vrManager.switchWatchHand(hand);
    });
    
    // Bouton SAUVEGARDER
    const saveBtn = {
        x: this.width - 350, // Gauche du bouton fermer
        y: this.height - 80,
        w: 150,
        h: 60,
        label: 'SAUVER',
        action: () => {
            if (this.game.saveManager) {
                this.game.saveManager.save();
                console.log("[VROptions] Game Saved");
                // Feedback visuel optionnel (TODO)
            }
        }
    };
    this.drawButton(saveBtn, this.hoveredButton === saveBtn);
    this.buttons.push(saveBtn);
    
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
  
  drawSlider(label, value, x, y, onChange) {
    const ctx = this.ctx;
    const sliderWidth = 600;
    const sliderHeight = 20;
    const sliderX = x + 350;
    
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y + 30);
    
    // Fond slider
    ctx.fillStyle = '#333';
    this.roundRect(ctx, sliderX, y + 10, sliderWidth, sliderHeight, 10, true, false);
    
    // Remplissage
    ctx.fillStyle = '#cc0000';
    this.roundRect(ctx, sliderX, y + 10, sliderWidth * (value / 100), sliderHeight, 10, true, false);
    
    // Valeur
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${value}%`, sliderX + sliderWidth + 60, y + 27);
    
    // Boutons - et +
    const btnSize = 40;
    const btnMinus = {
      x: sliderX - btnSize - 10,
      y: y + 5,
      w: btnSize,
      h: btnSize,
      label: '-',
      font: 'bold 30px Arial',
      action: () => {
        const newValue = Math.max(0, value - 10);
        onChange(newValue);
        this.draw();
      }
    };
    
    const btnPlus = {
      x: sliderX + sliderWidth + 70,
      y: y + 5,
      w: btnSize,
      h: btnSize,
      label: '+',
      font: 'bold 30px Arial',
      action: () => {
        const newValue = Math.min(100, value + 10);
        onChange(newValue);
        this.draw();
      }
    };
    
    this.drawButton(btnMinus, this.hoveredButton === btnMinus);
    this.drawButton(btnPlus, this.hoveredButton === btnPlus);
    
    this.buttons.push(btnMinus, btnPlus);
  }
  
  drawSelector(label, options, selectedIndex, x, y, onChange) {
    const ctx = this.ctx;
    
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y + 30);
    
    // Valeur actuelle
    const valueX = x + 350;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(options[selectedIndex], valueX + 150, y + 30);
    
    // Boutons < et >
    const btnSize = 40;
    const btnPrev = {
      x: valueX,
      y: y + 5,
      w: btnSize,
      h: btnSize,
      label: '<',
      font: 'bold 30px Arial',
      action: () => {
        const newIndex = (selectedIndex - 1 + options.length) % options.length;
        onChange(newIndex);
        this.draw();
      }
    };
    
    const btnNext = {
      x: valueX + 260,
      y: y + 5,
      w: btnSize,
      h: btnSize,
      label: '>',
      font: 'bold 30px Arial',
      action: () => {
        const newIndex = (selectedIndex + 1) % options.length;
        onChange(newIndex);
        this.draw();
      }
    };
    
    this.drawButton(btnPrev, this.hoveredButton === btnPrev);
    this.drawButton(btnNext, this.hoveredButton === btnNext);
    
    this.buttons.push(btnPrev, btnNext);
  }
  
  drawToggle(label, value, x, y, onChange) {
    const ctx = this.ctx;
    
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y + 30);
    
    // Toggle switch
    const toggleX = x + 350;
    const toggleY = y + 5;
    const toggleW = 100;
    const toggleH = 40;
    
    const toggleBtn = {
      x: toggleX,
      y: toggleY,
      w: toggleW,
      h: toggleH,
      label: value ? 'ON' : 'OFF',
      action: () => {
        onChange(!value);
        this.draw();
      }
    };
    
    // Fond
    ctx.fillStyle = value ? '#4ade80' : '#666';
    this.roundRect(ctx, toggleX, toggleY, toggleW, toggleH, 20, true, false);
    
    // Texte
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(value ? 'ON' : 'OFF', toggleX + toggleW / 2, toggleY + toggleH / 2 + 7);
    
    this.buttons.push(toggleBtn);
  }
}
