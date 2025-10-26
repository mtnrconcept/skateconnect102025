/*
  # Configure Supabase Storage Buckets and Policies

  1. Storage Buckets Created
    - `avatars` - User profile avatars (10MB max, images only)
    - `covers` - User profile cover photos (10MB max, images only)
    - `posts` - Post media content (50MB max, images/videos)
    - `spots` - Skate spot media (50MB max, images/videos)
    - `challenges` - Challenge submission media (50MB max, images/videos)
    - `messages` - Private message attachments (10MB max, images/videos)
    - `sponsors` - Sponsor campaigns, shops and opportunities (50MB max, images/videos)

  2. Security Policies
    - Public read access for all buckets (social platform requirement)
    - Authenticated users can upload to any bucket
    - Users can only delete their own uploads
    - File size and type restrictions enforced by policies

  3. Important Notes
    - All buckets are public for read access (social media platform)
    - Authentication required for uploads
    - Individual file size limits set per bucket
    - MIME type restrictions prevent unauthorized file types
*/

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('covers', 'covers', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('posts', 'posts', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']),
  ('spots', 'spots', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']),
  ('challenges', 'challenges', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']),
  ('messages', 'messages', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']),
  ('sponsors', 'sponsors', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'])
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow public read access to all storage buckets
CREATE POLICY "Public read access for avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Public read access for covers"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'covers');

CREATE POLICY "Public read access for posts"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'posts');

CREATE POLICY "Public read access for spots"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'spots');

CREATE POLICY "Public read access for challenges"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'challenges');

CREATE POLICY "Public read access for messages"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'messages');

CREATE POLICY "Public read access for sponsors"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'sponsors');

-- Policy: Authenticated users can upload to avatars
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Policy: Authenticated users can upload to covers
CREATE POLICY "Authenticated users can upload covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'covers');

-- Policy: Authenticated users can upload to posts
CREATE POLICY "Authenticated users can upload posts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'posts');

-- Policy: Authenticated users can upload to spots
CREATE POLICY "Authenticated users can upload spots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'spots');

-- Policy: Authenticated users can upload to challenges
CREATE POLICY "Authenticated users can upload challenges"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'challenges');

-- Policy: Authenticated users can upload to messages
CREATE POLICY "Authenticated users can upload messages"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'messages');

CREATE POLICY "Authenticated users can upload sponsors"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'sponsors');

-- Policy: Users can update their own uploads in avatars
CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can update their own uploads in covers
CREATE POLICY "Users can update own covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can update their own uploads in posts
CREATE POLICY "Users can update own posts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can update their own uploads in spots
CREATE POLICY "Users can update own spots"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'spots' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'spots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can update their own uploads in challenges
CREATE POLICY "Users can update own challenges"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'challenges' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'challenges' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can update their own uploads in messages
CREATE POLICY "Users can update own messages"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'messages' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own sponsors"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'sponsors' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'sponsors' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can delete their own uploads from avatars
CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can delete their own uploads from covers
CREATE POLICY "Users can delete own covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can delete their own uploads from posts
CREATE POLICY "Users can delete own posts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can delete their own uploads from spots
CREATE POLICY "Users can delete own spots"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'spots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can delete their own uploads from challenges
CREATE POLICY "Users can delete own challenges"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'challenges' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can delete their own uploads from messages
CREATE POLICY "Users can delete own messages"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own sponsors"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'sponsors' AND auth.uid()::text = (storage.foldername(name))[1]);