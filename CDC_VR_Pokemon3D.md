# Cahier des Charges - Mode VR
## Pokémon 3D - Projet MMI 3ème année

---

## 1. Présentation Générale

### 1.1 Objectif
Implémenter un mode Réalité Virtuelle complet permettant aux joueurs d'explorer la région de Kanto et de capturer des Pokémon de manière immersive, en utilisant les capacités natives du Quest 3.

### 1.2 Plateforme Cible
- **Casque** : Meta Quest 3
- **Technologie** : WebXR API
- **Navigateur** : Meta Quest Browser
- **Compatibilité** : Détection automatique VR/Desktop

### 1.3 Principes Directeurs
- Immersion maximale avec interactions naturelles
- Confort utilisateur (prévention motion sickness)
- Cohérence avec la version desktop existante
- Performance optimisée pour le Quest 3

---

## 2. Système de Navigation

### 2.1 Déplacement (Locomotion)

| Méthode | Input | Description |
|---------|-------|-------------|
| Smooth Locomotion | Joystick gauche | Déplacement fluide dans la direction du joystick |
| Rotation Snap | Joystick droit | Rotation par paliers de 45° (gauche/droite) |
| Room-scale | Tracking casque | Le joueur peut bouger physiquement dans son espace |

### 2.2 Paramètres de Déplacement
- **Vitesse** : Identique à la version desktop
- **Direction** : Relative à l'orientation de la tête
- **Collisions** : Système existant conservé (CollisionCache.js)

### 2.3 Gestion de la Hauteur
- **Mode** : Hauteur réelle du joueur
- **Calibration** : Automatique via WebXR floor detection
- **Sol** : Aligné avec le sol virtuel du jeu

---

## 3. Système d'Interface (UI VR)

### 3.1 La Montre (Poignet Gauche)

#### 3.1.1 Activation
- **Geste** : Lever le poignet et tourner vers soi (comme regarder une montre)
- **Détection** : Angle du contrôleur par rapport à la tête (seuil ~60°)
- **Fermeture** : Baisser le poignet ou sélectionner une option

#### 3.1.2 Menus Accessibles
| Menu | Description |
|------|-------------|
| Équipe | Voir et gérer les 6 Pokémon |
| Sac | Inventaire des objets |
| Pokédex | Encyclopédie des Pokémon |
| Stockage | Accès aux PC/Stockage |
| Options | Paramètres du jeu (dont choix poignet dominant) |
| Sauvegarde | Sauvegarder la partie |
| Quitter | Sortir du mode VR (exclusif VR) |

#### 3.1.3 Options Spécifiques VR
- Choix du poignet dominant (gauche par défaut)
- Vitesse de rotation snap
- Sensibilité du joystick

### 3.2 Interface de Combat (via Montre)
- **Attaques** : Liste des 4 attaques du Pokémon actif
- **Sélection** : Pointeur laser + trigger
- **Informations** : PV, PP, statuts visibles

### 3.3 Dialogues PNJ
- **Position** : Panel flottant face au joueur
- **Distance** : ~1.5m devant le joueur
- **Suivi** : Le panel suit la rotation de la tête (billboard)
- **Interaction** : Pointeur laser pour les choix

---

## 4. Système de Ceinture

### 4.1 Disposition

```
        [JOUEUR VU DE DESSUS]
        
    Pokéballs vides      Équipe (6 slots)
    (capture)            (Pokémon)
         ●●●      ●●●●●●
          \        /
           \      /
            [CORPS]
           GAUCHE  DROITE
```

### 4.2 Côté Gauche - Pokéballs de Capture
- **Contenu** : Pokéballs vides disponibles dans l'inventaire
- **Affichage** : Uniquement les balls possédées
- **Types** : Pokéball, Superball, Hyperball, etc.
- **Position** : Arc de cercle à hauteur de hanche gauche

### 4.3 Côté Droit - Équipe Pokémon
- **Contenu** : Jusqu'à 6 Pokéballs (équipe actuelle)
- **Affichage** : Uniquement les slots occupés
- **Identification** : Nom du Pokémon visible sur/près de chaque ball
- **Position** : Arc de cercle à hauteur de hanche droite

