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
    
    // Positionner sur le poignet (Main Gauche)
    // "Face gauche" -> Côté extérieur du poignet gauche (côté petit doigt)
    // Coordonnées locales GripSpace: +Y Haut, +X Droite (Intérieur), -Z Avant
    
    // Position: X négatif (Gauche), Y centré, Z un peu en arrière
    // Positionner sur le poignet (Main Gauche)
    // "Face gauche" -> Côté extérieur
    // Correction "Vers nous" -> On augmente Z (vers le coude)
    // "Sens contraire montre" -> On tourne autour de l'axe du bras (Z) dans le sens trigo inverse ? (Horire = sens montre)
    // Sens montre = Visser. Sens contraire = Dévisser.
    // Rotation Z actuelle: PI/2. Sens contraire -> On augmente ? (PI/2 + ...)
    
    // Nouvelle position : Plus vers "nous" (+Z) et décalé
    // On rapproche un peu du poignet (X: -0.03 au lieu de -0.04) pour éviter l'effet flottant "au dessus"
    // Nouvelle position : Plus bas et plus à l'écart pour éviter le clipping
    this.container.position.set(-0.135, -0.050, 0.095); 
    
    // Rotation: Z = 2.04 (Calibré par user)
    this.container.rotation.set(0, 0, 2.04);
    
    // On enlève la rotation Y 'fine' qui causait peut-être le clipping
    // this.container.rotateY(Math.PI / 6); 
    
    this.baseScale = new THREE.Vector3(1, 1, 1);
    this.focusedScale = new THREE.Vector3(1.8, 1.8, 1.8);
    this.isFocused = false;
    
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
    this.menuMesh.rotation.z = Math.PI / 2; // Quart de tour (90°) au lieu de flip
    this.container.add(this.menuMesh);

    // Initialiser l'UI par défaut
    this.drawMainMenu();
  }

  createMenuInterface() {
     // Définir les boutons du menu principal
     const btnHeight = 60; // Un peu plus petit pour tout faire rentrer
     const gap = 12;
     const startY = 70;
     
     // Liste des menus
     const labels = ["ÉQUIPE", "SAC", "STOCKAGE", "POKÉDEX", "SAUVER", "QUITTER"];
     
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

  isButtonLocked(label) {
      // Logique de verrouillage (Starter requis)
      const starterRequired = ["ÉQUIPE", "SAC", "STOCKAGE", "POKÉDEX"];
      if (starterRequired.includes(label)) {
          // Vérifier si on a un starter via SaveManager
          // Note: game.saveManager.myPokemon est le tableau
          if (this.game.saveManager && this.game.saveManager.myPokemon && this.game.saveManager.myPokemon.length > 0) {
              return false; // Débloqué
          }
          return true; // Verrouillé
      }
      return false;
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
          const isLocked = this.isButtonLocked(btn.label);
          const isHover = (this.hoveredButton === btn);
          
          if (isLocked) {
              // Style VERROUILLÉ (Gris foncé)
              ctx.fillStyle = "#333333";
              this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10, true, false);
              
              // Bordure grise
              ctx.fillStyle = "#555555";
              ctx.fillRect(btn.x, btn.y, 10, btn.h);
              
              // Texte Gris
              ctx.fillStyle = "#888888";
              ctx.font = "bold 28px monospace";
              ctx.textAlign = "left";
              ctx.fillText(btn.label, btn.x + 30, btn.y + btn.h / 2 + 10);
              
              // Cadenas (Simple dessin)
              ctx.strokeStyle = "#888888";
              ctx.lineWidth = 3;
              const lockX = btn.x + btn.w - 40;
              const lockY = btn.y + btn.h / 2;
              // Corps
              ctx.strokeRect(lockX - 10, lockY - 8, 20, 16);
              // Anse
              ctx.beginPath();
              ctx.arc(lockX, lockY - 8, 7, Math.PI, 0);
              ctx.stroke();
              
          } else {
              // Style DÉBLOQUÉ
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
          }
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
      
      // Animation Scale
      const target = this.isFocused ? this.focusedScale : this.baseScale;
      this.container.scale.lerp(target, 0.1);
  }

  setFocus(focused) {
      if (this.isFocused !== focused) {
          this.isFocused = focused;
          // Optionnel: petit son ou effet ui ?
      }
  }

  click() {
      if (this.hoveredButton) {
          this.hoveredButton.action();
      }
  }
}
