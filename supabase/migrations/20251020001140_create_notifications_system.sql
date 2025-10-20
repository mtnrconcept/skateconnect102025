/*
  # Create Notifications System

  1. New Tables
    - `push_tokens` - Store device push notification tokens
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `token` (text, unique) - FCM/APNS token
      - `platform` (text) - 'ios' or 'android'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `notifications` - Store all notifications
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key) - Recipient
      - `type` (text) - Notification type
      - `title` (text) - Notification title
      - `body` (text) - Notification body
      - `data` (jsonb) - Additional data
      - `read` (boolean) - Read status
      - `created_at` (timestamptz)

  2. Notification Types
    - 'like' - Someone liked your post
    - 'comment' - Someone commented on your post
    - 'follow' - Someone followed you
    - 'mention' - Someone mentioned you
    - 'message' - New private message
    - 'spot_comment' - Comment on spot you created
    - 'challenge_vote' - Vote on your challenge submission

  3. Security
    - Enable RLS on all tables
    - Users can only read their own notifications
    - Users can only manage their own push tokens
    - System can create notifications via triggers

  4. Triggers
    - Auto-create notifications for likes
    - Auto-create notifications for comments
    - Auto-create notifications for follows
    - Auto-create notifications for mentions
*/

-- Create push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'mention', 'message', 'spot_comment', 'challenge_vote')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

-- Enable RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Push tokens policies
CREATE POLICY "Users can view own push tokens"
  ON push_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens"
  ON push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens"
  ON push_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens"
  ON push_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Trigger function for like notifications
CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_author_id uuid;
  v_liker_name text;
BEGIN
  -- Get post author
  SELECT user_id INTO v_post_author_id
  FROM posts
  WHERE id = NEW.post_id;
  
  -- Don't notify if user likes their own post
  IF v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get liker's display name
  SELECT display_name INTO v_liker_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Create notification
  PERFORM create_notification(
    v_post_author_id,
    'like',
    'New Like',
    v_liker_name || ' liked your post',
    jsonb_build_object(
      'post_id', NEW.post_id,
      'user_id', NEW.user_id,
      'username', (SELECT username FROM profiles WHERE id = NEW.user_id)
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger function for comment notifications
CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_author_id uuid;
  v_commenter_name text;
BEGIN
  -- Get post author
  SELECT user_id INTO v_post_author_id
  FROM posts
  WHERE id = NEW.post_id;
  
  -- Don't notify if user comments on their own post
  IF v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get commenter's display name
  SELECT display_name INTO v_commenter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Create notification
  PERFORM create_notification(
    v_post_author_id,
    'comment',
    'New Comment',
    v_commenter_name || ' commented on your post',
    jsonb_build_object(
      'post_id', NEW.post_id,
      'comment_id', NEW.id,
      'user_id', NEW.user_id,
      'username', (SELECT username FROM profiles WHERE id = NEW.user_id)
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger function for follow notifications
CREATE OR REPLACE FUNCTION notify_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_follower_name text;
BEGIN
  -- Get follower's display name
  SELECT display_name INTO v_follower_name
  FROM profiles
  WHERE id = NEW.follower_id;
  
  -- Create notification
  PERFORM create_notification(
    NEW.following_id,
    'follow',
    'New Follower',
    v_follower_name || ' started following you',
    jsonb_build_object(
      'user_id', NEW.follower_id,
      'username', (SELECT username FROM profiles WHERE id = NEW.follower_id)
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_notify_post_like ON likes;
CREATE TRIGGER trigger_notify_post_like
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_like();

DROP TRIGGER IF EXISTS trigger_notify_post_comment ON comments;
CREATE TRIGGER trigger_notify_post_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_comment();

DROP TRIGGER IF EXISTS trigger_notify_follow ON follows;
CREATE TRIGGER trigger_notify_follow
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION notify_follow();

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications
  SET read = true
  WHERE id = p_notification_id
    AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE notifications
  SET read = true
  WHERE user_id = auth.uid()
    AND read = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM notifications
  WHERE user_id = auth.uid()
    AND read = false;
  
  RETURN v_count;
END;
$$;