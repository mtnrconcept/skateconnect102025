export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
  outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface CompressionResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

const calculateDimensions = (
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  let { width, height } = img;

  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }

  return { width: Math.round(width), height: Math.round(height) };
};

const canvasToBlob = (canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      format,
      quality
    );
  });
};

export const compressImage = async (
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> => {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    maxSizeMB = 5,
    outputFormat = 'image/jpeg',
  } = options;

  const originalSize = file.size;
  let currentQuality = quality;

  const img = await loadImage(file);
  const { width, height } = calculateDimensions(img, maxWidth, maxHeight);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  URL.revokeObjectURL(img.src);

  let blob = await canvasToBlob(canvas, outputFormat, currentQuality);
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  while (blob.size > maxSizeBytes && currentQuality > 0.1) {
    currentQuality -= 0.1;
    blob = await canvasToBlob(canvas, outputFormat, currentQuality);
  }

  const compressedFile = new File([blob], file.name, {
    type: outputFormat,
    lastModified: Date.now(),
  });

  const dataUrl = canvas.toDataURL(outputFormat, currentQuality);

  return {
    file: compressedFile,
    dataUrl,
    originalSize,
    compressedSize: blob.size,
    compressionRatio: Math.round((1 - blob.size / originalSize) * 100),
  };
};

export const compressVideo = async (file: File, maxSizeMB: number = 50): Promise<File> => {
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`Video file size exceeds ${maxSizeMB}MB limit`);
  }

  return file;
};

export const validateMediaFile = (
  file: File,
  options: {
    allowedTypes: string[];
    maxSizeMB: number;
  }
): { valid: boolean; error?: string } => {
  const { allowedTypes, maxSizeMB } = options;

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  return { valid: true };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
