# SponsorContactPanel

Le panneau `SponsorContactPanel` affiche les informations de contact B2B pour un profil ayant le rôle `sponsor`. Il apparaît dans la colonne latérale de `ProfileSection` lorsque le profil actif expose ces métadonnées.

## Contenu et interactions

- **Coordonnées principales** : nom du contact, email, téléphone, langue et adresse sont extraits de `profile.sponsor_contact`.
- **Actions rapides** :
  - Copier l'email dans le presse-papiers.
  - Lancer la rédaction d'un email via `mailto:`.
  - Chaque interaction déclenche un évènement analytics (`trackEvent`) catégorisé `sponsor_contact`.
- **Media kits** : liste des documents à télécharger depuis `profile.sponsor_media_kits`. Chaque clic est tracké avec l'identifiant du kit et son format.
- **Fallbacks** :
  - Messages informatifs lorsque certaines données sont absentes.
  - Bandeaux de statut lors de la copie réussie/échouée.

## Champs Supabase requis

Les données sont stockées dans la table `profiles`.

| Colonne | Type | Description |
| ------- | ---- | ----------- |
| `sponsor_contact` | `jsonb` | Objet contenant les coordonnées B2B. |
| `sponsor_media_kits` | `jsonb` | Tableau d'objets décrivant les documents téléchargeables. |

### Structure de `sponsor_contact`

```json
{
  "email": "contact@marque.test",
  "phone": "+33 6 12 34 56 78",
  "contact_name": "Equipe partenariats",
  "language": "fr",
  "address": "12 rue du Spot\n75011 Paris"
}
```

### Structure de `sponsor_media_kits`

```json
[
  {
    "id": "kit-b2b-overview",
    "label": "Media kit – Présentation marque",
    "url": "https://cdn.example.com/media-kit/brand-overview.pdf",
    "format": "pdf",
    "description": "Positionnement, audiences & activations."
  },
  {
    "id": "kit-case-studies",
    "label": "Cases & résultats",
    "url": "https://cdn.example.com/media-kit/case-studies.zip",
    "format": "zip"
  }
]
```

> ℹ️ Pensez à renseigner ces champs dans les fixtures Supabase (`profiles`) ou à fournir des valeurs par défaut côté seed. Le module `src/data/sponsorExperience.ts` expose `demoSponsorContact` et `demoSponsorMediaKits` qui servent de fallback lorsque les données sont absentes.
