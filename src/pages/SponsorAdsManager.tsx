import { useMemo, useRef, useState } from 'react';
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
import { uploadFile } from '../lib/storage';
import { useRouter } from '../lib/router';
import { useSponsorContext } from '../contexts/SponsorContext';
import { logCampaignEstimationAsAnalytics } from '../lib/sponsorAnalytics';
import Collapse from '../components/Collapse';

interface SponsorAdsManagerProps {
  profile: Profile | null;
}

// Options de placements demandées (formats)
const customPlacementOptions = [
  { id: 'side-feed', label: 'Bloc à côté du feed', description: 'Affichage persistant dans la colonne latérale du feed.' },
  { id: 'post-media-interstitial', label: 'Interstitiel post (5s)', description: "Remplace le média du post pendant 5s à l'ouverture." },
  { id: 'top-banner', label: 'Bandeau horizontal (sous menu)', description: 'Incrustation en haut de page, sous le menu.' },
] as const;

// Pages où afficher la publicité
const pageOptions = [
  { id: 'home-feed', label: 'Accueil / Feed' },
  { id: 'post-detail', label: 'Détail du post' },
  { id: 'spots-grid', label: 'Liste des spots' },
] as const;

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
    recommendedBudget: '2 000 € – 4 500 €',
    successMetrics: ['Couverture unique', 'Visites profil sponsor', 'Temps sur campagne'],
    reachMultiplier: 1.25,
    engagementMultiplier: 0.95,
  },
  {
    id: 'traffic',
    name: 'Drive‑to‑spot',
    description: 'Active les riders autour d’un événement physique ou d’une tournée de démos.',
    recommendedBudget: '3 500 € – 6 500 €',
    successMetrics: ['Visites événement', 'Check-ins sur spot', 'Intentions de participation'],
    reachMultiplier: 1.1,
    engagementMultiplier: 1.15,
  },
  {
    id: 'conversion',
    name: 'Conversions shop',
    description: 'Amplifie les ventes produits avec des placements premium et des offres exclusives.',
    recommendedBudget: '4 500 € – 9 000 €',
    successMetrics: ['Ajouts panier', 'Ventes attribuées', 'Valeur moyenne commande'],
    reachMultiplier: 0.9,
    engagementMultiplier: 1.3,
  },
];

const audiences: Audience[] = [
  {
    id: 'core-riders',
    name: 'Riders engagés (18‑30 ans)',
    description: 'Skaters connectés quotidiennement, sensibles aux contenus culture skate.',
    sizeRange: '52 000 – 68 000 profils',
    profileHighlights: ['Sessions 4x/semaine', 'Consulte les spots urbains', 'Partage de contenu vidéo'],
    baseCpm: 12,
    baseCpc: 1.45,
    clickThroughRate: 0.015,
    reachRate: 0.62,
  },
  {
    id: 'city-crews',
    name: 'Crews urbains & collectifs',
    description: 'Collectifs qui organisent des lines et jams dans les grandes métropoles.',
    sizeRange: '25 000 – 32 000 profils',
    profileHighlights: ["Organisation d’événements", 'Usage intensif de la messagerie', 'Partage de playlists'],
    baseCpm: 14,
    baseCpc: 1.7,
    clickThroughRate: 0.018,
    reachRate: 0.54,
  },
  {
    id: 'newcomers',
    name: 'Nouveaux riders inspirés',
    description: 'Primo‑pratiquants cherchant des marques référentes et des contenus pédagogiques.',
    sizeRange: '35 000 – 44 000 profils',
    profileHighlights: ['Sauvegarde de tutoriels', 'Achats in‑app', 'Recherche de coaching'],
    baseCpm: 9,
    baseCpc: 1.2,
    clickThroughRate: 0.012,
    reachRate: 0.68,
  },
];

// Facteurs prix/performance par placement
const PLACEMENT_PRICING: Record<string, { cpm: number; ctr: number; reach: number; viewability: number }> = {
  'side-feed': { cpm: 0.9, ctr: 0.95, reach: 0.95, viewability: 0.65 },
  'post-media-interstitial': { cpm: 1.25, ctr: 1.15, reach: 1.1, viewability: 0.9 },
  'top-banner': { cpm: 1.15, ctr: 1.05, reach: 1.05, viewability: 0.75 },
};

// Facteurs par page ciblée
const PAGE_PRICING: Record<string, { cpm: number; ctr: number; reach: number }> = {
  'home-feed': { cpm: 1.0, ctr: 1.0, reach: 1.0 },
  'post-detail': { cpm: 1.1, ctr: 1.08, reach: 1.05 },
  'spots-grid': { cpm: 0.95, ctr: 0.9, reach: 0.85 },
};

