import * as THREE from "three";

export class Portal {
  constructor(
    scene,
    renderer,
    portalPosition,
    portalRotation,
    portalSize,
    targetScene
  ) {
    this.scene = scene;
    this.renderer = renderer;
    this.targetScene = targetScene;

    // Render Target avec meilleure qualité
    this.renderTarget = new THREE.WebGLRenderTarget(1024, 1024, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
    });

    // Caméra portail
    this.portalCamera = new THREE.PerspectiveCamera(
      75,
      portalSize.width / portalSize.height,
      0.1,
      1000
    );

    // Plane portail
    const geometry = new THREE.PlaneGeometry(
      portalSize.width,
      portalSize.height
    );
    const material = new THREE.MeshBasicMaterial({
      map: this.renderTarget.texture,
      side: THREE.DoubleSide,
    });

    this.portalMesh = new THREE.Mesh(geometry, material);
    this.portalMesh.position.copy(portalPosition);
    this.portalMesh.rotation.copy(portalRotation);

    // Marqueur userData pour éviter de render le portail dans lui-même
    this.portalMesh.updateMatrixWorld();
    this.portalMesh.userData.isPortal = true;

    this.scene.add(this.portalMesh);

    // ============= EFFET GLOW / BORDURE LUMINEUSE =============
    // Créer un cadre lumineux autour du portail pour le rendre plus visible
    this.createPortalFrame(portalPosition, portalRotation, portalSize);

    // Transform du portail cible (où spawner dans l'autre scène)
    this.linkedPortalPosition = new THREE.Vector3();
    this.linkedPortalRotation = new THREE.Euler();

    console.log("🚪 Portail créé");
  }

  setLinkedPortal(position, rotation) {
    this.linkedPortalPosition.copy(position);
    this.linkedPortalRotation.copy(rotation);
  }

  // Update la vue du portail
  update(playerCamera) {
    // Position du portail de destination
    const destPos = this.linkedPortalPosition.clone();
    const destRot = this.linkedPortalRotation.y;

    // Vue FIXE : caméra positionnée devant le côté bleu du portail destination
    // avec un petit offset pour être légèrement devant
    const offset = new THREE.Vector3(0, 0, 1.5);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), destRot);

    this.portalCamera.position.set(
      destPos.x + offset.x,
      destPos.y + 1.6, // Ajuster hauteur yeux
      destPos.z + offset.z
    );

    // Regarder dans la direction OPPOSÉE au côté bleu (dos au portail, face à la pièce)
    this.portalCamera.rotation.set(0, destRot + Math.PI, 0);
    this.portalCamera.updateMatrixWorld(); // Important pour le rendu

    // Render dans le target
    const oldRenderTarget = this.renderer.getRenderTarget();
    const currentXrEnabled = this.renderer.xr.enabled;
    
    // DÉSACTIVER XR POUR LE RENDU DE TEXTURE (sinon crash / écran noir)
    this.renderer.xr.enabled = false;
    
    this.portalMesh.visible = false;

    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.targetScene, this.portalCamera);
    this.renderer.setRenderTarget(oldRenderTarget);

    this.portalMesh.visible = true;

    // RÉACTIVER XR
    this.renderer.xr.enabled = currentXrEnabled;

    // Animer le glow du portail
    this.animateGlow(0.016); // ~60fps
  }

  // Vérifier si joueur traverse le portail
  checkCrossing(playerPosition) {
    const portalPos = this.portalMesh.position;
    const distance = playerPosition.distanceTo(portalPos);

    // Si très proche du portail (< 0.5m)
    return distance < 0.5;
  }

  getTeleportTransform() {
    return {
      position: this.linkedPortalPosition.clone(),
      rotation: this.linkedPortalRotation.clone(),
    };
  }

  /**
   * Crée un cadre lumineux autour du portail pour le rendre plus visible
   */
  createPortalFrame(position, rotation, size) {
    // Groupe pour contenir le cadre
    this.frameGroup = new THREE.Group();
    this.frameGroup.position.copy(position);
    this.frameGroup.rotation.copy(rotation);

    const frameWidth = 0.15;
    const glowColor = 0x00ffff; // Cyan lumineux
    const glowIntensity = 2;

    // Matériau émissif pour le glow
    const frameMaterial = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.9,
    });

    // Créer les 4 côtés du cadre
    // Haut
    const topGeom = new THREE.BoxGeometry(size.width + frameWidth * 2, frameWidth, frameWidth);
    const topMesh = new THREE.Mesh(topGeom, frameMaterial);
    topMesh.position.y = size.height / 2 + frameWidth / 2;
    this.frameGroup.add(topMesh);

    // Bas
    const bottomMesh = new THREE.Mesh(topGeom, frameMaterial);
    bottomMesh.position.y = -size.height / 2 - frameWidth / 2;
    this.frameGroup.add(bottomMesh);

    // Gauche
    const sideGeom = new THREE.BoxGeometry(frameWidth, size.height, frameWidth);
    const leftMesh = new THREE.Mesh(sideGeom, frameMaterial);
    leftMesh.position.x = -size.width / 2 - frameWidth / 2;
    this.frameGroup.add(leftMesh);

    // Droite
    const rightMesh = new THREE.Mesh(sideGeom, frameMaterial);
    rightMesh.position.x = size.width / 2 + frameWidth / 2;
    this.frameGroup.add(rightMesh);

    // Ajouter un effet de particules / lueur pulsante
    // Créer un halo semi-transparent derrière le portail
    const haloGeom = new THREE.PlaneGeometry(size.width + 0.5, size.height + 0.5);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    this.haloMesh = new THREE.Mesh(haloGeom, haloMaterial);
    this.haloMesh.position.z = -0.05; // Légèrement derrière le portail
    this.frameGroup.add(this.haloMesh);

    // Point light pour illuminer les environs
    this.portalLight = new THREE.PointLight(glowColor, glowIntensity, 8);
    this.portalLight.position.z = 0.5;
    this.frameGroup.add(this.portalLight);

    // Marquer comme portail
    this.frameGroup.userData.isPortalFrame = true;

    this.scene.add(this.frameGroup);

    // Stocker pour animation
    this._animTime = 0;
  }

  /**
   * Anime le glow du portail (à appeler dans update)
   */
  animateGlow(delta) {
    if (!this.haloMesh || !this.portalLight) return;

    this._animTime = (this._animTime || 0) + delta;

    // Pulsation de l'opacité du halo
    const pulse = 0.2 + Math.sin(this._animTime * 3) * 0.15;
    this.haloMesh.material.opacity = pulse;

    // Pulsation de l'intensité de la lumière
    this.portalLight.intensity = 1.5 + Math.sin(this._animTime * 2.5) * 0.5;
  }

  /**
   * Nettoie les ressources du portail
   */
  dispose() {
    if (this.portalMesh) {
      this.scene.remove(this.portalMesh);
      this.portalMesh.geometry.dispose();
      this.portalMesh.material.dispose();
    }
    if (this.frameGroup) {
      this.scene.remove(this.frameGroup);
      this.frameGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    if (this.renderTarget) {
      this.renderTarget.dispose();
    }
  }
}
