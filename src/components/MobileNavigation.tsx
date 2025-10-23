import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { navigationGroups } from '../data/navigation';
import type { Section } from '../types';

interface MobileNavigationProps {
  currentSection?: Section;
  onNavigate?: (section: Section) => boolean | void;
}

export default function MobileNavigation({ currentSection, onNavigate }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;

    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const handleNavigate = (section: Section) => {
    const result = onNavigate?.(section);
    if (result === false) {
      return;
    }
    setIsOpen(false);
  };

  return (
    <div className="md:hidden">
      <div className="fixed top-4 left-4 z-50">
        <button
          type="button"
          onClick={() => setIsOpen((previous) => !previous)}
          className="p-2.5 rounded-full border border-dark-700/60 bg-dark-900/80 text-gray-300 hover:text-white hover:border-orange-500/40 transition-colors shadow-lg"
          aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="absolute inset-0 bg-black/70" onClick={() => setIsOpen(false)}></div>

        <div
          className={`absolute inset-0 bg-dark-900/98 backdrop-blur flex flex-col overflow-y-auto transition-transform duration-300 ease-out ${
            isOpen ? 'translate-y-0' : '-translate-y-full'
          }`}
        >
          <div className="flex items-center justify-between px-6 pt-16 pb-4 border-b border-dark-700/60">
            <span className="text-sm font-semibold text-white uppercase tracking-wide">Menu</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
              aria-label="Fermer le menu"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 divide-y divide-dark-700/60">
            {navigationGroups.map((group) => (
              <div key={group.title} className="py-6 px-6 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.title}</p>
                <div className="flex flex-col gap-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentSection === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                            : 'text-gray-300 hover:bg-dark-700/80 hover:text-white'
                        }`}
                      >
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
