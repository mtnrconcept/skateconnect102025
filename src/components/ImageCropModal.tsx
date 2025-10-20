import { useState, useRef, useEffect } from 'react';
import { X, RotateCw, ZoomIn, ZoomOut, Check } from 'lucide-react';

interface ImageCropModalProps {
  image: string;
  aspectRatio?: number;
  onCrop: (croppedImage: Blob) => void;
  onCancel: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function ImageCropModal({
  image,
  aspectRatio = 1,
  onCrop,
  onCancel,
}: ImageCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 200, height: 200 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);

      const canvas = canvasRef.current;
      if (canvas) {
        const containerWidth = canvas.parentElement?.clientWidth || 600;
        const containerHeight = canvas.parentElement?.clientHeight || 400;
        canvas.width = containerWidth;
        canvas.height = containerHeight;

        const cropSize = Math.min(containerWidth, containerHeight) * 0.7;
        const cropWidth = aspectRatio >= 1 ? cropSize : cropSize * aspectRatio;
        const cropHeight = aspectRatio >= 1 ? cropSize / aspectRatio : cropSize;

        setCropArea({
          x: (containerWidth - cropWidth) / 2,
          y: (containerHeight - cropHeight) / 2,
          width: cropWidth,
          height: cropHeight,
        });
      }

      drawCanvas();
    };
    img.src = image;
  }, [image, aspectRatio]);

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [zoom, rotation, cropArea, imageLoaded]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    const imgWidth = img.width;
    const imgHeight = img.height;
    const scale = Math.min(canvas.width / imgWidth, canvas.height / imgHeight) * 0.8;

    ctx.drawImage(
      img,
      (-imgWidth * scale) / 2,
      (-imgHeight * scale) / 2,
      imgWidth * scale,
      imgHeight * scale
    );

    ctx.restore();

    ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    ctx.setLineDash([]);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (
      x >= cropArea.x &&
      x <= cropArea.x + cropArea.width &&
      y >= cropArea.y &&
      y <= cropArea.y + cropArea.height
    ) {
      setIsDragging(true);
      setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newX = Math.max(0, Math.min(x - dragStart.x, canvas.width - cropArea.width));
    const newY = Math.max(0, Math.min(y - dragStart.y, canvas.height - cropArea.height));

    setCropArea({ ...cropArea, x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleCrop = async () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropArea.width;
    cropCanvas.height = cropArea.height;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.save();
    tempCtx.translate(canvas.width / 2, canvas.height / 2);
    tempCtx.rotate((rotation * Math.PI) / 180);
    tempCtx.scale(zoom, zoom);

    const imgWidth = img.width;
    const imgHeight = img.height;
    const scale = Math.min(canvas.width / imgWidth, canvas.height / imgHeight) * 0.8;

    tempCtx.drawImage(
      img,
      (-imgWidth * scale) / 2,
      (-imgHeight * scale) / 2,
      imgWidth * scale,
      imgHeight * scale
    );
    tempCtx.restore();

    cropCtx.drawImage(
      tempCanvas,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height,
      0,
      0,
      cropArea.width,
      cropArea.height
    );

    cropCanvas.toBlob((blob) => {
      if (blob) {
        onCrop(blob);
      }
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Crop Image</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative bg-black" style={{ height: '500px' }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <button
                onClick={handleZoomOut}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={handleZoomIn}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={handleRotate}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                title="Rotate"
              >
                <RotateCw className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCrop}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Apply Crop
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-400">
            <p>Drag the crop area to reposition</p>
            <p className="mt-1">Zoom: {Math.round(zoom * 100)}% | Rotation: {rotation}°</p>
          </div>
        </div>
      </div>
    </div>
  );
}
