# Architecture Pokemon 3D - Documentation

## 📋 Vue d'ensemble

Ce document décrit l'architecture du projet Pokemon 3D et les améliorations de qualité récentes.

---

## 🏗️ Structure du projet

```
pokemon-3d/
├── src/
│   ├── config/          # Configuration centralisée
│   │   └── paths.js     # Chemins et constantes
│   ├── core/            # Systèmes principaux
│   │   ├── SaveManager.js
│   │   ├── VRManager.js
│   │   └── ...
│   ├── combat/          # Système de combat
│   ├── entities/        # Entités du jeu (Pokemon, Player, NPC)
│   ├── ui/              # Interfaces utilisateur
│   ├── utils/           # Utilitaires
│   │   ├── Debug.js         # Système de logging
│   │   └── ErrorHandler.js  # Gestion d'erreurs
│   └── world/           # Gestion du monde
├── assets/              # Ressources (sprites, modèles, etc.)
├── data/                # Données JSON (Pokemon, moves, etc.)
└── save/                # Fichiers de sauvegarde
```

---

## 🔧 Améliorations récentes

### 1. **Standardisation des données Pokemon**

**Problème** : Incohérence entre `pokemon.hp` et `pokemon.stats.hp` causant des erreurs null fréquentes.

**Solution** :
- Tous les Pokemon utilisent maintenant `stats.hp` et `stats.hpMax` comme source de vérité
- Getters/setters ajoutés pour la rétrocompatibilité : `pokemon.hp` est un alias de `pokemon.stats.hp`
- Simplification des helpers défensifs dans `CombatManager`

**Fichiers modifiés** :
- `src/entities/Pokemon.js`
- `src/entities/PokemonManager.js`
- `src/core/SaveManager.js`
- `src/combat/CombatManager.js`

### 2. **Consommation d'items**

**Problème** : Items jamais retirés de l'inventaire = exploit "items infinis".

**Solution** :
- Implémentation de `saveManager.removeItem()` lors de l'utilisation d'items en combat
- Sauvegarde automatique après consommation
- Mise à jour de l'UI de l'inventaire

**Fichiers modifiés** :
- `src/combat/CombatManager.js:2146-2163`

### 3. **Unification des versions Three.js**

**Problème** : 12 versions d'écart entre package.json (0.181.1) et CDN (0.169.0).

**Solution** :
- Mise à jour du CDN dans `index.html` vers 0.181.1
- Alignement avec `package.json`

**Fichiers modifiés** :
- `index.html:11-12`

### 4. **Système de debug conditionnel**

**Problème** : 639+ console.log dispersés dans tout le code.

**Solution** :
- Création de `src/utils/Debug.js` avec logging conditionnel
- Possibilité d'activer/désactiver les logs par catégorie
- Console globalement accessible : `window.debugLogger`

**Usage** :
```javascript
import { debug } from './utils/Debug.js';

debug.log('Message normal');
debug.logCategory('combat', 'Combat started');
debug.warn('Warning');
debug.error('Error'); // Toujours affiché
```

**Configuration** :
```javascript
// Dans la console du navigateur
debugLogger.setEnabled(false); // Désactiver tous les logs
debugLogger.setCategory('performance', true); // Activer une catégorie
```

### 5. **Suppression du code mort**

**Problèmes corrigés** :
- ✅ Doublons de déclarations dans `VRManager.js:73-76`
- ✅ Code commenté supprimé dans `CombatManager.js:234-248`

### 6. **Configuration centralisée des chemins**

**Problème** : Chemins hardcodés dispersés dans tout le code.

**Solution** :
- Création de `src/config/paths.js` pour centraliser tous les chemins
- Utilisation de constantes pour les assets, data, API endpoints, etc.

**Usage** :
```javascript
import { PATHS } from './config/paths.js';

fetch(PATHS.DATA.POKEMON);          // 'data/pokemons.json'
fetch(PATHS.API.SAVE_GAME);         // '/save-game'
localStorage.getItem(PATHS.STORAGE.SAVES);
```

**Avantages** :
- Un seul endroit pour modifier les chemins
- Code plus portable
- Facile à adapter pour différents environnements (dev/prod)

### 7. **Gestion d'erreurs unifiée**

**Problème** : Gestion d'erreurs incohérente (try-catch vs console.error silencieux).

**Solution** :
- Création de `src/utils/ErrorHandler.js` avec système unifié
- Niveaux de sévérité : INFO, WARNING, ERROR, CRITICAL
- Historique des erreurs pour debugging
- Notifications automatiques pour erreurs critiques

