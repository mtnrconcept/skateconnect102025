/**
 * Storage utilities for AI analysis data (Supabase)
 */

import { supabase } from '../supabase.js';

export interface AISessionParams {
  sessionId?: string;
  matchId?: string;
  turnId?: string;
  userId?: string;
  trickRequested?: string;
  state?: 'idle' | 'capturing' | 'analyzing' | 'validated' | 'failed';
  confidence?: number;
  detectedTrick?: string;
}

export interface KeypointData {
  frameIndex: number;
  timestampMs: number;
  riderKeypoints: any;
  boardKeypoints?: any;
  boardAngleRoll: number;
  boardAnglePitch: number;
  boardAngleYaw: number;
}

export interface FeatureData {
  windowStartFrame: number;
  windowEndFrame: number;
  windowDurationMs: number;
  featuresVector: any;
  trickPrediction?: string;
  predictionConfidence?: number;
}

export interface ValidationData {
  trickRequested: string;
  trickDetected: string;
  isValid: boolean;
  validationScore: number;
  criteria: any;
  failureReasons: string[];
  stabilityDurationMs?: number;
  rotationAngleDeg?: number;
  footContactCount?: number;
}

/**
 * Save or update AI session
 */
export async function saveAISession(params: AISessionParams): Promise<{ id: string }> {
  if (params.sessionId) {
    // Update existing session
    const { data, error } = await supabase
      .from('skate_ai_sessions')
      .update({
        state: params.state,
        confidence_score: params.confidence,
        detected_trick: params.detectedTrick,
        updated_at: new Date().toISOString(),
        ...(params.state === 'validated' || params.state === 'failed'
          ? { completed_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', params.sessionId)
      .select('id')
      .single();

    if (error) throw error;
    return { id: params.sessionId };
  } else {
    // Create new session
    const { data, error } = await supabase
      .from('skate_ai_sessions')
      .insert({
        match_id: params.matchId,
        turn_id: params.turnId,
        user_id: params.userId,
        trick_requested: params.trickRequested,
        state: params.state || 'capturing',
      })
      .select('id')
      .single();

    if (error) throw error;
    return { id: data.id };
  }
}

/**
 * Save keypoints for a frame
 */
export async function saveKeypoints(sessionId: string, keypoint: KeypointData): Promise<void> {
  const { error } = await supabase.from('skate_ai_keypoints').insert({
    session_id: sessionId,
    frame_index: keypoint.frameIndex,
    timestamp_ms: keypoint.timestampMs,
    rider_keypoints: keypoint.riderKeypoints,
    board_keypoints: keypoint.boardKeypoints || null,
    board_angle_roll: keypoint.boardAngleRoll,
    board_angle_pitch: keypoint.boardAnglePitch,
    board_angle_yaw: keypoint.boardAngleYaw,
  });

  if (error) {
    console.error('Failed to save keypoints:', error);
    // Don't throw - non-critical for MVP
  }
}

/**
 * Save features for a temporal window
 */
export async function saveFeatures(sessionId: string, features: FeatureData): Promise<void> {
  const { error } = await supabase.from('skate_ai_features').insert({
    session_id: sessionId,
    window_start_frame: features.windowStartFrame,
    window_end_frame: features.windowEndFrame,
    window_duration_ms: features.windowDurationMs,
    features_vector: features.featuresVector,
    trick_prediction: features.trickPrediction || null,
    prediction_confidence: features.predictionConfidence || 0,
  });

  if (error) {
    console.error('Failed to save features:', error);
    // Don't throw - non-critical for MVP
  }
}

/**
 * Save validation result
 */
export async function saveValidation(sessionId: string, validation: ValidationData): Promise<void> {
  const { error } = await supabase.from('skate_ai_validations').insert({
    session_id: sessionId,
    trick_requested: validation.trickRequested,
    trick_detected: validation.trickDetected,
    is_valid: validation.isValid,
    validation_score: validation.validationScore,
    criteria: validation.criteria,
    failure_reasons: validation.failureReasons,
    stability_duration_ms: validation.stabilityDurationMs || null,
    rotation_angle_deg: validation.rotationAngleDeg || null,
    foot_contact_count: validation.footContactCount || null,
  });

  if (error) {
    console.error('Failed to save validation:', error);
    throw error;
  }
}








