import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { TrickValidation } from './GameOfSkateAI';

interface TrickFeedbackPanelProps {
  validation: TrickValidation;
  trickRequested: string;
}

export default function TrickFeedbackPanel({ validation, trickRequested }: TrickFeedbackPanelProps) {
  const { criteria, failureReasons, confidence, detectedTrick } = validation;

  return (
    <div className="mt-4 space-y-3">
      {/* Overall result */}
      <div
        className={`p-4 rounded-lg border ${
          validation.isValid
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {validation.isValid ? (
              <CheckCircle2 className="text-emerald-400" size={24} />
            ) : (
              <XCircle className="text-red-400" size={24} />
            )}
            <span className="text-white font-semibold text-lg">
              {validation.isValid ? 'Trick validé !' : 'Trick non validé'}
            </span>
          </div>
          <span className="text-gray-300 text-sm">
            {Math.round(confidence * 100)}% confiance
          </span>
        </div>
        <div className="text-sm text-gray-400">
          Détecté: <span className="text-white font-medium">{detectedTrick}</span> | Demandé:{' '}
          <span className="text-white font-medium">{trickRequested}</span>
        </div>
      </div>

      {/* Criteria checklist */}
      <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-orange-400" />
          Critères d'évaluation
        </h4>
        <div className="space-y-2">
          <CriterionCheck
            label="Pop (décollage)"
            passed={criteria.pop}
          />
          <CriterionCheck
            label="Rotation complète"
            passed={criteria.rotation}
            value={validation.rotationAngle ? `${Math.round(validation.rotationAngle)}°` : undefined}
          />
          <CriterionCheck
            label="Catch (récupération)"
            passed={criteria.catch}
          />
          <CriterionCheck
            label="Stabilité (0.3s min)"
            passed={criteria.stability}
            value={validation.stabilityDuration ? `${validation.stabilityDuration}ms` : undefined}
          />
          <CriterionCheck
            label="Contact pieds"
            passed={criteria.footContact}
          />
        </div>
      </div>

      {/* Failure reasons */}
      {!validation.isValid && failureReasons.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <h4 className="text-red-400 font-semibold mb-2">Raisons de l'échec:</h4>
          <ul className="space-y-1">
            {failureReasons.map((reason, idx) => (
              <li key={idx} className="text-sm text-red-300 flex items-start gap-2">
                <span className="text-red-400">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CriterionCheck({ label, passed, value }: { label: string; passed: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {passed ? (
          <CheckCircle2 className="text-emerald-400" size={18} />
        ) : (
          <XCircle className="text-red-400" size={18} />
        )}
        <span className={`text-sm ${passed ? 'text-white' : 'text-gray-400'}`}>{label}</span>
      </div>
      {value && <span className="text-xs text-gray-500">{value}</span>}
    </div>
  );
}

