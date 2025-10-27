# Guide d'application des migrations Supabase

Ce document explique comment utiliser le workflow GitHub Actions
[`.github/workflows/apply-migrations.yml`](../.github/workflows/apply-migrations.yml)
pour appliquer les migrations Supabase du projet **SkateConnect**. Il
complète les informations générales fournies dans le README et sert de
source d'instructions pour toutes les opérations de migration.

## Quand utiliser ce workflow ?

- À chaque fois qu'une migration est ajoutée ou modifiée dans
  `supabase/migrations/**`.
- Après avoir vérifié une migration localement et souhaité la déployer
  sur l'environnement partagé.
- Lorsqu'une erreur de schéma Supabase est remontée par l'application
  et que vous devez rejouer les migrations pour resynchroniser la base.

Le workflow se déclenche automatiquement sur `push` dès qu'un fichier du
répertoire `supabase/migrations/` change, et il peut également être
lancé manuellement depuis l'onglet **Actions** de GitHub via
`workflow_dispatch`.

## Pré-requis : secrets GitHub

Pour que le workflow puisse se connecter au projet Supabase, configurez
au minimum l'une des deux paires de secrets suivantes dans les
**Repository secrets** :

| Mode | Secrets requis | Description |
| --- | --- | --- |
| Connexion directe | `SUPABASE_DB_URL` | Chaîne de connexion Postgres (avec utilisateur `postgres`). |
| Authentification par token | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` *(facultatif, voir note ci-dessous)* | Jeton personnel Supabase ayant accès au projet. |

> ℹ️ Par défaut, le workflow est configuré avec le project ref
> `vlhxrovtrdhcmvvqlryd`. Si vous préférez injecter cette valeur via un
> secret, ajoutez `SUPABASE_PROJECT_REF` et modifiez l'étape `link` pour
> l'utiliser.

Les étapes facultatives de smoke test utilisent également :

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Fournissez-les si vous souhaitez valider l'API `rest/v1` après chaque
migration.

## Déroulé du workflow

1. **Checkout du dépôt** : clone le repo pour accéder aux migrations.
2. **Installation du Supabase CLI** : via `supabase/setup-cli@v1`.
3. **Application des migrations** :
   - Si `SUPABASE_DB_URL` est disponible, le workflow exécute
     `supabase migration up` directement sur l'URL fournie.
   - Sinon, si `SUPABASE_ACCESS_TOKEN` est défini, il se connecte via
     `supabase login` puis `supabase link` avant de lancer
     `supabase db push`.
4. **Notification PostgREST** : si une URL de base de données est
   accessible, une commande `NOTIFY pgrst, 'reload schema';` est envoyée
   via `psql` pour rafraîchir le cache de PostgREST.
5. **Smoke test (optionnel)** : une requête `curl` vérifie l'existence du
   champ `comment` dans `spot_ratings`. Cette étape s'exécute seulement
   si `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont définis.

Chaque étape est clairement séparée dans le fichier YAML afin de pouvoir
adapter facilement la stratégie en fonction de vos secrets disponibles.

## Lancer le workflow manuellement

1. Ouvrez l'onglet **Actions** du dépôt GitHub.
2. Sélectionnez « Apply Supabase Migrations » dans la barre latérale.
3. Cliquez sur **Run workflow** et choisissez la branche contenant les
   migrations.
4. Surveillez les logs pour vérifier que chaque étape passe avec succès.

## Bonnes pratiques

- Testez vos migrations en local avec le Supabase CLI avant de pousser.
- Fournissez systématiquement un script de rollback ou un plan de
  correction en cas d'échec.
- Documentez les changements majeurs dans un ticket ou un fichier
  `docs/` (par exemple `docs/migration_status.md`).
- Conservez les secrets à jour et révoquez les tokens inutilisés.

En suivant ce guide, toute l'équipe peut appliquer les migrations
Supabase de manière fiable via l'automatisation GitHub Actions.
