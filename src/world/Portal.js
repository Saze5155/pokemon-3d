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
      destPos.y,
      destPos.z + offset.z
    );

    // Regarder dans la direction OPPOSÉE au côté bleu (dos au portail, face à la pièce)
    this.portalCamera.rotation.set(0, destRot + Math.PI, 0);

    // Render dans le target
    const oldRenderTarget = this.renderer.getRenderTarget();
    this.portalMesh.visible = false;

    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.targetScene, this.portalCamera);
    this.renderer.setRenderTarget(oldRenderTarget);

    this.portalMesh.visible = true;
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
}
