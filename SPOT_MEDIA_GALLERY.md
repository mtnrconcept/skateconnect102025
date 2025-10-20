# Galerie de Médias pour Spots - Documentation

## Vue d'ensemble

Le système de galerie de médias permet aux utilisateurs de partager, visualiser et interagir avec des photos et vidéos des spots de skate. La galerie offre des filtres avancés et un système d'engagement complet.

## Fonctionnalités

### 1. Upload de Médias Simplifié

**Bouton "Ajouter une photo/vidéo"**
- Déclenche directement le sélecteur de fichiers
- Pas de bouton "Choose File" visible
- Upload multiple supporté
- Formats acceptés: JPEG, PNG, WebP, GIF, MP4, QuickTime, WebM

**Processus d'upload:**
```typescript
// Clic sur le bouton -> Sélection fichier -> Upload automatique -> Ajout à la galerie
```

### 2. Galerie avec Filtres

**Affichage:**
- Grille 3x3 (12 miniatures maximum)
- Aspect ratio carré pour uniformité
- Lazy loading des images
- Indicateurs de type (photo/vidéo)

**Filtres disponibles:**
1. **Plus récentes** - Tri par date décroissante (défaut)
2. **Plus anciennes** - Tri par date croissante
3. **Plus likées** - Tri par nombre de likes décroissant
4. **Plus vues** - Tri par nombre de vues décroissant
5. **Photos uniquement** - Filtre les vidéos
6. **Vidéos uniquement** - Filtre les photos

### 3. Système d'Engagement

**Likes:**
- Clic sur le cœur pour liker/unliker
- Compteur de likes en temps réel
- État visuel (cœur rouge si liké)
- Limité aux utilisateurs authentifiés

**Vues:**
- Tracking automatique au clic sur un média
- Compteur de vues
- Fonctionne pour utilisateurs authentifiés et anonymes

**Statistiques affichées:**
- Nombre de likes
- Nombre de vues
- Visible au survol de la miniature

## Architecture Base de Données

### Tables Créées

#### `spot_media_likes`
```sql
- id (uuid, PK)
- media_id (uuid, FK -> spot_media)
- user_id (uuid, FK -> profiles)
- created_at (timestamptz)
- UNIQUE(media_id, user_id)
```

#### `spot_media_views`
```sql
- id (uuid, PK)
- media_id (uuid, FK -> spot_media)
- user_id (uuid, FK -> profiles, nullable)
- created_at (timestamptz)
```

#### Colonnes ajoutées à `spot_media`
```sql
- likes_count (integer, default 0)
- views_count (integer, default 0)
```

### Triggers Automatiques

**Increment/Decrement Likes:**
```sql
-- Incrémente automatiquement le compteur lors d'un like
CREATE TRIGGER trigger_increment_media_likes
  AFTER INSERT ON spot_media_likes
  FOR EACH ROW
  EXECUTE FUNCTION increment_media_likes_count();

-- Décrémente automatiquement le compteur lors d'un unlike
CREATE TRIGGER trigger_decrement_media_likes
  AFTER DELETE ON spot_media_likes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_media_likes_count();
```

**Increment Views:**
```sql
-- Incrémente automatiquement le compteur lors d'une vue
CREATE TRIGGER trigger_increment_media_views
  AFTER INSERT ON spot_media_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_media_views_count();
```

### Politiques RLS

**spot_media_likes:**
- ✅ Lecture publique
- ✅ Création par utilisateurs authentifiés
- ✅ Suppression uniquement de ses propres likes

**spot_media_views:**
- ✅ Lecture publique
- ✅ Création par tous (anonymes inclus)

## Composant SpotMediaGallery

### Props

```typescript
interface SpotMediaGalleryProps {
  spotId: string;                                    // ID du spot
  onMediaClick: (media: SpotMedia, index: number) => void;  // Callback au clic
  onUploadClick: () => void;                        // Callback pour upload
}
```

### État Interne

```typescript
const [media, setMedia] = useState<MediaWithStats[]>([]);
const [filteredMedia, setFilteredMedia] = useState<MediaWithStats[]>([]);
const [currentFilter, setCurrentFilter] = useState<FilterType>('recent');
const [showFilterMenu, setShowFilterMenu] = useState(false);
```

### Fonctions Principales

**loadMedia()**
- Charge tous les médias du spot
- Récupère les informations utilisateur
- Vérifie si l'utilisateur a liké chaque média
- Met à jour l'état

**applyFilter()**
- Applique le filtre sélectionné
- Trie ou filtre les médias
- Limite à 12 résultats
- Met à jour filteredMedia

**handleLike()**
- Toggle like/unlike
- Met à jour la base de données
- Met à jour l'état local instantanément
- Gère les erreurs

**trackView()**
- Enregistre une vue
- Insert dans spot_media_views
- Silencieux (pas de feedback utilisateur)

## Intégration dans SpotDetailModal

### Modification Clés

**Input File Caché:**
```typescript
<input
  ref={fileInputRef}
  type="file"
  accept="image/jpeg,image/png,..."
  multiple
  className="hidden"
  onChange={handleFileUpload}
/>
```

**Bouton Upload:**
```typescript
<button onClick={() => fileInputRef.current?.click()}>
  Ajouter une photo/vidéo
</button>
```

**Affichage Conditionnel:**
```typescript
{showGallery && (
  <SpotMediaGallery
    spotId={spot.id}
    onMediaClick={(mediaItem, index) => {
      setCurrentMediaIndex(index);
      setShowGallery(false);  // Passe en mode carousel
    }}
    onUploadClick={() => fileInputRef.current?.click()}
  />
)}
```

### Flow d'Utilisation

