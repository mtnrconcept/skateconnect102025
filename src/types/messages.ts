export interface FakeDirectMessageProfile {
  id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  location?: string | null;
}

export interface FakeDirectMessagePayload {
  profileId: string;
  profile?: FakeDirectMessageProfile;
  message: {
    id: string;
    sender: 'fake' | 'user';
    content: string;
    timestamp: string;
  };
}
