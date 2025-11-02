import { useEffect, useMemo, useState } from 'react';
import {
  Crown,
  Users,
  Rocket,
  Medal,
  Sparkles,
  Eye,
  Activity,
  Gem,
  Store,
  Target,
  Coins,
  LineChart,
  ShoppingCart,
  Ticket,
  Megaphone,
  Camera,
  Gift,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { getPlanDefinition, type SubscriptionPlan } from '../../lib/subscription';

interface TierFeatureGroup {
  label: string;
  items: string[];
}

interface Tier {
  id: string;
  name: string;
  price: string;
  priceNote?: string;
  target: string;
  highlight?: string;
  description: string;
  featureGroups: TierFeatureGroup[];
  badge?: string;
  isB2B?: boolean;
}

const axes = [
  {
    id: 'visibility',
    title: 'Visibilité',
    description: "Booste ton image, ta présence sur la map et dans le flux.",
    icon: Eye,
    accent: 'text-orange-400',
  },
  {
    id: 'performance',
    title: 'Performance',
    description: 'Défis, gamification et coaching communautaire pour progresser.',
    icon: Activity,
    accent: 'text-emerald-400',
  },
  {
    id: 'advantage',
    title: 'Avantage',
    description: 'Accès shop, sponsors et avantages exclusifs pour concrétiser.',
    icon: Gem,
    accent: 'text-purple-400',
  },
];

const tiers: Tier[] = [
  {
    id: 'free-ride',
    name: 'FREE RIDE',
    price: '0 CHF',
    priceNote: 'Gratuit',
    target: 'Grand public, débutants',
    description: 'Profil basique et découverte de la map pour commencer à rider avec la communauté.',
    featureGroups: [
      {
        label: 'Visibilité',
        items: ['Accès à la carte des spots publics', 'Profil simplifié avec 1 média'],
      },
      {
        label: 'Performance',
        items: ['Consultation des défis et événements', 'Badges passifs (visites, partages, likes)'],
      },
      {
        label: 'Avantage',
        items: ['Ajout de spots sans média sponsorisé'],
      },
    ],
  },
  {
    id: 'shred-pass',
    name: 'SHRED PASS',
    price: '9.90 CHF',
    priceNote: 'par mois',
    target: 'Riders actifs',
    badge: 'Populaire',
    description: 'Participation complète à la gamification et aux événements pour faire évoluer ton profil.',
    featureGroups: [
      {
        label: 'Visibilité',
        items: ['Profil optimisé (bio, réseaux, playlists)', 'Ajout illimité de photos/vidéos sur les spots'],
      },
      {
        label: 'Performance',
        items: [
          'Participation aux défis sponsorisés et classements',
          'Statistiques personnelles (vues, partages, progression)',
          'Accès anticipé aux événements locaux',
        ],
      },
      {
        label: 'Avantage',
        items: ['Badges débloquant des bonus physiques/numériques', 'Coupons exclusifs via les badges'],
      },
    ],
  },
  {
    id: 'pro-loc',
    name: 'PRO LOC',
    price: '29.90 CHF',
    priceNote: 'par mois',
    target: 'Sportifs confirmés / semi-pros',
    badge: 'Pro',
    highlight: 'Transforme ton profil en média monétisable',
    description: 'Exposition prioritaire, accès sponsor et outils de monétisation pour les riders qui veulent vivre de leur image.',
    featureGroups: [
      {
        label: 'Visibilité',
        items: ['Mise en avant automatique sur la carte & le fil', 'Profil certifié « Pro Rider »'],
      },
      {
        label: 'Performance',
        items: [
          'Invitations prioritaires à des événements IRL et tournages',
          'Accès à un canal privé « Pro Chat »',
        ],
      },
      {
        label: 'Avantage',
        items: [
          'Espace Sponsor : candidatures et matching marques',
          'Monétisation du profil (affiliation, dons, visionnages sponsorisés)',
          'Gestion de portfolios vidéos et partenariats',
        ],
      },
    ],
  },
  {
    id: 'brand-crew',
    name: 'BRAND CREW',
    price: '199 CHF',
    priceNote: 'par mois',
    target: 'Marques / Shops / Organisations',
    isB2B: true,
    highlight: 'Active ta communauté locale et pilote tes campagnes ciblées.',
    description: 'Outils marketing complets pour engager les riders et sponsoriser la scène locale.',
    featureGroups: [
      {
        label: 'Visibilité',
        items: ['Défis sponsorisés géolocalisés'],
      },
      {
        label: 'Performance',
        items: ['Analytics communautaires (âge, discipline, localisation)', 'Publication illimitée d’événements et offres'],
      },
      {
        label: 'Avantage',
        items: ['Boutique officielle intégrée', 'Partenariats premium (badges, challenges, leaderboard)', 'API d’intégration (CRM, e-commerce, ads)'],
      },
    ],
  },
];

const complementaryRevenue = [
  {
    icon: ShoppingCart,
    title: 'Marketplace ShredLoc',
    description: 'Commission 10–15% sur les ventes d’accessoires, collabs riders et drops exclusifs.',
  },
  {
    icon: Gift,
    title: 'Digital Badge Store',
    description: 'Badges NFT ou items virtuels pour valoriser les riders et créer de la rareté.',
  },
  {
    icon: Ticket,
    title: 'Événements payants',
    description: 'Pass VIP pour contests, démos, afterparties ou workshops masterclass.',
  },
  {
    icon: Megaphone,
    title: 'Publicité native',
    description: 'Pins sponsorisés et intégrations brand-safe directement sur la ShredMap.',
  },
  {
    icon: Camera,
    title: 'Production média',
    description: 'ShredLoc Originals, tournages et contenu documentaire co-produit avec les marques.',
  },
];

const loyaltyArchitecture = [
  {
    icon: Crown,
    title: 'Progression XP globale',
    description: 'Du statut « Street Rookie » à « Urban Legend » via missions quotidiennes et défis.',
  },
  {
    icon: LineChart,
    title: 'Classements multi-niveaux',
    description: 'Rankings locaux et globaux par discipline pour stimuler la compétition amicale.',
  },
  {
    icon: Coins,
    title: 'ShredCoin',
    description: 'Conversion des badges en points pour acheter perks dans le shop intégré.',
  },
  {
    icon: ShieldCheck,
    title: 'Retention loops',
    description: 'Missions et notifications intelligentes qui réactivent les riders inactifs.',
  },
];

const nextSteps = [
  {
    title: 'Taux de conversion cible',
    description: 'Objectif Free → Shred Pass : 7–10% via onboarding dynamique et offres limitées.',
  },
  {
    title: 'Assets visuels',
    description: 'Production de cartes, badges et interfaces sponsor pour le marketing.',
  },
  {
    title: 'Dashboard Brand Crew',
    description: 'Prototype B2B pour mesurer l’intérêt sponsors et collecter les feedbacks.',
  },
  {
    title: 'Campagne « Founding Riders »',
    description: '100 premiers Pro Loc à vie à tarif réduit pour enclencher la traction.',
  },
];

export default function PricingSection() {
  const { plan: activePlan, setPlan } = useSubscription();
  const [confirmation, setConfirmation] = useState<SubscriptionPlan | null>(null);

  const orderedTiers = useMemo(() => {
    const planOrder: SubscriptionPlan[] = ['free-ride', 'shred-pass', 'pro-loc', 'brand-crew'];
    return [...tiers].sort((a, b) => planOrder.indexOf(a.id as SubscriptionPlan) - planOrder.indexOf(b.id as SubscriptionPlan));
  }, []);

  useEffect(() => {
    if (!confirmation) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setConfirmation(null);
    }, 2600);

    return () => window.clearTimeout(timeout);
  }, [confirmation]);

  const handlePlanSelection = (plan: SubscriptionPlan) => {
    setPlan(plan);
    setConfirmation(plan);
  };

  const confirmationLabel = useMemo(() => {
    if (!confirmation) {
      return null;
    }

    const definition = getPlanDefinition(confirmation);
    return `Le plan « ${definition.label} » est maintenant actif.`;
  }, [confirmation]);

  return (
    <div className="relative max-w-6xl mx-auto px-4 py-6">
      {confirmation && confirmationLabel && (
        <div className="fixed inset-x-0 top-24 flex justify-center z-30">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-5 py-3 shadow-xl text-sm text-emerald-50 backdrop-blur">
            <CheckCircle2 className="text-emerald-300" size={20} />
            <span>{confirmationLabel}</span>
          </div>
        </div>
      )}
      <div className="bg-gradient-to-r from-orange-500/20 via-purple-500/10 to-emerald-500/10 border border-dark-700 rounded-2xl p-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="text-orange-400" size={24} />
              <span className="text-sm uppercase tracking-[0.3em] text-orange-300">Modèle économique</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">ShredLoc Tiers System</h1>
            <p className="text-gray-300 max-w-2xl">
              Une offre modulaire en trois axes — Visibilité, Performance, Avantage — pour servir riders, pros et marques. Chaque palier renforce l’engagement et ouvre de nouveaux leviers de monétisation. Sélectionne librement un plan pour l’activer instantanément.
            </p>
          </div>
          <div className="bg-dark-900/70 border border-dark-700 rounded-xl p-5 text-sm text-gray-300 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <Rocket className="text-emerald-400" size={22} />
              <p className="font-semibold text-white">Triple axe stratégique</p>
            </div>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-center gap-2">
                <Eye size={16} className="text-orange-400" /> Visibilité & brand content
              </li>
              <li className="flex items-center gap-2">
                <Activity size={16} className="text-emerald-400" /> Performance & gamification
              </li>
              <li className="flex items-center gap-2">
                <Store size={16} className="text-purple-400" /> Avantages & revenus partagés
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {axes.map((axis) => {
          const Icon = axis.icon;
          return (
            <div
              key={axis.id}
              className="bg-dark-800 border border-dark-700 rounded-xl p-6 flex flex-col gap-3"
            >
              <div className={`w-10 h-10 rounded-full bg-dark-900 flex items-center justify-center ${axis.accent}`}>
                <Icon size={22} />
              </div>
              <h2 className="text-lg font-semibold text-white">{axis.title}</h2>
              <p className="text-sm text-gray-400">{axis.description}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-6 mb-12">
        <h2 className="text-2xl font-bold text-white">Paliers d’abonnement</h2>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {orderedTiers.map((tier) => {
            const isActive = activePlan === tier.id;
            return (
              <div
                key={tier.id}
                className={`relative bg-dark-800 border rounded-2xl p-6 flex flex-col gap-5 transition-transform hover:-translate-y-1 ${
                  tier.badge ? 'border-orange-500/40 shadow-lg shadow-orange-500/10' : 'border-dark-700'
                } ${isActive ? 'ring-2 ring-orange-400/60' : ''}`}
              >
              {tier.badge && (
                <span className="absolute -top-3 right-4 bg-orange-500 text-xs font-semibold uppercase tracking-wide text-white px-3 py-1 rounded-full">
                  {tier.badge}
                </span>
              )}
              {isActive && (
                <span className="absolute -top-3 left-4 bg-emerald-500 text-xs font-semibold uppercase tracking-wide text-white px-3 py-1 rounded-full">
                  Plan actuel
                </span>
              )}
              {tier.isB2B && (
                <span
                  className={`absolute ${isActive ? 'top-6' : '-top-3'} left-4 bg-purple-500 text-xs font-semibold uppercase tracking-wide text-white px-3 py-1 rounded-full transition-all`}
                >
                  B2B
                </span>
              )}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                <p className="text-sm text-gray-400">{tier.target}</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-orange-400">{tier.price}</p>
                {tier.priceNote && <p className="text-xs uppercase tracking-widest text-gray-500">{tier.priceNote}</p>}
              </div>
              {tier.highlight && <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">{tier.highlight}</p>}
              <p className="text-sm text-gray-300">{tier.description}</p>

              <div className="space-y-4">
                {tier.featureGroups.map((group) => (
                  <div key={group.label} className="bg-dark-900 border border-dark-700 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      {group.label}
                    </p>
                    <ul className="space-y-2 text-sm text-gray-300">
                      {group.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Medal size={16} className="mt-0.5 text-orange-400 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handlePlanSelection(tier.id as SubscriptionPlan)}
                className={`mt-auto inline-flex items-center justify-center gap-2 rounded-xl border transition-colors px-4 py-2 text-sm font-semibold ${
                  isActive
                    ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
                    : 'border-orange-500/60 bg-orange-500/20 text-orange-200 hover:bg-orange-500/30'
                }`}
              >
                <span>{isActive ? 'Plan actif' : 'Activer ce plan'}</span>
                {!isActive && <ArrowRight size={16} className="shrink-0" />}
              </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6 mb-12">
        <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <ShoppingCart className="text-orange-400" size={22} />
            <h2 className="text-xl font-bold text-white">Revenus complémentaires</h2>
          </div>
          <div className="space-y-4">
            {complementaryRevenue.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3">
                  <div className="mt-1">
                    <Icon size={20} className="text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="text-emerald-400" size={22} />
            <h2 className="text-xl font-bold text-white">Objectif par segment</h2>
          </div>
          <ul className="space-y-3 text-sm text-gray-300">
            <li className="flex gap-2">
              <Users size={18} className="text-orange-400 mt-0.5" />
              <span>FREE RIDE : alimenter le flux communautaire et le repérage de spots.</span>
            </li>
            <li className="flex gap-2">
              <Medal size={18} className="text-emerald-400 mt-0.5" />
              <span>SHRED PASS : générer du contenu qualitatif et fidéliser via les défis.</span>
            </li>
            <li className="flex gap-2">
              <Crown size={18} className="text-purple-400 mt-0.5" />
              <span>PRO LOC : transformer la plateforme en média personnel monétisable.</span>
            </li>
            <li className="flex gap-2">
              <Rocket size={18} className="text-blue-400 mt-0.5" />
              <span>BRAND CREW : activer les budgets marques et nourrir les riders pros.</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="text-purple-400" size={22} />
            <h2 className="text-xl font-bold text-white">Architecture de fidélisation</h2>
          </div>
          <div className="space-y-4">
            {loyaltyArchitecture.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3">
                  <div className="mt-1">
                    <Icon size={20} className="text-purple-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Rocket className="text-orange-400" size={22} />
            <h2 className="text-xl font-bold text-white">Prochaines étapes</h2>
          </div>
          <ol className="space-y-3 text-sm text-gray-300 list-decimal list-inside">
            {nextSteps.map((step) => (
              <li key={step.title}>
                <p className="text-white font-semibold">{step.title}</p>
                <p className="text-gray-400">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-white">Besoin du JSON ou des maquettes ?</p>
          <p className="text-sm text-gray-400">
            Nous pouvons générer un plan de tarification dynamique ou des cartes UI pour intégrer ces abonnements dans Supabase, Stripe ou ton design system.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-500 text-white hover:bg-orange-400 transition-colors text-sm font-semibold"
        >
          Demander les assets
        </button>
      </div>
    </div>
  );
}
