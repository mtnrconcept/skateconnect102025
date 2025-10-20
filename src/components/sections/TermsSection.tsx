import { ChevronLeft, Scale, UsersRound, ShieldCheck, Hammer, Clock, Globe, FileSignature } from 'lucide-react';
import type { Section } from '../../types';

interface TermsSectionProps {
  onNavigate?: (section: Section) => void;
}

const termsChapters = [
  {
    id: 'mission',
    icon: UsersRound,
    title: 'Mission et acceptation',
    content:
      'En créant un compte Shredloc, vous rejoignez une communauté de riders inspirée des standards Facebook : créer des connexions positives, valoriser la créativité et protéger chaque utilisateur.',
  },
  {
    id: 'eligibility',
    icon: Scale,
    title: 'Éligibilité et sécurité',
    content:
      'Vous devez avoir au moins 13 ans pour utiliser la plateforme. Nous pouvons suspendre un compte en cas de non-respect des règles communautaires, de fraude ou d’usurpation d’identité.',
  },
  {
    id: 'content',
    icon: FileSignature,
    title: 'Contenu et propriété intellectuelle',
    content:
      'Vous restez propriétaire des contenus que vous partagez (photos, vidéos, spots). En les publiant, vous nous accordez une licence mondiale limitée pour les héberger, les distribuer et les afficher dans Shredloc et ses fonctionnalités dérivées.',
  },
  {
    id: 'responsibility',
    icon: ShieldCheck,
    title: 'Responsabilités des utilisateurs',
    content:
      'Respectez les lois locales, ne partagez pas de contenus haineux, violents ou dangereux. Signalez les comportements abusifs pour que nos équipes puissent agir rapidement.',
  },
  {
    id: 'moderation',
    icon: Hammer,
    title: 'Modération et recours',
    content:
      'Nous utilisons des systèmes automatisés et une équipe de modération humaine. En cas de suppression ou de suspension, vous pouvez faire appel via le centre d’aide en fournissant des informations complémentaires.',
  },
  {
    id: 'updates',
    icon: Clock,
    title: 'Mises à jour des conditions',
    content:
      'Nous réviserons ces conditions au fur et à mesure du développement de nouvelles fonctionnalités. Nous vous informerons des modifications majeures avant leur entrée en vigueur.',
  },
  {
    id: 'jurisdiction',
    icon: Globe,
    title: 'Droit applicable',
    content:
      'Ces conditions sont régies par le droit français. Tout litige pourra être soumis aux tribunaux compétents de Paris, sauf dispositions légales impératives contraires.',
  },
];

export default function TermsSection({ onNavigate }: TermsSectionProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      <header className="flex flex-col gap-4">
        {onNavigate && (
          <button
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition-colors self-start"
          >
            <ChevronLeft size={18} />
            Retour aux paramètres
          </button>
        )}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Conditions générales d’utilisation</h1>
          <p className="text-gray-400 max-w-3xl">
            Inspirées de l’expérience Facebook, ces conditions définissent les règles qui permettent à chacun de rider en
            confiance sur Shredloc.
          </p>
        </div>
      </header>

      <div className="space-y-6">
        {termsChapters.map((chapter) => {
          const Icon = chapter.icon;
          return (
            <section key={chapter.id} className="bg-dark-800 border border-dark-700 rounded-3xl p-6 md:p-8">
              <div className="flex items-start gap-4">
                <span className="w-12 h-12 rounded-2xl bg-orange-500/15 text-orange-400 flex items-center justify-center">
                  <Icon size={24} />
                </span>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-white">{chapter.title}</h2>
                  <p className="text-gray-400">{chapter.content}</p>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <section className="bg-dark-900/60 border border-dark-700 rounded-3xl p-6 md:p-8">
        <h2 className="text-2xl font-semibold text-white mb-4">Engagements communs</h2>
        <ul className="space-y-3 text-gray-300">
          <li>Respecter les autres riders et partager des contenus authentiques.</li>
          <li>Protéger la sécurité des spots en évitant de divulguer des informations sensibles.</li>
          <li>Utiliser les outils de signalement pour nous aider à garder la plateforme sûre.</li>
        </ul>
      </section>
    </div>
  );
}
