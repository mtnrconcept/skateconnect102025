import type { Post } from '../types';

const PROFILE_MEDIA_PATH_SEGMENTS = ['/avatars/', '/covers/'];

export const isProfileMediaUrl = (url: string): boolean =>
  PROFILE_MEDIA_PATH_SEGMENTS.some((segment) => url.includes(segment));

export const filterOutProfileMediaPosts = (posts: Post[]): Post[] =>
  posts.filter((post) => !post.media_urls?.some((url) => isProfileMediaUrl(url)));
