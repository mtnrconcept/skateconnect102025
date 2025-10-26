import { supabase, SUPABASE_STORAGE_CDN_URL, SUPABASE_STORAGE_PUBLIC_URL } from './supabase.js';
import { isNative, capturePhoto, pickPhoto } from './capacitor';

export type StorageBucket = 'avatars' | 'covers' | 'posts' | 'spots' | 'challenges' | 'messages' | 'sponsors';

export interface UploadResult {
  url: string;
  path: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
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
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return withCdn(data.publicUrl);
};

export const listStorageFiles = async (
  bucket: StorageBucket,
  options: ListStorageFilesOptions = {},
): Promise<StorageObjectInfo[]> => {
  const { path = '', limit = 100, offset = 0 } = options;

  const { data, error } = await supabase.storage.from(bucket).list(path, {
    limit,
    offset,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) {
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

export const compressImage = async (file: File, maxWidth: number = 1920): Promise<Blob> => {
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
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export const validateFile = (file: File, type: 'image' | 'video'): boolean => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const allowedTypes = type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;

  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
  }

  return true;
};

export const generateUniqueFileName = (originalName: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop();
  return `${timestamp}_${random}.${extension}`;
};

export const uploadFile = async (
  bucket: StorageBucket,
  file: File,
  path?: string
): Promise<UploadResult> => {
  try {
    const fileName = generateUniqueFileName(file.name);
    const filePath = path ? `${path}/${fileName}` : fileName;

    let fileToUpload: File | Blob = file;

    if (file.type.startsWith('image/')) {
      validateFile(file, 'image');
      fileToUpload = await compressImage(file);
    } else if (file.type.startsWith('video/')) {
      validateFile(file, 'video');
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileToUpload, {
        cacheControl: DEFAULT_CACHE_CONTROL,
        upsert: false,
        contentType: file.type || undefined,
      });

    if (error) throw error;

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

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        cacheControl: DEFAULT_CACHE_CONTROL,
        upsert: false,
        contentType: `image/${format}`,
      });

    if (error) throw error;

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
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) throw error;
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