**Usage** :
```javascript
import { handleError, ErrorSeverity } from './utils/ErrorHandler.js';

try {
  // code risqué
} catch (error) {
  handleError(error, ErrorSeverity.WARNING, 'MonModule.maFonction');
}
```

**Wrapper pour fonctions async** :
```javascript
import { withErrorHandling } from './utils/ErrorHandler.js';

const safeFetch = withErrorHandling(async (url) => {
  const response = await fetch(url);
  return response.json();
}, 'API.fetch');
```

### 8. **Documentation du Monkey Patching**

**Problème** : Monkey patching dans `ModernUIInit.js` difficile à comprendre.

**Solution** :
- Ajout de commentaires expliquant le pattern utilisé
- Documentation de la dette technique (TODO: refactor vers Strategy Pattern)
- Ajout de `combatManager.modernCombatUI` pour référence explicite

**Note** : Ce pattern sera refactoré dans une future version pour utiliser un Strategy Pattern ou un système d'événements.

---

## 📊 Métriques de qualité

### Avant les améliorations :
- ❌ 639 console.log dispersés
- ❌ Structure de données incohérente
- ❌ Items infinis (bug critique)
- ❌ Chemins hardcodés
- ❌ Versions Three.js incompatibles
- ❌ Gestion d'erreurs anarchique

### Après les améliorations :
- ✅ Système de logging conditionnel
- ✅ Structure de données standardisée avec rétrocompatibilité
- ✅ Consommation d'items fonctionnelle
- ✅ Configuration centralisée des chemins
- ✅ Versions Three.js unifiées
- ✅ Gestion d'erreurs unifiée et traçable

---

## 🎯 Bonnes pratiques

### 1. **Utiliser le système de debug**
```javascript
// ❌ Mauvais
console.log('Pokemon spawned');

// ✅ Bon
debug.logCategory('pokemon', 'Pokemon spawned');
```

### 2. **Gérer les erreurs proprement**
```javascript
// ❌ Mauvais
try {
  dangerousOperation();
} catch (e) {
  console.error(e);
}

// ✅ Bon
try {
  dangerousOperation();
} catch (e) {
  handleError(e, ErrorSeverity.ERROR, 'Module.function');
}
```

### 3. **Utiliser les constantes de chemins**
```javascript
// ❌ Mauvais
fetch('data/pokemons.json');

// ✅ Bon
fetch(PATHS.DATA.POKEMON);
```

### 4. **Structure de données Pokemon**
```javascript
// ✅ Format standard
const pokemon = {
  stats: {
    hp: 100,
    hpMax: 100,
    attack: 50,
    // ...
  },
  // ...
};

// ✅ Accès rétrocompatible
pokemon.hp; // Retourne pokemon.stats.hp grâce au getter
pokemon.hp = 50; // Modifie pokemon.stats.hp grâce au setter
```

---

## 🔮 Améliorations futures

### Court terme :
- [ ] Supprimer les console.log restants et utiliser uniquement le système Debug
- [ ] Migrer tous les modules vers le système ErrorHandler
- [ ] Ajouter des tests unitaires pour les utilitaires

### Moyen terme :
- [ ] Refactorer le monkey patching vers un Strategy Pattern
- [ ] Implémenter un système d'événements global
- [ ] Réduire le couplage entre modules (CombatManager trop couplé)

### Long terme :
- [ ] Architecture modulaire avec dependency injection
- [ ] Système de plugins pour extensions
- [ ] Internationalisation (i18n)

---

## 📖 Ressources

### Documentation Three.js
- Version utilisée : **0.181.1**
- [Documentation officielle](https://threejs.org/docs/)
- [Migration guides](https://github.com/mrdoob/three.js/wiki/Migration-Guide)

### Patterns utilisés
- **Singleton** : Debug, ErrorManager
- **Adapter** : ModernCombatUI
- **Factory** : PokemonFactory
- **Strategy** : (À implémenter pour l'UI)

---

## 🤝 Contribution

Pour contribuer au projet :

1. Suivre les bonnes pratiques documentées
2. Utiliser le système Debug au lieu de console.log
3. Gérer les erreurs avec ErrorHandler
4. Utiliser les constantes de PATHS
5. Documenter les changements dans ce fichier

---

**Dernière mise à jour** : 2026-01-19
**Version** : 1.1.0
