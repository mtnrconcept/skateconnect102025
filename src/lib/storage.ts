import {
  supabase,
  SUPABASE_STORAGE_CDN_URL,
  SUPABASE_STORAGE_PUBLIC_URL,
  isSupabaseConfigured,
} from './supabase.js';
import { isNative, capturePhoto, pickPhoto } from './capacitor';

export type StorageBucket = 'avatars' | 'covers' | 'posts' | 'spots' | 'challenges' | 'messages' | 'sponsors' | 'marketplace';

export interface UploadResult {
  url: string;
  path: string;
}

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const DEFAULT_CACHE_CONTROL = '86400';

const storagePublicBase = SUPABASE_STORAGE_PUBLIC_URL.replace(/\/$/, '');
const storageCdnBase = SUPABASE_STORAGE_CDN_URL?.replace(/\/$/, '') ?? null;

const withCdn = (publicUrl: string): string => {
  if (!storageCdnBase) {
    return publicUrl;
  }

  if (publicUrl.startsWith(storagePublicBase)) {
    return `${storageCdnBase}${publicUrl.slice(storagePublicBase.length)}`;
  }

  return publicUrl;
};

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm']);

const detectAssetType = (path: string): 'image' | 'video' | 'file' => {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video';
  }
  return 'file';
};

interface FallbackStoredFile {
  id: string;
  name: string;
  path: string;
  url: string;
  type: 'image' | 'video' | 'file';
  size: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown> | null;
}

const fallbackBuckets = new Map<StorageBucket, Map<string, FallbackStoredFile>>();

const ensureFallbackBucket = (bucket: StorageBucket): Map<string, FallbackStoredFile> => {
  if (!fallbackBuckets.has(bucket)) {
    fallbackBuckets.set(bucket, new Map());
  }
  return fallbackBuckets.get(bucket)!;
};

const matchesPrefix = (filePath: string, prefix: string): boolean => {
  if (!prefix) {
    return true;
  }

  return filePath === prefix || filePath.startsWith(`${prefix}/`);
};

const readBlobAsDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader API is unavailable in this environment.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Unable to read blob as data URL'));
    };
    reader.readAsDataURL(blob);
  });
};

const createFallbackUrl = async (blob: Blob): Promise<string> => {
  const globalUrl = typeof URL !== 'undefined' ? URL : undefined;
  const create =
    (globalUrl && typeof globalUrl.createObjectURL === 'function'
      ? globalUrl.createObjectURL.bind(globalUrl)
      : undefined) ??
    (typeof window !== 'undefined' && typeof window.URL?.createObjectURL === 'function'
      ? window.URL.createObjectURL.bind(window.URL)
      : undefined);

  if (create) {
    return create(blob);
  }

  if (typeof FileReader !== 'undefined') {
    try {
      return await readBlobAsDataUrl(blob);
    } catch (error) {
      console.warn('Failed to create data URL from blob using FileReader', error);
    }
  }

  if (typeof Buffer !== 'undefined' && typeof blob.arrayBuffer === 'function') {
    const buffer = Buffer.from(await blob.arrayBuffer());
    const mimeType = blob.type || 'application/octet-stream';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  return '';
};

const revokeFallbackUrl = (entry: FallbackStoredFile | undefined) => {
  if (!entry) {
    return;
  }

  if (entry.url.startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(entry.url);
  }
};

const toStorageObjectInfo = (entry: FallbackStoredFile): StorageObjectInfo => {
  return {
    id: entry.id,
    name: entry.name,
    path: entry.path,
    url: entry.url,
    type: entry.type,
    size: entry.size,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    metadata: entry.metadata ?? null,
  } satisfies StorageObjectInfo;
};

const listFallbackStorageFiles = (
  bucket: StorageBucket,
  options: ListStorageFilesOptions,
): StorageObjectInfo[] => {
  const { path = '', limit = 100, offset = 0 } = options;
  const bucketEntries = fallbackBuckets.get(bucket);
  if (!bucketEntries) {
    return [];
  }

  const items = Array.from(bucketEntries.values())
    .filter((entry) => matchesPrefix(entry.path, path))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(offset, offset + limit)
    .map(toStorageObjectInfo);

  return items;
};

const storeFallbackFile = async (
  bucket: StorageBucket,
  name: string,
  path: string,
  blob: Blob,
  metadata?: Record<string, unknown> | null,
): Promise<FallbackStoredFile> => {
  const bucketEntries = ensureFallbackBucket(bucket);
  const existing = bucketEntries.get(path);
  revokeFallbackUrl(existing);

  const now = new Date().toISOString();
  // Use a data URL for persistence across reloads (avoid ephemeral blob: URLs)
  const url = await readBlobAsDataUrl(blob);
  const entry: FallbackStoredFile = {
    id: path,
    name,
    path,
    url,
    type: detectAssetType(name),
    size: blob.size ?? 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    metadata,
  };

  bucketEntries.set(path, entry);
  return entry;
};

const getFallbackFile = (bucket: StorageBucket, path: string): FallbackStoredFile | undefined => {
  return fallbackBuckets.get(bucket)?.get(path);
};

const removeFallbackFile = (bucket: StorageBucket, path: string): boolean => {
  const bucketEntries = fallbackBuckets.get(bucket);
  if (!bucketEntries) {
    return false;
  }

  const existing = bucketEntries.get(path);
  if (!existing) {
    return false;
  }

  revokeFallbackUrl(existing);
  return bucketEntries.delete(path);
};

const isMissingBucketError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { message?: unknown; error?: unknown };
  const message =
    (typeof candidate.message === 'string' && candidate.message) ||
    (typeof candidate.error === 'string' && candidate.error) ||
    null;

  if (!message) {
    return false;
  }

  return message.toLowerCase().includes('bucket not found');
};

