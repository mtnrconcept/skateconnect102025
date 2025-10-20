/*
  # Create Gamification System

  1. New Tables
    - `user_xp` - Track user experience points and levels
    - `badges` - Available badges in the system
    - `user_badges` - Badges earned by users
    - `xp_transactions` - Log of XP earned
    - `rewards` - Available rewards in the store
    - `user_rewards` - Rewards claimed by users

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create user_xp table
CREATE TABLE IF NOT EXISTS user_xp (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_xp integer DEFAULT 0,
  current_level integer DEFAULT 1,
  xp_to_next_level integer DEFAULT 100,
  level_title text DEFAULT 'New Rider',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all XP"
  ON user_xp FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own XP"
  ON user_xp FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create badges table
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  category text NOT NULL,
  requirement jsonb DEFAULT '{}'::jsonb,
  rarity text DEFAULT 'common',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badges"
  ON badges FOR SELECT
  TO authenticated
  USING (true);

-- Create user_badges table
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  is_displayed boolean DEFAULT true,
  UNIQUE(user_id, badge_id)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all user badges"
  ON user_badges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own badge display"
  ON user_badges FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create xp_transactions table
CREATE TABLE IF NOT EXISTS xp_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  action_type text NOT NULL,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own XP transactions"
  ON xp_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create rewards table
CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  image_url text,
  type text NOT NULL,
  cost_xp integer NOT NULL,
  stock integer DEFAULT -1,
  partner text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active rewards"
  ON rewards FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Create user_rewards table
CREATE TABLE IF NOT EXISTS user_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  claimed_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending',
  redemption_code text
);

ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rewards"
  ON user_rewards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can claim rewards"
  ON user_rewards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_xp_level ON user_xp(current_level DESC, total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_rewards_user ON user_rewards(user_id);

-- Insert default badges
INSERT INTO badges (name, description, icon, category, rarity) VALUES
  ('Découvreur', 'Ajoutez votre premier spot', '🧭', 'spots', 'common'),
  ('Créateur', 'Publiez votre première vidéo', '🎥', 'content', 'common'),
  ('Rider du mois', 'Profil le plus actif du mois', '🔥', 'activity', 'epic'),
  ('Explorateur', 'Visitez 10 spots différents', '🌍', 'spots', 'rare'),
  ('Influenceur', 'Atteignez 1000 abonnés', '🕶️', 'social', 'legendary'),
  ('Ambassadeur', 'Invitez 10 nouveaux utilisateurs', '🤝', 'social', 'epic'),
  ('Local Legend', 'Atteignez le niveau 5', '⭐', 'progression', 'rare'),
  ('Pro Rider', 'Atteignez le niveau 10', '💎', 'progression', 'epic'),
  ('Street Icon', 'Atteignez le niveau 20', '👑', 'progression', 'legendary'),
  ('Premier pas', 'Complétez votre profil', '✨', 'onboarding', 'common'),
  ('Commentateur', 'Postez 50 commentaires', '💬', 'engagement', 'rare'),
  ('Likeur', 'Donnez 100 likes', '❤️', 'engagement', 'common'),
  ('Photographe', 'Ajoutez 20 photos de spots', '📸', 'content', 'rare'),
  ('Vidéaste', 'Publiez 10 vidéos', '🎬', 'content', 'epic'),
  ('Organisateur', 'Créez votre premier événement', '📅', 'events', 'rare')
ON CONFLICT DO NOTHING;

-- Insert sample rewards
INSERT INTO rewards (name, description, type, cost_xp, stock, partner, image_url) VALUES
  ('Sticker Pack Exclusif', 'Pack de 10 stickers SHREDLOC exclusifs', 'physical', 500, 100, 'SHREDLOC', '/rewards/stickers.jpg'),
  ('T-Shirt Premium', 'T-shirt SHREDLOC édition limitée', 'physical', 2000, 50, 'SHREDLOC', '/rewards/tshirt.jpg'),
  ('Cadre de Profil Gold', 'Cadre doré pour votre avatar', 'digital', 1000, -1, 'SHREDLOC', '/rewards/gold-frame.jpg'),
  ('Bon de réduction 20%', 'Réduction sur tout le matériel', 'discount', 1500, 200, 'SkateShop Pro', '/rewards/discount.jpg'),
  ('Deck Signature', 'Planche signature SHREDLOC', 'physical', 5000, 20, 'BoardCo', '/rewards/deck.jpg'),
  ('Badge VIP', 'Badge VIP sur votre profil', 'digital', 3000, -1, 'SHREDLOC', '/rewards/vip-badge.jpg'),
  ('Truck Set Pro', 'Set de trucks professionnels', 'physical', 4000, 30, 'TruckCo', '/rewards/trucks.jpg'),
  ('Wheels Pack', 'Pack de roues premium', 'physical', 3500, 40, 'WheelsMaster', '/rewards/wheels.jpg'),
  ('Thème Sombre Pro', 'Thème personnalisé pour l''interface', 'digital', 800, -1, 'SHREDLOC', '/rewards/theme.jpg'),
  ('Event Pass', 'Pass pour un événement exclusif', 'physical', 6000, 10, 'Skate Events', '/rewards/event-pass.jpg')
ON CONFLICT DO NOTHING;