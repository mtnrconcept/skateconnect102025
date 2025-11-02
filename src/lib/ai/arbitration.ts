/**
 * AI arbitration logic for trick validation
 * Implements state machine: SET → ATTEMPT → LAND → VALID/FAIL
 */

import type { TrickValidation } from '../../components/skate/GameOfSkateAI';

export interface FrameData {
  frameIndex: number;
  timestamp: number;
  keypoints: Array<{ x: number; y: number; confidence: number }>;
  boardVector: { angle: number; pitch: number; yaw: number } | null;
  trickPrediction?: string;
  confidence?: number;
}

type ArbitrationState = 'SET' | 'ATTEMPT' | 'LAND' | 'VALID' | 'FAIL';

interface TrickRules {
  requiredRotation?: number; // degrees (e.g., 360 for kickflip)
  minRotation?: number;
  maxRotation?: number;
  requiredFootContacts?: number;
  minStabilityDuration?: number; // ms
  requiresCatch?: boolean;
}

const TRICK_RULES: Record<string, TrickRules> = {
  ollie: {
    minRotation: 0,
    maxRotation: 30,
    requiredFootContacts: 2,
    minStabilityDuration: 250,
    requiresCatch: false,
  },
  'pop-shove-it': {
    requiredRotation: 180,
    minRotation: 160,
    maxRotation: 200,
    requiredFootContacts: 2,
    minStabilityDuration: 300,
    requiresCatch: true,
  },
  kickflip: {
    requiredRotation: 360,
    minRotation: 320,
    maxRotation: 420,
    requiredFootContacts: 2,
    minStabilityDuration: 250,
    requiresCatch: true,
  },
  heelflip: {
    requiredRotation: 360,
    minRotation: 320,
    maxRotation: 420,
    requiredFootContacts: 2,
    minStabilityDuration: 250,
    requiresCatch: true,
  },
  'shove-it': {
    requiredRotation: 180,
    minRotation: 160,
    maxRotation: 200,
    requiredFootContacts: 2,
    minStabilityDuration: 300,
    requiresCatch: false,
  },
  '180-front': {
    requiredRotation: 180,
    minRotation: 160,
    maxRotation: 200,
    requiredFootContacts: 2,
    minStabilityDuration: 300,
    requiresCatch: false,
  },
  '180-back': {
    requiredRotation: 180,
    minRotation: 160,
    maxRotation: 200,
    requiredFootContacts: 2,
    minStabilityDuration: 300,
    requiresCatch: false,
  },
};

/**
 * Validate a trick based on frame sequence
 */
export async function validateTrick(
  frameSequence: FrameData[],
  trickRequested: string,
  sessionId: string,
): Promise<TrickValidation> {
  if (frameSequence.length < 10) {
    return {
      isValid: false,
      confidence: 0,
      detectedTrick: 'unknown',
      criteria: {
        pop: false,
        rotation: false,
        catch: false,
        stability: false,
        footContact: false,
      },
      failureReasons: ['Séquence trop courte pour analyse'],
    };
  }

  const rules = TRICK_RULES[trickRequested.toLowerCase()] || TRICK_RULES.ollie;
  const failureReasons: string[] = [];

  // Detect phases: SET → ATTEMPT → LAND
  const phases = detectPhases(frameSequence);
  if (!phases.set || !phases.attempt || !phases.land) {
    failureReasons.push('Phases du trick incomplètes (set/attempt/land)');
  }

  // Check pop (initial board angle change)
  const popDetected = detectPop(frameSequence, phases);
  if (!popDetected) {
    failureReasons.push('Pop insuffisant (décollage faible)');
  }

  // Check rotation
  const rotationResult = checkRotation(frameSequence, phases, rules);
  if (!rotationResult.valid) {
    failureReasons.push(rotationResult.reason || 'Rotation incomplète ou incorrecte');
  }

  // Check catch (foot contact post-rotation)
  const catchResult = checkCatch(frameSequence, phases, rules);
  if (rules.requiresCatch && !catchResult.valid) {
    failureReasons.push('Catch manqué (pas de contact pieds post-rotation)');
  }

  // Check stability (post-landing)
  const stabilityResult = checkStability(frameSequence, phases, rules);
  if (!stabilityResult.valid) {
    failureReasons.push(`Stabilité insuffisante (minimum ${rules.minStabilityDuration}ms requis)`);
  }

  // Overall confidence (weighted)
  const confidence =
    (popDetected ? 0.2 : 0) +
    (rotationResult.valid ? 0.3 : 0) +
    (catchResult.valid ? 0.2 : 0) +
    (stabilityResult.valid ? 0.3 : 0);

  const isValid = failureReasons.length === 0 && confidence >= 0.7;

  return {
    isValid,
    confidence: Math.min(1.0, confidence),
    detectedTrick: rotationResult.detectedTrick || trickRequested,
    criteria: {
      pop: popDetected,
      rotation: rotationResult.valid,
      catch: catchResult.valid,
      stability: stabilityResult.valid,
      footContact: catchResult.footContacts >= (rules.requiredFootContacts || 2),
    },
    failureReasons,
    rotationAngle: rotationResult.angle,
    stabilityDuration: stabilityResult.duration,
  };
}