const shouldUseFallbackStorage = (): boolean => {
  return !isSupabaseConfigured();
};

export interface StorageObjectInfo {
  id: string;
  name: string;
  path: string;
  url: string;
  type: 'image' | 'video' | 'file';
  size: number | null;
  created_at: string | null;
  updated_at: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListStorageFilesOptions {
  path?: string;
  limit?: number;
  offset?: number;
}

export const getPublicFileUrl = (bucket: StorageBucket, path: string): string => {
  const fallback = getFallbackFile(bucket, path);
  if (fallback) {
    return fallback.url;
  }

  if (shouldUseFallbackStorage()) {
    return '';
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return withCdn(data.publicUrl);
};

export const listStorageFiles = async (
  bucket: StorageBucket,
  options: ListStorageFilesOptions = {},
): Promise<StorageObjectInfo[]> => {
  if (shouldUseFallbackStorage()) {
    return listFallbackStorageFiles(bucket, options);
  }

  const { path = '', limit = 100, offset = 0 } = options;

  const { data, error } = await supabase.storage.from(bucket).list(path, {
    limit,
    offset,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) {
    if (isMissingBucketError(error)) {
      console.warn(`Storage bucket "${bucket}" is unavailable. Returning fallback files.`);
      return listFallbackStorageFiles(bucket, options);
    }
    console.error('Error listing storage files:', error);
    throw error;
  }

  if (!data) {
    return [];
  }

  return data
    .filter((item) => Boolean(item.id))
    .map((item) => {
      const filePath = path ? `${path}/${item.name}` : item.name;
      return {
        id: item.id as string,
        name: item.name,
        path: filePath,
        url: getPublicFileUrl(bucket, filePath),
        type: detectAssetType(item.name),
        size: (item.metadata as { size?: number } | null)?.size ?? null,
        created_at: item.created_at ?? null,
        updated_at: item.updated_at ?? null,
        metadata: (item.metadata as Record<string, unknown> | null) ?? null,
      } satisfies StorageObjectInfo;
    });
};

interface CompressedImageResult {
  blob: Blob;
  mimeType: string;
  extension?: string;
}

interface CompressImageOptions {
  maxWidth?: number;
  mimeType?: string;
  quality?: number;
  extension?: string;
}

const MIME_TYPE_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const compressImage = async (
  file: File,
  options: CompressImageOptions = {},
): Promise<CompressedImageResult> => {
  const { maxWidth = 1920, mimeType = 'image/jpeg', quality = 0.85, extension } = options;
  const resolvedExtension = (extension ?? MIME_TYPE_EXTENSION_MAP[mimeType] ?? mimeType.split('/')[1])
    ?.replace('jpeg', 'jpg')
    ?.replace(/^\./, '')
    ?.toLowerCase();

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              mimeType,
              extension: resolvedExtension,
            });
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        mimeType,
        quality,
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export const validateFile = (file: File, type: 'image' | 'video'): boolean => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size must be less than ${MAX_FILE_SIZE_MB}MB`);
  }

  const allowedTypes = type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;

  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
  }

  return true;
};

export const generateUniqueFileName = (
  originalName: string,
  options: { extension?: string } = {},
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const originalExtension = originalName.includes('.') ? originalName.split('.').pop() ?? '' : '';
  const normalizedOverride = options.extension?.replace(/^\./, '').toLowerCase();
  const extension = (normalizedOverride ?? originalExtension)?.toLowerCase();
  const base = `${timestamp}_${random}`;
  return extension ? `${base}.${extension}` : base;
};

export const uploadFile = async (
  bucket: StorageBucket,
  file: File,
  path?: string
): Promise<UploadResult> => {
  try {
    let fileToUpload: File | Blob = file;
    let contentType = file.type || undefined;
    let extensionOverride: string | undefined;

    if (file.type.startsWith('image/')) {
      validateFile(file, 'image');
      const compressed = await compressImage(file);
      fileToUpload = compressed.blob;
      contentType = compressed.mimeType;
      extensionOverride = compressed.extension;
    } else if (file.type.startsWith('video/')) {
      validateFile(file, 'video');
    }

    const fileName = generateUniqueFileName(file.name, extensionOverride ? { extension: extensionOverride } : undefined);
    const filePath = path ? `${path}/${fileName}` : fileName;

    const uploadToFallback = async () => {
      const fallbackEntry = await storeFallbackFile(bucket, fileName, filePath, fileToUpload, {
        size: fileToUpload.size,
        contentType,
      });
      return { url: fallbackEntry.url, path: fallbackEntry.path } satisfies UploadResult;
    };

    if (shouldUseFallbackStorage()) {
      return await uploadToFallback();
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileToUpload, {
        cacheControl: DEFAULT_CACHE_CONTROL,
        upsert: false,
        contentType,
      });

    if (error) {
      if (isMissingBucketError(error)) {
        console.warn(
          `Storage bucket "${bucket}" is unavailable. Using in-memory fallback storage for uploads.`,
        );
        return await uploadToFallback();
      }
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      url: withCdn(urlData.publicUrl),
      path: data.path,
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

export const uploadBase64 = async (
  bucket: StorageBucket,
  base64Data: string,
  format: string,
  path?: string
): Promise<UploadResult> => {
  try {
    const fileName = generateUniqueFileName(`photo.${format}`);
    const filePath = path ? `${path}/${fileName}` : fileName;

    const base64Response = await fetch(`data:image/${format};base64,${base64Data}`);
    const blob = await base64Response.blob();

    const uploadToFallback = async () => {
      const fallbackEntry = await storeFallbackFile(bucket, fileName, filePath, blob, {
        size: blob.size,
        contentType: `image/${format}`,
      });
      return { url: fallbackEntry.url, path: fallbackEntry.path } satisfies UploadResult;
    };

    if (shouldUseFallbackStorage()) {
      return await uploadToFallback();
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        cacheControl: DEFAULT_CACHE_CONTROL,
        upsert: false,
        contentType: `image/${format}`,
      });

    if (error) {
      if (isMissingBucketError(error)) {
        console.warn(
          `Storage bucket "${bucket}" is unavailable. Using in-memory fallback storage for uploads.`,
        );
        return await uploadToFallback();
      }
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      url: withCdn(urlData.publicUrl),
      path: data.path,
    };
  } catch (error) {
    console.error('Error uploading base64:', error);
    throw error;
  }
};

export const deleteFile = async (bucket: StorageBucket, path: string): Promise<void> => {
  try {
    if (shouldUseFallbackStorage()) {
      removeFallbackFile(bucket, path);
      return;
    }

    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      if (isMissingBucketError(error)) {
        removeFallbackFile(bucket, path);
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

export const captureAndUploadPhoto = async (
  bucket: StorageBucket,
  path?: string
): Promise<UploadResult> => {
  if (!isNative()) {
    throw new Error('This function is only available on native platforms');
  }

  try {
    const photo = await capturePhoto();
    return await uploadBase64(bucket, photo.base64!, photo.format, path);
  } catch (error) {
    console.error('Error capturing and uploading photo:', error);
    throw error;
  }
};

export const pickAndUploadPhoto = async (
  bucket: StorageBucket,
  path?: string
): Promise<UploadResult> => {
  if (!isNative()) {
    throw new Error('This function is only available on native platforms');
  }

  try {
    const photo = await pickPhoto();
    return await uploadBase64(bucket, photo.base64!, photo.format, path);
  } catch (error) {
    console.error('Error picking and uploading photo:', error);
    throw error;
  }
};

export const getFileUrl = (bucket: StorageBucket, path: string): string => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return withCdn(data.publicUrl);
};
