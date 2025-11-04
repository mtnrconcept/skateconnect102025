# Système IA pour Game of S.K.A.T.E

## Vue d'ensemble

Ce système d'intelligence artificielle analyse les tricks de skateboard en temps réel pour automatiser l'arbitrage dans le Game of S.K.A.T.E. Il utilise la détection de pose (MoveNet/MediaPipe), la classification temporelle (ST-GCN/TCN), et une machine d'états d'arbitrage pour valider les tricks.

## Architecture

### Pipeline temps-réel

1. **Capture vidéo** (WebRTC)
   - Échantillonnage à 12-15 fps
   - Format: 1280x720 @ 30fps → downsample pour modèle

2. **Détection de pose** (MoveNet Lite)
   - 17-33 keypoints 2D du rider
   - Inférence via ONNX Runtime Web

3. **Estimation board** (traqueur ou modèle KP)
   - 4 keypoints: nose, tail, truck L/R
   - Calcul d'angle (roll/pitch/yaw)

4. **Extraction de features temporelles**
   - Fenêtre glissante 1.5-2.5s
   - Normalisation: distances, angles, vélocités, vecteurs board

5. **Classification de tricks** (TCN)
   - Réseau temporel léger
   - Sortie: `label + confidence`

6. **Arbitrage IA**
   - Machine d'états: SET → ATTEMPT → LAND → VALID/FAIL
   - Règles par trick: rotation, catch, stabilité, contact pieds

## Structure des fichiers

### Frontend (TypeScript/React)

- `src/components/skate/GameOfSkateAI.tsx` - Composant principal avec overlays
- `src/components/skate/PoseOverlay.tsx` - Overlay visuel squelette + board
- `src/components/skate/TrickFeedbackPanel.tsx` - Panel de feedback post-analyse
- `src/lib/ai/videoCapture.ts` - Capture WebRTC + preprocessing
- `src/lib/ai/inference.ts` - Services d'inférence ONNX (MoveNet + TCN)
- `src/lib/ai/arbitration.ts` - Logique d'arbitrage et validation
- `src/lib/ai/storage.ts` - Persistance Supabase (sessions, keypoints, features)

### Backend (Supabase)

- `supabase/migrations/20251102120000_skate_ai_system.sql` - Schéma de données
  - `skate_ai_sessions` - Sessions d'analyse
  - `skate_ai_keypoints` - Keypoints par frame
  - `skate_ai_features` - Features temporelles (fenêtres)
  - `skate_ai_validations` - Résultats d'arbitrage
  - `skate_ai_training_clips` - Dataset d'entraînement (annotations)

### Entraînement (Python)

- `training/train_stgcn.py` - Entraînement ST-GCN (squelette complet)
- `training/train_tcn.py` - Entraînement TCN (léger, export ONNX)
- `training/README.md` - Instructions d'entraînement

## Installation

### 1. Migrations Supabase

```bash
# Appliquer la migration
supabase db push
# ou via GitHub Actions (voir docs/SUPABASE_MIGRATIONS.md)
```

### 2. Dépendances frontend

```bash
npm install onnxruntime-web
# Note: MoveNet et TCN ONNX doivent être placés dans public/models/
```

### 3. Modèles ONNX

**Pour MVP (développement)**:
- Les services d'inférence utilisent des mocks (voir `src/lib/ai/inference.ts`)

**Pour production**:
1. Télécharger MoveNet Thunder depuis TensorFlow Hub
2. Convertir en ONNX: `tf2onnx` ou `tensorflow-onnx`
3. Placer dans `public/models/movenet-lite.onnx`
4. Entraîner TCN (voir `training/train_tcn.py`) → export `public/models/trick-tcn.onnx`

### 4. Entraînement (optionnel, pour améliorer)

```bash
cd training
pip install torch torchvision numpy
python train_tcn.py  # Exporte automatiquement en ONNX
```

## Utilisation

### Activer l'arbitre IA dans un match

1. Créer un match dans le lobby
2. Dans `MatchRoomLive`, activer le toggle "Arbitre IA"
3. Sélectionner un trick
4. Cliquer sur "Démarrer l'enregistrement"
5. Exécuter le trick
6. Cliquer sur "Arrêter et analyser"
7. Voir le feedback (critères validés/échoués)

### Classes de tricks supportées (v1)

- `ollie`, `nollie`
- `shove-it`, `pop-shove-it`
- `kickflip`, `heelflip`
- `180-front`, `180-back`, `360-front`, `360-back`
- `boardslide`, `50-50`

## Règles d'arbitrage

Chaque trick a des critères spécifiques:

- **Pop**: Changement d'angle board > 20° (décollage)
- **Rotation**: Angle requis selon trick (ex. 320-420° pour kickflip)
- **Catch**: Contact pieds post-rotation (2 contacts min)
- **Stabilité**: Fenêtre stable ≥ 0.3s après landing
- **Contact pieds**: Pieds en contact avec board après rotation

Les règles sont définies dans `src/lib/ai/arbitration.ts` → `TRICK_RULES`.

## Roadmap

### MVP (actuel)
- ✅ Capture vidéo + preprocessing
- ✅ Inférence pose (mock)
- ✅ Machine d'arbitrage (heuristiques)
- ✅ UI avec overlays
- ✅ Persistance Supabase

### v2 (prochaines étapes)
- Modèles ONNX réels (MoveNet + TCN)
- KP board (modèle custom ou tracker)
- 10-12 tricks fiables

### v3 (futur)
- Modèles personnalisés par niveau
- Coaching intelligent (suggestions de corrections)
- Anti-triche renforcé (watermark, optical flow)

## Dépannage

### L'arbitre IA ne se lance pas
- Vérifier les permissions caméra
- Vérifier que les modèles ONNX sont dans `public/models/`
- Consulter la console pour erreurs

### Validation toujours en échec
- Vérifier la qualité vidéo (éclairage, stabilité)
- Vérifier que le trick correspond à la classe demandée
- Ajuster les seuils dans `TRICK_RULES` si nécessaire

### Performance lente
- Réduire la résolution vidéo (1280x720 → 640x480)
- Augmenter l'intervalle d'échantillonnage (15fps → 12fps)
- Utiliser TCN au lieu de ST-GCN (plus léger)

## Contribution

Pour améliorer les modèles:
1. Annoter des clips dans `skate_ai_training_clips`
2. Exporter les features depuis `skate_ai_features`
3. Réentraîner avec `training/train_tcn.py`
4. Tester et déployer le nouveau ONNX








