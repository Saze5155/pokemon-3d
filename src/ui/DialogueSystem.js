/**
 * DialogueSystem - Système de dialogues pour les PNJ
 * Interface style Pokémon avec gestion des choix et événements
 */
export class DialogueSystem {
  constructor(uiManager) {
    this.ui = uiManager;

    // État du dialogue
    this.isActive = false;
    this.currentNPC = null;
    this.dialogues = [];
    this.currentIndex = 0;
    this.dialogueKey = "";
    this.isTyping = false;

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

    // Créer les éléments UI
    this.createDialogueUI();

    // Gestion des inputs
    this.setupInputs();
  }

  /**
   * Crée l'interface de dialogue
   */
  createDialogueUI() {
    // Conteneur principal
    this.container = document.createElement("div");
    this.container.id = "dialogue-container";
    this.container.style.cssText = `
      display: none;
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 700px;
      z-index: 1000;
      pointer-events: auto;
    `;

    // Boîte de dialogue style Pokémon
    this.dialogueBox = document.createElement("div");
    this.dialogueBox.className = "dialogue-box";
    this.dialogueBox.style.cssText = `
      background: linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%);
      border: 4px solid #333;
      border-radius: 8px;
      padding: 20px 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.8);
      font-family: 'Segoe UI', Arial, sans-serif;
      position: relative;
      min-height: 80px;
    `;

    // Portrait du PNJ (cercle à gauche)
    this.portrait = document.createElement("div");
    this.portrait.className = "dialogue-portrait";
    this.portrait.style.cssText = `
      position: absolute;
      top: -40px;
      left: 15px;
      width: 70px;
      height: 70px;
      background: linear-gradient(180deg, #fff 0%, #e0e0e0 100%);
      border: 3px solid #333;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    `;
    this.dialogueBox.appendChild(this.portrait);

    // Nom du PNJ (badge)
    this.nameTag = document.createElement("div");
    this.nameTag.className = "dialogue-name";
    this.nameTag.style.cssText = `
      position: absolute;
      top: -20px;
      left: 95px;
      background: linear-gradient(180deg, #444 0%, #222 100%);
      color: #fff;
      padding: 5px 14px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    `;
    this.dialogueBox.appendChild(this.nameTag);

    // Texte du dialogue
    this.textContainer = document.createElement("div");
    this.textContainer.className = "dialogue-text";
    this.textContainer.style.cssText = `
      font-size: 17px;
      line-height: 1.7;
      color: #222;
      min-height: 50px;
      padding-top: 15px;
      padding-left: 5px;
    `;
    this.dialogueBox.appendChild(this.textContainer);

    // Indicateur "suite" (triangle animé)
    this.continueIndicator = document.createElement("div");
    this.continueIndicator.className = "dialogue-continue";
    this.continueIndicator.innerHTML = "▼";
    this.continueIndicator.style.cssText = `
      position: absolute;
      bottom: 8px;
      right: 15px;
      font-size: 12px;
      color: #666;
      animation: dialogueBounce 0.5s ease-in-out infinite alternate;
    `;
    this.dialogueBox.appendChild(this.continueIndicator);

    // Conteneur de choix
    this.choicesContainer = document.createElement("div");
    this.choicesContainer.className = "dialogue-choices";
    this.choicesContainer.style.cssText = `
      display: none;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 2px dashed #ccc;
    `;
    this.dialogueBox.appendChild(this.choicesContainer);

    this.container.appendChild(this.dialogueBox);
    document.body.appendChild(this.container);

    // Ajouter les styles d'animation
    this.addStyles();
  }

