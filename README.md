# SkateConnect

Plateforme communautaire pour les skateurs et les sponsors, construite avec
React, Vite, Supabase et Capacitor. Ce guide dÃ©crit toutes les Ã©tapes pour
installer le projet, configurer l'environnement, comprendre l'architecture et
prÃ©parer le dÃ©ploiement web ou mobile.

## Table des matiÃ¨res

- [PrÃ©requis](#prÃ©requis)
- [Installation](#installation)
- [Configuration de l'environnement](#configuration-de-lenvironnement)
- [Scripts npm](#scripts-npm)
- [Architecture front-end](#architecture-front-end)
- [Architecture Supabase](#architecture-supabase)
  - [Migrations clÃ©s](#migrations-clÃ©s)
- [Guides complÃ©mentaires](#guides-complÃ©mentaires)
- [StratÃ©gies de dÃ©ploiement](#stratÃ©gies-de-dÃ©ploiement)
- [Tests et qualitÃ©](#tests-et-qualitÃ©)
- [Support et ressources](#support-et-ressources)

## PrÃ©requis

| Outil | Version recommandÃ©e | Notes |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | 18 LTS ou 20 LTS | Vite et Capacitor sont testÃ©s avec les LTS rÃ©centes. |
| npm | fourni avec Node | UtilisÃ© pour installer les dÃ©pendances et lancer les scripts. |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | optionnel | Utile pour appliquer les migrations et gÃ©rer la base locale. |
| [Capacitor CLI](https://capacitorjs.com/docs/cli) | inclus via npm | NÃ©cessaire pour gÃ©nÃ©rer les projets iOS/Android. |
| [Git](https://git-scm.com/) | DerniÃ¨re version | Gestion du code source. |

Pour les builds mobiles, suivez Ã©galement les prÃ©requis listÃ©s dans
[`CAPACITOR_SETUP.md`](./CAPACITOR_SETUP.md) (Xcode, Android Studio, SDKs...).

## Installation

1. **Cloner le dÃ©pÃ´t**
   ```bash
   git clone https://github.com/<organisation>/skateconnect.git
   cd skateconnect
   ```
2. **Installer les dÃ©pendances**
   ```bash
   npm install
   ```
3. **Configurer l'environnement** : crÃ©ez un fichier `.env` Ã  la racine en vous
   basant sur la documentation [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md).
4. **Lancer le serveur de dÃ©veloppement**
   ```bash
   npm run dev
   ```
   Le front est disponible sur `http://localhost:5173`.

## Configuration de l'environnement

Les variables essentielles sont rÃ©sumÃ©es dans [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md).
En bref :

- `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` connectent l'application au
  projet Supabase.
- `VITE_MAPBOX_TOKEN` active la carte des spots via Mapbox GL JS.
- Les jetons push sont stockÃ©s dans la table Supabase `push_tokens` lors de
  l'exÃ©cution sur mobile (voir la section "Push notification tokens" dans
  `docs/ENVIRONMENT.md`).

RedÃ©marrez `npm run dev` aprÃ¨s toute modification du fichier `.env`.

## Scripts npm

| Script | Description |
| --- | --- |
| `npm run dev` | DÃ©marre le serveur Vite en mode dÃ©veloppement avec rechargement Ã  chaud. |
| `npm run build` | Compile l'application pour la production dans `dist/`. |
| `npm run preview` | Sert le build de production localement pour vÃ©rification. |
| `npm run lint` | ExÃ©cute ESLint sur l'ensemble du projet. |
| `npm run typecheck` | VÃ©rifie les types TypeScript sans gÃ©nÃ©rer de sortie. |
| `npm run test` | Compile les tests (`npm run build:test`) puis lance la suite Node.js. |
| `npm run cap:init` | Initialise Capacitor (nÃ©cessite un bundle ID et un nom d'application). |
| `npm run cap:add:ios` / `npm run cap:add:android` | Ajoute les plateformes natives correspondantes. |
| `npm run cap:sync` | Synchronise les assets web avec les projets natifs (`npm run build` + `npx cap sync`). |
| `npm run cap:copy` | Copie uniquement les assets web vers les projets natifs existants. |
| `npm run cap:open:ios` / `npm run cap:open:android` | Ouvre l'IDE natif configurÃ© par Capacitor. |
| `npm run android` / `npm run ios` | Pipeline complet : build web, sync puis ouverture de l'IDE cible. |

## Architecture front-end

Le front est organisÃ© autour de React 18, Vite et TypeScript.

- **Point d'entrÃ©e** : `src/main.tsx` monte `<App />` dans la page `index.html`.
- **Composition** : `src/App.tsx` orchestre l'authentification Supabase, la
  navigation entre sections (carte, fil, dÃ©fis, sponsors, etc.) et la gestion de
  l'expÃ©rience sponsor vs rider.
- **Composants** :
  - `src/components/sections/` contient les vues principales (fil d'actualitÃ©,
    carte Mapbox, Ã©vÃ©nements, dÃ©fis, messagerie, etc.).
  - `src/components/sponsors/` regroupe le tableau de bord sponsor et les outils
    marketing.
  - `src/components/subscription/` gÃ¨re les messages d'upgrade et les restrictions
    liÃ©es aux plans.
- **Contextes** : `src/contexts/SubscriptionContext.tsx` et
  `src/contexts/SponsorContext.tsx` exposent l'Ã©tat d'abonnement, les permissions
  et les donnÃ©es sponsor.
- **Librairies internes** :
  - `src/lib/supabase.ts` crÃ©e le client Supabase Ã  partir des variables Vite.
  - `src/lib/notifications.ts`, `src/lib/subscription.ts`, `src/lib/capacitor.ts`
    encapsulent les intÃ©grations push, la logique d'abonnement et la dÃ©tection de
    plateforme.
- **DonnÃ©es de dÃ©monstration** : `src/data/` fournit des jeux de donnÃ©es mockÃ©s
  (spots, messages, sponsors) afin de simuler une expÃ©rience riche sans backend
  actif.
- **Styles** : `src/index.css` et Tailwind CSS (configurÃ© via `tailwind.config.js`)
  structurent la charte graphique.

## Architecture Supabase

Le dossier [`supabase/migrations/`](./supabase/migrations/) contient le squelette
complet de la base (tables, policies RLS, fonctions et triggers). Les migrations
sont ordonnÃ©es chronologiquement pour reflÃ©ter l'Ã©volution fonctionnelle du
produit : profils, mÃ©dias, gamification, notifications, sponsorisation et
systÃ¨me d'engagement.

### Migrations clÃ©s

| Migration | RÃ´le principal |
| --- | --- |
| `20251019225538_create_skateconnect_schema.sql` | CrÃ©e les entitÃ©s de base (profils, spots, posts, challenges) avec RLS et indexation initiale. |
| `20251019231128_create_spot_media_table.sql` & `20251020002407_create_spot_media_engagement_tables.sql` | Introduisent les mÃ©dias associÃ©s aux spots (stockage, engagement, couverture) et leurs mÃ©triques. |
| `20251020001140_create_notifications_system.sql` | Met en place les tables `push_tokens` et `notifications` ainsi que les triggers pour gÃ©nÃ©rer automatiquement les alertes utilisateurs. |
| `20251020025601_create_gamification_system.sql`, `20251020033100_create_add_user_xp_function.sql`, `20251020033314_fix_award_xp_triggers.sql` | BÃ¢tissent le systÃ¨me de gamification (badges, XP, missions quotidiennes) avec des fonctions utilitaires pour attribuer les points. |
| `20251020043000_add_profile_extended_fields.sql` | Enrichit les profils (bio Ã©tendue, rÃ©seaux sociaux, prÃ©fÃ©rences de ride) pour reflÃ©ter les besoins marketing. |
| `20251020130000_add_sponsor_role_and_dashboard.sql` & `20251020133000_create_sponsor_opportunities.sql` | Ajoutent les rÃ´les sponsor, le tableau de bord et les opportunitÃ©s de partenariat afin d'alimenter l'espace sponsor du front. |

Pour plus de dÃ©tails (policies, triggers, seeds de dÃ©monstration), ouvrez les
fichiers correspondants dans `supabase/migrations/`. Les scripts `seed_demo_*`
installent du contenu test (spots, profils sponsorisÃ©s, interactions sociales).

## Guides complÃ©mentaires

- [`CAPACITOR_SETUP.md`](./CAPACITOR_SETUP.md) : configuration Ã©tape par Ã©tape de
  Capacitor, des certificats iOS/Android et des builds natifs.
- [`MEDIA_SYSTEM.md`](./MEDIA_SYSTEM.md) : architecture du systÃ¨me mÃ©dia (upload,
  transcodage, gÃ©nÃ©ration de vignettes) et intÃ©gration avec Supabase Storage.
- [`docs/SUPABASE_MIGRATIONS.md`](./docs/SUPABASE_MIGRATIONS.md) : mode d'emploi du
  workflow GitHub Actions pour appliquer les migrations Supabase.
- [`SPOT_MEDIA_GALLERY.md`](./SPOT_MEDIA_GALLERY.md) &
  [`SPOT_MEDIA_GALLERY_FINAL.md`](./SPOT_MEDIA_GALLERY_FINAL.md) : conception de
  la galerie de spots et guidelines UX.

## Boutique connectÃ©e & Stripe Connect

SkateConnect embarque dÃ©sormais une vÃ©ritable boutique pour les shops et
marques partenairesÂ :

- **Front public** : section "Boutique" permettant de parcourir l'inventaire,
  filtrer par marque et dÃ©clencher un checkout Stripe sÃ©curisÃ©.
- **Back-office sponsor** : tableau de bord enrichi avec le statut Stripe,
  gÃ©nÃ©ration du lien d'onboarding Express et suivi des commandes (analytics,
  commissions, export API).
- **Supabase Edge Functions** :
  - `shop-checkout` crÃ©e les sessions Stripe Checkout et prÃ©-enregistre les
    commandes.
  - `shop-connect` gÃ¨re la crÃ©ation des comptes Express et gÃ©nÃ¨re les liens
    d'onboarding.
  - `shop-webhook` synchronise les Ã©vÃ©nements Stripe (paiements, comptes).

### Variables d'environnement essentielles

| Contexte | Variable | Description |
| --- | --- | --- |
| Vite | `VITE_STRIPE_PUBLISHABLE_KEY` | ClÃ© publique Stripe pour charger Stripe.js cÃ´tÃ© client. |
| Edge Function | `STRIPE_SECRET_KEY` | ClÃ© secrÃ¨te Stripe du compte plateforme. |
| Edge Function | `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe pointant vers `shop-webhook`. |
| Edge Function | `STRIPE_PLATFORM_COMMISSION_PERCENT` | Commission plateforme (exÂ : `10` pour 10Â %). |
| Edge Function | `SHOP_ALLOWED_ORIGINS` | Origines autorisÃ©es pour `shop-checkout` (sÃ©parÃ©es par des virgules). |
| Edge Function | `SHOP_PLATFORM_URL` | URL publique de SkateConnect (utilisÃ©e dans les comptes Express). |
| Edge Function | `SHOP_STRIPE_RETURN_URL` / `SHOP_STRIPE_REFRESH_URL` | URLs de retour/rafraÃ®chissement pour l'onboarding Express. |

Publie Ã©galement le webhook Stripe vers `supabase/functions/shop-webhook` pour
mettre Ã  jour les commandes (`checkout.session.completed`, `account.updated`,
etc.).

## StratÃ©gies de dÃ©ploiement

### Web (Vite + Supabase)

1. Construire l'application : `npm run build`.
2. DÃ©ployer le contenu de `dist/` sur Vercel, Netlify ou tout hÃ©bergeur statique.
3. Configurer les variables d'environnement (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_MAPBOX_TOKEN`) dans la plateforme de dÃ©ploiement.
4. Provisionner Supabase : appliquer les migrations via `supabase db push` ou
   `supabase db reset` en pointant vers votre instance distante.

### Mobile (Capacitor)

1. Suivre le guide [`CAPACITOR_SETUP.md`](./CAPACITOR_SETUP.md) pour prÃ©parer les
   plateformes.
2. Lancer `npm run cap:sync` aprÃ¨s chaque `npm run build` pour mettre Ã  jour les
   assets natifs.
3. Configurer les clÃ©s push (Firebase/APNs) et les stocker cÃ´tÃ© plateforme. Les
   tokens seront gÃ©rÃ©s cÃ´tÃ© Supabase (`push_tokens`).
4. Utiliser Xcode ou Android Studio pour gÃ©nÃ©rer les builds et soumissions aux
   stores.

### Supabase & stockage mÃ©dia

- Les buckets sont crÃ©Ã©s par `20251020000251_create_storage_buckets_and_policies.sql`
  avec des policies adaptÃ©es Ã  l'upload de mÃ©dias.
- RÃ©fÃ©rez-vous Ã  [`MEDIA_SYSTEM.md`](./MEDIA_SYSTEM.md) pour comprendre le flux de
  traitement et les automatisations (webhooks, thumbnails, etc.).

## Tests et qualitÃ©

- `npm run lint` pour vÃ©rifier les rÃ¨gles ESLint.
- `npm run typecheck` pour garantir la cohÃ©rence TypeScript.
- `npm run test` pour exÃ©cuter la suite de tests Node.js (gÃ©nÃ©rÃ©s dans `dist-tests/`).

IntÃ©grez ces commandes dans vos pipelines CI/CD afin de garantir la qualitÃ© des
livraisons.

## Support et ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Documentation Capacitor](https://capacitorjs.com/docs)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/guides/)
- Pour toute question interne, reportez-vous aux documents de suivi :
  [`IMPLEMENTATION_PROGRESS.md`](./IMPLEMENTATION_PROGRESS.md) et
  [`PROJECT_STATUS.md`](./PROJECT_STATUS.md).

Bon ride et bon code !
# shred2

## Game of S.K.A.T.E (aperçu)

- UI: onglet « Game of S.K.A.T.E » ajouté dans la page « Défis ». 
- Migrations SQL: supabase/migrations/20251101170000_skate_game.sql (types, tables, index, RLS minimales).
- Edge Functions (stubs):
  - `supabase/functions/skate-matches-create`
  - `supabase/functions/skate-matches-start`
  - `supabase/functions/skate-turns-create`
  - `supabase/functions/skate-turns-respond`
  - `supabase/functions/skate-turns-validate`
  - `supabase/functions/skate-turns-dispute`
  - `supabase/functions/skate-matches-resolve`
  - `supabase/functions/skate-leaderboards`

Notes:
- Helpers client: `src/lib/skate.ts` (fallback local si schéma manquant).
- Hooks utilitaires: `src/hooks/skate.ts` (compte à rebours, base realtime).
# shred2
