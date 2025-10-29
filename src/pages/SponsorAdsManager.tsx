import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Palette,
  Rocket,
  Sparkles,
  Target,
  Users,
  Wand2,
} from 'lucide-react';
import type { Profile } from '../types';
import type { Audience, CampaignDraft, EstimationResult, Objective } from '../types/ads';
import HelpTip from '../components/HelpTip';
import { useRouter } from '../lib/router';

interface SponsorAdsManagerProps {
  profile: Profile | null;
}

const steps = [
  {
    id: 0,
    title: 'Objectif & budget',
    description: 'Définis le résultat attendu et ton enveloppe.',
    icon: Target,
  },
  {
    id: 1,
    title: 'Audience & ciblage',
    description: 'Affûte ta diffusion selon les riders visés.',
    icon: Users,
  },
  {
    id: 2,
    title: 'Créatif & placements',
    description: 'Prépare le message sponsorisé et son rendu.',
    icon: Sparkles,
  },
] as const;

const objectives: Objective[] = [
  {
    id: 'awareness',
    name: 'Notoriété locale',
    description: 'Diffuse une présence régulière sur les spots clés pour faire vibrer la communauté.',
    recommendedBudget: '2 000€ – 4 500€',
    successMetrics: ['Couverture unique', 'Visites profil sponsor', 'Temps sur Spotlight'],
    reachMultiplier: 1.25,
    engagementMultiplier: 0.95,
  },
  {
    id: 'traffic',
    name: 'Drive-to-spot',
    description: 'Active les riders autour d’un événement physique ou d’une tournée de démos.',
    recommendedBudget: '3 500€ – 6 500€',
    successMetrics: ['Visites événement', 'Check-ins sur spot', 'Intentions de participation'],
    reachMultiplier: 1.1,
    engagementMultiplier: 1.15,
  },
  {
    id: 'conversion',
    name: 'Conversions shop',
    description: 'Amplifie les ventes produits avec des placements premium et des offres exclusives.',
    recommendedBudget: '4 500€ – 9 000€',
    successMetrics: ['Ajouts panier', 'Ventes attribuées', 'Valeur moyenne commande'],
    reachMultiplier: 0.9,
    engagementMultiplier: 1.3,
  },
];

const audiences: Audience[] = [
  {
    id: 'core-riders',
    name: 'Riders engagés (18-30 ans)',
    description: 'Skaters connectés quotidiennement, sensibles aux contenus culture skate.',
    sizeRange: '52 000 – 68 000 profils',
    profileHighlights: ['Sessions 4x/semaine', 'Consulte les spots urbains', 'Partage du contenu vidéo'],
    baseCpm: 12,
    baseCpc: 1.45,
    clickThroughRate: 0.015,
    reachRate: 0.62,
  },
  {
    id: 'city-crews',
    name: 'Crews urbains & collectifs',
    description: 'Collectifs qui organisent des lines et jams dans les grandes métropoles.',
    sizeRange: '25 000 – 32 000 profils',
    profileHighlights: ['Organisation d’événements', 'Usage intensif de la messagerie', 'Partage de playlists'],
    baseCpm: 14,
    baseCpc: 1.7,
    clickThroughRate: 0.018,
    reachRate: 0.54,
  },
  {
    id: 'newcomers',
    name: 'Nouveaux riders inspirés',
    description: 'Primo-pratiquants cherchant des marques référentes et des contenus pédagogiques.',
    sizeRange: '35 000 – 44 000 profils',
    profileHighlights: ['Sauvegarde de tutoriels', 'Achats in-app', 'Recherche de coaching'],
    baseCpm: 9,
    baseCpc: 1.2,
    clickThroughRate: 0.012,
    reachRate: 0.68,
  },
];

