import * as THREE from "three";

/**
 * VRMenuPanel - Classe de base pour tous les panneaux de menu VR
 * Affiche un panneau 3D avec texture canvas au-dessus de la montre VR
 */
export class VRMenuPanel {
  constructor(game, width = 1024, height = 768) {
    this.game = game;
    this.width = width;
    this.height = height;
    
    // Canvas 2D pour le rendu
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');
    
    // Mesh 3D
    this.mesh = null;
    this.texture = null;
    this.isVisible = false;
    
    // Interactions
    this.buttons = [];
    this.hoveredButton = null;
    this.lastInputTime = 0;
    this.inputCooldown = 300; // ms
    
    // Chargement des sprites
    this.pokemonSpriteSheet = new Image();
    this.pokemonSpriteSheet.src = "assets/sprites/sprite_pokemon.png";
    this.pokemonSpriteSheet.onload = () => { if (this.isVisible) this.draw(); };
    
    this.itemSpriteSheet = new Image();
    this.itemSpriteSheet.src = "assets/sprites/sprite_objet.png";
    this.itemSpriteSheet.onload = () => { if (this.isVisible) this.draw(); };

    this.createMesh();
  }
  
  createMesh() {
    // Créer la texture canvas
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.anisotropy = 4;
    
    // Créer le mesh du panneau (40cm x 30cm)
    const geometry = new THREE.PlaneGeometry(0.4, 0.3);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = false;
    
    // Metadata pour raycast
    this.mesh.userData.isVRMenuPanel = true;
    this.mesh.userData.panel = this;
  }
  
  show(parentObject) {
    if (this.isVisible) return;
    
    console.log(`[VRMenuPanel] Showing ${this.constructor.name}`);
    
    // Ajouter à la scène si pas déjà fait
    if (!this.mesh.parent) {
      parentObject.add(this.mesh);
    }
    
    // Positionner au-dessus de la montre
    // Position relative au container de la montre
    this.mesh.position.set(
      0,      // Centré horizontalement
      0.15,   // 15cm au-dessus
      0.05    // Légèrement vers l'avant
    );
    
    // Rotation pour faire face au joueur ET matcher l'orientation de la montre
    // La montre a rotation.z = PI/2, donc on fait pareil
    this.mesh.rotation.x = -Math.PI / 2; // Couché à plat
    this.mesh.rotation.z = Math.PI / 2;  // Tourné 90° comme la montre
    
    // Animation d'apparition
    this.mesh.scale.set(0.01, 0.01, 0.01);
    this.mesh.visible = true;
    this.isVisible = true;
    
    // Dessiner le contenu
    this.draw();
    
    // Animer l'apparition
    this.animateShow();
  }
  
  animateShow() {
    const startTime = Date.now();
    const duration = 200; // ms
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      this.mesh.scale.set(eased, eased, eased);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }
  
