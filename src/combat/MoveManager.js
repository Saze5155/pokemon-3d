export class MoveManager {
  constructor() {
    this.moves = new Map();
    this.isLoaded = false;
  }

  async init() {
    try {
      const response = await fetch("data/attaques.json");
      const data = await response.json();
      
      // Aplatir la structure par Type -> MoveID
      Object.entries(data).forEach(([type, typeMoves]) => {
        Object.entries(typeMoves).forEach(([id, moveData]) => {
          // Injecter le type dans les données du move
          moveData.type = type;
          this.moves.set(id, moveData);
        });
      });

      this.isLoaded = true;
      console.log(`✅ MoveManager chargé : ${this.moves.size} attaques indexées`);
    } catch (e) {
      console.error("❌ Erreur chargement attaques.json", e);
    }
  }

  getMove(moveId) {
    if (!this.isLoaded) return null;
    // Gérer les cas null ou undefined
    if (!moveId) return null;
    
    // Normaliser l'ID en string
    const id = String(moveId).toLowerCase();
    
    return this.moves.get(id) || {
      nom: "Charge",
      type: "normal",
      puissance: 40,
      precision: 100,
      description: "Attaque par défaut (Erreur ID)"
    };
  }
}