const placementOptions = [
  {
    id: 'spotlight',
    label: 'Spotlight carte',
    description: 'Pin sponsorisé sur la ShredMap avec itinéraires et métriques détaillées.',
  },
  {
    id: 'feed',
    label: 'Fil sponsor',
    description: 'Insertion native dans le feed riders avec CTA dynamique.',
  },
  {
    id: 'stories',
    label: 'Stories immersives',
    description: 'Format vertical optimisé mobile avec préchargement vidéo.',
  },
  {
    id: 'inbox',
    label: 'Message ciblé',
    description: 'Activation conversationnelle envoyée aux riders clés.',
  },
] as const;

const today = new Date();
const defaultStartDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
const defaultEndDate = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000);

const formatDate = (date: Date) => date.toISOString().split('T')[0] ?? '';

const defaultDraft: CampaignDraft = {
  name: 'Activation été urbain',
  objectiveId: objectives[0].id,
  audienceId: audiences[0].id,
  budget: 4500,
  startDate: formatDate(defaultStartDate),
  endDate: formatDate(defaultEndDate),
  placements: ['spotlight', 'feed', 'stories'],
  optimization: 'reach',
  creative: {
    format: 'image',
    headline: 'Ride la ville avec nous',
    subheadline: 'Session spéciale & coaching exclusif',
    message: "Rejoins notre crew pour une tournée nocturne sur les meilleurs spots urbains. Coaching pro et cadeaux riders.",
    callToAction: 'Réserver ma place',
    landingUrl: 'https://shredloc.app/campaigns/ride-city',
    tone: 'community',
    primaryColor: '#f97316',
    accentColor: '#0f172a',
  },
  frequencyCap: 3,
  locations: ['Paris', 'Lyon'],
  interests: ['Street skate', 'Vidéo créative', 'Contest local'],
  ageRange: [18, 32],
  notes: 'Mettre en avant le partenariat avec la scène locale et les coachs invités.',
};

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

