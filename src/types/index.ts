export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  skill_level: string | null;
  stance: string | null;
  location?: string | null;
  sponsors?: string[] | null;
  favorite_tricks?: string[] | null;
  achievements?: string[] | null;
  legacy_followers_count?: number | null;
  legacy_following_count?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Spot {
  id: string;
  created_by: string | null;
  name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  spot_type: 'street' | 'skatepark' | 'bowl' | 'diy' | 'transition';
  difficulty: number;
  surfaces: string[];
  modules: string[];
  is_verified: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  creator?: Profile;
  liked_by_user?: boolean;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[];
  spot_id: string | null;
  post_type: 'photo' | 'video' | 'text';
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  user?: Profile;
  spot?: Spot;
  liked_by_user?: boolean;
}

export interface Challenge {
  id: string;
  created_by: string | null;
  title: string;
  description: string;
  challenge_type: 'daily' | 'weekly' | 'brand' | 'community';
  difficulty: number;
  prize: string;
  start_date: string;
  end_date: string;
  participants_count: number;
  is_active: boolean;
  created_at: string;
  creator?: Profile;
}

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  type: 'Compétition' | 'Contest' | 'Rencontre' | 'Avant-première' | 'Appel à projet' | 'Appel à sponsor';
  attendees: number;
  is_sponsor_event?: boolean;
  sponsor_name?: string;
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export interface Like {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface SpotRating {
  id: string;
  user_id: string;
  spot_id: string;
  rating: number;
  created_at: string;
}

export interface SpotMedia {
  id: string;
  spot_id: string;
  user_id: string;
  media_url: string;
  media_type: 'photo' | 'video';
  caption: string;
  is_cover_photo: boolean;
  likes_count: number;
  views_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  user?: Profile;
  user_liked?: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  sender_id: string | null;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'challenge' | 'message';
  content: string;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
  sender?: Profile;
}

export interface Conversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at: string;
  created_at: string;
  participant_1?: Profile;
  participant_2?: Profile;
  last_message?: Message;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url: string;
  is_read: boolean;
  created_at: string;
  sender?: Profile;
}

export interface ChallengeSubmission {
  id: string;
  challenge_id: string;
  user_id: string;
  media_url: string;
  media_type: 'photo' | 'video';
  caption: string;
  votes_count: number;
  is_winner: boolean;
  created_at: string;
  user?: Profile;
  challenge?: Challenge;
  voted_by_user?: boolean;
}

export interface ChallengeVote {
  id: string;
  submission_id: string;
  user_id: string;
  created_at: string;
}

export interface SpotLike {
  id: string;
  spot_id: string;
  user_id: string;
  created_at: string;
}

export interface SpotComment {
  id: string;
  spot_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export interface ContentNavigationOptions {
  scrollToId?: string;
  challengeTab?: 'community' | 'daily';
  spotId?: string;
}

export interface SpotMediaComment {
  id: string;
  media_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export interface UserXP {
  user_id: string;
  total_xp: number;
  current_level: number;
  xp_to_next_level: number;
  level_title: string;
  updated_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement: Record<string, any>;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  is_displayed: boolean;
  badge?: Badge;
}

export interface XPTransaction {
  id: string;
  user_id: string;
  amount: number;
  action_type: string;
  reference_id: string | null;
  created_at: string;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  type: 'physical' | 'digital' | 'discount';
  cost_xp: number;
  stock: number;
  partner: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UserReward {
  id: string;
  user_id: string;
  reward_id: string;
  claimed_at: string;
  status: 'pending' | 'shipped' | 'delivered';
  redemption_code: string | null;
  reward?: Reward;
}

export interface LeaderboardEntry {
  user_id: string;
  total_xp: number;
  current_level: number;
  level_title: string;
  rank: number;
  profile?: Profile;
}

export type Section =
  | 'map'
  | 'feed'
  | 'events'
  | 'challenges'
  | 'sponsors'
  | 'pricing'
  | 'profile'
  | 'messages'
  | 'notifications'
  | 'rewards'
  | 'leaderboard'
  | 'badges'
  | 'settings'
  | 'privacy'
  | 'terms';
