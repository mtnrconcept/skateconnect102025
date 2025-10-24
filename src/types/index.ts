export interface SponsorContactInfo {
  email: string;
  phone?: string | null;
  contact_name?: string | null;
  language?: string | null;
  address?: string | null;
}

export interface SponsorBranding {
  brand_name: string;
  logo_url?: string | null;
  banner_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  website_url?: string | null;
  tagline?: string | null;
  social_links?: Record<string, string> | null;
}

export interface SponsorPermissions {
  canAccessAnalytics: boolean;
  canManageSpotlights: boolean;
  canManageShop: boolean;
  canManageApiKeys: boolean;
}

export type ProfileExperienceMode = 'rider' | 'sponsor';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  skill_level: string | null;
  stance: string | null;
  role: 'skater' | 'sponsor' | 'admin';
  sponsor_contact?: SponsorContactInfo | null;
  sponsor_branding?: SponsorBranding | null;
  sponsor_permissions?: SponsorPermissions | null;
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

export type SponsorOpportunityType = 'challenge' | 'event' | 'call' | 'news';

export type SponsorEditableOpportunityType = Extract<SponsorOpportunityType, 'challenge' | 'event' | 'call'>;

export interface SponsorProfileSummary {
  id: string;
  username: string;
  display_name: string | null;
  sponsor_branding?: SponsorBranding | null;
}

export interface SponsorChallengeOpportunity {
  id: string;
  sponsor_id: string;
  title: string;
  description: string;
  prize: string | null;
  value: string | null;
  location: string | null;
  cover_image_url: string | null;
  tags: string[];
  start_date: string | null;
  end_date: string | null;
  participants_count: number;
  participants_label: string;
  action_label: string;
  created_at: string;
  updated_at: string;
  sponsor?: SponsorProfileSummary | null;
}

export interface SponsorEventOpportunity {
  id: string;
  sponsor_id: string;
  title: string;
  description: string;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  event_type: string | null;
  attendees: number;
  cover_image_url: string | null;
  tags: string[];
  action_label: string;
  created_at: string;
  updated_at: string;
  sponsor?: SponsorProfileSummary | null;
}

export interface SponsorCallOpportunity {
  id: string;
  sponsor_id: string;
  title: string;
  summary: string;
  description: string;
  location: string | null;
  deadline: string | null;
  reward: string | null;
  highlight: string | null;
  cover_image_url: string | null;
  tags: string[];
  participants_label: string;
  participants_count: number;
  action_label: string;
  created_at: string;
  updated_at: string;
  sponsor?: SponsorProfileSummary | null;
}

export interface SponsorNewsItem {
  id: string;
  sponsor_id: string;
  title: string;
  summary: string;
  body: string;
  location: string | null;
  published_at: string | null;
  highlight: string | null;
  cover_image_url: string | null;
  tags: string[];
  action_label: string;
  participants_label: string;
  participants_count: number;
  created_at: string;
  updated_at: string;
  sponsor?: SponsorProfileSummary | null;
}

export type SponsorOpportunityRecord =
  | { type: 'challenge'; record: SponsorChallengeOpportunity }
  | { type: 'event'; record: SponsorEventOpportunity }
  | { type: 'call'; record: SponsorCallOpportunity }
  | { type: 'news'; record: SponsorNewsItem };

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

export interface CommunityAnalyticsSnapshot {
  id: string;
  sponsor_id: string;
  metric_date: string;
  reach: number;
  engagement_rate: number;
  activation_count: number;
  top_regions: string[];
  trending_tags: string[];
  created_at: string;
}

export interface SponsorSpotlight {
  id: string;
  sponsor_id: string;
  title: string;
  description: string | null;
  media_url: string | null;
  call_to_action: string | null;
  call_to_action_url: string | null;
  status: 'draft' | 'scheduled' | 'active' | 'completed';
  start_date: string | null;
  end_date: string | null;
  performance: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

export interface SponsorShopItem {
  id: string;
  sponsor_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  stock: number;
  is_active: boolean;
  image_url: string | null;
  metadata: Record<string, string | number> | null;
  created_at: string;
  updated_at: string;
}

export interface SponsorApiKey {
  id: string;
  sponsor_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  status: 'active' | 'revoked';
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export type Section =
  | 'map'
  | 'feed'
  | 'events'
  | 'challenges'
  | 'search'
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
