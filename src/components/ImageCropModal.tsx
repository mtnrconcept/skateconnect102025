import { useState, useRef, useEffect } from 'react';
import { X, RotateCw, ZoomIn, ZoomOut, Check } from 'lucide-react';

type CropOutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

interface ImageCropModalProps {
  image: string;
  aspectRatio?: number;
  onCrop: (croppedImage: Blob) => void;
  onCancel: () => void;
  outputFormat?: CropOutputFormat;
}

export default function ImageCropModal({
  image,
  aspectRatio = 1,
  onCrop,
  onCancel,
  outputFormat = 'image/jpeg',
}: ImageCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    initialOffsetX: 0,
    initialOffsetY: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [frame, setFrame] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const baseScaleRef = useRef(1);

  const clampOffset = (
    nextOffset: { x: number; y: number },
    zoomValue = zoom,
    rotationValue = rotation
  ) => {
    const img = imageRef.current;
    if (!img || frame.width === 0 || frame.height === 0) {
      return nextOffset;
    }

    const scale = baseScaleRef.current * zoomValue;
    const imgWidth = img.width * scale;
    const imgHeight = img.height * scale;
    const rad = (rotationValue * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatedWidth = Math.abs(imgWidth * cos) + Math.abs(imgHeight * sin);
    const rotatedHeight = Math.abs(imgWidth * sin) + Math.abs(imgHeight * cos);

    const maxOffsetX = Math.max(0, (rotatedWidth - frame.width) / 2);
    const maxOffsetY = Math.max(0, (rotatedHeight - frame.height) / 2);

    return {
      x: Math.min(Math.max(nextOffset.x, -maxOffsetX), maxOffsetX),
      y: Math.min(Math.max(nextOffset.y, -maxOffsetY), maxOffsetY),
    };
  };

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

        const maxFrameWidth = containerWidth * 0.9;
        const maxFrameHeight = containerHeight * 0.9;

        let frameWidth = maxFrameWidth;
        let frameHeight = maxFrameWidth / aspectRatio;

        if (frameHeight > maxFrameHeight) {
          frameHeight = maxFrameHeight;
          frameWidth = frameHeight * aspectRatio;
        }

        setFrame({
          x: (containerWidth - frameWidth) / 2,
          y: (containerHeight - frameHeight) / 2,
          width: frameWidth,
          height: frameHeight,
        });

        const baseScale = Math.max(frameWidth / img.width, frameHeight / img.height);
        baseScaleRef.current = baseScale;
        setOffset({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
      }

      drawCanvas();
    };
    img.src = image;
  }, [image, aspectRatio]);

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [zoom, rotation, frame, offset, imageLoaded]);

  useEffect(() => {
    if (!imageLoaded) return;
    setOffset((current) => clampOffset(current));
  }, [zoom, rotation, frame.width, frame.height, imageLoaded]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = baseScaleRef.current * zoom;
    const frameCenterX = frame.x + frame.width / 2;
    const frameCenterY = frame.y + frame.height / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(frame.x, frame.y, frame.width, frame.height);
    ctx.clip();

    ctx.translate(frameCenterX + offset.x, frameCenterY + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
    ctx.restore();

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.strokeRect(frame.x, frame.y, frame.width, frame.height);

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(frame.x, frame.y, frame.width, frame.height);
    ctx.setLineDash([]);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (
      x >= frame.x &&
      x <= frame.x + frame.width &&
      y >= frame.y &&
      y <= frame.y + frame.height
    ) {
      setIsDragging(true);
      dragStateRef.current = {
        startX: x,
        startY: y,
        initialOffsetX: offset.x,
        initialOffsetY: offset.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { startX, startY, initialOffsetX, initialOffsetY } = dragStateRef.current;
    const deltaX = x - startX;
    const deltaY = y - startY;
    setOffset(clampOffset({ x: initialOffsetX + deltaX, y: initialOffsetY + deltaY }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (
      x >= frame.x &&
      x <= frame.x + frame.width &&
      y >= frame.y &&
      y <= frame.y + frame.height
    ) {
      setIsDragging(true);
      dragStateRef.current = {
        startX: x,
        startY: y,
        initialOffsetX: offset.x,
        initialOffsetY: offset.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDragging) return;

    const touch = e.touches[0];
    if (!touch) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const { startX, startY, initialOffsetX, initialOffsetY } = dragStateRef.current;
    const deltaX = x - startX;
    const deltaY = y - startY;
    setOffset(clampOffset({ x: initialOffsetX + deltaX, y: initialOffsetY + deltaY }));
  };

  const handleTouchEnd = () => {
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
    cropCanvas.width = frame.width;
    cropCanvas.height = frame.height;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return;

    cropCtx.save();
    cropCtx.translate(cropCanvas.width / 2 + offset.x, cropCanvas.height / 2 + offset.y);
    cropCtx.rotate((rotation * Math.PI) / 180);
    cropCtx.scale(baseScaleRef.current * zoom, baseScaleRef.current * zoom);
    cropCtx.drawImage(img, -img.width / 2, -img.height / 2);
    cropCtx.restore();

    const quality = outputFormat === 'image/jpeg' || outputFormat === 'image/webp' ? 0.95 : undefined;

    cropCanvas.toBlob(
      (blob) => {
        if (blob) {
          onCrop(blob);
        }
      },
      outputFormat,
      quality,
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Ajuster l'image</h3>
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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
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
                Annuler
              </button>
              <button
                onClick={handleCrop}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Appliquer
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-400">
            <p>Déplacez l'image pour ajuster le cadrage.</p>
            <p className="mt-1">Zoom : {Math.round(zoom * 100)}% | Rotation : {rotation}°</p>
          </div>
        </div>
      </div>
    </div>
  );
}
