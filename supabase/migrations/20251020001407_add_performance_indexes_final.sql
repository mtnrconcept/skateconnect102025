/*
  # Add Performance Indexes

  1. Indexes Added
    - Posts queries optimization
    - Comments queries optimization  
    - Likes queries optimization
    - Follows queries optimization
    - Spots queries optimization
    - Profiles queries optimization

  2. Benefits
    - Faster feed loading
    - Faster user profile queries
    - Faster spot searches
    - Improved join performance
*/

-- Posts indexes
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Likes indexes
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, user_id);

-- Follows indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_following ON follows(follower_id, following_id);

-- Spots indexes
CREATE INDEX IF NOT EXISTS idx_spots_created_by ON spots(created_by);
CREATE INDEX IF NOT EXISTS idx_spots_spot_type ON spots(spot_type);
CREATE INDEX IF NOT EXISTS idx_spots_difficulty ON spots(difficulty);
CREATE INDEX IF NOT EXISTS idx_spots_created_at ON spots(created_at DESC);

-- Spot media indexes
CREATE INDEX IF NOT EXISTS idx_spot_media_spot_id ON spot_media(spot_id);
CREATE INDEX IF NOT EXISTS idx_spot_media_user_id ON spot_media(user_id);

-- Spot ratings indexes
CREATE INDEX IF NOT EXISTS idx_spot_ratings_spot_id ON spot_ratings(spot_id);
CREATE INDEX IF NOT EXISTS idx_spot_ratings_user_id ON spot_ratings(user_id);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);

-- Challenges indexes
CREATE INDEX IF NOT EXISTS idx_challenges_created_by ON challenges(created_by);
CREATE INDEX IF NOT EXISTS idx_challenges_is_active ON challenges(is_active);
CREATE INDEX IF NOT EXISTS idx_challenges_start_date ON challenges(start_date);
CREATE INDEX IF NOT EXISTS idx_challenges_end_date ON challenges(end_date);