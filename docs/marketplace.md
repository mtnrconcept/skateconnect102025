```markdown
shredloc-marketplace-plan.md
PLAN D’IMPLÉMENTATION — MARKETPLACE SHREDLOC
PHASE 1 — Fondation technique & architecture
Objectif : poser la structure solide (base de données, authentification, design system, routage).
🧩 Étapes :
Initialisation du projet
Monorepo / structure apps/web + supabase + edge-functions
Configuration Vite / Tailwind / Zustand / Supabase client
Mise en place des routes principales (/, /login, /signup, /listing/:id, /new)
Modélisation des données (DB Supabase)
Tables : users, shops, listings, orders, offers, messages, reviews, payments
Clés étrangères, triggers, policies RLS, enums (status, roles, shipping_mode…)
Authentification & profils
Email + mot de passe + SMS OTP
Profils utilisateurs : riders / shops
Onboarding initial après inscription
Vérification e-mail et téléphone
Design System
Création du thème ShredLoc (palette, typos, composants UI)
Boutons, inputs, modales, toasts, navigation bar, footer
Templates “Form Wizard”, “Card Produit”, “Stepper”, “Tabs”
PHASE 2 — Publication d’annonce (vendeur)
Objectif : permettre aux utilisateurs de créer et publier des annonces.
🧩 Étapes :
Page “Déposer une annonce”
Wizard multi-étapes :
Catégorie / sous-catégorie
Détails produit
Prix & négociation
Livraison & options
Médias & publication
Champs et logique
Validation dynamique (prix > 0, texte FR, poids max…)
Upload direct Supabase Storage (photos, vidéo)
Preview live (cover + tri des images)
Sélecteur de point relais (API Mondial Relay / Boxtal)
Publication & modération
Statut draft → pending → active
Filtre anti-spam / langage / nudité
Interface admin (modération manuelle)
Page “Mon profil / Mes annonces”
Gestion du statut (actif, vendu, supprimé)
Édition / duplication / suppression
PHASE 3 — Navigation, recherche & découverte
Objectif : permettre aux utilisateurs de naviguer, filtrer et trouver des produits.
🧩 Étapes :
Moteur de recherche
Index texte (Postgres tsvector) ou intégration Algolia
Recherche par mots-clés, catégories, localisation, prix min/max
Tri par pertinence, date, prix
Filtres dynamiques
Champs spécifiques selon catégorie (ex : deck size, marque, état)
Filtres “Livraison possible”, “Pro uniquement”, “Paiement sécurisé”
Page de résultats
Grille d’annonces avec images, prix, localisation, badges
Pagination infinie ou lazy-loading
Page d’accueil
Sections : “Près de toi”, “Annonces tendances”, “Dernières ventes”, “Shops”
Barre de recherche globale persistante
Favoris & alertes
Sauvegarde d’annonces
Création d’alertes par recherche (push/email)
PHASE 4 — Fiche produit & messagerie
Objectif : interaction entre acheteurs et vendeurs + négociation d’offres.
🧩 Étapes :
Page annonce complète
Galerie photos + vidéo
Informations produit, vendeur, localisation (Mapbox)
CTA : Acheter / Faire une offre / Contacter / Ajouter aux favoris
Messagerie intégrée
Threads par annonce
Envoi de messages + images
Notification push temps réel (Supabase Realtime)
Offres et contre-offres
Création d’offre avec montant
Acceptation / rejet / contre-proposition
Historique des offres
Système de signalement
Bouton “Signaler l’annonce / utilisateur”
Création d’entrée dans moderation table
PHASE 5 — Paiement sécurisé & livraison
Objectif : permettre le paiement via escrow et la gestion des expéditions.
🧩 Étapes :
Intégration Stripe Connect
Création de compte vendeur (Standard)
Génération d’intent de paiement (escrow)
Gestion des commissions plateforme
Checkout
Sélection mode livraison (relais / domicile / pickup)
Saisie adresse / point relais
Récapitulatif + paiement
Flux transactionnel
order.created → paid → seller_confirmed → shipped → delivered → released
Génération d’étiquette transport (API Boxtal/Sendcloud)
Tracking + notifications push
Payout automatique
Libération des fonds après confirmation réception
Gestion litiges / remboursements
Page “Mes ventes / Mes achats”
Statuts des commandes
Téléchargement étiquettes
Suivi colis
Confirmation réception
PHASE 6 — Post-vente & réputation
Objectif : instaurer confiance et boucle de satisfaction utilisateur.
🧩 Étapes :
Système d’avis
Acheteur → note vendeur
Commentaire texte + photos
Calcul score global (moyenne pondérée)
Litiges & assistance
Formulaire de litige
Médiation via support
Historique des interventions
Notifications & e-mails
Confirmation commande / envoi / réception
Alertes offre / message / litige
Templates transactionnels (Postmark/Resend)
Dashboard utilisateur
Synthèse ventes/achats, revenus, avis reçus
Graphiques de performance (pour shops)
PHASE 7 — Professionnalisation & scalabilité
Objectif : passer de marketplace communautaire à écosystème pro performant.
🧩 Étapes :
Module Shops Connectés
Import catalogue (API Shopify/Woo)
Synchronisation stock & prix
Statistiques ventes / produits les plus performants
Boosts & publicités internes
Options payantes (mise en avant, remontée)
Stripe Checkout ou abonnement “Shop Master”
Analytics plateforme
Suivi des conversions (vue → message → vente)
Tableau de bord admin avec métriques temps réel
Modération avancée
IA / ML : détection contenu suspect
Filtrage annonces interdites
Gestion des bannissements / avertissements
SEO & internationalisation
Pages statiques optimisées (Next/Vite SSR)
Balises OpenGraph / Schema.org
Localisation multilingue (FR/EN)
Sitemaps dynamiques (annonces, shops, catégories)
Scalabilité & maintenance
Caching CDN + edge functions (Supabase Edge)
Logs, analytics, monitoring
Backup & restore policies
🧭 SYNTHÈSE VISUELLE DES PHASES
| Phase | Titre | Objectif principal |
| :--- | :--- | :--- |
| 1 | Fondation technique | Auth, DB, UI core |
| 2 | Dépôt d’annonce | Création et publication |
| 3 | Recherche & navigation | Trouver et filtrer les annonces |
| 4 | Interaction | Fiche produit + messagerie + offres |
| 5 | Transaction | Paiement sécurisé + livraison |
| 6 | Post-vente | Avis, litiges, réputation |
| 7 | Scalabilité | Shops, analytics, SEO, IA |
```