function computeEstimation(draft: CampaignDraft, objective: Objective, audience: Audience): EstimationResult {
  const budget = Math.max(draft.budget, 1);
  const flightDays = Math.max(
    1,
    Math.round(
      (new Date(draft.endDate).getTime() - new Date(draft.startDate).getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  const placementMultiplier = 1 + draft.placements.length * 0.08;
  const optimizationMultiplier =
    draft.optimization === 'reach' ? 1.05 : draft.optimization === 'clicks' ? 1.12 : 1.18;

  const effectiveCpm = audience.baseCpm / (objective.reachMultiplier * placementMultiplier);
  const impressions = (budget / effectiveCpm) * 1000 * objective.reachMultiplier * optimizationMultiplier;
  const reach = impressions * audience.reachRate;
  const clicks = impressions * audience.clickThroughRate * objective.engagementMultiplier * optimizationMultiplier;
  const views = impressions * (draft.creative.format === 'video' ? 0.62 : 0.48);
  const engagements = clicks * (objective.id === 'awareness' ? 1.35 : 1.15);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpm = impressions > 0 ? (budget / impressions) * 1000 : effectiveCpm;
  const cpc = clicks > 0 ? budget / clicks : audience.baseCpc;

  let confidence: EstimationResult['confidence'] = 'medium';
  if (budget >= 6000 && draft.placements.length >= 3 && flightDays >= 21) {
    confidence = 'high';
  } else if (budget <= 2000 || draft.placements.length <= 1) {
    confidence = 'low';
  }

  const narrative = `Avec ${currencyFormatter.format(budget)} investis sur ${draft.placements.length} placement(s), la campagne devrait toucher environ ${numberFormatter.format(
    reach,
  )} riders qualifiés sur ${flightDays} jours.`;

  const highlights = [
    `${numberFormatter.format(reach)} riders atteints`,
    `${numberFormatter.format(clicks)} interactions sponsor estimées`,
    `${percentFormatter.format(ctr)} de CTR projeté`,
  ];

  return {
    reach,
    impressions,
    clicks,
    views,
    engagements,
    ctr,
    cpm,
    cpc,
    confidence,
    narrative,
    highlights,
  };
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function SponsorAdsManager({ profile }: SponsorAdsManagerProps) {
  const [step, setStep] = useState<(typeof steps)[number]['id']>(steps[0].id);
  const [draft, setDraft] = useState<CampaignDraft>(defaultDraft);
  const { navigate } = useRouter();

  const selectedObjective = useMemo(
    () => objectives.find((item) => item.id === draft.objectiveId) ?? objectives[0],
    [draft.objectiveId],
  );
  const selectedAudience = useMemo(
    () => audiences.find((item) => item.id === draft.audienceId) ?? audiences[0],
    [draft.audienceId],
  );

  const estimation = useMemo(
    () => computeEstimation(draft, selectedObjective, selectedAudience),
    [draft, selectedObjective, selectedAudience],
  );

  const handleDraftChange = <K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) => {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleCreativeChange = <K extends keyof CampaignDraft['creative']>(key: K, value: CampaignDraft['creative'][K]) => {
    setDraft((previous) => ({
      ...previous,
      creative: {
        ...previous.creative,
        [key]: value,
      },
    }));
  };

  const sponsorName = profile?.sponsor_branding?.brand_name ?? profile?.display_name ?? profile?.username ?? 'Marque partenaire';
  const isSponsor = profile?.role === 'sponsor';

  if (!isSponsor) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-16 pt-10 text-white">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Retour
        </button>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-lg shadow-black/20 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Accès sponsor requis</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Active ton espace sponsor pour gérer les campagnes</h1>
          <p className="mt-4 text-sm text-slate-300">
            Connecte-toi avec un compte sponsor ou active le mode sponsor pour accéder au gestionnaire de campagnes Shredloc.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-10 text-white lg:flex-row">
      <div className="lg:w-[64%] lg:flex-[2]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
            >
              <ArrowLeft size={16} />
              Retour au cockpit sponsor
            </button>
            <h1 className="mt-4 text-3xl font-semibold text-white">Gestionnaire de campagnes sponsor</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Planifie une campagne multi-formats alignée sur tes objectifs business. Choisis ton audience, mesure les
              estimations de reach et visualise l’expérience créative avant diffusion.
            </p>
          </div>
          <div className="hidden rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-right text-sm font-medium text-white/80 shadow-inner shadow-black/20 lg:block">
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">Plan média estimé</p>
            <p className="mt-2 text-xl font-semibold text-white">{currencyFormatter.format(draft.budget)}</p>
            <p className="text-xs text-white/60">Budget total</p>
          </div>
        </div>

        <div className="mt-10 space-y-6">
          <ol className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const isActive = step === item.id;
              const isCompleted = step > item.id;

              return (
                <li key={item.id} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setStep(item.id)}
                    className={`flex h-full w-full flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                      isActive
                        ? 'border-orange-400/60 bg-orange-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${
                          isActive || isCompleted
                            ? 'border-orange-400/70 bg-orange-500/20 text-white'
                            : 'border-white/20 bg-white/5 text-slate-300'
                        }`}
                      >
                        {isCompleted ? <CheckCircle2 size={20} /> : index + 1}
                      </span>
                      <Icon size={20} className="text-orange-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-white">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-300">{item.description}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20 backdrop-blur">
            {step === 0 && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-white" htmlFor="campaign-name">
                    Nom de la campagne
                  </label>
                  <input
                    id="campaign-name"
                    type="text"
                    value={draft.name}
                    onChange={(event) => handleDraftChange('name', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-dark-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/80 focus:ring-2 focus:ring-orange-500/40"
                    placeholder="Ex: Expérience Street Lines"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    Choix de l’objectif
                    <HelpTip title="Objectifs disponibles">
                      <p>Chaque objectif ajuste automatiquement le type de KPI suivis et les placements recommandés.</p>
                      <p className="text-xs text-slate-400">
                        Tu peux ajuster les placements plus tard tout en conservant le suivi de la performance.
                      </p>
                    </HelpTip>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {objectives.map((objective) => {
                      const isSelected = draft.objectiveId === objective.id;
                      return (
                        <button
                          type="button"
                          key={objective.id}
                          onClick={() => handleDraftChange('objectiveId', objective.id)}
                          className={`h-full rounded-2xl border px-4 py-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                            isSelected
                              ? 'border-orange-400/70 bg-orange-500/15 text-white shadow-inner shadow-orange-500/20'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30 hover:bg-white/10'
                          }`}
                        >
                          <p className="text-sm font-semibold text-white">{objective.name}</p>
                          <p className="mt-2 text-xs leading-relaxed text-slate-300">{objective.description}</p>
                          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-orange-300">
                            Budget conseillé : {objective.recommendedBudget}
                          </p>
                          <ul className="mt-3 space-y-1 text-xs text-slate-400">
                            {objective.successMetrics.map((metric) => (
                              <li key={metric} className="flex items-center gap-2">
                                <Sparkles size={12} />
                                {metric}
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-white">
                      Budget global
                      <HelpTip title="Répartition budget">
                        <p>
                          Ajuste le budget total pour estimer automatiquement la couverture et les interactions attendues.
                        </p>
                        <p className="text-xs text-slate-400">
                          La prévision répartit le budget sur la durée de la campagne avec un pacing régulier.
                        </p>
                      </HelpTip>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-dark-900/80 p-4">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>1 000€</span>
                        <span>10 000€</span>
                      </div>
                      <input
                        type="range"
                        min={1000}
                        max={10000}
                        step={250}
                        value={draft.budget}
                        onChange={(event) => handleDraftChange('budget', Number(event.target.value))}
                        className="mt-3 w-full accent-orange-400"
                        aria-label="Budget de la campagne"
                      />
                      <p className="mt-3 text-lg font-semibold text-white">
                        {currencyFormatter.format(draft.budget)}
                        <span className="ml-2 text-xs font-medium text-slate-400">Budget total</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        ≈ {currencyFormatter.format(Math.round(draft.budget / Math.max(1, estimation.impressions / 1000)))} CPM effectif
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      Optimisation principale
                      <HelpTip title="Stratégie d’optimisation">
                        <p>Le moteur adapte automatiquement les enchères selon l’optimisation sélectionnée.</p>
                        <p className="text-xs text-slate-400">
                          Reach = maximiser la couverture, Clicks = maximiser le trafic, Conversions = maximiser les ventes.
                        </p>
                      </HelpTip>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'reach', label: 'Reach étendu', icon: Target },
                          { id: 'clicks', label: 'Trafic qualifié', icon: Rocket },
                          { id: 'conversions', label: 'Conversions', icon: Wand2 },
                        ] as const
                      ).map((option) => {
                        const Icon = option.icon;
                        const isSelected = draft.optimization === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleDraftChange('optimization', option.id)}
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                              isSelected
                                ? 'border-orange-400/70 bg-orange-500/20 text-white'
                                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30 hover:bg-white/10'
                            }`}
                          >
                            <Icon size={14} />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                      <label className="space-y-1">
                        <span>Période de début</span>
                        <div className="relative">
                          <CalendarDays
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                          />
                          <input
                            type="date"
                            value={draft.startDate}
                            onChange={(event) => handleDraftChange('startDate', event.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-dark-900/80 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-orange-400/70 focus:ring-2 focus:ring-orange-500/40"
                          />
                        </div>
                      </label>
                      <label className="space-y-1">
                        <span>Période de fin</span>
                        <div className="relative">
                          <CalendarDays
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                          />
                          <input
                            type="date"
                            value={draft.endDate}
                            min={draft.startDate}
                            onChange={(event) => handleDraftChange('endDate', event.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-dark-900/80 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-orange-400/70 focus:ring-2 focus:ring-orange-500/40"
                          />
                        </div>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                      <p>Durée estimée : {Math.max(1, Math.round((new Date(draft.endDate).getTime() - new Date(draft.startDate).getTime()) / (1000 * 60 * 60 * 24)))} jours</p>
                      <p className="text-right">Fréquence max : {draft.frequencyCap} vue(s)/rider</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    Audience cible
                    <HelpTip title="Segments disponibles">
                      <p>
                        Les segments combinent signaux comportementaux (spots visités, contenus regardés) et données déclaratives.
                      </p>
                      <p className="text-xs text-slate-400">Les tailles sont des estimations basées sur les 90 derniers jours.</p>
                    </HelpTip>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {audiences.map((audience) => {
                      const isSelected = draft.audienceId === audience.id;
                      return (
                        <button
                          key={audience.id}
                          type="button"
                          onClick={() => handleDraftChange('audienceId', audience.id)}
                          className={`h-full rounded-2xl border px-4 py-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                            isSelected
                              ? 'border-orange-400/70 bg-orange-500/15 text-white shadow-inner shadow-orange-500/20'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30 hover:bg-white/10'
                          }`}
                        >
                          <p className="text-sm font-semibold text-white">{audience.name}</p>
                          <p className="mt-2 text-xs leading-relaxed text-slate-300">{audience.description}</p>
                          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-orange-300">
                            Taille : {audience.sizeRange}
                          </p>
                          <ul className="mt-3 space-y-1 text-xs text-slate-400">
                            {audience.profileHighlights.map((highlight) => (
                              <li key={highlight} className="flex items-center gap-2">
                                <Users size={12} />
                                {highlight}
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <label className="space-y-2 text-sm text-white">
                      Zones & villes clés
                      <input
                        type="text"
                        value={draft.locations.join(', ')}
                        onChange={(event) => handleDraftChange('locations', parseCommaList(event.target.value))}
                        className="w-full rounded-2xl border border-white/10 bg-dark-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/80 focus:ring-2 focus:ring-orange-500/40"
                        placeholder="Ex: Paris, Lyon, Marseille"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-white">
                      Centres d’intérêt
                      <input
                        type="text"
                        value={draft.interests.join(', ')}
                        onChange={(event) => handleDraftChange('interests', parseCommaList(event.target.value))}
                        className="w-full rounded-2xl border border-white/10 bg-dark-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/80 focus:ring-2 focus:ring-orange-500/40"
                        placeholder="Ex: Street skate, Media crew, Culture urbaine"
                      />
                    </label>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <label className="space-y-2 text-sm text-white">
                        Âge min
                        <input
                          type="number"
                          min={13}
                          max={draft.ageRange[1]}
                          value={draft.ageRange[0]}
                          onChange={(event) =>
                            handleDraftChange('ageRange', [Number(event.target.value), draft.ageRange[1]])
                          }
                          className="w-full rounded-2xl border border-white/10 bg-dark-900 px-4 py-3 text-sm text-white outline-none focus:border-orange-400/80 focus:ring-2 focus:ring-orange-500/40"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-white">
                        Âge max
                        <input
                          type="number"
                          min={draft.ageRange[0]}
                          max={65}
                          value={draft.ageRange[1]}
                          onChange={(event) =>
                            handleDraftChange('ageRange', [draft.ageRange[0], Number(event.target.value)])
                          }
                          className="w-full rounded-2xl border border-white/10 bg-dark-900 px-4 py-3 text-sm text-white outline-none focus:border-orange-400/80 focus:ring-2 focus:ring-orange-500/40"
                        />
                      </label>
                    </div>
                    <label className="space-y-2 text-sm text-white">
                      Notes stratégiques (optionnel)
                      <textarea
                        value={draft.notes ?? ''}
                        onChange={(event) => handleDraftChange('notes', event.target.value)}
                        rows={4}
                        className="w-full rounded-2xl border border-white/10 bg-dark-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/80 focus:ring-2 focus:ring-orange-500/40"
                        placeholder="Indique les assets à mettre en avant, le message clé ou les collaborations prévues."
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      Format créatif
                      <HelpTip title="Formats Shredloc">
                        <p>
                          Le format conditionne les assets attendus. Les vidéos privilégient la diffusion dans les stories et le feed.
                        </p>
                        <p className="text-xs text-slate-400">Les carrousels nécessitent 3 visuels minimum.</p>
                      </HelpTip>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'image', label: 'Visuel statique' },
                          { id: 'video', label: 'Vidéo 9:16' },
                          { id: 'carousel', label: 'Carrousel créatif' },
                        ] as const
                      ).map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleCreativeChange('format', option.id)}
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                            draft.creative.format === option.id
                              ? 'border-orange-400/70 bg-orange-500/20 text-white'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30 hover:bg-white/10'
                          }`}
                        >
                          <Palette size={14} />
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <label className="space-y-2 text-sm text-white">
                      Titre principal
                      <input
                        type="text"
                        value={draft.creative.headline}
                        onChange={(event) => handleCreativeChange('headline', event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-dark-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/80 focus:ring-2 focus:ring-orange-500/40"
                        placeholder="Ex: Session street X ta marque"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-white">
                      Sous-titre
                      <input
                        type="text"
                        value={draft.creative.subheadline ?? ''}
                        onChange={(event) => handleCreativeChange('subheadline', event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-dark-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/80 focus:ring-2 focus:ring-orange-500/40"
                        placeholder="Ex: Coaching et produits en avant-première"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-white">
                      Message principal
                      <textarea
                        value={draft.creative.message}
                        onChange={(event) => handleCreativeChange('message', event.target.value)}
                        rows={5}
                        className="w-full rounded-2xl border border-white/10 bg-dark-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/80 focus:ring-2 focus:ring-orange-500/40"
                        placeholder="Décris l’expérience sponsorisée, les bénéfices riders et le ton de la campagne."
                      />
                    </label>
                  </div>
                  <div className="space-y-4">
                    <label className="space-y-2 text-sm text-white">
                      Call-to-action
                      <input
                        type="text"
                        value={draft.creative.callToAction}
                        onChange={(event) => handleCreativeChange('callToAction', event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-dark-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/80 focus:ring-2 focus:ring-orange-500/40"
                        placeholder="Ex: Réserver ma place"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-white">
                      URL d’atterrissage
                      <input
                        type="url"
                        value={draft.creative.landingUrl}
                        onChange={(event) => handleCreativeChange('landingUrl', event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-dark-900 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/80 focus:ring-2 focus:ring-orange-500/40"
                        placeholder="https://"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="space-y-2 text-sm text-white">
                        Couleur principale
                        <input
                          type="color"
                          value={draft.creative.primaryColor}
                          onChange={(event) => handleCreativeChange('primaryColor', event.target.value)}
                          className="h-12 w-full rounded-2xl border border-white/10 bg-dark-900"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-white">
                        Couleur accent
                        <input
                          type="color"
                          value={draft.creative.accentColor}
                          onChange={(event) => handleCreativeChange('accentColor', event.target.value)}
                          className="h-12 w-full rounded-2xl border border-white/10 bg-dark-900"
                        />
                      </label>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-white">Placements choisis</p>
                      <div className="grid gap-2">
                        {placementOptions.map((placement) => {
                          const isSelected = draft.placements.includes(placement.id);
                          return (
                            <label
                              key={placement.id}
                              className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                                isSelected
                                  ? 'border-orange-400/60 bg-orange-500/15 text-white'
                                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30 hover:bg-white/10'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(event) => {
                                  if (event.target.checked) {
                                    handleDraftChange('placements', [...draft.placements, placement.id]);
                                  } else {
                                    handleDraftChange(
                                      'placements',
                                      draft.placements.filter((item) => item !== placement.id),
                                    );
                                  }
                                }}
                                className="mt-1 h-4 w-4 rounded border border-white/20 bg-dark-900 text-orange-500 focus:ring-0"
                              />
                              <span>
                                <span className="font-semibold text-white">{placement.label}</span>
                                <span className="block text-xs text-slate-300">{placement.description}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setStep((previous) => Math.max(steps[0].id, previous - 1))}
              disabled={step === steps[0].id}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-white/30 hover:bg-white/10"
            >
              <ArrowLeft size={16} />
              Étape précédente
            </button>
            <button
              type="button"
              onClick={() => setStep((previous) => Math.min(steps[steps.length - 1].id, previous + 1))}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-400"
            >
              Étape suivante
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <aside className="flex-1 space-y-6 lg:sticky lg:top-24">
        <div className="rounded-3xl border border-orange-500/30 bg-orange-500/10 p-6 shadow-lg shadow-orange-500/10 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-orange-200">Estimation</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Projection de la campagne</h2>
          <p className="mt-2 text-sm text-orange-100/80">{estimation.narrative}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm text-white/90">
            <div>
              <dt className="text-xs uppercase tracking-wide text-orange-200">Reach estimé</dt>
              <dd className="mt-1 text-lg font-semibold">{numberFormatter.format(estimation.reach)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-orange-200">Impressions</dt>
              <dd className="mt-1 text-lg font-semibold">{numberFormatter.format(estimation.impressions)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-orange-200">Interactions</dt>
              <dd className="mt-1 text-lg font-semibold">{numberFormatter.format(estimation.clicks)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-orange-200">CTR projeté</dt>
              <dd className="mt-1 text-lg font-semibold">{percentFormatter.format(estimation.ctr)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-orange-200">CPM</dt>
              <dd className="mt-1 text-lg font-semibold">{currencyFormatter.format(Math.round(estimation.cpm))}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-orange-200">CPC</dt>
              <dd className="mt-1 text-lg font-semibold">{currencyFormatter.format(Math.round(estimation.cpc))}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            {estimation.highlights.map((highlight) => (
              <span
                key={highlight}
                className="inline-flex items-center gap-2 rounded-full border border-orange-400/40 bg-orange-500/15 px-3 py-1 font-medium text-orange-100"
              >
                <CheckCircle2 size={12} />
                {highlight}
              </span>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-orange-400/40 bg-orange-500/20 px-4 py-3 text-sm text-white/90">
            <span className="font-semibold uppercase tracking-wide text-orange-100">Confiance {estimation.confidence}</span>
            <span className="text-xs text-orange-100/80">Basée sur données 90j & placements similaires</span>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Preview créative</p>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-300">
              {draft.creative.format === 'video'
                ? 'Vidéo verticale'
                : draft.creative.format === 'carousel'
                ? 'Carrousel'
                : 'Visuel statique'}
            </span>
          </div>
          <div
            className="mt-4 overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/40"
            style={{
              background: `linear-gradient(135deg, ${draft.creative.primaryColor}, ${draft.creative.accentColor})`,
            }}
          >
            <div className="bg-black/25 p-6">
              <p className="text-xs uppercase tracking-[0.4em] text-white/70">{sponsorName}</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">{draft.creative.headline}</h3>
              {draft.creative.subheadline && (
                <p className="mt-2 text-sm text-white/80">{draft.creative.subheadline}</p>
              )}
            </div>
            <div className="bg-black/45 p-6 text-sm text-white/85">
              <p className="leading-relaxed text-white/90">{draft.creative.message}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white">
                  <Sparkles size={14} />
                  {draft.creative.callToAction}
                </span>
                <span className="inline-flex items-center gap-2 text-xs text-white/70">
                  <Target size={14} />
                  {draft.placements.length} placement(s)
                </span>
              </div>
            </div>
          </div>
          <ul className="mt-5 space-y-2 text-sm text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400" />
              Landing : {draft.creative.landingUrl || 'à définir'}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400" />
              Fréquence max {draft.frequencyCap} vues / rider
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400" />
              Ciblage : {draft.ageRange[0]}-{draft.ageRange[1]} ans · {draft.locations.join(', ')}
            </li>
          </ul>
          <button
            type="button"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Exporter le brief média
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
    </div>
  );
}
