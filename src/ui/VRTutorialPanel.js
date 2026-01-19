import * as THREE from "three";
import { VRMenuPanel } from './VRMenuPanel.js';

/**
 * VRTutorialPanel - Panneau de tutoriel en VR
 * Affiche les tutoriels VR en 3D devant le joueur
 */
export class VRTutorialPanel extends VRMenuPanel {
    constructor(game) {
        super(game, 1024, 768);

        this.currentTutorial = null;
        this.currentStep = 0;
        this.onComplete = null;
        this.onSkip = null;

        // Positionnement en face du joueur (pas sur la montre)
        this.isFloatingPanel = true;
    }

    createMesh() {
        // Créer la texture canvas
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.anisotropy = 4;

        // Panel plus grand pour les tutoriels (60cm x 45cm)
        const geometry = new THREE.PlaneGeometry(0.6, 0.45);
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

    /**
     * Afficher un tutoriel
     */
    showTutorial(tutorial, step = 0) {
        if (!tutorial || !tutorial.steps || tutorial.steps.length === 0) {
            console.warn("[VRTutorialPanel] Invalid tutorial data");
            return;
        }

        this.currentTutorial = tutorial;
        this.currentStep = step;

        console.log(`[VRTutorialPanel] Showing tutorial: ${tutorial.id}, step ${step + 1}/${tutorial.steps.length}`);

        // Positionner devant le joueur
        this.positionInFrontOfPlayer();

        // Dessiner
        this.draw();

        this.mesh.visible = true;
        this.isVisible = true;
    }

    /**
     * Positionner le panneau devant le joueur
     */
    positionInFrontOfPlayer() {
        if (!this.game.vrManager || !this.game.vrManager.playerRig) return;

        const camera = this.game.camera;
        const rig = this.game.vrManager.playerRig;

        // Ajouter à la scène si pas déjà fait
        if (!this.mesh.parent) {
            const scene = this.game.sceneManager.getActiveScene();
            if (scene) {
                scene.add(this.mesh);
            }
        }

        // Position: 1.5m devant le joueur, à hauteur des yeux
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(camera.quaternion);
        forward.y = 0; // Garder horizontal
        forward.normalize();

        const position = camera.position.clone();
        position.add(forward.multiplyScalar(1.5));
        position.y = camera.position.y; // Hauteur des yeux

        this.mesh.position.copy(position);

        // Orienter vers le joueur
        this.mesh.lookAt(camera.position);
    }

    /**
     * Passer à l'étape suivante
     */
    nextStep() {
        if (!this.currentTutorial) return;

        this.currentStep++;

        if (this.currentStep >= this.currentTutorial.steps.length) {
            // Tutoriel terminé
            this.complete();
        } else {
            this.draw();
        }
    }

    /**
     * Terminer le tutoriel
     */
    complete() {
        console.log(`[VRTutorialPanel] Tutorial completed: ${this.currentTutorial?.id}`);

        const tutorialId = this.currentTutorial?.id;

        if (this.onComplete) {
            this.onComplete(tutorialId);
        }

        this.hide();
        this.currentTutorial = null;
        this.currentStep = 0;
    }

    /**
     * Passer le tutoriel
     */
    skip() {
        if (!this.currentTutorial || !this.currentTutorial.canSkip) return;

        console.log(`[VRTutorialPanel] Tutorial skipped: ${this.currentTutorial?.id}`);

        const tutorialId = this.currentTutorial?.id;

        if (this.onSkip) {
            this.onSkip(tutorialId);
        }

        this.complete();
    }

    hide() {
        this.mesh.visible = false;
        this.isVisible = false;

        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
    }

    /**
     * Dessiner le panneau
     */
    draw() {
        const ctx = this.ctx;
        this.buttons = [];

        if (!this.currentTutorial) {
            this.texture.needsUpdate = true;
            return;
        }

        const step = this.currentTutorial.steps[this.currentStep];
        if (!step) return;

        // Fond avec gradient
        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(1, '#16213e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Bordure
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, this.width - 8, this.height - 8);

        // === HEADER ===
        const headerH = 120;
        ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.fillRect(0, 0, this.width, headerH);

        // Icône
        ctx.font = '60px Arial';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.fillText(this.currentTutorial.icon || '📖', 30, 80);

        // Titre
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText(this.currentTutorial.title, 120, 55);

        // Sous-titre
        ctx.font = '24px Arial';
        ctx.fillStyle = '#a5a6f6';
        ctx.fillText(this.currentTutorial.subtitle || '', 120, 90);

        // Progression (étape X/Y)
        ctx.font = '22px Arial';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#a5a6f6';
        ctx.fillText(`${this.currentStep + 1} / ${this.currentTutorial.steps.length}`, this.width - 30, 70);

        // === CONTENT ===
        const contentY = headerH + 30;
        const contentH = this.height - headerH - 150; // Espace pour les boutons

        // Titre de l'étape
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.fillText(step.title, 40, contentY + 40);

        // Contenu texte
        ctx.font = '24px Arial';
        ctx.fillStyle = '#e0e0e0';
        this.drawWrappedText(step.content, 40, contentY + 90, this.width - 80, 32);

        // Contrôles si présents
        let extraY = contentY + 200;

        if (step.controls) {
            extraY = this.drawControls(step.controls, 40, extraY, this.width - 80);
        }

        // Actions si présentes
        if (step.actions) {
            extraY = this.drawActions(step.actions, 40, extraY, this.width - 80);
        }

        // Items si présents
        if (step.items) {
            extraY = this.drawItems(step.items, 40, extraY, this.width - 80);
        }

        // Tip si présent
        if (step.tip) {
            this.drawTip(step.tip, 40, Math.min(extraY + 20, this.height - 180), this.width - 80);
        }

        // === FOOTER (Progress dots + Buttons) ===
        const footerY = this.height - 100;

        // Points de progression
        const dotSize = 12;
        const dotGap = 20;
        const totalDotsWidth = this.currentTutorial.steps.length * dotSize + (this.currentTutorial.steps.length - 1) * dotGap;
        const dotsStartX = (this.width - totalDotsWidth) / 2;

        for (let i = 0; i < this.currentTutorial.steps.length; i++) {
            const dotX = dotsStartX + i * (dotSize + dotGap);
            const dotY = footerY - 40;

            ctx.beginPath();
            ctx.arc(dotX + dotSize / 2, dotY, dotSize / 2, 0, Math.PI * 2);

            if (i < this.currentStep) {
                ctx.fillStyle = '#6366f1'; // Complété
            } else if (i === this.currentStep) {
                ctx.fillStyle = '#fff'; // Actuel
            } else {
                ctx.fillStyle = '#444'; // Futur
            }
            ctx.fill();
        }

        // Boutons
        const btnW = 200;
        const btnH = 60;
        const btnY = footerY + 10;

        // Bouton Passer (si autorisé)
        if (this.currentTutorial.canSkip) {
            const skipBtn = {
                x: this.width / 2 - btnW - 20,
                y: btnY,
                w: btnW,
                h: btnH,
                label: 'Passer',
                action: () => this.skip()
            };
            this.drawButtonStyled(skipBtn, '#555', this.hoveredButton === skipBtn);
            this.buttons.push(skipBtn);
        }

        // Bouton Suivant / Terminer
        const isLastStep = this.currentStep >= this.currentTutorial.steps.length - 1;
        const nextBtn = {
            x: this.currentTutorial.canSkip ? this.width / 2 + 20 : (this.width - btnW) / 2,
            y: btnY,
            w: btnW,
            h: btnH,
            label: isLastStep ? 'Terminer' : 'Suivant',
            action: () => this.nextStep()
        };
        this.drawButtonStyled(nextBtn, '#6366f1', this.hoveredButton === nextBtn);
        this.buttons.push(nextBtn);

        this.texture.needsUpdate = true;
    }

    /**
     * Dessiner du texte avec retour à la ligne
     */
    drawWrappedText(text, x, y, maxWidth, lineHeight) {
        const ctx = this.ctx;
        // Nettoyer les balises HTML
        const cleanText = text.replace(/<[^>]*>/g, '');
        const lines = cleanText.split('\n');
        let currentY = y;

        for (const line of lines) {
            const words = line.split(' ');
            let currentLine = '';

            for (const word of words) {
                const testLine = currentLine + word + ' ';
                const metrics = ctx.measureText(testLine);

                if (metrics.width > maxWidth && currentLine !== '') {
                    ctx.fillText(currentLine.trim(), x, currentY);
                    currentLine = word + ' ';
                    currentY += lineHeight;
                } else {
                    currentLine = testLine;
                }
            }

            if (currentLine.trim()) {
                ctx.fillText(currentLine.trim(), x, currentY);
                currentY += lineHeight;
            }
        }

        return currentY;
    }

    /**
     * Dessiner les contrôles
     */
    drawControls(controls, x, y, maxWidth) {
        const ctx = this.ctx;
        const itemH = 50;
        let currentY = y;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.roundRect(ctx, x, y - 10, maxWidth, controls.length * itemH + 20, 12, true);

        for (const ctrl of controls) {
            // Touche
            ctx.fillStyle = '#6366f1';
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(ctrl.key, x + 20, currentY + 25);

            // Description
            ctx.fillStyle = '#ccc';
            ctx.font = '22px Arial';
            ctx.fillText(ctrl.desc, x + 250, currentY + 25);

            currentY += itemH;
        }

        return currentY + 20;
    }

    /**
     * Dessiner les actions (grille 2x2)
     */
    drawActions(actions, x, y, maxWidth) {
        const ctx = this.ctx;
        const cols = 2;
        const rows = Math.ceil(actions.length / cols);
        const itemW = (maxWidth - 20) / cols;
        const itemH = 80;

        let currentY = y;

        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            const col = i % cols;
            const row = Math.floor(i / cols);

            const itemX = x + col * (itemW + 10);
            const itemY = currentY + row * (itemH + 10);

            // Fond
            ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
            this.roundRect(ctx, itemX, itemY, itemW, itemH, 10, true);

            // Icône
            ctx.font = '28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(action.icon, itemX + 35, itemY + 35);

            // Nom
            ctx.font = 'bold 18px Arial';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.fillText(action.name, itemX + 70, itemY + 30);

            // Description
            ctx.font = '14px Arial';
            ctx.fillStyle = '#aaa';
            ctx.fillText(action.desc, itemX + 70, itemY + 55);
        }

        return currentY + rows * (itemH + 10) + 10;
    }

