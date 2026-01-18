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
        
        // Input Cooldown
        this.lastInputTime = 0;
    }

    show(npc, dialogues, key) {
        this.npc = npc;
        this.dialogues = Array.isArray(dialogues) ? dialogues : [dialogues];
        this.currentIndex = 0;
        this.isVisible = true;
        this.mesh.visible = true;
        
        // Position Panel in front of NPC, facing Camera
        if (npc && npc.mesh) {
            // Position: NPC Head height + offset towards camera
            const npcPos = new THREE.Vector3();
            npc.mesh.getWorldPosition(npcPos);
            npcPos.y += 1.8; // Above head
            
            this.mesh.position.copy(npcPos);
            // Look at camera (inverted to face it if needed, but lookAt works for simple Plane)
            this.mesh.lookAt(this.game.vrManager.camera.position);
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
        this.currentText = text;
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
        if (this.game.ui.dialogueSystem.onDialogueComplete) {
            this.game.ui.dialogueSystem.onDialogueComplete(this.npc);
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
        this.wrapText(ctx, this.currentText, 60, 160, this.width - 120, 50);
        
        ctx.shadowBlur = 0;
        
        this.texture.needsUpdate = true;
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
