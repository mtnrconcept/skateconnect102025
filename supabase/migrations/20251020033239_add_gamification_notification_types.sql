/*
  # Add Gamification Notification Types

  Add 'achievement', 'level_up', 'challenge' to allowed notification types
*/

-- Drop existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with gamification types
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'like'::text,
  'comment'::text,
  'follow'::text,
  'mention'::text,
  'message'::text,
  'spot_comment'::text,
  'challenge_vote'::text,
  'achievement'::text,
  'level_up'::text,
  'challenge'::text
]));