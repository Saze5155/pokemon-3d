/**
 * TutorialSystem.js - Système de tutoriels interactifs
 * Tutoriels contextuels pour les combats, équipe, capture, etc.
 */

export class TutorialSystem {
  constructor(uiManager) {
    this.ui = uiManager;
    this.currentTutorial = null;
    this.currentStep = 0;
    this.isActive = false;
    this.completedTutorials = new Set();

    // Charger les tutoriels déjà complétés depuis le localStorage
    this.loadProgress();

    // Créer le conteneur du tutoriel
    this.createContainer();

    // Définir tous les tutoriels
    this.tutorials = this.defineTutorials();
  }

  /**
   * Définition de tous les tutoriels du jeu
   */
  defineTutorials() {
    return {
      // ==================== TUTORIEL DE BIENVENUE ====================
      welcome: {
        id: 'welcome',
        title: 'Bienvenue dans Pokémon 3D',
        icon: '🎮',
        subtitle: 'Les bases du jeu',
        canSkip: true,
        steps: [
          {
            title: 'Bienvenue, Dresseur !',
            content: `Félicitations pour le début de ton aventure !

Tu t'apprêtes à explorer le monde de Kanto en <span class="highlight">3D</span>. Ce tutoriel va t'expliquer les bases.`,
            tip: 'Tu peux sauter les tutoriels à tout moment en cliquant sur "Passer".'
          },
          {
            title: 'Se déplacer',
            content: `Utilise les touches pour te déplacer dans le monde :`,
            controls: [
              { key: 'ZQSD / Flèches', desc: 'Se déplacer' },
              { key: 'Souris', desc: 'Regarder autour' },
              { key: 'Espace', desc: 'Sauter' },
              { key: 'Shift', desc: 'Courir' }
            ],
            tip: 'Clique dans le jeu pour capturer ta souris et regarder librement.'
          },
          {
            title: 'Interagir',
            content: `Approche-toi des PNJ et des objets pour interagir avec eux.`,
            controls: [
              { key: 'E', desc: 'Parler / Interagir' },
              { key: 'Espace / Entrée', desc: 'Avancer le dialogue' }
            ],
            tip: 'Un indicateur apparaît quand tu peux interagir avec quelque chose.'
          },
          {
            title: 'Le Pokégear',
            content: `Le <span class="highlight">Pokégear</span> est ton outil principal. Appuie sur <kbd>TAB</kbd> pour l'ouvrir.

Tu y trouveras ton <span class="highlight">Équipe</span>, ton <span class="highlight">Sac</span>, le <span class="highlight">Pokédex</span> et plus encore !`,
            tip: 'Certaines fonctions se débloquent au fur et à mesure de l\'aventure.'
          }
        ]
      },

      // ==================== TUTORIEL PREMIER POKEMON ====================
      firstPokemon: {
        id: 'firstPokemon',
        title: 'Ton Premier Pokémon',
        icon: '🎁',
        subtitle: 'Félicitations !',
        canSkip: false,
        steps: [
          {
            title: 'Tu as reçu un Pokémon !',
            content: `Félicitations ! Tu viens de recevoir ton <span class="highlight">premier Pokémon</span> !

C'est le début d'une grande aventure ensemble. Prends-en bien soin !`,
            tip: 'Ton Pokémon gagnera de l\'expérience en combattant.'
          },
          {
            title: 'Gérer ton équipe',
            content: `Ouvre le <span class="highlight">Pokégear</span> (TAB) et clique sur <span class="highlight">ÉQUIPE</span> pour voir tes Pokémon.

Tu peux avoir jusqu'à <span class="highlight">6 Pokémon</span> dans ton équipe.`,
            tip: 'Clique sur un Pokémon pour voir ses stats et gérer ses attaques.'
          },
          {
            title: 'Le sélecteur d\'équipe',
            content: `En bas à droite de l'écran, tu verras ton <span class="highlight">équipe rapide</span>.

Utilise la <span class="highlight">molette de souris</span> pour changer rapidement de Pokémon actif.`,
            tip: 'Le Pokémon sélectionné sera envoyé au combat en premier.'
          }
        ]
      },

      // ==================== TUTORIEL COMBAT ====================
      combat: {
        id: 'combat',
        title: 'Système de Combat',
        icon: '⚔️',
        subtitle: 'Combat Pokémon',
        canSkip: true,
        steps: [
          {
            title: 'Le Combat Pokémon',
            content: `Un <span class="highlight">combat sauvage</span> commence ! Les combats se déroulent au tour par tour.

Tu as plusieurs options d'action à chaque tour.`,
            tip: 'Les Pokémon sauvages apparaissent dans les hautes herbes.'
          },
          {
            title: 'Les Actions de Combat',
            content: `Pendant un combat, tu peux :`,
            actions: [
              { icon: '⚔️', name: 'ATTAQUE', desc: 'Utiliser une capacité de ton Pokémon' },
              { icon: '🎒', name: 'SAC', desc: 'Utiliser un objet (Potion, Pokéball...)' },
              { icon: '🔄', name: 'ÉQUIPE', desc: 'Changer de Pokémon' },
              { icon: '🏃', name: 'FUITE', desc: 'Tenter de fuir (combats sauvages)' }
            ]
          },
          {
            title: 'Les Attaques',
            content: `Chaque Pokémon peut avoir jusqu'à <span class="highlight">4 attaques</span>.

Les attaques ont différents <span class="highlight">types</span> (Feu, Eau, Plante...) et <span class="highlight">puissances</span>.`,
            tip: 'Certains types sont super efficaces contre d\'autres !'
          },
          {
            title: 'Les Points de Vie',
            content: `Chaque Pokémon a des <span class="highlight">PV</span> (Points de Vie).

Quand les PV tombent à <span class="highlight">0</span>, le Pokémon est K.O. et ne peut plus combattre.`,
            tip: 'Utilise des Potions pour soigner tes Pokémon !'
          },
          {
            title: 'Capture Rapide',
            content: `Tu n'es pas obligé d'ouvrir le sac pour capturer !
            
Appuie sur <kbd>A</kbd> ou <kbd>Clic Gauche</kbd> pour passer en **mode visée**.
Relâche pour lancer ta Pokéball.`,
            tip: 'Vise bien le Pokémon pour réussir ton tir !'
          },
          {
            title: 'L\'Expérience',
            content: `Après avoir vaincu un Pokémon ennemi, ton Pokémon gagne de l'<span class="highlight">expérience</span>.

Accumule de l'XP pour <span class="highlight">monter de niveau</span> et devenir plus fort !`,
            tip: 'Les Pokémon peuvent apprendre de nouvelles attaques en montant de niveau.'
          }
        ]
      },

      // ==================== TUTORIEL CAPTURE ====================
      capture: {
        id: 'capture',
        title: 'Capturer des Pokémon',
        icon: '🔴',
        subtitle: 'Agrandir ton équipe',
        canSkip: true,
        steps: [
          {
            title: 'Capturer un Pokémon',
            content: `Pour capturer un Pokémon sauvage, tu dois utiliser une <span class="highlight">Poké Ball</span> !

Ouvre ton <span class="highlight">Sac</span> pendant le combat et sélectionne une Poké Ball.`,
            tip: 'Tu peux aussi appuyer sur A ou clic gauche pour lancer directement.'
          },
          {
            title: 'Augmenter tes chances',
            content: `Plus le Pokémon ennemi a <span class="highlight">peu de PV</span>, plus la capture est facile.

Tu peux aussi lui infliger un <span class="highlight">statut</span> (Paralysie, Sommeil...) pour augmenter tes chances.`,
            tip: 'Attention à ne pas le mettre K.O. sinon tu ne pourras pas le capturer !'
          },
          {
            title: 'Types de Poké Balls',
            content: `Il existe plusieurs types de Poké Balls :`,
            items: [
              { name: 'Poké Ball', desc: 'Ball standard (x1)' },
              { name: 'Super Ball', desc: 'Plus efficace (x1.5)' },
              { name: 'Hyper Ball', desc: 'Très efficace (x2)' },
              { name: 'Master Ball', desc: 'Capture garantie !' }
            ],
            tip: 'Les meilleures Balls sont plus chères et plus rares.'
          },
          {
            title: 'Pokédex',
            content: `Chaque Pokémon capturé est <span class="highlight">enregistré</span> dans ton Pokédex.

Ton objectif : <span class="highlight">tous les attraper</span> pour compléter le Pokédex !`,
            tip: 'Il y a 151 Pokémon à découvrir dans Kanto !'
          }
        ]
      },

      // ==================== TUTORIEL ÉQUIPE ====================
      team: {
        id: 'team',
        title: 'Gestion de l\'Équipe',
        icon: '👥',
        subtitle: 'Organiser tes Pokémon',
        canSkip: true,
        steps: [
          {
            title: 'Ton Équipe',
            content: `Tu peux avoir <span class="highlight">jusqu'à 6 Pokémon</span> dans ton équipe.
            
Le premier de la liste sera envoyé en premier au combat.`,
            tip: 'Réorganise ton équipe selon tes stratégies !'
          },
          {
            title: 'Stats de Pokémon',
            content: `Chaque Pokémon a des statistiques :`,
            stats: [
              { name: 'PV', desc: 'Points de Vie' },
              { name: 'Attaque', desc: 'Dégâts physiques' },
              { name: 'Défense', desc: 'Résistance physique' },
              { name: 'Spécial', desc: 'Attaques/Défense spéciales' },
              { name: 'Vitesse', desc: 'Détermine qui attaque en premier' }
            ]
          },
          {
            title: 'Gérer les Attaques',
            content: `Clique sur un Pokémon dans l'écran Équipe pour voir ses <span class="highlight">attaques</span>.
            
Tu peux <span class="highlight">échanger</span> des attaques entre les 4 slots actifs et les attaques en réserve.`,
            tip: 'Un Pokémon apprend de nouvelles attaques en montant de niveau.'
          },
          {
            title: 'Le Stockage PC',
            content: `Si ton équipe est pleine, les Pokémon capturés vont dans le <span class="highlight">PC</span>.
            
Accède au Stockage via le Pokégear pour gérer tes Pokémon stockés.`,
            tip: 'Tu peux déposer et retirer des Pokémon à tout moment.'
          }
        ]
      },

      // ==================== TUTORIEL SAC ====================
      bag: {
        id: 'bag',
        title: 'Ton Sac à Dos',
        icon: 'backpack',
        subtitle: 'Tes objets',
        canSkip: true,
        steps: [
            {
                title: 'Inventaire',
                content: `Ton sac contient tous tes objets, triés par <span class="highlight">catégorie</span>.
                
Utilise les onglets à gauche pour naviguer.`,
                items: [
                   { name: 'Objets', desc: 'Objets divers et évolutions' },
                   { name: 'Soins', desc: 'Potions et remèdes' },
                   { name: 'Pokéballs', desc: 'Pour la capture' },
                   { name: 'Rares', desc: 'Objets clés importants' }
                ]
            },
            {
                title: 'Utiliser un objet',
                content: `Clique sur un objet pour voir sa description.
                
Le bouton <span class="highlight">UTILISER</span> permet de s'en servir sur un Pokémon (Potion, Évolution...)`,
                tip: 'Certains objets ne peuvent être utilisés qu\'en combat.'
            }
        ]
      },

      // ==================== TUTORIEL DRESSEURS ====================
      trainers: {
        id: 'trainers',
        title: 'Combat de Dresseurs',
        icon: '🏆',
        subtitle: 'Affronter d\'autres dresseurs',
        canSkip: true,
        steps: [
          {
            title: 'Les Dresseurs',
            content: `Dans ton aventure, tu croiseras d'autres <span class="highlight">Dresseurs Pokémon</span>.

Certains t'affronteront automatiquement en te voyant !`,
            tip: 'Un "!" apparaît quand un dresseur te repère.'
          },
          {
            title: 'Différences avec les combats sauvages',
            content: `Contre un dresseur :

• Tu ne peux <span class="highlight">pas fuir</span>
• Tu ne peux <span class="highlight">pas capturer</span> ses Pokémon
• Il peut avoir <span class="highlight">plusieurs Pokémon</span>`,
            tip: 'Prépare bien ton équipe avant d\'affronter un dresseur !'
          },
          {
            title: 'Les Récompenses',
            content: `En battant un dresseur, tu gagnes :

• De l'<span class="highlight">argent</span> (¥)
• De l'<span class="highlight">expérience</span> pour tes Pokémon`,
            tip: 'Les champions d\'arène donnent aussi des badges !'
          }
        ]
      },

      // ==================== TUTORIEL BOUTIQUE ====================
      shop: {
        id: 'shop',
        title: 'La Boutique Pokémon',
        icon: '🛒',
        subtitle: 'Acheter et vendre',
        canSkip: true,
        steps: [
          {
            title: 'La Boutique',
            content: `Dans chaque Centre Pokémon, tu trouveras une <span class="highlight">Boutique</span>.

Tu peux y acheter des objets utiles pour ton aventure.`,
            tip: 'Parle au vendeur pour ouvrir la boutique.'
          },
          {
            title: 'Acheter',
            content: `Dans l'onglet <span class="highlight">ACHETER</span>, tu trouveras :

• Poké Balls (pour capturer)
• Potions (pour soigner)
• Objets de soin (Antidotes, etc.)`,
            tip: 'Vérifie toujours ton argent avant d\'acheter !'
          },
          {
            title: 'Vendre',
            content: `Tu peux aussi <span class="highlight">VENDRE</span> des objets de ton sac.

Les objets sont vendus à <span class="highlight">la moitié</span> de leur prix d'achat.`,
            tip: 'Vends les objets dont tu n\'as pas besoin pour gagner de l\'argent.'
          }
        ]
      }
    };
  }

