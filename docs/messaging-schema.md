# Messagerie privée : schéma des tables

La messagerie en temps réel repose sur deux tables principales, créées dans la migration
[`20251019235000_add_storage_notifications_messages.sql`](../supabase/migrations/20251019235000_add_storage_notifications_messages.sql).

## `conversations`

| Colonne              | Type    | Détails |
|----------------------|---------|---------|
| `id`                 | `uuid`  | Identifiant unique, généré automatiquement. |
| `participant_1_id`   | `uuid`  | Référence vers `profiles.id` (participant A). |
| `participant_2_id`   | `uuid`  | Référence vers `profiles.id` (participant B). |
| `last_message_at`    | `timestamptz` | Date du dernier message (mise à jour par trigger). |
| `created_at`         | `timestamptz` | Date de création de la conversation. |

Contraintes et politiques :
- Unicité du couple (`participant_1_id`, `participant_2_id`).
- Vérification `participant_1_id != participant_2_id`.
- RLS : seuls les participants peuvent sélectionner/insérer leurs conversations.

## `messages`

| Colonne           | Type        | Détails |
|-------------------|-------------|---------|
| `id`              | `uuid`      | Identifiant unique, généré automatiquement. |
| `conversation_id` | `uuid`      | Référence vers `conversations.id`. |
| `sender_id`       | `uuid`      | Référence vers `profiles.id` (expéditeur). |
| `content`         | `text`      | Corps du message. |
| `media_url`       | `text`      | Lien vers un média optionnel. |
| `is_read`         | `boolean`   | Statut de lecture (par défaut `false`). |
| `created_at`      | `timestamptz` | Date d’envoi. |

Règles notables :
- Trigger `update_conversation_on_message` qui met à jour `last_message_at` après chaque insertion.
- RLS : seuls les participants peuvent lire/insérer ; un message n’est modifiable que par son auteur.

## Flux applicatif

1. **Création/obtention d’une conversation** : `getOrCreateConversation` vérifie l’existence d’une
   conversation entre deux profils puis l’insère si nécessaire.
2. **Insertion d’un message** : `insertMessage` ajoute la ligne dans `messages` et laisse le trigger
   propager la date dans `conversations.last_message_at`.
3. **Mise à jour de lecture** : `markConversationMessagesAsRead` marque comme lus les messages dont
   l’expéditeur est différent de l’utilisateur courant.
4. **File d’attente** : les événements `shredloc:direct-message` sont traités par `processQueuedDirectMessages`
   (cf. `App.tsx`), ce qui garantit l’envoi via Supabase avant de vider la queue locale.
