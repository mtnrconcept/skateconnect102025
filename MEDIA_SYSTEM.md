# SkateConnect - Media Upload System Documentation

## Overview

SkateConnect features a comprehensive media upload system with client-side compression, image cropping, and video support. All media is stored in Supabase Storage with proper security policies.

## Storage Buckets

### Created Buckets

| Bucket | Size Limit | Allowed Types | Description |
|--------|-----------|---------------|-------------|
| `avatars` | 10 MB | Images only | User profile avatars |
| `covers` | 10 MB | Images only | User profile cover photos |
| `posts` | 50 MB | Images & Videos | Post media content |
| `spots` | 50 MB | Images & Videos | Skate spot photos/videos |
| `challenges` | 50 MB | Images & Videos | Challenge submission media |
| `messages` | 10 MB | Images & Videos | Private message attachments |

### Security Policies

All buckets have:
- **Public read access** - Anyone can view media (required for social platform)
- **Authenticated upload** - Only logged-in users can upload
- **User-owned deletion** - Users can only delete their own uploads
- **MIME type restrictions** - Only allowed file types can be uploaded

## Components

### MediaUploader Component

Main component for uploading media with compression and crop support.

#### Props

```typescript
interface MediaUploaderProps {
  bucket: StorageBucket;              // Target storage bucket
  path?: string;                       // Optional subfolder path
  onUploadComplete: (url, path) => void;
  onError?: (error) => void;
  acceptVideo?: boolean;               // Allow video uploads
  maxFiles?: number;                   // Maximum files (default: 1)
  enableCrop?: boolean;                // Enable crop modal
  cropAspectRatio?: number;            // Aspect ratio for crop
  compressionOptions?: {
    maxWidth?: number;                 // Max width (default: 1920)
    maxHeight?: number;                // Max height (default: 1920)
    quality?: number;                  // Quality 0-1 (default: 0.85)
    maxSizeMB?: number;                // Max size MB (default: 5)
  };
  className?: string;
}
```

#### Usage Examples

**Basic Image Upload**
```tsx
<MediaUploader
  bucket="posts"
  onUploadComplete={(url) => console.log('Uploaded:', url)}
  onError={(error) => alert(error)}
/>
```

**Avatar Upload with Crop**
```tsx
<MediaUploader
  bucket="avatars"
  path={userId}
  enableCrop={true}
  cropAspectRatio={1}
  compressionOptions={{
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.9,
    maxSizeMB: 2,
  }}
  onUploadComplete={(url) => setAvatarUrl(url)}
/>
```

**Cover Photo Upload**
```tsx
<MediaUploader
  bucket="covers"
  path={userId}
  enableCrop={true}
  cropAspectRatio={3}
  compressionOptions={{
    maxWidth: 1920,
    maxHeight: 640,
    quality: 0.9,
    maxSizeMB: 5,
  }}
  onUploadComplete={(url) => setCoverUrl(url)}
/>
```

**Multi-file Video Upload**
```tsx
<MediaUploader
  bucket="spots"
  acceptVideo={true}
  maxFiles={5}
  onUploadComplete={(url) => {
    setMediaUrls(prev => [...prev, url]);
  }}
  compressionOptions={{
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.85,
    maxSizeMB: 5,
  }}
/>
```

### ImageCropModal Component

Interactive crop modal with zoom, rotate, and drag features.

#### Props

```typescript
interface ImageCropModalProps {
  image: string;              // Image data URL
  aspectRatio?: number;       // Crop aspect ratio (default: 1)
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
}
```

#### Features
- Drag to reposition crop area
- Zoom in/out with buttons
- Rotate image by 90° increments
- Real-time preview
- High-quality output

## Compression System

### Image Compression

The `compressImage` function provides smart image compression:

```typescript
const result = await compressImage(file, {
  maxWidth: 1920,        // Resize if larger
  maxHeight: 1920,       // Maintain aspect ratio
  quality: 0.85,         // JPEG quality
  maxSizeMB: 5,          // Target max size
  outputFormat: 'image/jpeg'
});

console.log(`Original: ${result.originalSize}`);
console.log(`Compressed: ${result.compressedSize}`);
console.log(`Ratio: ${result.compressionRatio}%`);
```