  /**
   * Crée le conteneur HTML pour les tutoriels
   */
  createContainer() {
    // Injecter le CSS moderne si pas déjà fait
    if (!document.getElementById('modern-ui-css')) {
      const link = document.createElement('link');
      link.id = 'modern-ui-css';
      link.rel = 'stylesheet';
      link.href = 'assets/css/modern-ui.css';
      document.head.appendChild(link);
    }

    // Nettoyer les anciennes instances si elles existent
    const existingOverlays = document.querySelectorAll('.tutorial-overlay.modern-ui');
    existingOverlays.forEach(el => el.remove());

    this.overlay = document.createElement('div');
    this.overlay.className = 'tutorial-overlay modern-ui';
    this.overlay.style.display = 'none';
    this.overlay.innerHTML = `
      <div class="tutorial-container">
        <div class="tutorial-header">
          <div class="tutorial-icon" id="tutorial-icon">🎮</div>
          <div>
            <div class="tutorial-title" id="tutorial-title">Tutoriel</div>
            <div class="tutorial-subtitle" id="tutorial-subtitle">Sous-titre</div>
          </div>
        </div>
        <div class="tutorial-content" id="tutorial-content">
          <!-- Contenu dynamique -->
        </div>
        <div class="tutorial-footer">
          <div class="tutorial-progress" id="tutorial-progress">
            <!-- Points de progression -->
          </div>
          <div class="tutorial-buttons">
            <button class="modern-btn modern-btn-secondary" id="tutorial-skip">Passer</button>
            <button class="modern-btn modern-btn-primary" id="tutorial-next">Suivant</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Events
    document.getElementById('tutorial-skip').addEventListener('click', () => this.skip());
    document.getElementById('tutorial-next').addEventListener('click', () => this.next());

    // Fermer avec Escape
    document.addEventListener('keydown', (e) => {
      if (this.isActive && e.code === 'Escape') {
        this.skip();
      }
      if (this.isActive && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        this.next();
      }
    });
  }

  /**
   * Lance un tutoriel
   */
  start(tutorialId, force = false) {
    const tutorial = this.tutorials[tutorialId];
    if (!tutorial) {
      console.warn(`[Tutorial] Tutoriel inconnu: ${tutorialId}`);
      return;
    }

    // Ne pas relancer si déjà complété (sauf si force)
    if (!force && this.completedTutorials.has(tutorialId)) {
      console.log(`[Tutorial] Tutoriel déjà complété: ${tutorialId}`);
      return;
    }

    console.log(`[Tutorial] Lancement: ${tutorialId}`);

    this.currentTutorial = tutorial;
    this.currentStep = 0;
    this.isActive = true;

    // Mettre à jour l'en-tête
    document.getElementById('tutorial-icon').textContent = tutorial.icon;
    document.getElementById('tutorial-title').textContent = tutorial.title;
    document.getElementById('tutorial-subtitle').textContent = tutorial.subtitle;

    // Afficher/Masquer bouton Passer
    const skipBtn = document.getElementById('tutorial-skip');
    skipBtn.style.display = tutorial.canSkip ? 'block' : 'none';

    // Créer les points de progression
    this.updateProgress();

    // Afficher le premier pas
    this.showStep();

    // Afficher l'overlay
    this.overlay.style.display = 'flex';
  }

  /**
   * Affiche l'étape actuelle
   */
  showStep() {
    const step = this.currentTutorial.steps[this.currentStep];
    const contentEl = document.getElementById('tutorial-content');
    const nextBtn = document.getElementById('tutorial-next');

    // Générer le contenu HTML de l'étape
    let html = `
      <div class="tutorial-step active">
        <h3 style="font-size: 16px; color: var(--text-primary); margin-bottom: 16px;">${step.title}</h3>
        <div class="tutorial-text">${step.content}</div>
    `;

    // Ajouter les contrôles si présents
    if (step.controls) {
      html += `
        <div style="margin-top: 20px; background: rgba(0,0,0,0.3); border-radius: 12px; padding: 16px;">
          ${step.controls.map(c => `
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <div class="tutorial-highlight" style="min-width: 140px;">${c.key}</div>
              <span style="color: var(--text-secondary); margin-left: 16px;">${c.desc}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Ajouter les actions de combat si présentes
    if (step.actions) {
      html += `
        <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          ${step.actions.map(a => `
            <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 10px; padding: 14px; text-align: center;">
              <div style="font-size: 24px; margin-bottom: 8px;">${a.icon}</div>
              <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${a.name}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">${a.desc}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Ajouter les items si présents
    if (step.items) {
      html += `
        <div style="margin-top: 20px; background: rgba(0,0,0,0.3); border-radius: 12px; padding: 16px;">
          ${step.items.map(item => `
            <div style="display: flex; align-items: center; margin-bottom: 10px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 8px;">
              <div style="font-weight: 600; color: var(--accent); min-width: 120px;">${item.name}</div>
              <span style="color: var(--text-secondary);">${item.desc}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Ajouter les stats si présentes
    if (step.stats) {
      html += `
        <div style="margin-top: 20px; background: rgba(0,0,0,0.3); border-radius: 12px; padding: 16px;">
          ${step.stats.map(stat => `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
              <div style="font-weight: 600; color: var(--primary-light); min-width: 100px;">${stat.name}</div>
              <span style="color: var(--text-secondary);">${stat.desc}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Ajouter le tip si présent
    if (step.tip) {
      html += `
        <div class="tutorial-tip">
          <div class="tutorial-tip-icon">💡</div>
          <div class="tutorial-tip-text">${step.tip}</div>
        </div>
      `;
    }

    html += '</div>';

    contentEl.innerHTML = html;

    // Mettre à jour le bouton
    if (this.currentStep >= this.currentTutorial.steps.length - 1) {
      nextBtn.textContent = 'Terminer';
    } else {
      nextBtn.textContent = 'Suivant';
    }

    // Mettre à jour la progression
    this.updateProgress();
  }

  /**
   * Met à jour les points de progression
   */
  updateProgress() {
    const progressEl = document.getElementById('tutorial-progress');
    const totalSteps = this.currentTutorial.steps.length;

    progressEl.innerHTML = '';
    for (let i = 0; i < totalSteps; i++) {
      const dot = document.createElement('div');
      dot.className = 'tutorial-progress-dot';
      if (i < this.currentStep) {
        dot.classList.add('completed');
      } else if (i === this.currentStep) {
        dot.classList.add('active');
      }
      progressEl.appendChild(dot);
    }
  }

  /**
   * Passe à l'étape suivante
   */
  next() {
    this.currentStep++;

    if (this.currentStep >= this.currentTutorial.steps.length) {
      this.complete();
    } else {
      this.showStep();
    }
  }

  /**
   * Saute le tutoriel
   */
  skip() {
    if (this.currentTutorial && this.currentTutorial.canSkip) {
      this.complete();
    }
  }

  /**
   * Termine le tutoriel
   */
  complete() {
    if (!this.currentTutorial) return;

    const tutorialId = this.currentTutorial.id;
    this.completedTutorials.add(tutorialId);
    this.saveProgress();

    console.log(`[Tutorial] Terminé: ${tutorialId}`);

    this.isActive = false;
    this.overlay.style.display = 'none';
    this.currentTutorial = null;
    this.currentStep = 0;

    // Callback optionnel
    if (this.onTutorialComplete) {
      this.onTutorialComplete(tutorialId);
    }
  }

  /**
   * Sauvegarde la progression dans localStorage
   */
  saveProgress() {
    try {
      localStorage.setItem('pokemon3d_tutorials', JSON.stringify([...this.completedTutorials]));
    } catch (e) {
      console.warn('[Tutorial] Erreur sauvegarde progression:', e);
    }
  }

  /**
   * Charge la progression depuis localStorage
   */
  loadProgress() {
    try {
      const saved = localStorage.getItem('pokemon3d_tutorials');
      if (saved) {
        const arr = JSON.parse(saved);
        this.completedTutorials = new Set(arr);
      }
    } catch (e) {
      console.warn('[Tutorial] Erreur chargement progression:', e);
    }
  }

  /**
   * Réinitialise la progression (pour debug)
   */
  resetProgress() {
    this.completedTutorials.clear();
    localStorage.removeItem('pokemon3d_tutorials');
    console.log('[Tutorial] Progression réinitialisée');
  }

  /**
   * Vérifie si un tutoriel a été complété
   */
  hasCompleted(tutorialId) {
    return this.completedTutorials.has(tutorialId);
  }

  /**
   * Affiche un tutoriel si pas encore vu
   */
  showIfNotSeen(tutorialId) {
    if (!this.hasCompleted(tutorialId)) {
      this.start(tutorialId);
      return true;
    }
    return false;
  }
}