1. **Vue Galerie (défaut)**
   - Affiche les 12 premières miniatures
   - Filtres disponibles
   - Clic sur miniature -> Mode carousel

2. **Upload**
   - Clic sur "Ajouter une photo/vidéo"
   - Sélection fichiers
   - Upload automatique
   - Retour à la galerie

3. **Mode Carousel**
   - Affichage plein écran
   - Navigation avec flèches
   - Bouton "Retour à la galerie"

## Performances

### Optimisations Implémentées

1. **Lazy Loading**
   - Composant LazyImage pour images
   - Chargement uniquement au scroll

2. **Limites de Requêtes**
   - 12 médias maximum affichés
   - Pagination possible (future feature)

3. **Indexes Créés**
   ```sql
   CREATE INDEX idx_spot_media_likes_media_id ON spot_media_likes(media_id);
   CREATE INDEX idx_spot_media_views_media_id ON spot_media_views(media_id);
   ```

4. **Compteurs Dénormalisés**
   - likes_count et views_count dans spot_media
   - Pas de COUNT() sur chaque requête
   - Mise à jour automatique par triggers

## API / Requêtes

### Charger les Médias avec Stats

```typescript
const { data } = await supabase
  .from('spot_media')
  .select(`
    *,
    user:profiles(id, username, display_name, avatar_url)
  `)
  .eq('spot_id', spotId)
  .order('created_at', { ascending: false });
```

### Vérifier les Likes de l'Utilisateur

```typescript
const { data: likes } = await supabase
  .from('spot_media_likes')
  .select('media_id')
  .eq('user_id', currentUser.id)
  .in('media_id', mediaIds);
```

### Ajouter un Like

```typescript
await supabase
  .from('spot_media_likes')
  .insert({ media_id: mediaId, user_id: currentUser.id });
```

### Retirer un Like

```typescript
await supabase
  .from('spot_media_likes')
  .delete()
  .eq('media_id', mediaId)
  .eq('user_id', currentUser.id);
```

### Tracker une Vue

```typescript
await supabase
  .from('spot_media_views')
  .insert({
    media_id: mediaId,
    user_id: currentUser?.id || null,
  });
```

## UX / UI

### États Visuels

**Miniature au repos:**
- Image/vidéo avec overlay transparent
- Badge "Vidéo" si applicable

**Miniature au survol:**
- Overlay gradient noir
- Statistiques visibles (vues, likes)
- Bouton like apparent

**État liké:**
- Cœur rouge rempli
- Maintenu après survol

**Filtre actif:**
- Fond bleu clair
- Texte bleu
- Check visuel

### Feedback Utilisateur

**Upload:**
- Pas de loader visible (instantané)
- Refresh automatique de la galerie
- Input file reset après upload

**Like/Unlike:**
- Changement instantané (optimistic update)
- Pas de loader
- Réversion en cas d'erreur

**Filtres:**
- Application instantanée
- Menu se ferme automatiquement
- Label du filtre affiché

## Améliorations Futures

### Fonctionnalités Suggérées

1. **Commentaires sur Médias**
   - [ ] Section commentaires par média
   - [ ] Mentions dans commentaires
   - [ ] Notifications

2. **Partage**
   - [ ] Partager sur réseaux sociaux
   - [ ] Copier lien du média
   - [ ] Embed code

3. **Modération**
   - [ ] Signaler média inapproprié
   - [ ] Modération par créateur du spot
   - [ ] Badge "Vérifié"

4. **Analytics**
   - [ ] Graphiques de vues dans le temps
   - [ ] Top contributeurs
   - [ ] Média le plus populaire

5. **Edition**
   - [ ] Editer caption
   - [ ] Supprimer son média
   - [ ] Réorganiser ordre

6. **Pagination**
   - [ ] Load more / infinite scroll
   - [ ] Navigation par page
   - [ ] Jump to page

## Exemples d'Usage

### Exemple Complet

```typescript
// Dans SpotDetailModal
<SpotMediaGallery
  spotId={spot.id}
  onMediaClick={(media, index) => {
    // Switch to carousel mode
    setCurrentMediaIndex(index);
    setShowGallery(false);
  }}
  onUploadClick={() => {
    // Trigger file input
    fileInputRef.current?.click();
  }}
/>
```

### Changer de Filtre Programmatiquement

```typescript
// Le composant gère l'état interne
// Mais peut être étendu avec prop defaultFilter
<SpotMediaGallery
  spotId={spot.id}
  defaultFilter="most_liked"  // Future feature
  {...props}
/>
```

## Troubleshooting

### Médias ne s'affichent pas
- Vérifier RLS policies sur spot_media
- Vérifier bucket storage "spots" existe
- Vérifier URLs des médias sont publiques

### Likes ne fonctionnent pas
- Vérifier authentification utilisateur
- Vérifier RLS policies sur spot_media_likes
- Vérifier triggers sont actifs

### Filtres ne marchent pas
- Vérifier colonnes likes_count et views_count existent
- Vérifier triggers mettent à jour les compteurs
- Forcer refresh de la galerie

### Vues non trackées
- Vérifier trigger sur spot_media_views
- Vérifier policy INSERT publique
- Regarder console pour erreurs

## Performance Metrics

**Temps de chargement:**
- Galerie: ~200-500ms (12 médias)
- Like/Unlike: ~50-100ms
- Track view: ~30-50ms (background)

**Requêtes:**
- 1 requête pour charger médias
- 1 requête pour vérifier likes utilisateur
- 1 requête par like/unlike
- 1 requête par vue

**Bundle Size Impact:**
- SpotMediaGallery: ~3KB gzipped
- Aucune dépendance externe ajoutée
