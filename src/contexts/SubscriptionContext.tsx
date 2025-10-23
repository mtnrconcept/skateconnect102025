import { createContext, useContext } from 'react';
import type { Section } from '../types';
import type { SubscriptionPlan } from '../lib/subscription';

export interface RestrictionNotice {
  target: Section;
  requiredPlan: SubscriptionPlan;
  message: string;
}

export interface SubscriptionContextValue {
  plan: SubscriptionPlan;
  setPlan: (plan: SubscriptionPlan) => void;
  lastRestriction: RestrictionNotice | null;
  setRestriction: (notice: RestrictionNotice | null) => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({
  value,
  children,
}: {
  value: SubscriptionContextValue;
  children: React.ReactNode;
}) {
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription doit être utilisé dans un SubscriptionProvider');
  }

  return context;
}
