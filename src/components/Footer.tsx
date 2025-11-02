import type { Section } from '../types';

interface FooterProps {
  onSectionChange?: (section: Section) => boolean | void;
}

export default function Footer({ onSectionChange }: FooterProps) {
  const handleNavigate = (section: Section) => {
    const result = onSectionChange?.(section);
    if (result === false) {
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-dark-800/95 border-t border-dark-700/80 py-5 px-4 text-sm text-gray-400 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] lg:fixed lg:bottom-0 lg:left-0 lg:right-0 lg:z-40">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row lg:px-4">
        <p className="text-center sm:text-left">© {new Date().getFullYear()} Shredloc. Tous droits réservés.</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => handleNavigate('privacy')}
            className="hover:text-orange-400 transition-colors"
          >
            Politique de confidentialité
          </button>
          <span className="hidden sm:inline text-gray-600">|</span>
          <button
            type="button"
            onClick={() => handleNavigate('terms')}
            className="hover:text-orange-400 transition-colors"
          >
            Conditions générales
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-gray-600">|</span>
          <button id="returns-policy-link" type="button" onClick={() => handleNavigate('returns')} className="hover:text-orange-400 transition-colors">
            Retours & annulations
          </button>
          <span className="hidden sm:inline text-gray-600">|</span>
          <button type="button" onClick={() => handleNavigate('legal')} className="hover:text-orange-400 transition-colors">
            Mentions l�gales
          </button>
        </div>
      </div>
    </footer>
  );
}
