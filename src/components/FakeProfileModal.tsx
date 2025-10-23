import { MapPin, Users, Award, X, Sparkles } from 'lucide-react';
import { getUserDisplayName } from '../lib/userUtils';
import type { FakeProfileDetails } from '../data/fakeFeed';
import type { Post } from '../types';

interface FakeProfileModalProps {
  profile: FakeProfileDetails;
  posts: (Post & { isFake?: boolean })[];
  onClose: () => void;
  onPostLike: (postId: string) => void;
  onToggleFollow: () => void;
  isFollowing: boolean;
  onMessage: () => void;
  followerCount: number;
}

export default function FakeProfileModal({
  profile,
  posts,
  onClose,
  onPostLike,
  onToggleFollow,
  isFollowing,
  onMessage,
  followerCount,
}: FakeProfileModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4 py-6">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-dark-700 bg-[#101019] shadow-2xl max-h-[92vh]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-gray-300 transition-colors hover:text-white"
          aria-label="Fermer le profil"
        >
          <X size={18} />
        </button>

        {profile.cover_url ? (
          <div className="h-40 w-full overflow-hidden">
            <img src={profile.cover_url} alt="Cover" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="h-32 w-full bg-gradient-to-r from-orange-500/40 via-pink-500/30 to-purple-500/40" />
        )}

        <div className="-mt-12 px-6 pb-6 overflow-y-auto max-h-[calc(92vh-6rem)]">
          <div className="flex flex-col gap-6 rounded-3xl border border-dark-700 bg-[#13131d] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-3xl border-2 border-orange-500/70 bg-orange-500">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={getUserDisplayName(profile)} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white">
                    {getUserDisplayName(profile).slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div>
                  <h2 className="text-2xl font-semibold text-white">{getUserDisplayName(profile)}</h2>
                  <p className="text-sm text-gray-400">@{profile.username}</p>
                </div>
                <p className="text-sm leading-relaxed text-gray-300">{profile.bio}</p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                  <span className="inline-flex items-center gap-1 rounded-full border border-dark-600 px-3 py-1">
                    <MapPin size={14} className="text-orange-400" />
                    {profile.location}
                  </span>
                  {profile.skill_level && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-dark-600 px-3 py-1">
                      <Sparkles size={14} className="text-orange-400" />
                      {profile.skill_level}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onToggleFollow}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  isFollowing
                    ? 'border-orange-500 bg-orange-500/20 text-orange-200 hover:bg-orange-500/30'
                    : 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                {isFollowing ? 'Suivi·e' : 'Suivre'}
              </button>
              <button
                type="button"
                onClick={onMessage}
                className="inline-flex items-center gap-2 rounded-full border border-dark-600 px-4 py-2 text-sm font-semibold text-white hover:border-orange-500/70 hover:text-orange-200"
              >
                Envoyer un message
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-dark-700 bg-[#181821] px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Followers</div>
                <div className="text-xl font-semibold text-white">
                  {new Intl.NumberFormat('fr-FR').format(followerCount)}
                </div>
              </div>
              <div className="rounded-2xl border border-dark-700 bg-[#181821] px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Following</div>
                <div className="text-xl font-semibold text-white">
                  {new Intl.NumberFormat('fr-FR').format(profile.following)}
                </div>
              </div>
              <div className="rounded-2xl border border-dark-700 bg-[#181821] px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Posts</div>
                <div className="text-xl font-semibold text-white">{posts.length}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-dark-700 bg-[#181821] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <Users size={16} className="text-orange-400" />
                  Sponsors
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                  {profile.sponsors.map((sponsor) => (
                    <span key={sponsor} className="rounded-full border border-orange-500/40 px-3 py-1 text-orange-300">
                      {sponsor}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-dark-700 bg-[#181821] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <Award size={16} className="text-orange-400" />
                  Highlights
                </div>
                <ul className="space-y-1 text-xs text-gray-300">
                  {profile.achievements.map((achievement) => (
                    <li key={achievement}>• {achievement}</li>
                  ))}
                </ul>
              </div>
            </div>

            {posts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Posts récents</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {posts.map((post) => (
                    <div key={post.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-dark-700 bg-[#181821]">
                      {post.media_urls && post.media_urls.length > 0 && (
                        <div className="relative h-40 w-full overflow-hidden">
                          <img src={post.media_urls[0]} alt={post.content?.slice(0, 40) ?? 'Post'} className="h-full w-full object-cover" />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <p className="text-sm text-gray-200">{post.content}</p>
                        <button
                          type="button"
                          onClick={() => onPostLike(post.id)}
                          className={`self-start rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                            post.liked_by_user
                              ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                              : 'border-dark-600 text-gray-400 hover:border-orange-500 hover:text-orange-300'
                          }`}
                        >
                          {post.liked_by_user ? 'Je like déjà' : 'Envoyer du love'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
