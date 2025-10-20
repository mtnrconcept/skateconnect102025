import { ChevronLeft, Shield, Eye, Users, Database, Globe2, Lock, CheckCircle } from 'lucide-react';
import type { Section } from '../../types';

interface PrivacyPolicySectionProps {
  onNavigate?: (section: Section) => void;
}

const policySections = [
  {
    id: 'introduction',
    icon: Shield,
    title: 'Votre confidentialité sur Shredloc',
    description:
      'Comme sur Facebook, nous construisons des expériences sociales. Cette politique explique comment vos données sont protégées et utilisées pour garder la communauté skate sûre et inspirante.',
    points: [
      'Vous gardez le contrôle sur ce que vous partagez avec la communauté.',
      'Nous ne vendons pas vos informations personnelles et limitons les partages aux partenaires essentiels (paiement, sécurité, statistiques).',
      'Vous pouvez à tout moment télécharger ou supprimer vos données via le centre de paramètres.',
    ],
  },
  {
    id: 'data-collected',
    icon: Database,
    title: 'Données collectées',
    description: 'Nous collectons uniquement les informations nécessaires pour exploiter les fonctionnalités Shredloc.',
    points: [
      'Informations de profil : pseudo, photo, bio, stance et niveau partagés avec la communauté.',
      'Activité sociale : posts, commentaires, réactions, participation aux défis et sauvegarde de spots.',
      'Données techniques : type d’appareil, préférences linguistiques, journaux de connexions pour prévenir la fraude et sécuriser les comptes.',
      'Données de localisation lorsque vous ajoutez un spot ou que vous autorisez la découverte de spots proches.',
    ],
  },
  {
    id: 'usage',
    icon: Eye,
    title: 'Comment nous utilisons vos informations',
    description: 'Nos usages sont alignés sur des principes similaires à Facebook mais adaptés à la ride.',
    points: [
      'Proposer un feed personnalisé de spots, posts et défis susceptibles de vous plaire.',
      'Maintenir la sécurité (détection de comportements frauduleux, lutte contre le harcèlement, vérification des spots).',
      'Communiquer avec vous : notifications d’activités importantes, messages de service et résumés d’évènements.',
      'Mesurer la performance de l’application et planifier les évolutions produits.',
    ],
  },
  {
    id: 'sharing',
    icon: Users,
    title: 'Partage et visibilité',
    description: 'Nous partageons vos informations uniquement dans les cas suivants :',
    points: [
      'Communauté : vos posts, statistiques de défis et avis de spots visibles selon vos paramètres de confidentialité.',
      'Partenaires de confiance : services d’hébergement, de modération, d’analyse et de paiement dans le respect de contrats stricts.',
      'Autorités : uniquement si la loi l’exige et dans le cadre de procédures officielles.',
    ],
  },
  {
    id: 'control',
    icon: Lock,
    title: 'Vos contrôles',
    description: 'Inspiré par les outils de Facebook, vous disposez sur Shredloc de :',
    points: [
      'Tableau de bord de confidentialité pour choisir qui peut voir vos posts, vos spots sauvegardés et vos badges.',
      'Historique d’activités pour consulter et supprimer vos interactions.',
      'Paramètres de notifications et rappel de sessions ajustables à tout moment.',
      'Outils de téléchargement et de suppression de compte disponibles dans le centre de paramètres.',
    ],
  },
  {
    id: 'international',
    icon: Globe2,
    title: 'Transferts internationaux',
    description:
      'Certains partenaires de traitement se situent hors de l’Union européenne. Nous appliquons des clauses contractuelles types et audits de sécurité pour maintenir un niveau de protection équivalent à celui de l’UE.',
    points: [],
  },
];

const commitments = [
  'Cryptage en transit pour toutes les connexions et sauvegardes sensibles.',
  'Vérification humaine et automatisée pour protéger les jeunes riders et signaler les abus.',
  'Révision régulière de cette politique ; nous vous notifierons des changements majeurs dans l’application.',
];

export default function PrivacyPolicySection({ onNavigate }: PrivacyPolicySectionProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3 text-gray-400">
          {onNavigate && (
            <button
              onClick={() => onNavigate('settings')}
              className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition-colors"
            >
              <ChevronLeft size={18} />
              Retour aux paramètres
            </button>
          )}
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Politique de confidentialité Shredloc</h1>
          <p className="text-gray-400 max-w-3xl">
            Nous suivons les meilleures pratiques des grands réseaux sociaux comme Facebook pour garantir transparence et contrôle.
            Cette page décrit en détail comment vos informations sont utilisées lorsque vous ridez avec la communauté.
          </p>
        </div>
      </header>

      <div className="space-y-6">
        {policySections.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.id} className="bg-dark-800 border border-dark-700 rounded-3xl p-6 md:p-8">
              <div className="flex items-start gap-4 mb-4">
                <span className="w-12 h-12 rounded-2xl bg-orange-500/15 text-orange-400 flex items-center justify-center">
                  <Icon size={24} />
                </span>
                <div>
                  <h2 className="text-2xl font-semibold text-white mb-2">{section.title}</h2>
                  <p className="text-gray-400">{section.description}</p>
                </div>
              </div>
              {section.points.length > 0 && (
                <ul className="list-disc list-inside space-y-2 text-gray-300">
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <section className="bg-dark-900/60 border border-dark-700 rounded-3xl p-6 md:p-8">
        <h2 className="text-2xl font-semibold text-white mb-4">Nos engagements</h2>
        <ul className="space-y-3">
          {commitments.map((commitment) => (
            <li key={commitment} className="flex items-start gap-3 text-gray-300">
              <CheckCircle size={20} className="text-orange-400 mt-1" />
              <span>{commitment}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