  hide() {
    if (!this.isVisible) return;
    
    console.log(`[VRMenuPanel] Hiding ${this.constructor.name}`);
    
    // Animation de disparition
    const startTime = Date.now();
    const duration = 150;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const scale = 1 - progress;
      this.mesh.scale.set(scale, scale, scale);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.mesh.visible = false;
        this.isVisible = false;
        
        // Retirer de la scène
        if (this.mesh.parent) {
          this.mesh.parent.remove(this.mesh);
        }
      }
    };
    
    animate();
  }
  
  /**
   * Dessiner le contenu du panneau
   * À implémenter dans les sous-classes
   */
  draw() {
    // Fond par défaut
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Texte par défaut
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 40px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('VRMenuPanel', this.width / 2, this.height / 2);
    
    this.texture.needsUpdate = true;
  }
  
  /**
   * Vérifier si un clic UV correspond à un bouton
   */
  checkClick(uv) {
    // Cooldown pour éviter les clics multiples
    if (Date.now() - this.lastInputTime < this.inputCooldown) {
      console.log(`[VRMenuPanel] Click ignored - cooldown active`);
      return null;
    }
    
    // Convertir UV en coordonnées canvas
    const x = uv.x * this.width;
    const y = (1 - uv.y) * this.height;
    
    console.log(`[VRMenuPanel] Click at canvas coords: (${x.toFixed(0)}, ${y.toFixed(0)})`);
    
    // Chercher le bouton cliqué
    for (const button of this.buttons) {
      if (x >= button.x && x <= button.x + button.w &&
          y >= button.y && y <= button.y + button.h) {
        
        console.log(`[VRMenuPanel] Button found: ${button.label || 'unnamed'} at (${button.x}, ${button.y}, ${button.w}x${button.h})`);
        
        // Vérifier si le bouton est disabled
        if (button.disabled) {
          console.log(`[VRMenuPanel] Button disabled: ${button.label || 'unnamed'}`);
          return null;
        }
        
        this.lastInputTime = Date.now();
        return button;
      }
    }
    
    console.log(`[VRMenuPanel] No button found at this position. Total buttons: ${this.buttons.length}`);
    return null;
  }
  
  /**
   * Mettre à jour le hover
   */
  updateHover(uv) {
    if (!uv) {
      if (this.hoveredButton) {
        this.hoveredButton = null;
        this.draw();
      }
      return;
    }
    
    const x = uv.x * this.width;
    const y = (1 - uv.y) * this.height;
    
    let newHover = null;
    
    for (const button of this.buttons) {
      if (x >= button.x && x <= button.x + button.w &&
          y >= button.y && y <= button.y + button.h) {
        newHover = button;
        break;
      }
    }
    
    if (newHover !== this.hoveredButton) {
      this.hoveredButton = newHover;
      this.draw();
    }
  }
  
  /**
   * Helper pour dessiner un rectangle arrondi
   */
  roundRect(ctx, x, y, width, height, radius, fill = true, stroke = false) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    } else {
      // Fallback
      ctx.fillRect(x, y, width, height);
    }
  }
  
  /**
   * Helper pour dessiner un bouton
   */
  drawButton(button, isHovered = false) {
    const ctx = this.ctx;
    
    // Fond
    if (button.disabled) {
      ctx.fillStyle = '#333';
    } else {
      ctx.fillStyle = isHovered ? '#cc0000' : '#444';
    }
    
    this.roundRect(ctx, button.x, button.y, button.w, button.h, 10, true, false);
    
    // Bordure gauche
    if (!button.disabled) {
      ctx.fillStyle = isHovered ? '#ff0000' : '#00d2ff';
      ctx.fillRect(button.x, button.y, 5, button.h);
    }
    
    // Texte
    ctx.textAlign = 'center';
    ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 8);
  }

  drawPokemonSprite(id, x, y, w, h) {
      if (!this.pokemonSpriteSheet.complete || this.pokemonSpriteSheet.naturalWidth === 0) {
          // Fallback circle
          const ctx = this.ctx;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(x + w/2, y + h/2, Math.min(w,h)/2, 0, Math.PI*2);
          ctx.fill();
          return;
      }
      
      const config = { width: 70, height: 58, cols: 10 };
      
      // Gestion des variantes (Méga, Alola, etc.)
      const POKEMON_WITH_EXTRA = [
        3, 6, 9, 15, 18, 19, 20, 25, 26, 27, 28, 37, 38, 50, 51, 52, 53, 
        65, 74, 75, 76, 80, 88, 89, 94, 102, 103, 105, 115, 127, 130, 133, 142, 150
      ];
      
      const pId = parseInt(id);
      let offset = 0;
      for (const megaId of POKEMON_WITH_EXTRA) {
        if (pId > megaId) {
          offset++;
        }
      }
      
      const index = Math.max(0, pId - 1 + offset);
      
      const col = index % config.cols;
      const row = Math.floor(index / config.cols);
      
      const sx = col * config.width;
      const sy = row * config.height;
      
      // Image pixelated
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(
          this.pokemonSpriteSheet,
          sx, sy, config.width, config.height,
          x, y, w, h
      );
  }
}
