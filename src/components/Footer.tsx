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
    <footer className="bg-dark-800 border-t border-dark-700 py-6 px-4 text-sm text-gray-400">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
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
      </div>
    </footer>
  );
}
