import * as THREE from "three";

export class VRWatchMenu {
  constructor(game) {
    this.game = game;
    this.scene = game.sceneManager; // On récupérera la scène active lors de l'update ou init
    
    this.container = new THREE.Group();
    this.menuMesh = null;
    this.canvas = null;
    this.ctx = null;
    this.texture = null;
    
    this.isVisible = false;
    this.buttons = [];
    
    // Configuration
    this.width = 512;
    this.height = 512;
    
    // État
    this.hoveredButton = null;
  }

  init(parentController) {
    this.createWatchMesh();
    this.createMenuInterface();
    
    // Positionner sur le poignet
    // Pour le contrôleur Oculus Touch gauche:
    // L'origine 'grip' est au centre de la poignée.
    // Le poignet est "derrière" (axe Z positif ou négatif selon orientation).
    // Généralement: +Z est vers l'arrière (vers l'utilisateur), +Y haut.
    // On recule sur Z et on ajuste la rotation pour faire face au visage quand on regarde le poignet.
    
    // Essai position poignet
    this.container.position.set(0.01, -0.01, 0.15); 
    // Rotation: pour que l'écran soit sur le dessus du poignet interne
    this.container.rotation.x = -Math.PI / 2; // Face vers le haut (relativement au grip)
    this.container.rotation.z = Math.PI / 4;  // Légère rotation intèrne
    this.container.rotation.y = Math.PI;      // Retourner pour faire face au joueur
    
    parentController.add(this.container);
  }

  createWatchMesh() {
    // 1. Bracelet (Style Rubber Noir/Rouge)
    const bandGeo = new THREE.TorusGeometry(0.04, 0.015, 16, 32, Math.PI); // Demi-tore
    const bandMat = new THREE.MeshStandardMaterial({ 
        color: 0x333333, 
        roughness: 0.6
    });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.rotation.x = Math.PI / 2; // Coucher sur le poignet
    band.scale.set(1, 0.8, 1); // Ovaliser
    this.container.add(band);

    // 2. Écran (Boîtier Pokédex Style - Rouge)
    const caseGeo = new THREE.BoxGeometry(0.07, 0.015, 0.08); // Plus large
    const caseMat = new THREE.MeshStandardMaterial({ 
        color: 0xcc0000, // ROUGE POKEMON
        metalness: 0.6,
        roughness: 0.4
    });
    const watchCase = new THREE.Mesh(caseGeo, caseMat);
    watchCase.position.y = 0.04; // Au dessus du bracelet
    this.container.add(watchCase);

    // Déco boitier (Bouton bleu)
    const btnGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.005, 16);
    const btnMat = new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: 0x0044aa });
    const decoBtn = new THREE.Mesh(btnGeo, btnMat);
    decoBtn.position.set(0.03, 0.048, 0.03);
    this.container.add(decoBtn);

    // 3. Écran (Surface tactile)
    // Canvas pour l'UI
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');
    
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.anisotropy = 4;
    
    const screenGeo = new THREE.PlaneGeometry(0.06, 0.065);
    const screenMat = new THREE.MeshBasicMaterial({ 
        map: this.texture,
        transparent: false // Opaque pour écran allumé
    });
    
    this.menuMesh = new THREE.Mesh(screenGeo, screenMat);
    this.menuMesh.position.y = 0.048; // Légèrement au dessus du boîtier
    this.menuMesh.rotation.x = -Math.PI / 2;
    this.container.add(this.menuMesh);

    // Initialiser l'UI par défaut
    this.drawMainMenu();
  }

  createMenuInterface() {
     // Définir les boutons du menu principal
     const btnHeight = 70;
     const gap = 15;
     const startY = 80;
     
     const labels = ["ÉQUIPE", "SAC", "POKÉDEX", "SAUVER", "QUITTER"];
     
     this.buttons = labels.map((label, index) => {
         return {
             id: label.toLowerCase(),
             label: label,
             x: 40,
             y: startY + index * (btnHeight + gap),
             w: 432,
             h: btnHeight,
             action: () => this.handleAction(label)
         };
     });
  }

  drawMainMenu() {
      const ctx = this.ctx;
      
      // Fond Ecran (Digital Blue/Green ou Black)
      ctx.fillStyle = "#222222";
      ctx.fillRect(0, 0, this.width, this.height);
      
      // Header Style Pokédex
      ctx.fillStyle = "#cc0000";
      ctx.fillRect(0, 0, this.width, 60);
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px Arial";
      ctx.textAlign = "center";
      ctx.fillText("POKÉ WATCH", this.width / 2, 40);

      // Boutons
      this.buttons.forEach(btn => {
          // Style boutton
          const isHover = (this.hoveredButton === btn);
          
          // Fond bouton (Blanc ou Gris clair si hover)
          ctx.fillStyle = isHover ? "#ffffff" : "#444444";
          
          // Forme arrondie tech
          this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10, true, true);
          
          // Bordure gauche couleur type (Rouge/Bleu)
          ctx.fillStyle = isHover ? "#cc0000" : "#00d2ff";
          ctx.fillRect(btn.x, btn.y, 10, btn.h);

          // Texte
          ctx.fillStyle = isHover ? "#cc0000" : "#ffffff";
          ctx.font = "bold 28px monospace";
          ctx.textAlign = "left";
          ctx.fillText(btn.label, btn.x + 30, btn.y + btn.h / 2 + 10);
      });

      this.texture.needsUpdate = true;
  }
  
  // Helper pour roundRect (pas toujours dispo en context 2d standard ancien)
  roundRect(ctx, x, y, width, height, radius, fill, stroke) {
      if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(x, y, width, height, radius);
          if (fill) ctx.fill();
          if (stroke) ctx.stroke();
      } else {
          // Fallback simple
          ctx.fillRect(x, y, width, height);
      }
  }

  handleAction(action) {
      console.log(`[Watch] Action: ${action}`);
      
      // Feedback visuel immédiat (Flash)
      const prevColor = this.ctx.fillStyle;
      this.ctx.fillStyle = "#ffffff";
      this.ctx.fillRect(0,0, this.width, this.height);
      this.texture.needsUpdate = true;
      
      setTimeout(() => {
          this.drawMainMenu();
      }, 100);

      if (action === "QUITTER") {
           if (this.game.vrManager.session) {
               this.game.vrManager.session.end();
           }
      } else {
          // Pour l'instant, log seulement car pas d'UI 3D pour le sac
          console.log("Menu non implémenté en VR : " + action);
      }
  }

  update(raycaster) {
      // Raycasting pour l'interaction
      if (!this.menuMesh || !this.isVisible) return;
      
      // Reset hover
      const oldHover = this.hoveredButton;
      this.hoveredButton = null;

      // Check intersection
      const intersects = raycaster.intersectObject(this.menuMesh);

      
      if (intersects.length > 0) {
          const uv = intersects[0].uv;
          // Convertir UV en coordonnées Canvas
          const x = uv.x * this.width;
          const y = (1 - uv.y) * this.height;
          
          // Vérifier bouton
          this.buttons.forEach(btn => {
              if (x >= btn.x && x <= btn.x + btn.w &&
                  y >= btn.y && y <= btn.y + btn.h) {
                  this.hoveredButton = btn;
              }
          });
      }

      // VÃ©rifier si changement d'Ã©tat pour redraw
      if (this.hoveredButton !== oldHover) {
          this.drawMainMenu();
      }
  }

  click() {
      if (this.hoveredButton) {
          this.hoveredButton.action();
      }
  }
}