    /**
     * Dessiner les items (liste)
     */
    drawItems(items, x, y, maxWidth) {
        const ctx = this.ctx;
        const itemH = 45;
        let currentY = y;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.roundRect(ctx, x, y - 10, maxWidth, items.length * itemH + 20, 12, true);

        for (const item of items) {
            // Nom
            ctx.fillStyle = '#6366f1';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.name, x + 20, currentY + 22);

            // Description
            ctx.fillStyle = '#ccc';
            ctx.font = '18px Arial';
            ctx.fillText(item.desc, x + 220, currentY + 22);

            currentY += itemH;
        }

        return currentY + 20;
    }

    /**
     * Dessiner un tip
     */
    drawTip(tip, x, y, maxWidth) {
        const ctx = this.ctx;
        const tipH = 60;

        // Fond jaune/doré
        ctx.fillStyle = 'rgba(255, 193, 7, 0.15)';
        this.roundRect(ctx, x, y, maxWidth, tipH, 10, true);

        // Bordure gauche
        ctx.fillStyle = '#ffc107';
        ctx.fillRect(x, y, 5, tipH);

        // Icône
        ctx.font = '24px Arial';
        ctx.fillText('💡', x + 20, y + 38);

        // Texte
        ctx.fillStyle = '#ffd54f';
        ctx.font = '18px Arial';
        ctx.textAlign = 'left';

        const cleanTip = tip.replace(/<[^>]*>/g, '');
        ctx.fillText(cleanTip, x + 55, y + 38);
    }

    /**
     * Dessiner un bouton stylisé
     */
    drawButtonStyled(btn, color, isHovered) {
        const ctx = this.ctx;

        // Fond
        ctx.fillStyle = isHovered ? '#fff' : color;
        this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12, true);

        // Texte
        ctx.fillStyle = isHovered ? '#000' : '#fff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 8);
    }

    /**
     * Update appelé chaque frame (pour repositionnement si nécessaire)
     */
    update() {
        if (this.isVisible && this.isFloatingPanel) {
            // Optionnel: suivre légèrement le regard du joueur
            // Pour l'instant on garde la position fixe
        }
    }
}