  /**
   * Ajoute les styles CSS
   */
  addStyles() {
    if (document.getElementById("dialogue-styles")) return;

    const style = document.createElement("style");
    style.id = "dialogue-styles";
    style.textContent = `
      @keyframes dialogueBounce {
        from { transform: translateY(0); }
        to { transform: translateY(-4px); }
      }
      
      @keyframes trainerAlert {
        0% { transform: translate(-50%, 0) scale(0); opacity: 0; }
        30% { transform: translate(-50%, 0) scale(1.4); opacity: 1; }
        100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
      }
      
      .dialogue-choice {
        display: block;
        width: 100%;
        padding: 12px 18px;
        margin: 6px 0;
        background: linear-gradient(180deg, #f8f8f8 0%, #e8e8e8 100%);
        border: 3px solid #555;
        border-radius: 6px;
        font-family: inherit;
        font-size: 15px;
        color: #333;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: left;
      }
      
      .dialogue-choice:hover {
        background: linear-gradient(180deg, #fff 0%, #f5f5f5 100%);
        border-color: #333;
        transform: translateX(5px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      
      .dialogue-choice:active {
        transform: translateX(5px) scale(0.98);
      }
      
      .dialogue-choice.selected {
        background: linear-gradient(180deg, #4a9eff 0%, #2d7dd2 100%);
        color: #fff;
        border-color: #1a5a9e;
      }
      
      #trainer-alert {
        position: fixed;
        top: 30%;
        left: 50%;
        transform: translate(-50%, 0);
        font-size: 100px;
        color: #ff3333;
        text-shadow: 0 0 30px rgba(255,50,50,0.8), 0 0 60px rgba(255,0,0,0.5);
        z-index: 9999;
        pointer-events: none;
        animation: trainerAlert 0.6s ease-out forwards;
      }
    `;
    document.head.appendChild(style);
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
   * Démarre un dialogue
   */
  start(npc, dialogues, dialogueKey = "default") {
    this.isActive = true;
    this.currentNPC = npc;
    this.dialogues = dialogues;
    this.dialogueKey = dialogueKey;
    this.currentIndex = 0;

    // Mettre à jour l'UI
    this.portrait.textContent = this.getNPCEmoji(npc);
    this.nameTag.textContent = npc.nom;

    // Afficher
    this.container.style.display = "block";
    this.choicesContainer.style.display = "none";

    // Premier dialogue
    this.showCurrentDialogue();

    return this;
  }

  /**
   * Obtient l'emoji représentatif du PNJ
   */
  getNPCEmoji(npc) {
    const categoryEmojis = {
      professeurs: "🔬",
      famille: "🏠",
      rivaux: "😤",
      champions: "🏆",
      conseil_4: "👑",
      team_rocket: "🚀",
      infirmieres: "💗",
      marchands: "🛒",
      villageois: "👤",
      dresseurs_insecte: "🐛",
      dresseurs_shorts: "👦",
      pecheurs: "🎣",
      scientifiques: "🧪",
      montagnards: "⛰️",
      beautes: "💄",
      gentlemen: "🎩",
      rockers: "🎸",
      psychics: "🔮",
      channelers: "👻",
      karateka: "🥋",
      ceinture_noire: "🥋",
      cooltrainers: "⭐",
    };

    return categoryEmojis[npc.categorie] || "👤";
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
    this.continueIndicator.style.display =
      this.currentIndex < this.dialogues.length - 1 ? "block" : "none";
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
    this.textContainer.textContent = "";
    this.isTyping = true;
    this.fullText = text;

    let i = 0;
    const speed = 25; // ms par caractère

    const typeChar = () => {
      if (i < text.length && this.isActive && this.isTyping) {
        this.textContainer.textContent += text.charAt(i);
        i++;
        this.typeTimeout = setTimeout(typeChar, speed);
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
      this.textContainer.textContent = this.fullText;
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
    this.choicesContainer.style.display = "block";
    this.continueIndicator.style.display = "none";

    choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.className = "dialogue-choice";
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
    const buttons = this.choicesContainer.querySelectorAll(".dialogue-choice");
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
      return; // Ne pas terminer le dialogue, attendre le choix
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

    // Événements génériques définis dans le JSON (ex: "accueil": "open_shop")
    if (info.events && info.events[dialogueKey]) {
        const eventName = info.events[dialogueKey];
        console.log(`[DialogueSystem] Déclenchement événement générique: ${eventName}`);
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

    this.textContainer.textContent = "Choisis ton premier Pokémon !";

    this.showChoices(
      starters.map((s) => ({
        text: s.text,
        data: s,
        nextDialogues: [`Tu as choisi ${s.name} ! Prends-en bien soin !`],
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
    // Supprimer l'ancien s'il existe
    const existing = document.getElementById("trainer-alert");
    if (existing) existing.remove();

    const alert = document.createElement("div");
    alert.id = "trainer-alert";
    alert.textContent = "!";
    document.body.appendChild(alert);

    // Supprimer après l'animation
    setTimeout(() => alert.remove(), 800);
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
}
