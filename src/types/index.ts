export interface SponsorContactInfo {
  email: string;
  phone?: string | null;
  contact_name?: string | null;
  language?: string | null;
  address?: string | null;
}

export interface SponsorMediaKitResource {
  id: string;
  label: string;
  url: string;
  format?: string | null;
  description?: string | null;
}

export type SponsorTemplateType = 'challenge' | 'event' | 'call';

export interface SponsorTemplateAsset {
  id: string;
  label: string;
  url: string;
  type: 'image' | 'video' | 'file';
  path?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SponsorTemplate {
  id: string;
  sponsor_id: string | null;
  name: string;
  type: SponsorTemplateType;
  default_fields: Record<string, unknown>;
  assets: SponsorTemplateAsset[];
  share_key: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
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
  canManageOpportunities: boolean;
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
  sponsor_media_kits?: SponsorMediaKitResource[] | null;
  location?: string | null;
  sponsors?: string[] | null;
  favorite_tricks?: string[] | null;
  achievements?: string[] | null;
  legacy_followers_count?: number | null;
  legacy_following_count?: number | null;
  stripe_account_id?: string | null;
  stripe_account_ready?: boolean;
  stripe_onboarded_at?: string | null;
  default_commission_rate?: number | null;
  payout_email?: string | null;
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
  rating_average?: number | null;
  rating_count?: number | null;
  rating_distribution?: RatingDistribution | Record<string, number> | null;
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

export type SponsorPlannerStatus =
  | 'idea'
  | 'briefing'
  | 'production'
  | 'promotion'
  | 'live'
  | 'archived';

export interface SponsorOpportunityOwnerSummary {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
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
  status: SponsorPlannerStatus;
  owner_id: string | null;
  owner?: SponsorOpportunityOwnerSummary | null;
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
  status: SponsorPlannerStatus;
  owner_id: string | null;
  owner?: SponsorOpportunityOwnerSummary | null;
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
  status: SponsorPlannerStatus;
  owner_id: string | null;
  owner?: SponsorOpportunityOwnerSummary | null;
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

export type RatingBucket = 1 | 2 | 3 | 4 | 5;

export type RatingDistribution = Record<RatingBucket, number>;

export interface SpotRating {
  id: string;
  user_id: string;
  spot_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  user?: Profile;
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
  conversationId?: string;
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

export interface SpotlightPerformanceTotals {
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface SpotlightPerformanceWindow {
  impressions: number;
  clicks: number;
}

export interface SpotlightPerformancePoint {
  date: string;
  impressions: number;
  clicks: number;
}

export interface SponsorSpotlightPerformance {
  totals: SpotlightPerformanceTotals;
  last7Days: SpotlightPerformanceWindow;
  previous7Days: SpotlightPerformanceWindow;
  daily: SpotlightPerformancePoint[];
}

export interface SpotlightPerformanceTrend {
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
}

export interface SpotlightPerformanceInsights {
  trend: SpotlightPerformanceTrend;
  sparkline: SpotlightPerformancePoint[];
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
  performance: SponsorSpotlightPerformance | null;
  performanceInsights?: SpotlightPerformanceInsights | null;
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
  available_from: string | null;
  available_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface SponsorShopItemVariant {
  id: string;
  sponsor_id: string;
  item_id: string;
  name: string;
  size: string | null;
  color: string | null;
  sku: string | null;
  price_cents: number | null;
  stock: number;
  is_active: boolean;
  image_url: string | null;
  metadata: Record<string, string | number> | null;
  availability_start: string | null;
  availability_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface SponsorShopBundleItem {
  bundle_id: string;
  item_id: string;
  sponsor_id: string;
  quantity: number;
}

export interface SponsorShopBundle {
  id: string;
  sponsor_id: string;
  primary_item_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  is_active: boolean;
  metadata: Record<string, string | number> | null;
  available_from: string | null;
  available_until: string | null;
  created_at: string;
  updated_at: string;
  items: SponsorShopBundleItem[];
}

export type SponsorShopCouponDiscountType = 'percentage' | 'fixed';

export interface SponsorShopCoupon {
  id: string;
  sponsor_id: string;
  item_id: string;
  code: string;
  description: string | null;
  discount_type: SponsorShopCouponDiscountType;
  discount_value: number;
  max_uses: number | null;
  usage_count: number;
  minimum_quantity: number;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  metadata: Record<string, string | number> | null;
  created_at: string;
  updated_at: string;
}

export interface SponsorShopItemStat {
  id: string;
  sponsor_id: string;
  item_id: string;
  metric_date: string;
  views_count: number;
  cart_additions: number;
  orders_count: number;
  units_sold: number;
  revenue_cents: number;
  created_at: string;
  updated_at: string;
}

export interface ShopFrontSponsor {
  id: string;
  displayName: string | null;
  brandName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
  stripeReady: boolean;
}

export interface ShopFrontVariant {
  id: string;
  name: string;
  size: string | null;
  color: string | null;
  priceCents: number | null;
  stock: number | null;
  imageUrl: string | null;
  availabilityStart: string | null;
  availabilityEnd: string | null;
}

export interface ShopFrontItem {
  id: string;
  sponsorId: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  stock: number | null;
  imageUrl: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  metadata: Record<string, unknown> | null;
  sponsor: ShopFrontSponsor;
  variants: ShopFrontVariant[];
}

export interface SponsorShopAnalyticsTotals {
  views: number;
  carts: number;
  orders: number;
  units: number;
  revenueCents: number;
  conversionRate: number;
}

export interface SponsorShopAnalyticsHistoryPoint extends SponsorShopAnalyticsTotals {
  metricDate: string;
}

export interface SponsorShopAnalyticsPerItem extends SponsorShopAnalyticsTotals {
  itemId: string;
  lastMetricDate: string | null;
}

export interface SponsorShopAnalyticsSummary {
  updatedAt: string | null;
  totals: SponsorShopAnalyticsTotals;
  history: SponsorShopAnalyticsHistoryPoint[];
  perItem: Record<string, SponsorShopAnalyticsPerItem>;
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
  | 'shop'
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
  | 'terms'
  | 'returns'
  | 'legal'
  | 'marketplace';

// ---- Game of S.K.A.T.E types (client-side) ----
export type MatchMode = 'live' | 'remote';
export type MatchStatus = 'pending' | 'active' | 'review' | 'finished' | 'canceled';
export type TurnStatus = 'proposed' | 'responded' | 'validated' | 'failed' | 'timeout' | 'disputed';

export interface RiderProfileRow {
  user_id: string;
  handle: string;
  country: string | null;
  elo: number;
  xp: number;
  skatecoins: number;
  created_at: string;
}

export interface SkateMatchRow {
  id: string;
  mode: MatchMode;
  player_a: string;
  player_b: string;
  status: MatchStatus;
  letters_a: string;
  letters_b: string;
  winner: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface SkateTurnRow {
  id: string;
  match_id: string;
  turn_index: number;
  proposer: string;
  trick_name: string | null;
  difficulty: number | null; // 1..5
  video_a_url: string | null;
  video_b_url: string | null;
  status: TurnStatus;
  remote_deadline: string | null;
  meta_a: Record<string, unknown>;
  meta_b: Record<string, unknown>;
  created_at: string;
}

export interface TurnReviewRow {
  id: string;
  turn_id: string;
  reviewer: string;
  decision: 'valid' | 'invalid';
  reason: string | null;
  created_at: string;
}

export interface RiderRewardRow {
  id: string;
  user_id: string;
  match_id: string | null;
  kind: 'xp' | 'elo' | 'coin';
  delta: number;
  reason: string | null;
  created_at: string;
}