**Compression Strategy:**
1. Resize image if dimensions exceed max
2. Apply initial quality setting
3. Iteratively reduce quality if size exceeds maxSizeMB
4. Stop at quality 0.1 minimum

**Benefits:**
- Reduces bandwidth usage
- Faster uploads
- Less storage costs
- Automatic optimization

### Video Validation

Videos are validated but not compressed client-side:

```typescript
const file = await compressVideo(videoFile, 50); // 50MB max
```

## File Validation

All uploads are validated before processing:

```typescript
const validation = validateMediaFile(file, {
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ],
  maxSizeMB: 10
});

if (!validation.valid) {
  console.error(validation.error);
}
```

## Storage Utilities

### Upload Functions

**Upload File**
```typescript
import { uploadFile } from './lib/storage';

const result = await uploadFile('posts', file, userId);
console.log(result.url);  // Public URL
console.log(result.path); // Storage path
```

**Upload Base64**
```typescript
import { uploadBase64 } from './lib/storage';

const result = await uploadBase64('avatars', base64String, 'jpeg', userId);
```

**Delete File**
```typescript
import { deleteFile } from './lib/storage';

await deleteFile('posts', 'user-id/photo.jpg');
```

**Get Public URL**
```typescript
import { getPublicUrl } from './lib/storage';

const url = getPublicUrl('avatars', 'user-id/avatar.jpg');
```

## Native Integration

### Capacitor Camera

When running on iOS/Android, the MediaUploader automatically uses native camera:

```typescript
import { capturePhoto, pickPhoto, isNative } from './lib/capacitor';

if (isNative()) {
  // Native camera available
  const photo = await capturePhoto();
  const picked = await pickPhoto();
}
```

**Note:** Native features require Capacitor packages to be installed.

## Best Practices

### Avatar Images
- Use square aspect ratio (1:1)
- Max resolution: 800x800
- Enable crop for user control
- Compress to ~2MB max

### Cover Photos
- Use wide aspect ratio (3:1)
- Max resolution: 1920x640
- Enable crop for composition
- Compress to ~5MB max

### Post Media
- Support both images and videos
- Allow multiple files
- Max 5 files per post
- Compress images to ~5MB
- Video limit 50MB

### Spot Media
- Same as post media
- Consider allowing more files (5-10)
- Important for documentation

## Performance Tips

1. **Always compress images** before upload
2. **Use crop modal** for user control
3. **Show upload progress** for better UX
4. **Validate files** before processing
5. **Clean up blob URLs** after use
6. **Use appropriate bucket** for each media type

## Error Handling

```typescript
<MediaUploader
  bucket="posts"
  onUploadComplete={(url) => {
    // Success
    console.log('Uploaded:', url);
  }}
  onError={(error) => {
    // Handle errors
    if (error.includes('size exceeds')) {
      alert('File too large');
    } else if (error.includes('type')) {
      alert('Invalid file type');
    } else {
      alert('Upload failed');
    }
  }}
/>
```

## Future Enhancements

### Potential Improvements
- [ ] Video compression client-side
- [ ] Progress bars for uploads
- [ ] Drag & drop support
- [ ] Multiple crop areas
- [ ] Filters and effects
- [ ] Batch operations
- [ ] Cloud video transcoding
- [ ] Thumbnail generation
- [ ] Lazy loading for media galleries

## Troubleshooting

### Upload Fails
- Check authentication status
- Verify bucket exists in Supabase
- Confirm RLS policies are correct
- Check file size and type

### Images Not Displaying
- Verify bucket is public
- Check URL format
- Confirm file uploaded successfully
- Test storage policies in Supabase dashboard

### Crop Modal Issues
- Ensure image loads before opening
- Check aspect ratio calculation
- Verify canvas support in browser

## References

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [File API](https://developer.mozilla.org/en-US/docs/Web/API/File)
- [Capacitor Camera Plugin](https://capacitorjs.com/docs/apis/camera)
