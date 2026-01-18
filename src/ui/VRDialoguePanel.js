import * as THREE from 'three';

export class VRDialoguePanel {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        
        // Canvas Setup (High Res for Text)
        this.width = 1024;
        this.height = 512;
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d');
        
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.generateMipmaps = true;
        this.texture.minFilter = THREE.LinearMipmapLinearFilter;

        this.mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.8, 0.4), // 80cm x 40cm
            new THREE.MeshBasicMaterial({ 
                map: this.texture, 
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide
            })
        );
        this.mesh.visible = false;
        // renderOrder élevé pour apparaître par dessus les autres
        this.mesh.renderOrder = 999;
        this.mesh.material.depthTest = false; // Toujours visible
        
        // State
        this.npc = null;
        this.dialogues = [];
        this.currentIndex = 0;
        this.currentText = "";
        
        // Choices
        this.choices = [];
        this.isShowingChoices = false;
        this.choiceButtons = []; // {x,y,w,h, index}

        // Input Cooldown
        this.lastInputTime = 0;
    }

    show(npc, dialogues, key) {
        this.npc = npc;
        this.dialogues = Array.isArray(dialogues) ? dialogues : [dialogues];
        this.key = key; // Save key for completion
        console.log(`🔑 VRDialoguePanel.show() - Key stored: "${this.key}"`);
        this.currentIndex = 0;
        this.isVisible = true;
        this.mesh.visible = true;
        
        // Position Panel in front of NPC, facing Camera
        if (npc && npc.mesh) {
            // Position: Devant le PNJ (vers la caméra)
            const npcPos = new THREE.Vector3();
            npc.mesh.getWorldPosition(npcPos);
            
            // Vecteur direction vers la caméra (World Position is CRITICAL)
            const camWorldPos = new THREE.Vector3();
            this.game.vrManager.camera.getWorldPosition(camWorldPos);

            // On projette sur le plan horizontal pour éviter que le panel rentre dans le sol ou s'envole
            const dirToCam = new THREE.Vector3().subVectors(camWorldPos, npcPos);
            dirToCam.y = 0; 
            dirToCam.normalize();
            
            // On le place un peu devant (1.0m)
            npcPos.add(dirToCam.multiplyScalar(1.0));
            // Hauteur fixe (yeux/buste)
            npcPos.y += 1.3; 
            
            this.mesh.position.copy(npcPos);
            // Look at camera
            this.mesh.lookAt(camWorldPos);
        } else {
            // Fallback: In front of camera
            const cam = this.game.vrManager.camera;
            this.mesh.position.copy(cam.position).add(cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.5));
            this.mesh.lookAt(cam.position);
        }
        
        // Ajout à la scène active si ce n'est pas déjà fait
        if (!this.mesh.parent) {
             const activeScene = this.game.sceneManager.getActiveScene();
             if (activeScene) activeScene.add(this.mesh);
             else this.game.sceneManager.scene.add(this.mesh);
        }

        this.showDialogue(this.dialogues[0]);
    }

    showDialogue(text) {
        // Remplacer {PLAYER} (case sensitive based on JSON)
        let displayText = text;
        if (displayText.includes('{PLAYER}')) {
             const playerName = this.game.saveManager?.saveData?.joueur?.nom || "Red";
             displayText = displayText.replace(/{PLAYER}/g, playerName);
        }

        this.currentText = displayText;
        this.isShowingChoices = false;
        this.draw();
    }
    
    showChoices(choices) {
        console.log(`[VRDialoguePanel] showChoices called with ${choices.length} choices`);
        this.choices = choices;
        this.isShowingChoices = true;
        this.isVisible = true; // IMPORTANT: Re-show the panel
        this.mesh.visible = true;
        
        // Re-add to scene if it was removed
        if (!this.mesh.parent) {
            const activeScene = this.game.sceneManager.getActiveScene();
            if (activeScene) activeScene.add(this.mesh);
            else this.game.sceneManager.scene.add(this.mesh);
        }
        
        this.draw();
    }
    
    advance() {
        if (Date.now() - this.lastInputTime < 500) return;
        this.lastInputTime = Date.now();

        if (this.currentIndex < this.dialogues.length - 1) {
            this.currentIndex++;
            this.showDialogue(this.dialogues[this.currentIndex]);
        } else {
            this.hide();
        }
    }
    
    hide() {
        this.isVisible = false;
        this.mesh.visible = false;
        
        // Retirer de la scène pour éviter l'encombrement
        if (this.mesh.parent) {
             this.mesh.parent.remove(this.mesh);
        }

        // Callback to game
        // IMPORTANT: On doit appeler la méthode complete() du système de dialogue
        // pour qu'il déclenche les événements spéciaux (comme les choix)
        if (this.game.dialogueSystem) {
            // On restaure l'état du système principal pour qu'il sache qui est le PNJ actuel
            this.game.dialogueSystem.currentNPC = this.npc;
            this.game.dialogueSystem.dialogueKey = this.key; // RESTORE KEY IS CRITICAL
            console.log(`🔑 VRDialoguePanel.hide() - Restoring key: "${this.key}" to dialogueSystem`);
            this.game.dialogueSystem.isActive = true; // Force active pour que complete() fonctionne
            this.game.dialogueSystem.complete();
        }
    }

    draw() {
        const ctx = this.ctx;
        // Background Glassmorphism (Blue/Deep)
        ctx.clearRect(0,0,this.width, this.height);

        ctx.fillStyle = "rgba(0, 20, 60, 0.9)";
        ctx.strokeStyle = "#00d2ff"; // Cyan neon border
        ctx.lineWidth = 6;
        
        // Rounded Box
        this.roundRect(ctx, 10, 10, this.width-20, this.height-20, 30, true, true);
        
        // Name Tag
        if (this.npc) {
             // Tag Bg
            ctx.fillStyle = "#00d2ff";
            ctx.fillRect(40, 40, 350, 60);
            
            // Tag Text
            ctx.fillStyle = "#000000";
            ctx.font = "bold 40px Arial";
            ctx.textAlign = "left";
            ctx.fillText(this.npc.nom || "???", 60, 85);
        }
        
        // Text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 36px Arial";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        
        // Wrap Text
        if (!this.isShowingChoices) {
            this.wrapText(ctx, this.currentText, 60, 160, this.width - 120, 50);
        } else {
            // Draw Choices Buttons
            this.choiceButtons = [];
            
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 32px Arial";
            ctx.fillText("Fais ton choix :", 60, 160);
            
            let startY = 200;
            const btnHeight = 80;
            const gap = 20;
            
            this.choices.forEach((choice, i) => {
                const btnY = startY + (btnHeight + gap) * i;
                
                // Button Rect
                ctx.fillStyle = "rgba(0, 210, 255, 0.2)";
                ctx.strokeStyle = "#00d2ff";
                this.roundRect(ctx, 60, btnY, this.width - 120, btnHeight, 10, true, true);
                
                // Text
                ctx.fillStyle = "#ffffff";
                ctx.fillText(choice.text, 100, btnY + 50);
                
                // Save Hitbox (Canvas Coords)
                this.choiceButtons.push({
                    x: 60,
                    y: btnY,
                    w: this.width - 120,
                    h: btnHeight,
                    index: i,
                    data: choice
                });
            });
        }
        
        ctx.shadowBlur = 0;
        
        this.texture.needsUpdate = true;
    }

    /**
     * Vérifie le clic sur un bouton de choix via UV
     * @param {THREE.Vector2} uv - Coordonnées UV (0..1)
     */
    checkClick(uv) {
        if (!this.isShowingChoices) return -1;
        
        // Convert UV to Canvas Coords
        // Plane UV (0,0) is Bottom-Left
        // Canvas (0,0) is Top-Left
        const x = uv.x * this.width;
        const y = (1 - uv.y) * this.height;
        
        for (const btn of this.choiceButtons) {
            if (x >= btn.x && x <= btn.x + btn.w &&
                y >= btn.y && y <= btn.y + btn.h) {
                return btn.index;
            }
        }
        return -1;
    }
    
    roundRect(ctx, x, y, width, height, radius, fill, stroke) {
        if (typeof ctx.roundRect === 'function') {
           ctx.beginPath();
           ctx.roundRect(x, y, width, height, radius);
           if (fill) ctx.fill();
           if (stroke) ctx.stroke();
       } else {
           ctx.fillRect(x, y, width, height);
           if(stroke) ctx.strokeRect(x,y,width,height);
       }
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        // Enlever les balises HTML simples si présentes (ex: <span>)
        const cleanText = text.replace(/<[^>]*>/g, '');
        
        const words = cleanText.split(' ');
        let line = '';
        for(let n = 0; n < words.length; n++) {
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
}
