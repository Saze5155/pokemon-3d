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
    
    // Rotation pour faire face au joueur
    this.mesh.rotation.x = -Math.PI / 6; // Incliné vers le joueur (30°)
    
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
      return null;
    }
    
    // Convertir UV en coordonnées canvas
    const x = uv.x * this.width;
    const y = (1 - uv.y) * this.height;
    
    // Chercher le bouton cliqué
    for (const button of this.buttons) {
      if (x >= button.x && x <= button.x + button.w &&
          y >= button.y && y <= button.y + button.h) {
        
        // Vérifier si le bouton est disabled
        if (button.disabled) {
          console.log(`[VRMenuPanel] Button disabled: ${button.label || 'unnamed'}`);
          return null;
        }
        
        this.lastInputTime = Date.now();
        return button;
      }
    }
    
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
    ctx.fillStyle = button.disabled ? '#666' : (isHovered ? '#fff' : '#ddd');
    ctx.font = button.font || 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 8);
  }
}