interface TrickPhases {
  set?: { start: number; end: number };
  attempt?: { start: number; peak: number; end: number };
  land?: { start: number; end: number };
}

function detectPhases(sequence: FrameData[]): TrickPhases {
  // Simple heuristic: use board angle changes and keypoint velocities
  const phases: TrickPhases = {};

  // SET: low velocity, stable board
  for (let i = 0; i < sequence.length * 0.3; i++) {
    const frame = sequence[i];
    // Check for low velocity (simplified)
    phases.set = { start: 0, end: i };
  }

  // ATTEMPT: high velocity, board angle changes rapidly
  const attemptStart = phases.set?.end || 0;
  const attemptEnd = Math.min(sequence.length * 0.7, sequence.length - 1);
  phases.attempt = {
    start: attemptStart,
    peak: Math.floor((attemptStart + attemptEnd) / 2),
    end: attemptEnd,
  };

  // LAND: velocity decreases, stability increases
  phases.land = {
    start: attemptEnd,
    end: sequence.length - 1,
  };

  return phases;
}

function detectPop(sequence: FrameData[], phases: TrickPhases): boolean {
  if (!phases.attempt) return false;

  const attemptStart = phases.attempt.start;
  const peak = phases.attempt.peak;

  // Check for rapid board angle change (pop indicator)
  if (attemptStart < peak && peak < sequence.length) {
    const initialAngle = sequence[attemptStart]?.boardVector?.angle || 0;
    const peakAngle = sequence[peak]?.boardVector?.angle || 0;
    const angleChange = Math.abs(peakAngle - initialAngle);

    return angleChange > 20; // Threshold for pop detection
  }

  return false;
}

interface RotationCheckResult {
  valid: boolean;
  angle?: number;
  detectedTrick?: string;
  reason?: string;
}

function checkRotation(
  sequence: FrameData[],
  phases: TrickPhases,
  rules: TrickRules,
): RotationCheckResult {
  if (!phases.attempt || !rules.requiredRotation) {
    return { valid: true }; // No rotation required
  }

  const start = phases.attempt.start;
  const end = phases.attempt.end;

  let maxRotation = 0;
  let initialAngle = sequence[start]?.boardVector?.angle || 0;

  for (let i = start; i <= end && i < sequence.length; i++) {
    const angle = sequence[i]?.boardVector?.angle || 0;
    const rotation = Math.abs(angle - initialAngle);
    maxRotation = Math.max(maxRotation, rotation);
  }

  const valid =
    maxRotation >= (rules.minRotation || 0) &&
    maxRotation <= (rules.maxRotation || 720);

  return {
    valid,
    angle: maxRotation,
    reason: valid ? undefined : `Rotation ${maxRotation}° hors limites [${rules.minRotation}-${rules.maxRotation}°]`,
  };
}

interface CatchCheckResult {
  valid: boolean;
  footContacts: number;
}

function checkCatch(
  sequence: FrameData[],
  phases: TrickPhases,
  rules: TrickRules,
): CatchCheckResult {
  if (!phases.land) {
    return { valid: false, footContacts: 0 };
  }

  // Count foot contacts in landing phase
  let footContacts = 0;
  for (let i = phases.land.start; i <= phases.land.end && i < sequence.length; i++) {
    const frame = sequence[i];
    // Check ankle keypoints proximity to board (simplified)
    if (frame.keypoints.length >= 16) {
      const leftAnkle = frame.keypoints[15];
      const rightAnkle = frame.keypoints[16];

      // Heuristic: if ankles are in lower 30% of frame, consider contact
      if (leftAnkle && leftAnkle.y > 0.7 && leftAnkle.confidence > 0.6) {
        footContacts++;
      }
      if (rightAnkle && rightAnkle.y > 0.7 && rightAnkle.confidence > 0.6) {
        footContacts++;
      }
    }
  }

  const required = rules.requiredFootContacts || 2;
  return {
    valid: footContacts >= required,
    footContacts,
  };
}

interface StabilityCheckResult {
  valid: boolean;
  duration?: number;
}

function checkStability(
  sequence: FrameData[],
  phases: TrickPhases,
  rules: TrickRules,
): StabilityCheckResult {
  if (!phases.land) {
    return { valid: false };
  }

  const minStability = rules.minStabilityDuration || 300;
  const landDuration = (sequence[phases.land.end]?.timestamp || 0) - (sequence[phases.land.start]?.timestamp || 0);

  // Check for stable board angle (low variance in landing phase)
  let angleVariance = 0;
  const angles: number[] = [];
  for (let i = phases.land.start; i <= phases.land.end && i < sequence.length; i++) {
    const angle = sequence[i]?.boardVector?.angle || 0;
    angles.push(angle);
  }

  if (angles.length > 0) {
    const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
    angleVariance = angles.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / angles.length;
  }

  const isStable = angleVariance < 50 && landDuration >= minStability;

  return {
    valid: isStable,
    duration: landDuration,
  };
}

