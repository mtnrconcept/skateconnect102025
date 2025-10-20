import { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, X, Upload, Video, Crop } from 'lucide-react';
import { isNative, capturePhoto, pickPhoto } from '../lib/capacitor';
import { uploadFile, uploadBase64, type StorageBucket } from '../lib/storage';
import { compressImage, compressVideo, validateMediaFile, formatFileSize } from '../lib/imageCompression';
import ImageCropModal from './ImageCropModal';

interface MediaUploaderProps {
  bucket: StorageBucket;
  path?: string;
  onUploadComplete: (url: string, path: string) => void;
  onError?: (error: string) => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
  acceptVideo?: boolean;
  maxFiles?: number;
  enableCrop?: boolean;
  cropAspectRatio?: number;
  compressionOptions?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxSizeMB?: number;
  };
  className?: string;
}

interface MediaPreview {
  url: string;
  type: 'image' | 'video';
  file?: File;
  originalSize?: number;
  compressedSize?: number;
}

export default function MediaUploader({
  bucket,
  path,
  onUploadComplete,
  onError,
  onUploadStart,
  onUploadEnd,
  acceptVideo = false,
  maxFiles = 1,
  enableCrop = false,
  cropAspectRatio = 1,
  compressionOptions = {},
  className = '',
}: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<MediaPreview[]>([]);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMedia = async (file: File) => {
    const validation = validateMediaFile(file, {
      allowedTypes: acceptVideo
        ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
        : ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      maxSizeMB: file.type.startsWith('video/') ? 50 : 10,
    });

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    let fileToUpload = file;
    let compressedSize = file.size;

    if (file.type.startsWith('image/')) {
      const compressed = await compressImage(file, {
        maxWidth: compressionOptions.maxWidth || 1920,
        maxHeight: compressionOptions.maxHeight || 1920,
        quality: compressionOptions.quality || 0.85,
        maxSizeMB: compressionOptions.maxSizeMB || 5,
      });
      fileToUpload = compressed.file;
      compressedSize = compressed.compressedSize;

      console.log(
        `Compressed image: ${formatFileSize(file.size)} → ${formatFileSize(compressedSize)} (${compressed.compressionRatio}% reduction)`
      );
    } else if (file.type.startsWith('video/')) {
      fileToUpload = await compressVideo(file, 50);
      compressedSize = fileToUpload.size;
    }

    const result = await uploadFile(bucket, fileToUpload, path);
    return { result, originalSize: file.size, compressedSize };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    if (enableCrop && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageToCrop(event.target.result as string);
          setPendingFile(file);
          setShowCropModal(true);
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    await processFile(file);
  };

  const processFile = async (file: File) => {
    setUploading(true);
    onUploadStart?.();

    try {
      const previewUrl = URL.createObjectURL(file);
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      setPreviews((prev) => [
        ...prev.slice(0, maxFiles - 1),
        { url: previewUrl, type: mediaType, file, originalSize: file.size },
      ]);

      const { result, originalSize, compressedSize } = await uploadMedia(file);

      setPreviews((prev) =>
        prev.map((p) =>
          p.url === previewUrl ? { ...p, compressedSize } : p
        )
      );

      onUploadComplete(result.url, result.path);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload file';
      onError?.(errorMessage);
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
      onUploadEnd?.();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setShowCropModal(false);
    setImageToCrop(null);

    if (!pendingFile) return;

    const croppedFile = new File([croppedBlob], pendingFile.name, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    setPendingFile(null);
    await processFile(croppedFile);
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
    setPendingFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCameraCapture = async () => {
    if (!isNative()) {
      onError?.('Camera is only available on mobile devices');
      return;
    }

    setUploading(true);
    onUploadStart?.();

    try {
      const photo = await capturePhoto();

      const previewUrl = `data:image/${photo.format};base64,${photo.base64}`;
      setPreviews((prev) => [...prev, { url: previewUrl, type: 'image' }]);

      const result = await uploadBase64(bucket, photo.base64!, photo.format, path);
      onUploadComplete(result.url, result.path);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture photo';
      onError?.(errorMessage);
      console.error('Camera error:', error);
    } finally {
      setUploading(false);
      onUploadEnd?.();
    }
  };

  const handlePhotoPicker = async () => {
    if (!isNative()) {
      fileInputRef.current?.click();
      return;
    }

    setUploading(true);
    onUploadStart?.();

    try {
      const photo = await pickPhoto();

      const previewUrl = `data:image/${photo.format};base64,${photo.base64}`;
      setPreviews((prev) => [...prev, { url: previewUrl, type: 'image' }]);

      const result = await uploadBase64(bucket, photo.base64!, photo.format, path);
      onUploadComplete(result.url, result.path);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pick photo';
      onError?.(errorMessage);
      console.error('Photo picker error:', error);
    } finally {
      setUploading(false);
      onUploadEnd?.();
    }
  };

  const removePreview = (index: number) => {
    const preview = previews[index];
    URL.revokeObjectURL(preview.url);
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const acceptTypes = acceptVideo
    ? 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm'
    : 'image/jpeg,image/png,image/webp,image/gif';

  return (
    <>
      <div className={`media-uploader ${className}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          multiple={maxFiles > 1}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex gap-2 flex-wrap">
          {isNative() && (
            <button
              type="button"
              onClick={handleCameraCapture}
              disabled={uploading || previews.length >= maxFiles}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera size={20} />
              <span>Camera</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePhotoPicker}
            disabled={uploading || previews.length >= maxFiles}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ImageIcon size={20} />
            <span>{isNative() ? 'Gallery' : 'Choose File'}</span>
          </button>

          {enableCrop && !isNative() && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || previews.length >= maxFiles}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Crop size={20} />
              <span>Upload & Crop</span>
            </button>
          )}
        </div>

        {uploading && (
          <div className="mt-4 flex items-center gap-2 text-blue-600">
            <Upload size={20} className="animate-bounce" />
            <span>Uploading...</span>
          </div>
        )}

        {previews.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {previews.map((preview, index) => (
              <div key={index} className="relative aspect-square">
                {preview.type === 'image' ? (
                  <img
                    src={preview.url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full bg-black rounded-lg flex items-center justify-center">
                    <Video className="w-12 h-12 text-white" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePreview(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                >
                  <X size={16} />
                </button>
                {preview.originalSize && preview.compressedSize && (
                  <div className="absolute bottom-1 left-1 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                    {formatFileSize(preview.compressedSize)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCropModal && imageToCrop && (
        <ImageCropModal
          image={imageToCrop}
          aspectRatio={cropAspectRatio}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}
