import { Check, TestTube2 } from 'lucide-react';
import { subscriptionPlans, type SubscriptionPlan, getPlanLabel } from '../../lib/subscription';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface SubscriptionPlanTesterProps {
  className?: string;
}

const modesHelperText =
  "Active un mode d’abonnement en un clic pour vérifier l’accès aux sections sans lancer de paiement.";

export default function SubscriptionPlanTester({ className }: SubscriptionPlanTesterProps) {
  const { plan, setPlan } = useSubscription();

  const handleSelect = (value: SubscriptionPlan) => {
    setPlan(value);
  };

  return (
    <section className={`bg-dark-800 border border-dark-700 rounded-3xl p-6 md:p-7 space-y-6 ${className ?? ''}`}>
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-orange-500/15 text-orange-400 p-3">
            <TestTube2 size={22} />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-white">Tester les abonnements</h2>
            <p className="text-sm text-gray-400">{modesHelperText}</p>
          </div>
        </div>
        <div className="text-sm text-gray-400 bg-dark-900/70 border border-dark-700 rounded-2xl px-4 py-2">
          Mode actif : <span className="text-white font-medium">{getPlanLabel(plan)}</span>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {subscriptionPlans.map((candidate) => {
          const isActive = candidate.id === plan;
          const gradient = `bg-gradient-to-r ${candidate.accentColor}`;
          return (
            <button
              key={candidate.id}
              type="button"
              onClick={() => handleSelect(candidate.id)}
              className={`relative overflow-hidden rounded-3xl border transition-all text-left ${
                isActive
                  ? `border-transparent ${gradient} text-dark-900 shadow-lg shadow-orange-500/20`
                  : 'border-dark-700 bg-dark-900/60 text-gray-200 hover:border-orange-500/40 hover:text-white'
              }`}
              aria-pressed={isActive}
            >
              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold">{candidate.label}</p>
                  {isActive && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-dark-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      <Check size={16} /> Actif
                    </span>
                  )}
                </div>
                <p className={`text-sm ${isActive ? 'text-dark-900/80' : 'text-gray-400'}`}>{candidate.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
