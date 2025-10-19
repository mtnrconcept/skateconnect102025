export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  cover_url: string;
  skill_level: string;
  stance: string;
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
  created_at: string;
  updated_at: string;
  creator?: Profile;
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
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export type Section = 'map' | 'feed' | 'add' | 'challenges' | 'profile';
