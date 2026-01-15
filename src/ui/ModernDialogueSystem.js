/**
 * ModernDialogueSystem.js - Système de dialogues moderne
 * Interface glassmorphism avec animations fluides
 */

export class ModernDialogueSystem {
  constructor(uiManager) {
    this.ui = uiManager;

    // État du dialogue
    this.isActive = false;
    this.currentNPC = null;
    this.dialogues = [];
    this.currentIndex = 0;
    this.dialogueKey = "";
    this.isTyping = false;
    this.typeSpeed = 20; // ms par caractère (plus rapide)

    // Callbacks
    this.onDialogueComplete = null;
    this.onChoiceMade = null;
    this.onSpecialEvent = null;

    // Variables de texte dynamique
    this.textVariables = {
      PLAYER: "Red",
      POKEMON: "",
      RIVAL: "Blue",
    };

    // Injecter le CSS moderne
    this.injectCSS();

    // Créer les éléments UI
    this.createDialogueUI();

    // Gestion des inputs
    this.setupInputs();
  }

  /**
   * Injecte le CSS moderne si nécessaire
   */
  injectCSS() {
    if (!document.getElementById('modern-ui-css')) {
      const link = document.createElement('link');
      link.id = 'modern-ui-css';
      link.rel = 'stylesheet';
      link.href = 'assets/css/modern-ui.css';
      document.head.appendChild(link);
    }
  }

  /**
   * Crée l'interface de dialogue moderne
   */
  createDialogueUI() {
    // Conteneur principal
    this.container = document.createElement("div");
    this.container.className = "modern-dialogue-container modern-ui";
    this.container.style.display = "none";

    // Boîte de dialogue
    this.dialogueBox = document.createElement("div");
    this.dialogueBox.className = "modern-dialogue-box";

    // En-tête avec portrait et nom
    this.header = document.createElement("div");
    this.header.className = "modern-dialogue-header";
    this.header.innerHTML = `
      <div class="modern-dialogue-portrait" id="dialogue-portrait">👤</div>
      <div>
        <div class="modern-dialogue-name" id="dialogue-name">NPC</div>
        <div class="modern-dialogue-role" id="dialogue-role">Habitant</div>
      </div>
    `;
    this.dialogueBox.appendChild(this.header);

    // Contenu du dialogue
    this.contentArea = document.createElement("div");
    this.contentArea.className = "modern-dialogue-content";
    this.textContainer = document.createElement("div");
    this.textContainer.className = "modern-dialogue-text";
    this.contentArea.appendChild(this.textContainer);
    this.dialogueBox.appendChild(this.contentArea);

    // Conteneur de choix
    this.choicesContainer = document.createElement("div");
    this.choicesContainer.className = "modern-dialogue-choices";
    this.choicesContainer.style.display = "none";
    this.dialogueBox.appendChild(this.choicesContainer);

    // Footer avec indice et indicateur
    this.footer = document.createElement("div");
    this.footer.className = "modern-dialogue-footer";
    this.footer.innerHTML = `
      <div class="modern-dialogue-hint">
        <span>Appuie sur</span>
        <kbd>E</kbd>
        <kbd>Espace</kbd>
        <span>pour continuer</span>
      </div>
      <div class="modern-dialogue-indicator" id="dialogue-indicator">▼</div>
    `;
    this.dialogueBox.appendChild(this.footer);

    this.container.appendChild(this.dialogueBox);
    document.body.appendChild(this.container);

    // Références aux éléments
    this.portraitEl = document.getElementById("dialogue-portrait");
    this.nameEl = document.getElementById("dialogue-name");
    this.roleEl = document.getElementById("dialogue-role");
    this.indicatorEl = document.getElementById("dialogue-indicator");
  }

  /**
   * Configure les inputs pour le dialogue
   */
  setupInputs() {
    document.addEventListener("keydown", (e) => {
      if (!this.isActive) return;

      if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") {
        e.preventDefault();
        e.stopPropagation();
        this.advance();
      }

      if (e.code === "Escape") {
        e.preventDefault();
        this.close();
      }
    });

