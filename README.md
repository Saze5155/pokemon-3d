# 🎮 Pokémon 3D - Projet MMI

> **Recréation 3D de Pokémon Rouge/Bleu en WebGL avec Three.js**

Un jeu Pokémon en 3D à la première personne, développé dans le cadre du programme MMI (Métiers du Multimédia et de l'Internet). Ce projet vise à recréer l'expérience authentique de la 1ère génération Pokémon avec des technologies web modernes.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Three.js](https://img.shields.io/badge/Three.js-0.181.1-green)
![Node.js](https://img.shields.io/badge/Node.js-Express-yellow)

---

## 📋 Table des matières

- [Aperçu du projet](#-aperçu-du-projet)
- [Fonctionnalités](#-fonctionnalités)
- [Installation](#-installation)
- [Commandes du jeu](#-commandes-du-jeu)
- [L'Éditeur de niveaux](#-léditeur-de-niveaux)
- [Architecture technique](#-architecture-technique)
- [Structure des fichiers](#-structure-des-fichiers)
- [Zones disponibles](#-zones-disponibles)
- [Roadmap](#-roadmap)

---

## 🌟 Aperçu du projet

### État actuel
Ce projet représente **la première partie de l'aventure Pokémon**, couvrant :
- **Bourg Palette** → Ville de départ
- **Route 1** → Première route avec Pokémon sauvages
- **Jadielle** → Première ville avec Centre Pokémon et Boutique
- **Route 2** → Vers la Forêt de Jade
- **Forêt de Jade** → En cours
- **Argenta** → Ville du premier badge (Badge Roche)

### Particularités
- 🎮 **Vue FPS** - Exploration à la première personne
- 🌍 **Monde seamless** - Chargement dynamique des zones sans écran de chargement
- ⚔️ **Combat authentique** - Formules de dégâts et mécaniques Gen 1
- 🔧 **Éditeur intégré** - Créez vos propres niveaux en temps réel
- 💾 **3 slots de sauvegarde** - Système complet de progression

---

## ✨ Fonctionnalités

### Système de jeu
| Fonctionnalité | Statut | Description |
|----------------|--------|-------------|
| Combat tour par tour | ✅ | Attaques, types, efficacité |
| Capture Pokémon | ✅ | Système de Pokéballs fonctionnel |
| Pokédex | ✅ | 151 Pokémon de la Gen 1 |
| Système de types | ✅ | 15 types avec table d'efficacité |
| Système d'XP | ✅ | Montée de niveau et apprentissage |
| Évolutions | ✅ | Par niveau |
| PNJ & Dialogues | ✅ | Système de dialogue avancé |
| Dresseurs | ✅ | Combats contre dresseurs |
| Boutiques | ✅ | Achat/vente d'objets |
| Centre Pokémon | ✅ | Soin de l'équipe |
| Sauvegarde | ✅ | 3 slots, persistance serveur |

### Système technique
| Fonctionnalité | Statut | Description |
|----------------|--------|-------------|
| World seamless | ✅ | Chargement dynamique des zones |
| Portails temps réel | ✅ | Aperçu des scènes intérieures |
| Optimisations | ✅ | Cache collisions, LOD, culling |
| Éditeur de niveaux | ✅ | Création complète de scènes |
| Support VR | 🔜 | Prévu (WebXR) |

---

## 🚀 Installation

### Prérequis
- Node.js (v16+)
- Navigateur moderne (Chrome, Firefox, Edge)

### Étapes

```bash
# 1. Cloner le repository
git clone https://github.com/votre-repo/pokemon-3d.git
cd pokemon-3d

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur
npm start

# 4. Ouvrir dans le navigateur
# Jeu: http://localhost:3000
# Éditeur: http://localhost:3000/editor.html
```

### Structure requise des assets
```
/models/          # Modèles 3D (.glb, .fbx, .obj)
/assets/          # Assets 2D (.png, .jpg, .gif)
/sprites/         # Sprites Pokémon (.png)
/data/            # Fichiers JSON de configuration
/save/            # Sauvegardes (créé automatiquement)
/music/           # Musiques et effets sonores
```

---

## 🎮 Commandes du jeu

### Déplacement
| Touche | Action |
|--------|--------|
| `Z` / `W` | Avancer |
| `S` | Reculer |
| `Q` / `A` | Aller à gauche |
| `D` | Aller à droite |
| `Shift` | Courir (x1.8) |
| `Espace` | Sauter |
| `Souris` | Regarder autour |

### Interface
| Touche | Action |
|--------|--------|
| `Échap` | Menu pause / Fermer menu |
| `E` | Interagir (PNJ, objets, portes) |
| `F3` | Afficher/Masquer debug (FPS, position, etc.) |
| `Clic` | Verrouiller la souris (mode FPS) |

### Raccourcis (Debug/Cheat)
| Touche | Action |
|--------|--------|
| `L` | Gagner de l'XP (en combat ou hors combat) |

### En combat
| Touche | Action |
|--------|--------|
| `Clic gauche` | Lancer la Pokéball |
| `A` | Capturer un Pokémon (après affaiblissement) |

- Utilisez la souris pour sélectionner vos actions
- `Attaque` → Choisir parmi 4 attaques
- `Sac` → Utiliser des objets
- `Pokémon` → Changer de Pokémon
- `Fuite` → Tenter de fuir (impossible contre dresseurs)

---

## 🔧 L'Éditeur de niveaux

L'éditeur permet de créer et modifier des scènes 3D complètes.

### Accès
```
http://localhost:3000/editor.html
```

### Interface

#### Panneau gauche - Galerie de modèles
- Parcourez les modèles 3D disponibles par catégorie
- Filtrez par type (bâtiments, nature, objets, etc.)
- Cliquez pour sélectionner un modèle à placer

#### Panneau droit - Propriétés
- **Propriétés objet** : Couleur, échelle, collision
- **Terrain** : Taille du sol, sculpture de terrain
- **Intérieur** : Murs automatiques, plafond, hauteur
- **Portails** : Création de liens entre scènes
- **Entités** : Placement de PNJ et spawn zones

### Outils disponibles

| Outil | Raccourci | Description |
|-------|-----------|-------------|
| Caméra libre | `C` | Navigation ZQSD + Espace/Shift |
| Sélection | `V` | Sélectionner et modifier des objets |
| Placement | `P` | Placer le modèle sélectionné |
| Remplissage | `F` | Placer plusieurs objets en grille |
| Mur | `W` | Dessiner des murs |
| Sol | `L` | Dessiner des sols/plafonds |
| Portail | `O` | Créer des portails entre scènes |
| Entités | `N` | Placer PNJ et zones de spawn |

### Raccourcis éditeur

| Raccourci | Action |
|-----------|--------|
| `R` | Rotation Y (+22.5°) |
| `E` | Rotation X (+22.5°) |
| `Molette` | Ajuster la hauteur de l'objet |
| `Tab` | Activer/Désactiver le snap à la grille |
| `Entrée` | Confirmer le placement |
| `Suppr` / `Backspace` | Supprimer le dernier objet |
| `Ctrl+C` | Copier l'objet sélectionné |
| `Ctrl+V` | Coller l'objet |
| `Ctrl+S` | Sauvegarder la scène |

### Création d'une scène

1. **Nouvelle scène**
   - Menu → Nouvelle scène
   - Donnez un nom (ex: `ma-maison`)

2. **Configuration du terrain**
   - Ajustez la taille (10-500 unités)
   - Pour un intérieur : activez `Est un intérieur`

3. **Placement d'objets**
   - Sélectionnez un modèle dans la galerie
   - Outil `P` (Placement)
   - Cliquez sur le sol pour placer
   - `Entrée` pour confirmer

4. **Création de portails**
   - Outil `O` (Portail)
   - Cliquez pour placer le portail
   - Configurez la scène cible et le spawn

5. **Sauvegarde**
   - `Ctrl+S` ou Menu → Sauvegarder
   - Le fichier JSON est créé dans `/scenes/`

### Outil Entités

L'outil Entités permet de placer :

#### PNJ (Personnages Non Joueurs)
- Sélectionnez un PNJ dans la liste
- Placez-le sur la carte
- Configurez :
  - Direction de regard
  - Dialogues
  - Type (normal, dresseur, marchand)

#### Zones de Spawn Pokémon
- Dessinez une zone rectangulaire
- Configurez :
  - Liste des Pokémon possibles
  - Niveaux min/max
  - Taux de rencontre

### Éditeur de World Map

Pour les zones extérieures seamless :
- Ouvrez l'onglet "World Map"
- Glissez-déposez les zones sur la carte
- Ajustez les positions pour un monde cohérent
- Sauvegardez dans `worldmap.json`

---

## 🏗️ Architecture technique

### Managers (Systèmes principaux)

```
PokemonGame (main.js)
├── InputManager        # Gestion clavier/souris
├── SceneManager        # Scènes Three.js et portails
├── WorldManager        # Monde seamless extérieur
├── CombatManager       # Logique de combat
├── PokemonManager      # Entités Pokémon 3D
├── NPCManager          # PNJ et dialogues
├── SaveManager         # Sauvegarde/chargement
├── UIManager           # Interface utilisateur
├── AudioManager        # Musiques et sons
├── TypeManager         # Table des types
├── MoveManager         # Base de données attaques
├── XPManager           # Expérience et niveaux
└── OptimizationManager # Performance (cache, LOD)
```

### Flux de données

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Server    │◄───►│  SaveManager │◄───►│   Client    │
│  (Express)  │     │              │     │  (Three.js) │
└─────────────┘     └──────────────┘     └─────────────┘
      │                                        │
      ▼                                        ▼
┌─────────────┐                         ┌─────────────┐
│   /scenes   │                         │   Render    │
│   /data     │                         │    Loop     │
│   /save     │                         └─────────────┘
└─────────────┘
```

### Système de portails

Les portails permettent des transitions fluides entre zones :

1. **Portails classiques** (intérieurs)
   - Render-to-texture en temps réel
   - Aperçu de la scène cible
   - Téléportation au contact

2. **World seamless** (extérieurs)
   - Chargement/déchargement dynamique
   - Basé sur la distance au joueur
   - Pas d'écran de chargement

---

## 📁 Structure des fichiers

```
pokemon-3d/
├── 📄 index.html           # Page principale du jeu
├── 📄 editor.html          # Éditeur de niveaux
├── 📄 server.js            # Serveur Express (port 3000)
├── 📄 package.json         # Dépendances npm
├── 📄 fbxtoglb.js          # Convertisseur FBX vers GLB
│
├── 📁 src/                 # Code source (20 745 lignes)
│   │
│   ├── 📁 core/            # Systèmes principaux
│   │   ├── main.js         # Point d'entrée (2 447 lignes)
│   │   ├── SaveManager.js  # Sauvegarde/chargement (1 136 lignes)
│   │   ├── OptimizationManager.js  # Cache, LOD, culling (938 lignes)
│   │   ├── SceneManager.js # Scènes et portails (867 lignes)
│   │   ├── WorldManager.js # Monde seamless (716 lignes)
│   │   ├── AudioManager.js # Musiques et sons (200 lignes)
│   │   ├── InputManager.js # Contrôles (191 lignes)
│   │   ├── XPManager.js    # Expérience (184 lignes)
│   │   └── CollisionCache.js # Cache collisions (147 lignes)
│   │
│   ├── 📁 combat/          # Système de combat
│   │   ├── CombatManager.js    # Logique combat (1 996 lignes)
│   │   ├── PokeballPhysics.js  # Physique capture (794 lignes)
│   │   ├── TypeManager.js      # Types Pokémon (46 lignes)
│   │   └── MoveManager.js      # Attaques (44 lignes)
│   │
│   ├── 📁 entities/        # Entités du jeu
│   │   ├── NPCManager.js   # PNJ et dialogues (1 017 lignes)
│   │   ├── PokemonManager.js # Gestion Pokémon 3D (824 lignes)
│   │   ├── Pokemon.js      # Classe Pokémon (322 lignes)
│   │   ├── ActivePokemon.js # Pokémon actif (243 lignes)
│   │   ├── Player.js       # Joueur (193 lignes)
│   │   └── MaterialFixer.js # Réparation matériaux (101 lignes)
│   │
│   ├── 📁 ui/              # Interface utilisateur
│   │   ├── UI.js           # UIManager principal (2 350 lignes)
│   │   └── DialogueSystem.js # Dialogues (589 lignes)
│   │
│   ├── 📁 editor/          # Éditeur de niveaux
│   │   ├── editor.js       # Éditeur principal (3 017 lignes)
│   │   ├── WorldMapEditor.js # Éditeur world map (1 331 lignes)
│   │   └── EntityTool.js   # Outil entités (942 lignes)
│   │
│   └── 📁 world/           # Système monde
│       └── Portal.js       # Portails (110 lignes)
│
├── 📁 assets/              # Ressources du jeu
│   ├── 📁 models/          # Modèles 3D (43 catégories)
│   │   ├── bourgpalette/   # Bâtiments Bourg Palette
│   │   └── argenta/        # Bâtiments Argenta
│   │
│   ├── 📁 sprites/
│   │   ├── 📁 pokemons/    # 144 GLB + 15 FBX
│   │   └── 📁 pnj/         # 30 personnages (champions, dresseurs, etc.)
│   │
│   ├── 📁 music/           # 16 musiques MP3
│   ├── 📁 textures/        # Textures 2D
│   └── 📁 css/             # Styles (shop.css)
│
├── 📁 data/                # Données JSON
│   ├── pokemons.json       # 151 Pokémon (stats, évolutions)
│   ├── attaques.json       # Base de données des attaques
│   ├── movesets.json       # Attaques par Pokémon
│   ├── types.json          # Table d'efficacité (15 types)
│   ├── pnj.json            # Base de données PNJ
│   └── objets.json         # Objets du jeu
│
├── 📁 scenes/              # 18 scènes JSON
│   ├── bourg-palette.json  # Ville de départ
│   ├── route1.json         # Première route
│   ├── route2.json         # Route vers Forêt de Jade
│   ├── route2nord.json     # Sortie de la forêt
│   ├── jadielle.json       # Première grande ville
│   ├── foretjade.json      # Forêt de Jade
│   ├── argenta.json        # Ville du 1er badge
│   ├── maison.json         # Maison joueur (RDC)
│   ├── maisonetage.json    # Maison joueur (étage)
│   ├── labo.json           # Laboratoire Prof. Chen
│   ├── centre.json         # Centre Pokémon Jadielle
│   ├── centre-argenta.json # Centre Pokémon Argenta
│   ├── market.json         # Boutique Jadielle
│   ├── market-argenta.json # Boutique Argenta
│   └── worldmap.json       # Configuration monde seamless
│
└── 📁 saves/               # Sauvegardes
    ├── sauvegarde.json     # 3 slots de sauvegarde
    └── mypokemon.json      # Équipe et Pokédex
```

---

## 🗺️ Zones disponibles

### Extérieures (World Seamless)
| Zone | Description | Pokémon sauvages |
|------|-------------|------------------|
| Bourg Palette | Ville de départ | - |
| Route 1 | Première route | Rattata, Pidgey |
| Jadielle | Ville avec boutique | - |
| Route 2 | Vers Forêt de Jade | Rattata, Pidgey, Chenipan |
| Route 2 Nord | Sortie forêt | Rattata, Pidgey |
| Forêt de Jade | Grande forêt | Chenipan, Aspicot, Pikachu |
| Argenta | 1er badge | - |

### Intérieures (Portails)
| Scène | Description |
|-------|-------------|
| maison | Maison du joueur (RDC) |
| maisonetage | Maison du joueur (étage) |
| labo | Laboratoire Prof. Chen |
| centre | Centre Pokémon Jadielle |
| centre-argenta | Centre Pokémon Argenta |
| market | Boutique Jadielle |
| market-argenta | Boutique Argenta |

---

## 🛣️ Roadmap

### Version actuelle (1.0)
- [x] Exploration FPS
- [x] Combat Gen 1 complet
- [x] Système de capture
- [x] 151 Pokémon
- [x] PNJ et dialogues
- [x] Sauvegarde 3 slots
- [x] Éditeur de niveaux
- [x] Zones jusqu'à Argenta

### Prochaines versions
- [ ] Support VR (WebXR)
- [ ] Multijoueur (échanges)

---

## 🎨 Crédits

- **Développement** : Projet MMI
- **Assets 3D** : Extraits et convertis depuis Pokémon Let's Go Pikachu
- **Musiques** : Remixes des thèmes originaux
- **Framework 3D** : [Three.js](https://threejs.org/)

---

## 📝 Notes techniques

### Performances
- Le jeu est optimisé pour fonctionner à 60 FPS sur la plupart des machines
- Le cache de collisions améliore les performances de 150-240%
- Les zones seamless se chargent dynamiquement selon la distance

### Compatibilité
- Chrome 90+, Firefox 88+, Edge 90+
- WebGL 2.0 requis
- Résolution recommandée : 1920x1080

### Problèmes connus
- Certains modèles 3D peuvent avoir des matériaux corrompus (auto-réparation au chargement)
- La musique nécessite une interaction utilisateur pour démarrer (norme navigateur)

---

## 📜 Licence

Projet éducatif - Usage non commercial uniquement.
Pokémon © Nintendo/Game Freak/The Pokémon Company.

---

<p align="center">
  <i>Attrapez-les tous ! 🔴⚪</i>
</p>
