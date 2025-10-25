# Sponsor Profile Hero

Le composant `SponsorProfileHero` introduit une mise en avant B2B pour les profils partenaires. Il se situe en tête de `ProfileSection` lorsque le profil chargé possède le rôle `sponsor` (profil natif ou mode sponsor activé depuis l'app).

## Contenu affiché

- **Logo sponsor** : rendu à partir de `sponsor_branding.logo_url`. En absence de visuel, un avatar avec l'initiale de la marque est généré automatiquement.
- **Identité et message** : le nom de marque (`brand_name`) est mis en avant avec la `tagline`. Si ces champs sont vides, le composant retombe sur le display name du profil et une signature générique.
- **Palette** : deux pastilles affichent `primary_color` et `secondary_color`. Les valeurs par défaut sont indiquées lorsque les couleurs spécifiques ne sont pas renseignées.
- **CTA B2B** : bouton redirigeant vers `website_url`. À défaut d'URL, un lien mailto est proposé si un contact email existe. Sans donnée disponible, un badge informatif remplace le bouton.

## Fallbacks & résilience

| Métadonnée absente | Fallback appliqué |
| ------------------- | ----------------- |
| `logo_url` | Avatar typographique basé sur le nom de marque |
| `brand_name` | `display_name` puis `username` du profil |
| `tagline` | Message par défaut : _« Sponsoring créatif pour booster la scène skate. »_ |
| `primary_color` | Couleur orange `#FF7849` |
| `secondary_color` | Violet profond `#1E1B4B` |
| `website_url` | Mailto vers `sponsor_contact.email` si disponible, sinon puce informative |

## Utilisation

```tsx
import SponsorProfileHero from '../components/profile/sponsor/SponsorProfileHero';

<SponsorProfileHero profile={profile} />;
```

Le composant ne nécessite aucune prop supplémentaire : il lit directement les métadonnées branding/contact du profil fourni.

> 💡 Pensez à tester la bascule « mode sponsor » dans l'app : `ProfileSection` injecte automatiquement ce hero lorsque `profile.role === 'sponsor'`.
