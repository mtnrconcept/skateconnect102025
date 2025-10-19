import { Map, Home, Plus, Trophy, User } from 'lucide-react';
import type { Section } from '../types';

interface NavigationProps {
  currentSection: Section;
  onSectionChange: (section: Section) => void;
}

export default function Navigation({ currentSection, onSectionChange }: NavigationProps) {
  const navItems = [
    { id: 'map' as Section, icon: Map, label: 'Carte' },
    { id: 'feed' as Section, icon: Home, label: 'Feed' },
    { id: 'add' as Section, icon: Plus, label: 'Ajouter' },
    { id: 'challenges' as Section, icon: Trophy, label: 'Défis' },
    { id: 'profile' as Section, icon: User, label: 'Profil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={24} className={isActive ? 'stroke-2' : 'stroke-1.5'} />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
