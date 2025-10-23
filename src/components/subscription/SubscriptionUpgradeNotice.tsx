import { XCircle, ArrowUpRight } from 'lucide-react';
import { getPlanDefinition, getPlanLabel, type SubscriptionPlan } from '../../lib/subscription';
import type { RestrictionNotice } from '../../contexts/SubscriptionContext';

interface SubscriptionUpgradeNoticeProps {
  notice: RestrictionNotice;
  currentPlan: SubscriptionPlan;
  onClose: () => void;
  onSimulateUpgrade: (plan: SubscriptionPlan) => void;
  onViewPricing: () => void;
}

export default function SubscriptionUpgradeNotice({
  notice,
  currentPlan,
  onClose,
  onSimulateUpgrade,
  onViewPricing,
}: SubscriptionUpgradeNoticeProps) {
  const requiredPlan = notice.requiredPlan;
  const currentPlanLabel = getPlanLabel(currentPlan);
  const requiredPlanDefinition = getPlanDefinition(requiredPlan);

  return (
    <div className="fixed inset-x-0 top-4 z-[60] px-4 md:px-0">
      <div className="mx-auto max-w-3xl rounded-3xl border border-orange-500/40 bg-dark-900/95 shadow-2xl backdrop-blur p-6 md:p-7 text-white">
        <div className="flex items-start gap-4">
          <span className="mt-1 rounded-full bg-orange-500/20 text-orange-400 p-2">
            <XCircle size={24} />
          </span>
          <div className="flex-1 space-y-2">
            <p className="text-sm uppercase tracking-widest text-orange-400/80">Accès limité</p>
            <p className="text-lg font-semibold leading-relaxed">{notice.message}</p>
            <p className="text-sm text-gray-400">
              Tu es actuellement en mode <span className="font-medium text-gray-200">{currentPlanLabel}</span>. Active le mode{' '}
              <span className="font-medium text-orange-300">{requiredPlanDefinition.label}</span> pour débloquer cette fonctionnalité.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => onSimulateUpgrade(requiredPlan)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400 px-5 py-2.5 text-sm font-semibold text-dark-900 shadow-lg shadow-orange-500/30 transition hover:brightness-105"
              >
                Simuler {requiredPlanDefinition.label}
                <ArrowUpRight size={18} />
              </button>
              <button
                type="button"
                onClick={onViewPricing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-dark-600/70 bg-dark-800/70 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:border-orange-500/50 hover:text-white"
              >
                Voir les abonnements
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-transparent px-5 py-2.5 text-sm font-medium text-gray-400 transition hover:text-white"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
