# SkateConnect

Plateforme communautaire pour les skateurs et les sponsors, construite avec
React, Vite, Supabase et Capacitor. Ce guide décrit toutes les étapes pour
installer le projet, configurer l'environnement, comprendre l'architecture et
préparer le déploiement web ou mobile.

## Table des matières

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration de l'environnement](#configuration-de-lenvironnement)
- [Scripts npm](#scripts-npm)
- [Architecture front-end](#architecture-front-end)
- [Architecture Supabase](#architecture-supabase)
  - [Migrations clés](#migrations-clés)
- [Guides complémentaires](#guides-complémentaires)
- [Stratégies de déploiement](#stratégies-de-déploiement)
- [Tests et qualité](#tests-et-qualité)
- [Support et ressources](#support-et-ressources)

## Prérequis

| Outil | Version recommandée | Notes |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | 18 LTS ou 20 LTS | Vite et Capacitor sont testés avec les LTS récentes. |
| npm | fourni avec Node | Utilisé pour installer les dépendances et lancer les scripts. |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | optionnel | Utile pour appliquer les migrations et gérer la base locale. |
| [Capacitor CLI](https://capacitorjs.com/docs/cli) | inclus via npm | Nécessaire pour générer les projets iOS/Android. |
| [Git](https://git-scm.com/) | Dernière version | Gestion du code source. |

Pour les builds mobiles, suivez également les prérequis listés dans
[`CAPACITOR_SETUP.md`](./CAPACITOR_SETUP.md) (Xcode, Android Studio, SDKs...).

## Installation

1. **Cloner le dépôt**
   ```bash
   git clone https://github.com/<organisation>/skateconnect.git
   cd skateconnect
   ```
2. **Installer les dépendances**
   ```bash
   npm install
   ```
3. **Configurer l'environnement** : créez un fichier `.env` à la racine en vous
   basant sur la documentation [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md).
4. **Lancer le serveur de développement**
   ```bash
   npm run dev
   ```
   Le front est disponible sur `http://localhost:5173`.

## Configuration de l'environnement

Les variables essentielles sont résumées dans [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md).
En bref :

- `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` connectent l'application au
  projet Supabase.
- `VITE_MAPBOX_TOKEN` active la carte des spots via Mapbox GL JS.
- Les jetons push sont stockés dans la table Supabase `push_tokens` lors de
  l'exécution sur mobile (voir la section "Push notification tokens" dans
  `docs/ENVIRONMENT.md`).

Redémarrez `npm run dev` après toute modification du fichier `.env`.

## Scripts npm

| Script | Description |
| --- | --- |
| `npm run dev` | Démarre le serveur Vite en mode développement avec rechargement à chaud. |
| `npm run build` | Compile l'application pour la production dans `dist/`. |
| `npm run preview` | Sert le build de production localement pour vérification. |
| `npm run lint` | Exécute ESLint sur l'ensemble du projet. |
| `npm run typecheck` | Vérifie les types TypeScript sans générer de sortie. |
| `npm run test` | Compile les tests (`npm run build:test`) puis lance la suite Node.js. |
| `npm run cap:init` | Initialise Capacitor (nécessite un bundle ID et un nom d'application). |
| `npm run cap:add:ios` / `npm run cap:add:android` | Ajoute les plateformes natives correspondantes. |
| `npm run cap:sync` | Synchronise les assets web avec les projets natifs (`npm run build` + `npx cap sync`). |
| `npm run cap:copy` | Copie uniquement les assets web vers les projets natifs existants. |
| `npm run cap:open:ios` / `npm run cap:open:android` | Ouvre l'IDE natif configuré par Capacitor. |
| `npm run android` / `npm run ios` | Pipeline complet : build web, sync puis ouverture de l'IDE cible. |

## Architecture front-end

Le front est organisé autour de React 18, Vite et TypeScript.

- **Point d'entrée** : `src/main.tsx` monte `<App />` dans la page `index.html`.
- **Composition** : `src/App.tsx` orchestre l'authentification Supabase, la
  navigation entre sections (carte, fil, défis, sponsors, etc.) et la gestion de
  l'expérience sponsor vs rider.
- **Composants** :
  - `src/components/sections/` contient les vues principales (fil d'actualité,
    carte Mapbox, événements, défis, messagerie, etc.).
  - `src/components/sponsors/` regroupe le tableau de bord sponsor et les outils
    marketing.
  - `src/components/subscription/` gère les messages d'upgrade et les restrictions
    liées aux plans.
- **Contextes** : `src/contexts/SubscriptionContext.tsx` et
  `src/contexts/SponsorContext.tsx` exposent l'état d'abonnement, les permissions
  et les données sponsor.
- **Librairies internes** :
  - `src/lib/supabase.ts` crée le client Supabase à partir des variables Vite.
  - `src/lib/notifications.ts`, `src/lib/subscription.ts`, `src/lib/capacitor.ts`
    encapsulent les intégrations push, la logique d'abonnement et la détection de
    plateforme.
- **Données de démonstration** : `src/data/` fournit des jeux de données mockés
  (spots, messages, sponsors) afin de simuler une expérience riche sans backend
  actif.
- **Styles** : `src/index.css` et Tailwind CSS (configuré via `tailwind.config.js`)
  structurent la charte graphique.

## Architecture Supabase

Le dossier [`supabase/migrations/`](./supabase/migrations/) contient le squelette
complet de la base (tables, policies RLS, fonctions et triggers). Les migrations
sont ordonnées chronologiquement pour refléter l'évolution fonctionnelle du
produit : profils, médias, gamification, notifications, sponsorisation et
système d'engagement.

### Migrations clés

| Migration | Rôle principal |
| --- | --- |
| `20251019225538_create_skateconnect_schema.sql` | Crée les entités de base (profils, spots, posts, challenges) avec RLS et indexation initiale. |
| `20251019231128_create_spot_media_table.sql` & `20251020002407_create_spot_media_engagement_tables.sql` | Introduisent les médias associés aux spots (stockage, engagement, couverture) et leurs métriques. |
| `20251020001140_create_notifications_system.sql` | Met en place les tables `push_tokens` et `notifications` ainsi que les triggers pour générer automatiquement les alertes utilisateurs. |
| `20251020025601_create_gamification_system.sql`, `20251020033100_create_add_user_xp_function.sql`, `20251020033314_fix_award_xp_triggers.sql` | Bâtissent le système de gamification (badges, XP, missions quotidiennes) avec des fonctions utilitaires pour attribuer les points. |
| `20251020043000_add_profile_extended_fields.sql` | Enrichit les profils (bio étendue, réseaux sociaux, préférences de ride) pour refléter les besoins marketing. |
| `20251020130000_add_sponsor_role_and_dashboard.sql` & `20251020133000_create_sponsor_opportunities.sql` | Ajoutent les rôles sponsor, le tableau de bord et les opportunités de partenariat afin d'alimenter l'espace sponsor du front. |

Pour plus de détails (policies, triggers, seeds de démonstration), ouvrez les
fichiers correspondants dans `supabase/migrations/`. Les scripts `seed_demo_*`
installent du contenu test (spots, profils sponsorisés, interactions sociales).

## Guides complémentaires

- [`CAPACITOR_SETUP.md`](./CAPACITOR_SETUP.md) : configuration étape par étape de
  Capacitor, des certificats iOS/Android et des builds natifs.
- [`MEDIA_SYSTEM.md`](./MEDIA_SYSTEM.md) : architecture du système média (upload,
  transcodage, génération de vignettes) et intégration avec Supabase Storage.
- [`docs/SUPABASE_MIGRATIONS.md`](./docs/SUPABASE_MIGRATIONS.md) : mode d'emploi du
  workflow GitHub Actions pour appliquer les migrations Supabase.
- [`SPOT_MEDIA_GALLERY.md`](./SPOT_MEDIA_GALLERY.md) &
  [`SPOT_MEDIA_GALLERY_FINAL.md`](./SPOT_MEDIA_GALLERY_FINAL.md) : conception de
  la galerie de spots et guidelines UX.

## Boutique connectée & Stripe Connect

SkateConnect embarque désormais une véritable boutique pour les shops et
marques partenaires :

- **Front public** : section "Boutique" permettant de parcourir l'inventaire,
  filtrer par marque et déclencher un checkout Stripe sécurisé.
- **Back-office sponsor** : tableau de bord enrichi avec le statut Stripe,
  génération du lien d'onboarding Express et suivi des commandes (analytics,
  commissions, export API).
- **Supabase Edge Functions** :
  - `shop-checkout` crée les sessions Stripe Checkout et pré-enregistre les
    commandes.
  - `shop-connect` gère la création des comptes Express et génère les liens
    d'onboarding.
  - `shop-webhook` synchronise les événements Stripe (paiements, comptes).

### Variables d'environnement essentielles

| Contexte | Variable | Description |
| --- | --- | --- |
| Vite | `VITE_STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe pour charger Stripe.js côté client. |
| Edge Function | `STRIPE_SECRET_KEY` | Clé secrète Stripe du compte plateforme. |
| Edge Function | `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe pointant vers `shop-webhook`. |
| Edge Function | `STRIPE_PLATFORM_COMMISSION_PERCENT` | Commission plateforme (ex : `10` pour 10 %). |
| Edge Function | `SHOP_ALLOWED_ORIGINS` | Origines autorisées pour `shop-checkout` (séparées par des virgules). |
| Edge Function | `SHOP_PLATFORM_URL` | URL publique de SkateConnect (utilisée dans les comptes Express). |
| Edge Function | `SHOP_STRIPE_RETURN_URL` / `SHOP_STRIPE_REFRESH_URL` | URLs de retour/rafraîchissement pour l'onboarding Express. |

Publie également le webhook Stripe vers `supabase/functions/shop-webhook` pour
mettre à jour les commandes (`checkout.session.completed`, `account.updated`,
etc.).

## Stratégies de déploiement

### Web (Vite + Supabase)

1. Construire l'application : `npm run build`.
2. Déployer le contenu de `dist/` sur Vercel, Netlify ou tout hébergeur statique.
3. Configurer les variables d'environnement (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_MAPBOX_TOKEN`) dans la plateforme de déploiement.
4. Provisionner Supabase : appliquer les migrations via `supabase db push` ou
   `supabase db reset` en pointant vers votre instance distante.

### Mobile (Capacitor)

1. Suivre le guide [`CAPACITOR_SETUP.md`](./CAPACITOR_SETUP.md) pour préparer les
   plateformes.
2. Lancer `npm run cap:sync` après chaque `npm run build` pour mettre à jour les
   assets natifs.
3. Configurer les clés push (Firebase/APNs) et les stocker côté plateforme. Les
   tokens seront gérés côté Supabase (`push_tokens`).
4. Utiliser Xcode ou Android Studio pour générer les builds et soumissions aux
   stores.

### Supabase & stockage média

- Les buckets sont créés par `20251020000251_create_storage_buckets_and_policies.sql`
  avec des policies adaptées à l'upload de médias.
- Référez-vous à [`MEDIA_SYSTEM.md`](./MEDIA_SYSTEM.md) pour comprendre le flux de
  traitement et les automatisations (webhooks, thumbnails, etc.).

## Tests et qualité

- `npm run lint` pour vérifier les règles ESLint.
- `npm run typecheck` pour garantir la cohérence TypeScript.
- `npm run test` pour exécuter la suite de tests Node.js (générés dans `dist-tests/`).

Intégrez ces commandes dans vos pipelines CI/CD afin de garantir la qualité des
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