### 4.4 Visibilité
- **Déclencheur** : Baisser la tête vers la ceinture
- **Seuil** : Angle de la tête > 30° vers le bas
- **Apparition** : Fade in progressif
- **Disparition** : Fade out quand le regard remonte

### 4.5 Interactions
- **Saisir** : Main gauche OU droite (grip button)
- **Attraper** : Proximité main + grip maintenu
- **Lâcher** : Relâcher grip (ball revient à sa place si non lancée)
- **Lancer** : Mouvement de lancer + relâcher grip avec vélocité

---

## 5. Système de Combat VR

### 5.1 Déclenchement
- **Transition** : Immédiate, sur place (pas de téléportation)
- **Position** : Le joueur reste où il est dans le monde
- **Pokémon adverse** : Apparaît devant le joueur (~3-5m)

### 5.2 Envoyer un Pokémon
1. Regarder vers la ceinture (côté droit)
2. Saisir la Pokéball du Pokémon choisi (grip)
3. Effectuer un geste de lancer vers l'adversaire
4. Le Pokémon sort de la ball (taille réelle)
5. La ball reste au sol près du Pokémon allié

### 5.3 Sélectionner une Attaque
1. Lever le poignet gauche (ouvrir la montre)
2. Interface de combat affichée :
   - 4 attaques disponibles
   - PV du Pokémon
   - PP de chaque attaque
3. Pointer avec le laser sur l'attaque
4. Valider avec le trigger
5. L'attaque s'exécute

### 5.4 Rappeler un Pokémon
1. Regarder vers la Pokéball au sol (près du Pokémon allié)
2. Faire un geste d'attraction OU la ball revient automatiquement
3. Le Pokémon rentre dans la ball
4. La ball réapparaît à la ceinture (côté droit)

