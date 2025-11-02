import { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Video, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { Profile, SkateMatchRow, SkateTurnRow } from '../../types';
import { captureVideoFrame, preprocessFrame } from '../../lib/ai/videoCapture';
import { initializePoseModel, initializeTrickModel, inferFrame } from '../../lib/ai/inference';
import { validateTrick } from '../../lib/ai/arbitration';
import { saveAISession, saveKeypoints, saveFeatures, saveValidation } from '../../lib/ai/storage';
import PoseOverlay from './PoseOverlay';
import TrickFeedbackPanel from './TrickFeedbackPanel';

interface GameOfSkateAIProps {
  match: SkateMatchRow;
  turn: SkateTurnRow;
  profile: Profile;
  trickRequested: string;
  onTrickValidated: (isValid: boolean, sessionId: string) => void;
  onError: (error: string) => void;
}

export type AIAnalysisState = 'idle' | 'capturing' | 'analyzing' | 'validated' | 'failed';

export type TrickValidation = {
  detectedTrick: string | null;
  confidence: number;
  isValid: boolean;
};

export type ValidationData = {
  trickRequested: string;
  trickDetected: string | null;
  validationScore: number;
};


export default function GameOfSkateAI({
  match,
  turn,
  profile,
  trickRequested,
  onTrickValidated,
  onError,
}: GameOfSkateAIProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [state, setState] = useState<AIAnalysisState>('idle');
  const [confidence, setConfidence] = useState(0);
  const [detectedTrick, setDetectedTrick] = useState<string | null>(null);
  const [keypoints, setKeypoints] = useState<any[]>([]);
  const [boardVector, setBoardVector] = useState<{ angle: number; pitch: number; yaw: number } | null>(null);
  const [validation, setValidation] = useState<TrickValidation | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [frameBuffer, setFrameBuffer] = useState<any[]>([]);

  const poseModelRef = useRef<any>(null);
  const trickModelRef = useRef<any>(null);

  // Initialize models on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const poseModel = await initializePoseModel();
        const trickModel = await initializeTrickModel();
        if (mounted) {
          poseModelRef.current = poseModel;
          trickModelRef.current = trickModel;
        }
      } catch (error) {
        console.error('Failed to initialize AI models:', error);
        if (mounted) onError('Impossible de charger les modèles IA. Vérifiez votre connexion.');
      }
    })();
    return () => { mounted = false; };
  }, [onError]);

  const startCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: 30 },
        audio: false,
      });

      if (!videoRef.current) return;

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setState('capturing');

      // Create session
      const session = await saveAISession({
        matchId: match.id,
        turnId: turn.id,
        userId: profile.id,
        trickRequested,
      });
      setSessionId(session.id);

      let frameCount = 0;
      let lastTime = performance.now();
      const targetFps = 15; // Sample at 12-15 fps
      const frameInterval = 1000 / targetFps;

      const processFrame = async () => {
        if (!videoRef.current || !canvasRef.current || state !== 'capturing') return;

        const now = performance.now();
        if (now - lastTime < frameInterval) {
          animationFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }

        lastTime = now;
        frameCount++;

        const frame = captureVideoFrame(videoRef.current, canvasRef.current);
        if (!frame) {
          animationFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }

        // Preprocess and infer
        const tensor = preprocessFrame(frame);
        const result = await inferFrame(
          poseModelRef.current,
          trickModelRef.current,
          tensor,
          frameCount,
        );

        if (result.keypoints) {
          setKeypoints(result.keypoints);
          setBoardVector(result.boardVector);

          // Accumulate features in buffer (sliding window 1.5-2.5s)
          const newFrameData = {
            frameIndex: frameCount,
            timestamp: now,
            keypoints: result.keypoints,
            boardVector: result.boardVector,
            trickPrediction: result.trickPrediction,
            confidence: result.confidence,
          };

          setFrameBuffer((prev) => {
            const windowSize = targetFps * 2; // ~2 seconds
            const updated = [...prev, newFrameData].slice(-windowSize);
            return updated;
          });

          // Save keypoints
          if (sessionId) {
            await saveKeypoints(sessionId, {
              frameIndex: frameCount,
              timestampMs: Math.round(now),
              riderKeypoints: result.keypoints,
              boardKeypoints: result.boardKeypoints || null,
              boardAngleRoll: result.boardVector?.angle || 0,
              boardAnglePitch: result.boardVector?.pitch || 0,
              boardAngleYaw: result.boardVector?.yaw || 0,
            });
          }

          setFps(Math.round(1000 / (now - lastTime)));
        }

        animationFrameRef.current = requestAnimationFrame(processFrame);
      };

      animationFrameRef.current = requestAnimationFrame(processFrame);
    } catch (error) {
      console.error('Failed to start capture:', error);
      onError('Impossible d\'accéder à la caméra.');
    }
  }, [match.id, turn.id, profile.id, trickRequested, state, sessionId, onError]);

  const stopCaptureAndAnalyze = useCallback(async () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setState('analyzing');

    // Wait a bit for final features
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Validate trick
    if (sessionId && frameBuffer.length > 0) {
      try {
        const validationResult = await validateTrick(
          frameBuffer,
          trickRequested,
          sessionId,
        );

        setValidation(validationResult);

        // Save validation
        await saveValidation({
          sessionId,
          result: {
            ...validationResult,
            trickRequested,                // le trick que le joueur devait faire
            trickDetected: validationResult.detectedTrick ?? null,  // ce que l’IA a reconnu
            validationScore: validationResult.confidence ?? 0       // score de confiance
          }
        });
        


        // Update session
        if (sessionId) {
          await saveAISession({
            sessionId,
            state: validationResult.isValid ? 'validated' : 'failed',
            confidence: validationResult.confidence,
            detectedTrick: validationResult.detectedTrick,
          });
        }

        setState(validationResult.isValid ? 'validated' : 'failed');
        onTrickValidated(validationResult.isValid, sessionId);
      } catch (error) {
        console.error('Validation failed:', error);
        setState('failed');
        onError('Erreur lors de l\'analyse.');
      }
    }
  }, [sessionId, frameBuffer, trickRequested, onTrickValidated, onError]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="relative bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
      {/* Video container with overlay */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        <PoseOverlay
          keypoints={keypoints}
          boardVector={boardVector}
          show={state === 'capturing' || state === 'analyzing'}
        />
        {/* Status overlay */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <div className="bg-dark-900/80 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
            <Brain className="text-orange-400" size={20} />
            <span className="text-white font-semibold">
              {state === 'capturing' && 'Enregistrement...'}
              {state === 'analyzing' && 'Analyse IA...'}
              {state === 'validated' && '✓ Validé'}
              {state === 'failed' && '✗ Échec'}
            </span>
          </div>
          {state === 'capturing' && (
            <div className="bg-dark-900/80 backdrop-blur-sm rounded-lg px-4 py-2">
              <span className="text-gray-300 text-sm">{fps} fps</span>
            </div>
          )}
        </div>
        {/* Confidence bar */}
        {state === 'analyzing' && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-dark-900/80 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white text-sm font-medium">Confiance IA</span>
                <span className="text-orange-400 text-sm font-semibold">
                  {Math.round(confidence * 100)}%
                </span>
              </div>
              <div className="w-full bg-dark-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-orange-500 to-orange-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-dark-800 border-t border-dark-700">
        {state === 'idle' && (
          <button
            onClick={() => void startCapture()}
            className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Video size={20} />
            <span>Démarrer l'enregistrement</span>
          </button>
        )}
        {(state === 'capturing' || state === 'analyzing') && (
          <button
            onClick={() => void stopCaptureAndAnalyze()}
            disabled={state === 'analyzing'}
            className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {state === 'analyzing' ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Analyse en cours...</span>
              </>
            ) : (
              <>
                <XCircle size={20} />
                <span>Arrêter et analyser</span>
              </>
            )}
          </button>
        )}
        {validation && (
          <TrickFeedbackPanel validation={validation} trickRequested={trickRequested} />
        )}
      </div>

      {/* AI Judge toggle info */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <AlertCircle size={16} />
          <span>
            L'arbitre IA analyse ta performance en temps réel. La validation est automatique.
          </span>
        </div>
      </div>
    </div>
  );
}
