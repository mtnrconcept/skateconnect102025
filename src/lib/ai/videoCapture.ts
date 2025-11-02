/**
 * Video capture and preprocessing utilities
 * Handles WebRTC stream capture, frame sampling, and tensor preprocessing
 */

export interface CapturedFrame {
  data: ImageData;
  timestamp: number;
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): CapturedFrame | null {
  if (video.readyState < video.HAVE_CURRENT_DATA) return null;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return {
    data: imageData,
    timestamp: performance.now(),
  };
}

/**
 * Preprocess frame for ONNX models (MoveNet input: 192x192 RGB, normalized [-1, 1])
 */
export function preprocessFrame(frame: CapturedFrame): Float32Array {
  const { data, width, height } = frame.data;
  const targetSize = 192; // MoveNet input size

  // Resize and normalize to [-1, 1]
  const resized = new Float32Array(targetSize * targetSize * 3);
  const scaleX = targetSize / width;
  const scaleY = targetSize / height;

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const srcX = Math.floor(x / scaleX);
      const srcY = Math.floor(y / scaleY);
      const srcIdx = (srcY * width + srcX) * 4;

      const r = data[srcIdx] / 127.5 - 1.0;
      const g = data[srcIdx + 1] / 127.5 - 1.0;
      const b = data[srcIdx + 2] / 127.5 - 1.0;

      const dstIdx = (y * targetSize + x) * 3;
      resized[dstIdx] = r;
      resized[dstIdx + 1] = g;
      resized[dstIdx + 2] = b;
    }
  }

  return resized;
}

/**
 * Estimate board vector from keypoints or tracker
 * Fallback: use homography/contour detection if board KP model not available
 */
export function estimateBoardVector(
  frame: CapturedFrame,
  boardKeypoints?: Array<{ x: number; y: number }>,
): { angle: number; pitch: number; yaw: number } | null {
  // If board keypoints available (nose, tail, truck L/R)
  if (boardKeypoints && boardKeypoints.length >= 4) {
    const [nose, tail, truckL, truckR] = boardKeypoints;

    // Calculate roll angle (rotation around long axis)
    const boardVector = {
      x: tail.x - nose.x,
      y: tail.y - nose.y,
    };
    const roll = Math.atan2(boardVector.y, boardVector.x) * (180 / Math.PI);

    // Estimate pitch (from truck heights)
    const avgTruckY = (truckL.y + truckR.y) / 2;
    const avgNoseTailY = (nose.y + tail.y) / 2;
    const pitch = (avgTruckY - avgNoseTailY) / frame.data.width * 90; // rough estimate

    // Yaw (rotation around vertical) - simplified
    const yaw = 0; // Would need depth info

    return { angle: roll, pitch, yaw };
  }

  // Fallback: basic estimation from ankle keypoints (if rider detected)
  // This is a placeholder - in production, use trained board KP model
  return null;
}

