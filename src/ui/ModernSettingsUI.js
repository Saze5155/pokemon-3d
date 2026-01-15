/**
 * ModernSettingsUI.js - Interface des options moderne
 */

export class ModernSettingsUI {
  constructor(uiManager) {
    this.ui = uiManager;
    this.isVisible = false;
    this.createUI();
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'modern-settings-ui';
    this.container.className = 'modern-menu-overlay modern-ui';
    this.container.style.display = 'none';
    
    this.container.innerHTML = `
      <div class="modern-menu-container theme-green" style="max-width: 600px;">
        <div class="modern-menu-header">
          <div class="modern-menu-title">
            <span class="material-symbols-rounded">settings</span>
            OPTIONS
          </div>
          <button class="modern-close-btn">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
        
        <div class="modern-settings-content" style="padding: 20px; overflow-y: auto;">
            
            <!-- Audio -->
            <div class="settings-section glass">
                <h3><span class="material-symbols-rounded">volume_up</span> AUDIO</h3>
                <div class="setting-row">
                    <label>Volume Musique</label>
                    <input type="range" id="modern-music-volume" min="0" max="100" value="50">
                    <span class="setting-value" id="val-music">50%</span>
                </div>
            </div>

            <!-- Contrôles -->
            <div class="settings-section glass" style="margin-top: 20px;">
                 <h3><span class="material-symbols-rounded">gamepad</span> CONTRÔLES</h3>
                 <div class="setting-row">
                    <label>Sensibilité Souris</label>
                    <input type="range" id="modern-mouse-sens" min="1" max="20" value="10">
                    <span class="setting-value" id="val-sens">10</span>
                </div>
            </div>

            <!-- Raccourcis -->
             <div class="settings-section glass" style="margin-top: 20px;">
                 <h3><span class="material-symbols-rounded">keyboard</span> RACCOURCIS</h3>
                 <div class="shortcuts-grid">
                    <div class="shortcut-item"><span>ZQSD / Flèches</span> <span class="key-badge">Mouvement</span></div>
                    <div class="shortcut-item"><span>Espace</span> <span class="key-badge">Sauter</span></div>
                    <div class="shortcut-item"><span>Shift</span> <span class="key-badge">Courir</span></div>
                    <div class="shortcut-item"><span>E</span> <span class="key-badge">Interagir</span></div>
                    <div class="shortcut-item"><span>TAB / M</span> <span class="key-badge">Menu</span></div>
                    <div class="shortcut-item"><span>Clic Gauche</span> <span class="key-badge">Lancer Ball</span></div>
                 </div>
            </div>

             <div class="details-actions" style="margin-top: 30px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="modern-btn modern-btn-secondary" id="btn-reset-tutos">
                    <span class="material-symbols-rounded">restart_alt</span> REJOUER TUTOS
                </button>
                <button class="modern-btn modern-btn-primary" id="btn-save-settings">
                    <span class="material-symbols-rounded">save</span> SAUVEGARDER
                </button>
            </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.container);
    
    // Events
    this.container.querySelector('.modern-close-btn').addEventListener('click', () => {
      this.ui.closeAllMenus();
    });

    // Volume Slider
    const volSlider = this.container.querySelector('#modern-music-volume');
    volSlider.addEventListener('input', (e) => {
        this.container.querySelector('#val-music').textContent = e.target.value + '%';
        if(this.ui.game && this.ui.game.audioManager) {
            this.ui.game.audioManager.setVolume(e.target.value / 100);
        }
    });

    // Sensibilité
    const sensSlider = this.container.querySelector('#modern-mouse-sens');
    sensSlider.addEventListener('input', (e) => {
        this.container.querySelector('#val-sens').textContent = e.target.value;
        // Todo: Update game sensitivity
    });
    
    this.container.querySelector('#btn-save-settings').addEventListener('click', () => {
        this.ui.closeAllMenus();
        if(this.ui.modernHUD) this.ui.modernHUD.showNotification("Paramètres enregistrés !", "success");
    });
    
    // Reset Tutos
    const btnResetTutos = this.container.querySelector('#btn-reset-tutos');
    if (btnResetTutos) {
        btnResetTutos.addEventListener('click', () => {
             if (this.ui.tutorialSystem) {
                 this.ui.tutorialSystem.resetProgress();
                 if(this.ui.modernHUD) this.ui.modernHUD.showNotification("Tutoriels réinitialisés ! Rechargez le jeu.", "info");
             }
        });
    }
  }

  show() {
    this.container.classList.add('visible');
    this.isVisible = true;
    if (document.exitPointerLock) document.exitPointerLock();
  }

  hide() {
    this.container.classList.remove('visible');
    this.isVisible = false;
  }
}