    // Clic sur la boîte de dialogue
    this.dialogueBox.addEventListener("click", (e) => {
      if (this.isActive && this.choicesContainer.style.display === "none") {
        e.stopPropagation();
        this.advance();
      }
    });
  }

  /**
   * Obtient l'emoji et le rôle du PNJ
   */
  getNPCInfo(npc) {
    const categoryInfo = {
      professeurs: { icon: "science", role: "Professeur" },
      famille: { icon: "home", role: "Famille" },
      rivaux: { icon: "swords", role: "Rival" },
      champions: { icon: "trophy", role: "Champion d'Arène" },
      conseil_4: { icon: "crown", role: "Conseil des 4" },
      team_rocket: { icon: "rocket_launch", role: "Team Rocket" },
      infirmieres: { icon: "favorite", role: "Infirmière" },
      marchands: { icon: "store", role: "Vendeur" },
      villageois: { icon: "person", role: "Habitant" },
      dresseurs_insecte: { icon: "bug_report", role: "Dresseur Insecte" },
      dresseurs_shorts: { icon: "face", role: "Gamin" },
      pecheurs: { icon: "phishing", role: "Pêcheur" },
      scientifiques: { icon: "experiment", role: "Scientifique" },
      montagnards: { icon: "landscape", role: "Montagnard" },
      beautes: { icon: "palette", role: "Beauté" },
      gentlemen: { icon: "person_celebrate", role: "Gentleman" },
      rockers: { icon: "music_note", role: "Rocker" },
      psychics: { icon: "psychology", role: "Médium" },
      channelers: { icon: "visibility", role: "Exorciste" },
      karateka: { icon: "sports_martial_arts", role: "Karatéka" },
      ceinture_noire: { icon: "sports_martial_arts", role: "Ceinture Noire" },
      cooltrainers: { icon: "star", role: "Top Dresseur" },
    };

    return categoryInfo[npc.categorie] || { icon: "person", role: "Inconnu" };
  }

  /**
   * Démarre un dialogue
   */
  start(npc, dialogues, dialogueKey = "default") {
    this.isActive = true;
    this.currentNPC = npc;
    this.dialogues = dialogues;
    this.dialogueKey = dialogueKey;
    this.currentIndex = 0;

    // Obtenir les infos du PNJ
    const npcInfo = this.getNPCInfo(npc);

    // Mettre à jour l'en-tête
    this.portraitEl.innerHTML = `<span class="material-symbols-rounded">${npcInfo.icon}</span>`;
    this.nameEl.textContent = npc.nom || "???";
    this.roleEl.textContent = npcInfo.role;

    // Afficher
    this.container.style.display = "block";
    this.choicesContainer.style.display = "none";

    // Premier dialogue
    this.showCurrentDialogue();

    return this;
  }

  /**
   * Affiche le dialogue actuel
   */
  showCurrentDialogue() {
    if (this.currentIndex >= this.dialogues.length) {
      this.complete();
      return;
    }

    let text = this.dialogues[this.currentIndex];

    // Remplacer les variables
    text = this.replaceVariables(text);

    // Effet de typewriter
    this.typeText(text);

    // Gérer l'indicateur de suite
    const isLast = this.currentIndex >= this.dialogues.length - 1;
    this.indicatorEl.style.display = isLast ? "none" : "flex";
    this.footer.querySelector('.modern-dialogue-hint').textContent = isLast
      ? "Appuie sur E pour terminer"
      : "";
  }

  /**
   * Remplace les variables dans le texte
   */
  replaceVariables(text) {
    for (const [key, value] of Object.entries(this.textVariables)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
    return text;
  }

  /**
   * Effet de texte qui s'affiche progressivement
   */
  typeText(text) {
    this.textContainer.innerHTML = "";
    this.isTyping = true;
    this.fullText = text;

    let i = 0;

    const typeChar = () => {
      if (i < text.length && this.isActive && this.isTyping) {
        // Gérer les balises HTML
        if (text.charAt(i) === '<') {
          const closeTag = text.indexOf('>', i);
          if (closeTag !== -1) {
            this.textContainer.innerHTML += text.substring(i, closeTag + 1);
            i = closeTag + 1;
          }
        } else {
          this.textContainer.innerHTML += text.charAt(i);
          i++;
        }
        this.typeTimeout = setTimeout(typeChar, this.typeSpeed);
      } else {
        this.isTyping = false;
      }
    };

    typeChar();
  }

  /**
   * Skip l'animation de texte
   */
  skipTyping() {
    if (this.isTyping) {
      this.isTyping = false;
      clearTimeout(this.typeTimeout);
      this.textContainer.innerHTML = this.fullText;
    }
  }

  /**
   * Avance au dialogue suivant
   */
  advance() {
    // Si en train de taper, skip
    if (this.isTyping) {
      this.skipTyping();
      return;
    }

    // Si des choix sont affichés, ne pas avancer
    if (this.choicesContainer.style.display !== "none") {
      return;
    }

    this.currentIndex++;
    this.showCurrentDialogue();
  }

  /**
   * Affiche un choix au joueur
   */
  showChoices(choices) {
    this.choicesContainer.innerHTML = "";
    this.choicesContainer.style.display = "flex";
    this.indicatorEl.style.display = "none";
    this.footer.querySelector('.modern-dialogue-hint').textContent = "Sélectionne une option";

    choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.className = "modern-choice-btn";
      button.textContent = choice.text;
      button.onclick = (e) => {
        e.stopPropagation();
        this.selectChoice(index, choice);
      };
      this.choicesContainer.appendChild(button);
    });
  }

  /**
   * Gère la sélection d'un choix
   */
  selectChoice(index, choice) {
    // Animation de sélection
    const buttons = this.choicesContainer.querySelectorAll(".modern-choice-btn");
    buttons.forEach((btn, i) => {
      btn.classList.toggle("selected", i === index);
      btn.disabled = true;
    });

    setTimeout(() => {
      this.choicesContainer.style.display = "none";

      if (this.onChoiceMade) {
        this.onChoiceMade(index, choice, this.currentNPC);
      }

      // Continuer avec les dialogues de la branche choisie si spécifiés
      if (choice.nextDialogues) {
        this.dialogues = choice.nextDialogues;
        this.currentIndex = 0;
        this.showCurrentDialogue();
      } else {
        this.advance();
      }
    }, 300);
  }

  /**
   * Termine le dialogue
   */
  complete() {
    const npc = this.currentNPC;
    const key = this.dialogueKey;

    this.isActive = false;
    this.container.style.display = "none";

    // Déclencher les événements spéciaux
    this.triggerSpecialEvents(npc, key);

    if (this.onDialogueComplete) {
      this.onDialogueComplete(npc, key);
    }

    this.currentNPC = null;
    this.dialogues = [];
    this.currentIndex = 0;
  }

  /**
   * Ferme le dialogue prématurément
   */
  close() {
    this.isActive = false;
    this.isTyping = false;
    clearTimeout(this.typeTimeout);
    this.container.style.display = "none";

    if (this.onDialogueComplete && this.currentNPC) {
      this.onDialogueComplete(this.currentNPC, this.dialogueKey);
    }

    this.currentNPC = null;
    this.dialogues = [];
    this.currentIndex = 0;
  }

  /**
   * Déclenche les événements spéciaux selon le type de PNJ
   */
  triggerSpecialEvents(npc, dialogueKey) {
    if (!npc?.info) return;

    const info = npc.info;

    // Soin de l'équipe
    if ((info.soigne_equipe || info.soigne) && this.onSpecialEvent) {
      this.onSpecialEvent("heal_team", npc);
    }

    // Don du starter
    if (info.donne_starter && dialogueKey === "choix_starter") {
      this.showStarterChoice(npc);
      return;
    }

    // Don du Pokédex
    if (info.donne_pokedex && dialogueKey === "apres_starter") {
      if (this.onSpecialEvent) {
        this.onSpecialEvent("receive_pokedex", npc);
      }
    }

    // Combat de dresseur
    if (info.combat && !npc.isDefeated && dialogueKey === "before_combat") {
      if (this.onSpecialEvent) {
        this.onSpecialEvent("trainer_battle", npc);
      }
    }

    // Événements génériques définis dans le JSON
    if (info.events && info.events[dialogueKey]) {
      const eventName = info.events[dialogueKey];
      if (this.onSpecialEvent) {
        this.onSpecialEvent(eventName, npc);
      }
    }
  }

  /**
   * Affiche le choix du starter
   */
  showStarterChoice(npc) {
    this.isActive = true;
    this.container.style.display = "block";

    const starters = [
      { text: "🌱 Bulbizarre (Plante)", id: 1, name: "Bulbizarre" },
      { text: "🔥 Salamèche (Feu)", id: 4, name: "Salamèche" },
      { text: "💧 Carapuce (Eau)", id: 7, name: "Carapuce" },
    ];

    this.textContainer.innerHTML = `<span class="highlight">Choisis ton premier Pokémon !</span>
    <br><br>C'est une décision importante qui marquera le début de ton aventure.`;

    this.showChoices(
      starters.map((s) => ({
        text: s.text,
        data: s,
        nextDialogues: [
          `<span class="highlight">${s.name}</span> ! Excellent choix !`,
          `Ce Pokémon sera ton fidèle compagnon. Prends-en bien soin !`
        ],
      }))
    );

    const originalOnChoice = this.onChoiceMade;
    this.onChoiceMade = (index, choice, dialogueNpc) => {
      if (this.onSpecialEvent) {
        this.onSpecialEvent("receive_starter", {
          pokemon: choice.data,
          npc: dialogueNpc,
        });
      }
      this.onChoiceMade = originalOnChoice;
    };
  }

  /**
   * Affiche l'alerte de dresseur (!)
   */
  showTrainerAlert() {
    const existing = document.getElementById("trainer-alert");
    if (existing) existing.remove();

    const alert = document.createElement("div");
    alert.id = "trainer-alert";
    alert.style.cssText = `
      position: fixed;
      top: 30%;
      left: 50%;
      transform: translate(-50%, 0);
      font-size: 120px;
      color: #ef4444;
      text-shadow: 0 0 40px rgba(239, 68, 68, 0.8), 0 0 80px rgba(239, 68, 68, 0.5);
      z-index: 9999;
      pointer-events: none;
      animation: trainerAlertAnim 0.6s ease-out forwards;
    `;
    alert.textContent = "!";

    // Ajouter l'animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes trainerAlertAnim {
        0% { transform: translate(-50%, 0) scale(0); opacity: 0; }
        30% { transform: translate(-50%, 0) scale(1.4); opacity: 1; }
        100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(alert);

    // Supprimer après l'animation
    setTimeout(() => {
      alert.remove();
      style.remove();
    }, 800);
  }

  /**
   * Définit une variable de texte
   */
  setVariable(key, value) {
    this.textVariables[key] = value;
  }

  /**
   * Vérifie si un dialogue est actif
   */
  isDialogueActive() {
    return this.isActive;
  }

  /**
   * Affiche un message rapide (notification en dialogue)
   */
  showQuickMessage(message, duration = 2000) {
    this.textContainer.innerHTML = message;
    this.container.style.display = "block";
    this.choicesContainer.style.display = "none";
    this.indicatorEl.style.display = "none";
    this.header.style.display = "none";
    this.footer.style.display = "none";
    this.isActive = false; // Pas interactif

    setTimeout(() => {
      this.container.style.display = "none";
      this.header.style.display = "flex";
      this.footer.style.display = "flex";
    }, duration);
  }
}
