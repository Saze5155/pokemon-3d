export class TypeManager {
  constructor() {
    this.typeChart = null;
    this.isLoaded = false;
  }

  async init() {
    try {
      const response = await fetch("data/types.json");
      const data = await response.json();
      this.typeChart = data.efficacites;
      this.isLoaded = true;
      console.log("✅ TypeManager chargé");
    } catch (e) {
      console.error("❌ Erreur chargement types.json", e);
    }
  }

  getEffectiveness(moveType, defenderTypes) {
    if (!this.isLoaded) return 1;

    let multiplier = 1;

    // S'assurer que defenderTypes est un tableau (certains n'ont qu'un type)
    const types = Array.isArray(defenderTypes) ? defenderTypes : [defenderTypes];

    types.forEach((defType) => {
      // Nettoyer les strings (minuscule)
      const attacker = moveType.toLowerCase();
      const defender = defType.toLowerCase();

      if (this.typeChart[attacker] && this.typeChart[attacker][defender] !== undefined) {
        multiplier *= this.typeChart[attacker][defender];
      }
    });

    return multiplier;
  }

  getEffectivenessMessage(multiplier) {
    if (multiplier > 1) return "C'est super efficace !";
    if (multiplier === 0) return "Ça n'a aucun effet...";
    if (multiplier < 1) return "Ce n'est pas très efficace...";
    return "";
  }
}
