import { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, X, Upload } from 'lucide-react';
import { isNative, capturePhoto, pickPhoto } from '../lib/capacitor';
import { uploadFile, uploadBase64, type StorageBucket } from '../lib/storage';

interface MediaUploaderProps {
  bucket: StorageBucket;
  path?: string;
  onUploadComplete: (url: string, path: string) => void;
  onError?: (error: string) => void;
  acceptVideo?: boolean;
  maxFiles?: number;
  className?: string;
}

export default function MediaUploader({
  bucket,
  path,
  onUploadComplete,
  onError,
  acceptVideo = false,
  maxFiles = 1,
  className = '',
}: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
        const file = files[i];

        const previewUrl = URL.createObjectURL(file);
        setPreviews((prev) => [...prev, previewUrl]);

        const result = await uploadFile(bucket, file, path);
        onUploadComplete(result.url, result.path);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload file';
      onError?.(errorMessage);
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCameraCapture = async () => {
    if (!isNative()) {
      onError?.('Camera is only available on mobile devices');
      return;
    }

    setUploading(true);

    try {
      const photo = await capturePhoto();

      const previewUrl = `data:image/${photo.format};base64,${photo.base64}`;
      setPreviews((prev) => [...prev, previewUrl]);

      const result = await uploadBase64(bucket, photo.base64!, photo.format, path);
      onUploadComplete(result.url, result.path);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture photo';
      onError?.(errorMessage);
      console.error('Camera error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoPicker = async () => {
    if (!isNative()) {
      fileInputRef.current?.click();
      return;
    }

    setUploading(true);

    try {
      const photo = await pickPhoto();

      const previewUrl = `data:image/${photo.format};base64,${photo.base64}`;
      setPreviews((prev) => [...prev, previewUrl]);

      const result = await uploadBase64(bucket, photo.base64!, photo.format, path);
      onUploadComplete(result.url, result.path);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pick photo';
      onError?.(errorMessage);
      console.error('Photo picker error:', error);
    } finally {
      setUploading(false);
    }
  };

  const removePreview = (index: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const acceptTypes = acceptVideo
    ? 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime'
    : 'image/jpeg,image/png,image/webp,image/gif';

  return (
    <div className={`media-uploader ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        multiple={maxFiles > 1}
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex gap-2">
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
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => removePreview(index)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