### 5.5 Capturer un Pokémon Sauvage
1. Regarder vers la ceinture (côté gauche)
2. Saisir une Pokéball vide
3. Lancer sur le Pokémon adverse
4. Résultat immédiat (pas d'animation de secousse)
   - **Succès** : Pokémon capturé, ball ajoutée à l'équipe/stockage
   - **Échec** : Ball perdue, combat continue

### 5.6 Fuir le Combat
- Via la montre : option "Fuite" dans le menu de combat

### 5.7 Liberté de Mouvement
- Le joueur peut se déplacer librement pendant le combat
- Les Pokémon restent en position (pas de suivi du joueur)
- Utile pour observer les Pokémon sous différents angles

### 5.8 Échelle des Pokémon
- **Taille** : Réelle selon les données du Pokédex
- **Exemples** :
  - Pikachu : 0.4m
  - Dracaufeu : 1.7m
  - Onix : 8.8m
- **Ajustement** : Possible recul automatique pour les grands Pokémon

---

## 6. Interactions avec le Monde

### 6.1 Pointeur Laser
- **Source** : Main dominante (droite par défaut)
- **Visuel** : Rayon visible + point d'impact
- **Couleur** : Blanc par défaut, vert sur élément interactif
- **Portée** : 10-15 mètres

### 6.2 Éléments Interactifs
| Élément | Interaction |
|---------|-------------|
| PNJ | Pointer + trigger → Dialogue |
| Objets au sol | Pointer + trigger → Ramasser |
| Portes | Pointer + trigger → Entrer (via portail) |
| Panneaux | Pointer + trigger → Lire |
| PC | Pointer + trigger → Ouvrir interface |

### 6.3 Portails et Transitions
- **Fonctionnement** : Identique à la version desktop
- **Effet visuel** : Fade to black → chargement → fade in
- **Position joueur** : Replacé au spawn du nouveau lieu

---

## 7. Mains Virtuelles

### 7.1 Modèle
- **Type** : Mains humaines stylisées
- **Source** : Modèles génériques ou assets Quest
- **Animations** : 
  - Idle (main ouverte)
  - Grip (poing fermé)
  - Point (index tendu pour le laser)
  - Trigger (index replié)

### 7.2 Tracking
- **Méthode** : Controllers Quest 3
- **Précision** : 6DoF (position + rotation)
- **Latence** : Minimale (priorité rendu mains)

### 7.3 Retours Visuels
- **Proximité objet** : Highlight de l'objet
- **Saisie possible** : Changement couleur/outline
- **Objet saisi** : Attaché à la main

---

## 8. Détection et Basculement VR/Desktop

### 8.1 Détection Automatique
```javascript
// Pseudo-code de détection
if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    // Mode VR disponible
    showVRButton();
}
```

### 8.2 Activation VR
- **Méthode** : Bouton "Entrer en VR" sur l'écran titre
- **Alternative** : Via les options en jeu
- **Condition** : Casque VR détecté et compatible

### 8.3 Désactivation VR
- **Méthode 1** : Option "Quitter VR" dans la montre
- **Méthode 2** : Retirer le casque (session end)
- **Méthode 3** : Bouton Oculus (menu système)

### 8.4 Sauvegarde État
- Passage VR ↔ Desktop conserve la progression
- Position joueur sauvegardée
- État du combat préservé si applicable

---

## 9. Architecture Technique

### 9.1 Nouveau Fichier : VRManager.js

```javascript
// Structure proposée
class VRManager {
    constructor(game) { }
    
    // Initialisation
    async init() { }
    async checkVRSupport() { }
    
    // Session
    async startVRSession() { }
    async endVRSession() { }
    
    // Contrôleurs
    updateControllers() { }
    handleLeftController() { }
    handleRightController() { }
    
    // Locomotion
    handleMovement() { }
    handleSnapTurn() { }
    
    // UI
    updateWatchUI() { }
    isWatchVisible() { }
    updateBeltVisibility() { }
    
    // Interactions
    updateLaserPointer() { }
    handleGrab() { }
    handleThrow() { }
    
    // Combat spécifique
    throwPokeball(ball, velocity) { }
    recallPokemon() { }
    
    // Render loop
    onXRFrame(time, frame) { }
}
```

### 9.2 Modifications Fichiers Existants

| Fichier | Modifications |
|---------|---------------|
| main.js | Intégration VRManager, bouton VR |
| Player.js | Support position VR, désactiver contrôles clavier en VR |
| CombatManager.js | Support lancer physique, UI combat VR |
| UI.js | Rendu UI en world-space pour VR |
| InputManager.js | Abstraction input VR/Desktop |
| SceneManager.js | Support rendu stéréoscopique |
| PokeballPhysics.js | Physique de lancer VR |

### 9.3 Dépendances Recommandées
- **Three.js VR** : `WebXRManager` (inclus dans Three.js)
- **Controllers** : `XRControllerModelFactory`
- **Hand tracking** : Optionnel, pour futur

---

## 10. Performances

### 10.1 Objectifs
- **Framerate** : 72 FPS minimum (natif Quest 3)
- **Latence** : < 20ms motion-to-photon
- **Résolution** : Native Quest 3 (2064x2208 par œil)

### 10.2 Optimisations Requises
- **Foveated rendering** : Activer si supporté
- **LOD** : Réduire détails objets distants
- **Culling** : Frustum culling agressif
- **Draw calls** : Batching des objets statiques
- **Textures** : Compression adaptée mobile (ASTC)

### 10.3 Paramètres Ajustables (Options)
- Qualité graphique (Low/Medium/High)
- Distance d'affichage
- Densité de végétation
- Qualité des ombres

---

## 11. Confort Utilisateur

### 11.1 Prévention Motion Sickness
- **Rotation snap** : Par défaut (45°)
- **Vignette** : Assombrissement périphérique pendant le mouvement (optionnel)
- **Vitesse** : Modérée par défaut, ajustable

### 11.2 Accessibilité
- **Poignet dominant** : Configurable (gauche/droite)
- **Mode assis** : Support position assise
- **Sous-titres** : Dialogues lisibles à bonne distance

### 11.3 Pauses Recommandées
- Rappel après 30 minutes de jeu (optionnel)
- Sauvegarde facile et rapide

---

## 12. Phases de Développement

### Phase 1 : Fondations (Priorité Haute)
- [ ] Création VRManager.js
- [ ] Détection et session WebXR
- [ ] Rendu stéréoscopique basique
- [ ] Affichage contrôleurs/mains

### Phase 2 : Locomotion (Priorité Haute)
- [ ] Déplacement joystick gauche
- [ ] Rotation snap joystick droit
- [ ] Intégration collisions existantes
- [ ] Calibration hauteur

### Phase 3 : Interface Montre (Priorité Haute)
- [ ] Détection geste montre
- [ ] Affichage menu monde 3D
- [ ] Navigation pointeur laser
- [ ] Tous les sous-menus

### Phase 4 : Système Ceinture (Priorité Haute)
- [ ] Modélisation ceinture
- [ ] Affichage Pokéballs équipe (droite)
- [ ] Affichage Pokéballs capture (gauche)
- [ ] Détection visibilité (regard vers le bas)

### Phase 5 : Interactions (Priorité Moyenne)
- [ ] Système de saisie (grab)
- [ ] Physique de lancer
- [ ] Pointeur laser monde
- [ ] Interactions PNJ/Objets

### Phase 6 : Combat VR (Priorité Haute)
- [ ] Lancer Pokéball équipe
- [ ] Apparition Pokémon taille réelle
- [ ] Interface attaques sur montre
- [ ] Rappel Pokémon
- [ ] Capture (lancer ball vide)

### Phase 7 : Polish (Priorité Basse)
- [ ] Optimisations performances
- [ ] Effets visuels (particules, transitions)
- [ ] Sons spatialisés
- [ ] Retours haptiques manettes

---

## 13. Critères de Validation

### 13.1 Fonctionnel
- [ ] Peut démarrer une session VR depuis le menu
- [ ] Peut se déplacer dans le monde
- [ ] Peut interagir avec les PNJ
- [ ] Peut ouvrir et naviguer dans la montre
- [ ] Peut entrer en combat
- [ ] Peut lancer un Pokémon au combat
- [ ] Peut sélectionner et exécuter une attaque
- [ ] Peut capturer un Pokémon sauvage
- [ ] Peut sauvegarder et quitter

### 13.2 Performance
- [ ] 72 FPS stable en exploration
- [ ] 72 FPS stable en combat
- [ ] Pas de lag perceptible sur les inputs
- [ ] Temps de chargement < 5s entre zones

### 13.3 Confort
- [ ] Pas de motion sickness signalé (tests utilisateurs)
- [ ] Textes lisibles
- [ ] Interactions intuitives

---

## 14. Ressources et Références

### 14.1 Documentation
- [WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API)
- [Three.js VR](https://threejs.org/docs/#manual/en/introduction/How-to-create-VR-content)
- [Meta Quest Developer](https://developer.oculus.com/documentation/web/webxr-intro/)

### 14.2 Assets Nécessaires
- Modèles 3D mains
- Modèle ceinture avec emplacements
- Icônes/textures pour UI montre
- Effets visuels (laser, highlights)

---

## 15. Annexes

### 15.1 Mapping Contrôleurs Quest 3

```
MANETTE GAUCHE                    MANETTE DROITE
     [Y]  [X]                         [B]  [A]
        ╲╱                               ╲╱
    [Joystick]                       [Joystick]
    Déplacement                       Rotation
         │                                │
    [Trigger]                        [Trigger]
    Sélection                        Sélection
         │                                │
     [Grip]                            [Grip]
     Saisir                            Saisir
```

### 15.2 Angles de Détection

```
VUE DE PROFIL - Détection Montre

          Tête
           ●
          /│\
         / │ \  ← 60° zone d'activation
        /  │  \
       /   │   \
      ▼    │
   [Montre visible]

VUE DE FACE - Détection Ceinture

           ●  Tête
           │
           │  ← Regard droit (0°)
           │
          ╱│╲
         ╱ │ ╲  ← 30° vers le bas
        ╱  │  ╲
       ▼   ▼   ▼
    [Ceinture visible]
```

---

*Document créé le : Janvier 2025*
*Version : 1.0*
*Projet : Pokémon 3D - MMI 3ème année*