function aggregateFactors<T extends Record<string, number>>(ids: string[] | undefined, table: Record<string, T>, fallback: T): T {
  const list = (ids && ids.length ? ids : [])
    .map((id) => table[id])
    .filter(Boolean) as T[];
  if (!list.length) return fallback;
  const totals: Record<string, number> = {};
  for (const item of list) {
    for (const [k, v] of Object.entries(item)) {
      totals[k] = (totals[k] ?? 0) + (v as number);
    }
  }
  const averaged: Record<string, number> = {};
  for (const [k, v] of Object.entries(totals)) {
    averaged[k] = v / list.length;
  }
  return averaged as T;
}

function computeEstimation(draft: CampaignDraft, objective: Objective, audience: Audience): EstimationResult {
  const budget = Math.max(draft.budget, 1);
  const flightDays = Math.max(
    1,
    Math.round(
      (new Date(draft.endDate).getTime() - new Date(draft.startDate).getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  const placementFactors = aggregateFactors(draft.placements, PLACEMENT_PRICING, { cpm: 1, ctr: 1, reach: 1, viewability: 0.7 });
  const pageFactors = aggregateFactors(draft.targetPages ?? ['home-feed'], PAGE_PRICING, { cpm: 1, ctr: 1, reach: 1 });
  const optimizationMultiplier =
    draft.optimization === 'reach' ? 1.05 : draft.optimization === 'clicks' ? 1.12 : 1.18;

  const effectiveCpm = (audience.baseCpm * placementFactors.cpm * pageFactors.cpm) / Math.max(objective.reachMultiplier, 0.1);
  const impressions = (budget / Math.max(effectiveCpm, 0.1)) * 1000 * optimizationMultiplier;
  const reach = impressions * (audience.reachRate * pageFactors.reach * placementFactors.reach);
  const clicks = impressions * (audience.clickThroughRate * objective.engagementMultiplier * pageFactors.ctr * placementFactors.ctr) * optimizationMultiplier;
  const baseViewRate = draft.creative.format === 'video' ? 0.62 : 0.48;
  const views = impressions * baseViewRate * placementFactors.viewability;
  const engagements = clicks * (objective.id === 'awareness' ? 1.35 : 1.15);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpm = impressions > 0 ? (budget / impressions) * 1000 : effectiveCpm;
  const cpc = clicks > 0 ? budget / clicks : audience.baseCpc;

  let confidence: EstimationResult['confidence'] = 'medium';
  if (budget >= 6000 && draft.placements.length >= 2 && flightDays >= 21) {
    confidence = 'high';
  } else if (budget <= 2000 || draft.placements.length <= 0) {
    confidence = 'low';
  }

  const narrative = `Avec ${currencyFormatter.format(budget)} investis sur ${draft.placements.length} placement(s) et ${(draft.targetPages?.length ?? 1)} page(s), la campagne devrait toucher environ ${numberFormatter.format(
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
  placements: ['side-feed', 'post-media-interstitial'],
  targetPages: ['home-feed'],
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

export default function SponsorAdsManager({ profile }: SponsorAdsManagerProps) {
  const [step, setStep] = useState<(typeof steps)[number]['id']>(steps[0].id);
  const [draft, setDraft] = useState<CampaignDraft>(defaultDraft);
  const { navigate } = useRouter();
  const { sponsorId, refreshAnalytics } = useSponsorContext();

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

  const isUrl = (value: string | undefined | null): boolean => {
    if (!value) return false;
    return /^https?:\/\//i.test(value.trim());
  };

  const isStepValid = (which: (typeof steps)[number]['id']): boolean => {
    if (which === 0) {
      const okName = (draft.name ?? '').trim().length >= 3;
      const okBudget = draft.budget > 0;
      const okDates = Boolean(draft.startDate) && Boolean(draft.endDate) && new Date(draft.startDate) <= new Date(draft.endDate);
      return okName && okBudget && okDates;
    }
    if (which === 1) {
      const okAudience = Boolean(draft.audienceId);
      const okPages = (draft.targetPages?.length ?? 0) > 0;
      const okAges = draft.ageRange[0] <= draft.ageRange[1];
      const okLocations = (draft.locations?.length ?? 0) > 0 && draft.locations.every((l) => (l ?? '').toString().trim().length > 0);
      return okAudience && okPages && okAges && okLocations;
    }
    if (which === 2) {
      const c = draft.creative;
      const okHeadline = (c.headline ?? '').trim().length > 0;
      const okMessage = (c.message ?? '').trim().length > 0;
      const okCta = (c.callToAction ?? '').trim().length > 0;
      const okUrl = isUrl(c.landingUrl);
      const okMedia = Boolean(c.mediaUrl && c.mediaUrl.length > 0);
      const okPlacements = (draft.placements?.length ?? 0) > 0;
      return okHeadline && okMessage && okCta && okUrl && okMedia && okPlacements;
    }
    return true;
  };

  const allStepsValid = isStepValid(0) && isStepValid(1) && isStepValid(2);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [acceptTypes, setAcceptTypes] = useState<string>('image/jpeg,image/png,image/webp,image/gif');
  const [showPublishToast, setShowPublishToast] = useState(false);

  const extractHashtags = (text: string | undefined | null): string[] => {
    if (!text) return [];
    return text
      .split(/\s+/)
      .filter((token) => token.startsWith('#'))
      .map((token) => token.replace(/^#/, '').toLowerCase())
      .filter(Boolean);
  };

  // Mobile/desktop shared panel for the main step content
  function StepPanel() {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20 backdrop-blur">
        {step === 0 && (
          <div className="space-y-8">
            {/* step 0 content (unchanged) */}
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
                Choix de l'objectif
                <HelpTip title="Objectifs disponibles">
                  <p>Chaque objectif ajuste automatiquement le type de KPI suivis et les placements recommandés.</p>
                  <p className="text-xs text-slate-400">Tu peux ajuster les placements plus tard tout en conservant le suivi de la performance.</p>
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
                      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-orange-300">Budget conseillé : {objective.recommendedBudget}</p>
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
                    <p>Ajuste le budget total pour estimer automatiquement la couverture et les interactions attendues.</p>
                    <p className="text-xs text-slate-400">La prévision répartit le budget sur la durée de la campagne avec un pacing régulier.</p>
                  </HelpTip>
                </div>
                {/* budget slider + optimization, dates, etc. (existing JSX preserved below) */}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8">
            {/* step 1 content (audience) - reuses existing JSX below */}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            {/* step 2 content (creative & placements) - reuses existing JSX below */}
          </div>
        )}
      </section>
    );
  }

  const sponsorName = profile?.sponsor_branding?.brand_name ?? profile?.display_name ?? profile?.username ?? 'Marque partenaire';
  const isSponsor = profile?.role === 'sponsor';

  const handlePublish = async () => {
    try {
      if (sponsorId) {
        await logCampaignEstimationAsAnalytics(sponsorId, {
          reach: estimation.reach,
          impressions: estimation.impressions,
          clicks: estimation.clicks,
          tags: extractHashtags(draft.creative.message),
          regions: draft.locations,
        });
        await refreshAnalytics();
      }

      // Expose la ou les campagnes actives au feed (stockage local simple)
      const activeCampaign = {
        sponsorName,
        draft,
        estimation,
        publishedAt: new Date().toISOString(),
        status: 'active' as const,
      };
      try {
        // Clé unique (compat)
        localStorage.setItem('activeAdCampaign', JSON.stringify(activeCampaign));
        // Tableau pour alternance
        const raw = localStorage.getItem('activeAdCampaigns');
        const arr: unknown = raw ? JSON.parse(raw) : [];
        const campaigns = Array.isArray(arr) ? arr : [];
        campaigns.push(activeCampaign);
        localStorage.setItem('activeAdCampaigns', JSON.stringify(campaigns));
      } catch (_) {
        // stockage indisponible, ignorer
      }

      // Toast animé "campagne publiée"
      setShowPublishToast(true);
      window.setTimeout(() => setShowPublishToast(false), 2000);
    } catch (err) {
      console.info('Publish analytics logging failed (non-blocking)', err);
    }
  };

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

  const triggerMediaPicker = async (format: 'image' | 'video' | 'carousel') => {
    handleCreativeChange('format', format);
    const accept = format === 'video'
      ? 'video/mp4,video/quicktime,video/webm'
      : 'image/jpeg,image/png,image/webp,image/gif';
    setAcceptTypes(accept);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Détecte le type réel du fichier pour aligner le format
      const detectedFormat = file.type.startsWith('video/') ? 'video' : 'image';
      handleCreativeChange('format', detectedFormat as CampaignDraft['creative']['format']);
      const { url } = await uploadFile('sponsors', file, 'ads');
      handleCreativeChange('mediaUrl', url);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
    <div className="mx-auto flex max-w-9xl flex-col gap-10 px-4 pb-16 pt-10 text-white lg:flex-row lg:items-center">
      {/* Panneau latéral gauche : estimation */}
      <aside className="order-2 flex-1 space-y-6 lg:order-1 lg:self-center">
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
      </aside>

      {/* Zone principale */}
      <div className="order-1 lg:order-2 lg:w-[64%] lg:flex-[2]">
        <div className="flex items-center justify-between gap-4">
          <div />
          <div className="hidden rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-right text-sm font-medium text-white/80 shadow-inner shadow-black/20 lg:hidden">
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">Plan média estimé</p>
            <p className="mt-2 text-xl font-semibold text-white">{currencyFormatter.format(draft.budget)}</p>
            <p className="text-xs text-white/60">Budget total</p>
          </div>
        </div>

        <div className="mt-10 space-y-6">
          {/* Étapes */}
          <ol className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const isActive = step === item.id;
              const isCompleted = step > item.id;

              return (
                <li key={item.id} className="flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.id <= step || isStepValid(step)) {
                        setStep(item.id);
                      }
                    }}
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

          {/* Carte principale */}
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
                        <span>1 000€</span>
                        <span>10 000€</span>
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
                          onClick={() => triggerMediaPicker(option.id)}
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
                    <input ref={fileInputRef} type="file" className="hidden" accept={acceptTypes} onChange={handleFileSelected} />
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
                      <p className="text-sm font-medium text-white">Pages ciblées</p>
                      <div className="grid gap-2">
                        {pageOptions.map((page) => {
                          const isSelected = (draft.targetPages ?? []).includes(page.id);
                          return (
                            <label
                              key={page.id}
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
                                  const current = draft.targetPages ?? [];
                                  if (event.target.checked) {
                                    handleDraftChange('targetPages', [...current, page.id]);
                                  } else {
                                    handleDraftChange('targetPages', current.filter((p) => p !== page.id));
                                  }
                                }}
                                className="mt-1 h-4 w-4 rounded border border-white/20 bg-dark-900 text-orange-500 focus:ring-0"
                              />
                              <span className="font-semibold text-white">{page.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-white">Placements choisis</p>
                      <div className="grid gap-2">
                        {customPlacementOptions.map((placement) => {
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

          {/* Navigation / actions */}
          <div className="flex items-center justify-start">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
            >
              <ArrowLeft size={16} />
              Retour au cockpit sponsor
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() =>
                setStep((previous) => (previous > 0 ? ((previous - 1) as 0 | 1 | 2) : previous))
              }
              disabled={step === steps[0].id}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-white/30 hover:bg-white/10"
            >
              <ArrowLeft size={16} />
              Étape précédente
            </button>
            {step < steps[steps.length - 1].id ? (
              <button
                type="button"
                onClick={() => {
                  if (isStepValid(step)) {
                    setStep((previous) =>
                      previous < steps[steps.length - 1].id
                        ? ((previous + 1) as 0 | 1 | 2)
                        : previous,
                    );
                  }
                }}
                disabled={!isStepValid(step)}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 bg-orange-500 text-white shadow-orange-500/30 hover:bg-orange-400"
              >
                Étape suivante
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePublish}
                disabled={!allStepsValid}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 bg-orange-500 text-white shadow-orange-500/30 hover:bg-orange-400"
              >
                Publier la campagne
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Panneau latéral droit (placeholder / duplication contrôlée) */}
            <aside className="order-3 flex-1 space-y-6 lg:order-3 lg:self-center">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">Preview créative</p>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
              {draft.creative.format === 'video' ? 'Vidéo verticale' : draft.creative.format === 'carousel' ? 'Carrousel' : 'Visuel statique'}
            </span>
          </div>
          <div
            className="mt-4 overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/40"
            style={{ background: `linear-gradient(135deg, ${draft.creative.primaryColor}, ${draft.creative.accentColor})` }}
          >
            {draft.creative.mediaUrl && (
              <div className="relative w-full bg-black aspect-[4/5]">
                {draft.creative.format === 'video' ? (
                  <video src={draft.creative.mediaUrl} className="h-full w-full object-cover" muted playsInline loop />
                ) : (
                  <img src={draft.creative.mediaUrl} alt="aperçu créatif" className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/30 to-black/60" />
              </div>
            )}
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
        </div>
      </aside>

      {showPublishToast && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="animate-bounce rounded-full bg-orange-600/90 px-6 py-3 text-white shadow-2xl">
            Campagne publiée
          </div>
          </div>
      )}
    </div>
  );
}
