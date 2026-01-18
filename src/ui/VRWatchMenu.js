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
    
    // Positionner sur le poignet (ajustement manuel selon le contrôleur)
    // Pour le contrôleur Oculus Touch gauche:
    // Position: légèrement en arrière et rotate
    this.container.position.set(0.0, 0.02, 0.05); 
    this.container.rotation.x = -Math.PI / 2;
    
    parentController.add(this.container);
  }

  createWatchMesh() {
    // 1. Bracelet
    const bandGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.06, 32, 1, true);
    // Couper le cylindre pour faire un C
    const bandMat = new THREE.MeshStandardMaterial({ 
        color: 0x222222, 
        roughness: 0.8,
        side: THREE.DoubleSide
    });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.rotation.z = Math.PI / 2;
    this.container.add(band);

    // 2. Écran (Boîtier)
    const caseGeo = new THREE.BoxGeometry(0.06, 0.01, 0.07);
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 });
    const watchCase = new THREE.Mesh(caseGeo, caseMat);
    watchCase.position.y = 0.04;
    this.container.add(watchCase);

    // 3. Écran (Surface tactile)
    // Canvas pour l'UI
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');
    
    this.texture = new THREE.CanvasTexture(this.canvas);
    
    const screenGeo = new THREE.PlaneGeometry(0.05, 0.06);
    const screenMat = new THREE.MeshBasicMaterial({ 
        map: this.texture,
        transparent: true,
        opacity: 0.9
    });
    
    this.menuMesh = new THREE.Mesh(screenGeo, screenMat);
    this.menuMesh.position.y = 0.046; // Légèrement au dessus du boîtier
    this.menuMesh.rotation.x = -Math.PI / 2;
    this.container.add(this.menuMesh);

    // Initialiser l'UI par défaut
    this.drawMainMenu();
  }

  createMenuInterface() {
     // Définir les boutons du menu principal
     const btnHeight = 80;
     const gap = 20;
     const startY = 60;
     
     const labels = ["Équipe", "Sac", "Pokédex", "Sauvegarder", "Quitter VR"];
     
     this.buttons = labels.map((label, index) => {
         return {
             id: label.toLowerCase(),
             label: label,
             x: 50,
             y: startY + index * (btnHeight + gap),
             w: 412,
             h: btnHeight,
             action: () => this.handleAction(label)
         };
     });
  }

  drawMainMenu() {
      const ctx = this.ctx;
      
      // Fond
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, this.width, this.height);
      
      // Bordure high-tech
      ctx.strokeStyle = "#00d2ff";
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, this.width - 20, this.height - 20);

      // Titre
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 40px Arial";
      ctx.textAlign = "center";
      ctx.fillText("POKÉMON VR", this.width / 2, 45);

      // Boutons
      this.buttons.forEach(btn => {
          // Style boutton
          const isHover = (this.hoveredButton === btn);
          
          ctx.fillStyle = isHover ? "#00c3ff" : "#333333";
          ctx.beginPath();
          ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 15);
          ctx.fill();
          
          ctx.strokeStyle = "#555555";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Texte
          ctx.fillStyle = isHover ? "#000000" : "#ffffff";
          ctx.font = "30px Arial";
          ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 10);
      });

      this.texture.needsUpdate = true;
  }

  handleAction(action) {
      console.log(`[Watch] Action: ${action}`);
      
      if (action === "Quitter VR") {
          // Sortir de la session WebXR
          // Note: On ne peut pas forcer la sortie facilement, mais on peut rediriger ou suggérer
           if (this.game.vrManager.session) {
               this.game.vrManager.session.end();
           }
      }
      
      // TODO: Implémenter les autres menus (bridging vers game.ui)
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
