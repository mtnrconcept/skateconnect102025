import type { SponsorPlannerStatus } from '../../../types';

export const SPONSOR_PLANNER_STATUS_ORDER: SponsorPlannerStatus[] = [
  'idea',
  'briefing',
  'production',
  'promotion',
  'live',
  'archived',
];

export const SPONSOR_PLANNER_STATUS_META: Record<
  SponsorPlannerStatus,
  { label: string; description: string; color: string }
> = {
  idea: {
    label: 'Idées',
    description: 'Concepts à explorer ou à prioriser.',
    color: 'bg-slate-900/70 border border-slate-700/80 text-slate-100',
  },
  briefing: {
    label: 'Brief',
    description: 'Alignement interne et cadrage du programme.',
    color: 'bg-sky-900/60 border border-sky-600/40 text-sky-100',
  },
  production: {
    label: 'Production',
    description: 'Création des assets et préparation opérationnelle.',
    color: 'bg-indigo-900/60 border border-indigo-600/40 text-indigo-100',
  },
  promotion: {
    label: 'Activation',
    description: 'Promotion auprès des riders & communautés.',
    color: 'bg-amber-900/60 border border-amber-600/40 text-amber-100',
  },
  live: {
    label: 'En ligne',
    description: 'Campagne en cours auprès du public.',
    color: 'bg-emerald-900/60 border border-emerald-600/40 text-emerald-100',
  },
  archived: {
    label: 'Clôturé',
    description: 'Initiative terminée ou archivée.',
    color: 'bg-slate-900/80 border border-slate-700/70 text-slate-200',
  },
};
