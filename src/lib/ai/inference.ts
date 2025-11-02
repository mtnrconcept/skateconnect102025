/**
 * AI inference services using ONNX Runtime Web
 * Handles MoveNet (pose) and TCN (trick classification) models
 */

// Mock implementations for now - replace with actual ONNX Runtime when models are ready
// In production, these will use onnxruntime-web

export interface PoseKeypoint {
  x: number;
  y: number;
  confidence: number;
  name?: string;
}

export interface InferenceResult {
  keypoints: PoseKeypoint[];
  boardKeypoints?: Array<{ x: number; y: number; confidence: number }>;
  boardVector: { angle: number; pitch: number; yaw: number } | null;
  trickPrediction?: string;
  confidence: number;
}

let poseModel: any = null;
let trickModel: any = null;

/**
 * Initialize MoveNet pose model
 * In production: load from /models/movenet-lite.onnx
 */
export async function initializePoseModel(): Promise<any> {
  if (poseModel) return poseModel;

  // TODO: Replace with actual ONNX Runtime loading
  // import * as ort from 'onnxruntime-web';
  // poseModel = await ort.InferenceSession.create('/models/movenet-lite.onnx');

  // Mock model for development
  poseModel = {
    type: 'movenet-lite',
    ready: true,
  };

  console.log('Pose model initialized (mock)');
  return poseModel;
}

/**
 * Initialize trick classification TCN model
 * In production: load from /models/trick-tcn.onnx
 */
export async function initializeTrickModel(): Promise<any> {
  if (trickModel) return trickModel;

  // TODO: Replace with actual ONNX Runtime loading
  // import * as ort from 'onnxruntime-web';
  // trickModel = await ort.InferenceSession.create('/models/trick-tcn.onnx');

  // Mock model for development
  trickModel = {
    type: 'trick-tcn',
    ready: true,
  };

  console.log('Trick model initialized (mock)');
  return trickModel;
}

/**
 * Run inference on a single frame
 */
export async function inferFrame(
  poseModel: any,
  trickModel: any,
  tensor: Float32Array,
  frameIndex: number,
): Promise<InferenceResult> {
  if (!poseModel || !trickModel) {
    throw new Error('Models not initialized');
  }

  // TODO: Replace with actual ONNX inference
  // const poseInput = new ort.Tensor('float32', tensor, [1, 192, 192, 3]);
  // const poseOutput = await poseModel.run({ input: poseInput });
  // const keypoints = postprocessPose(poseOutput);

  // Mock inference for development
  const mockKeypoints = generateMockKeypoints();
  const mockBoardVector = { angle: Math.random() * 360, pitch: 0, yaw: 0 };

  return {
    keypoints: mockKeypoints,
    boardVector: mockBoardVector,
    confidence: 0.5 + Math.random() * 0.5, // Mock confidence
  };
}

/**
 * Generate mock keypoints for development
 * Remove in production
 */
function generateMockKeypoints(): PoseKeypoint[] {
  const numKeypoints = 17; // COCO format
  const keypoints: PoseKeypoint[] = [];

  for (let i = 0; i < numKeypoints; i++) {
    keypoints.push({
      x: 0.3 + Math.random() * 0.4,
      y: 0.3 + Math.random() * 0.4,
      confidence: 0.6 + Math.random() * 0.4,
    });
  }

  return keypoints;
}

/**
 * Extract temporal features from a sequence of frames
 * Used for sliding window analysis
 */
export function extractFeatures(
  keypointSequence: Array<{
    frameIndex: number;
    timestamp: number;
    keypoints: PoseKeypoint[];
    boardVector: { angle: number; pitch: number; yaw: number } | null;
  }>,
): Float32Array {
  // Normalize features:
  // - Distances between key body parts
  // - Angles (ankle, knee, hip)
  // - Velocities (change over time)
  // - Board vectors (roll, pitch, yaw)

  const features: number[] = [];

  if (keypointSequence.length < 2) {
    return new Float32Array(0);
  }

  // Extract distances (ankle-to-ankle, knee-to-knee, etc.)
  for (const frame of keypointSequence) {
    if (frame.keypoints.length >= 16) {
      const leftAnkle = frame.keypoints[15];
      const rightAnkle = frame.keypoints[16];
      const leftKnee = frame.keypoints[13];
      const rightKnee = frame.keypoints[14];

      if (leftAnkle && rightAnkle) {
        const ankleDist = Math.sqrt(
          Math.pow(leftAnkle.x - rightAnkle.x, 2) +
          Math.pow(leftAnkle.y - rightAnkle.y, 2),
        );
        features.push(ankleDist);
      }

      if (leftKnee && rightKnee) {
        const kneeDist = Math.sqrt(
          Math.pow(leftKnee.x - rightKnee.x, 2) +
          Math.pow(leftKnee.y - rightKnee.y, 2),
        );
        features.push(kneeDist);
      }
    }
  }

  // Extract velocities (change in keypoint positions)
  for (let i = 1; i < keypointSequence.length; i++) {
    const prev = keypointSequence[i - 1];
    const curr = keypointSequence[i];
    const dt = curr.timestamp - prev.timestamp;

    if (dt > 0 && curr.keypoints.length > 0 && prev.keypoints.length > 0) {
      const centerX = curr.keypoints[0]?.x || 0;
      const centerY = curr.keypoints[0]?.y || 0;
      const prevCenterX = prev.keypoints[0]?.x || 0;
      const prevCenterY = prev.keypoints[0]?.y || 0;

      const vx = (centerX - prevCenterX) / dt;
      const vy = (centerY - prevCenterY) / dt;
      features.push(vx, vy);
    }
  }

  // Extract board angles
  for (const frame of keypointSequence) {
    if (frame.boardVector) {
      features.push(frame.boardVector.angle / 360, frame.boardVector.pitch / 90, frame.boardVector.yaw / 180);
    } else {
      features.push(0, 0, 0);
    }
  }

  return new Float32Array(features);
}

